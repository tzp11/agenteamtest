import fs from 'node:fs'
import path from 'node:path'
import { getCwd } from '../../utils/cwd.js'

/**
 * 支持的编程语言
 */
export type ProgrammingLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'java'
  | 'c'
  | 'cpp'
  | 'rust'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'unknown'

/**
 * 语言特征配置
 */
interface LanguageSignature {
  extensions: string[]
  configFiles: string[]
  packageFiles: string[]
  priority: number // 优先级，数字越大优先级越高
}

const LANGUAGE_SIGNATURES: Record<ProgrammingLanguage, LanguageSignature> = {
  javascript: {
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    configFiles: ['.eslintrc', '.eslintrc.js', '.eslintrc.json', 'babel.config.js'],
    packageFiles: ['package.json'],
    priority: 5
  },
  typescript: {
    extensions: ['.ts', '.tsx'],
    configFiles: ['tsconfig.json', 'tsconfig.build.json'],
    packageFiles: ['package.json'],
    priority: 10 // TypeScript 优先级高于 JavaScript
  },
  python: {
    extensions: ['.py', '.pyw'],
    configFiles: ['setup.py', 'pyproject.toml', 'pytest.ini', 'tox.ini', '.pylintrc'],
    packageFiles: ['requirements.txt', 'Pipfile', 'poetry.lock'],
    priority: 8
  },
  go: {
    extensions: ['.go'],
    configFiles: [],
    packageFiles: ['go.mod', 'go.sum'],
    priority: 9
  },
  java: {
    extensions: ['.java'],
    configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    packageFiles: ['pom.xml', 'build.gradle'],
    priority: 7
  },
  c: {
    extensions: ['.c', '.h'],
    configFiles: ['Makefile', 'CMakeLists.txt'],
    packageFiles: [],
    priority: 4
  },
  cpp: {
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
    configFiles: ['Makefile', 'CMakeLists.txt'],
    packageFiles: [],
    priority: 6
  },
  rust: {
    extensions: ['.rs'],
    configFiles: ['Cargo.toml'],
    packageFiles: ['Cargo.toml', 'Cargo.lock'],
    priority: 8
  },
  csharp: {
    extensions: ['.cs'],
    configFiles: ['.csproj', '.sln'],
    packageFiles: ['packages.config', 'project.json'],
    priority: 6
  },
  php: {
    extensions: ['.php'],
    configFiles: ['composer.json', 'phpunit.xml'],
    packageFiles: ['composer.json', 'composer.lock'],
    priority: 5
  },
  ruby: {
    extensions: ['.rb'],
    configFiles: ['Gemfile', 'Rakefile'],
    packageFiles: ['Gemfile', 'Gemfile.lock'],
    priority: 5
  },
  swift: {
    extensions: ['.swift'],
    configFiles: ['Package.swift'],
    packageFiles: ['Package.swift', 'Package.resolved'],
    priority: 6
  },
  kotlin: {
    extensions: ['.kt', '.kts'],
    configFiles: ['build.gradle.kts'],
    packageFiles: ['build.gradle.kts'],
    priority: 6
  },
  unknown: {
    extensions: [],
    configFiles: [],
    packageFiles: [],
    priority: 0
  }
}

/**
 * 语言检测结果
 */
export interface LanguageDetectionResult {
  primary: ProgrammingLanguage
  secondary: ProgrammingLanguage[]
  confidence: number // 0-100
  fileCount: Record<ProgrammingLanguage, number>
}

/**
 * 检测项目使用的编程语言
 */
