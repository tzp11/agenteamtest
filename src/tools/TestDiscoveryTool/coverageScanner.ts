import { C8Parser } from '../TestCoverageTool/parsers/c8Parser.js'
import { CoveragePyParser } from '../TestCoverageTool/parsers/coveragePyParser.js'
import type { CoverageReport, FileCoverage } from '../TestCoverageTool/types.js'

export interface CoverageGap {
  file: string
  lines: string
  type: 'uncovered' | 'partial' | 'branch'
  priority: 'high' | 'medium' | 'low'
  uncoveredStatements: number
  totalStatements: number
  coverage: number
  suggestion: string
}

/**
 * Scan coverage report to find untested code gaps
 */
export async function scanCoverageGaps(reportPath: string, limit: number = 20): Promise<CoverageGap[]> {
  const parser = selectParser(reportPath)
  const report = await parser.parse(reportPath)
  const gaps: CoverageGap[] = []

  for (const file of report.files) {
    if (file.lines.pct < 100) {
      const uncoveredLines = findUncoveredLines(file)

      gaps.push({
        file: file.path,
        lines: uncoveredLines.range,
        type: file.lines.pct === 0 ? 'uncovered' : 'partial',
        priority: file.lines.pct < 50 ? 'high' : file.lines.pct < 80 ? 'medium' : 'low',
        uncoveredStatements: uncoveredLines.count,
        totalStatements: file.lines.total,
        coverage: file.lines.pct,
        suggestion: generateSuggestion(file.path, uncoveredLines.count)
      })
    }
  }

  // Sort by priority (high first) then by coverage (low first)
  gaps.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return a.coverage - b.coverage
  })

  return gaps.slice(0, limit)
}

/**
 * Find uncovered line ranges in a file
 */
function findUncoveredLines(file: FileCoverage): { range: string; count: number } {
  const uncovered: number[] = []

  if (file.lines?.details) {
    for (const line of file.lines.details) {
      if (line.hit === 0) {
        uncovered.push(line.line)
      }
    }
  }

  if (uncovered.length === 0) {
    return { range: 'N/A', count: 0 }
  }

  // Group consecutive lines into ranges
  const ranges: string[] = []
  let start = uncovered[0]
  let end = uncovered[0]

  for (let i = 1; i < uncovered.length; i++) {
    if (uncovered[i] === end + 1) {
      end = uncovered[i]
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      start = uncovered[i]
      end = uncovered[i]
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`)

  // Return first range or combined
  if (ranges.length <= 3) {
    return { range: ranges.join(', '), count: uncovered.length }
  }
  return { range: `${ranges.slice(0, 3).join(', ')} (+${ranges.length - 3} more)`, count: uncovered.length }
}

/**
 * Generate test suggestion based on uncovered code
 */
function generateSuggestion(filePath: string, uncoveredCount: number): string {
  const fileName = path.basename(filePath)
  const ext = path.extname(filePath)

  const baseSuggestions: Record<string, string> = {
    '.ts': `Add unit tests for uncovered functions in ${fileName}`,
    '.js': `Add unit tests for uncovered functions in ${fileName}`,
    '.py': `Add pytest cases for uncovered functions in ${fileName}`,
    '.go': `Add test cases for uncovered functions in ${fileName}`,
    '.c': `Add test cases for uncovered functions in ${fileName}`,
    '.rs': `Add unit tests for uncovered functions in ${fileName}`,
    '.java': `Add JUnit tests for uncovered methods in ${fileName}`
  }

  const base = baseSuggestions[ext] || `Add tests for uncovered code in ${fileName}`

  if (uncoveredCount > 20) {
    return `${base}. Consider breaking into smaller testable units.`
  }
  return base
}

/**
 * Select appropriate parser based on report path
 */
function selectParser(reportPath: string) {
  if (reportPath.includes('.coverage') || reportPath.includes('coverage.py')) {
    return new CoveragePyParser()
  }
  return new C8Parser()
}

// Helper for path.basename
import path from 'node:path'
