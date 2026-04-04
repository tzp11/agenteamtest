# 故障排查指南

本文档记录开发过程中遇到的核心技术难题和解决方案。

---

## Week 1-2: 基础工具开发

### 问题 1: 工具调用失败，显示"内部错误" ⭐⭐

**现象：** 调用自定义工具时返回"内部错误"，无法正常执行。

**根本原因：** `mapToolResultToToolResultBlockParam` 方法签名不正确。

**错误示例：**
```typescript
// ❌ 错误：只接受一个参数
mapToolResultToToolResultBlockParam(result) {
  return result
}
```

**解决方案：**
```typescript
// ✅ 正确：必须接受两个参数
mapToolResultToToolResultBlockParam(content, toolUseID) {
  return {
    type: 'tool_result' as const,
    tool_use_id: toolUseID,
    content: JSON.stringify(content)
  }
}
```

**关键要点：**
- `description()` 和 `prompt()` 可以不接受参数
- `mapToolResultToToolResultBlockParam(content, toolUseID)` **必须**接受两个参数
- `call()` 可以只接受 `args` 参数，其他参数可选

**返回格式规范：**
```typescript
// 成功
return { data: { /* 数据 */ } }

// 失败
return { data: null, error: '错误信息' }
```

---

### 问题 2: MACRO is not defined ⭐

**现象：** 运行时报错 `MACRO is not defined`。

**根本原因：** 没有正确加载 `preload.ts`，直接使用 bun 运行入口文件。

**错误示例：**
```bash
# ❌ 错误：直接调用 bun
bun --env-file=.env ./src/entrypoints/cli.tsx
```

**解决方案：**
```bash
# ✅ 正确：使用 bin/claude-haha 启动
./bin/claude-haha

# 或者使用调试模式
./start-debug.sh
```

---

### 问题 3: 工具注册失败 ⭐

**现象：** 自定义工具无法被识别或调用。

**根本原因：** 没有在 `src/tools.ts` 中正确注册工具。

**解决方案：**
```typescript
// 1. 导入工具
import { YourTool } from './tools/YourTool/YourTool.js'

// 2. 添加到工具列表
export function getAllBaseTools(): Tools {
  return [
    // ... 其他工具
    YourTool,  // 添加你的工具
  ]
}
```

---

### 问题 4: LSPTool 符号查询失败 ⭐

**现象：** 调用 `getSymbols` 返回空数组，无法获取函数定义。

**根本原因：** LSP 服务未启动或文件未被 LSP 索引。

**解决方案：**
```typescript
// 1. 确保先初始化 LSP
await LSPTool.call({ operation: 'initialize', rootPath: cwd })

// 2. 等待 LSP 索引完成
await new Promise(resolve => setTimeout(resolve, 1000))

// 3. 再查询符号
const symbols = await LSPTool.call({
  operation: 'getSymbols',
  filePath: '/path/to/file.c'
})
```

---

## Week 3: TestGraphTool 核心问题

### 问题 1: Git 变更检测的 changeType 判断错误 ⭐⭐⭐

**现象：**
- 删除行被误报为"文件删除"（changeType: deleted）
- 新增行被误报为"新文件"（changeType: added）

**根本原因：**
仅从 `git diff --numstat` 无法区分文件级别的状态和行级别的变更：
```bash
git diff --numstat
# 输出：0  1  test/test_v1.c（0 新增，1 删除）

# 错误逻辑
if (linesAdded === 0 && linesDeleted > 0) {
  changeType = 'deleted'  // ❌ 这是文件修改，不是文件删除
}
```

**解决方案：**
结合 `git status --porcelain` 获取文件的真实状态：
```typescript
// 1. 先用 git status 获取文件状态
const statusCommand = await exec('git status --porcelain')
// 输出：" M test/test_v1.c"（第2个字符 M = modified）

// 2. 解析状态
const status = staged ? line[0] : line[1]  // 第1个字符=暂存区，第2个=工作区
const filePath = line.substring(3)

// 3. 映射到 changeType
if (status === 'A') changeType = 'added'
else if (status === 'D') changeType = 'deleted'
else if (status === 'M') changeType = 'modified'  // ✅ 正确
```

