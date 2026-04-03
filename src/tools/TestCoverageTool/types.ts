/**
 * 覆盖率数据结构
 */

/**
 * 文件覆盖率信息
 */
export interface FileCoverage {
  filePath: string
  lines: {
    total: number
    covered: number
    uncovered: number
    percentage: number
  }
  branches?: {
    total: number
    covered: number
    uncovered: number
    percentage: number
  }
  functions?: {
    total: number
    covered: number
    uncovered: number
    percentage: number
  }
  uncoveredLines?: number[] // 未覆盖的行号
  uncoveredRanges?: Array<{ start: number; end: number }> // 未覆盖的行范围
}

/**
 * 整体覆盖率报告
 */
export interface CoverageReport {
  timestamp: number
  language: string
  tool: string
  overall: {
    lines: number
    branches?: number
    functions?: number
  }
  files: FileCoverage[]
  summary: {
    totalFiles: number
    coveredFiles: number
    totalLines: number
    coveredLines: number
  }
}

/**
 * 覆盖率解析器基类
 */
export abstract class CoverageParser {
  abstract parse(reportPath: string): Promise<CoverageReport>

  /**
   * 计算百分比
   */
  protected calculatePercentage(covered: number, total: number): number {
    if (total === 0) return 100
    return Math.round((covered / total) * 10000) / 100
  }

  /**
   * 查找覆盖率报告文件
   */
  protected async findReportFile(patterns: string[], cwd: string): Promise<string | null> {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { glob } = await import('glob')

    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd, absolute: true })
      if (files.length > 0) {
        // 返回最新的文件
        const sorted = files.sort((a, b) => {
          const statA = fs.statSync(a)
          const statB = fs.statSync(b)
          return statB.mtime.getTime() - statA.mtime.getTime()
        })
        return sorted[0]
      }
    }

    return null
  }
}
