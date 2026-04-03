import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { TestMemoryStorage, type TestRecord } from './storage.js'

const inputSchema = z.strictObject({
  operation: z
    .enum(['record', 'query', 'statistics', 'patterns', 'cleanup'])
    .describe('Operation to perform: record test result, query history, get statistics, get failure patterns, or cleanup old data'),

  // record 操作的参数
  testName: z
    .string()
    .optional()
    .describe('Name of the test (required for record operation)'),
  result: z
    .enum(['pass', 'fail', 'skip'])
    .optional()
    .describe('Test result (required for record operation)'),
  executionTime: z
    .number()
    .optional()
    .describe('Test execution time in milliseconds'),
  filePath: z
    .string()
    .optional()
    .describe('Path to the test file'),
  errorMessage: z
    .string()
    .optional()
    .describe('Error message if test failed'),
  stackTrace: z
    .string()
    .optional()
    .describe('Stack trace if test failed'),

  // query 操作的参数
  limit: z
    .number()
    .optional()
    .describe('Maximum number of records to return (default: 10)'),
  since: z
    .number()
    .optional()
    .describe('Only return records after this timestamp'),

  // cleanup 操作的参数
  retentionDays: z
    .number()
    .optional()
    .describe('Number of days to retain data (default: 90)')
})

type InputSchema = z.infer<typeof inputSchema>

export const TestMemoryTool = buildTool({
  name: 'TestMemoryTool',

  maxResultSizeChars: 10_000,

  async description() {
    return `Records and queries test execution history, statistics, and failure patterns.

Operations:
- record: Record a test execution result
- query: Query test history with filters
- statistics: Get test statistics (pass rate, avg execution time, etc.)
- patterns: Get common failure patterns
- cleanup: Remove old test data

Examples:
- Record a passing test: {operation: "record", testName: "test_login", result: "pass", executionTime: 125}
- Query test history: {operation: "query", testName: "test_login", limit: 10}
- Get statistics: {operation: "statistics", testName: "test_login"}
- Get failure patterns: {operation: "patterns", limit: 5}`
  },

  async prompt() {
    return `Records and queries test execution history, statistics, and failure patterns.

Operations:
- record: Record a test execution result
- query: Query test history with filters
- statistics: Get test statistics (pass rate, avg execution time, etc.)
- patterns: Get common failure patterns
- cleanup: Remove old test data`
  },

  get inputSchema() {
    return inputSchema
  },

  renderToolUseMessage() {
    return null
  },

  mapToolResultToToolResultBlockParam(result) {
    return result
  },

  async checkPermissions(input) {
    // 对于 record 操作，需要写入权限
    if (input.operation === 'record') {
      return {
        behavior: 'ask',
        message: `Record test result for "${input.testName}" (${input.result})?`,
        updatedInput: input
      }
    }
    // 其他操作（query, statistics, patterns）只读，不需要权限
    return { behavior: 'allow', updatedInput: input }
  },

  call: async (args: InputSchema) => {
    const storage = new TestMemoryStorage()

    try {
      switch (args.operation) {
        case 'record': {
          // 验证必需参数
          if (!args.testName || !args.result) {
            return {
              data: null,
              error: 'testName and result are required for record operation'
            }
          }

          const record: TestRecord = {
            testName: args.testName,
            result: args.result,
            timestamp: Date.now(),
            executionTime: args.executionTime,
            filePath: args.filePath,
            errorMessage: args.errorMessage,
            stackTrace: args.stackTrace
          }

          await storage.recordTest(record)

          return {
            data: {
              message: `Test "${args.testName}" recorded successfully`,
              result: args.result,
              timestamp: record.timestamp
            }
          }
        }

        case 'query': {
          const records = await storage.queryHistory({
            testName: args.testName,
            result: args.result,
            limit: args.limit || 10,
            since: args.since
          })

          return {
            data: {
              count: records.length,
              records: records.map(r => ({
                testName: r.testName,
                result: r.result,
                timestamp: r.timestamp,
                date: new Date(r.timestamp).toISOString(),
                executionTime: r.executionTime,
                errorMessage: r.errorMessage
              }))
            }
          }
        }

        case 'statistics': {
          const stats = await storage.getStatistics(args.testName)

          return {
            data: {
              count: stats.length,
              statistics: stats.map(s => ({
                testName: s.testName,
                totalRuns: s.totalRuns,
                passRate: `${(s.passRate * 100).toFixed(1)}%`,
                passCount: s.passCount,
                failCount: s.failCount,
                skipCount: s.skipCount,
                avgExecutionTime: `${s.avgExecutionTime.toFixed(0)}ms`,
                lastRun: new Date(s.lastRun).toISOString(),
                lastResult: s.lastResult
              }))
            }
          }
        }

        case 'patterns': {
          const patterns = await storage.getFailurePatterns(args.limit || 10)

          return {
            data: {
              count: patterns.length,
              patterns: patterns.map(p => ({
                errorSignature: p.errorSignature,
                occurrences: p.count,
                affectedTests: p.testNames,
                lastOccurrence: new Date(p.lastOccurrence).toISOString()
              }))
            }
          }
        }

        case 'cleanup': {
          const removed = await storage.cleanup(args.retentionDays || 90)

          return {
            data: {
              message: `Cleaned up ${removed} old test records`,
              removed,
              retentionDays: args.retentionDays || 90
            }
          }
        }

        default:
          return {
            data: null,
            error: `Unknown operation: ${args.operation}`
          }
      }
    } catch (error) {
      return {
        data: null,
        error: `TestMemoryTool error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
})
