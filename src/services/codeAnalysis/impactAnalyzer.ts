/**
 * Impact Analyzer Service
 *
 * Analyzes the impact of code changes on tests and other code.
 * Integrates with TestGraphTool to query relationships.
 */

import type { Database } from 'better-sqlite3'
import path from 'node:path'

export interface ImpactReport {
  changedFiles: string[]
  affectedFunctions: FunctionInfo[]
  affectedTests: TestInfo[]
  recommendation: string
  estimatedTestTime?: number
}

export interface FunctionInfo {
  id: number
  name: string
  filePath: string
  complexity: number
  callDepth: number
}

export interface TestInfo {
  testName: string
  testFile: string
  affectedFunction: string
  callDepth: number
  lastStatus?: string
  avgExecutionTime?: number
}

export class ImpactAnalyzer {
  constructor(
    private db: Database,
    private cwd: string
  ) {}

  /**
   * Analyze the impact of changed files
   */
  async analyzeImpact(changedFiles: string[]): Promise<ImpactReport> {
    console.log('[DEBUG ImpactAnalyzer] analyzeImpact called with files:', changedFiles)

    const affectedFunctions: FunctionInfo[] = []
    const affectedTestsMap = new Map<string, TestInfo>()

    // 1. Find all functions in changed files
    for (const file of changedFiles) {
      console.log('[DEBUG ImpactAnalyzer] Processing file:', file)
      const functions = this.getFunctionsInFile(file)
      console.log('[DEBUG ImpactAnalyzer] Found functions:', functions.length)
      affectedFunctions.push(...functions)

      // 2. For each function, find affected tests
      for (const func of functions) {
        console.log('[DEBUG ImpactAnalyzer] Finding tests for function:', func.name)
        const tests = this.findAffectedTests(func.id)
        console.log('[DEBUG ImpactAnalyzer] Found tests:', tests.length)
        for (const test of tests) {
          const key = `${test.testFile}:${test.testName}`
          if (!affectedTestsMap.has(key)) {
            affectedTestsMap.set(key, test)
          }
        }
      }
    }

    const affectedTests = Array.from(affectedTestsMap.values())
    console.log('[DEBUG ImpactAnalyzer] Total affected functions:', affectedFunctions.length)
    console.log('[DEBUG ImpactAnalyzer] Total affected tests:', affectedTests.length)

    // 3. Calculate estimated test time
    const estimatedTestTime = affectedTests.reduce(
      (sum, test) => sum + (test.avgExecutionTime || 0),
      0
    )

    // 4. Generate recommendation
    const recommendation = this.generateRecommendation(
      changedFiles,
      affectedFunctions,
      affectedTests,
      estimatedTestTime
    )

    return {
      changedFiles,
      affectedFunctions,
      affectedTests,
      recommendation,
      estimatedTestTime
    }
  }

  /**
   * Get all functions in a file
   * Supports both exact match and suffix match for flexible path matching
   */
  private getFunctionsInFile(filePath: string): FunctionInfo[] {
    // Try exact match first
    let stmt = this.db.prepare(`
      SELECT id, name, file_path, complexity, 0 as call_depth
      FROM functions
      WHERE file_path = ?
    `)
    let results = stmt.all(filePath) as FunctionInfo[]

    if (results.length > 0) {
      return results
    }

    // If exact match fails, try suffix match
    // This handles cases where input is "src/auth.c" but DB has "/full/path/src/auth.c"
    stmt = this.db.prepare(`
      SELECT id, name, file_path, complexity, 0 as call_depth
      FROM functions
      WHERE file_path LIKE '%' || ?
    `)
    results = stmt.all(filePath) as FunctionInfo[]

    if (results.length > 0) {
      return results
    }

    // If still no match, try prefix match
    // This handles cases where input is "/full/path/src/auth.c" but DB has "src/auth.c"
    const basename = filePath.split('/').pop() || filePath
    stmt = this.db.prepare(`
      SELECT id, name, file_path, complexity, 0 as call_depth
      FROM functions
      WHERE file_path LIKE '%' || ?
    `)
    results = stmt.all(basename) as FunctionInfo[]

    return results
  }

