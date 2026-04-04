import type { TestGraphDatabase } from './database.js'
import type { GitDiffDetector } from './gitDiffDetector.js'
import { CallGraphBuilder } from './callGraphBuilder.js'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 增量更新管理器
 * 只扫描和更新发生变化的文件
 */
export class IncrementalUpdater {
  private db: TestGraphDatabase
  private gitDetector: GitDiffDetector
  private cwd: string
  private gitRoot: string | null = null

  constructor(db: TestGraphDatabase, gitDetector: GitDiffDetector, cwd: string) {
    this.db = db
    this.gitDetector = gitDetector
    this.cwd = cwd
  }

  /**
   * 获取 Git 仓库根目录
   */
  private async getGitRoot(): Promise<string> {
    if (this.gitRoot) {
      return this.gitRoot
    }

    try {
      const { exec } = await import('../../utils/Shell.js')
      const command = await exec(
        `cd "${this.cwd}" && git rev-parse --show-toplevel`,
        new AbortController().signal,
        'bash'
      )
      const result = await command.result
      this.gitRoot = result.stdout.trim()
      return this.gitRoot
    } catch (error) {
      console.error('[DEBUG incrementalUpdate] Failed to get git root:', error)
      // 如果获取失败，使用 cwd
      this.gitRoot = this.cwd
      return this.gitRoot
    }
  }

