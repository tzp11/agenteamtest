/**
 * Call Graph Builder Service
 *
 * Builds function call graphs using LSPTool for code analysis.
 * Extracts function definitions and call relationships.
 */

import type { Database } from 'better-sqlite3'
import { LSPTool } from '../../tools/LSPTool/LSPTool.js'
import path from 'node:path'

export interface FunctionDefinition {
  name: string
  filePath: string
  startLine: number
  endLine: number
  complexity: number
}

export interface CallRelationship {
  callerName: string
  callerFile: string
  calleeName: string
  calleeFile: string
}

export class CallGraphBuilder {
  constructor(
    private db: Database,
    private cwd: string
  ) {}

  /**
   * Build call graph for a file
   */
  async buildCallGraph(filePath: string): Promise<{
    functions: FunctionDefinition[]
    calls: CallRelationship[]
  }> {
    // 1. Initialize LSP if not already done
    await this.ensureLSPInitialized()

    // 2. Get function definitions
    const functions = await this.extractFunctions(filePath)

    // 3. Get call relationships
    const calls = await this.extractCalls(filePath, functions)

    return { functions, calls }
  }

  /**
   * Ensure LSP is initialized
   */
  private async ensureLSPInitialized(): Promise<void> {
    try {
      await LSPTool.call({
        operation: 'initialize',
        rootPath: this.cwd
      })
      // Wait for LSP to index files
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      // LSP might already be initialized, ignore error
    }
  }

  /**
   * Extract function definitions from a file
   */
  private async extractFunctions(filePath: string): Promise<FunctionDefinition[]> {
    try {
      const result = await LSPTool.call({
        operation: 'getSymbols',
        filePath
      })

      if (!result.data || !Array.isArray(result.data.symbols)) {
        return []
      }

      const functions: FunctionDefinition[] = []

      for (const symbol of result.data.symbols) {
        // Filter for function symbols
        if (this.isFunctionSymbol(symbol)) {
          functions.push({
            name: symbol.name,
            filePath,
            startLine: symbol.range?.start?.line || 0,
            endLine: symbol.range?.end?.line || 0,
            complexity: this.estimateComplexity(symbol)
          })
        }
      }

      return functions
    } catch (error) {
      console.error(`Failed to extract functions from ${filePath}:`, error)
      return []
    }
  }

  /**
   * Check if a symbol is a function
   */
  private isFunctionSymbol(symbol: any): boolean {
    const functionKinds = [
      'Function',
      'Method',
      'Constructor',
      'function',
      'method',
      'constructor'
    ]
    return functionKinds.includes(symbol.kind)
  }

  /**
   * Estimate cyclomatic complexity (simplified)
   */
  private estimateComplexity(symbol: any): number {
    // Simple heuristic: count decision points
    // In a real implementation, we'd parse the AST
    const text = symbol.text || ''
    let complexity = 1 // Base complexity

    // Count control flow keywords
    const keywords = ['if', 'else', 'for', 'while', 'switch', 'case', '&&', '||', '?']
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = text.match(regex)
      if (matches) {
        complexity += matches.length
      }
    }

    return complexity
  }

  /**
   * Extract call relationships from a file
   */
  private async extractCalls(
    filePath: string,
    functions: FunctionDefinition[]
  ): Promise<CallRelationship[]> {
    const calls: CallRelationship[] = []

    for (const func of functions) {
      try {
        // Get references to this function
        const result = await LSPTool.call({
          operation: 'findReferences',
          filePath,
          line: func.startLine,
          character: 0
        })

        if (result.data && Array.isArray(result.data.references)) {
          for (const ref of result.data.references) {
            // Find which function contains this reference
            const caller = this.findContainingFunction(
              ref.filePath || filePath,
              ref.range?.start?.line || 0,
              functions
            )

            if (caller && caller.name !== func.name) {
              calls.push({
                callerName: caller.name,
                callerFile: caller.filePath,
                calleeName: func.name,
                calleeFile: func.filePath
              })
            }
          }
        }
      } catch (error) {
        // Ignore errors for individual functions
      }
    }

    return calls
  }

  /**
   * Find which function contains a given line
   */
  private findContainingFunction(
    filePath: string,
    line: number,
    functions: FunctionDefinition[]
  ): FunctionDefinition | null {
    for (const func of functions) {
      if (
        func.filePath === filePath &&
        line >= func.startLine &&
        line <= func.endLine
      ) {
        return func
      }
    }
    return null
  }

  /**
   * Store functions in database
   */
  storeFunctions(functions: FunctionDefinition[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO functions (name, file_path, start_line, end_line, complexity)
      VALUES (?, ?, ?, ?, ?)
    `)

    for (const func of functions) {
      stmt.run(
        func.name,
        func.filePath,
        func.startLine,
        func.endLine,
        func.complexity
      )
    }
  }

  /**
   * Store call relationships in database
   */
  storeCalls(calls: CallRelationship[]): void {
    // First, get function IDs
    const getFunctionId = this.db.prepare(`
      SELECT id FROM functions WHERE name = ? AND file_path = ?
    `)

    const insertCall = this.db.prepare(`
      INSERT OR REPLACE INTO function_calls (caller_id, callee_id, call_count)
      VALUES (?, ?, 1)
      ON CONFLICT(caller_id, callee_id) DO UPDATE SET call_count = call_count + 1
    `)

    for (const call of calls) {
      const caller = getFunctionId.get(call.callerName, call.callerFile) as any
      const callee = getFunctionId.get(call.calleeName, call.calleeFile) as any

      if (caller && callee) {
        insertCall.run(caller.id, callee.id)
      }
    }
  }

  /**
   * Build call graph for multiple files
   */
  async buildCallGraphBatch(filePaths: string[]): Promise<{
    totalFunctions: number
    totalCalls: number
    errors: string[]
  }> {
    let totalFunctions = 0
    let totalCalls = 0
    const errors: string[] = []

    for (const filePath of filePaths) {
      try {
        const { functions, calls } = await this.buildCallGraph(filePath)

        this.storeFunctions(functions)
        this.storeCalls(calls)

        totalFunctions += functions.length
        totalCalls += calls.length
      } catch (error) {
        errors.push(`${filePath}: ${error}`)
      }
    }

    return { totalFunctions, totalCalls, errors }
  }
}
