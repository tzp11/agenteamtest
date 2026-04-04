import type { TestGraphDatabase, FunctionMetadata, FunctionCall } from './database.js'
import { getCwd } from '../../utils/cwd.js'
import { LSPTool } from '../LSPTool/LSPTool.js'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 调用图构建器
 * 使用 LSPTool 分析代码并构建函数调用关系图
 */
export class CallGraphBuilder {
  private db: TestGraphDatabase
  private cwd: string

  constructor(db: TestGraphDatabase, cwd?: string) {
    this.db = db
    this.cwd = cwd || getCwd()
  }

  /**
   * 扫描项目并构建调用图
   */
  async buildCallGraph(options: {
    filePatterns?: string[]
    languages?: string[]
    maxDepth?: number
  } = {}): Promise<{
    functionsProcessed: number
    callsFound: number
    errors: string[]
  }> {
    const {
      filePatterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
      languages = ['typescript', 'javascript'],
      maxDepth = 3
    } = options

    const errors: string[] = []
    let functionsProcessed = 0
    let callsFound = 0

    // 1. 查找所有匹配的文件
    const files = await this.findFiles(filePatterns)

    // 2. 对每个文件提取函数和调用关系
    for (const filePath of files) {
      try {
        const result = await this.processFile(filePath, maxDepth)
        functionsProcessed += result.functionsProcessed
        callsFound += result.callsFound
      } catch (error) {
        errors.push(`Error processing ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      functionsProcessed,
      callsFound,
      errors
    }
  }

  /**
   * 处理单个文件
   */
  private async processFile(filePath: string, maxDepth: number): Promise<{
    functionsProcessed: number
    callsFound: number
  }> {
    let functionsProcessed = 0
    let callsFound = 0

    // 1. 使用 LSPTool 获取文件中的所有符号（函数）
    const symbolsResult = await LSPTool.call(
      {
        operation: 'documentSymbol',
        filePath,
        line: 1,
        character: 1
      },
      {} as any,
      async () => ({ behavior: 'allow' as const }),
      undefined as any
    )

    if (!symbolsResult.data || symbolsResult.data.error) {
      return { functionsProcessed, callsFound }
    }

    const symbols = symbolsResult.data.symbols || []

    // 2. 处理每个函数符号
    for (const symbol of symbols) {
      if (this.isFunctionSymbol(symbol)) {
        // 插入函数到数据库
        const functionId = this.db.upsertFunction({
          name: symbol.name,
          filePath,
          startLine: symbol.range.start.line,
          endLine: symbol.range.end.line,
          complexity: 0, // TODO: 计算圈复杂度
          language: this.detectLanguage(filePath),
          signature: symbol.detail || undefined,
          isTest: this.isTestFunction(symbol.name),
          isExported: true, // TODO: 检测是否导出
          lastModified: Date.now() / 1000
        })

        functionsProcessed++

        // 3. 分析函数的调用关系
        try {
          const calls = await this.analyzeFunctionCalls(filePath, symbol, maxDepth)

          for (const call of calls) {
            // 查找被调用的函数
            const callee = this.db.findFunction(call.calleeName, call.calleeFilePath)

            if (callee && callee.id) {
              this.db.insertFunctionCall({
                callerId: functionId,
                calleeId: callee.id,
                callLine: call.callLine,
                isDirect: call.depth === 1
              })
              callsFound++
            }
          }
        } catch (error) {
          // 忽略单个函数的错误，继续处理其他函数
          console.error(`Error analyzing calls for ${symbol.name}:`, error)
        }
      }
    }

    return { functionsProcessed, callsFound }
  }

  /**
   * 分析函数的调用关系
   */
  private async analyzeFunctionCalls(
    filePath: string,
    symbol: any,
    maxDepth: number
  ): Promise<Array<{
    calleeName: string
    calleeFilePath?: string
    callLine: number
    depth: number
  }>> {
    const calls: Array<{
      calleeName: string
      calleeFilePath?: string
      callLine: number
      depth: number
    }> = []

    // 使用 LSPTool 的 prepareCallHierarchy 和 outgoingCalls
    try {
      // 1. 准备调用层次结构
      const hierarchyResult = await LSPTool.call(
        {
          operation: 'prepareCallHierarchy',
          filePath,
          line: symbol.range.start.line,
          character: symbol.range.start.character
        },
        {} as any,
        async () => ({ behavior: 'allow' as const }),
        undefined as any
      )

      if (!hierarchyResult.data || hierarchyResult.data.error) {
        return calls
      }

      const hierarchyItems = hierarchyResult.data.items || []
      if (hierarchyItems.length === 0) {
        return calls
      }

      // 2. 获取出站调用（这个函数调用了哪些函数）
      const outgoingResult = await LSPTool.call(
        {
          operation: 'outgoingCalls',
          filePath,
          line: symbol.range.start.line,
          character: symbol.range.start.character
        },
        {} as any,
        async () => ({ behavior: 'allow' as const }),
        undefined as any
      )

      if (!outgoingResult.data || outgoingResult.data.error) {
        return calls
      }

      const outgoingCalls = outgoingResult.data.calls || []

      // 3. 提取调用信息
      for (const call of outgoingCalls) {
        if (call.to) {
          calls.push({
            calleeName: call.to.name,
            calleeFilePath: call.to.uri ? this.uriToPath(call.to.uri) : undefined,
            callLine: call.fromRanges?.[0]?.start?.line || symbol.range.start.line,
            depth: 1
          })
        }
      }
    } catch (error) {
      console.error(`Error analyzing call hierarchy for ${symbol.name}:`, error)
    }

    return calls
  }

  /**
   * 判断是否是函数符号
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
   * 判断是否是测试函数
   */
  private isTestFunction(name: string): boolean {
    const testPatterns = [
      /^test/i,
      /^it\s/i,
      /^describe\s/i,
      /^should/i,
      /_test$/i,
      /Test$/
    ]
    return testPatterns.some(pattern => pattern.test(name))
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp'
    }
    return languageMap[ext] || 'unknown'
  }

  /**
   * 查找匹配的文件
   */
  private async findFiles(patterns: string[]): Promise<string[]> {
    // 简化实现：只扫描 src 目录
    const srcDir = path.join(this.cwd, 'src')
    if (!fs.existsSync(srcDir)) {
      return []
    }

    const files: string[] = []

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          // 跳过 node_modules 等目录
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            scanDir(fullPath)
          }
        } else if (entry.isFile()) {
          // 检查文件扩展名
          const ext = path.extname(entry.name)
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    scanDir(srcDir)
    return files
  }

  /**
   * 将 URI 转换为文件路径
   */
  private uriToPath(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.substring(7)
    }
    return uri
  }
}
