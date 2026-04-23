import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import fs from 'node:fs'
import path from 'node:path'
import { scanCoverageGaps } from './coverageScanner.js'
import { analyzeComplexityRisks } from './complexityAnalyzer.js'
import { analyzeHistoryRisks } from './historyAnalyzer.js'
import { generateDiscoveryReport } from './reportGenerator.js'

const inputSchema = z.strictObject({
  mode: z
    .enum(['coverage-based', 'complexity-based', 'history-based', 'all'])
    .default('all')
    .describe('Scan mode: coverage gaps, complexity risks, historical failures, or all'),

  reportPath: z
    .string()
    .optional()
    .describe('Path to coverage report (auto-detected if not provided)'),

  minComplexity: z
    .number()
    .default(10)
    .describe('Minimum cyclomatic complexity to flag as risk'),

  limit: z
    .number()
    .default(20)
    .describe('Maximum number of results to return'),

  format: z
    .enum(['text', 'json'])
    .default('text')
    .describe('Output format')
})

type InputSchema = z.infer<typeof inputSchema>

export const TestDiscoveryTool = buildTool({
  name: 'TestDiscoveryTool',

  maxResultSizeChars: 30_000,

  async description() {
    return `Actively discovers untested code and potential test gaps in your project.

Scan Modes:
- coverage-based: Find code paths not covered by tests
- complexity-based: Identify high-complexity functions without tests
- history-based: Analyze historical test failures to predict risk areas
- all: Run all scans and generate comprehensive report

Features:
- Identifies uncovered code paths from coverage reports
- Finds high-complexity functions missing tests
- Analyzes historical failure patterns
- Generates prioritized recommendations
- Suggests specific test cases to add

Examples:
- Scan gaps: {mode: "coverage-based"}
- Find risks: {mode: "complexity-based", minComplexity: 15}
- Full analysis: {mode: "all", limit: 50}`
  },

  async prompt() {
    return `Actively discovers untested code and potential test gaps.

Scan Modes:
- coverage-based: Find code paths not covered by tests
- complexity-based: Identify high-complexity functions without tests
- history-based: Analyze historical test failures to predict risk areas
- all: Run all scans and generate comprehensive report`
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

  call: async (args: InputSchema, context, canUseTool, parentMessage) => {
    const cwd = getCwd()
    const limit = args.limit || 20
    const minComplexity = args.minComplexity || 10

    try {
      const results: {
        coverageGaps?: any[]
        complexityRisks?: any[]
        historyRisks?: any[]
      } = {}

      // Coverage-based scan
      if (args.mode === 'coverage-based' || args.mode === 'all') {
        const reportPath = args.reportPath || await findCoverageReport(cwd)
        if (reportPath) {
          results.coverageGaps = await scanCoverageGaps(reportPath, limit)
        }
      }

      // Complexity-based scan
      if (args.mode === 'complexity-based' || args.mode === 'all') {
        results.complexityRisks = await analyzeComplexityRisks(cwd, minComplexity, limit)
      }

      // History-based scan
      if (args.mode === 'history-based' || args.mode === 'all') {
        results.historyRisks = await analyzeHistoryRisks(cwd, limit)
      }

      // Generate report
      const report = generateDiscoveryReport(results, args.format || 'text')

      return {
        data: {
          report,
          summary: {
            coverageGaps: results.coverageGaps?.length || 0,
            complexityRisks: results.complexityRisks?.length || 0,
            historyRisks: results.historyRisks?.length || 0,
            totalGaps: (results.coverageGaps?.length || 0) +
                      (results.complexityRisks?.length || 0) +
                      (results.historyRisks?.length || 0)
          }
        }
      }
    } catch (error) {
      return {
        data: null,
        error: `TestDiscoveryTool error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
})

/**
 * Find coverage report
 */
async function findCoverageReport(cwd: string): Promise<string | null> {
  const patterns = [
    'coverage/coverage-final.json',
    'coverage.json',
    '.coverage',
    'coverage/lcov.info'
  ]

  for (const pattern of patterns) {
    const fullPath = path.join(cwd, pattern)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  return null
}