  /**
   * 增量更新调用图
   * 只处理自上次更新以来发生变化的文件
   */
  async incrementalUpdate(options: {
    fromCommit?: string
    maxDepth?: number
  } = {}): Promise<{
    filesProcessed: number
    functionsUpdated: number
    callsUpdated: number
    filesDeleted: number
    errors: string[]
  }> {
    const { fromCommit, maxDepth = 3 } = options
    const errors: string[] = []
    let filesProcessed = 0
    let functionsUpdated = 0
    let callsUpdated = 0
    let filesDeleted = 0

    try {
      // 0. 获取 Git 仓库根目录
      const gitRoot = await this.getGitRoot()
      console.log('[DEBUG incrementalUpdate] Git root:', gitRoot)
      console.log('[DEBUG incrementalUpdate] CWD:', this.cwd)

      // 1. 获取变更的文件列表
      const changes = fromCommit
        ? await this.gitDetector.getChangesBetweenCommits(fromCommit, 'HEAD')
        : await this.getUnstagedAndStagedChanges()

      console.log('[DEBUG incrementalUpdate] Total changes detected:', changes.length)
      console.log('[DEBUG incrementalUpdate] Changes:', JSON.stringify(changes, null, 2))

      // 2. 处理每个变更的文件
      for (const change of changes) {
        try {
          // Git 返回的路径是相对于仓库根目录的，需要使用 gitRoot 而不是 cwd
          const filePath = path.join(gitRoot, change.filePath)
          console.log('[DEBUG incrementalUpdate] Processing change:', change.filePath)
          console.log('[DEBUG incrementalUpdate] Full path:', filePath)
          console.log('[DEBUG incrementalUpdate] Change type:', change.changeType)

          if (change.changeType === 'deleted') {
            // 删除文件：从数据库中移除相关函数
            await this.handleDeletedFile(filePath)
            filesDeleted++
          } else if (change.changeType === 'added' || change.changeType === 'modified') {
            // 新增或修改文件：重新扫描
            const shouldProcess = this.shouldProcessFile(filePath)
            console.log('[DEBUG incrementalUpdate] Should process?', shouldProcess)
            if (shouldProcess) {
              const result = await this.updateFile(filePath, maxDepth)
              functionsUpdated += result.functionsUpdated
              callsUpdated += result.callsUpdated
              filesProcessed++
            }
          }
        } catch (error) {
          errors.push(`Error processing ${change.filePath}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // 3. 更新最后扫描时间戳
      await this.updateLastScanTimestamp()

      return {
        filesProcessed,
        functionsUpdated,
        callsUpdated,
        filesDeleted,
        errors
      }
    } catch (error) {
      errors.push(`Incremental update failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        filesProcessed,
        functionsUpdated,
        callsUpdated,
        filesDeleted,
        errors
      }
    }
  }

  /**
   * 获取未暂存和已暂存的变更
   */
  private async getUnstagedAndStagedChanges() {
    const unstaged = await this.gitDetector.getUnstagedChanges()
    const staged = await this.gitDetector.getStagedChanges()
    return [...unstaged, ...staged]
  }

  /**
   * 处理删除的文件
   */
  private async handleDeletedFile(filePath: string): Promise<void> {
    // 从数据库中删除该文件的所有函数
    // 由于外键约束，相关的调用关系和覆盖率数据也会被级联删除
    const stmt = this.db['db'].prepare(`
      DELETE FROM functions
      WHERE file_path = ?
    `)
    stmt.run(filePath)
  }

  /**
   * 更新单个文件
   */
  private async updateFile(filePath: string, maxDepth: number): Promise<{
    functionsUpdated: number
    callsUpdated: number
  }> {
    let functionsUpdated = 0
    let callsUpdated = 0

    // 1. 删除该文件的旧数据
    await this.handleDeletedFile(filePath)

    // 2. 重新扫描该文件
    const builder = new CallGraphBuilder(this.db, this.cwd)

    // 使用 CallGraphBuilder 的私有方法（需要暴露或重构）
    // 这里简化实现：直接调用 buildCallGraph 但只处理单个文件
    try {
      const result = await builder['processFile'](filePath, maxDepth)
      functionsUpdated = result.functionsProcessed
      callsUpdated = result.callsFound
    } catch (error) {
      // 如果 processFile 是私有的，我们需要另一种方式
      console.error(`Error updating file ${filePath}:`, error)
    }

    return { functionsUpdated, callsUpdated }
  }

  /**
   * 判断是否应该处理该文件
   */
  private shouldProcessFile(filePath: string): boolean {
    console.log('[DEBUG shouldProcessFile] Checking file:', filePath)

    // 只处理代码文件
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.cpp', '.c', '.cs']
    const ext = path.extname(filePath).toLowerCase()
    console.log('[DEBUG shouldProcessFile] Extension:', ext)

    if (!codeExtensions.includes(ext)) {
      console.log('[DEBUG shouldProcessFile] Extension not in code extensions, skipping')
      return false
    }

    // 跳过测试文件（可选）
    // 注意：只匹配文件名，不匹配目录名
    const fileName = path.basename(filePath)
    console.log('[DEBUG shouldProcessFile] File name:', fileName)
    const testPatterns = ['.test.', '.spec.', '_test.', '_spec.']
    if (testPatterns.some(pattern => fileName.includes(pattern))) {
      console.log('[DEBUG shouldProcessFile] File name matches test pattern, skipping')
      return false
    }

    // 跳过特定的测试目录
    const testDirs = ['__tests__', '__mocks__']
    if (testDirs.some(dir => filePath.includes(`/${dir}/`))) {
      console.log('[DEBUG shouldProcessFile] File in test directory, skipping')
      return false
    }

    // 检查文件是否存在
    const exists = fs.existsSync(filePath)
    console.log('[DEBUG shouldProcessFile] File exists?', exists)
    return exists
  }

  /**
   * 更新最后扫描时间戳
   */
  private async updateLastScanTimestamp(): Promise<void> {
    // 在数据库中存储最后扫描的时间戳
    // 可以用于下次增量更新的参考
    const timestamp = Date.now() / 1000

    // 创建一个元数据表来存储这些信息
    this.db['db'].exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    const stmt = this.db['db'].prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES ('last_scan_timestamp', ?, ?)
    `)
    stmt.run(timestamp.toString(), timestamp)
  }

  /**
   * 获取最后扫描时间戳
   */
  async getLastScanTimestamp(): Promise<number | null> {
    try {
      const stmt = this.db['db'].prepare(`
        SELECT value FROM metadata WHERE key = 'last_scan_timestamp'
      `)
      const result = stmt.get() as { value: string } | undefined

      return result ? parseFloat(result.value) : null
    } catch {
      return null
    }
  }

  /**
   * 智能增量更新
   * 自动检测自上次扫描以来的变更
   */
  async smartUpdate(options: {
    maxDepth?: number
    filePatterns?: string[]
  } = {}): Promise<{
    filesProcessed: number
    functionsUpdated: number
    callsUpdated: number
    filesDeleted: number
    errors: string[]
    timeSinceLastScan?: string
  }> {
    const lastScan = await this.getLastScanTimestamp()

    let result
    if (lastScan) {
      // 获取自上次扫描以来的所有提交
      const commits = await this.gitDetector.getRecentChanges(100)
      const relevantCommits = commits.filter(c => c.timestamp > lastScan)

      if (relevantCommits.length > 0) {
        // 使用最早的相关提交作为起点
        const oldestCommit = relevantCommits[relevantCommits.length - 1]
        result = await this.incrementalUpdate({
          fromCommit: oldestCommit.commitHash,
          maxDepth: options.maxDepth
        })
      } else {
        // 没有新的提交，只检查工作目录的变更
        result = await this.incrementalUpdate({
          maxDepth: options.maxDepth
        })
      }

      const timeSinceLastScan = this.formatTimeDiff(Date.now() / 1000 - lastScan)
      return { ...result, timeSinceLastScan }
    } else {
      // 首次扫描，执行完整扫描
      const builder = new CallGraphBuilder(this.db, this.cwd)
      const fullResult = await builder.buildCallGraph({
        maxDepth: options.maxDepth,
        filePatterns: options.filePatterns
      })

      // 更新最后扫描时间戳
      await this.updateLastScanTimestamp()

      return {
        filesProcessed: 0,
        functionsUpdated: fullResult.functionsProcessed,
        callsUpdated: fullResult.callsFound,
        filesDeleted: 0,
        errors: fullResult.errors,
        timeSinceLastScan: 'First scan'
      }
    }
  }

  /**
   * 格式化时间差
   */
  private formatTimeDiff(seconds: number): string {
    if (seconds < 60) {
      return `${Math.floor(seconds)} seconds ago`
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes ago`
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hours ago`
    } else {
      return `${Math.floor(seconds / 86400)} days ago`
    }
  }
}
