/**
 * TestHealingTool - Tool wrapper for ReAct Engine
 *
 * Provides a CLI-friendly interface to the ReAct test healing system.
 */

import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  ReActEngine,
  FailureType,
  createReActEngine,
  quickHeal,
  type HealingResult,
  type TestFailureInfo,
  type ClassificationResult
} from '../../services/testHealing/reactEngine.js'

const inputSchema = z.strictObject({
  operation: z.enum(['heal', 'classify', 'statistics', 'strategies']).describe('The operation to perform'),
  testName: z.string().optional().describe('Name of the failing test'),
  testFile: z.string().optional().describe('Path to the test file'),
  error: z.string().optional().describe('Error message from test failure'),
  stackTrace: z.string().optional().describe('Stack trace (optional)'),
  maxAttempts: z.number().optional().describe('Maximum healing attempts (default: 3)'),
  type: z.enum(['environment', 'test-code', 'source-code', 'unknown']).optional().describe('Failure type for strategies query')
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
        case 'heal': {
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

          const engine = createReActEngine({ maxAttempts })
          await engine.initialize()
          const result = await engine.healTest(testName, testFile, error, stackTrace)
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
          const engine = createReActEngine()
          await engine.initialize()
          const stats = engine.getStatistics()
          return { data: stats }
        }

        case 'strategies': {
          const type = (args.type as FailureType) || FailureType.UNKNOWN
          const engine = createReActEngine()
          const strategies = engine['fixStrategy'].getStrategies(type)

          return {
            data: {
              type,
              strategies: strategies.map(s => ({
                name: s.name,
                description: s.description
              }))
            }
          }
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
