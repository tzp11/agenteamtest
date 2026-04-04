/**
 * TestHealingTool - Tool wrapper for ReAct Engine
 *
 * Provides a CLI-friendly interface to the ReAct test healing system.
 * Supports healing, classification, statistics, and fix execution.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  ReActEngine,
  FailureType,
  createReActEngine,
  quickHeal,
  getStatsEngine,
  type HealingResult,
  type TestFailureInfo,
  type ClassificationResult
} from '../../services/testHealing/reactEngine.js'
import {
  executeFix,
  getAvailableStrategies,
  type FixActionResult
} from '../../services/testHealing/fixStrategies.js'
import {
  generateTextReport,
  generateJsonReport,
  generateMarkdownReport,
  printReport
} from '../../services/testHealing/fixReport.js'
import {
  executeHealingFix,
  quickFix,
  type FixExecutionResult
} from '../../services/testHealing/fixExecutor.js'

const inputSchema = z.strictObject({
  operation: z.enum(['heal', 'classify', 'statistics', 'strategies', 'execute', 'report']).describe('The operation to perform'),
  testName: z.string().optional().describe('Name of the failing test'),
  testFile: z.string().optional().describe('Path to the test file'),
  error: z.string().optional().describe('Error message from test failure'),
  stackTrace: z.string().optional().describe('Stack trace (optional)'),
  maxAttempts: z.number().optional().describe('Maximum healing attempts (default: 3)'),
  type: z.enum(['environment', 'test-code', 'source-code', 'unknown']).optional().describe('Failure type for strategies query'),
  language: z.enum(['c', 'python', 'java', 'go', 'rust', 'unknown']).optional().describe('Programming language'),
  dryRun: z.boolean().optional().describe('Dry run mode (default: true)'),
  reportFormat: z.enum(['text', 'json', 'markdown']).optional().describe('Report format')
})

type InputSchema = z.infer<typeof inputSchema>

export const TestHealingTool: ToolDef = buildTool({
  name: 'TestHealingTool',
  description: 'Test self-healing with ReAct engine - diagnose and fix test failures automatically',
  usage: 'Use to automatically diagnose test failures and attempt to fix them',

  async description() {
    return 'Test self-healing with ReAct engine - diagnose and fix test failures automatically'
  },

  async prompt() {
    return 'Use this tool to automatically diagnose test failures and attempt to fix them. It can classify failures into 4 types (ENVIRONMENT, TEST_CODE, SOURCE_CODE, UNKNOWN), suggest repair strategies, and execute a ReAct healing loop with up to 3 retry attempts.'
  },

  get inputSchema() {
    return inputSchema
  },

  renderToolUseMessage() {
    return null
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: JSON.stringify(content)
    }
  },

  call: async (args: InputSchema) => {
    const { operation } = args

    try {
      switch (operation) {
        case 'heal':
        case 'execute': {
          // Use singleton engine to track stats across all calls
          const engine = getStatsEngine()
          await engine.initialize()

          const testName = args.testName || 'unknown'
          const testFile = args.testFile || 'unknown'
          const error = args.error || ''
          const stackTrace = args.stackTrace
          const maxAttempts = args.maxAttempts || 3

          if (!testName || !error) {
            return {
              data: null,
              error: 'testName and error are required'
            }
          }

          const result = await engine.healTest(testName, testFile, error, stackTrace)

          // For 'execute' operation, also run the executor
          if (operation === 'execute') {
            const testInfo: TestFailureInfo = { testName, testFile, error, stackTrace }
            const executionResult = await executeHealingFix(result, testInfo, { dryRun: args.dryRun ?? true })

            let report: string | object
            const reportFormat = args.reportFormat || 'text'
            if (reportFormat === 'json') {
              report = generateJsonReport(result, testName)
            } else if (reportFormat === 'markdown') {
              report = generateMarkdownReport(result, testName)
            } else {
              report = generateTextReport(result, testName)
            }

            return { data: { healing: result, execution: executionResult, report } }
          }

          return { data: result }
        }

        case 'classify': {
          const testName = args.testName || 'unknown'
          const testFile = args.testFile || 'unknown'
          const error = args.error || ''
          const stackTrace = args.stackTrace

          if (!error) {
            return {
              data: null,
              error: 'error is required for classify operation'
            }
          }

          const failure: TestFailureInfo = {
            testName,
            testFile,
            error,
            stackTrace
          }

          const { FailureClassifier } = await import('../../services/testHealing/reactEngine.js')
          const classifier = new FailureClassifier()
          const result = classifier.classify(failure)
          return { data: result }
        }

        case 'statistics': {
          // Use singleton engine to track stats across all calls
          const engine = getStatsEngine()
          await engine.initialize()
          const stats = engine.getStatistics()
          return { data: stats }
        }

        case 'strategies': {
          const type = (args.type as FailureType) || FailureType.UNKNOWN
          const language = (args.language as any) || 'unknown'

          // 动态导入新函数
          const { getStrategyDetails } = await import('../../services/testHealing/fixStrategies.js')
          const strategies = getStrategyDetails(language, type)

          return {
            data: {
              type,
              language,
              strategies: strategies
            }
          }
        }

        case 'report': {
          const testName = args.testName || 'unknown'
          const testFile = args.testFile || 'unknown'
          const error = args.error || ''
          const stackTrace = args.stackTrace
          const reportFormat = args.reportFormat || 'text'

          // Use singleton engine to track stats across all calls
          const engine = getStatsEngine()
          await engine.initialize()
          const healingResult = await engine.healTest(testName, testFile, error, stackTrace)

          let report: string | object
          if (reportFormat === 'json') {
            report = generateJsonReport(healingResult, testName)
          } else if (reportFormat === 'markdown') {
            report = generateMarkdownReport(healingResult, testName)
          } else {
            report = generateTextReport(healingResult, testName)
          }

          return { data: { healing: healingResult, report } }
        }

        default:
          return {
            data: null,
            error: `Unknown operation: ${operation}`
          }
      }
    } catch (error: any) {
      return {
        data: null,
        error: error.message
      }
    }
  }
})

/**
 * Quick heal function - convenience wrapper
 */
export async function healTest(
  testName: string,
  testFile: string,
  error: string,
  stackTrace?: string,
  maxAttempts: number = 3
): Promise<HealingResult> {
  return quickHeal(testName, testFile, error, stackTrace, maxAttempts)
}
