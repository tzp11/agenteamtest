/**
 * Result Aggregator - Combines outputs from multiple agents
 */

import type { AgentResult, TestStrategy, GeneratedTest, ReviewResult } from './types.js'

export class ResultAggregator {
  /**
   * Extract test strategy from architect agent output
   */
  extractStrategy(architectResult: AgentResult): TestStrategy | null {
    if (!architectResult.success || !architectResult.output) {
      return null
    }

    const output = architectResult.output

    // Try to parse structured output
    if (output.strategy) {
      return output.strategy
    }

    // Parse from raw text output
    if (typeof output === 'string' || output.rawOutput) {
      const text = output.rawOutput || output
      return this.parseStrategyFromText(text)
    }

    return null
  }

  /**
   * Extract generated tests from engineer agent outputs
   */
  extractTests(engineerResults: AgentResult[]): GeneratedTest[] {
    const tests: GeneratedTest[] = []

    for (const result of engineerResults) {
      if (!result.success || !result.output) continue

      const output = result.output

      // Structured output
      if (Array.isArray(output.tests)) {
        tests.push(...output.tests)
        continue
      }

      // Single test
      if (output.testCode) {
        tests.push({
          testName: output.testName || 'generated_test',
          testFile: output.testFile || 'test/generated.test.ts',
          testCode: output.testCode,
          testType: result.agentType.includes('unit') ? 'unit' : 'integration',
          coverage: output.coverage || { functions: [] }
        })
        continue
      }

      // Parse from raw text
      if (typeof output === 'string' || output.rawOutput) {
        const text = output.rawOutput || output
        const parsedTests = this.parseTestsFromText(text, result.agentType)
        tests.push(...parsedTests)
      }
    }

    return tests
  }

  /**
   * Extract review result from reviewer agent output
   */
  extractReview(reviewerResult: AgentResult): ReviewResult | null {
    if (!reviewerResult.success || !reviewerResult.output) {
      return null
    }

    const output = reviewerResult.output

    // Structured output
    if (output.approved !== undefined) {
      return output as ReviewResult
    }

    // Parse from raw text
    if (typeof output === 'string' || output.rawOutput) {
      const text = output.rawOutput || output
      return this.parseReviewFromText(text)
    }

    return null
  }

  /**
   * Aggregate all results into final orchestration result
   */
  aggregate(
    architectResult: AgentResult | null,
    engineerResults: AgentResult[],
    reviewerResult: AgentResult | null
  ): {
    strategy: TestStrategy | null
    tests: GeneratedTest[]
    review: ReviewResult | null
  } {
    const strategy = architectResult ? this.extractStrategy(architectResult) : null
    const tests = this.extractTests(engineerResults)
    const review = reviewerResult ? this.extractReview(reviewerResult) : null

    return { strategy, tests, review }
  }

  // Helper methods for parsing text output

  private parseStrategyFromText(text: string): TestStrategy | null {
    try {
      // Look for priority sections
      const priorities: any[] = []
      const priorityRegex = /Priority (\d+):([\s\S]*?)(?=Priority \d+:|$)/g
      let match

      while ((match = priorityRegex.exec(text)) !== null) {
        const level = parseInt(match[1])
        const content = match[2]

        // Extract functions from this priority level
        const functions = this.extractFunctionsFromText(content)
        if (functions.length > 0) {
          priorities.push({ level, functions })
        }
      }

      if (priorities.length === 0) {
        return null
      }

      return {
        targetModule: 'extracted_module',
        priorities,
        estimatedTime: 0,
        recommendations: []
      }
    } catch (error) {
      console.warn('[ResultAggregator] Failed to parse strategy:', error)
      return null
    }
  }

  private extractFunctionsFromText(text: string): any[] {
    const functions: any[] = []
    const functionRegex = /Function:\s*`?([^`\n]+)`?\s*\(([^)]+)\)/g
    let match

    while ((match = functionRegex.exec(text)) !== null) {
      functions.push({
        name: match[1].trim(),
        filePath: match[2].trim(),
        complexity: 0,
        testTypes: ['unit'],
        rationale: ''
      })
    }

    return functions
  }

  private parseTestsFromText(text: string, agentType: string): GeneratedTest[] {
    const tests: GeneratedTest[] = []

    // Look for code blocks
    const codeBlockRegex = /```(?:typescript|javascript|python|c)?\n([\s\S]*?)\n```/g
    let match
    let index = 0

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const testCode = match[1]
      const testType = agentType.includes('unit') ? 'unit' : 'integration'

      tests.push({
        testName: `generated_test_${index++}`,
        testFile: `test/generated_${testType}.test.ts`,
        testCode,
        testType: testType as any,
        coverage: { functions: [] }
      })
    }

    return tests
  }

  private parseReviewFromText(text: string): ReviewResult | null {
    try {
      // Look for approval status
      const approved = /✅|APPROVED|PASS/i.test(text) && !/❌|REJECTED|FAIL/i.test(text)

      // Extract issues
      const issues: any[] = []
      const issueRegex = /(?:🔴|🟡|⚠️)\s*([^\n]+)/g
      let match

      while ((match = issueRegex.exec(text)) !== null) {
        issues.push({
          severity: 'minor' as const,
          category: 'general',
          description: match[1].trim(),
          suggestion: ''
        })
      }

      return {
        approved,
        score: approved ? 85 : 60,
        issues,
        suggestions: []
      }
    } catch (error) {
      console.warn('[ResultAggregator] Failed to parse review:', error)
      return null
    }
  }
}
