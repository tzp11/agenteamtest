import { getCwd } from '../../utils/cwd.js'
import fs from 'node:fs'
import path from 'node:path'

export interface ComplexityRisk {
  file: string
  function: string
  startLine: number
  endLine: number
  complexity: number
  testCoverage: number
  risk: 'critical' | 'high' | 'medium' | 'low'
  suggestion: string
}

/**
 * Analyze code complexity and find untested high-complexity functions
 * Uses basic AST-like analysis (can be enhanced with LSPTool)
 */
export async function analyzeComplexityRisks(
  cwd: string,
  minComplexity: number = 10,
  limit: number = 20
): Promise<ComplexityRisk[]> {
  const risks: ComplexityRisk[] = []

  // Find source files
  const sourcePatterns = ['**/*.ts', '**/*.js', '**/*.py', '**/*.go', '**/*.c', '**/*.rs']
  const sourceFiles: string[] = []

  for (const pattern of sourcePatterns) {
    const { globs } = await import('tinyglobby')
    const matches = globs([pattern], { cwd, absolute: true })
    sourceFiles.push(...matches)
  }

  // Analyze each file
  for (const filePath of sourceFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const functions = extractFunctions(filePath, content)

      for (const func of functions) {
        if (func.complexity >= minComplexity) {
          risks.push({
            file: filePath,
            function: func.name,
            startLine: func.startLine,
            endLine: func.endLine,
            complexity: func.complexity,
            testCoverage: 0, // Would integrate with TestCoverageTool
            risk: getRiskLevel(func.complexity),
            suggestion: `Add tests for ${func.name} (complexity: ${func.complexity})`
          })
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  // Sort by complexity (high first)
  risks.sort((a, b) => b.complexity - a.complexity)

  return risks.slice(0, limit)
}

/**
 * Extract function definitions and estimate complexity
 */
function extractFunctions(filePath: string, content: string): Array<{
  name: string
  startLine: number
  endLine: number
  complexity: number
}> {
  const functions: Array<{ name: string; startLine: number; endLine: number; complexity: number }> = []
  const ext = path.extname(filePath)
  const lines = content.split('\n')

  // Simple regex-based function extraction (can be enhanced with LSPTool)
  const patterns: Record<string, RegExp> = {
    '.ts': /(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s*)?\(|const\s+(\w+)\s*[=:]\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*[{:])\s*(?:\/\/.*)?$/gm,
    '.js': /(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s*)?\(|const\s+(\w+)\s*[=:]\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*[{:])\s*(?:\/\/.*)?$/gm,
    '.py': /def\s+(\w+)\s*\(/gm,
    '.go': /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/gm,
    '.c': /(?:void|int|char|float|double|bool|struct\s+\w+)\s+(\w+)\s*\([^)]*\)\s*\{/gm,
    '.rs': /fn\s+(\w+)\s*\(/gm
  }

  const pattern = patterns[ext]
  if (!pattern) return functions

  let match
  const regex = new RegExp(pattern.source, pattern.flags)

  // Count complexity factors in each function
  let currentFunction: { name: string; startLine: number; endLine: number; complexity: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Simple complexity counting
    const complexityFactors = (
      (line.includes('if') ? 1 : 0) +
      (line.includes('else') ? 1 : 0) +
      (line.includes('for') ? 1 : 0) +
      (line.includes('while') ? 1 : 0) +
      (line.includes('case') ? 1 : 0) +
      (line.includes('catch') ? 1 : 0) +
      (line.includes('&&') ? 1 : 0) +
      (line.includes('||') ? 1 : 0)
    )

    if (regex.test(line)) {
      // Found a function
      if (currentFunction) {
        // Save previous function
        currentFunction.complexity = Math.max(1, currentFunction.complexity)
        functions.push(currentFunction)
      }

      const nameMatch = line.match(/(?:function|def|func|fn)\s+(\w+)/)
      const name = nameMatch ? nameMatch[1] : `anonymous_${i}`

      currentFunction = {
        name,
        startLine: lineNum,
        endLine: lineNum,
        complexity: 1 // Base complexity
      }
    } else if (currentFunction) {
      // Add complexity factors
      currentFunction.complexity += complexityFactors
      currentFunction.endLine = lineNum

      // End of function (simple heuristic)
      if (line.match(/^\s*\}/) && currentFunction.endLine - currentFunction.startLine > 2) {
        functions.push(currentFunction)
        currentFunction = null
      }
    }
  }

  // Don't forget the last function
  if (currentFunction) {
    functions.push(currentFunction)
  }

  return functions
}

/**
 * Determine risk level based on complexity
 */
function getRiskLevel(complexity: number): 'critical' | 'high' | 'medium' | 'low' {
  if (complexity >= 20) return 'critical'
  if (complexity >= 15) return 'high'
  if (complexity >= 10) return 'medium'
  return 'low'
}
