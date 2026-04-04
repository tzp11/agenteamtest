import fs from 'node:fs'

/**
 * 简单的 C 语言函数解析器
 * 用于提取函数定义和调用关系
 */

export interface CFunction {
  name: string
  startLine: number
  endLine: number
  signature: string
}

export interface CFunctionCall {
  callerName: string
  calleeName: string
  line: number
}

/**
 * 解析 C 文件，提取函数定义
 */
export function parseCFunctions(filePath: string): CFunction[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const functions: CFunction[] = []

  // 匹配函数定义的正则表达式
  // 匹配: 返回类型 函数名(参数) {
  const functionPattern = /^\s*(static\s+)?(inline\s+)?(const\s+)?(\w+\s+\*?\s*)(\w+)\s*\([^)]*\)\s*\{?/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(functionPattern)

    if (match) {
      const functionName = match[5]

      // 跳过预处理指令和宏定义
      if (line.trim().startsWith('#')) {
        continue
      }

      // 查找函数结束位置（匹配的右大括号）
      let braceCount = 0
      let startLine = i + 1 // 1-based line number
      let endLine = startLine
      let foundStart = false

      for (let j = i; j < lines.length; j++) {
        const currentLine = lines[j]

        for (const char of currentLine) {
          if (char === '{') {
            braceCount++
            foundStart = true
          } else if (char === '}') {
            braceCount--
            if (foundStart && braceCount === 0) {
              endLine = j + 1
              break
            }
          }
        }

        if (foundStart && braceCount === 0) {
          break
        }
      }

      functions.push({
        name: functionName,
        startLine,
        endLine,
        signature: line.trim()
      })
    }
  }

  return functions
}

/**
 * 解析 C 文件，提取函数调用关系
 */
export function parseCFunctionCalls(filePath: string, functionName: string): CFunctionCall[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const calls: CFunctionCall[] = []

  // 匹配函数调用的正则表达式
  // 匹配: 函数名(
  const callPattern = /(\w+)\s*\(/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 跳过注释和预处理指令
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('#')) {
      continue
    }

    let match
    while ((match = callPattern.exec(line)) !== null) {
      const calleeName = match[1]

      // 跳过关键字和常见的非函数调用
      const keywords = ['if', 'while', 'for', 'switch', 'return', 'sizeof', 'typeof']
      if (!keywords.includes(calleeName)) {
        calls.push({
          callerName: functionName,
          calleeName,
          line: i + 1
        })
      }
    }
  }

  return calls
}
