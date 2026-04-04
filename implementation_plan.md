# AI 测试增强系统 - 实施规划（简化版）

> 基于 Claude Code 的智能测试增强方案  
> 版本：v2.0 (简化实用版)  
> 更新时间：2026-04-03

---

## 📋 目录

1. [项目概述](#项目概述)
2. [核心功能清单](#核心功能清单)
3. [技术架构](#技术架构)
4. [详细实施计划](#详细实施计划)
5. [开发时间表](#开发时间表)
6. [验收标准](#验收标准)

---

## 项目概述

### 目标
在 Claude Code 基础上，构建轻量级但高效的测试增强系统，实现：
- 测试历史记忆与模式识别
- 覆盖率分析与盲区发现
- 多 Agent 协同生成测试
- 自动诊断与修复测试失败
- 主动扫描未测试代码

### 核心原则
- ✅ **实用优先**：优先实现高价值功能
- ✅ **轻量化**：避免重型依赖（如完整 GraphRAG）
- ✅ **渐进式**：分阶段实施，每阶段独立可用
- ✅ **可扩展**：为未来升级预留空间

### 与原始规划的差异
| 原始规划 | 简化方案 | 理由 |
|---------|---------|------|
| Memgraph 图数据库 | SQLite + JSON | 降低复杂度，满足 80% 需求 |
| Merkle Tree 索引 | git diff | 性能足够，实现简单 |
| 变异测试 | 暂不实现 | 投入产出比低 |
| LangGraph 编排 | 自定义编排器 | 利用现有 AgentTool |

---

## 核心功能清单

### 1. TestMemoryTool - 测试历史记忆系统

**功能描述：**
记录每次测试执行的结果、失败原因、修复历史，支持语义化查询。

**核心能力：**
- 📝 记录测试执行历史（测试名、结果、时间、错误信息）
- 🔍 查询历史失败模式（"这个测试上次为什么失败？"）
- 📊 统计测试稳定性（通过率、平均执行时间）
- 🧠 提取测试模式（如"登录测试总是需要 mock token"）

**存储结构：**
```
.claude/test-memory/
├── test-history.jsonl          # 测试执行历史（追加写入）
├── failure-patterns.json       # 失败模式索引
└── test-statistics.json        # 测试统计数据
```

**数据格式：**
```jsonl
{"testName":"test_login_success","result":"pass","timestamp":1712102400,"executionTime":125,"filePath":"tests/auth.test.ts"}
{"testName":"test_login_invalid","result":"fail","timestamp":1712102401,"executionTime":89,"error":"TypeError: Cannot read property 'token'","stackTrace":"...","filePath":"tests/auth.test.ts"}
```

---

### 2. TestCoverageTool - 覆盖率分析工具

**功能描述：**
集成主流覆盖率工具，解析报告，生成可视化热力图，识别未覆盖代码。

**核心能力：**
- 🔧 自动检测项目类型（JS/TS/Python/Go）
- ▶️ 运行覆盖率工具（c8、nyc、coverage.py、go test -cover）
- 📊 解析覆盖率报告（JSON/LCOV 格式）
- 🎨 生成 ASCII 热力图
- ⚠️ 识别关键未覆盖路径

**支持的工具：**
```typescript
const coverageTools = {
  'javascript': ['c8', 'nyc', 'jest --coverage'],
  'typescript': ['c8', 'nyc'],
  'python': ['coverage', 'pytest-cov'],
  'go': ['go test -cover'],
  'java': ['jacoco']
}
```

**输出示例：**
```
Coverage Report (Generated: 2026-04-03 10:30:15)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Coverage: 78.5%

File Coverage:
├─ src/auth/login.ts      ████████░░ 80.2%
├─ src/auth/logout.ts     ██████████ 100%
├─ src/payment/process.ts ████░░░░░░ 42.1% ⚠️
└─ src/api/users.ts       ███████░░░ 71.5%

Critical Uncovered Paths:
⚠️  src/payment/process.ts:45-52
    → Payment timeout error handling (complexity: 8)
    
⚠️  src/auth/login.ts:78-85
    → Invalid token retry logic (complexity: 6)
```

---

### 3. Multi-Agent 测试协同系统

**功能描述：**
5 个专业 Agent 分工协作，自动生成高质量测试代码。

**Agent 团队：**

#### 3.1 Test Architect Agent（测试架构师）
- **职责**：分析代码结构，制定测试策略
- **输入**：用户需求、代码库结构、现有测试
- **输出**：测试计划（单元/集成/E2E 比例、优先级）
- **模型**：Sonnet（需要深度分析）

#### 3.2 Unit Test Engineer Agent（单元测试工程师）
- **职责**：生成细粒度单元测试
- **输入**：测试计划、函数签名、代码逻辑
- **输出**：单元测试代码（覆盖所有分支）
- **模型**：Haiku（快速生成大量用例）

#### 3.3 Integration Test Engineer Agent（集成测试工程师）
- **职责**：生成模块间交互测试
- **输入**：测试计划、API 接口、数据流
- **输出**：集成测试代码
- **模型**：Sonnet（需要理解复杂交互）

#### 3.4 Test Reviewer Agent（测试审查员）
- **职责**：审查测试代码质量
- **输入**：生成的测试代码
- **输出**：审查意见、改进建议
- **模型**：Opus（需要高质量审查）

#### 3.5 Test Diagnostician Agent（测试诊断专家）
- **职责**：诊断测试失败原因
- **输入**：失败的测试、错误信息、堆栈跟踪
- **输出**：失败分类、修复建议
- **模型**：Sonnet（需要推理能力）

**协作流程：**
```
用户请求："为 login 功能生成测试"
    ↓
Test Architect（分析 login 功能，制定策略）
    ↓
[并行执行]
    ├─→ Unit Test Engineer（生成单元测试）
    └─→ Integration Test Engineer（生成集成测试）
    ↓
Test Reviewer（审查所有测试）
    ↓
[如果审查通过] → 执行测试
[如果审查不通过] → 返回修改
    ↓
[如果测试失败] → Test Diagnostician（诊断并修复）
```

---

### 4. ReAct 自愈循环系统

**功能描述：**
测试失败后自动诊断、分类、修复，最多重试 3 次。

**ReAct 循环：**
```
1. Thought（思考）：分析失败原因
   "错误信息显示 'Cannot read property token'，可能是 mock 配置问题"

2. Action（行动）：尝试修复
   修改 mock 配置：jest.fn().mockResolvedValue({ token: 'mock-token' })

3. Observation（观察）：重新运行测试
   测试仍然失败："TypeError: token is undefined"

4. Reflection（反思）：更新假设
   "不是 mock 问题，是异步处理问题，需要 await"

5. Action（再行动）：修复异步问题
   添加 await 关键字

6. Observation（再观察）：测试通过 ✓
```

**失败分类器：**
```typescript
enum FailureType {
  ENVIRONMENT = 'environment',      // 环境问题（端口占用、服务未启动）
  TEST_CODE = 'test-code',          // 测试代码问题（mock 配置、断言错误）
  SOURCE_CODE = 'source-code',      // 被测代码问题（真正的 bug）
  UNKNOWN = 'unknown'               // 未知问题
}
```

**修复策略：**
| 失败类型 | 自动修复策略 | 成功率预期 |
|---------|------------|-----------|
| ENVIRONMENT | 重启服务、清理缓存、检查端口 | 80% |
| TEST_CODE | 修复 mock、调整断言、处理异步 | 70% |
| SOURCE_CODE | 标记为 bug，生成报告 | 0%（需人工） |
| UNKNOWN | 尝试通用修复，最多 3 次 | 40% |

---

### 5. TestDiscoveryTool - 主动盲区扫描

**功能描述：**
主动扫描代码库，发现未测试的代码路径，生成测试建议。

**扫描模式：**

#### 5.1 基于覆盖率的盲区发现
```typescript
// 分析覆盖率报告，找出未覆盖的代码
const uncoveredPaths = [
  {
    file: 'src/payment/process.ts',
    lines: '45-52',
    type: 'error-handling',
    complexity: 8,
    priority: 'high',
    suggestion: 'Add test for payment timeout scenario'
  }
]
```

#### 5.2 基于复杂度的风险识别
```typescript
// 使用 LSPTool 分析代码复杂度
const highRiskFunctions = [
  {
    name: 'processPayment',
    file: 'src/payment/process.ts',
    complexity: 15,        // 圈复杂度
    testCoverage: 0,       // 无测试覆盖
    risk: 'critical'
  }
]
```

#### 5.3 基于历史的预测性扫描
```typescript
// 查询 TestMemoryTool，找出高频失败区域
const riskAreas = [
  {
    area: 'authentication',
    failureCount: 12,
    lastFailure: '2026-04-01',
    commonError: 'Token validation failed',
    suggestion: 'Add more edge case tests for token handling'
  }
]
```

**输出报告：**
```
Test Gap Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: 2026-04-03 10:45:30

🔴 Critical Gaps (3):
1. src/payment/process.ts:processPayment
   - Complexity: 15 | Coverage: 0%
   - Risk: Payment logic completely untested
   - Suggestion: Add unit tests for all payment scenarios

2. src/auth/session.ts:validateSession
   - Complexity: 12 | Coverage: 25%
   - Risk: Session expiry logic not tested
   - Suggestion: Add tests for session timeout edge cases

🟡 Medium Priority (5):
...

📊 Statistics:
- Total functions: 245
- Untested functions: 38 (15.5%)
- High complexity untested: 8
- Recommended new tests: 23
```

---

### 6. SQLite 轻量级关系图谱

**功能描述：**
使用 SQLite 存储代码关系，支持基础的依赖查询，替代重型 GraphRAG。

**数据库结构：**
```sql
-- 函数表
CREATE TABLE functions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  complexity INTEGER DEFAULT 0,
  last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, file_path)
);

-- 函数调用关系表
CREATE TABLE function_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_id INTEGER NOT NULL,
  callee_id INTEGER NOT NULL,
  call_count INTEGER DEFAULT 1,
  FOREIGN KEY (caller_id) REFERENCES functions(id),
  FOREIGN KEY (callee_id) REFERENCES functions(id),
  UNIQUE(caller_id, callee_id)
);

-- 测试覆盖表
CREATE TABLE test_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  function_id INTEGER NOT NULL,
  last_run TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK(status IN ('pass', 'fail', 'skip')),
  execution_time INTEGER,
  FOREIGN KEY (function_id) REFERENCES functions(id)
);

-- 索引优化
CREATE INDEX idx_functions_name ON functions(name);
CREATE INDEX idx_functions_file ON functions(file_path);
CREATE INDEX idx_calls_caller ON function_calls(caller_id);
CREATE INDEX idx_calls_callee ON function_calls(callee_id);
CREATE INDEX idx_coverage_function ON test_coverage(function_id);
CREATE INDEX idx_coverage_test ON test_coverage(test_name);
```

**核心查询：**

#### 6.1 查询：修改函数 X 会影响哪些测试？
```sql
-- 使用递归 CTE 查找调用链
WITH RECURSIVE call_chain AS (
  -- 起点：被修改的函数
  SELECT id, name, file_path, 0 as depth
  FROM functions 
  WHERE name = 'authenticateUser'
  
  UNION ALL
  
  -- 递归：找到所有调用它的函数（最多 5 层）
  SELECT f.id, f.name, f.file_path, cc.depth + 1
  FROM functions f
  JOIN function_calls fc ON f.id = fc.caller_id
  JOIN call_chain cc ON fc.callee_id = cc.id
  WHERE cc.depth < 5
)
SELECT DISTINCT 
  tc.test_name,
  tc.test_file,
  cc.name as affected_function,
  cc.depth as call_depth
FROM test_coverage tc
JOIN call_chain cc ON tc.function_id = cc.id
ORDER BY cc.depth, tc.test_name;
```

#### 6.2 查询：发现未测试的高复杂度函数
```sql
SELECT 
  f.name,
  f.file_path,
  f.complexity,
  COUNT(tc.id) as test_count
FROM functions f
LEFT JOIN test_coverage tc ON f.id = tc.function_id
WHERE f.complexity > 10
GROUP BY f.id
HAVING test_count = 0
ORDER BY f.complexity DESC
LIMIT 20;
```

#### 6.3 查询：函数的测试覆盖情况
```sql
SELECT 
  f.name as function_name,
  f.file_path,
  COUNT(DISTINCT tc.test_name) as test_count,
  AVG(tc.execution_time) as avg_execution_time,
  SUM(CASE WHEN tc.status = 'pass' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as pass_rate
FROM functions f
LEFT JOIN test_coverage tc ON f.id = tc.function_id
WHERE f.name = 'processPayment'
GROUP BY f.id;
```

**数据更新策略：**
```typescript
// 基于 git diff 的增量更新
async function updateGraphFromGitDiff() {
  // 1. 获取变更的文件
  const changedFiles = await execCommand('git diff --name-only HEAD~1 HEAD');
  
  // 2. 只重新分析变更的文件
  for (const file of changedFiles) {
    if (isCodeFile(file)) {
      // 使用 LSPTool 分析函数和调用关系
      const functions = await analyzeFunctions(file);
      const calls = await analyzeCallGraph(file);
      
      // 更新数据库
      await updateFunctions(functions);
      await updateCalls(calls);
    }
  }
  
  // 3. 更新时间戳
  await db.run('UPDATE functions SET last_modified = ? WHERE file_path IN (?)', 
    [Date.now(), changedFiles]);
}
```

---

### 7. Git Diff 增量变更检测

**功能描述：**
监控代码变更，自动识别受影响的测试，触发增量分析。

**核心能力：**
- 📝 检测文件变更（git diff）
- 🎯 识别受影响的函数
- 🔍 查询相关测试
- ⚡ 触发增量更新

**实现方式：**

#### 7.1 变更检测
```typescript
// 检测自上次分析以来的变更
async function detectChanges(): Promise<ChangedFile[]> {
  // 方式 1：基于 git diff
  const gitDiff = await execCommand('git diff --name-status HEAD~1 HEAD');
  
  // 方式 2：基于文件 mtime（无 git 环境）
  const files = await glob('src/**/*.{ts,js,py}');
  const changed = files.filter(f => {
    const mtime = fs.statSync(f).mtime.getTime();
    const lastAnalyzed = getLastAnalyzedTime(f);
    return mtime > lastAnalyzed;
  });
  
  return parseChangedFiles(gitDiff || changed);
}
```

#### 7.2 影响分析
```typescript
async function analyzeImpact(changedFiles: string[]): Promise<ImpactReport> {
  const affectedTests = [];
  
  for (const file of changedFiles) {
    // 1. 查询这个文件中的函数
    const functions = await db.all(
      'SELECT id, name FROM functions WHERE file_path = ?',
      [file]
    );
    
    // 2. 查询调用这些函数的测试
    for (const func of functions) {
      const tests = await findAffectedTests(func.id);
      affectedTests.push(...tests);
    }
  }
  
  return {
    changedFiles,
    affectedFunctions: functions.length,
    affectedTests: [...new Set(affectedTests)],
    recommendation: affectedTests.length > 0 
      ? `建议运行 ${affectedTests.length} 个受影响的测试`
      : '无受影响的测试'
  };
}
```

#### 7.3 自动触发
```typescript
// 监听文件变化（可选）
async function watchChanges() {
  const watcher = fs.watch(cwd, { recursive: true });
  
  for await (const event of watcher) {
    if (event.eventType === 'change' && isCodeFile(event.filename)) {
      // 延迟 1 秒，避免频繁触发
      await sleep(1000);
      
      // 分析影响
      const impact = await analyzeImpact([event.filename]);
      
      // 通知用户
      console.log(`检测到变更: ${event.filename}`);
      console.log(`受影响的测试: ${impact.affectedTests.join(', ')}`);
      
      // 可选：自动运行测试
      if (autoRunTests) {
        await runTests(impact.affectedTests);
      }
    }
  }
}
```

**输出示例：**
```
Change Detection Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detected: 2026-04-03 11:00:15

📝 Changed Files (3):
  M  src/auth/login.ts
  M  src/auth/session.ts
  A  src/auth/token.ts

🎯 Affected Functions (5):
  - authenticateUser (src/auth/login.ts)
  - validateSession (src/auth/session.ts)
  - generateToken (src/auth/token.ts)
  - refreshToken (src/auth/token.ts)
  - logout (src/auth/session.ts)

🧪 Affected Tests (8):
  - test_login_success
  - test_login_invalid_credentials
  - test_session_validation
  - test_session_expiry
  - test_token_generation
  - test_token_refresh
  - test_logout
  - test_concurrent_sessions

💡 Recommendation:
  Run: npm test -- --testNamePattern="(login|session|token|logout)"
  Estimated time: ~15 seconds
```

---

## 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                           │
│              (保持原有用户体验)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Test Enhancement Layer                          │
│         (新增测试增强层，无侵入式集成)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Test Tools   │  │ Test Agents  │  │ Test Services│      │
│  │ - Memory     │  │ - Architect  │  │ - Orchestrator│     │
│  │ - Coverage   │  │ - Unit Tester│  │ - Healer     │      │
│  │ - Discovery  │  │ - Reviewer   │  │ - Analyzer   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────────┐
│ Data Layer   │ │ Analysis│ │ Execution   │
│              │ │ Layer   │ │ Layer       │
│ SQLite DB    │ │ LSPTool │ │ BashTool    │
│ - functions  │ │ Git Diff│ │ (后台执行)   │
│ - calls      │ │ AST     │ │             │
│ - coverage   │ │         │ │             │
│              │ │         │ │             │
│ JSONL Files  │ │         │ │             │
│ - test-      │ │         │ │             │
│   history    │ │         │ │             │
└──────────────┘ └─────────┘ └─────────────┘
```

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **运行时** | Bun | 与 Claude Code 保持一致 |
| **语言** | TypeScript | 与 Claude Code 保持一致 |
| **数据库** | SQLite (better-sqlite3) | 轻量级，单文件，无需额外服务 |
| **存储** | JSONL + JSON | 测试历史用 JSONL（追加写入） |
| **代码分析** | LSPTool (现有) | 利用 Claude Code 现有能力 |
| **覆盖率** | c8/nyc/coverage.py | 主流工具，按语言选择 |
| **测试执行** | BashTool (现有) | 利用后台执行能力 |
| **Agent 系统** | AgentTool (现有) | 利用 Claude Code 现有 Agent 系统 |

### 文件结构

```
src/
├── tools/
│   ├── TestMemoryTool/
│   │   ├── TestMemoryTool.ts          # Tool 主文件
│   │   ├── storage.ts                 # JSONL 存储
│   │   └── query.ts                   # 查询接口
│   ├── TestCoverageTool/
│   │   ├── TestCoverageTool.ts
│   │   ├── parsers/                   # 覆盖率报告解析器
│   │   │   ├── c8Parser.ts
│   │   │   ├── nycParser.ts
│   │   │   └── coveragePyParser.ts
│   │   └── visualizer.ts              # ASCII 热力图
│   ├── TestDiscoveryTool/
│   │   ├── TestDiscoveryTool.ts
│   │   ├── coverageScanner.ts         # 覆盖率扫描
│   │   ├── complexityAnalyzer.ts      # 复杂度分析
│   │   └── historyAnalyzer.ts         # 历史分析
│   └── TestGraphTool/
│       ├── TestGraphTool.ts
│       ├── database.ts                # SQLite 操作
│       ├── schema.sql                 # 数据库 Schema
│       └── queries.ts                 # 预定义查询
│
├── services/
│   ├── testOrchestration/
│   │   ├── orchestrator.ts            # Agent 编排器
│   │   ├── agentRunner.ts             # Agent 执行器
│   │   └── resultAggregator.ts        # 结果聚合
│   ├── testHealing/
│   │   ├── reactEngine.ts             # ReAct 循环引擎
│   │   ├── failureClassifier.ts       # 失败分类器
│   │   └── fixStrategies.ts           # 修复策略
│   ├── codeAnalysis/
│   │   ├── gitDiffMonitor.ts          # Git 变更监控
│   │   ├── impactAnalyzer.ts          # 影响分析
│   │   └── callGraphBuilder.ts        # 调用图构建
│   └── SessionMemory/
│       └── testMemoryExtractor.ts     # 扩展现有 SessionMemory
│
└── .claude/
    ├── agents/
    │   ├── test-architect.md          # 测试架构师 Agent
    │   ├── unit-test-engineer.md      # 单元测试工程师
    │   ├── integration-test-engineer.md
    │   ├── test-reviewer.md
    │   └── test-diagnostician.md
    ├── test-memory/
    │   ├── test-history.jsonl         # 测试历史
    │   ├── failure-patterns.json      # 失败模式
    │   └── test-statistics.json       # 统计数据
    └── test-graph.db                  # SQLite 数据库
```

---

## 详细实施计划

### Phase 1: 基础设施搭建（Week 1-2）

#### Week 1: TestMemoryTool + 数据存储

**目标：** 实现测试历史记录和查询

**任务清单：**
- [x] 创建 SimpleTestTool（用于调试和验证工具开发流程）
- [x] 创建 TestMemoryTool 基础结构
- [x] 实现 JSONL 存储引擎
- [x] 实现基础查询接口（记录、查询、统计）
- [x] 修复工具方法签名问题
- [x] 集成到 tools.ts
- [x] 创建测试脚本

**交付物：**
```typescript
// 已实现并测试通过
await TestMemoryTool.call({
  operation: 'record',
  testName: 'test_login_success',
  result: 'pass',
  executionTime: 125
});

await TestMemoryTool.call({
  operation: 'query',
  testName: 'test_login_success'
});
// 返回：该测试的历史记录
```

**验收标准：**
- ✅ 能记录测试执行结果
- ✅ 能查询测试历史
- ✅ 能统计测试通过率
- ✅ 数据持久化到 .claude/test-memory/

**实际完成情况：**
- 完成度：100%
- 提交记录：`124c131`, `0f98121`, `4849297`

---

#### Week 2: TestCoverageTool + 覆盖率集成

**目标：** 集成覆盖率工具，生成可视化报告

**任务清单：**
- [x] 创建 TestCoverageTool 基础结构
- [x] 实现语言检测（JS/TS/Python/Go）
- [x] 实现 c8/nyc 解析器（JavaScript/TypeScript）
- [x] 实现 coverage.py 解析器（Python）
- [x] 实现 ASCII 热力图生成器
- [x] 识别未覆盖的关键路径
- [x] 修复工具方法签名问题
- [x] 集成到 tools.ts

**交付物：**
```typescript
// 已实现并测试通过
await TestCoverageTool.call({
  operation: 'detect'
});
// 返回：检测到的语言和推荐工具

await TestCoverageTool.call({
  operation: 'parse',
  reportPath: 'coverage/coverage-final.json'
});
// 返回：覆盖率报告 + ASCII 热力图
```

**验收标准：**
- ✅ 能自动检测项目语言
- ✅ 能运行覆盖率工具
- ✅ 能解析覆盖率报告
- ✅ 能生成 ASCII 热力图
- ✅ 能识别未覆盖路径

**实际完成情况：**
- 完成度：100%
- 提交记录：`e160066`, `4849297`

---

### Phase 2: 关系图谱与变更检测（Week 3-4）

#### Week 3: SQLite 图谱 + Git Diff 监控

**目标：** 构建轻量级代码关系图谱

**任务清单：**
- [x] 设计 SQLite Schema（functions, calls, coverage）
- [x] 创建 TestGraphTool 框架
- [x] 实现数据库初始化和迁移
- [x] 实现 Git Diff 变更检测
- [x] 使用 LSPTool 构建调用图
- [x] 实现核心查询（影响分析、盲区发现）
- [x] 实现增量更新机制
- [x] 修复 Git 变更检测的 changeType 判断错误
- [x] 修复增量更新的路径拼接问题
- [x] 修复 smartUpdate 忽略工作目录未提交变更
- [x] 修复 shouldProcessFile 过滤逻辑
- [x] 安装 better-sqlite3 依赖
- [x] 注册工具到 tools.ts
- [x] 创建测试脚本并验证功能

**当前进度：100% ✅ - Week 3 完成！**

**实际完成情况：**
- 完成度：100%
- 核心提交记录：
  - `ae7e9dc` fix: 修复 Git 变更检测的 changeType 判断逻辑
  - `a2f7206` fix: 修复增量更新的路径拼接问题
  - `289aea6` fix: 修复 smartUpdate 忽略工作目录未提交变更的问题
  - `e3a66e9` fix: 修复 shouldProcessFile 过滤逻辑
  - `3209b3b` feat: 实现增量更新机制并完成 Week 3 所有任务
  - `c8fd3fb` feat: 实现 TestGraphTool - SQLite 图谱和 Git Diff 监控
- 新增文件：7个
- 代码行数：~2000行
- 修复的关键 bug：4个

**实现方式调整：**
1. **Git 变更检测**：原计划只用 `git diff --numstat`，实际改为结合 `git status --porcelain` 来准确判断文件状态
2. **路径处理**：原计划使用 cwd，实际改为使用 `git rev-parse --show-toplevel` 获取仓库根目录
3. **增量更新策略**：原计划只检查提交间差异，实际改为同时检查已提交变更和工作目录未提交变更

**交付物：**
```typescript
// 1. 初始化数据库
await TestGraphTool.call({ operation: 'init' })

// 2. 构建调用图（首次全量扫描）
await TestGraphTool.call({
  operation: 'buildCallGraph',
  filePatterns: ['**/*.c', '**/*.ts']
})

// 3. 增量更新（智能检测变更）
await TestGraphTool.call({
  operation: 'incrementalUpdate',
  filePatterns: ['**/*.c']
})

// 4. 查找未覆盖函数
await TestGraphTool.call({
  operation: 'findUncoveredFunctions',
  minComplexity: 0
})

// 5. 获取覆盖率统计
await TestGraphTool.call({
  operation: 'getCoverageStats'
})

// 6. 检测 Git 变更
await TestGraphTool.call({
  operation: 'detectChanges'
})
```

**验收标准：**
- ✅ SQLite 数据库正常工作
- ✅ 能检测 git diff 变更（正确识别 modified/added/deleted）
- ✅ 能构建函数调用图
- ✅ 增量更新能正确处理文件变更
- ✅ 能发现未覆盖函数
- ⚠️ 能查询受影响的测试（需要 Week 4 的测试覆盖率数据）

**已知限制：**
- `findAffectedTests` 功能需要先有测试文件和覆盖率数据（Week 4 实现）
- LSP 解析依赖代码格式，建议保持标准格式

---

#### Week 4: 影响分析 + 自动触发

**目标：** 实现智能的变更影响分析

**任务清单：**
- [x] 实现 impactAnalyzer 服务
- [x] 实现 callGraphBuilder（基于 LSPTool）
- [x] 实现报告格式化器（reportFormatter）
- [x] 实现查询缓存（queryCache）
- [x] 集成 TestMemoryTool 和 TestGraphTool
- [x] 生成影响分析报告
- [x] 优化查询性能（索引、缓存）
- [x] 创建测试脚本

**当前进度：100% ✅ - Week 4 完成！**

**实际完成情况：**
- 完成度：100%
- 核心提交记录：`2f02bb3` feat: 完成 Week 4 - 影响分析和自动触发
- 新增文件：4个核心服务 + 4个测试文件 + 4个文档
  - `src/services/codeAnalysis/impactAnalyzer.ts` (289行)
  - `src/services/codeAnalysis/callGraphBuilder.ts` (280行)
  - `src/services/codeAnalysis/reportFormatter.ts` (210行)
  - `src/services/codeAnalysis/queryCache.ts` (160行)
  - `test/src/auth.c`, `test/src/session.c` (测试用 C 代码)
  - `test/tests/test_auth.c`, `test/tests/test_session.c` (测试用例)
- 代码行数：~2154行新增，-294行删除
- 新增功能：analyzeImpact 操作集成到 TestGraphTool

**交付物：**
```typescript
// 使用示例
const impact = await TestGraphTool.call({
  operation: 'analyzeImpact',
  changedFiles: ['src/auth/login.ts']
});
console.log(impact);
// {
//   changedFiles: ['src/auth/login.ts'],
//   affectedFunctions: [...],
//   affectedTests: ['test_login_success', 'test_login_invalid'],
//   recommendation: '建议运行 2 个受影响的测试',
//   estimatedTestTime: 250
// }
```

**验收标准：**
- ✅ 能分析代码变更影响
- ✅ 能推荐需要运行的测试
- ✅ 查询性能 < 1 秒（通过索引和缓存优化）
- ✅ 支持多层调用链分析（递归 CTE）
- ✅ 生成格式化的影响分析报告

**实现亮点：**
1. **ImpactAnalyzer**：使用递归 CTE 查询调用链，最多 5 层深度
2. **CallGraphBuilder**：集成 LSPTool 进行代码分析，提取函数定义和调用关系
3. **ReportFormatter**：生成美观的 ASCII 报告，包含进度条、风险标记等
4. **QueryCache**：实现 TTL 缓存，支持模式匹配失效，提升查询性能

**实现思路与原规划的差异：**

| 原规划 | 实际实现 | 原因 |
|--------|---------|------|
| 使用 LSPTool 构建完整调用图 | CallGraphBuilder 框架已实现，但未在 Week 4 直接使用 | Week 3 的 CallGraphBuilder 已经能满足需求，Week 4 的 CallGraphBuilder 作为备用方案 |
| 实现文件变更监控（可选） | 未实现 | 使用 Git Diff 检测已足够，实时监控不是必需功能 |
| 自动触发测试 | 未实现 | 只实现了影响分析和推荐，实际触发留给 CI/CD 或用户手动执行 |

**遇到的核心问题：**
1. **数据库私有属性访问** - `db['db']` 无法访问，需添加 `getDatabase()` 方法
2. **SQL 字段名错误** - `test_coverage` 表只存储 ID，不存储名称，需 JOIN `functions` 表
3. **路径匹配不灵活** - 只支持精确匹配，改进为支持后缀匹配和文件名匹配
4. **工具静默失败** - 参考 Week 1-2 经验，添加 try-catch 和详细日志

详见 [TROUBLESHOOTING.md - Week 4](TROUBLESHOOTING.md#week-4-影响分析与自动触发)

---

### Phase 3: Multi-Agent 协同（Week 5-6）

#### Week 5: 定义测试 Agent

**目标：** 创建 5 个专业测试 Agent

**任务清单：**
- [ ] 编写 test-architect.md
- [ ] 编写 unit-test-engineer.md
- [ ] 编写 integration-test-engineer.md
- [ ] 编写 test-reviewer.md
- [ ] 编写 test-diagnostician.md
- [ ] 测试每个 Agent 的独立功能
- [ ] 优化 Agent 提示词

**交付物：**
5 个 Agent 定义文件，放在 `.claude/agents/` 目录

**验收标准：**
- ✅ 每个 Agent 能独立工作
- ✅ Agent 输出格式规范
- ✅ Agent 能正确使用 Tool

---

#### Week 6: TestOrchestrator + 协同流程

**目标：** 实现 Agent 编排和协同

**任务清单：**
- [ ] 创建 TestOrchestrator 服务
- [ ] 实现 Agent 调度逻辑
- [ ] 实现并行执行（Unit + Integration）
- [ ] 实现结果聚合
- [ ] 实现审查循环（Reviewer 反馈）
- [ ] 集成 TodoWrite 显示进度
- [ ] 性能优化（并行、超时控制）

**交付物：**
```typescript
// 使用示例
const orchestrator = new TestOrchestrator();
const result = await orchestrator.generateTests(
  '为 login 功能生成完整的测试'
);
// 返回：生成的测试代码 + 审查意见
```

**验收标准：**
- ✅ 能自动分配任务给多个 Agent
- ✅ 能并行执行 Agent
- ✅ 能聚合 Agent 结果
- ✅ 能显示协作进度
- ✅ 总耗时 < 30 秒

---

### Phase 4: 自愈循环（Week 7-8）

#### Week 7: ReAct 引擎 + 失败分类

**目标：** 实现测试失败的自动诊断

**任务清单：**
- [ ] 创建 ReActEngine 服务
- [ ] 实现失败分类器（4 种类型）
- [ ] 实现 Thought-Action-Observation 循环
- [ ] 集成 TestMemoryTool（查询历史失败）
- [ ] 实现重试机制（最多 3 次）
- [ ] 记录成功的修复模式

**交付物：**
```typescript
// 使用示例
const healer = new ReActEngine();
const result = await healer.healTest(
  'test_login_success',
  { error: 'TypeError: Cannot read property token', stack: '...' }
);
// 返回：{ success: true, attempts: 2, fix: '...' }
```

**验收标准：**
- ✅ 能分类失败类型
- ✅ 能执行 ReAct 循环
- ✅ 能自动重试 3 次
- ✅ 能记录修复模式

---

#### Week 8: 修复策略 + 沙盒执行

**目标：** 实现针对性的自动修复

**任务清单：**
- [ ] 实现环境问题修复策略
- [ ] 实现测试代码修复策略
- [ ] 实现通用修复策略
- [ ] 集成 BashTool 后台执行
- [ ] 实现测试隔离（可选 Docker）
- [ ] 生成修复报告

**交付物：**
```typescript
// 修复策略示例
const strategies = {
  ENVIRONMENT: [
    'killPort',      // 杀死占用端口的进程
    'clearCache',    // 清理缓存
    'restartService' // 重启服务
  ],
  TEST_CODE: [
    'fixMock',       // 修复 mock 配置
    'fixAsync',      // 修复异步问题
    'fixAssertion'   // 修复断言
  ]
};
```

**验收标准：**
- ✅ 环境问题修复成功率 > 70%
- ✅ 测试代码问题修复成功率 > 60%
- ✅ 能生成详细的修复报告
- ✅ 单次修复耗时 < 10 秒

---

### Phase 5: 主动发现与优化（Week 9-10）

#### Week 9: TestDiscoveryTool + 盲区扫描

**目标：** 主动发现测试盲区

**任务清单：**
- [ ] 创建 TestDiscoveryTool
- [ ] 实现覆盖率盲区扫描
- [ ] 实现复杂度分析（基于 LSPTool）
- [ ] 实现历史风险分析
- [ ] 生成优先级排序
- [ ] 生成测试建议

**交付物：**
```typescript
// 使用示例
await TestDiscoveryTool.call({
  mode: 'coverage-based'
});
// 返回：未覆盖路径列表 + 测试建议
```

**验收标准：**
- ✅ 能发现未覆盖路径
- ✅ 能识别高复杂度函数
- ✅ 能分析历史风险
- ✅ 能生成测试建议
- ✅ 扫描耗时 < 5 秒

---

#### Week 10: 集成测试 + 性能优化

**目标：** 系统集成和性能优化

**任务清单：**
- [ ] 端到端集成测试
- [ ] 性能基准测试
- [ ] 数据库查询优化
- [ ] 缓存策略优化
- [ ] 内存使用优化
- [ ] 编写用户文档
- [ ] 编写开发者文档

**验收标准：**
- ✅ 所有功能正常工作
- ✅ 性能达标（见 KPI）
- ✅ 文档完整

---

## 开发时间表

### 总览（10 周）

```
Week 1-2:  基础设施 (TestMemory + Coverage)
Week 3-4:  关系图谱 (SQLite + Git Diff)
Week 5-6:  Multi-Agent (5 个 Agent + Orchestrator)
Week 7-8:  自愈循环 (ReAct + 修复策略)
Week 9-10: 主动发现 (Discovery + 优化)
```

### 详细甘特图

| 任务 | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Week 6 | Week 7 | Week 8 | Week 9 | Week 10 |
|------|--------|--------|--------|--------|--------|--------|--------|--------|--------|---------|
| TestMemoryTool | ████ | | | | | | | | | |
| TestCoverageTool | | ████ | | | | | | | | |
| SQLite 图谱 | | | ████ | | | | | | | |
| Git Diff 监控 | | | | ████ | | | | | | |
| 定义 Agent | | | | | ████ | | | | | |
| TestOrchestrator | | | | | | ████ | | | | |
| ReAct 引擎 | | | | | | | ████ | | | |
| 修复策略 | | | | | | | | ████ | | |
| TestDiscoveryTool | | | | | | | | | ████ | |
| 集成优化 | | | | | | | | | | ████ |

### 里程碑

| 里程碑 | 时间 | 交付物 | 价值 |
|--------|------|--------|------|
| **M1: 基础可用** | Week 2 | TestMemory + Coverage | 能记录历史、分析覆盖率 |
| **M2: 关系图谱** | Week 4 | SQLite 图谱 + Git Diff | 能分析影响、发现盲区 |
| **M3: 智能生成** | Week 6 | Multi-Agent 系统 | 能自动生成测试 |
| **M4: 自动修复** | Week 8 | ReAct 自愈 | 能自动修复失败 |
| **M5: 完整系统** | Week 10 | 全功能系统 | 生产可用 |

---

## 验收标准

### 功能验收

#### 1. TestMemoryTool
- [ ] 能记录测试执行结果（pass/fail/skip）
- [ ] 能查询测试历史（按名称、时间、结果）
- [ ] 能统计测试通过率和执行时间
- [ ] 能识别频繁失败的测试
- [ ] 数据持久化到 JSONL 文件

#### 2. TestCoverageTool
- [ ] 能自动检测项目语言（JS/TS/Python/Go）
- [ ] 能运行覆盖率工具（c8/nyc/coverage.py）
- [ ] 能解析覆盖率报告（JSON/LCOV）
- [ ] 能生成 ASCII 热力图
- [ ] 能识别未覆盖的关键路径

#### 3. Multi-Agent 系统
- [ ] 5 个 Agent 能独立工作
- [ ] TestOrchestrator 能编排 Agent
- [ ] 能并行执行 Unit + Integration Agent
- [ ] Test Reviewer 能审查测试质量
- [ ] Test Diagnostician 能诊断失败

#### 4. ReAct 自愈循环
- [ ] 能分类失败类型（4 种）
- [ ] 能执行 Thought-Action-Observation 循环
- [ ] 能自动重试最多 3 次
- [ ] 环境问题修复成功率 > 70%
- [ ] 测试代码问题修复成功率 > 60%

#### 5. TestDiscoveryTool
- [ ] 能基于覆盖率发现盲区
- [ ] 能基于复杂度识别风险
- [ ] 能基于历史预测问题
- [ ] 能生成优先级排序
- [ ] 能生成测试建议

#### 6. SQLite 图谱
- [ ] 能存储函数和调用关系
- [ ] 能查询受影响的测试
- [ ] 能发现未覆盖函数
- [ ] 能基于 git diff 增量更新
- [ ] 查询性能 < 1 秒

#### 7. Git Diff 监控
- [ ] 能检测文件变更
- [ ] 能分析变更影响
- [ ] 能推荐需要运行的测试
- [ ] 能触发增量更新
- [ ] 检测延迟 < 1 秒

---

### 性能验收

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| **图谱增量更新** | < 1 秒 | 修改 1 个文件，测量更新时间 |
| **测试生成响应** | < 30 秒 | 生成 10 个测试用例 |
| **单次自愈循环** | < 10 秒 | 修复 1 个失败测试 |
| **覆盖率分析** | < 5 秒 | 分析 1000 行代码 |
| **盲区扫描** | < 5 秒 | 扫描 100 个函数 |
| **影响分析** | < 1 秒 | 分析 1 个文件变更 |
| **数据库查询** | < 100ms | 查询受影响测试 |
| **内存占用** | < 200MB | 运行完整系统 |

---

### 质量验收

#### 代码质量
- [ ] TypeScript 类型覆盖 > 95%
- [ ] ESLint 无错误
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试覆盖核心流程

#### 用户体验
- [ ] 错误信息清晰易懂
- [ ] 进度显示实时更新
- [ ] 输出格式美观易读
- [ ] 响应速度符合预期

#### 文档完整性
- [ ] README 包含快速开始
- [ ] 每个 Tool 有使用示例
- [ ] 每个 Agent 有说明文档
- [ ] 架构设计文档完整
- [ ] API 文档完整

---

## 成功指标（KPI）

### 核心指标

| 指标 | 目标 | 测量方法 |
|------|------|---------|
| **测试覆盖率提升** | +20% | 使用前后对比 |
| **测试编写时间减少** | -50% | 人工 vs AI 生成 |
| **测试调试时间减少** | -40% | 自愈前后对比 |
| **测试盲区发现** | 80% | 人工审查准确率 |
| **自动修复成功率** | 60% | 修复成功次数 / 总失败次数 |

### 用户满意度

| 维度 | 目标 | 测量方法 |
|------|------|---------|
| **易用性** | 4.5/5 | 用户调研 |
| **准确性** | 4.0/5 | 用户调研 |
| **性能** | 4.5/5 | 用户调研 |
| **整体满意度** | 4.5/5 | 用户调研 |

---

## 风险管理

### 技术风险

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| **SQLite 性能不足** | 低 | 中 | 优化索引、缓存；必要时升级到 Memgraph |
| **LSPTool 分析不准** | 中 | 中 | 补充 tree-sitter；人工审查关键路径 |
| **Agent 生成质量低** | 中 | 高 | 优化提示词；增加 Reviewer 审查 |
| **自愈成功率低** | 中 | 中 | 扩充修复策略；记录失败模式 |
| **性能不达标** | 低 | 中 | 并行优化；缓存优化；异步处理 |

### 进度风险

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| **开发延期** | 中 | 中 | 优先实现核心功能；砍掉非必要功能 |
| **集成困难** | 低 | 高 | 早期集成测试；模块化设计 |
| **需求变更** | 中 | 中 | 敏捷迭代；保持架构灵活性 |

---

## 后续扩展计划

### Phase 6: 高级功能（可选）

#### 6.1 升级到完整 GraphRAG
- 集成 Memgraph
- 实现复杂图查询
- 可视化依赖关系

#### 6.2 变异测试
- AI 生成语义化变异
- 运行变异测试
- 生成测试质量报告

#### 6.3 性能测试支持
- 集成性能测试工具
- 性能回归检测
- 性能优化建议

#### 6.4 E2E 测试支持
- 集成 Playwright/Cypress
- 自动生成 E2E 测试
- 视觉回归测试

#### 6.5 CI/CD 集成
- GitHub Actions 集成
- GitLab CI 集成
- 自动化测试报告

---

## 附录

### A. 依赖安装

```bash
# 核心依赖
bun add better-sqlite3
bun add @types/better-sqlite3 -D

# 覆盖率工具（按需安装）
bun add c8 -D              # JavaScript/TypeScript
bun add nyc -D             # JavaScript/TypeScript (备选)
pip install coverage       # Python
# Go 自带 go test -cover
```

### B. 配置示例

```json
// .claude/settings.json
{
  "test": {
    "memory": {
      "enabled": true,
      "maxHistorySize": 10000,
      "retentionDays": 90
    },
    "coverage": {
      "enabled": true,
      "threshold": 80,
      "tools": {
        "javascript": "c8",
        "python": "coverage"
      }
    },
    "multiAgent": {
      "enabled": true,
      "maxParallel": 3,
      "timeout": 60000
    },
    "selfHealing": {
      "enabled": true,
      "maxRetries": 3,
      "strategies": ["environment", "test-code"]
    },
    "discovery": {
      "enabled": true,
      "autoScan": false,
      "minComplexity": 10
    },
    "graph": {
      "enabled": true,
      "dbPath": ".claude/test-graph.db",
      "autoUpdate": true
    }
  }
}
```

### C. 使用示例

```typescript
// 1. 记录测试历史
await TestMemoryTool.call({
  operation: 'record',
  testName: 'test_login_success',
  result: 'pass',
  executionTime: 125
});

// 2. 分析覆盖率
await TestCoverageTool.call({
  operation: 'run'
});

// 3. 生成测试
const orchestrator = new TestOrchestrator();
await orchestrator.generateTests('为 login 功能生成测试');

// 4. 自愈测试
const healer = new ReActEngine();
await healer.healTest('test_login_fail', error);

// 5. 发现盲区
await TestDiscoveryTool.call({
  mode: 'coverage-based'
});

// 6. 分析影响
await TestGraphTool.call({
  operation: 'findAffectedTests',
  functionName: 'authenticateUser'
});
```

---

**文档版本**: v2.0  
**最后更新**: 2026-04-03  
**作者**: AI Test Enhancement Team  
**状态**: 实施规划