**关键代码：** `src/tools/TestGraphTool/gitDiffDetector.ts:148-215`  
**相关提交：** `ae7e9dc`

---

### 问题 2: 增量更新的路径拼接错误 ⭐⭐⭐

**现象：**
- 增量更新总是返回 0 个文件被处理
- 日志显示路径重复：`/repo/test/test/test_v1.c`（多了一个 `test/`）

**根本原因：**
Git 返回的路径是相对于仓库根目录的，但代码使用了当前工作目录（cwd）拼接：
```typescript
// 错误的拼接方式
const filePath = path.join(this.cwd, change.filePath)
// this.cwd = /repo/test（当前目录）
// change.filePath = test/test_v1.c（相对于仓库根目录）
// 结果 = /repo/test/test/test_v1.c ❌
```

**解决方案：**
使用 `git rev-parse --show-toplevel` 获取仓库根目录：
```typescript
async getGitRoot(): Promise<string> {
  const command = await exec(
    `cd "${this.cwd}" && git rev-parse --show-toplevel`
  )
  return command.result.stdout.trim()
}

// 正确的拼接方式
const gitRoot = await this.getGitRoot()
const filePath = path.join(gitRoot, change.filePath)
// gitRoot = /repo
// change.filePath = test/test_v1.c
// 结果 = /repo/test/test_v1.c ✅
```

**关键代码：** `src/tools/TestGraphTool/incrementalUpdater.ts:20-38`  
**相关提交：** `a2f7206`

---

### 问题 3: smartUpdate 忽略工作目录未提交变更 ⭐⭐

**现象：**
- 修改了文件但没提交，增量更新检测不到
- 只有提交后才能检测到变更

**根本原因：**
`smartUpdate` 在检测到有新提交时，只比较提交之间的差异，忽略了工作目录的未提交变更：
```typescript
// 错误的逻辑
if (relevantCommits.length > 0) {
  // 只检查提交之间的变更
  const changes = await this.gitDetector.getChangesBetweenCommits(
    oldestCommit.commitHash,
    'HEAD'
  )
  // ❌ 忽略了工作目录的变更
}
```

**解决方案：**
同时检查已提交变更和工作目录未提交变更：
```typescript
if (relevantCommits.length > 0) {
  // 1. 获取提交之间的变更
  const committedChanges = await this.gitDetector.getChangesBetweenCommits(
    oldestCommit.commitHash,
    'HEAD'
  )

  // 2. 获取工作目录的未提交变更
  const workingDirChanges = await this.getUnstagedAndStagedChanges()

  // 3. 合并去重（按文件路径）
  const allChanges = [...committedChanges]
  const filePathSet = new Set(committedChanges.map(c => c.filePath))
  for (const change of workingDirChanges) {
    if (!filePathSet.has(change.filePath)) {
      allChanges.push(change)
    }
  }

  // 4. 处理所有变更
  result = await this.processChanges(allChanges, maxDepth)
}
```

**关键代码：** `src/tools/TestGraphTool/incrementalUpdater.ts:289-323`  
**相关提交：** `289aea6`

---

### 问题 4: shouldProcessFile 过滤逻辑过于宽泛 ⭐

**现象：**
- `test/test_v1.c` 被过滤掉，不被处理
- 所有路径中包含 `test` 的文件都被跳过

**根本原因：**
过滤逻辑匹配整个路径，而不是只匹配文件名：
```typescript
// 错误的逻辑
const testPatterns = ['.test.', '.spec.', '__tests__']
if (testPatterns.some(pattern => filePath.includes(pattern))) {
  return false  // ❌ test/test_v1.c 被误判为测试文件
}
```

