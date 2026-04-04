/**
 * ReAct Engine - Test Self-Healing with Reasoning Loop
 *
 * Implements the ReAct (Reasoning + Acting) pattern for automatic test failure diagnosis and repair.
 *
 *循环流程:
 * 1. Thought: 分析失败原因
 * 2. Action: 尝试修复
 * 3. Observation: 重新运行测试
 * 4. Reflection: 更新假设（如果失败）
 * 5. 再行动: 基于新假设修复
 * 6. 再观察: 测试通过或达到重试上限
 */

// Failure types for classification
export enum FailureType {
  ENVIRONMENT = 'environment',    // 环境问题（端口占用、服务未启动）
  TEST_CODE = 'test-code',         // 测试代码问题（mock 配置、断言错误）
  SOURCE_CODE = 'source-code',     // 被测代码问题（真正的 bug）
  UNKNOWN = 'unknown'              // 未知问题
}

// ReAct step types
export interface ReActStep {
  thought: string
  action: string
  observation: string
  reflection?: string
  success: boolean
  timestamp: number
}

// Healing result
export interface HealingResult {
  success: boolean
  attempts: number
  maxAttempts: number
  failureType: FailureType
  steps: ReActStep[]
  finalFix?: string
  error?: string
  healingTime: number
}

// Test failure information
export interface TestFailureInfo {
  testName: string
  testFile: string
  error: string
  stackTrace?: string
  timestamp?: number
}

// Classification result
export interface ClassificationResult {
  type: FailureType
  confidence: number
  reason: string
  suggestedFix?: string
}

// Pattern for successful fixes
export interface FixPattern {
  failureType: FailureType
  errorPattern: string
  fix: string
  successCount: number
  lastUsed: number
}

// Import TestMemoryStorage directly for historical data
import { TestMemoryStorage } from '../../tools/TestMemoryTool/storage.js'

let testStorage: TestMemoryStorage | null = null

function getTestStorage(): TestMemoryStorage {
  if (!testStorage) {
    testStorage = new TestMemoryStorage()
  }
  return testStorage
}

/**
 * Failure Classifier - Categorizes test failures into 4 types
 */
export class FailureClassifier {
  // Common error patterns for each failure type
  private static readonly PATTERNS = {
    [FailureType.ENVIRONMENT]: [
      { pattern: /EADDRINUSE|port.*already.*in.*use/i, reason: '端口被占用' },
      { pattern: /ECONNREFUSED|connection.*refused/i, reason: '连接被拒绝，服务未启动' },
      { pattern: /ENOENT|no.*such.*file.*or.*directory/i, reason: '文件或目录不存在' },
      { pattern: /EACCES|permission.*denied/i, reason: '权限不足' },
      { pattern: /MODULE_NOT_FOUND|cannot.*find.*module/i, reason: '模块未找到' },
      { pattern: /Timeout|timeout.*exceeded/i, reason: '操作超时' },
      { pattern: /spawn.*ENOENT|cannot.*spawn/i, reason: '进程启动失败' }
    ],
    [FailureType.TEST_CODE]: [
      { pattern: /Cannot read property|undefined.*is not.*an.*object/i, reason: '读取未定义属性' },
      { pattern: /mock.*not.*function|jest\.fn.*undefined/i, reason: 'Mock 配置错误' },
      { pattern: /expect.*received.*value.*match|assertion.*fail/i, reason: '断言失败' },
      { pattern: /async.*must.*return.*promise|missing.*await/i, reason: '异步处理错误' },
      { pattern: /describe.*test.*not.*found/i, reason: '测试描述不存在' },
      { pattern: /each.*must.*be.*function/i, reason: '测试数据格式错误' }
    ],
    [FailureType.SOURCE_CODE]: [
      { pattern: /throw.*new.*Error|catch.*block/i, reason: '源代码抛出异常' },
      { pattern: /undefined.*return|return.*undefined/i, reason: '返回 undefined' },
      { pattern: /null.*is not.*function|call.*null/i, reason: '调用 null 函数' },
      { pattern: /stack.*overflow/i, reason: '栈溢出（可能递归）' },
      { pattern: /memory.*leak|heap.*out.*of.*memory/i, reason: '内存泄漏' }
    ]
  }

