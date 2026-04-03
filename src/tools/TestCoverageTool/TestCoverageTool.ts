import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import { detectProjectLanguage, getRecommendedCoverageTool, type ProgrammingLanguage } from './languageDetector.js'
import { C8Parser } from './parsers/c8Parser.js'
import { CoveragePyParser } from './parsers/coveragePyParser.js'
import { generateCoverageHeatmap, identifyUncoveredPaths } from './visualizer.js'
import type { CoverageReport } from './types.js'
import fs from 'node:fs'
import path from 'node:path'

const inputSchema = z.strictObject({
  operation: z
    .enum(['detect', 'run', 'parse', 'analyze'])
    .describe('Operation: detect language, run coverage tool, parse existing report, or analyze coverage'),

  language: z
    .string()
    .optional()
    .describe('Programming language (auto-detected if not specified)'),

  tool: z
    .string()
    .optional()
    .describe('Coverage tool to use (auto-selected if not specified)'),

  reportPath: z
    .string()
    .optional()
    .describe('Path to existing coverage report (for parse operation)'),

  testCommand: z
    .string()
    .optional()
    .describe('Custom test command to run (e.g., "npm test -- --coverage")')
})

type InputSchema = z.infer<typeof inputSchema>

export const TestCoverageTool = buildTool({
  name: 'TestCoverageTool',

  maxResultSizeChars: 20_000,

  async description() {
    return `Analyzes test coverage for your project. Supports multiple languages and coverage tools.

Supported Languages:
- JavaScript/TypeScript (c8, nyc, jest)
- Python (coverage.py, pytest-cov)
- Go (go test -cover)
- Java (jacoco)
- C/C++ (gcov, lcov, llvm-cov)
- Rust (tarpaulin, cargo-llvm-cov)
- C# (coverlet)
- PHP, Ruby, Swift, Kotlin

Operations:
- detect: Detect project language and recommend coverage tools
- run: Run coverage tool and generate report
- parse: Parse existing coverage report
- analyze: Analyze coverage and identify gaps

Examples:
- Detect language: {operation: "detect"}
- Run coverage: {operation: "run"}
- Parse report: {operation: "parse", reportPath: "coverage/coverage-final.json"}
- Analyze: {operation: "analyze"}`
  },

  async prompt() {
    return `Analyzes test coverage for your project. Supports multiple languages and coverage tools.

Operations:
- detect: Detect project language and recommend coverage tools
- run: Run coverage tool and generate report
- parse: Parse existing coverage report
- analyze: Analyze coverage and identify gaps`
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

    try {
      switch (args.operation) {
        case 'detect': {
          const detection = await detectProjectLanguage(cwd)
          const tools = getRecommendedCoverageTool(detection.primary)

          return {
            data: {
              primary: detection.primary,
              secondary: detection.secondary,
              confidence: `${detection.confidence}%`,
              recommendedTools: tools,
              fileCount: detection.fileCount,
              message: `Detected ${detection.primary} project with ${detection.confidence}% confidence`
            }
          }
        }

        case 'run': {
          // 检测语言
          const detection = await detectProjectLanguage(cwd)
          const language = (args.language || detection.primary) as ProgrammingLanguage
          const tools = getRecommendedCoverageTool(language)

          if (tools.length === 0) {
            return {
              data: null,
              error: `No coverage tool available for ${language}`
            }
          }

          const tool = args.tool || tools[0]

          // 构建覆盖率命令
          let command: string
          if (args.testCommand) {
            command = args.testCommand
          } else {
            command = buildCoverageCommand(language, tool)
          }

          return {
            data: {
              message: `To run coverage, execute: ${command}`,
              language,
              tool,
              command,
              note: 'Use BashTool to run this command, then use operation="parse" to analyze the report'
            }
          }
        }

        case 'parse': {
          if (!args.reportPath) {
            return {
              data: null,
              error: 'reportPath is required for parse operation'
            }
          }

          const reportPath = path.isAbsolute(args.reportPath)
            ? args.reportPath
            : path.join(cwd, args.reportPath)

          if (!fs.existsSync(reportPath)) {
            return {
              data: null,
              error: `Coverage report not found: ${reportPath}`
            }
          }

          // 根据文件路径或语言选择解析器
          const parser = selectParser(reportPath, args.language)

          if (!parser) {
            return {
              data: null,
              error: 'Unable to determine coverage report format'
            }
          }

          const report = await parser.parse(reportPath)
          const heatmap = generateCoverageHeatmap(report)

          return {
            data: {
              report: heatmap,
              summary: {
                overall: `${report.overall.lines.toFixed(1)}%`,
                files: report.summary.totalFiles,
                lines: `${report.summary.coveredLines}/${report.summary.totalLines}`
              }
            }
          }
        }

        case 'analyze': {
          // 查找覆盖率报告
          const reportPath = await findCoverageReport(cwd)

          if (!reportPath) {
            return {
              data: null,
              error: 'No coverage report found. Run tests with coverage first.'
            }
          }

          const parser = selectParser(reportPath, args.language)

          if (!parser) {
            return {
              data: null,
              error: 'Unable to parse coverage report'
            }
          }

          const report = await parser.parse(reportPath)
          const heatmap = generateCoverageHeatmap(report)
          const uncovered = identifyUncoveredPaths(report)

          return {
            data: {
              report: heatmap,
              uncoveredPaths: uncovered.slice(0, 10),
              summary: {
                overall: `${report.overall.lines.toFixed(1)}%`,
                criticalGaps: uncovered.filter(u => u.priority === 'high').length,
                totalGaps: uncovered.length
              }
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
        error: `TestCoverageTool error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
})

/**
 * 构建覆盖率命令
 */
function buildCoverageCommand(language: ProgrammingLanguage, tool: string): string {
  const commands: Record<string, Record<string, string>> = {
    javascript: {
      'c8': 'c8 npm test',
      'nyc': 'nyc npm test',
      'jest --coverage': 'npm test -- --coverage'
    },
    typescript: {
      'c8': 'c8 npm test',
      'nyc': 'nyc npm test',
      'jest --coverage': 'npm test -- --coverage'
    },
    python: {
      'coverage': 'coverage run -m pytest && coverage json',
      'pytest-cov': 'pytest --cov=. --cov-report=json'
    },
    go: {
      'go test -cover': 'go test -cover ./...',
      'go test -coverprofile': 'go test -coverprofile=coverage.out ./...'
    }
  }

  return commands[language]?.[tool] || tool
}

/**
 * 选择合适的解析器
 */
function selectParser(reportPath: string, language?: string) {
  // 根据文件名判断
  if (reportPath.includes('coverage-final.json') || reportPath.includes('coverage.json')) {
    return language === 'python' ? new CoveragePyParser() : new C8Parser()
  }

  if (reportPath.includes('.coverage')) {
    return new CoveragePyParser()
  }

  // 默认尝试 C8 解析器（JSON 格式通用）
  return new C8Parser()
}

/**
 * 查找覆盖率报告
 */
async function findCoverageReport(cwd: string): Promise<string | null> {
  const patterns = [
    'coverage/coverage-final.json',
    'coverage.json',
    '.coverage',
    'coverage/lcov.info',
    'coverage.out'
  ]

  for (const pattern of patterns) {
    const fullPath = path.join(cwd, pattern)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  return null
}