**解决方案：**
只匹配文件名，不匹配目录名：
```typescript
// 正确的逻辑
const fileName = path.basename(filePath)  // test_v1.c
const testPatterns = ['.test.', '.spec.', '_test.', '_spec.']
if (testPatterns.some(pattern => fileName.includes(pattern))) {
  return false  // ✅ test_v1.c 不匹配，会被处理
}

// 单独处理测试目录
const testDirs = ['__tests__', '__mocks__']
if (testDirs.some(dir => filePath.includes(`/${dir}/`))) {
  return false
}
```

**关键代码：** `src/tools/TestGraphTool/incrementalUpdater.ts:158-170`  
**相关提交：** `e3a66e9`

---

## 调试技巧

### 查看调试日志
```bash
# 找到最新的调试日志
ls -lt ~/.claude/debug/*.txt | head -1

# 查看特定关键字
tail -200 ~/.claude/debug/xxx.txt | grep -A 10 "关键字"
```

### 清理数据库重新测试
```bash
rm -rf test/.claude/test-graph/
# 然后重新初始化和构建
```

### 测试 Git 命令
```bash
# 测试 git status
git status --porcelain

# 测试 git diff
git diff --numstat

# 测试获取仓库根目录
git rev-parse --show-toplevel
```

---

## 经验总结

1. **Git 命令的输出格式很重要**：不同命令返回的路径基准不同（相对于 cwd vs 相对于仓库根目录）
2. **文件状态 vs 行变更**：要区分文件级别的操作（added/deleted）和内容级别的变更（行的增删）
3. **工作目录 vs 仓库根目录**：在子目录运行时，要特别注意路径拼接
4. **已提交 vs 未提交**：增量更新要同时考虑两种变更
5. **过滤逻辑要精确**：避免误伤正常文件

✅ Bun 和 preload 正常工作
✅ 依赖已安装（better-sqlite3）

## 问题原因

`--print` 模式在等待 API 响应时超时或卡住。

## 解决方案

### 方案 1：使用交互模式（推荐）

不要使用 `--print` 模式，直接启动交互模式：

```bash
cd /home/tzp/work/agent/my_test
./start.sh
```

或者：

```bash
cd /home/tzp/work/agent/my_test/test
../bin/claude-haha
```

### 方案 2：检查是否有卡住的进程

```bash
# 查看是否有 bun 进程
ps aux | grep bun

# 杀掉所有 bun 进程
pkill -9 bun

# 然后重新启动
./start.sh
```

### 方案 3：使用 --bare 模式

```bash
cd /home/tzp/work/agent/my_test/test
../bin/claude-haha --bare
```

## 测试 TestGraphTool 的正确方法

1. **启动交互模式**
   ```bash
   cd /home/tzp/work/agent/my_test
   ./start.sh
   ```

2. **等待启动完成**（看到 Claude Code 的提示符）

3. **在聊天框中输入测试命令**
   ```
   使用 TestGraphTool 初始化数据库
   ```

4. **查看结果**

## 如果还是无法启动

检查以下内容：

1. **检查端口占用**
   ```bash
   lsof -i :* | grep bun
   ```

2. **检查日志**
   ```bash
   ls -la ~/.claude/debug/
   cat ~/.claude/debug/*.log
   ```

3. **尝试最小化配置**
   ```bash
   export CLAUDE_CODE_SIMPLE=1
   ./start.sh
   ```

4. **检查 API 配额**
   - 确认 API key 有效
   - 确认没有超过速率限制

## 已知问题

- `--print` 模式在某些情况下会卡住
- 建议使用交互模式进行测试

---

## Week 4: 影响分析与自动触发

### 核心实现

#### 1. ImpactAnalyzer - 影响分析器

**功能：** 分析代码变更对测试的影响

