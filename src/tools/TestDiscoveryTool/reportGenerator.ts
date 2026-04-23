import type { CoverageGap } from './coverageScanner.js'
import type { ComplexityRisk } from './complexityAnalyzer.js'
import type { HistoryRisk } from './historyAnalyzer.js'

interface DiscoveryResults {
  coverageGaps?: CoverageGap[]
  complexityRisks?: ComplexityRisk[]
  historyRisks?: HistoryRisk[]
}

/**
 * Generate formatted discovery report
 */
export function generateDiscoveryReport(results: DiscoveryResults, format: 'text' | 'json' = 'text'): string {
  if (format === 'json') {
    return JSON.stringify(results, null, 2)
  }

  let report = ''
  const border = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

  report += `Test Gap Analysis Report\n`
  report += `${border}\n`
  report += `Generated: ${new Date().toISOString().replace('T', ' ').split('.')[0]}\n\n`

  // Coverage Gaps
  if (results.coverageGaps && results.coverageGaps.length > 0) {
    report += `🔴 Coverage Gaps (${results.coverageGaps.length}):\n`
    report += `${border}\n`

    for (const gap of results.coverageGaps) {
      const icon = gap.priority === 'high' ? '🔴' : gap.priority === 'medium' ? '🟡' : '🟢'
      report += `${icon} ${gap.file}:${gap.lines}\n`
      report += `   Coverage: ${gap.coverage.toFixed(1)}% | Uncovered: ${gap.uncoveredStatements} statements\n`
      report += `   → ${gap.suggestion}\n\n`
    }
  }

  // Complexity Risks
  if (results.complexityRisks && results.complexityRisks.length > 0) {
    report += `⚠️ Complexity Risks (${results.complexityRisks.length}):\n`
    report += `${border}\n`

    for (const risk of results.complexityRisks) {
      const icon = risk.risk === 'critical' ? '🔴' : risk.risk === 'high' ? '🟠' : risk.risk === 'medium' ? '🟡' : '🟢'
      report += `${icon} ${risk.function} (${risk.file}:${risk.startLine})\n`
      report += `   Complexity: ${risk.complexity} | Risk: ${risk.risk}\n`
      report += `   → ${risk.suggestion}\n\n`
    }
  }

  // History Risks
  if (results.historyRisks && results.historyRisks.length > 0) {
    report += `📊 Historical Risks (${results.historyRisks.length}):\n`
    report += `${border}\n`

    for (const risk of results.historyRisks) {
      report += `⚠️ ${risk.area}\n`
      report += `   Failures: ${risk.failureCount} | Last: ${risk.lastFailure}\n`
      report += `   Common error: ${risk.commonError}\n`
      report += `   → ${risk.suggestion}\n\n`
    }
  }

  // Summary
  const totalGaps = (results.coverageGaps?.length || 0) +
                    (results.complexityRisks?.length || 0) +
                    (results.historyRisks?.length || 0)

  report += `${border}\n`
  report += `📊 Statistics:\n`
  report += `- Coverage gaps: ${results.coverageGaps?.length || 0}\n`
  report += `- Complexity risks: ${results.complexityRisks?.length || 0}\n`
  report += `- Historical risks: ${results.historyRisks?.length || 0}\n`
  report += `- Total gaps identified: ${totalGaps}\n`

  if (totalGaps === 0) {
    report += `\n✅ No significant test gaps found! Your test coverage looks good.\n`
  }

  return report
}

/**
 * Generate priority-sorted list of test recommendations
 */
export function generatePriorityRecommendations(results: DiscoveryResults): Array<{
  priority: number
  type: 'coverage' | 'complexity' | 'history'
  file: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
}> {
  const recommendations: Array<{
    priority: number
    type: 'coverage' | 'complexity' | 'history'
    file: string
    suggestion: string
    impact: 'high' | 'medium' | 'low'
  }> = []

  let priority = 1

  // Coverage gaps - high priority
  if (results.coverageGaps) {
    for (const gap of results.coverageGaps) {
      recommendations.push({
        priority: priority++,
        type: 'coverage',
        file: gap.file,
        suggestion: gap.suggestion,
        impact: gap.priority === 'high' ? 'high' : gap.priority === 'medium' ? 'medium' : 'low'
      })
    }
  }

  // Complexity risks - medium priority
  if (results.complexityRisks) {
    for (const risk of results.complexityRisks) {
      recommendations.push({
        priority: priority++,
        type: 'complexity',
        file: risk.file,
        suggestion: risk.suggestion,
        impact: risk.risk === 'critical' ? 'high' : risk.risk === 'high' ? 'medium' : 'low'
      })
    }
  }

  // History risks - lower priority
  if (results.historyRisks) {
    for (const risk of results.historyRisks) {
      recommendations.push({
        priority: priority++,
        type: 'history',
        file: risk.area,
        suggestion: risk.suggestion,
        impact: risk.failureCount > 5 ? 'high' : risk.failureCount > 2 ? 'medium' : 'low'
      })
    }
  }

  // Sort by impact
  const impactOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => {
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[a.impact] - impactOrder[b.impact]
    }
    return a.priority - b.priority
  })

  return recommendations
}
