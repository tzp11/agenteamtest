/**
 * Fix Report Generator - Generate detailed fix reports
 *
 * Generates formatted reports for test healing results including
 * statistics, recommendations, and actionable fixes.
 */

import { HealingResult, FailureType, Language, TestFailureInfo } from './reactEngine.js'
import { FixActionResult } from './fixStrategies.js'

// Report configuration
export interface ReportConfig {
  format: 'text' | 'json' | 'markdown'
  includeDetails: boolean
  includeRecommendations: boolean
}

// Report sections
export interface ReportSection {
  title: string
  content: string
  level: 'info' | 'warning' | 'success' | 'error'
}

// Main report interface
export interface FixReport {
  summary: {
    testName: string
    success: boolean
    attempts: number
    healingTime: number
  }
  classification: {
    type: FailureType
    language: Language
  }
  steps: ReportSection[]
  recommendations: string[]
  statistics: {
    successRate: number
    patternsUsed: number
  }
}

// Format time in human-readable format
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

// Get emoji for failure type
function getFailureEmoji(type: FailureType): string {
  switch (type) {
    case FailureType.ENVIRONMENT: return '🔧'
    case FailureType.TEST_CODE: return '🧪'
    case FailureType.SOURCE_CODE: return '💻'
    case FailureType.UNKNOWN: return '❓'
  }
}

// Get emoji for language
function getLanguageEmoji(lang: Language): string {
  switch (lang) {
    case 'c': return '🐚'
    case 'python': return '🐍'
    case 'java': return '☕'
    case 'go': return '🔵'
    case 'rust': return '🦀'
    default: return '📄'
  }
}

// Generate summary section
function generateSummary(result: HealingResult, testName: string): ReportSection {
  const emoji = result.success ? '✅' : '❌'
  return {
    title: 'Summary',
    content: `${emoji} Test: ${testName}\n` +
      `Status: ${result.success ? 'Fixed' : 'Not Fixed'}\n` +
      `Attempts: ${result.attempts}/${result.maxAttempts}\n` +
      `Time: ${formatTime(result.healingTime)}`,
    level: result.success ? 'success' : 'error'
  }
}

// Generate classification section
function generateClassification(result: HealingResult): ReportSection {
  const emoji = getFailureEmoji(result.failureType)
  return {
    title: 'Classification',
    content: `${emoji} Type: ${result.failureType}\n` +
      `${getLanguageEmoji(result.language)} Language: ${result.language}`,
    level: 'info'
  }
}

// Generate steps section
function generateSteps(result: HealingResult): ReportSection[] {
  return result.steps.map((step, index) => ({
    title: `Step ${index + 1}`,
    content: `Thought: ${step.thought}\n` +
      `Action: ${step.action}\n` +
      `Observation: ${step.observation}`,
    level: step.success ? 'success' : 'warning'
  }))
}

// Generate recommendations based on failure type
function generateRecommendations(
  result: HealingResult,
  fixResult?: FixActionResult
): string[] {
  const recommendations: string[] = []

  if (!result.success) {
    recommendations.push('Manual intervention required')
  }

  switch (result.failureType) {
    case FailureType.ENVIRONMENT:
      recommendations.push('Check build tools and dependencies')
      recommendations.push('Verify test environment configuration')
      recommendations.push('Run build commands manually to see detailed errors')
      break
    case FailureType.TEST_CODE:
      recommendations.push('Review test code for logic errors')
      recommendations.push('Check mock/stub configurations')
      recommendations.push('Verify assertion conditions')
      break
    case FailureType.SOURCE_CODE:
      recommendations.push('This may be a real bug in source code')
      recommendations.push('Review the stack trace for the error location')
      recommendations.push('Consider if this is expected behavior')
      break
    case FailureType.UNKNOWN:
      recommendations.push('Run test manually to get more details')
      recommendations.push('Check test output for additional context')
      break
  }

  if (fixResult?.fix) {
    recommendations.push(`Suggested fix: ${fixResult.fix}`)
  }

  return recommendations
}

