/**
 * Test Orchestrator - Coordinates multiple test agents to generate high-quality tests
 *
 * Workflow:
 * 1. Test Architect analyzes code and creates strategy
 * 2. Unit + Integration Engineers generate tests in parallel
 * 3. Test Reviewer reviews all generated tests
 * 4. If review fails, iterate with feedback
 * 5. Return final results
 */

import type {
  TestGenerationRequest,
  OrchestrationResult,
  AgentTask,
  AgentResult
} from './types.js'
import { AgentRunner } from './agentRunner.js'
import { ResultAggregator } from './resultAggregator.js'

export class TestOrchestrator {
  private agentRunner: AgentRunner
  private aggregator: ResultAggregator
  private maxReviewIterations: number = 2

  constructor() {
    this.agentRunner = new AgentRunner()
    this.aggregator = new ResultAggregator()
  }

  /**
   * Main entry point - generate tests for given request
   * Returns instructions for manual agent execution
   */
  async generateTests(request: TestGenerationRequest): Promise<OrchestrationResult> {
    const startTime = Date.now()

    console.log('[TestOrchestrator] Starting test generation')
    console.log('[TestOrchestrator] Request:', JSON.stringify(request, null, 2))

    // Generate execution plan
    const plan = this.generateExecutionPlan(request)

    return {
      success: true,
      tests: [],
      totalTime: Date.now() - startTime,
      error: undefined,
      executionPlan: plan
    }
  }

  /**
   * Generate execution plan with agent prompts
   */
  private generateExecutionPlan(request: TestGenerationRequest): string {
    const targetFilesStr = request.targetFiles?.join(', ') || 'all relevant files'
    const testTypesStr = request.testTypes?.join(' + ') || 'unit and integration'

    const lines: string[] = []

    lines.push('# Test Generation Execution Plan')
    lines.push('')
    lines.push(`**Target**: ${request.description}`)
    lines.push(`**Files**: ${targetFilesStr}`)
    lines.push(`**Test Types**: ${testTypesStr}`)
    lines.push(`**Priority**: ${request.priority || 'medium'}`)
    lines.push('')
    lines.push('## Phase 1: Strategy Planning (Test Architect)')
    lines.push('')
    lines.push('Execute the following prompt:')
    lines.push('```')
    lines.push(`使用 test-architect Agent 分析以下代码并制定测试策略：`)
    lines.push('')
    lines.push(`**目标**: ${request.description}`)
    lines.push(`**文件**: ${targetFilesStr}`)
    lines.push(`**测试类型**: ${testTypesStr}`)
    lines.push(`**优先级**: ${request.priority || 'medium'}`)
    lines.push('')
    lines.push('请使用 TestGraphTool 分析代码关系，使用 TestCoverageTool 识别覆盖盲区。')
    lines.push('输出结构化的测试计划，包括优先级排序和具体的测试建议。')
    lines.push('```')
    lines.push('')

    if (request.testTypes?.includes('unit')) {
      lines.push('## Phase 2a: Unit Test Generation')
      lines.push('')
      lines.push('Execute the following prompt:')
      lines.push('```')
      lines.push(`使用 unit-test-engineer Agent 为以下功能生成单元测试：`)
      lines.push('')
      lines.push(`**目标**: ${request.description}`)
      lines.push(`**文件**: ${targetFilesStr}`)
      lines.push('')
      lines.push('要求：')
      lines.push('- 覆盖所有代码分支')
      lines.push('- 测试边界条件')
      lines.push('- 使用 Mock 隔离依赖')
      lines.push('- 遵循 AAA 模式')
      lines.push('```')
      lines.push('')
    }

    if (request.testTypes?.includes('integration')) {
      lines.push('## Phase 2b: Integration Test Generation')
      lines.push('')
      lines.push('Execute the following prompt:')
      lines.push('```')
      lines.push(`使用 integration-test-engineer Agent 为以下功能生成集成测试：`)
      lines.push('')
      lines.push(`**目标**: ${request.description}`)
      lines.push(`**文件**: ${targetFilesStr}`)
      lines.push('')
      lines.push('要求：')
      lines.push('- 测试模块间交互')
      lines.push('- 测试数据流')
      lines.push('- 测试错误传播')
      lines.push('- 使用真实依赖（或测试替身）')
      lines.push('```')
      lines.push('')
    }

    lines.push('## Phase 3: Quality Review')
    lines.push('')
    lines.push('After generating tests, execute:')
    lines.push('```')
    lines.push(`使用 test-reviewer Agent 审查生成的测试代码`)
    lines.push('```')
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('**Note**: Execute each phase sequentially. Phase 2a and 2b can be run in parallel.')

    return lines.join('\n')
  }

