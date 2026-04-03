import type { CoverageReport, FileCoverage } from './types.js'

/**
 * 生成 ASCII 覆盖率热力图
 */
export function generateCoverageHeatmap(report: CoverageReport): string {
  const lines: string[] = []

  // 标题
  lines.push('Coverage Report')
  lines.push('━'.repeat(80))
  lines.push(`Generated: ${new Date(report.timestamp).toISOString()}`)
  lines.push(`Language: ${report.language} | Tool: ${report.tool}`)
  lines.push('')

  // 整体覆盖率
  lines.push(`Overall Coverage: ${report.overall.lines.toFixed(1)}%`)
  if (report.overall.branches !== undefined) {
    lines.push(`Branch Coverage: ${report.overall.branches.toFixed(1)}%`)
  }
  if (report.overall.functions !== undefined) {
    lines.push(`Function Coverage: ${report.overall.functions.toFixed(1)}%`)
  }
  lines.push('')

  // 文件覆盖率（按覆盖率排序，最低的在前）
  const sortedFiles = [...report.files].sort((a, b) => a.lines.percentage - b.lines.percentage)

  lines.push('File Coverage:')

  for (const file of sortedFiles.slice(0, 20)) { // 只显示前 20 个文件
    const bar = generateProgressBar(file.lines.percentage)
    const warning = file.lines.percentage < 50 ? ' ⚠️' : file.lines.percentage < 80 ? ' ⚡' : ''
    const fileName = truncateFilePath(file.filePath, 40)

    lines.push(`├─ ${fileName.padEnd(42)} ${bar} ${file.lines.percentage.toFixed(1)}%${warning}`)
  }

  if (sortedFiles.length > 20) {
    lines.push(`└─ ... and ${sortedFiles.length - 20} more files`)
  }

  lines.push('')

  // 未覆盖的关键路径
  const criticalUncovered = sortedFiles
    .filter(f => f.lines.percentage < 80 && f.lines.total > 10)
    .slice(0, 10)

  if (criticalUncovered.length > 0) {
    lines.push('Critical Uncovered Paths:')

    for (const file of criticalUncovered) {
      lines.push(`⚠️  ${file.filePath}`)

      if (file.uncoveredLines && file.uncoveredLines.length > 0) {
        const ranges = compressLineNumbers(file.uncoveredLines)
        lines.push(`    → Lines: ${ranges.join(', ')}`)
      }

      lines.push(`    → Coverage: ${file.lines.covered}/${file.lines.total} lines (${file.lines.percentage.toFixed(1)}%)`)
      lines.push('')
    }
  }

  // 统计摘要
  lines.push('Summary:')
  lines.push(`  Total Files: ${report.summary.totalFiles}`)
  lines.push(`  Covered Files: ${report.summary.coveredFiles}`)
  lines.push(`  Total Lines: ${report.summary.totalLines}`)
  lines.push(`  Covered Lines: ${report.summary.coveredLines}`)
  lines.push(`  Overall Coverage: ${report.overall.lines.toFixed(1)}%`)

  return lines.join('\n')
}

/**
 * 生成进度条
 */
function generateProgressBar(percentage: number, width: number = 10): string {
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled

  return '█'.repeat(filled) + '░'.repeat(empty)
}

/**
 * 截断文件路径
 */
function truncateFilePath(filePath: string, maxLength: number): string {
  if (filePath.length <= maxLength) {
    return filePath
  }

  // 保留文件名，截断路径
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1]

  if (fileName.length >= maxLength - 3) {
    return '...' + fileName.slice(-(maxLength - 3))
  }

  let result = fileName
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i] + '/' + result
    if (candidate.length > maxLength - 3) {
      return '...' + result
    }
    result = candidate
  }

  return result
}

/**
 * 压缩行号为范围
 * 例如: [1, 2, 3, 5, 6, 10] -> ["1-3", "5-6", "10"]
 */
function compressLineNumbers(lines: number[]): string[] {
  if (lines.length === 0) return []

  const sorted = [...lines].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      start = sorted[i]
      end = sorted[i]
    }
  }

  ranges.push(start === end ? `${start}` : `${start}-${end}`)

  return ranges
}

/**
 * 识别未覆盖的关键路径
 */
export function identifyUncoveredPaths(report: CoverageReport): Array<{
  file: string
  lines: string
  type: string
  priority: 'high' | 'medium' | 'low'
  suggestion: string
}> {
  const results: Array<{
    file: string
    lines: string
    type: string
    priority: 'high' | 'medium' | 'low'
    suggestion: string
  }> = []

  for (const file of report.files) {
    // 跳过覆盖率高的文件
    if (file.lines.percentage >= 80) continue

    // 跳过测试文件本身
    if (file.filePath.includes('test') || file.filePath.includes('spec')) continue

    if (file.uncoveredLines && file.uncoveredLines.length > 0) {
      const ranges = compressLineNumbers(file.uncoveredLines)
      const priority = file.lines.percentage < 50 ? 'high' : file.lines.percentage < 70 ? 'medium' : 'low'

      results.push({
        file: file.filePath,
        lines: ranges.join(', '),
        type: guessCodeType(file.filePath),
        priority,
        suggestion: generateSuggestion(file)
      })
    }
  }

  // 按优先级排序
  return results.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

/**
 * 猜测代码类型
 */
function guessCodeType(filePath: string): string {
  if (filePath.includes('error') || filePath.includes('exception')) return 'error-handling'
  if (filePath.includes('auth') || filePath.includes('login')) return 'authentication'
  if (filePath.includes('payment') || filePath.includes('transaction')) return 'payment'
  if (filePath.includes('api') || filePath.includes('controller')) return 'api'
  if (filePath.includes('util') || filePath.includes('helper')) return 'utility'
  return 'business-logic'
}

/**
 * 生成测试建议
 */
function generateSuggestion(file: FileCoverage): string {
  const coverage = file.lines.percentage

  if (coverage < 30) {
    return `Critical: Add comprehensive tests for ${file.filePath}`
  } else if (coverage < 50) {
    return `High priority: Increase test coverage for core logic`
  } else if (coverage < 70) {
    return `Medium priority: Add tests for edge cases and error handling`
  } else {
    return `Low priority: Consider adding tests for remaining branches`
  }
}
