import fs from 'node:fs'
import { CoverageParser, type CoverageReport, type FileCoverage } from '../types.js'

/**
 * coverage.py 覆盖率报告解析器
 * 支持 JSON 格式的覆盖率报告
 */
export class CoveragePyParser extends CoverageParser {
  async parse(reportPath: string): Promise<CoverageReport> {
    const content = fs.readFileSync(reportPath, 'utf-8')
    const data = JSON.parse(content)

    const files: FileCoverage[] = []
    let totalLines = 0
    let coveredLines = 0

    // coverage.py 的 JSON 格式
    const filesData = data.files || {}

    for (const [filePath, fileData] of Object.entries(filesData as Record<string, any>)) {
      const summary = fileData.summary || {}
      const executedLines = fileData.executed_lines || []
      const missingLines = fileData.missing_lines || []

      const linesTotal = summary.num_statements || 0
      const linesCovered = summary.covered_lines || executedLines.length
      const linesUncovered = summary.missing_lines || missingLines.length

      totalLines += linesTotal
      coveredLines += linesCovered

      const fileCov: FileCoverage = {
        filePath,
        lines: {
          total: linesTotal,
          covered: linesCovered,
          uncovered: linesUncovered,
          percentage: this.calculatePercentage(linesCovered, linesTotal)
        },
        uncoveredLines: missingLines
      }

      // 分支覆盖率（如果有）
      if (summary.num_branches) {
        const branchesTotal = summary.num_branches
        const branchesCovered = summary.covered_branches || 0

        fileCov.branches = {
          total: branchesTotal,
          covered: branchesCovered,
          uncovered: branchesTotal - branchesCovered,
          percentage: this.calculatePercentage(branchesCovered, branchesTotal)
        }
      }

      files.push(fileCov)
    }

    // 计算整体覆盖率
    const totals = data.totals || {}
    const overallLines = totals.percent_covered || this.calculatePercentage(coveredLines, totalLines)

    return {
      timestamp: Date.now(),
      language: 'python',
      tool: 'coverage.py',
      overall: {
        lines: overallLines,
        branches: totals.percent_covered_branches
      },
      files,
      summary: {
        totalFiles: files.length,
        coveredFiles: files.filter(f => f.lines.covered > 0).length,
        totalLines,
        coveredLines
      }
    }
  }
}