  /**
   * Phase 1: Run Test Architect to create strategy
   */
  private async runArchitectPhase(request: TestGenerationRequest): Promise<AgentResult> {
    console.log('[TestOrchestrator] Phase 1: Strategy Planning')

    const targetFilesStr = request.targetFiles?.join(', ') || 'all relevant files'
    const testTypesStr = request.testTypes?.join(' + ') || 'unit and integration'

    const prompt = `
分析以下代码并制定测试策略：

**目标**: ${request.description}
**文件**: ${targetFilesStr}
**测试类型**: ${testTypesStr}
**优先级**: ${request.priority || 'medium'}

请使用 TestGraphTool 分析代码关系，使用 TestCoverageTool 识别覆盖盲区。
输出结构化的测试计划，包括优先级排序和具体的测试建议。
`.trim()

    const task: AgentTask = {
      agentType: 'test-architect',
      prompt,
      timeout: 60000
    }

    return await this.agentRunner.runAgent(task)
  }

  /**
   * Phase 2: Run test engineers in parallel
   */
  private async runEngineerPhase(
    request: TestGenerationRequest,
    strategy: any
  ): Promise<AgentResult[]> {
    console.log('[TestOrchestrator] Phase 2: Test Generation')

    const tasks: AgentTask[] = []
    const testTypes = request.testTypes || ['unit', 'integration']

    // Prepare context from strategy
    const strategyContext = strategy
      ? `\n\n参考测试策略：\n${JSON.stringify(strategy, null, 2)}`
      : ''

    // Unit test engineer
    if (testTypes.includes('unit')) {
      tasks.push({
        agentType: 'unit-test-engineer',
        prompt: `
为以下功能生成单元测试：

**目标**: ${request.description}
**文件**: ${request.targetFiles?.join(', ') || '相关文件'}
${strategyContext}

要求：
- 覆盖所有代码分支
- 测试边界条件
- 使用 Mock 隔离依赖
- 遵循 AAA 模式
`.trim(),
        timeout: 90000
      })
    }

    // Integration test engineer
    if (testTypes.includes('integration')) {
      tasks.push({
        agentType: 'integration-test-engineer',
        prompt: `
为以下功能生成集成测试：

**目标**: ${request.description}
**文件**: ${request.targetFiles?.join(', ') || '相关文件'}
${strategyContext}

要求：
- 测试模块间交互
- 测试数据流
- 测试错误传播
- 使用真实依赖（或测试替身）
`.trim(),
        timeout: 90000
      })
    }

    // Run engineers in parallel
    return await this.agentRunner.runParallel(tasks)
  }

  /**
   * Phase 3: Run test reviewer with iteration support
   */
  private async runReviewPhase(tests: any[]): Promise<AgentResult | null> {
    console.log('[TestOrchestrator] Phase 3: Test Review')

    if (tests.length === 0) {
      console.log('[TestOrchestrator] No tests to review')
      return null
    }

    // Prepare test summary for review
    const testSummary = tests.map((t, i) => `
Test ${i + 1}: ${t.testName}
File: ${t.testFile}
Type: ${t.testType}
Code Preview:
\`\`\`
${t.testCode.substring(0, 500)}...
\`\`\`
`).join('\n---\n')

    const prompt = `
审查以下生成的测试代码：

${testSummary}

请检查：
1. 测试正确性（断言是否正确）
2. 测试完整性（是否覆盖所有场景）
3. 测试清晰度（是否易于理解）
4. 测试可维护性（是否易于修改）
5. 测试性能（是否有慢测试）
6. 测试隔离性（是否相互独立）

输出审查结果，包括：
- 是否批准（approved: true/false）
- 评分（score: 0-100）
- 发现的问题（issues）
- 改进建议（suggestions）
`.trim()

    const task: AgentTask = {
      agentType: 'test-reviewer',
      prompt,
      timeout: 60000
    }

    return await this.agentRunner.runAgent(task)
  }

  /**
   * Helper: Format results for display
   */
  formatResults(result: OrchestrationResult): string {
    const lines: string[] = []

    lines.push('━'.repeat(60))
    lines.push('Test Generation Execution Plan')
    lines.push('━'.repeat(60))
    lines.push('')

    if (result.executionPlan) {
      lines.push(result.executionPlan)
    } else {
      // Legacy format for actual results
      lines.push(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
      lines.push(`Total Time: ${result.totalTime}ms`)
      lines.push('')

      if (result.strategy) {
        lines.push('## Test Strategy')
        lines.push(`Target: ${result.strategy.targetModule}`)
        lines.push(`Priorities: ${result.strategy.priorities.length} levels`)
        lines.push('')
      }

      lines.push(`## Generated Tests (${result.tests.length})`)
      result.tests.forEach((test, i) => {
        lines.push(`${i + 1}. ${test.testName} (${test.testType})`)
        lines.push(`   File: ${test.testFile}`)
        lines.push(`   Coverage: ${test.coverage.functions.length} functions`)
      })
      lines.push('')

      if (result.review) {
        lines.push('## Review Results')
        lines.push(`Approved: ${result.review.approved ? '✅' : '❌'}`)
        lines.push(`Score: ${result.review.score}/100`)
        if (result.review.issues.length > 0) {
          lines.push(`Issues: ${result.review.issues.length}`)
          result.review.issues.slice(0, 3).forEach(issue => {
            lines.push(`  - [${issue.severity}] ${issue.description}`)
          })
        }
        lines.push('')
      }

      if (result.error) {
        lines.push('## Error')
        lines.push(result.error)
        lines.push('')
      }
    }

    lines.push('━'.repeat(60))

    return lines.join('\n')
  }
}
