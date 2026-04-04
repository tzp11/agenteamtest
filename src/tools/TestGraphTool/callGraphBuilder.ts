import type { TestGraphDatabase, FunctionMetadata, FunctionCall } from './database.js'
import { getCwd } from '../../utils/cwd.js'
import { LSPTool } from '../LSPTool/LSPTool.js'
import { parseCFunctions, parseCFunctionCalls } from './cParser.js'
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
   * 处理单个文件（公开方法，供增量更新使用）
   */
  async processFile(filePath: string, maxDepth: number): Promise<{
    functionsProcessed: number
    callsFound: number
  }> {
    const language = this.detectLanguage(filePath)

    // 对于 C/C++ 文件，使用简单解析器
    if (language === 'c' || language === 'cpp') {
      return this.processCFile(filePath)
    }

    // 对于其他语言，使用 LSPTool
    return this.processFileWithLSP(filePath, maxDepth)
  }

  /**
   * 使用简单解析器处理 C 文件
   */
  private async processCFile(filePath: string): Promise<{
    functionsProcessed: number
    callsFound: number
  }> {
    let functionsProcessed = 0
    let callsFound = 0

    try {
      const functions = parseCFunctions(filePath)

      for (const func of functions) {
        const functionId = this.db.upsertFunction({
          name: func.name,
          filePath,
          startLine: func.startLine,
          endLine: func.endLine,
          complexity: 0,
          language: this.detectLanguage(filePath),
          signature: func.signature,
          isTest: this.isTestFunction(func.name),
          isExported: true,
          lastModified: Date.now() / 1000
        })

        functionsProcessed++

        const calls = parseCFunctionCalls(filePath, func.name)
        for (const call of calls) {
          const callee = this.db.findFunction(call.calleeName)
          if (callee && callee.id) {
            this.db.insertFunctionCall({
              callerId: functionId,
              calleeId: callee.id,
              callLine: call.line,
              isDirect: true
            })
            callsFound++
          }
        }
      }
    } catch (error) {
      console.error(`Error processing C file ${filePath}:`, error)
    }

    return { functionsProcessed, callsFound }
  }

  /**
   * 使用 LSPTool 处理文件
   */
  private async processFileWithLSP(filePath: string, maxDepth: number): Promise<{
    functionsProcessed: number
    callsFound: number
  }> {
    let functionsProcessed = 0
    let callsFound = 0

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

    for (const symbol of symbols) {
      if (this.isFunctionSymbol(symbol)) {
        const functionId = this.db.upsertFunction({
          name: symbol.name,
          filePath,
          startLine: symbol.range.start.line,
          endLine: symbol.range.end.line,
          complexity: 0,
          language: this.detectLanguage(filePath),
          signature: symbol.detail || undefined,
          isTest: this.isTestFunction(symbol.name),
          isExported: true,
          lastModified: Date.now() / 1000
        })

        functionsProcessed++

        try {
          const calls = await this.analyzeFunctionCalls(filePath, symbol, maxDepth)
          for (const call of calls) {
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
    const files: string[] = []
    const supportedExtensions = new Set<string>()
    const scanDirs = new Set<string>()

    // 从 patterns 中提取目录和扩展名
    for (const pattern of patterns) {
      const extMatch = pattern.match(/\*\.(\w+)$/)
      if (extMatch) {
        supportedExtensions.add(`.${extMatch[1]}`)
      }

      const dirMatch = pattern.match(/^(.+?)\/\*\*/)
      if (dirMatch) {
        const dir = path.join(this.cwd, dirMatch[1])
        if (fs.existsSync(dir)) {
          scanDirs.add(dir)
        }
      } else if (pattern.startsWith('**/')) {
        scanDirs.add(this.cwd)
      } else if (!pattern.includes('/')) {
        // 单个文件名，从当前目录查找
        const filePath = path.join(this.cwd, pattern)
        if (fs.existsSync(filePath)) {
          files.push(filePath)
        }
      }
    }

    // 默认扫描 src 目录
    if (scanDirs.size === 0) {
      const srcDir = path.join(this.cwd, 'src')
      if (fs.existsSync(srcDir)) {
        scanDirs.add(srcDir)
      } else {
        scanDirs.add(this.cwd)
      }
    }

    // 默认扩展名
    if (supportedExtensions.size === 0) {
      supportedExtensions.add('.ts')
      supportedExtensions.add('.tsx')
      supportedExtensions.add('.js')
      supportedExtensions.add('.jsx')
    }

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.claude'].includes(entry.name)) {
            scanDir(fullPath)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          if (supportedExtensions.has(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    for (const dir of scanDirs) {
      scanDir(dir)
    }

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
