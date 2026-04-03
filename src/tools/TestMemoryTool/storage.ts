import fs from 'node:fs'
import path from 'node:path'
import { getCwd } from '../../utils/cwd.js'

/**
 * 测试记录数据结构
 */
export interface TestRecord {
  testName: string
  result: 'pass' | 'fail' | 'skip'
  timestamp: number
  executionTime?: number
  filePath?: string
  errorMessage?: string
  stackTrace?: string
}

/**
 * 测试统计数据
 */
export interface TestStatistics {
  testName: string
  totalRuns: number
  passCount: number
  failCount: number
  skipCount: number
  passRate: number
  avgExecutionTime: number
  lastRun: number
  lastResult: 'pass' | 'fail' | 'skip'
}

/**
 * 失败模式
 */
export interface FailurePattern {
  errorSignature: string
  count: number
  testNames: string[]
  lastOccurrence: number
  commonStackTrace?: string
}

/**
 * JSONL 存储引擎
 */
export class TestMemoryStorage {
  private memoryDir: string
  private historyFile: string
  private statisticsFile: string
  private patternsFile: string

  constructor(cwd?: string) {
    const workingDir = cwd || getCwd()
    this.memoryDir = path.join(workingDir, '.claude', 'test-memory')
    this.historyFile = path.join(this.memoryDir, 'test-history.jsonl')
    this.statisticsFile = path.join(this.memoryDir, 'test-statistics.json')
    this.patternsFile = path.join(this.memoryDir, 'failure-patterns.json')

    // 确保目录存在
    this.ensureDirectoryExists()
  }

  /**
   * 确保存储目录存在
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true })
    }
  }

  /**
   * 记录测试结果
   */
  async recordTest(record: TestRecord): Promise<void> {
    // 追加到 JSONL 文件
    const line = JSON.stringify(record) + '\n'
    fs.appendFileSync(this.historyFile, line, 'utf-8')

    // 更新统计数据
    await this.updateStatistics(record)

    // 如果是失败，更新失败模式
    if (record.result === 'fail' && record.errorMessage) {
      await this.updateFailurePatterns(record)
    }
  }

  /**
   * 查询测试历史
   */
  async queryHistory(options: {
    testName?: string
    result?: 'pass' | 'fail' | 'skip'
    limit?: number
    since?: number
  }): Promise<TestRecord[]> {
    if (!fs.existsSync(this.historyFile)) {
      return []
    }

    const content = fs.readFileSync(this.historyFile, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.length > 0)

    let records: TestRecord[] = lines.map(line => JSON.parse(line))

    // 过滤
    if (options.testName) {
      records = records.filter(r => r.testName === options.testName)
    }
    if (options.result) {
      records = records.filter(r => r.result === options.result)
    }
    if (options.since) {
      records = records.filter(r => r.timestamp >= options.since)
    }

    // 按时间倒序排序（最新的在前）
    records.sort((a, b) => b.timestamp - a.timestamp)

    // 限制数量
    if (options.limit) {
      records = records.slice(0, options.limit)
    }

    return records
  }

  /**
   * 获取测试统计
   */
  async getStatistics(testName?: string): Promise<TestStatistics[]> {
    if (!fs.existsSync(this.statisticsFile)) {
      return []
    }

    const content = fs.readFileSync(this.statisticsFile, 'utf-8')
    const stats: Record<string, TestStatistics> = JSON.parse(content)

    if (testName) {
      return stats[testName] ? [stats[testName]] : []
    }

    return Object.values(stats)
  }

  /**
   * 更新统计数据
   */
  private async updateStatistics(record: TestRecord): Promise<void> {
    let stats: Record<string, TestStatistics> = {}

    if (fs.existsSync(this.statisticsFile)) {
      const content = fs.readFileSync(this.statisticsFile, 'utf-8')
      stats = JSON.parse(content)
    }

    const existing = stats[record.testName]

    if (existing) {
      // 更新现有统计
      existing.totalRuns++
      if (record.result === 'pass') existing.passCount++
      if (record.result === 'fail') existing.failCount++
      if (record.result === 'skip') existing.skipCount++
      existing.passRate = existing.passCount / existing.totalRuns

      // 更新平均执行时间
      if (record.executionTime) {
        const totalTime = existing.avgExecutionTime * (existing.totalRuns - 1) + record.executionTime
        existing.avgExecutionTime = totalTime / existing.totalRuns
      }

      existing.lastRun = record.timestamp
      existing.lastResult = record.result
    } else {
      // 创建新统计
      stats[record.testName] = {
        testName: record.testName,
        totalRuns: 1,
        passCount: record.result === 'pass' ? 1 : 0,
        failCount: record.result === 'fail' ? 1 : 0,
        skipCount: record.result === 'skip' ? 1 : 0,
        passRate: record.result === 'pass' ? 1 : 0,
        avgExecutionTime: record.executionTime || 0,
        lastRun: record.timestamp,
        lastResult: record.result
      }
    }

    fs.writeFileSync(this.statisticsFile, JSON.stringify(stats, null, 2), 'utf-8')
  }

  /**
   * 更新失败模式
   */
  private async updateFailurePatterns(record: TestRecord): Promise<void> {
    if (!record.errorMessage) return

    let patterns: Record<string, FailurePattern> = {}

    if (fs.existsSync(this.patternsFile)) {
      const content = fs.readFileSync(this.patternsFile, 'utf-8')
      patterns = JSON.parse(content)
    }

    // 生成错误签名（简化版：使用错误消息的前 100 个字符）
    const errorSignature = record.errorMessage.substring(0, 100)

    if (patterns[errorSignature]) {
      patterns[errorSignature].count++
      if (!patterns[errorSignature].testNames.includes(record.testName)) {
        patterns[errorSignature].testNames.push(record.testName)
      }
      patterns[errorSignature].lastOccurrence = record.timestamp
    } else {
      patterns[errorSignature] = {
        errorSignature,
        count: 1,
        testNames: [record.testName],
        lastOccurrence: record.timestamp,
        commonStackTrace: record.stackTrace
      }
    }

    fs.writeFileSync(this.patternsFile, JSON.stringify(patterns, null, 2), 'utf-8')
  }

  /**
   * 获取失败模式
   */
  async getFailurePatterns(limit?: number): Promise<FailurePattern[]> {
    if (!fs.existsSync(this.patternsFile)) {
      return []
    }

    const content = fs.readFileSync(this.patternsFile, 'utf-8')
    const patterns: Record<string, FailurePattern> = JSON.parse(content)

    let result = Object.values(patterns)

    // 按出现次数排序
    result.sort((a, b) => b.count - a.count)

    if (limit) {
      result = result.slice(0, limit)
    }

    return result
  }

  /**
   * 清理旧数据（保留最近 N 天）
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    if (!fs.existsSync(this.historyFile)) {
      return 0
    }

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    const content = fs.readFileSync(this.historyFile, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.length > 0)

    const kept: string[] = []
    let removed = 0

    for (const line of lines) {
      const record: TestRecord = JSON.parse(line)
      if (record.timestamp >= cutoffTime) {
        kept.push(line)
      } else {
        removed++
      }
    }

    // 重写文件
    fs.writeFileSync(this.historyFile, kept.join('\n') + '\n', 'utf-8')

    return removed
  }
}
