import { z } from 'zod/v4'
import { buildTool, findToolByName } from '../../Tool.js'

const inputSchema = z.strictObject({
  operation: z
    .enum(['generate', 'help'])
    .describe('Operation: generate tests or show help'),

  description: z
    .string()
    .optional()
    .describe('Description of what tests to generate (required for generate)'),

  targetFiles: z
    .array(z.string())
    .optional()
    .describe('Target files to generate tests for'),

  testTypes: z
    .array(z.enum(['unit', 'integration', 'e2e']))
    .optional()
    .describe('Types of tests to generate (default: ["unit", "integration"])'),

  priority: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe('Priority level (default: medium)')
})

export const TestOrchestratorTool = buildTool({
  name: 'TestOrchestratorTool',

  maxResultSizeChars: 50_000,

  async description() {
    return `Multi-Agent Test Generation System - Coordinates specialized test agents to generate high-quality tests.

**Workflow:**
1. Test Architect analyzes code and creates strategy
2. Unit + Integration Engineers generate tests in parallel
3. Test Reviewer reviews all generated tests

**Operations:**
- generate: Generate tests using multi-agent coordination
- help: Show usage examples`
  },

  async prompt() {
    return `Use TestOrchestratorTool to coordinate multiple test agents for generating comprehensive test suites.

The orchestrator will automatically:
1. Call test-architect to analyze code and create strategy
2. Call unit-test-engineer and integration-test-engineer in parallel
3. Call test-reviewer to review generated tests
4. Return aggregated results

This is the recommended way to generate tests when you need comprehensive coverage.`
  },

  get inputSchema() {
    return inputSchema
  },

  renderToolUseMessage() {
    return null
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: JSON.stringify(content)
    }
  },

  async checkPermissions(input) {
    if (input.operation === 'generate') {
      return {
        behavior: 'ask',
        message: `Generate tests using multi-agent orchestration for: ${input.description}?\n\nThis will execute:\n- test-architect (strategy)\n- unit-test-engineer (unit tests)\n- integration-test-engineer (integration tests)\n- test-reviewer (review)`,
        updatedInput: input
      }
    }
    return { behavior: 'allow', updatedInput: input }
  },

  call: async (args: z.infer<typeof inputSchema>, context, canUseTool, parentMessage) => {
    console.log('[TestOrchestratorTool] Called with args:', JSON.stringify(args))

    try {
      switch (args.operation) {
        case 'help':
          return {
            data: {
              usage: 'TestOrchestratorTool coordinates multiple agents to generate tests',
              workflow: [
                '1. test-architect analyzes code and creates strategy',
                '2. unit-test-engineer and integration-test-engineer generate tests in parallel',
                '3. test-reviewer reviews all generated tests'
              ],
              example: {
                operation: 'generate',
                description: 'Generate tests for login functionality',
                targetFiles: ['src/auth/login.ts'],
                testTypes: ['unit', 'integration'],
                priority: 'high'
              }
            }
          }

        case 'generate': {
          if (!args.description) {
            return {
              data: null,
              error: 'description is required for generate operation'
            }
          }

          // Find Agent tool
          const agentTool = findToolByName(context.options.tools, 'Agent')
          if (!agentTool) {
            return {
              data: null,
              error: 'Agent tool not found. Cannot orchestrate agents.'
            }
          }

          const targetFilesStr = args.targetFiles?.join(', ') || 'all relevant files'
          const testTypes = args.testTypes || ['unit', 'integration']
          const results: any = {
            phases: [],
            startTime: Date.now()
          }

          console.log('[TestOrchestratorTool] Starting orchestration...')

          // Phase 1: Test Architect
          console.log('[TestOrchestratorTool] Phase 1: Calling test-architect...')
          try {
            const architectPrompt = `分析以下代码并制定测试策略：

**目标**: ${args.description}
**文件**: ${targetFilesStr}
**测试类型**: ${testTypes.join(' + ')}
**优先级**: ${args.priority || 'medium'}

**任务**：
1. 使用 TestGraphTool 分析代码关系和调用图
2. 使用 TestCoverageTool 识别覆盖盲区
3. 分析代码复杂度和风险点
4. 输出结构化的测试计划，包括：
   - 优先级排序（高/中/低）
   - 每个函数的测试建议
   - 推荐的测试类型（unit/integration）

**重要**：直接分析代码，不要调用其他工具或 Agent。`

            const architectResult = await agentTool.call(
              {
                description: 'Analyze code and create test strategy',
                prompt: architectPrompt
              },
              context,
              canUseTool,
              parentMessage
            )

            results.phases.push({
              phase: 1,
              name: 'Strategy Planning',
              agent: 'test-architect',
              success: true,
              output: architectResult.data
            })

            console.log('[TestOrchestratorTool] Phase 1 completed')
          } catch (error: any) {
            results.phases.push({
              phase: 1,
              name: 'Strategy Planning',
              agent: 'test-architect',
              success: false,
              error: error.message || String(error)
            })
            console.error('[TestOrchestratorTool] Phase 1 failed:', error)
          }

          // Phase 2: Test Generation (parallel)
          console.log('[TestOrchestratorTool] Phase 2: Calling test engineers in parallel...')
          const engineerPromises: Promise<any>[] = []

          if (testTypes.includes('unit')) {
            const unitPrompt = `为以下功能生成单元测试代码：

**目标**: ${args.description}
**文件**: ${targetFilesStr}

**任务**：
1. 使用 Read 工具读取目标文件的源代码
2. 分析每个函数的逻辑和分支
3. 生成完整的单元测试代码
4. 使用 Write 工具将测试代码写入文件：/home/tzp/work/agent/my_test/test/tests/test_auth.c

**测试要求**：
- 覆盖所有代码分支（if/else、switch、循环）
- 测试边界条件（NULL、空字符串、0、最大值）
- 使用 Mock 隔离外部依赖
- 遵循 AAA 模式（Arrange-Act-Assert）
- **使用标准 C 的 assert.h，不要使用 Unity 框架**

**代码模板**：
\`\`\`c
#include <stdio.h>
#include <assert.h>
#include <string.h>

// 声明被测试的函数（使用 extern）
extern int validate_password(const char* password);
extern int user_exists(const char* username);
extern int authenticate_user(const char* username, const char* password);
extern char* generate_token(const char* username);
extern char* login(const char* username, const char* password);

void test_function_name() {
    // Arrange
    // Act
    int result = function_to_test();
    // Assert
    assert(result == expected_value);
    printf("✓ test_function_name passed\\n");
}

int main() {
    printf("Running tests...\\n\\n");
    test_function_name();
    // ... 其他测试
    printf("\\nAll tests passed!\\n");
    return 0;
}
\`\`\`

**重要**：
- 必须使用 Write 工具创建实际的测试文件
- 文件路径：/home/tzp/work/agent/my_test/test/tests/test_auth.c
- 不要只返回代码，要实际写入文件
- 使用 assert.h，不要使用 Unity 框架
- **只声明函数（extern），不要重新定义函数**
- **不要创建 Mock 函数，直接使用源文件中的函数**`

            engineerPromises.push(
              agentTool.call(
                {
                  description: 'Generate unit tests',
                  prompt: unitPrompt
                },
                context,
                canUseTool,
                parentMessage
              ).then(result => ({
                phase: 2,
                name: 'Unit Test Generation',
                agent: 'unit-test-engineer',
                success: true,
                output: result.data
              })).catch((error: any) => ({
                phase: 2,
                name: 'Unit Test Generation',
                agent: 'unit-test-engineer',
                success: false,
                error: error.message
              }))
            )
          }

          if (testTypes.includes('integration')) {
            const integrationPrompt = `为以下功能生成集成测试代码：

**目标**: ${args.description}
**文件**: ${targetFilesStr}

**任务**：
1. 使用 Read 工具读取目标文件的源代码
2. 分析模块间的交互
3. 生成完整的集成测试代码
4. 使用 Write 工具将测试代码写入文件：/home/tzp/work/agent/my_test/test/tests/integration_test_auth.c

**测试要求**：
- 测试模块间交互
- 测试数据流和状态传递
- 测试错误传播
- 使用真实依赖或测试替身
- 测试事务一致性

**重要**：
- 必须使用 Write 工具创建实际的测试文件
- 文件路径：/home/tzp/work/agent/my_test/test/tests/integration_test_auth.c
- 不要只返回代码，要实际写入文件`

            engineerPromises.push(
              agentTool.call(
                {
                  description: 'Generate integration tests',
                  prompt: integrationPrompt
                },
                context,
                canUseTool,
                parentMessage
              ).then(result => ({
                phase: 2,
                name: 'Integration Test Generation',
                agent: 'integration-test-engineer',
                success: true,
                output: result.data
              })).catch((error: any) => ({
                phase: 2,
                name: 'Integration Test Generation',
                agent: 'integration-test-engineer',
                success: false,
                error: error.message
              }))
            )
          }

          const engineerResults = await Promise.all(engineerPromises)
          results.phases.push(...engineerResults)
          console.log('[TestOrchestratorTool] Phase 2 completed')

          // Collect generated test files (agents should have written them)
          const generatedFiles = [
            '/home/tzp/work/agent/my_test/test/tests/test_auth.c',
            '/home/tzp/work/agent/my_test/test/tests/integration_test_auth.c'
          ].filter((_, i) => i < engineerResults.length && engineerResults[i].success)

          console.log('[TestOrchestratorTool] Expected test files:', generatedFiles)

          // Phase 3: Review Loop with iteration
          const maxReviewIterations = 3
          const scoreThreshold = 80
          let reviewIteration = 0
          let reviewApproved = false

          while (reviewIteration < maxReviewIterations && !reviewApproved) {
            reviewIteration++
            console.log(`[TestOrchestratorTool] Phase 3: Review iteration ${reviewIteration}/${maxReviewIterations}...`)

            try {
              const reviewPrompt = `审查刚才生成的测试代码质量：

**任务**：
1. 读取测试文件：/home/tzp/work/agent/my_test/test/tests/test_auth.c
2. 检查以下方面：
   - 测试正确性：断言是否正确
   - 测试完整性：是否覆盖所有场景
   - 测试清晰度：是否易于理解
   - 测试可维护性：是否易于修改
   - 测试性能：是否有慢测试
   - 测试隔离性：是否相互独立
3. 识别测试坏味道（Test Smells）

**输出格式（必须严格遵守）**：
\`\`\`
评分：XX/100

问题列表：
- [严重程度] 问题描述

改进建议：
- 建议1
- 建议2
\`\`\`

**重要**：
- 必须在输出开头明确写出"评分：XX/100"
- 评分范围 0-100
- 直接读取文件并审查，不要调用其他工具`

              console.log(`[TestOrchestratorTool] Calling test-reviewer agent...`)

              const reviewResult = await agentTool.call(
                {
                  description: 'Review generated tests',
                  prompt: reviewPrompt
                },
                context,
                canUseTool,
                parentMessage
              )

              console.log(`[TestOrchestratorTool] test-reviewer agent returned`)
              console.log(`[TestOrchestratorTool] reviewResult type: ${typeof reviewResult}`)
              console.log(`[TestOrchestratorTool] reviewResult.data type: ${typeof reviewResult.data}`)

              // Try to extract score from review output
              // reviewResult.data might be an object or string
              let reviewOutput = ''
              if (typeof reviewResult.data === 'string') {
                reviewOutput = reviewResult.data
              } else if (reviewResult.data && typeof reviewResult.data === 'object') {
                // Try to extract text from object
                const dataObj = reviewResult.data as any

                // Try common field names
                if (dataObj.text && typeof dataObj.text === 'string') {
                  reviewOutput = dataObj.text
                } else if (dataObj.content && typeof dataObj.content === 'string') {
                  reviewOutput = dataObj.content
                } else if (dataObj.output && typeof dataObj.output === 'string') {
                  reviewOutput = dataObj.output
                } else if (dataObj.message && typeof dataObj.message === 'string') {
                  reviewOutput = dataObj.message
                } else {
                  // Fallback: stringify the entire object
                  reviewOutput = JSON.stringify(reviewResult.data, null, 2)
                }
              } else {
                reviewOutput = String(reviewResult.data || '')
              }

              // Ensure reviewOutput is a string
              if (typeof reviewOutput !== 'string') {
                console.warn(`[TestOrchestratorTool] reviewOutput is not a string, converting...`)
                reviewOutput = JSON.stringify(reviewOutput)
              }

              // Debug: log first 500 chars of review output
              console.log(`[TestOrchestratorTool] Review output preview: ${reviewOutput.substring(0, 500)}`)

              // Try multiple patterns to extract score
              let score = 0
              const patterns = [
                /(?:score|评分)[:：]\s*(\d+)/i,           // score: 85 or 评分：85
                /(\d+)\s*\/\s*100/,                        // 85/100 or 85 / 100
                /(\d+)\s*分/,                              // 85分
                /quality.*?(\d+)/i,                        // quality: 85
                /rating.*?(\d+)/i                          // rating: 85
              ]

              for (const pattern of patterns) {
                const match = reviewOutput.match(pattern)
                if (match) {
                  score = parseInt(match[1])
                  console.log(`[TestOrchestratorTool] Score extracted using pattern: ${pattern}, value: ${score}`)
                  break
                }
              }

              if (score === 0) {
                console.warn(`[TestOrchestratorTool] Failed to extract score from review output, defaulting to 0`)
                console.warn(`[TestOrchestratorTool] Review data type: ${typeof reviewResult.data}`)
                console.warn(`[TestOrchestratorTool] Review data keys: ${reviewResult.data ? Object.keys(reviewResult.data as any).join(', ') : 'none'}`)
              }

              console.log(`[TestOrchestratorTool] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
              console.log(`[TestOrchestratorTool] Review Iteration ${reviewIteration}/${maxReviewIterations}`)
              console.log(`[TestOrchestratorTool] Score: ${score}/100 (threshold: ${scoreThreshold})`)
              console.log(`[TestOrchestratorTool] Status: ${score >= scoreThreshold ? '✅ PASSED' : '❌ NEEDS IMPROVEMENT'}`)
              console.log(`[TestOrchestratorTool] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

              results.phases.push({
                phase: 3,
                name: `Quality Review (Iteration ${reviewIteration})`,
                agent: 'test-reviewer',
                success: true,
                output: reviewResult.data,
                score
              })

              // Check if review passed
              if (score >= scoreThreshold) {
                reviewApproved = true
                console.log(`[TestOrchestratorTool] ✅ Review APPROVED with score ${score} >= ${scoreThreshold}`)
              } else if (reviewIteration < maxReviewIterations) {
                // Need to regenerate tests based on feedback
                console.log(`[TestOrchestratorTool] ⚠️  Review FAILED (score ${score} < ${scoreThreshold})`)
                console.log(`[TestOrchestratorTool] 🔄 Regenerating tests with feedback...`)

                // Extract feedback from review
                const feedback = reviewOutput

                // Regenerate tests with feedback
                const regeneratePrompt = `根据审查反馈重新生成测试代码：

**原始任务**: ${args.description}
**文件**: ${targetFilesStr}

**审查反馈**：
${feedback}

**改进要求**：
1. 修复审查中发现的所有问题
2. 补充缺失的测试场景
3. 改进测试代码质量
4. 使用 Write 工具覆盖原测试文件：/home/tzp/work/agent/my_test/test/tests/test_auth.c

**重要**：
- 必须使用 Write 工具覆盖原文件
- 使用标准 C 的 assert.h
- 不要只返回代码，要实际写入文件
- **只声明函数（extern），不要重新定义函数**
- **不要创建 Mock 函数，直接使用源文件中的函数**`

                const regenerateResult = await agentTool.call(
                  {
                    description: 'Regenerate tests based on feedback',
                    prompt: regeneratePrompt
                  },
                  context,
                  canUseTool,
                  parentMessage
                )

                results.phases.push({
                  phase: 2,
                  name: `Test Regeneration (Iteration ${reviewIteration})`,
                  agent: 'unit-test-engineer',
                  success: true,
                  output: regenerateResult.data
                })

                console.log(`[TestOrchestratorTool] ✅ Tests regenerated, starting iteration ${reviewIteration + 1}...`)
              } else {
                console.log(`[TestOrchestratorTool] ⚠️  Max iterations (${maxReviewIterations}) reached`)
                console.log(`[TestOrchestratorTool] Proceeding with current tests (score: ${score})`)
              }

            } catch (error: any) {
              results.phases.push({
                phase: 3,
                name: `Quality Review (Iteration ${reviewIteration})`,
                agent: 'test-reviewer',
                success: false,
                error: error.message || String(error)
              })
              console.error(`[TestOrchestratorTool] Review iteration ${reviewIteration} failed:`, error)
              break
            }
          }

          console.log(`[TestOrchestratorTool] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          console.log(`[TestOrchestratorTool] Review Loop Summary`)
          console.log(`[TestOrchestratorTool] Total iterations: ${reviewIteration}`)
          console.log(`[TestOrchestratorTool] Final status: ${reviewApproved ? '✅ APPROVED' : '⚠️  NOT APPROVED'}`)
          console.log(`[TestOrchestratorTool] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

          // Phase 4: Compile and Run Tests (if files were generated)
          if (generatedFiles.length > 0) {
            console.log('[TestOrchestratorTool] Phase 4: Compiling and running tests...')
            try {
              // Find Bash tool to compile and run tests
              const bashTool = findToolByName(context.options.tools, 'Bash')
              if (bashTool) {
                // Compile tests
                const testFiles = generatedFiles.map(f => f.replace('/home/tzp/work/agent/my_test/test/', '')).join(' ')
                const compileCommand = `cd /home/tzp/work/agent/my_test/test && gcc -o test_runner ${testFiles} src/auth.c -I. -Isrc 2>&1`

                console.log(`[TestOrchestratorTool] Compile command: ${compileCommand}`)

                const compileResult = await bashTool.call(
                  {
                    command: compileCommand,
                    description: 'Compile generated tests'
                  },
                  context,
                  canUseTool,
                  parentMessage
                )

                const compileOutput = String(compileResult.data)
                console.log(`[TestOrchestratorTool] Compile output: ${compileOutput}`)

                // Check if compilation succeeded
                if (!compileOutput.includes('error:')) {
                  // Run tests
                  const runCommand = 'cd /home/tzp/work/agent/my_test/test && ./test_runner'
                  console.log(`[TestOrchestratorTool] Run command: ${runCommand}`)

                  const runResult = await bashTool.call(
                    {
                      command: runCommand,
                      description: 'Run compiled tests'
                    },
                    context,
                    canUseTool,
                    parentMessage
                  )

                  results.phases.push({
                    phase: 4,
                    name: 'Compile and Run Tests',
                    agent: 'bash',
                    success: true,
                    output: {
                      compile: compileOutput,
                      run: runResult.data
                    }
                  })
                } else {
                  results.phases.push({
                    phase: 4,
                    name: 'Compile and Run Tests',
                    agent: 'bash',
                    success: false,
                    error: `Compilation failed: ${compileOutput}`
                  })
                }

                console.log('[TestOrchestratorTool] Phase 4 completed')
              } else {
                console.warn('[TestOrchestratorTool] Bash tool not found, skipping compilation')
              }
            } catch (error: any) {
              results.phases.push({
                phase: 4,
                name: 'Compile and Run Tests',
                agent: 'bash',
                success: false,
                error: error.message || String(error)
              })
              console.error('[TestOrchestratorTool] Phase 4 failed:', error)
            }
          } else {
            console.warn('[TestOrchestratorTool] No test files generated, skipping Phase 4')
          }

          results.totalTime = Date.now() - results.startTime
          results.success = results.phases.every((p: any) => p.success)

          console.log('[TestOrchestratorTool] Orchestration completed')
          console.log(`[TestOrchestratorTool] Total time: ${results.totalTime}ms`)
          console.log(`[TestOrchestratorTool] Success: ${results.success}`)

          return {
            data: {
              message: 'Multi-agent test generation completed',
              ...results,
              summary: {
                totalPhases: results.phases.length,
                successfulPhases: results.phases.filter((p: any) => p.success).length,
                totalTime: `${results.totalTime}ms`
              }
            }
          }
        }

        default:
          return {
            data: null,
            error: `Unknown operation: ${args.operation}`
          }
      }
    } catch (error: any) {
      console.error('[TestOrchestratorTool] Error:', error)
      return {
        data: null,
        error: error.message || String(error)
      }
    }
  }
})
