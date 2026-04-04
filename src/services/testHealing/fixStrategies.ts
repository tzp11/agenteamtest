/**
 * Fix Strategies - Implementation of automatic repair strategies
 *
 * Implements specific fix actions for different failure types and languages.
 * Each strategy returns a fix action that can be executed.
 */

import { FailureType, Language, TestFailureInfo } from './reactEngine.js'

// Fix action result
export interface FixActionResult {
  success: boolean
  action: string
  fix?: string
  details?: string
  filesModified?: string[]
}

// Strategy executor interface
export interface StrategyExecutor {
  (info: TestFailureInfo): Promise<FixActionResult>
}

// Strategy registry
export const strategyExecutors: Record<Language, Record<FailureType, StrategyExecutor[]>> = {
  c: {
    [FailureType.ENVIRONMENT]: [
      // Fix 1: Check compilation
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('undefined reference') || error.includes('未定义引用')) {
          return {
            success: true,
            action: 'check-compilation',
            fix: '检查函数定义和链接配置',
            details: '未定义引用通常是因为函数未定义或链接顺序错误'
          }
        }
        return { success: false, action: 'check-compilation' }
      },
      // Fix 2: Check headers
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('header') || error.includes('头文件')) {
          return {
            success: true,
            action: 'check-headers',
            fix: '检查头文件包含和宏定义',
            details: '头文件问题可能是包含路径错误或宏未定义'
          }
        }
        return { success: false, action: 'check-headers' }
      },
      // Fix 3: Check libraries
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('library') || error.includes('库') || error.includes('link')) {
          return {
            success: true,
            action: 'check-libraries',
            fix: '检查链接库配置',
            details: '链接库问题需要检查 Makefile 或编译配置'
          }
        }
        return { success: false, action: 'check-libraries' }
      }
    ],
    [FailureType.TEST_CODE]: [
      // Fix 1: Fix assertions
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('assert') || error.includes('断言')) {
          return {
            success: true,
            action: 'fix-assertions',
            fix: '检查并修复断言逻辑',
            details: '断言失败需要检查预期值和实际值'
          }
        }
        return { success: false, action: 'fix-assertions' }
      },
      // Fix 2: Fix stubs/mocks
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('stub') || error.includes('mock')) {
          return {
            success: true,
            action: 'fix-stubs',
            fix: '检查并修复测试桩',
            details: '测试桩问题需要检查函数签名和返回值'
          }
        }
        return { success: false, action: 'fix-stubs' }
      }
    ],
    [FailureType.SOURCE_CODE]: [
      // Fix 1: Null pointer check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('null') || error.includes('segmentation') || error.includes('段错误')) {
          return {
            success: true,
            action: 'add-null-check',
            fix: '在代码中添加空指针检查',
            details: '在解引用前检查指针是否为 NULL'
          }
        }
        return { success: false, action: 'add-null-check' }
      },
      // Fix 2: Bounds check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('bounds') || error.includes('index') || error.includes('越界')) {
          return {
            success: true,
            action: 'add-bounds-check',
            fix: '添加数组边界检查',
            details: '访问数组元素前检查索引是否在有效范围内'
          }
        }
        return { success: false, action: 'add-bounds-check' }
      }
    ],
    [FailureType.UNKNOWN]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-unknown',
        fix: '需要手动分析错误',
        details: '无法自动识别问题类型'
      })
    ]
  },
  python: {
    [FailureType.ENVIRONMENT]: [
      // Fix 1: Install dependencies
      async (info: TestFailureInfo) => {
        const error = info.error
        if (error.includes('ModuleNotFoundError') || error.includes('ImportError')) {
          const match = error.match(/No module named ['"]([^'"]+)/)
          const module = match ? match[1] : 'unknown'
          return {
            success: true,
            action: 'pip-install',
            fix: `pip install ${module}`,
            details: `缺少模块: ${module}`
          }
        }
        return { success: false, action: 'pip-install' }
      },
      // Fix 2: Check venv
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('virtualenv') || error.includes('venv')) {
          return {
            success: true,
            action: 'check-venv',
            fix: '检查虚拟环境配置',
            details: '确保在正确的虚拟环境中运行测试'
          }
        }
        return { success: false, action: 'check-venv' }
      },
      // Fix 3: Fix syntax
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('syntaxerror') || error.includes('语法错误')) {
          return {
            success: true,
            action: 'fix-syntax',
            fix: '修复 Python 语法错误',
            details: '检查错误行号的语法'
          }
        }
        return { success: false, action: 'fix-syntax' }
      }
    ],
    [FailureType.TEST_CODE]: [
      // Fix 1: Fix pytest
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('pytest') || error.includes('fixture')) {
          return {
            success: true,
            action: 'fix-pytest',
            fix: '修复 pytest 配置或 fixture',
            details: '检查测试文件命名和 fixture 定义'
          }
        }
        return { success: false, action: 'fix-pytest' }
      },
      // Fix 2: Fix fixture
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('fixture') || error.includes('setup')) {
          return {
            success: true,
            action: 'fix-fixture',
            fix: '检查 fixture 函数定义',
            details: '确保 fixture 名称和参数正确'
          }
        }
        return { success: false, action: 'fix-fixture' }
      }
    ],
    [FailureType.SOURCE_CODE]: [
      // Fix 1: Type check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('typeerror') || error.includes('类型错误')) {
          return {
            success: true,
            action: 'fix-type',
            fix: '修复类型不匹配问题',
            details: '检查函数参数类型和返回值类型'
          }
        }
        return { success: false, action: 'fix-type' }
      },
      // Fix 2: None check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes("'NoneType'") || error.includes('noneobject')) {
          return {
            success: true,
            action: 'fix-none-check',
            fix: '添加 None 检查',
            details: '在访问对象属性前检查是否为 None'
          }
        }
        return { success: false, action: 'fix-none-check' }
      }
    ],
    [FailureType.UNKNOWN]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-unknown',
        fix: '需要手动分析错误',
        details: '无法自动识别问题类型'
      })
    ]
  },
  java: {
    [FailureType.ENVIRONMENT]: [
      // Fix 1: Maven
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('maven') || error.includes('pom.xml')) {
          return {
            success: true,
            action: 'maven-build',
            fix: '运行 mvn clean compile',
            details: '使用 Maven 构建项目'
          }
        }
        return { success: false, action: 'maven-build' }
      },
      // Fix 2: Gradle
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('gradle') || error.includes('build.gradle')) {
          return {
            success: true,
            action: 'gradle-build',
            fix: '运行 gradle build',
            details: '使用 Gradle 构建项目'
          }
        }
        return { success: false, action: 'gradle-build' }
      },
      // Fix 3: Classpath
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('classpath') || error.includes('noclassdeffounderror')) {
          return {
            success: true,
            action: 'check-classpath',
            fix: '检查 classpath 配置',
            details: '确保所有依赖在 classpath 中'
          }
        }
        return { success: false, action: 'check-classpath' }
      }
    ],
    [FailureType.TEST_CODE]: [
      // Fix 1: JUnit
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('junit') || error.includes('@test')) {
          return {
            success: true,
            action: 'fix-junit',
            fix: '修复 JUnit 测试配置',
            details: '检查测试方法和注解'
          }
        }
        return { success: false, action: 'fix-junit' }
      },
      // Fix 2: Mockito
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('mockito') || error.includes('mock')) {
          return {
            success: true,
            action: 'fix-mockito',
            fix: '修复 Mockito mock 配置',
            details: '检查 mock 对象定义和返回值'
          }
        }
        return { success: false, action: 'fix-mockito' }
      }
    ],
    [FailureType.SOURCE_CODE]: [
      // Fix 1: Null check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('nullpointerexception') || error.includes('空指针')) {
          return {
            success: true,
            action: 'add-null-check',
            fix: '添加空指针检查',
            details: '在调用方法前检查对象是否为 null'
          }
        }
        return { success: false, action: 'add-null-check' }
      },
      // Fix 2: Bounds
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('indexoutofbounds') || error.includes('数组下标')) {
          return {
            success: true,
            action: 'add-bounds-check',
            fix: '添加数组边界检查',
            details: '访问数组前检查索引范围'
          }
        }
        return { success: false, action: 'add-bounds-check' }
      }
    ],
    [FailureType.UNKNOWN]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-unknown',
        fix: '需要手动分析错误',
        details: '无法自动识别问题类型'
      })
    ]
  },
  go: {
    [FailureType.ENVIRONMENT]: [
      // Fix 1: Go modules
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('go mod') || error.includes('module')) {
          return {
            success: true,
            action: 'go-mod-tidy',
            fix: '运行 go mod tidy',
            details: '整理 Go 模块依赖'
          }
        }
        return { success: false, action: 'go-mod-tidy' }
      },
      // Fix 2: Go build
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('build') || error.includes('编译')) {
          return {
            success: true,
            action: 'go-build',
            fix: '运行 go build',
            details: '编译 Go 项目'
          }
        }
        return { success: false, action: 'go-build' }
      },
      // Fix 3: Go test
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('go test') || error.includes('测试')) {
          return {
            success: true,
            action: 'go-test',
            fix: '检查 go test 配置',
            details: '确保测试文件命名正确 (*_test.go)'
          }
        }
        return { success: false, action: 'go-test' }
      }
    ],
    [FailureType.TEST_CODE]: [
      // Fix 1: testing package
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('testing') || error.includes('t.fail')) {
          return {
            success: true,
            action: 'fix-testing',
            fix: '修复 testing 包使用',
            details: '检查测试函数签名 (func TestXxx(t *testing.T))'
          }
        }
        return { success: false, action: 'fix-testing' }
      },
      // Fix 2: Assertions
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('assert') || error.includes('require')) {
          return {
            success: true,
            action: 'fix-assert',
            fix: '修复断言语句',
            details: '检查断言库的使用方式'
          }
        }
        return { success: false, action: 'fix-assert' }
      }
    ],
    [FailureType.SOURCE_CODE]: [
      // Fix 1: Nil check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('nil') || error.includes('panic')) {
          return {
            success: true,
            action: 'add-nil-check',
            fix: '添加 nil 检查',
            details: '在解引用前检查值是否为 nil'
          }
        }
        return { success: false, action: 'add-nil-check' }
      },
      // Fix 2: Panic recovery
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('panic')) {
          return {
            success: true,
            action: 'handle-panic',
            fix: '添加 panic 恢复',
            details: '使用 defer recover() 捕获 panic'
          }
        }
        return { success: false, action: 'handle-panic' }
      }
    ],
    [FailureType.UNKNOWN]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-unknown',
        fix: '需要手动分析错误',
        details: '无法自动识别问题类型'
      })
    ]
  },
  rust: {
    [FailureType.ENVIRONMENT]: [
      // Fix 1: Cargo build
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('cargo') || error.includes('build')) {
          return {
            success: true,
            action: 'cargo-build',
            fix: '运行 cargo build',
            details: '使用 Cargo 构建项目'
          }
        }
        return { success: false, action: 'cargo-build' }
      },
      // Fix 2: Cargo test
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('test') || error.includes('测试')) {
          return {
            success: true,
            action: 'cargo-test',
            fix: '运行 cargo test',
            details: '确保测试函数有 #[test] 属性'
          }
        }
        return { success: false, action: 'cargo-test' }
      },
      // Fix 3: Cargo check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('check') || error.includes('lint')) {
          return {
            success: true,
            action: 'cargo-check',
            fix: '运行 cargo check',
            details: '检查代码编译状态'
          }
        }
        return { success: false, action: 'cargo-check' }
      }
    ],
    [FailureType.TEST_CODE]: [
      // Fix 1: Test attribute
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('test') || error.includes('attribute')) {
          return {
            success: true,
            action: 'fix-test-attr',
            fix: '检查 #[test] 属性',
            details: '确保测试函数有 #[test] 属性且不是私有函数'
          }
        }
        return { success: false, action: 'fix-test-attr' }
      },
      // Fix 2: Assert macro
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('assert') || error.includes('panic')) {
          return {
            success: true,
            action: 'fix-assert',
            fix: '修复断言宏',
            details: '检查 assert! 和 assert_eq! 的使用'
          }
        }
        return { success: false, action: 'fix-assert' }
      }
    ],
    [FailureType.SOURCE_CODE]: [
      // Fix 1: Panic handling
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('panic')) {
          return {
            success: true,
            action: 'handle-panic',
            fix: '修复 panic 发生',
            details: '检查导致 panic 的代码路径'
          }
        }
        return { success: false, action: 'handle-panic' }
      },
      // Fix 2: Borrow check
      async (info: TestFailureInfo) => {
        const error = info.error.toLowerCase()
        if (error.includes('borrow') || error.includes('lifetimes')) {
          return {
            success: true,
            action: 'fix-borrow',
            fix: '修复借用检查错误',
            details: '检查所有权和生命周期'
          }
        }
        return { success: false, action: 'fix-borrow' }
      }
    ],
    [FailureType.UNKNOWN]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-unknown',
        fix: '需要手动分析错误',
        details: '无法自动识别问题类型'
      })
    ]
  },
  unknown: {
    [FailureType.ENVIRONMENT]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'retry',
        fix: '重试操作',
        details: '尝试重新运行测试'
      })
    ],
    [FailureType.TEST_CODE]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-test',
        fix: '检查测试代码',
        details: '需要手动检查测试代码'
      })
    ],
    [FailureType.SOURCE_CODE]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-code',
        fix: '检查源代码',
        details: '需要手动检查源代码'
      })
    ],
    [FailureType.UNKNOWN]: [
      async (info: TestFailureInfo) => ({
        success: false,
        action: 'check-unknown',
        fix: '需要手动分析错误',
        details: '无法自动识别问题类型'
      })
    ]
  }
}