  /**
   * Find all tests affected by a function change
   * Uses recursive CTE to traverse call chain AND overrides_id chain
   * When a virtual/base method changes, all overriding methods are also impacted
   */
  private findAffectedTests(functionId: number): TestInfo[] {
    const stmt = this.db.prepare(`
      WITH RECURSIVE
        -- Step 1: expand the modified function to include all override relatives
        override_group AS (
          -- The function itself
          SELECT id FROM functions WHERE id = ?

          UNION

          -- All functions that override this one (children)
          SELECT f.id FROM functions f
          JOIN override_group og ON f.overrides_id = og.id

          UNION

          -- If this function overrides a base, include the base and its other overrides
          SELECT f2.overrides_id FROM functions f2
          WHERE f2.id = ? AND f2.overrides_id IS NOT NULL
        ),
        -- Step 2: from the expanded set, traverse call chain upward
        call_chain AS (
          SELECT f.id, f.name, f.file_path, 0 as depth
          FROM functions f
          WHERE f.id IN (SELECT id FROM override_group WHERE id IS NOT NULL)

          UNION ALL

          SELECT f.id, f.name, f.file_path, cc.depth + 1
          FROM functions f
          JOIN function_calls fc ON f.id = fc.caller_id
          JOIN call_chain cc ON fc.callee_id = cc.id
          WHERE cc.depth < 5
        )
      SELECT DISTINCT
        test_func.name as testName,
        test_func.file_path as testFile,
        cc.name as affectedFunction,
        cc.depth as callDepth,
        NULL as lastStatus,
        NULL as avgExecutionTime
      FROM test_coverage tc
      JOIN call_chain cc ON tc.covered_function_id = cc.id
      JOIN functions test_func ON tc.test_function_id = test_func.id
      ORDER BY cc.depth, test_func.name
    `)

    return stmt.all(functionId, functionId) as TestInfo[]
  }

  /**
   * Find polymorphic impact: given a function, return all override-related functions
   * that would also be affected by a change
   */
  findPolymorphicImpact(functionId: number): FunctionInfo[] {
    const stmt = this.db.prepare(`
      WITH RECURSIVE override_tree AS (
        -- Start: the function itself
        SELECT id, name, file_path, complexity, 0 as call_depth
        FROM functions WHERE id = ?

        UNION ALL

        -- Downward: children that override this function
        SELECT f.id, f.name, f.file_path, f.complexity, ot.call_depth + 1
        FROM functions f
        JOIN override_tree ot ON f.overrides_id = ot.id
        WHERE ot.call_depth < 10
      )
      SELECT * FROM override_tree
      WHERE id != ?
    `)

    return stmt.all(functionId, functionId) as FunctionInfo[]
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    changedFiles: string[],
    affectedFunctions: FunctionInfo[],
    affectedTests: TestInfo[],
    estimatedTime: number
  ): string {
    if (affectedTests.length === 0) {
      return '无受影响的测试。建议检查是否缺少测试覆盖。'
    }

    const testNames = affectedTests.map(t => t.testName)
    const uniqueTestNames = [...new Set(testNames)]

    let recommendation = `建议运行 ${uniqueTestNames.length} 个受影响的测试`

    if (estimatedTime > 0) {
      const seconds = Math.ceil(estimatedTime / 1000)
      recommendation += `\n预计耗时: ~${seconds} 秒`
    }

    // Generate test command based on test file patterns
    const testCommand = this.generateTestCommand(affectedTests)
    if (testCommand) {
      recommendation += `\n\n运行命令:\n${testCommand}`
    }

    return recommendation
  }

  /**
   * Generate test command based on test files
   */
  private generateTestCommand(tests: TestInfo[]): string | null {
    if (tests.length === 0) return null

    const testFiles = [...new Set(tests.map(t => t.testFile))]
    const firstFile = testFiles[0]

    // Detect test framework based on file extension
    if (firstFile.endsWith('.test.ts') || firstFile.endsWith('.spec.ts')) {
      // Jest/Vitest
      const testNames = [...new Set(tests.map(t => t.testName))]
      if (testNames.length <= 5) {
        return `npm test -- --testNamePattern="${testNames.join('|')}"`
      } else {
        return `npm test -- ${testFiles.join(' ')}`
      }
    } else if (firstFile.endsWith('.test.py') || firstFile.endsWith('_test.py')) {
      // pytest
      return `pytest ${testFiles.join(' ')}`
    } else if (firstFile.endsWith('_test.go')) {
      // Go test
      const packages = [...new Set(testFiles.map(f => path.dirname(f)))]
      return `go test ${packages.join(' ')}`
    }

    return null
  }

  /**
   * Find high-risk untested functions
   */
  findHighRiskFunctions(minComplexity: number = 10): FunctionInfo[] {
    const stmt = this.db.prepare(`
      SELECT
        f.id,
        f.name,
        f.file_path as filePath,
        f.complexity,
        0 as callDepth
      FROM functions f
      LEFT JOIN test_coverage tc ON f.id = tc.covered_function_id
      WHERE f.complexity >= ?
      GROUP BY f.id
      HAVING COUNT(tc.id) = 0
      ORDER BY f.complexity DESC
      LIMIT 20
    `)

    return stmt.all(minComplexity) as FunctionInfo[]
  }

  /**
   * Get test coverage statistics for a function
   */
  getFunctionCoverage(functionName: string): {
    functionName: string
    filePath: string
    testCount: number
    avgExecutionTime: number
    passRate: number
  } | null {
    const stmt = this.db.prepare(`
      SELECT
        f.name as functionName,
        f.file_path as filePath,
        COUNT(DISTINCT tc.test_function_id) as testCount,
        0 as avgExecutionTime,
        0 as passRate
      FROM functions f
      LEFT JOIN test_coverage tc ON f.id = tc.covered_function_id
      WHERE f.name = ?
      GROUP BY f.id
    `)

    return stmt.get(functionName) as any
  }
}