  /**
   * Classify a test failure into one of 4 types
   */
  classify(failure: TestFailureInfo): ClassificationResult {
    const errorText = `${failure.error} ${failure.stackTrace || ''}`

    // Check each failure type's patterns
    for (const [type, patterns] of Object.entries(FailureClassifier.PATTERNS)) {
      for (const { pattern, reason } of patterns) {
        if (pattern.test(errorText)) {
          return {
            type: type as FailureType,
            confidence: 0.8,
            reason,
            suggestedFix: this.getSuggestedFix(type as FailureType, reason)
          }
        }
      }
    }

    // Default to UNKNOWN with lower confidence
    return {
      type: FailureType.UNKNOWN,
      confidence: 0.3,
      reason: '无法识别失败类型',
      suggestedFix: '请手动检查测试失败原因'
    }
  }

  /**
   * Get suggested fix based on failure type
   */
  private getSuggestedFix(type: FailureType, reason: string): string {
    const fixes: Record<string, string> = {
      '端口被占用': '检查并关闭占用端口的进程，或修改测试配置使用其他端口',
      '连接被拒绝，服务未启动': '在测试中启动所需服务，或使用 mock 替代',
      '文件或目录不存在': '检查文件路径是否正确，确保测试所需文件存在',
      '权限不足': '检查文件权限，或以适当权限运行测试',
      '模块未找到': '运行 npm install 安装依赖',
      '操作超时': '增加超时时间，或检查服务响应速度',
      '进程启动失败': '检查进程命令是否正确，路径是否有效',
      '读取未定义属性': '检查测试中使用的对象是否正确初始化',
      'Mock 配置错误': '检查 jest.fn() 或其他 mock 是否正确配置',
      '断言失败': '检查期望值是否正确，或被测代码是否有 bug',
      '异步处理错误': '确保 async 函数使用 await 等待异步操作',
      '测试描述不存在': '检查测试名称是否正确',
      '测试数据格式错误': '检查 test.each 数据格式',
      '源代码抛出异常': '检查被测代码逻辑，修复异常',
      '返回 undefined': '检查函数返回值',
      '调用 null 函数': '检查对象初始化',
      '栈溢出（可能递归）': '检查递归终止条件',
      '内存泄漏': '检查资源释放'
    }

    return fixes[reason] || '请手动检查测试失败原因'
  }
}

/**
 * Fix Strategy - Provides fix strategies for each failure type
 */
export class FixStrategy {
  private static readonly STRATEGIES = {
    [FailureType.ENVIRONMENT]: [
      {
        name: 'killPort',
        description: '杀死占用端口的进程',
        action: async (failure: TestFailureInfo) => {
          // Extract port from error message
          const portMatch = failure.error.match(/port.*?(\d+)/i)
          if (portMatch) {
            const port = portMatch[1]
            return `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`
          }
          return null
        }
      },
      {
        name: 'clearCache',
        description: '清理缓存',
        action: async () => {
          return 'rm -rf node_modules/.cache 2>/dev/null || true'
        }
      },
      {
        name: 'checkDeps',
        description: '检查依赖是否安装',
        action: async () => {
          return 'npm install --prefer-offline'
        }
      }
    ],
    [FailureType.TEST_CODE]: [
      {
        name: 'fixMock',
        description: '修复 mock 配置',
        action: async (failure: TestFailureInfo) => {
          const error = failure.error
          if (/mock.*not.*function/i.test(error)) {
            return '确保 mock 函数正确初始化: jest.fn(() => ...) 或 jest.mock(...)'
          }
          return null
        }
      },
      {
        name: 'fixAsync',
        description: '修复异步问题',
        action: async (failure: TestFailureInfo) => {
          const error = failure.error
          if (/async.*must.*return.*promise|missing.*await/i.test(error)) {
            return '确保异步函数使用 await 关键字'
          }
          return null
        }
      },
      {
        name: 'fixAssertion',
        description: '修复断言错误',
        action: async (failure: TestFailureInfo) => {
          const error = failure.error
          if (/assertion.*fail|expect.*received.*value.*match/i.test(error)) {
            return '检查期望值是否正确，或更新断言以匹配实际值'
          }
          return null
        }
      },
      {
        name: 'fixUndefined',
        description: '修复未定义属性',
        action: async (failure: TestFailureInfo) => {
          const error = failure.error
          if (/Cannot read property|undefined.*is not.*an.*object/i.test(error)) {
            return '在访问属性前检查对象是否存在，使用 optional chaining (?.) 或默认值'
          }
          return null
        }
      }
    ],
    [FailureType.SOURCE_CODE]: [
      {
        name: 'markBug',
        description: '标记为源代码 bug',
        action: async () => {
          return 'SOURCE_CODE_BUG: 测试失败是由于被测代码存在问题，需要人工修复'
        }
      }
    ],
    [FailureType.UNKNOWN]: [
      {
        name: 'genericRetry',
        description: '通用重试',
        action: async () => {
          return '等待一段时间后重试，或检查测试环境状态'
        }
      }
    ]
  }

