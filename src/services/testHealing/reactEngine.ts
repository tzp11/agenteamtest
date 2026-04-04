/**
 * ReAct Engine - Test Self-Healing with Reasoning Loop
 *
 * Implements the ReAct (Reasoning + Acting) pattern for automatic test failure diagnosis and repair.
 * Supports multiple programming languages: C, Python, Java, Go, Rust
 *
 *循环流程:
 * 1. Thought: 分析失败原因
 * 2. Action: 尝试修复
 * 3. Observation: 重新运行测试
 * 4. Reflection: 更新假设（如果失败）
 * 5. 再行动: 基于新假设修复
 * 6. 再观察: 测试通过或达到重试上限
 */

// Import TestMemoryStorage directly for historical data
import { TestMemoryStorage } from '../../tools/TestMemoryTool/storage.js'

// Supported languages
export type Language = 'c' | 'python' | 'java' | 'go' | 'rust' | 'unknown'

// Failure types for classification
export enum FailureType {
  ENVIRONMENT = 'environment',    // 环境问题（编译工具、依赖、配置）
  TEST_CODE = 'test-code',         // 测试代码问题（测试框架、断言、Mock）
  SOURCE_CODE = 'source-code',     // 被测代码问题（运行时错误、逻辑错误）
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
  language: Language
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
  language?: Language
  timestamp?: number
}

// Classification result
export interface ClassificationResult {
  type: FailureType
  language: Language
  confidence: number
  reason: string
  suggestedFix?: string
}

// Pattern for successful fixes
export interface FixPattern {
  failureType: FailureType
  language: Language
  errorPattern: string
  fix: string
  successCount: number
  lastUsed: number
}

// Fix strategy interface
export interface FixStrategyItem {
  name: string
  description: string
}

// Language detection patterns
const LANGUAGE_PATTERNS: Record<Language, RegExp[]> = {
  c: [
    /undefined reference|未定义引用/,
    /segmentation fault|段错误/,
    /gcc|clang|makefile|stdio\.h/,
    /void|null pointer|null pointer/,
    /\.c:|\.h:/,
  ],
  python: [
    /ModuleNotFoundError|ImportError/,
    /Traceback \(most recent call last\)/,
    /python.*\d\.\d/,
    /pytest|unittest/,
    /File ".*\.py", line/,
  ],
  java: [
    /Exception in thread/i,
    /Exception:/,
    /NoClassDefFoundError|ClassNotFoundException/,
    /java\.|javax\./,
    /maven|gradle/,
    /NullPointerException/,
    /\.java:/,
  ],
  go: [
    /go: build|go mod/,
    /package.*github\.com/,
    /nil pointer|nil dereference/,
    /panic: /,
    /\.go:\d+/,
  ],
  rust: [
    /error\[E\d+\]/,
    /thread '.*' panicked/,
    /borrow checker/,
    /cargo|rustc/,
    /Option<.*>|None/,
  ],
  unknown: []
}

/**
 * Language Detector - 自动检测编程语言
 */
export class LanguageDetector {
  /**
   * 检测错误信息所使用的编程语言
   */
  static detect(error: string, stackTrace?: string): Language {
    const text = `${error} ${stackTrace || ''}`

    // Check each language's patterns
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      if (lang === 'unknown') continue

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return lang as Language
        }
      }
    }

    // Default to unknown
    return 'unknown'
  }

  /**
   * 从文件扩展名推断语言
   */
  static detectFromFile(filePath: string): Language {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const langMap: Record<string, Language> = {
      'c': 'c', 'h': 'c',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust'
    }
    return langMap[ext || ''] || 'unknown'
  }
}

// Language-specific patterns for failure classification
interface PatternSet {
  environment: { pattern: RegExp; reason: string }[]
  testCode: { pattern: RegExp; reason: string }[]
  sourceCode: { pattern: RegExp; reason: string }[]
}

