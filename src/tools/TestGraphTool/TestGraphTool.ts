import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import { TestGraphDatabase } from './database.js'
import { GitDiffDetector } from './gitDiffDetector.js'
import { CallGraphBuilder } from './callGraphBuilder.js'
import { IncrementalUpdater } from './incrementalUpdater.js'
import { ImpactAnalyzer } from '../../services/codeAnalysis/impactAnalyzer.js'

const inputSchema = z.strictObject({
  operation: z
    .enum([
      'init',
      'buildCallGraph',
      'incrementalUpdate',
      'findAffectedTests',
      'findUncoveredFunctions',
      'findHighRiskFunctions',
      'getCoverageStats',
      'detectChanges',
      'getFileHistory',
      'analyzeImpact',
      'cleanup'
    ])
    .describe('Operation to perform'),

  // buildCallGraph 参数
  filePatterns: z
    .array(z.string())
    .optional()
    .describe('File patterns to scan (e.g., ["**/*.ts", "**/*.js"])'),

  maxDepth: z
    .number()
    .optional()
    .describe('Maximum call depth to analyze'),

  // findAffectedTests 参数
  functionName: z
    .string()
    .optional()
    .describe('Function name to find affected tests'),

  filePath: z
    .string()
    .optional()
    .describe('File path (for findAffectedTests or getFileHistory)'),

  // findUncoveredFunctions 参数
  minComplexity: z
    .number()
    .optional()
    .describe('Minimum complexity threshold'),

  // findHighRiskFunctions 参数
  limit: z
    .number()
    .optional()
    .describe('Maximum number of results to return'),

  // detectChanges 参数
  fromCommit: z
    .string()
    .optional()
    .describe('Start commit hash (for detectChanges)'),

  toCommit: z
    .string()
    .optional()
    .describe('End commit hash (for detectChanges, defaults to HEAD)'),

  // cleanup 参数
  retentionDays: z
    .number()
    .optional()
    .describe('Number of days to retain data (default: 90)'),

  // analyzeImpact 参数
  changedFiles: z
    .array(z.string())
    .optional()
    .describe('List of changed file paths to analyze impact')
})

type InputSchema = z.infer<typeof inputSchema>