/**
 * Generate a text report
 */
export function generateTextReport(
  result: HealingResult,
  testName: string,
  fixResult?: FixActionResult
): string {
  const lines: string[] = []

  // Header
  lines.push('═'.repeat(60))
  lines.push('         TEST HEALING REPORT')
  lines.push('═'.repeat(60))

  // Summary
  const summary = generateSummary(result, testName)
  lines.push('')
  lines.push(`📋 ${summary.title}`)
  lines.push(summary.content)

  // Classification
  const classification = generateClassification(result)
  lines.push('')
  lines.push(`🏷️ ${classification.title}`)
  lines.push(classification.content)

  // Steps
  if (result.steps.length > 0) {
    lines.push('')
    lines.push('📝 ReAct Steps')
    const steps = generateSteps(result)
    for (const step of steps) {
      lines.push(`  ${step.title}:`)
      lines.push(`    ${step.content.replace(/\n/g, '\n    ')}`)
    }
  }

  // Recommendations
  const recommendations = generateRecommendations(result, fixResult)
  if (recommendations.length > 0) {
    lines.push('')
    lines.push('💡 Recommendations')
    for (const rec of recommendations) {
      lines.push(`  • ${rec}`)
    }
  }

  // Footer
  lines.push('')
  lines.push('═'.repeat(60))
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('═'.repeat(60))

  return lines.join('\n')
}

/**
 * Generate a markdown report
 */
export function generateMarkdownReport(
  result: HealingResult,
  testName: string,
  fixResult?: FixActionResult
): string {
  const lines: string[] = []

  // Header
  lines.push('# Test Healing Report')
  lines.push('')

  // Summary
  const summary = generateSummary(result, testName)
  lines.push(`## ${summary.title}`)
  lines.push('')
  lines.push(summary.content)
  lines.push('')

  // Classification
  const classification = generateClassification(result)
  lines.push(`## ${classification.title}`)
  lines.push('')
  lines.push(classification.content)
  lines.push('')

  // Steps
  if (result.steps.length > 0) {
    lines.push('## ReAct Steps')
    lines.push('')
    const steps = generateSteps(result)
    for (const step of steps) {
      lines.push(`### ${step.title}`)
      lines.push('')
      lines.push(step.content)
      lines.push('')
    }
  }

  // Recommendations
  const recommendations = generateRecommendations(result, fixResult)
  if (recommendations.length > 0) {
    lines.push('## Recommendations')
    lines.push('')
    for (const rec of recommendations) {
      lines.push(`- ${rec}`)
    }
    lines.push('')
  }

  // Metadata
  lines.push('---')
  lines.push('')
  lines.push(`*Generated: ${new Date().toISOString()}*`)

  return lines.join('\n')
}

/**
 * Generate a JSON report
 */
export function generateJsonReport(
  result: HealingResult,
  testName: string,
  fixResult?: FixActionResult
): FixReport {
  return {
    summary: {
      testName,
      success: result.success,
      attempts: result.attempts,
      healingTime: result.healingTime
    },
    classification: {
      type: result.failureType,
      language: result.language
    },
    steps: generateSteps(result),
    recommendations: generateRecommendations(result, fixResult),
    statistics: {
      successRate: result.success ? 100 : 0,
      patternsUsed: 0
    }
  }
}

/**
 * Generate a report in the specified format
 */
export function generateReport(
  result: HealingResult,
  testName: string,
  format: 'text' | 'json' | 'markdown' = 'text',
  fixResult?: FixActionResult
): string | FixReport {
  switch (format) {
    case 'text':
      return generateTextReport(result, testName, fixResult)
    case 'markdown':
      return generateMarkdownReport(result, testName, fixResult)
    case 'json':
      return generateJsonReport(result, testName, fixResult)
  }
}

/**
 * Print report to console
 */
export function printReport(
  result: HealingResult,
  testName: string,
  format: 'text' | 'json' | 'markdown' = 'text',
  fixResult?: FixActionResult
): void {
  const report = generateReport(result, testName, format, fixResult)
  console.log(report)
}
