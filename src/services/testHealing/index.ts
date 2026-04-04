/**
 * Test Healing Services - ReAct Engine for test self-healing
 */

export {
  ReActEngine,
  FailureClassifier,
  FixStrategy,
  FailureType,
  createReActEngine,
  getStatsEngine,
  quickHeal,
  type HealingResult,
  type TestFailureInfo,
  type ClassificationResult,
  type ReActStep,
  type FixPattern
} from './reactEngine.js'

export {
  executeFix,
  getAvailableStrategies,
  type FixActionResult,
  type StrategyExecutor
} from './fixStrategies.js'

export {
  generateReport,
  generateTextReport,
  generateMarkdownReport,
  generateJsonReport,
  printReport,
  type ReportConfig,
  type ReportSection,
  type FixReport
} from './fixReport.js'

export {
  executeHealingFix,
  applyTestFix,
  quickFix,
  DEFAULT_CONFIG,
  type ExecutorConfig,
  type FixExecutionResult
} from './fixExecutor.js'
