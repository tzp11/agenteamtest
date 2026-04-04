import { exec } from '../../utils/Shell.js'
import type { GitChange } from './database.js'

/**
 * Git 文件变更信息
 */
export interface GitFileChange {
  filePath: string
  changeType: 'added' | 'modified' | 'deleted' | 'renamed'
  linesAdded: number
  linesDeleted: number
  oldPath?: string  // 用于重命名
}

/**
 * Git Diff 检测器
 */
export class GitDiffDetector {
  private cwd: string

  constructor(cwd: string) {
    this.cwd = cwd
  }

  /**
   * 获取当前 HEAD 的 commit hash
   */
  async getCurrentCommitHash(): Promise<string> {
    const command = await exec(
      `cd "${this.cwd}" && git rev-parse HEAD`,
      new AbortController().signal,
      'bash'
    )
    const result = await command.result
    return result.stdout.trim()
  }

  /**
   * 获取当前分支名
   */
  async getCurrentBranch(): Promise<string> {
    const command = await exec(
      `cd "${this.cwd}" && git branch --show-current`,
      new AbortController().signal,
      'bash'
    )
    const result = await command.result
    return result.stdout.trim()
  }

  /**
   * 获取未暂存的变更
   */
  async getUnstagedChanges(): Promise<GitFileChange[]> {
    return this.parseGitDiffWithStatus(false)
  }

  /**
   * 获取已暂存的变更
   */
  async getStagedChanges(): Promise<GitFileChange[]> {
    return this.parseGitDiffWithStatus(true)
  }

  /**
   * 获取两个 commit 之间的变更
   */
  async getChangesBetweenCommits(
    fromCommit: string,
    toCommit: string = 'HEAD'
  ): Promise<GitFileChange[]> {
    return this.parseGitDiff(`git diff --numstat ${fromCommit}..${toCommit}`)
  }

  /**
   * 获取最近 N 次提交的变更
   */
  async getRecentChanges(count: number = 10): Promise<GitChange[]> {
    const command = await exec(
      `cd "${this.cwd}" && git log -${count} --pretty=format:"%H|%an|%at" --numstat`,
      new AbortController().signal,
      'bash'
    )
    const result = await command.result
    return this.parseGitLog(result.stdout)
  }

  /**
   * 获取指定文件的变更历史
   */
  async getFileHistory(filePath: string, limit: number = 10): Promise<GitChange[]> {
    const command = await exec(
      `cd "${this.cwd}" && git log -${limit} --pretty=format:"%H|%an|%at" --numstat -- "${filePath}"`,
      new AbortController().signal,
      'bash'
    )
    const result = await command.result
    return this.parseGitLog(result.stdout)
  }