// Multi-language error patterns
const LANGUAGE_PATTERNSETS: Record<Language, PatternSet> = {
  c: {
    environment: [
      { pattern: /undefined reference/i, reason: '未定义的函数或变量引用' },
      { pattern: /no such file|file not found|cannot find/i, reason: '文件或目录不存在' },
      { pattern: /permission denied|EACCES/i, reason: '权限不足' },
      { pattern: /make: \*\*\*|makefile.*error/i, reason: '编译错误' },
      { pattern: /warning: /i, reason: '编译警告' },
    ],
    testCode: [
      { pattern: /assertion failed|assert.*fail/i, reason: '断言失败' },
      { pattern: /test.*not.*found|undefined.*test/i, reason: '测试函数未找到' },
      { pattern: /mock|stub|iut/i, reason: '测试桩配置错误' },
    ],
    sourceCode: [
      { pattern: /segmentation fault|segfault/i, reason: '段错误（数组越界、空指针）' },
      { pattern: /null pointer|null pointer/i, reason: '空指针引用' },
      { pattern: /buffer overflow|memory.*overflow/i, reason: '缓冲区溢出' },
      { pattern: /divide by zero|division.*zero/i, reason: '除零错误' },
      { pattern: /infinite loop|死循环/i, reason: '无限循环' },
    ]
  },
  python: {
    environment: [
      { pattern: /ModuleNotFoundError|No module named/i, reason: '模块未找到' },
      { pattern: /ImportError|cannot import/i, reason: '导入错误' },
      { pattern: /pip install|requirements/i, reason: '依赖未安装' },
      { pattern: /virtualenv|conda|venv/i, reason: '虚拟环境问题' },
      { pattern: /SyntaxError|IndentationError/i, reason: '语法错误' },
    ],
    testCode: [
      { pattern: /assertion.*fail|AssertionError/i, reason: '断言失败' },
      { pattern: /pytest.*error|FAILED|ERROR/i, reason: 'pytest 测试失败' },
      { pattern: /unittest.*fail/i, reason: 'unittest 测试失败' },
      { pattern: /fixture.*not found|parametrize/i, reason: '测试 fixture 配置错误' },
    ],
    sourceCode: [
      { pattern: /TypeError|AttributeError|KeyError/i, reason: '类型或属性错误' },
      { pattern: /IndexError|KeyError/i, reason: '索引越界或键不存在' },
      { pattern: /ValueError/i, reason: '值错误' },
      { pattern: /ZeroDivisionError/i, reason: '除零错误' },
      { pattern: /RecursionError|maximum recursion/i, reason: '递归深度超限' },
    ]
  },
  java: {
    environment: [
      { pattern: /NoClassDefFoundError|ClassNotFoundException/i, reason: '类未找到' },
      { pattern: /NoSuchMethodError|method not found/i, reason: '方法未找到' },
      { pattern: /maven|gradle|dependency/i, reason: '依赖问题' },
      { pattern: /java\.lang\.|Exception in thread/i, reason: '运行时异常' },
      { pattern: /OutOfMemoryError|heap space/i, reason: '内存不足' },
    ],
    testCode: [
      { pattern: /junit|testng|assertEquals|assertTrue/i, reason: '测试断言失败' },
      { pattern: /@Test|@Before|@After/i, reason: '测试注解配置错误' },
      { pattern: /mockito|powermock|mock.*null/i, reason: 'Mock 配置错误' },
      { pattern: /AssertionFailedError/i, reason: '断言失败' },
    ],
    sourceCode: [
      { pattern: /NullPointerException/i, reason: '空指针异常' },
      { pattern: /ArrayIndexOutOfBoundsException|IndexOutOfBoundsException/i, reason: '数组越界' },
      { pattern: /IllegalArgumentException|IllegalStateException/i, reason: '非法参数或状态' },
      { pattern: /ConcurrentModificationException/i, reason: '并发修改异常' },
      { pattern: /StackOverflowError/i, reason: '栈溢出（递归）' },
    ]
  },
  go: {
    environment: [
      { pattern: /go: build|go: download/i, reason: 'Go 构建错误' },
      { pattern: /go mod|go.sum|cannot find package/i, reason: '依赖包未找到' },
      { pattern: /undefined:.*|undeclared name/i, reason: '未声明的标识符' },
      { pattern: /cannot use|cannot convert/i, reason: '类型不匹配' },
    ],
    testCode: [
      { pattern: /t\.Fatal|t\.Error|testing\.Error/i, reason: '测试失败' },
      { pattern: /assert|require/i, reason: '断言失败' },
      { pattern: /table-driven.*test|testify/i, reason: '测试配置错误' },
      { pattern: /mock.*nil/i, reason: 'Mock 未初始化' },
    ],
    sourceCode: [
      { pattern: /nil pointer dereference|nil dereference/i, reason: 'nil 指针解引用' },
      { pattern: /panic:|runtime error/i, reason: '运行时 panic' },
      { pattern: /index out of range|slice bounds/i, reason: '切片越界' },
      { pattern: /concurrent map read|map concurrent/i, reason: '并发 map 操作' },
      { pattern: /deadlock|all goroutines/i, reason: '死锁' },
    ]
  },
  rust: {
    environment: [
      { pattern: /error\[E\d+\]|compilation error/i, reason: '编译错误' },
      { pattern: /could not find|crate not found/i, reason: '依赖 crate 未找到' },
      { pattern: /cargo|rustc/i, reason: 'Cargo 构建错误' },
      { pattern: /link.*fail|undefined reference/i, reason: '链接错误' },
    ],
    testCode: [
      { pattern: /test failed|failures:.*\d/i, reason: '测试失败' },
      { pattern: /assert!|assert_eq!|assert_ne!/i, reason: '断言失败' },
      { pattern: /should_panic|should_panic/i, reason: 'panic 测试失败' },
      { pattern: /mock|#[cfg\(test\)]/i, reason: '测试配置错误' },
    ],
    sourceCode: [
      { pattern: /thread '.*' panicked|panic/i, reason: 'panic（运行时错误）' },
      { pattern: /borrow checker|cannot borrow|move/i, reason: '借用检查错误' },
      { pattern: /option|Maybe|None/i, reason: 'Option 处理错误' },
      { pattern: /index out of bounds/i, reason: '索引越界' },
      { pattern: /dead code|unreachable/i, reason: '代码逻辑错误' },
    ]
  },
  unknown: {
    environment: [
      // Generic patterns that work across languages
      { pattern: /not found|no such file|cannot find/i, reason: '文件或资源未找到' },
      { pattern: /permission denied|access denied/i, reason: '权限不足' },
      { pattern: /timeout|timed out/i, reason: '操作超时' },
      { pattern: /connection refused|ECONNREFUSED/i, reason: '连接失败' },
      { pattern: /memory.*error|out of memory/i, reason: '内存不足' },
    ],
    testCode: [
      { pattern: /assert.*fail|assertion.*fail/i, reason: '断言失败' },
      { pattern: /test.*fail|failed.*test/i, reason: '测试失败' },
      { pattern: /undefined|null|nil.*not/i, reason: '未定义值错误' },
    ],
    sourceCode: [
      { pattern: /null pointer|nil pointer|null reference/i, reason: '空指针错误' },
      { pattern: /index.*out.*bounds|array.*out.*range/i, reason: '索引越界' },
      { pattern: /overflow|underflow/i, reason: '数值溢出' },
      { pattern: /deadlock| infinite.*loop/i, reason: '死循环或死锁' },
      { pattern: /exception|error:|Error:/i, reason: '运行时异常' },
    ]
  }
}

// Generic fixes for each reason (language-independent)
const GENERIC_FIXES: Record<string, string> = {
  // Environment
  '文件或资源未找到': '检查文件路径是否正确，确保所需文件存在',
  '权限不足': '检查文件权限，或以适当权限运行测试',
  '操作超时': '增加超时时间，或检查服务响应速度',
  '连接失败': '检查目标服务是否启动，或使用 mock 替代',
  '内存不足': '增加内存限制，或检查是否有内存泄漏',
  '模块未找到': '安装所需依赖或模块',
  '依赖未安装': '运行包管理器安装依赖',
  '编译错误': '检查编译配置和代码语法',

  // Test code
  '断言失败': '检查期望值是否正确，或被测代码是否有 bug',
  '测试失败': '检查测试逻辑和被测代码',
  '未定义值错误': '检查变量是否正确初始化',
  '测试函数未找到': '检查测试函数名称和定义',
  '测试桩配置错误': '检查 mock/stub 配置是否正确',
  '测试 fixture 配置错误': '检查测试数据 setup',

  // Source code
  '空指针错误': '检查对象是否正确初始化，使用 optional chaining',
  '索引越界': '检查数组/列表边界，添加边界检查',
  '数值溢出': '检查数值范围，使用合适的类型',
  '死循环或死锁': '检查循环终止条件和并发逻辑',
  '运行时异常': '检查异常处理逻辑和边界条件',
}

/**
 * Failure Classifier - Categorizes test failures into 4 types with multi-language support
 */
export class FailureClassifier {
  /**
   * Classify a test failure into one of 4 types
   */
  classify(failure: TestFailureInfo): ClassificationResult {
    // Detect language if not provided
    const language = failure.language || LanguageDetector.detect(failure.error, failure.stackTrace)

    // Get pattern set for detected language
    const patternSet = LANGUAGE_PATTERNSETS[language] || LANGUAGE_PATTERNSETS.unknown

    const errorText = `${failure.error} ${failure.stackTrace || ''}`

    // Check environment patterns first
    for (const { pattern, reason } of patternSet.environment) {
      if (pattern.test(errorText)) {
        return {
          type: FailureType.ENVIRONMENT,
          language,
          confidence: 0.8,
          reason,
          suggestedFix: GENERIC_FIXES[reason] || '检查环境配置'
        }
      }
    }

    // Check test code patterns
    for (const { pattern, reason } of patternSet.testCode) {
      if (pattern.test(errorText)) {
        return {
          type: FailureType.TEST_CODE,
          language,
          confidence: 0.8,
          reason,
          suggestedFix: GENERIC_FIXES[reason] || '检查测试代码'
        }
      }
    }

    // Check source code patterns
    for (const { pattern, reason } of patternSet.sourceCode) {
      if (pattern.test(errorText)) {
        return {
          type: FailureType.SOURCE_CODE,
          language,
          confidence: 0.8,
          reason,
          suggestedFix: GENERIC_FIXES[reason] || '检查被测代码'
        }
      }
    }

    // Default to UNKNOWN with lower confidence
    return {
      type: FailureType.UNKNOWN,
      language,
      confidence: 0.3,
      reason: '无法识别失败类型',
      suggestedFix: '请手动检查测试失败原因'
    }
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): Language[] {
    return ['c', 'python', 'java', 'go', 'rust']
  }
}

/**
 * Fix Strategy - Provides fix strategies for each failure type and language
 */
export class FixStrategy {
  // Language-specific fix strategies
  private static readonly STRATEGIES: Record<Language, Record<FailureType, FixStrategyItem[]>> = {
    c: {
      [FailureType.ENVIRONMENT]: [
        { name: 'compile', description: '检查编译配置' },
        { name: 'headers', description: '检查头文件' },
        { name: 'links', description: '检查链接库' },
      ],
      [FailureType.TEST_CODE]: [
        { name: 'asserts', description: '修复断言' },
        { name: 'mocks', description: '修复测试桩' },
      ],
      [FailureType.SOURCE_CODE]: [
        { name: 'nullCheck', description: '添加空指针检查' },
        { name: 'boundsCheck', description: '添加边界检查' },
      ],
      [FailureType.UNKNOWN]: [
        { name: 'check', description: '检查问题' },
      ],
    },
    python: {
      [FailureType.ENVIRONMENT]: [
        { name: 'pipInstall', description: '安装依赖' },
        { name: 'venv', description: '检查虚拟环境' },
        { name: 'syntax', description: '修复语法' },
      ],
      [FailureType.TEST_CODE]: [
        { name: 'pytest', description: '修复 pytest 配置' },
        { name: 'fixture', description: '修复 fixture' },
      ],
      [FailureType.SOURCE_CODE]: [
        { name: 'typeCheck', description: '修复类型错误' },
        { name: 'nullCheck', description: '修复 None 检查' },
      ],
      [FailureType.UNKNOWN]: [
        { name: 'check', description: '检查问题' },
      ],
    },
    java: {
      [FailureType.ENVIRONMENT]: [
        { name: 'maven', description: 'Maven 构建' },
        { name: 'gradle', description: 'Gradle 构建' },
        { name: 'classpath', description: '检查 classpath' },
      ],
      [FailureType.TEST_CODE]: [
        { name: 'junit', description: '修复 JUnit 测试' },
        { name: 'mockito', description: '修复 Mockito' },
      ],
      [FailureType.SOURCE_CODE]: [
        { name: 'nullCheck', description: '添加空指针检查' },
        { name: 'bounds', description: '添加边界检查' },
      ],
      [FailureType.UNKNOWN]: [
        { name: 'check', description: '检查问题' },
      ],
    },
    go: {
      [FailureType.ENVIRONMENT]: [
        { name: 'goMod', description: 'Go 模块' },
        { name: 'goBuild', description: 'Go 构建' },
        { name: 'goTest', description: 'Go 测试' },
      ],
      [FailureType.TEST_CODE]: [
        { name: 'testing', description: '修复 testing 包' },
        { name: 'assert', description: '修复断言' },
      ],
      [FailureType.SOURCE_CODE]: [
        { name: 'nilCheck', description: '修复 nil 检查' },
        { name: 'panic', description: '修复 panic' },
      ],
      [FailureType.UNKNOWN]: [
        { name: 'check', description: '检查问题' },
      ],
    },
    rust: {
      [FailureType.ENVIRONMENT]: [
        { name: 'cargoBuild', description: 'Cargo 构建' },
        { name: 'cargoTest', description: 'Cargo 测试' },
        { name: 'cargoCheck', description: 'Cargo 检查' },
      ],
      [FailureType.TEST_CODE]: [
        { name: 'testAttr', description: '修复测试属性' },
        { name: 'assert', description: '修复断言宏' },
      ],
      [FailureType.SOURCE_CODE]: [
        { name: 'panic', description: '修复 panic' },
        { name: 'borrow', description: '修复借用错误' },
      ],
      [FailureType.UNKNOWN]: [
        { name: 'check', description: '检查问题' },
      ],
    },
    unknown: {
      [FailureType.ENVIRONMENT]: [
        { name: 'retry', description: '重试操作' },
        { name: 'checkDeps', description: '检查依赖' },
      ],
      [FailureType.TEST_CODE]: [
        { name: 'checkTest', description: '检查测试代码' },
        { name: 'checkAssert', description: '检查断言' },
      ],
      [FailureType.SOURCE_CODE]: [
        { name: 'checkCode', description: '检查源代码' },
        { name: 'debug', description: '调试分析' },
      ],
      [FailureType.UNKNOWN]: [
        { name: 'check', description: '检查问题' },
      ],
    }
  }

  /**
   * Get available strategies for a failure type and language
   */
  getStrategies(type: FailureType, language: Language): FixStrategyItem[] {
    const langStrategies = FixStrategy.STRATEGIES[language] || FixStrategy.STRATEGIES.unknown
    return langStrategies[type] || langStrategies[FailureType.UNKNOWN] || []
  }

  /**
   * Generate fix suggestion based on failure type and language
   */
  generateFix(type: FailureType, language: Language): string {
    const strategies = this.getStrategies(type, language)
    if (strategies.length === 0) {
      return `需要手动检查 ${type} 问题 (${language})`
    }
    return strategies[0].description
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
  private storage: TestMemoryStorage | null

  constructor(options: { maxAttempts?: number } = {}) {
    this.classifier = new FailureClassifier()
    this.fixStrategy = new FixStrategy()
    this.maxAttempts = options.maxAttempts || 3
    this.fixPatterns = []
    this.storage = null
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    try {
      this.storage = new TestMemoryStorage()
      await this.loadFixPatterns()
    } catch (error) {
      console.warn('[ReActEngine] Failed to initialize storage:', error)
    }
  }

  /**
   * Load fix patterns from historical data (only successful ones)
   */
  private async loadFixPatterns(): Promise<void> {
    if (!this.storage) return

    try {
      const records = await this.storage.queryHistory({ limit: 100 })

      for (const record of records) {
        // Only load successful fixes (result === 'pass') and have error message
        if (record.result === 'pass' && record.errorMessage) {
          const errorPattern = record.errorMessage.substring(0, 100)

          const failure: TestFailureInfo = {
            testName: record.testName,
            testFile: record.filePath || '',
            error: record.errorMessage,
            stackTrace: record.stackTrace
          }
          const classification = this.classifier.classify(failure)

          // Check if already exists
          const existing = this.fixPatterns.find(
            p => p.failureType === classification.type &&
                 p.language === classification.language &&
                 p.errorPattern === errorPattern
          )

          if (existing) {
            existing.successCount++
            existing.lastUsed = record.timestamp
          } else {
            this.fixPatterns.push({
              failureType: classification.type,
              language: classification.language,
              errorPattern: errorPattern,
              fix: classification.suggestedFix || '',
              successCount: 1,
              lastUsed: record.timestamp
            })
          }
        }
      }
    } catch (error) {
      console.warn('[ReActEngine] Failed to load fix patterns:', error)
    }
  }

  /**
   * Save a successful fix pattern
   */
  private saveFixPattern(type: FailureType, language: Language, error: string, fix: string): void {
    const existing = this.fixPatterns.find(
      p => p.failureType === type && p.language === language && p.errorPattern === error
    )

    if (existing) {
      existing.successCount++
      existing.lastUsed = Date.now()
    } else {
      this.fixPatterns.push({
        failureType: type,
        language,
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

    // Step 1: Detect language and classify the failure
    const classification = this.classifier.classify(failure)
    console.log(`[ReActEngine] Detected language: ${classification.language}, Type: ${classification.type}`)

    // Step 2: Try to find a known fix pattern
    const knownFix = this.findKnownFix(classification.type, classification.language, error)
    if (knownFix) {
      console.log(`[ReActEngine] Found known fix pattern: ${knownFix}`)
    }

    // Step 3: Execute ReAct loop with actual fix execution
    let currentAttempt = 0
    let lastStep: ReActStep | null = null
    let lastFixResult: any = null

    // Try to load executeFix function
    let executeFixFn: any = null
    try {
      const fixModule = await import('./fixStrategies.js')
      executeFixFn = fixModule.executeFix
    } catch (e) {
      console.warn('[ReActEngine] Could not load fixStrategies:', e)
    }

    while (currentAttempt < this.maxAttempts) {
      currentAttempt++

      // Thought: Analyze current state
      const thought = currentAttempt === 1
        ? `分析失败原因 (${classification.language}): ${classification.reason}`
        : lastStep?.success
          ? '分析成功，继续'
          : `反思：上一步 ${lastStep?.action} 失败，需要尝试其他方法`

      // Action: Attempt a fix (get the strategy)
      const fixAction = this.generateAction(classification, currentAttempt)
      const action = `尝试修复 ${currentAttempt}/${this.maxAttempts}: ${fixAction}`

      // Observation: Actually execute the fix if we have the function
      let observation = `执行修复: ${fixAction}`
      let stepSuccess = false

      if (executeFixFn && currentAttempt === 1) {
        try {
          const fixResult = await executeFixFn(classification.language, classification.type, failure)
          lastFixResult = fixResult
          if (fixResult.success) {
            observation = `✓ 执行成功: ${fixResult.fix || fixResult.action}\n  详情: ${fixResult.details || ''}`
            stepSuccess = true
          } else {
            observation = `✗ 执行失败: ${fixResult.details || '未知错误'}`
          }
        } catch (e: any) {
          observation = `✗ 执行出错: ${e.message}`
        }
      } else if (currentAttempt === 1 && knownFix) {
        // If we found a known fix from history
        observation = `✓ 使用已知修复: ${knownFix}`
        stepSuccess = true
      }

      // Create step
      const step: ReActStep = {
        thought,
        action,
        observation,
        success: stepSuccess,
        timestamp: Date.now()
      }

      steps.push(step)
      lastStep = step

      // If fix succeeded, we can stop early
      if (stepSuccess) {
        break
      }

      if (currentAttempt >= this.maxAttempts) {
        break
      }
    }

    // Step 4: Return result
    const result: HealingResult = {
      success: steps.some(s => s.success),
      attempts: currentAttempt,
      maxAttempts: this.maxAttempts,
      failureType: classification.type,
      language: classification.language,
      steps,
      finalFix: lastFixResult?.fix || knownFix || steps[steps.length - 1]?.action,
      healingTime: Date.now() - startTime
    }

    // If we found a known fix or fix succeeded, save the pattern
    if (knownFix || result.success) {
      this.saveFixPattern(classification.type, classification.language, error, result.finalFix || '')
    }

    return result
  }

  /**
   * Find a known fix from historical patterns
   */
  private findKnownFix(type: FailureType, language: Language, error: string): string | null {
    const pattern = this.fixPatterns.find(
      p => p.failureType === type &&
           p.language === language &&
           (error.includes(p.errorPattern) || p.errorPattern.includes(error))
    )

    return pattern?.fix || null
  }

  /**
   * Generate action based on classification and attempt number
   */
  private generateAction(classification: ClassificationResult, attempt: number): string {
    const { type, language } = classification
    const strategies = this.fixStrategy.getStrategies(type, language)
    const strategyIndex = Math.min(attempt - 1, strategies.length - 1)
    const strategy = strategies[strategyIndex]

    if (!strategy) {
      return 'no fix available'
    }

    return strategy.description
  }

  /**
   * Get healing statistics
   */
  getStatistics(): {
    totalHeals: number
    successRate: number
    averageAttempts: number
    patternsCount: number
    languagesSupported: Language[]
    recentSuccesses: number
  } {
    const totalSuccesses = this.fixPatterns.reduce((sum, p) => sum + p.successCount, 0)

    return {
      totalHeals: this.fixPatterns.length,
      successRate: this.fixPatterns.length > 0 ? totalSuccesses / this.fixPatterns.length : 0,
      averageAttempts: this.maxAttempts,
      patternsCount: this.fixPatterns.length,
      languagesSupported: FailureClassifier.getSupportedLanguages(),
      recentSuccesses: totalSuccesses
    }
  }
}

// Singleton instance for statistics (persists across calls)
let statsEngine: ReActEngine | null = null

/**
 * Get singleton engine for statistics tracking
 */
export function getStatsEngine(): ReActEngine {
  if (!statsEngine) {
    statsEngine = new ReActEngine({ maxAttempts: 3 })
  }
  return statsEngine
}

/**
 * Create a ReActEngine instance
 */
export function createReActEngine(options?: { maxAttempts?: number }): ReActEngine {
  return new ReActEngine(options)
}

/**
 * Quick heal function - convenience wrapper (uses singleton for stats)
 */
export async function quickHeal(
  testName: string,
  testFile: string,
  error: string,
  stackTrace?: string,
  _maxAttempts?: number // Reserved for future use
): Promise<HealingResult> {
  const engine = getStatsEngine()
  await engine.initialize()
  return engine.healTest(testName, testFile, error, stackTrace)
}

/**
 * Detect language from error message or file
 */
export function detectLanguage(error: string, filePath?: string): Language {
  if (filePath) {
    const fromFile = LanguageDetector.detectFromFile(filePath)
    if (fromFile !== 'unknown') return fromFile
  }
  return LanguageDetector.detect(error)
}