export async function detectProjectLanguage(cwd?: string): Promise<LanguageDetectionResult> {
  const workingDir = cwd || getCwd()

  // 统计各语言的文件数量
  const fileCount: Record<string, number> = {}
  const configScore: Record<string, number> = {}

  // 初始化计数器
  for (const lang of Object.keys(LANGUAGE_SIGNATURES)) {
    fileCount[lang] = 0
    configScore[lang] = 0
  }

  // 扫描源代码文件
  await scanDirectory(workingDir, fileCount, 0, 3) // 最多扫描 3 层

  // 检查配置文件和包管理文件
  for (const [lang, signature] of Object.entries(LANGUAGE_SIGNATURES)) {
    // 检查配置文件
    for (const configFile of signature.configFiles) {
      if (fs.existsSync(path.join(workingDir, configFile))) {
        configScore[lang] += 10
      }
    }

    // 检查包管理文件
    for (const packageFile of signature.packageFiles) {
      if (fs.existsSync(path.join(workingDir, packageFile))) {
        configScore[lang] += 20
      }
    }
  }

  // 计算综合得分
  const scores: Record<string, number> = {}
  for (const lang of Object.keys(LANGUAGE_SIGNATURES)) {
    const signature = LANGUAGE_SIGNATURES[lang as ProgrammingLanguage]
    scores[lang] =
      fileCount[lang] * signature.priority +
      configScore[lang]
  }

  // 排序找出主要语言和次要语言
  const sortedLangs = Object.entries(scores)
    .filter(([lang, score]) => score > 0)
    .sort(([, a], [, b]) => b - a)

  if (sortedLangs.length === 0) {
    return {
      primary: 'unknown',
      secondary: [],
      confidence: 0,
      fileCount: fileCount as Record<ProgrammingLanguage, number>
    }
  }

  const primary = sortedLangs[0][0] as ProgrammingLanguage
  const secondary = sortedLangs.slice(1, 4).map(([lang]) => lang as ProgrammingLanguage)

  // 计算置信度
  const totalScore = sortedLangs.reduce((sum, [, score]) => sum + score, 0)
  const confidence = totalScore > 0
    ? Math.min(100, Math.round((sortedLangs[0][1] / totalScore) * 100))
    : 0

  return {
    primary,
    secondary,
    confidence,
    fileCount: fileCount as Record<ProgrammingLanguage, number>
  }
}

/**
 * 递归扫描目录，统计文件数量
 */
async function scanDirectory(
  dir: string,
  fileCount: Record<string, number>,
  depth: number,
  maxDepth: number
): Promise<void> {
  if (depth > maxDepth) return

  // 跳过常见的忽略目录
  const ignoreDirs = [
    'node_modules', '.git', '.svn', 'dist', 'build', 'target',
    'vendor', '__pycache__', '.venv', 'venv', '.idea', '.vscode',
    'coverage', '.nyc_output', 'out', 'bin', 'obj'
  ]

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // 跳过忽略目录
        if (ignoreDirs.includes(entry.name)) continue

        // 递归扫描子目录
        await scanDirectory(fullPath, fileCount, depth + 1, maxDepth)
      } else if (entry.isFile()) {
        // 统计文件扩展名
        const ext = path.extname(entry.name).toLowerCase()

        for (const [lang, signature] of Object.entries(LANGUAGE_SIGNATURES)) {
          if (signature.extensions.includes(ext)) {
            fileCount[lang]++
          }
        }
      }
    }
  } catch (error) {
    // 忽略权限错误等
  }
}

/**
 * 根据语言获取推荐的覆盖率工具
 */
export function getRecommendedCoverageTool(language: ProgrammingLanguage): string[] {
  const tools: Record<ProgrammingLanguage, string[]> = {
    javascript: ['c8', 'nyc', 'jest --coverage'],
    typescript: ['c8', 'nyc', 'jest --coverage'],
    python: ['coverage', 'pytest-cov'],
    go: ['go test -cover', 'go test -coverprofile'],
    java: ['jacoco', 'cobertura'],
    c: ['gcov', 'lcov'],
    cpp: ['gcov', 'lcov', 'llvm-cov'],
    rust: ['tarpaulin', 'cargo-llvm-cov'],
    csharp: ['coverlet', 'dotcover'],
    php: ['phpunit --coverage-html', 'xdebug'],
    ruby: ['simplecov'],
    swift: ['xcodebuild -enableCodeCoverage'],
    kotlin: ['jacoco', 'kover'],
    unknown: []
  }

  return tools[language] || []
}
