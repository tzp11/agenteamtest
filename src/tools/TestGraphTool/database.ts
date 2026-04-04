import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { getCwd } from '../../utils/cwd.js'

/**
 * 函数元数据
 */
export interface FunctionMetadata {
  id?: number
  name: string
  filePath: string
  startLine: number
  endLine: number
  complexity?: number
  language: string
  signature?: string
  isTest?: boolean
  isExported?: boolean
  lastModified: number
  gitCommitHash?: string
}

/**
 * 调用关系
 */
export interface FunctionCall {
  id?: number
  callerId: number
  calleeId: number
  callCount?: number
  callLine?: number
  isDirect?: boolean
}

/**
 * 测试覆盖率
 */
export interface TestCoverage {
  id?: number
  testFunctionId: number
  coveredFunctionId: number
  coverageType: 'direct' | 'indirect' | 'call_chain'
  callDepth?: number
  executionCount?: number
  lastExecuted?: number
}

/**
 * Git 变更记录
 */
export interface GitChange {
  id?: number
  commitHash: string
  filePath: string
  changeType: 'added' | 'modified' | 'deleted'
  linesAdded?: number
  linesDeleted?: number
  author?: string
  timestamp: number
}

/**
 * TestGraph 数据库管理
 */
export class TestGraphDatabase {
  private db: Database.Database
  private dbPath: string

  constructor(cwd?: string) {
    const workingDir = cwd || getCwd()
    const graphDir = path.join(workingDir, '.claude', 'test-graph')

    // 确保目录存在
    if (!fs.existsSync(graphDir)) {
      fs.mkdirSync(graphDir, { recursive: true })
    }

    this.dbPath = path.join(graphDir, 'graph.db')
    this.db = new Database(this.dbPath)

    // 启用外键约束
    this.db.pragma('foreign_keys = ON')

    // 初始化数据库
    this.initialize()
  }

  /**
   * 初始化数据库（创建表和索引）
   */
  private initialize(): void {
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    // 执行 schema
    this.db.exec(schema)
  }

  /**
   * 插入或更新函数
   */
  upsertFunction(func: FunctionMetadata): number {
    const stmt = this.db.prepare(`
      INSERT INTO functions (
        name, file_path, start_line, end_line, complexity,
        language, signature, is_test, is_exported,
        last_modified, git_commit_hash, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(name, file_path, start_line) DO UPDATE SET
        end_line = excluded.end_line,
        complexity = excluded.complexity,
        signature = excluded.signature,
        is_test = excluded.is_test,
        is_exported = excluded.is_exported,
        last_modified = excluded.last_modified,
        git_commit_hash = excluded.git_commit_hash,
        updated_at = strftime('%s', 'now')
      RETURNING id
    `)

    const result = stmt.get(
      func.name,
      func.filePath,
      func.startLine,
      func.endLine,
      func.complexity || 0,
      func.language,
      func.signature || null,
      func.isTest ? 1 : 0,
      func.isExported ? 1 : 0,
      func.lastModified,
      func.gitCommitHash || null
    ) as { id: number }

    return result.id
  }

