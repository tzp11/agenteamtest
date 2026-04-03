import fs from 'node:fs'
import path from 'node:path'
import { CoverageParser, type CoverageReport, type FileCoverage } from '../types.js'

/**
 * c8/nyc 覆盖率报告解析器
 * 支持 JSON 格式的覆盖率报告
 */
export class C8Parser extends CoverageParser {
  async parse(reportPath: string): Promise<CoverageReport> {
    const content = fs.readFileSync(reportPath, 'utf-8')
    const data = JSON.parse(content)

    const files: FileCoverage[] = []
    let totalLines = 0
    let coveredLines = 0

    // c8/nyc 的 JSON 格式
    for (const [filePath, fileData] of Object.entries(data as Record<string, any>)) {
      if (filePath === 'total') continue

      const lineCoverage = fileData.lines || fileData.l || {}
      const branchCoverage = fileData.branches || fileData.b || {}
      const functionCoverage = fileData.functions || fileData.f || {}

      // 计算行覆盖率
      const lineNumbers = Object.keys(lineCoverage).map(Number)
      const coveredLineNumbers = lineNumbers.filter(line => lineCoverage[line] > 0)
      const uncoveredLineNumbers = lineNumbers.filter(line => lineCoverage[line] === 0)

      const linesTotal = lineNumbers.length
      const linesCovered = coveredLineNumbers.length

      totalLines += linesTotal
      coveredLines += linesCovered

      const fileCov: FileCoverage = {
        filePath,
        lines: {
          total: linesTotal,
          covered: linesCovered,
          uncovered: linesTotal - linesCovered,
          percentage: this.calculatePercentage(linesCovered, linesTotal)
        },
        uncoveredLines: uncoveredLineNumbers
      }

      // 分支覆盖率（如果有）
      if (Object.keys(branchCoverage).length > 0) {
        const branches = Object.values(branchCoverage).flat() as number[]
        const branchesTotal = branches.length
        const branchesCovered = branches.filter(b => b > 0).length

        fileCov.branches = {
          total: branchesTotal,
          covered: branchesCovered,
          uncovered: branchesTotal - branchesCovered,
          percentage: this.calculatePercentage(branchesCovered, branchesTotal)
        }
      }

      // 函数覆盖率（如果有）
      if (Object.keys(functionCoverage).length > 0) {
        const functions = Object.values(functionCoverage) as number[]
        const functionsTotal = functions.length
        const functionsCovered = functions.filter(f => f > 0).length

        fileCov.functions = {
          total: functionsTotal,
          covered: functionsCovered,
          uncovered: functionsTotal - functionsCovered,
          percentage: this.calculatePercentage(functionsCovered, functionsTotal)
        }
      }

      files.push(fileCov)
    }

    // 计算整体覆盖率
    const overallLines = this.calculatePercentage(coveredLines, totalLines)

    return {
      timestamp: Date.now(),
      language: 'javascript',
      tool: 'c8',
      overall: {
        lines: overallLines
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