  /**
   * 检查文件是否在 Git 中
   */
  async isFileTracked(filePath: string): Promise<boolean> {
    try {
      const command = await exec(
        `cd "${this.cwd}" && git ls-files --error-unmatch "${filePath}"`,
        new AbortController().signal,
        'bash'
      )
      await command.result
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取文件的最后修改信息
   */
  async getFileLastModified(filePath: string): Promise<{
    commitHash: string
    author: string
    timestamp: number
  } | null> {
    try {
      const command = await exec(
        `cd "${this.cwd}" && git log -1 --pretty=format:"%H|%an|%at" -- "${filePath}"`,
        new AbortController().signal,
        'bash'
      )
      const result = await command.result
      const [commitHash, author, timestamp] = result.stdout.trim().split('|')

      return {
        commitHash,
        author,
        timestamp: parseInt(timestamp, 10)
      }
    } catch {
      return null
    }
  }

  /**
   * 结合 git status 解析变更（更准确地判断文件状态）
   */
  private async parseGitDiffWithStatus(staged: boolean): Promise<GitFileChange[]> {
    try {
      // 1. 获取 git status 来判断文件的真实状态
      const statusCommand = await exec(
        `cd "${this.cwd}" && git status --porcelain`,
        new AbortController().signal,
        'bash'
      )
      const statusResult = await statusCommand.result
      const statusMap = new Map<string, string>()

      for (const line of statusResult.stdout.trim().split('\n')) {
        if (line.length < 4) continue
        const status = staged ? line[0] : line[1]  // 第一个字符是暂存区，第二个是工作区
        const filePath = line.substring(3)
        if (status !== ' ') {
          statusMap.set(filePath, status)
        }
      }

      // 2. 获取 numstat 来获取行数变更
      const diffCommand = staged ? 'git diff --cached --numstat' : 'git diff --numstat'
      const command = await exec(
        `cd "${this.cwd}" && ${diffCommand}`,
        new AbortController().signal,
        'bash'
      )
      const result = await command.result
      const lines = result.stdout.trim().split('\n').filter(line => line.length > 0)

      const changes: GitFileChange[] = []

      for (const line of lines) {
        const parts = line.split('\t')
        if (parts.length < 3) continue

        const [added, deleted, filePath] = parts
        const linesAdded = added === '-' ? 0 : parseInt(added, 10)
        const linesDeleted = deleted === '-' ? 0 : parseInt(deleted, 10)

        // 从 status 获取真实的变更类型
        const status = statusMap.get(filePath)
        let changeType: 'added' | 'modified' | 'deleted' | 'renamed'

        if (status === 'A') {
          changeType = 'added'
        } else if (status === 'D') {
          changeType = 'deleted'
        } else if (status === 'R') {
          changeType = 'renamed'
        } else {
          changeType = 'modified'
        }

        changes.push({
          filePath,
          changeType,
          linesAdded,
          linesDeleted
        })
      }

      return changes
    } catch (error) {
      console.error('[DEBUG gitDiffDetector] ERROR in parseGitDiffWithStatus:', error)
      return []
    }
  }

  /**
   * 解析 git diff --numstat 输出
   */
  private async parseGitDiff(command: string): Promise<GitFileChange[]> {
    try {
      console.log('[DEBUG gitDiffDetector] Executing:', command, 'in', this.cwd)
      console.log('[DEBUG gitDiffDetector] About to call exec...')
      const shellCommand = await exec(
        `cd "${this.cwd}" && ${command}`,
        new AbortController().signal,
        'bash'
      )
      console.log('[DEBUG gitDiffDetector] exec returned, waiting for result...')
      const result = await shellCommand.result
      console.log('[DEBUG gitDiffDetector] Result received!')
      console.log('[DEBUG gitDiffDetector] Result.stdout:', result.stdout)
      console.log('[DEBUG gitDiffDetector] Result.stdout length:', result.stdout?.length)
      const lines = result.stdout.trim().split('\n').filter(line => line.length > 0)
      console.log('[DEBUG gitDiffDetector] Lines found:', lines.length)

      const changes: GitFileChange[] = []

      for (const line of lines) {
        const parts = line.split('\t')
        if (parts.length < 3) continue

        const [added, deleted, filePath] = parts
        const linesAdded = added === '-' ? 0 : parseInt(added, 10)
        const linesDeleted = deleted === '-' ? 0 : parseInt(deleted, 10)

        // 检测重命名
        if (filePath.includes(' => ')) {
          const [oldPath, newPath] = filePath.split(' => ').map(p => p.trim())
          changes.push({
            filePath: newPath,
            changeType: 'renamed',
            linesAdded,
            linesDeleted,
            oldPath
          })
        } else {
          // 判断变更类型
          // 对于 commit 之间的 diff，我们无法使用 git status
          // 使用简化的判断：任何有变更的文件都是 modified
          // 除非能从其他信息判断（比如文件路径变化表示 renamed）
          const changeType: 'added' | 'modified' | 'deleted' = 'modified'

          changes.push({
            filePath,
            changeType,
            linesAdded,
            linesDeleted
          })
        }
      }

      return changes
    } catch (error) {
      console.error('[DEBUG gitDiffDetector] ERROR:', error)
      console.error('[DEBUG gitDiffDetector] Error message:', error instanceof Error ? error.message : String(error))
      return []
    }
  }

  /**
   * 解析 git log 输出
   */
  private parseGitLog(output: string): GitChange[] {
    const changes: GitChange[] = []
    const lines = output.trim().split('\n')

    let currentCommit: string | null = null
    let currentAuthor: string | null = null
    let currentTimestamp: number | null = null

    for (const line of lines) {
      if (line.includes('|')) {
        // 提交信息行：hash|author|timestamp
        const [hash, author, timestamp] = line.split('|')
        currentCommit = hash
        currentAuthor = author
        currentTimestamp = parseInt(timestamp, 10)
      } else if (line.trim().length > 0 && currentCommit) {
        // 文件变更行：added\tdeleted\tfilePath
        const parts = line.split('\t')
        if (parts.length < 3) continue

        const [added, deleted, filePath] = parts
        const linesAdded = added === '-' ? 0 : parseInt(added, 10)
        const linesDeleted = deleted === '-' ? 0 : parseInt(deleted, 10)

        // 判断变更类型
        let changeType: 'added' | 'modified' | 'deleted'
        if (linesAdded > 0 && linesDeleted === 0) {
          changeType = 'added'
        } else if (linesAdded === 0 && linesDeleted > 0) {
          changeType = 'deleted'
        } else {
          changeType = 'modified'
        }

        changes.push({
          commitHash: currentCommit,
          filePath,
          changeType,
          linesAdded,
          linesDeleted,
          author: currentAuthor || undefined,
          timestamp: currentTimestamp || Date.now() / 1000
        })
      }
    }

    return changes
  }
}