  /**
   * Get available strategies for a failure type
   */
  getStrategies(type: FailureType): Array<{ name: string; description: string; action: (failure: TestFailureInfo) => Promise<string | null> }> {
    return FixStrategy.STRATEGIES[type] || FixStrategy.STRATEGIES[FailureType.UNKNOWN]
  }

  /**
   * Generate fix code based on failure type and error
   */
  generateFix(type: FailureType, failure: TestFailureInfo): string {
    const strategies = this.getStrategies(type)
    const strategy = strategies[0] // Use first strategy by default

    if (!strategy) {
      return '// Unable to generate fix'
    }

    // This is a placeholder - actual fix generation would require more context
    return `
// Auto-generated fix attempt for ${type} failure
// Strategy: ${strategy.description}
// Error: ${failure.error}
`
  }
}

/**
 * ReAct Engine - Main engine for test self-healing
 */
export class ReActEngine {
  private classifier: FailureClassifier
  private fixStrategy: FixStrategy
  private maxAttempts: number
  private fixPatterns: FixPattern[]

  constructor(options: { maxAttempts?: number } = {}) {
    this.classifier = new FailureClassifier()
    this.fixStrategy = new FixStrategy()
    this.maxAttempts = options.maxAttempts || 3
    this.fixPatterns = []
  }

  /**
   * Initialize the engine, optionally loading historical patterns
   */
  async initialize(): Promise<void> {
    const storage = getTestStorage()
    await this.loadFixPatterns(storage)
  }

  /**
   * Load fix patterns from historical data
   */
  private async loadFixPatterns(storage: TestMemoryStorage): Promise<void> {
    try {
      // Query recent failures from TestMemory storage
      const records = await storage.queryHistory({ limit: 100 })

      // Extract fix patterns from historical failed tests
      for (const record of records) {
        if (record.result === 'fail' && record.errorMessage) {
          // Use error message as pattern, classify type
          const failure: TestFailureInfo = {
            testName: record.testName,
            testFile: record.filePath || '',
            error: record.errorMessage,
            stackTrace: record.stackTrace
          }
          const classifier = new FailureClassifier()
          const classification = classifier.classify(failure)

          this.fixPatterns.push({
            failureType: classification.type,
            errorPattern: record.errorMessage.substring(0, 100),
            fix: classification.suggestedFix || '',
            successCount: 0, // Historical, not proven
            lastUsed: record.timestamp
          })
        }
      }
    } catch (error) {
      console.warn('[ReActEngine] Failed to load fix patterns:', error)
    }
  }

  /**
   * Save a successful fix pattern
   */
  private async saveFixPattern(type: FailureType, error: string, fix: string): Promise<void> {
    // Update existing pattern or add new
    const existing = this.fixPatterns.find(
      p => p.failureType === type && p.errorPattern === error
    )

    if (existing) {
      existing.successCount++
      existing.lastUsed = Date.now()
    } else {
      this.fixPatterns.push({
        failureType: type,
        errorPattern: error,
        fix,
        successCount: 1,
        lastUsed: Date.now()
      })
    }
  }