export const TestGraphTool = buildTool({
  name: 'TestGraphTool',

  maxResultSizeChars: 50_000,

  async description() {
    return `Manages code relationship graph and test coverage using SQLite.

Supported Operations:
- init: Initialize the database
- buildCallGraph: Scan project and build function call graph using LSPTool
- incrementalUpdate: Update only changed files since last scan (smart)
- findAffectedTests: Find tests affected by a function change
- findUncoveredFunctions: Find functions without test coverage
- findHighRiskFunctions: Find high-complexity uncovered functions
- getCoverageStats: Get overall coverage statistics
- detectChanges: Detect Git changes (unstaged, staged, or between commits)
- getFileHistory: Get Git history for a specific file
- analyzeImpact: Analyze impact of changed files on tests and functions
- cleanup: Remove old data

Examples:
- Initialize: {operation: "init"}
- Build call graph: {operation: "buildCallGraph"}
- Incremental update: {operation: "incrementalUpdate"}
- Find affected tests: {operation: "findAffectedTests", functionName: "authenticateUser"}
- Analyze impact: {operation: "analyzeImpact", changedFiles: ["src/auth/login.ts"]}
- Find uncovered: {operation: "findUncoveredFunctions", minComplexity: 10}`
  },

  async prompt() {
    return `Manages code relationship graph and test coverage using SQLite.

Operations:
- init: Initialize database
- buildCallGraph: Build call graph
- findAffectedTests: Find affected tests
- findUncoveredFunctions: Find uncovered functions
- findHighRiskFunctions: Find high-risk functions
- getCoverageStats: Get coverage stats
- detectChanges: Detect Git changes
- getFileHistory: Get file history
- cleanup: Clean old data`
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
    const cwd = getCwd()
    console.log('[DEBUG TestGraphTool] cwd:', cwd)
    const db = new TestGraphDatabase(cwd)
    const gitDetector = new GitDiffDetector(cwd)

    try {
      switch (args.operation) {
        case 'init': {
          // 数据库已在构造函数中初始化
          return {
            data: {
              message: 'Database initialized successfully',
              dbPath: db['dbPath']
            }
          }
        }

        case 'buildCallGraph': {
          const builder = new CallGraphBuilder(db, cwd)

          const result = await builder.buildCallGraph({
            filePatterns: args.filePatterns,
            maxDepth: args.maxDepth || 3
          })

          return {
            data: {
              message: 'Call graph built successfully',
              functionsProcessed: result.functionsProcessed,
              callsFound: result.callsFound,
              errors: result.errors.length > 0 ? result.errors : undefined
            }
          }
        }

        case 'incrementalUpdate': {
          const updater = new IncrementalUpdater(db, gitDetector, cwd)

          const result = await updater.smartUpdate({
            maxDepth: args.maxDepth || 3,
            filePatterns: args.filePatterns
          })

          return {
            data: {
              message: 'Incremental update completed',
              filesProcessed: result.filesProcessed,
              functionsUpdated: result.functionsUpdated,
              callsUpdated: result.callsUpdated,
              filesDeleted: result.filesDeleted,
              timeSinceLastScan: result.timeSinceLastScan,
              errors: result.errors.length > 0 ? result.errors : undefined
            }
          }
        }

        case 'findAffectedTests': {
          if (!args.functionName) {
            return {
              data: null,
              error: 'functionName is required for findAffectedTests operation'
            }
          }

          const func = db.findFunction(args.functionName, args.filePath)
          if (!func || !func.id) {
            return {
              data: {
                message: `Function "${args.functionName}" not found in database`,
                affectedTests: []
              }
            }
          }

          const affectedTests = db.findAffectedTests(func.id)

          return {
            data: {
              function: {
                name: func.name,
                filePath: func.filePath,
                complexity: func.complexity
              },
              affectedTests: affectedTests.map(t => ({
                name: t.name,
                filePath: t.filePath,
                startLine: t.startLine
              })),
              count: affectedTests.length
            }
          }
        }

        case 'findUncoveredFunctions': {
          const uncovered = db.findUncoveredFunctions(args.minComplexity)

          return {
            data: {
              uncoveredFunctions: uncovered.map(f => ({
                name: f.name,
                filePath: f.filePath,
                complexity: f.complexity,
                language: f.language,
                startLine: f.startLine
              })),
              count: uncovered.length,
              minComplexity: args.minComplexity || 0
            }
          }
        }

        case 'findHighRiskFunctions': {
          const highRisk = db.findHighRiskFunctions(args.limit)

          return {
            data: {
              highRiskFunctions: highRisk.map(f => ({
                name: f.name,
                filePath: f.filePath,
                complexity: f.complexity,
                language: f.language,
                lastModified: new Date(f.lastModified * 1000).toISOString()
              })),
              count: highRisk.length
            }
          }
        }

        case 'getCoverageStats': {
          const stats = db.getCoverageStats()

          return {
            data: {
              totalFunctions: stats.totalFunctions,
              coveredFunctions: stats.coveredFunctions,
              uncoveredFunctions: stats.totalFunctions - stats.coveredFunctions,
              coveragePercentage: stats.coveragePercentage
            }
          }
        }

        case 'detectChanges': {
          let changes

          if (args.fromCommit) {
            // 检测两个 commit 之间的变更
            changes = await gitDetector.getChangesBetweenCommits(
              args.fromCommit,
              args.toCommit
            )
          } else {
            // 检测未暂存的变更
            const unstaged = await gitDetector.getUnstagedChanges()
            const staged = await gitDetector.getStagedChanges()
            changes = [...unstaged, ...staged]
          }

          return {
            data: {
              changes: changes.map(c => ({
                filePath: c.filePath,
                changeType: c.changeType,
                linesAdded: c.linesAdded,
                linesDeleted: c.linesDeleted
              })),
              count: changes.length,
              fromCommit: args.fromCommit || 'working directory',
              toCommit: args.toCommit || 'HEAD'
            }
          }
        }

        case 'getFileHistory': {
          if (!args.filePath) {
            return {
              data: null,
              error: 'filePath is required for getFileHistory operation'
            }
          }

          const history = await gitDetector.getFileHistory(
            args.filePath,
            args.limit || 10
          )

          return {
            data: {
              filePath: args.filePath,
              history: history.map(h => ({
                commitHash: h.commitHash,
                changeType: h.changeType,
                linesAdded: h.linesAdded,
                linesDeleted: h.linesDeleted,
                author: h.author,
                timestamp: new Date(h.timestamp * 1000).toISOString()
              })),
              count: history.length
            }
          }
        }

        case 'cleanup': {
          const removed = db.cleanup(args.retentionDays || 90)

          return {
            data: {
              message: `Cleaned up ${removed} old records`,
              removed,
              retentionDays: args.retentionDays || 90
            }
          }
        }

        case 'analyzeImpact': {
          console.log('[DEBUG TestGraphTool] analyzeImpact operation started')
          console.log('[DEBUG TestGraphTool] args:', JSON.stringify(args))

          if (!args.changedFiles || args.changedFiles.length === 0) {
            console.log('[DEBUG TestGraphTool] changedFiles is empty or missing')
            return {
              data: null,
              error: 'changedFiles is required for analyzeImpact operation'
            }
          }

          try {
            console.log('[DEBUG TestGraphTool] Creating ImpactAnalyzer...')
            const analyzer = new ImpactAnalyzer(db.getDatabase(), cwd)
            console.log('[DEBUG TestGraphTool] ImpactAnalyzer created, calling analyzeImpact...')
            const impact = await analyzer.analyzeImpact(args.changedFiles)
            console.log('[DEBUG TestGraphTool] analyzeImpact completed, functions:', impact.affectedFunctions.length)

            return {
              data: {
                changedFiles: impact.changedFiles,
                affectedFunctions: impact.affectedFunctions.map(f => ({
                  name: f.name,
                  filePath: f.filePath,
                  complexity: f.complexity,
                  callDepth: f.callDepth
                })),
                affectedTests: impact.affectedTests.map(t => ({
                  testName: t.testName,
                  testFile: t.testFile,
                  affectedFunction: t.affectedFunction,
                  callDepth: t.callDepth,
                  lastStatus: t.lastStatus,
                  avgExecutionTime: t.avgExecutionTime
                })),
                recommendation: impact.recommendation,
                estimatedTestTime: impact.estimatedTestTime
              }
            }
          } catch (error) {
            console.error('[DEBUG TestGraphTool] analyzeImpact error:', error)
            return {
              data: null,
              error: `Failed to analyze impact: ${error instanceof Error ? error.message : String(error)}`
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
        error: `TestGraphTool error: ${error instanceof Error ? error.message : String(error)}`
      }
    } finally {
      db.close()
    }
  }
})
