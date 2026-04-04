/**
 * Report Formatter Service
 *
 * Formats analysis results into human-readable reports.
 */

import type { ImpactReport, FunctionInfo, TestInfo } from './impactAnalyzer.js'

export class ReportFormatter {
  /**
   * Format impact analysis report
   */
  static formatImpactReport(report: ImpactReport): string {
    const lines: string[] = []

    lines.push('Change Impact Analysis Report')
    lines.push('━'.repeat(60))
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push('')

    // Changed files
    lines.push(`📝 Changed Files (${report.changedFiles.length}):`)
    for (const file of report.changedFiles) {
      lines.push(`  - ${file}`)
    }
    lines.push('')

    // Affected functions
    if (report.affectedFunctions.length > 0) {
      lines.push(`🎯 Affected Functions (${report.affectedFunctions.length}):`)
      for (const func of report.affectedFunctions.slice(0, 10)) {
        const complexityBadge = this.getComplexityBadge(func.complexity)
        lines.push(`  - ${func.name} (${func.filePath})`)
        lines.push(`    Complexity: ${func.complexity} ${complexityBadge}`)
      }
      if (report.affectedFunctions.length > 10) {
        lines.push(`  ... and ${report.affectedFunctions.length - 10} more`)
      }
      lines.push('')
    }

    // Affected tests
    if (report.affectedTests.length > 0) {
      lines.push(`🧪 Affected Tests (${report.affectedTests.length}):`)

      // Group by test file
      const testsByFile = new Map<string, TestInfo[]>()
      for (const test of report.affectedTests) {
        if (!testsByFile.has(test.testFile)) {
          testsByFile.set(test.testFile, [])
        }
        testsByFile.get(test.testFile)!.push(test)
      }

      for (const [file, tests] of testsByFile) {
        lines.push(`  ${file}:`)
        for (const test of tests.slice(0, 5)) {
          const statusBadge = this.getStatusBadge(test.lastStatus)
          const timeStr = test.avgExecutionTime
            ? ` (${Math.ceil(test.avgExecutionTime)}ms)`
            : ''
          lines.push(`    - ${test.testName}${timeStr} ${statusBadge}`)
          lines.push(`      → affects ${test.affectedFunction} (depth: ${test.callDepth})`)
        }
        if (tests.length > 5) {
          lines.push(`    ... and ${tests.length - 5} more`)
        }
      }
      lines.push('')
    } else {
      lines.push('🧪 Affected Tests: None')
      lines.push('⚠️  Warning: No tests found for changed code!')
      lines.push('')
    }

    // Recommendation
    lines.push('💡 Recommendation:')
    lines.push(`  ${report.recommendation}`)

    if (report.estimatedTestTime && report.estimatedTestTime > 0) {
      const seconds = Math.ceil(report.estimatedTestTime / 1000)
      lines.push(`  Estimated time: ~${seconds} seconds`)
    }

    return lines.join('\n')
  }

  /**
   * Format coverage statistics
   */
  static formatCoverageStats(stats: {
    totalFunctions: number
    coveredFunctions: number
    uncoveredFunctions: number
    coveragePercentage: number
    avgComplexity: number
  }): string {
    const lines: string[] = []

    lines.push('Test Coverage Statistics')
    lines.push('━'.repeat(60))
    lines.push('')

    const coverageBar = this.getProgressBar(stats.coveragePercentage, 40)
    lines.push(`Overall Coverage: ${coverageBar} ${stats.coveragePercentage.toFixed(1)}%`)
    lines.push('')

    lines.push('Function Coverage:')
    lines.push(`  Total Functions:     ${stats.totalFunctions}`)
    lines.push(`  Covered Functions:   ${stats.coveredFunctions}`)
    lines.push(`  Uncovered Functions: ${stats.uncoveredFunctions}`)
    lines.push(`  Average Complexity:  ${stats.avgComplexity.toFixed(1)}`)

    return lines.join('\n')
  }

  /**
   * Format uncovered functions report
   */
  static formatUncoveredFunctions(functions: FunctionInfo[]): string {
    const lines: string[] = []

    lines.push('Uncovered Functions Report')
    lines.push('━'.repeat(60))
    lines.push('')

    if (functions.length === 0) {
      lines.push('✅ All functions are covered by tests!')
      return lines.join('\n')
    }

    // Sort by complexity (highest first)
    const sorted = [...functions].sort((a, b) => b.complexity - a.complexity)

    // Group by risk level
    const critical = sorted.filter(f => f.complexity >= 15)
    const high = sorted.filter(f => f.complexity >= 10 && f.complexity < 15)
    const medium = sorted.filter(f => f.complexity >= 5 && f.complexity < 10)
    const low = sorted.filter(f => f.complexity < 5)

    if (critical.length > 0) {
      lines.push(`🔴 Critical Risk (${critical.length}):`)
      for (const func of critical.slice(0, 5)) {
        lines.push(`  - ${func.name} (${func.filePath})`)
        lines.push(`    Complexity: ${func.complexity} | Line: ${func.callDepth}`)
      }
      if (critical.length > 5) {
        lines.push(`  ... and ${critical.length - 5} more`)
      }
      lines.push('')
    }

    if (high.length > 0) {
      lines.push(`🟡 High Risk (${high.length}):`)
      for (const func of high.slice(0, 3)) {
        lines.push(`  - ${func.name} (${func.filePath})`)
      }
      if (high.length > 3) {
        lines.push(`  ... and ${high.length - 3} more`)
      }
      lines.push('')
    }

    if (medium.length > 0) {
      lines.push(`🟢 Medium Risk (${medium.length})`)
      lines.push('')
    }

    if (low.length > 0) {
      lines.push(`⚪ Low Risk (${low.length})`)
      lines.push('')
    }

    lines.push('📊 Summary:')
    lines.push(`  Total Uncovered: ${functions.length}`)
    lines.push(`  Critical: ${critical.length} | High: ${high.length} | Medium: ${medium.length} | Low: ${low.length}`)

    return lines.join('\n')
  }

  /**
   * Get complexity badge
   */
  private static getComplexityBadge(complexity: number): string {
    if (complexity >= 15) return '🔴'
    if (complexity >= 10) return '🟡'
    if (complexity >= 5) return '🟢'
    return '⚪'
  }

  /**
   * Get status badge
   */
  private static getStatusBadge(status?: string): string {
    if (!status) return ''
    if (status === 'pass') return '✅'
    if (status === 'fail') return '❌'
    if (status === 'skip') return '⏭️'
    return ''
  }

  /**
   * Get progress bar
   */
  private static getProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width)
    const empty = width - filled
    return '█'.repeat(filled) + '░'.repeat(empty)
  }
}