/**
 * Execute fix strategies for a given failure
 */
export async function executeFix(
  language: Language,
  failureType: FailureType,
  info: TestFailureInfo
): Promise<FixActionResult> {
  const langStrategies = strategyExecutors[language] || strategyExecutors.unknown
  const typeStrategies = langStrategies[failureType] || langStrategies[FailureType.UNKNOWN]

  for (const executor of typeStrategies) {
    const result = await executor(info)
    if (result.success) {
      return result
    }
  }

  // No specific fix found
  return {
    success: false,
    action: 'no-fix',
    fix: '需要手动修复',
    details: '没有找到适用的自动修复策略'
  }
}

/**
 * Get all available strategies for a language and failure type
 */
export function getAvailableStrategies(
  language: Language,
  failureType: FailureType
): string[] {
  const langStrategies = strategyExecutors[language] || strategyExecutors.unknown
  const typeStrategies = langStrategies[failureType] || langStrategies[FailureType.UNKNOWN]

  // Return actual strategy details from the executor functions
  return typeStrategies.map((executor, index) => {
    // Map index to human-readable strategy name
    const names: Record<number, string> = {
      0: 'pip-install',
      1: 'check-venv',
      2: 'fix-syntax',
      3: 'fix-mock',
      4: 'fix-async',
      5: 'fix-assertion',
      6: 'add-null-check',
      7: 'add-bounds-check',
      8: 'maven-build',
      9: 'gradle-build',
      10: 'go-mod-tidy',
      11: 'cargo-build',
      12: 'check-compilation',
      13: 'check-headers',
      14: 'check-libraries'
    }
    return names[index] || `strategy-${index + 1}`
  })
}