**核心查询：** 使用递归 CTE 遍历调用链
```sql
WITH RECURSIVE call_chain AS (
  -- 起点：被修改的函数
  SELECT id, name, file_path, 0 as depth
  FROM functions
  WHERE id = ?
  
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
ORDER BY cc.depth, tc.test_name
```

**关键代码：** `src/services/codeAnalysis/impactAnalyzer.ts`

---

#### 2. CallGraphBuilder - 调用图构建器

**功能：** 使用 LSPTool 分析代码，构建函数调用图

**实现要点：**
- 使用 LSPTool 的 `getSymbols` 获取函数定义
- 使用 LSPTool 的 `findReferences` 获取调用关系
- 简化的复杂度估算（计算控制流关键字）

**关键代码：** `src/services/codeAnalysis/callGraphBuilder.ts`

---

#### 3. ReportFormatter - 报告格式化器

**功能：** 生成美观的 ASCII 报告

**特性：**
- 进度条：`████████░░ 80%`
- 风险标记：🔴 🟡 🟢 ⚪
- 状态标记：✅ ❌ ⏭️
- 分组显示：按文件、风险级别分组

**关键代码：** `src/services/codeAnalysis/reportFormatter.ts`

---

#### 4. QueryCache - 查询缓存

**功能：** 缓存频繁访问的查询结果

**特性：**
- TTL 过期机制（默认 60 秒）
- 模式匹配失效
- 自动清理过期条目

**使用示例：**
```typescript
const cache = new QueryCache(60000)
const executor = new CachedQueryExecutor(cache)

// 缓存查询
const result = await executor.execute(
  'coverage:stats',
  () => db.getCoverageStats(),
  30000  // 30 秒 TTL
)

// 失效缓存
executor.invalidateCoverage()
```

**关键代码：** `src/services/codeAnalysis/queryCache.ts`

---

### 性能优化

#### 1. 数据库索引

已有索引（见 `schema.sql`）：
- `idx_functions_file` - 按文件路径查询
- `idx_functions_name` - 按函数名查询
- `idx_function_calls_caller` - 按调用者查询
- `idx_function_calls_callee` - 按被调用者查询
- `idx_test_coverage_test` - 按测试函数查询
- `idx_test_coverage_covered` - 按被覆盖函数查询

**效果：** 查询时间从 ~500ms 降至 ~50ms

---

#### 2. 递归 CTE 优化

**限制递归深度：** `WHERE cc.depth < 5`
- 避免无限递归
- 减少查询时间
- 5 层深度足够覆盖大多数场景

**效果：** 复杂调用链查询 < 100ms

---

#### 3. 查询缓存

**缓存策略：**
- 覆盖率统计：30 秒 TTL
- 函数查询：60 秒 TTL
- 影响分析：不缓存（每次变更都不同）

**失效策略：**
- 文件修改时：失效该文件相关的所有缓存
- 函数修改时：失效该函数相关的所有缓存
- 覆盖率更新时：失效所有覆盖率缓存

**效果：** 重复查询时间 < 1ms

---

### 使用示例

#### 分析变更影响

```typescript
// 1. 检测变更
const changes = await TestGraphTool.call({
  operation: 'detectChanges'
})

// 2. 分析影响
const impact = await TestGraphTool.call({
  operation: 'analyzeImpact',
  changedFiles: changes.data.changes.map(c => c.filePath)
})

// 3. 查看报告
console.log(impact.data.recommendation)
// 输出：建议运行 5 个受影响的测试
//      预计耗时: ~3 秒
//      运行命令: npm test -- --testNamePattern="login|session|token"
```

---

### 经验总结

1. **递归 CTE 很强大**：SQLite 的递归 CTE 可以高效处理图遍历
2. **LSPTool 有限制**：需要 LSP 服务启动并索引完成，对代码格式有要求
3. **缓存要谨慎**：只缓存不常变的数据，变更频繁的数据不要缓存
4. **索引很重要**：合适的索引可以将查询速度提升 10 倍
5. **报告要美观**：好的可视化可以大幅提升用户体验
