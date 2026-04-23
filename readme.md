# Claude Code Test Self-Healing System

基于 Claude Code 魔改的 **AI 驱动测试自愈系统**。在原有 CLI 交互式 AI 编程助手的基础上，自研了一套完整的多 Agent 测试生成、自愈、发现流水线。

## 核心能力

- **测试自愈 (ReAct)** — 自动诊断测试失败，匹配历史修复模式，多轮推理修复
- **多 Agent 编排** — Test Architect / Unit Engineer / Integration Engineer / Reviewer 协同生成测试
- **代码关系图谱** — SQLite 存储函数调用链、类继承/多态关系、测试覆盖率
- **测试盲区发现** — 覆盖率扫描 + 复杂度分析 + 历史风险聚合
- **变更影响分析** — 递归 CTE 追踪代码变更对测试的传播影响

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Bun >= 1.3.11 |
| 语言 | TypeScript + TSX |
| UI | Ink (React for CLI) |
| 数据库 | SQLite (bun:sqlite) |
| AI API | Anthropic Claude API (兼容第三方代理) |
| 校验 | Zod v4 |
| 存储 | JSONL + JSON + SQLite |

## 目录结构

```
my_test/
├── bin/claude-haha              # 启动入口 (Bash)
├── src/
│   ├── entrypoints/cli.tsx      # 主入口：Ink TUI 交互界面
│   ├── tools/                   # 51 个工具目录
│   │   ├── SimpleTestTool/      # [自研] 回显测试工具
│   │   ├── TestMemoryTool/      # [自研] 测试记忆/历史 (JSONL + JSON)
│   │   ├── TestCoverageTool/    # [自研] 覆盖率分析 (多语言)
│   │   ├── TestGraphTool/       # [自研] 代码关系图谱 (SQLite)
│   │   ├── TestHealingTool/     # [自研] 测试自愈 (ReAct)
│   │   ├── TestOrchestratorTool/# [自研] 多 Agent 编排
│   │   ├── TestDiscoveryTool/   # [自研] 测试盲区发现
│   │   └── ... (44 个原有工具)
│   └── services/
│       ├── testHealing/         # ReAct 引擎 + 修复策略 + 执行器
│       ├── testOrchestration/   # 编排器 + Agent 运行器
│       └── codeAnalysis/        # 影响分析 + 调用图 + 缓存
├── test/                        # 默认工作目录
├── start.sh                     # 一键启动
└── start-debug.sh               # 调试启动
```

## 自研工具

### TestMemoryTool — 测试记忆

记录测试执行历史，聚合统计数据和失败模式。

- **存储**: `{cwd}/.claude/test-memory/`
  - `test-history.jsonl` — 逐条测试记录
  - `test-statistics.json` — 聚合统计（通过率、平均耗时）
  - `failure-patterns.json` — 错误签名聚合
  - `fix-patterns.json` — ReAct 学到的成功修复模式（持久化）
- **操作**: `record` / `query` / `statistics` / `patterns` / `cleanup`

### TestGraphTool — 代码关系图谱

SQLite 存储函数关系图、类继承链、测试覆盖率、Git 变更影响。

- **存储**: `{cwd}/.claude/test-graph/graph.db`
- **7 张表**: `classes` / `class_inherits` / `functions` / `function_calls` / `test_coverage` / `git_changes` / `affected_functions`
- **多态支持**: `functions.class_id` / `is_virtual` / `overrides_id` 字段，CHA 虚调用展开
- **操作**: `buildCallGraph` / `incrementalUpdate` / `analyzeImpact` / `findAffectedTests` / `findUncoveredFunctions` / `detectChanges` 等 11 种

### TestHealingTool — 测试自愈 (ReAct)

基于 ReAct (Reasoning + Acting) 模式的测试失败自动诊断与修复。

- **支持语言**: C / Python / Java / Go / Rust
- **失败分类**: environment / test-code / source-code / unknown
- **修复策略**: 5 语言 × 4 类型 = 20 组策略
- **学习机制**: 成功修复模式持久化到 `fix-patterns.json`，跨会话复用
- **操作**: `heal` / `classify` / `execute` / `report` / `strategies` / `statistics`

### TestOrchestratorTool — 多 Agent 编排

协调多个 AI Agent 生成高质量测试，含"生成 → 审查 → 重生成"循环。

- **Phase 1**: Test Architect 制定策略
- **Phase 2**: Unit/Integration Engineer 并行生成测试
- **Phase 3**: Test Reviewer 审查（评分 < 80 则重生成，最多 3 轮）
- **Phase 4**: 编译运行验证

### TestDiscoveryTool — 测试盲区发现

三种扫描模式定位未测试代码：

- **coverage** — 解析覆盖率报告，找出未覆盖的函数和行
- **complexity** — 扫描源码，标记高圈复杂度且无测试的函数
- **history** — 聚合历史失败数据，识别高风险区域

### TestCoverageTool — 覆盖率分析

检测项目语言，推荐覆盖率工具，解析报告，生成热力图。支持 JS/TS/Python/Go/Java/C/Rust。

## 存储架构

| 存储 | 文件 | 用途 |
|------|------|------|
| JSONL | `test-history.jsonl` | 测试执行流水日志，逐条追加 |
| JSON | `test-statistics.json` | 按测试名聚合的统计快照 |
| JSON | `failure-patterns.json` | 按错误签名聚合的失败模式 |
| JSON | `fix-patterns.json` | ReAct 学到的成功修复模式 |
| SQLite | `graph.db` | 函数/类/调用/覆盖/变更 关系图 |

## 快速开始

```bash
# 1. 安装依赖
bun install

# 2. 配置 .env
cp .env.example .env
# 编辑 ANTHROPIC_AUTH_TOKEN 等

# 3. 启动
./start.sh          # 正常启动（工作目录 test/）
./start-debug.sh    # 调试模式
```

## 环境配置 (.env)

```bash
ANTHROPIC_AUTH_TOKEN=your-token-here
ANTHROPIC_BASE_URL=https://api.qnaigc.com
ANTHROPIC_MODEL=claude-sonnet-4-6
API_TIMEOUT_MS=60000
```

## 许可证

本项目仅供学习和研究使用。