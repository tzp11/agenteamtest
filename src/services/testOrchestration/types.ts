/**
 * Types for Test Orchestration System
 */

export interface TestGenerationRequest {
  description: string
  targetFiles?: string[]
  testTypes?: ('unit' | 'integration' | 'e2e')[]
  priority?: 'high' | 'medium' | 'low'
}

export interface TestStrategy {
  targetModule: string
  priorities: {
    level: number
    functions: Array<{
      name: string
      filePath: string
      lineNumber?: number
      complexity: number
      testTypes: string[]
      rationale: string
    }>
  }[]
  estimatedTime: number
  recommendations: string[]
}

export interface GeneratedTest {
  testName: string
  testFile: string
  testCode: string
  testType: 'unit' | 'integration' | 'e2e'
  coverage: {
    functions: string[]
    lines?: number[]
  }
}

export interface ReviewResult {
  approved: boolean
  score: number
  issues: Array<{
    severity: 'critical' | 'major' | 'minor'
    category: string
    description: string
    suggestion: string
    location?: {
      file: string
      line?: number
    }
  }>
  suggestions: string[]
}

export interface OrchestrationResult {
  success: boolean
  strategy?: TestStrategy
  tests: GeneratedTest[]
  review?: ReviewResult
  executionResults?: {
    passed: number
    failed: number
    skipped: number
    details: Array<{
      testName: string
      status: 'pass' | 'fail' | 'skip'
      error?: string
    }>
  }
  totalTime: number
  error?: string
  executionPlan?: string  // Added: execution plan with agent prompts
}

export interface AgentTask {
  agentType: 'test-architect' | 'unit-test-engineer' | 'integration-test-engineer' | 'test-reviewer' | 'test-diagnostician'
  prompt: string
  dependencies?: string[]
  timeout?: number
}

export interface AgentResult {
  agentType: string
  success: boolean
  output: any
  error?: string
  executionTime: number
}
