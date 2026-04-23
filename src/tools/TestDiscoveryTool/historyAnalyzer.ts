import { getCwd } from '../../utils/cwd.js'
import fs from 'node:fs'
import path from 'node:path'

export interface HistoryRisk {
  area: string
  failureCount: number
  lastFailure: string
  commonError: string
  testFiles: string[]
  suggestion: string
}

/**
 * Analyze historical test failures to predict risk areas
 * Uses TestMemoryTool data if available
 */
export async function analyzeHistoryRisks(
  cwd: string,
  limit: number = 20
): Promise<HistoryRisk[]> {
  const risks: HistoryRisk[] = []

  // Try to read test memory data
  const testMemoryPath = path.join(cwd, '.claude', 'test-memory', 'test-history.jsonl')

  if (!fs.existsSync(testMemoryPath)) {
    // No history data - return empty or generate sample
    return []
  }

  // Parse test history
  const history: Array<{
    testName: string
    result: string
    timestamp: number
    error?: string
    filePath?: string
  }> = []

  try {
    const content = fs.readFileSync(testMemoryPath, 'utf-8')
    const lines = content.trim().split('\n')

    for (const line of lines) {
      try {
        history.push(JSON.parse(line))
      } catch {
        // Skip invalid lines
      }
    }
  } catch {
    return []
  }

  // Group failures by test name pattern (extract area)
  const failureMap = new Map<string, {
    count: number
    lastTimestamp: number
    errors: string[]
    testFiles: Set<string>
  }>()

  for (const record of history) {
    if (record.result !== 'fail') continue

    // Extract area from test name (e.g., "test_login_success" -> "login")
    const area = extractArea(record.testName)

    const existing = failureMap.get(area) || {
      count: 0,
      lastTimestamp: 0,
      errors: [],
      testFiles: new Set<string>()
    }

    existing.count++
    existing.lastTimestamp = Math.max(existing.lastTimestamp, record.timestamp)
    if (record.error) {
      existing.errors.push(record.error)
    }
    if (record.filePath) {
      existing.testFiles.add(record.filePath)
    }

    failureMap.set(area, existing)
  }

  // Convert to risk list
  for (const [area, data] of failureMap) {
    if (data.count >= 2) {
      // Get most common error
      const errorCounts = new Map<string, number>()
      for (const err of data.errors) {
        const key = err.substring(0, 50) // Truncate for grouping
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1)
      }

      let commonError = ''
      let maxCount = 0
      for (const [err, count] of errorCounts) {
        if (count > maxCount) {
          maxCount = count
          commonError = err
        }
      }

      risks.push({
        area,
        failureCount: data.count,
        lastFailure: new Date(data.lastTimestamp * 1000).toISOString().split('T')[0],
        commonError: commonError || 'Unknown error',
        testFiles: Array.from(data.testFiles),
        suggestion: `Add more edge case tests for ${area} (${data.count} failures)`
      })
    }
  }

  // Sort by failure count (high first)
  risks.sort((a, b) => b.failureCount - a.failureCount)

  return risks.slice(0, limit)
}

/**
 * Extract area/feature from test name
 */
function extractArea(testName: string): string {
  // Remove common prefixes
  let area = testName
    .replace(/^test_/i, '')
    .replace(/^it_/i, '')
    .replace(/^describe_/i, '')

  // Split by common separators
  const parts = area.split(/[_-]/)

  // Return first meaningful part
  if (parts.length > 1) {
    // Skip common words
    const skipWords = ['should', 'must', 'can', 'will', 'success', 'failure', 'error', 'invalid', 'valid']
    for (const part of parts) {
      if (!skipWords.includes(part.toLowerCase())) {
        return part
      }
    }
  }

  return parts[0] || area
}