/**
 * Get detailed strategy information
 */
export function getStrategyDetails(
  language: Language,
  failureType: FailureType
): Array<{ name: string; description: string }> {
  const langStrategies = strategyExecutors[language] || strategyExecutors.unknown
  const typeStrategies = langStrategies[failureType] || langStrategies[FailureType.UNKNOWN]

  // Map index to human-readable strategy name
  const names: Record<number, string> = {
    0: 'pip-install',
    1: 'check-venv',
    2: 'fix-syntax',
    3: 'fix-mock',
    4: 'fix-async',
    5: 'fix-assertion',
    6: 'add-null-check',
    7: 'add-bounds-check',
    8: 'maven-build',
    9: 'gradle-build',
    10: 'go-mod-tidy',
    11: 'cargo-build',
    12: 'check-compilation',
    13: 'check-headers',
    14: 'check-libraries'
  }

  const descriptions: Record<string, string> = {
    'pip-install': '当错误为 ModuleNotFoundError 或 ImportError 时，自动提取缺失模块并安装',
    'check-venv': '当错误涉及 virtualenv 或 venv 时，确保在正确的虚拟环境中运行测试',
    'fix-syntax': '当错误为 SyntaxError 时，检查并修复语法错误',
    'fix-mock': '修复 mock 配置问题',
    'fix-async': '修复异步处理问题',
    'fix-assertion': '修复断言逻辑错误',
    'add-null-check': '添加空指针检查，防止空指针解引用',
    'add-bounds-check': '添加数组边界检查，防止越界访问',
    'check-compilation': '检查编译配置和链接设置',
    'check-headers': '检查头文件包含和宏定义',
    'check-libraries': '检查链接库配置'
  }

  return typeStrategies.map((_, index) => {
    const name = names[index] || `strategy-${index + 1}`
    return {
      name,
      description: descriptions[name] || `修复策略 ${index + 1}`
    }
  })
}