  /**
   * 插入函数调用关系
   */
  insertFunctionCall(call: FunctionCall): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO function_calls (
        caller_id, callee_id, call_count, call_line, is_direct
      ) VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(
      call.callerId,
      call.calleeId,
      call.callCount || 1,
      call.callLine || null,
      call.isDirect !== false ? 1 : 0
    )
  }

  /**
   * 插入测试覆盖率
   */
  insertTestCoverage(coverage: TestCoverage): void {
    const stmt = this.db.prepare(`
      INSERT INTO test_coverage (
        test_function_id, covered_function_id, coverage_type,
        call_depth, execution_count, last_executed, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(test_function_id, covered_function_id) DO UPDATE SET
        coverage_type = excluded.coverage_type,
        call_depth = excluded.call_depth,
        execution_count = excluded.execution_count,
        last_executed = excluded.last_executed,
        updated_at = strftime('%s', 'now')
    `)

    stmt.run(
      coverage.testFunctionId,
      coverage.coveredFunctionId,
      coverage.coverageType,
      coverage.callDepth || 1,
      coverage.executionCount || 0,
      coverage.lastExecuted || null
    )
  }

  /**
   * 插入 Git 变更记录
   */
  insertGitChange(change: GitChange): number {
    const stmt = this.db.prepare(`
      INSERT INTO git_changes (
        commit_hash, file_path, change_type,
        lines_added, lines_deleted, author, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(commit_hash, file_path) DO UPDATE SET
        change_type = excluded.change_type,
        lines_added = excluded.lines_added,
        lines_deleted = excluded.lines_deleted
      RETURNING id
    `)

    const result = stmt.get(
      change.commitHash,
      change.filePath,
      change.changeType,
      change.linesAdded || 0,
      change.linesDeleted || 0,
      change.author || null,
      change.timestamp
    ) as { id: number }

    return result.id
  }

  /**
   * 查询函数
   */
  findFunction(name: string, filePath?: string): FunctionMetadata | null {
    let stmt
    let result

    if (filePath) {
      stmt = this.db.prepare(`
        SELECT * FROM functions
        WHERE name = ? AND file_path = ?
        LIMIT 1
      `)
      result = stmt.get(name, filePath)
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM functions
        WHERE name = ?
        LIMIT 1
      `)
      result = stmt.get(name)
    }

    return result ? this.mapToFunctionMetadata(result as any) : null
  }

  /**
   * 查询受影响的测试
   */
  findAffectedTests(functionId: number): FunctionMetadata[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT f.*
      FROM functions f
      INNER JOIN test_coverage tc ON f.id = tc.test_function_id
      WHERE tc.covered_function_id = ?
        AND f.is_test = 1
    `)

    const results = stmt.all(functionId)
    return results.map(r => this.mapToFunctionMetadata(r as any))
  }

  /**
   * 查询未覆盖的函数
   */
  findUncoveredFunctions(minComplexity?: number): FunctionMetadata[] {
    let query = `
      SELECT * FROM uncovered_functions
    `

    if (minComplexity !== undefined) {
      query += ` WHERE complexity >= ?`
    }

    query += ` ORDER BY complexity DESC, name ASC`

    const stmt = this.db.prepare(query)
    const results = minComplexity !== undefined
      ? stmt.all(minComplexity)
      : stmt.all()

    return results.map(r => this.mapToFunctionMetadata(r as any))
  }

  /**
   * 查询高风险函数
   */
  findHighRiskFunctions(limit?: number): FunctionMetadata[] {
    let query = `SELECT * FROM high_risk_functions`

    if (limit) {
      query += ` LIMIT ?`
    }

    const stmt = this.db.prepare(query)
    const results = limit ? stmt.all(limit) : stmt.all()

    return results.map(r => this.mapToFunctionMetadata(r as any))
  }

  /**
   * 获取覆盖率统计
   */
  getCoverageStats(): {
    totalFunctions: number
    coveredFunctions: number
    coveragePercentage: number
  } {
    const stmt = this.db.prepare(`SELECT * FROM coverage_stats`)
    const result = stmt.get() as any

    return {
      totalFunctions: result.total_functions || 0,
      coveredFunctions: result.covered_functions || 0,
      coveragePercentage: result.coverage_percentage || 0
    }
  }

  /**
   * 清理旧数据
   */
  cleanup(retentionDays: number = 90): number {
    const cutoffTime = Date.now() / 1000 - retentionDays * 24 * 60 * 60

    const stmt = this.db.prepare(`
      DELETE FROM git_changes
      WHERE timestamp < ?
    `)

    const result = stmt.run(cutoffTime)
    return result.changes
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close()
  }

  /**
   * 映射数据库记录到 FunctionMetadata
   */
  private mapToFunctionMetadata(row: any): FunctionMetadata {
    return {
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      complexity: row.complexity,
      language: row.language,
      signature: row.signature,
      isTest: row.is_test === 1,
      isExported: row.is_exported === 1,
      lastModified: row.last_modified,
      gitCommitHash: row.git_commit_hash
    }
  }
}