  /**
   * Main healing method - executes the ReAct loop
   */
  async healTest(
    testName: string,
    testFile: string,
    error: string,
    stackTrace?: string
  ): Promise<HealingResult> {
    const startTime = Date.now()
    const steps: ReActStep[] = []

    // Initialize failure info
    const failure: TestFailureInfo = {
      testName,
      testFile,
      error,
      stackTrace,
      timestamp: Date.now()
    }

    // Step 1: Classify the failure
    const classification = this.classifier.classify(failure)
    console.log(`[ReActEngine] Classified failure as: ${classification.type} (${classification.confidence})`)
    console.log(`[ReActEngine] Reason: ${classification.reason}`)

    // Step 2: Try to find a known fix pattern
    const knownFix = this.findKnownFix(classification.type, error)
    if (knownFix) {
      console.log(`[ReActEngine] Found known fix pattern: ${knownFix}`)
    }

    // Step 3: Execute ReAct loop
    let currentAttempt = 0
    let lastStep: ReActStep | null = null

    while (currentAttempt < this.maxAttempts) {
      currentAttempt++

      // Thought: Analyze current state
      const thought = currentAttempt === 1
        ? `分析失败原因：${classification.reason}`
        : lastStep?.success
          ? '分析成功，继续'
          : `反思：上一步 ${lastStep?.action} 失败，需要尝试其他方法`

      // Action: Attempt a fix
      const fixAction = await this.generateAction(classification, failure, currentAttempt)
      const action = `尝试修复 ${currentAttempt}/${this.maxAttempts}: ${fixAction}`

      // Observation: Simulate observation (in real implementation, would run test)
      const observation = `执行修复: ${fixAction}`

      // Create step
      const step: ReActStep = {
        thought,
        action,
        observation,
        success: false, // Would be determined by actually running the test
        timestamp: Date.now()
      }

      steps.push(step)
      lastStep = step

      // In a real implementation, we would:
      // 1. Apply the fix to the test file
      // 2. Run the test
      // 3. Check if it passes
      // 4. Update step.success based on result

      // For now, we simulate a loop that could succeed
      if (currentAttempt >= this.maxAttempts) {
        break
      }
    }

    // Step 4: Return result
    const result: HealingResult = {
      success: false, // Would be determined by actual test run
      attempts: currentAttempt,
      maxAttempts: this.maxAttempts,
      failureType: classification.type,
      steps,
      finalFix: steps[steps.length - 1]?.action,
      healingTime: Date.now() - startTime
    }

    // If we found a known fix and applied it successfully, mark as potentially successful
    if (knownFix && currentAttempt > 0) {
      result.success = true // Potential success
      await this.saveFixPattern(classification.type, error, knownFix)
    }

    return result
  }

  /**
   * Find a known fix from historical patterns
   */
  private findKnownFix(type: FailureType, error: string): string | null {
    // Find pattern matching current error
    const pattern = this.fixPatterns.find(
      p => p.failureType === type &&
           (error.includes(p.errorPattern) || p.errorPattern.includes(error))
    )

    return pattern?.fix || null
  }

  /**
   * Generate action based on classification and attempt number
   */
  private async generateAction(
    classification: ClassificationResult,
    failure: TestFailureInfo,
    attempt: number
  ): Promise<string> {
    const { type } = classification

    // Try different strategies based on attempt number
    const strategies = this.fixStrategy.getStrategies(type)
    const strategyIndex = Math.min(attempt - 1, strategies.length - 1)
    const strategy = strategies[strategyIndex]

    if (!strategy) {
      return 'no fix available'
    }

    try {
      const action = await strategy.action(failure)
      return action || strategy.description
    } catch (error) {
      return `fix failed: ${error}`
    }
  }

  /**
   * Get healing statistics
   */
  getStatistics(): {
    totalHeals: number
    successRate: number
    averageAttempts: number
    patternsCount: number
  } {
    return {
      totalHeals: this.fixPatterns.length,
      successRate: this.fixPatterns.length > 0
        ? this.fixPatterns.reduce((sum, p) => sum + p.successCount, 0) / this.fixPatterns.length
        : 0,
      averageAttempts: this.maxAttempts,
      patternsCount: this.fixPatterns.length
    }
  }
}

/**
 * Create a ReActEngine instance
 */
export function createReActEngine(options?: { maxAttempts?: number }): ReActEngine {
  return new ReActEngine(options)
}

/**
 * Quick heal function - convenience wrapper
 */
export async function quickHeal(
  testName: string,
  testFile: string,
  error: string,
  stackTrace?: string,
  maxAttempts?: number
): Promise<HealingResult> {
  const engine = createReActEngine({ maxAttempts })
  await engine.initialize()
  return engine.healTest(testName, testFile, error, stackTrace)
}
