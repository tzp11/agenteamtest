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

### 问题 1: 数据库私有属性访问失败 ⭐⭐⭐

**现象：** 调用 `analyzeImpact` 操作时，工具静默失败，没有返回任何结果。

**根本原因：** 尝试访问 `TestGraphDatabase` 的私有属性 `db`。

**错误示例：**
```typescript
// ❌ 错误：访问私有属性
const analyzer = new ImpactAnalyzer(db['db'], cwd)
// db 是 TestGraphDatabase 实例
// db.db 是 private 属性，无法访问
```

**解决方案：**
```typescript
// 1. 在 database.ts 中添加 getter 方法
export class TestGraphDatabase {
  private db: Database
  
  getDatabase(): Database {
    return this.db
  }
}

// 2. 使用 getter 方法
const analyzer = new ImpactAnalyzer(db.getDatabase(), cwd)  // ✅
```

**关键要点：**
- TypeScript 的 `private` 属性无法通过 `obj['prop']` 访问
- 需要提供公共的 getter 方法
- 这类错误会导致运行时异常，但不会有编译错误

**关键代码：** `src/tools/TestGraphTool/database.ts:70-73`

---

### 问题 2: SQL 查询字段名与 Schema 不匹配 ⭐⭐⭐

**现象：** `findAffectedTests` 查询卡住或返回空结果。

**根本原因：** `test_coverage` 表只存储 ID，不存储测试名称和文件路径。

**错误示例：**
```sql
-- ❌ 错误：test_coverage 表没有这些字段
SELECT 
  tc.test_name,      -- 不存在
  tc.test_file,      -- 不存在
  tc.function_id,
  tc.status          -- 不存在
FROM test_coverage tc
```

**正确的 Schema：**
```sql
CREATE TABLE test_coverage (
  id INTEGER PRIMARY KEY,
  test_function_id INTEGER NOT NULL,     -- 测试函数的 ID
  covered_function_id INTEGER NOT NULL,  -- 被覆盖函数的 ID
  coverage_type TEXT,
  call_depth INTEGER,
  -- 没有 test_name, test_file, status 字段！
);
```

**解决方案：**
```sql
-- ✅ 正确：JOIN functions 表获取名称和路径
SELECT DISTINCT
  test_func.name as testName,
  test_func.file_path as testFile,
  cc.name as affectedFunction,
  cc.depth as callDepth
FROM test_coverage tc
JOIN call_chain cc ON tc.covered_function_id = cc.id
JOIN functions test_func ON tc.test_function_id = test_func.id
ORDER BY cc.depth, test_func.name
```

**关键要点：**
- 仔细检查数据库 Schema，不要假设字段存在
- 关联表通常只存储 ID，需要 JOIN 获取详细信息
- SQL 字段名错误会导致查询卡住或返回空结果

**关键代码：** `src/services/codeAnalysis/impactAnalyzer.ts:95-120`

---

### 问题 3: 路径匹配不灵活导致查询失败 ⭐⭐

**现象：** 调用 `analyzeImpact` 时传入 `src/auth.c`，但返回 0 个受影响函数。

**根本原因：** 只支持精确路径匹配，但数据库存储的是完整路径。

**错误示例：**
```typescript
// 用户输入：src/auth.c
// 数据库存储：/home/tzp/work/agent/my_test/test/src/auth.c
// 精确匹配失败 ❌

const stmt = this.db.prepare(`
  SELECT * FROM functions WHERE file_path = ?
`)
stmt.all('src/auth.c')  // 返回空数组
```

**解决方案：**
```typescript
private getFunctionsInFile(filePath: string): FunctionInfo[] {
  // 1. 尝试精确匹配
  let stmt = this.db.prepare(`
    SELECT * FROM functions WHERE file_path = ?
  `)
  let results = stmt.all(filePath)
  if (results.length > 0) return results

  // 2. 尝试后缀匹配（src/auth.c 匹配 /path/to/src/auth.c）
  stmt = this.db.prepare(`
    SELECT * FROM functions WHERE file_path LIKE '%' || ?
  `)
  results = stmt.all(filePath)
  if (results.length > 0) return results

  // 3. 尝试文件名匹配（auth.c 匹配任何包含 auth.c 的路径）
  const basename = filePath.split('/').pop() || filePath
  stmt = this.db.prepare(`
    SELECT * FROM functions WHERE file_path LIKE '%' || ?
  `)
  return stmt.all(basename)
}
```

**关键要点：**
- 路径可能是相对路径、绝对路径或文件名
- 使用多级匹配策略：精确 → 后缀 → 文件名
- SQL 的 `LIKE '%' || ?` 可以实现后缀匹配

**关键代码：** `src/services/codeAnalysis/impactAnalyzer.ts:70-93`

---

### 问题 4: 工具静默失败，没有错误信息 ⭐⭐

**现象：** 调用工具后没有任何返回，也没有错误信息，用户不知道发生了什么。

**根本原因：** 工具内部抛出异常，但没有被捕获和返回给用户。

**参考：** Week 1-2 问题 1 - 工具调用失败，显示"内部错误"

**错误示例：**
```typescript
case 'analyzeImpact': {
  // 如果这里抛出异常，用户看不到任何错误
  const analyzer = new ImpactAnalyzer(db.getDatabase(), cwd)
  const impact = await analyzer.analyzeImpact(args.changedFiles)
  return { data: impact }
}
```

**解决方案：**
```typescript
case 'analyzeImpact': {
  console.log('[DEBUG] analyzeImpact operation started')
  console.log('[DEBUG] args:', JSON.stringify(args))

  try {
    const analyzer = new ImpactAnalyzer(db.getDatabase(), cwd)
    const impact = await analyzer.analyzeImpact(args.changedFiles)
    console.log('[DEBUG] analyzeImpact completed')
    
    return { data: impact }
  } catch (error) {
    console.error('[DEBUG] analyzeImpact error:', error)
    return {
      data: null,
      error: `Failed to analyze impact: ${error.message}`
    }
  }
}
```

**关键要点：**
- 所有工具操作都应该用 try-catch 包裹
- 添加详细的调试日志（console.log）
- 错误信息要返回给用户，不要静默失败
- 参考 Week 1-2 的经验教训

**关键代码：** `src/tools/TestGraphTool/TestGraphTool.ts:362-394`

---

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

### Week 4 核心教训

1. **私有属性无法访问** - TypeScript 的 `private` 在运行时也会生效，需要提供 getter
2. **Schema 要熟悉** - 写 SQL 前先查看表结构，不要假设字段存在
3. **路径匹配要灵活** - 支持多种路径格式（相对/绝对/文件名）
4. **异常要捕获** - 参考 Week 1-2 经验，所有操作都要 try-catch
5. **日志要详细** - 添加 console.log 帮助调试，尤其是在工具静默失败时

### 调试技巧

**查看 TestGraphTool 调试日志：**
```bash
tail -100 ~/.claude/debug/*.txt | grep "DEBUG.*TestGraph\|DEBUG.*Impact"
```

**查看数据库内容：**
```bash
cd test
/home/tzp/.bun/bin/bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.claude/test-graph/graph.db');
const rows = db.query('SELECT name, file_path FROM functions LIMIT 10').all();
rows.forEach(r => console.log(\`\${r.name} - \${r.file_path}\`));
db.close();
"
```

**测试路径匹配：**
```bash
# 使用完整路径
使用 TestGraphTool 分析影响，变更文件为 /home/tzp/work/agent/my_test/test/src/auth.c

# 使用相对路径（如果在 test/ 目录下）
使用 TestGraphTool 分析影响，变更文件为 src/auth.c
```

---

## Week 5: Multi-Agent 测试协同 - Agent 定义

### 概述

Week 5 的目标是创建 5 个专业测试 Agent 的定义文件，为 Week 6 的 Agent 编排系统做准备。

### 完成情况

**完成度：100% ✅**

**交付物：**
- ✅ `.claude/agents/test-architect.md` - 测试架构师 Agent
- ✅ `.claude/agents/unit-test-engineer.md` - 单元测试工程师 Agent
- ✅ `.claude/agents/integration-test-engineer.md` - 集成测试工程师 Agent
- ✅ `.claude/agents/test-reviewer.md` - 测试审查员 Agent
- ✅ `.claude/agents/test-diagnostician.md` - 测试诊断专家 Agent

### Agent 设计要点

#### 1. Test Architect Agent（测试架构师）
- **模型**：Sonnet（需要深度分析能力）
- **职责**：分析代码结构，制定测试策略
- **核心能力**：
  - 使用 TestGraphTool 理解代码关系
  - 使用 TestCoverageTool 识别覆盖盲区
  - 基于复杂度和风险优先级排序
  - 输出结构化测试计划

#### 2. Unit Test Engineer Agent（单元测试工程师）
- **模型**：Haiku（快速生成大量用例）
- **职责**：生成细粒度单元测试
- **核心能力**：
  - 覆盖所有代码分支（if/else、switch、循环）
  - 测试边界条件（null、empty、0、max）
  - 使用 Mock 隔离依赖
  - 遵循 AAA 模式（Arrange-Act-Assert）
- **支持语言**：JavaScript/TypeScript (Jest)、Python (pytest)、C (Unity)

#### 3. Integration Test Engineer Agent（集成测试工程师）
- **模型**：Sonnet（需要理解复杂交互）
- **职责**：测试模块间交互和数据流
- **核心能力**：
  - 测试 API 端点和契约
  - 测试数据库集成
  - 测试事务一致性和并发
  - 测试错误传播
- **测试类型**：API 测试、数据库测试、服务集成测试、事件驱动测试

#### 4. Test Reviewer Agent（测试审查员）
- **模型**：Opus（需要高质量审查）
- **职责**：审查测试代码质量
- **核心能力**：
  - 识别测试坏味道（Test Smells）
  - 检查测试覆盖完整性
  - 验证断言正确性
  - 评估测试可维护性
- **审查维度**：正确性、完整性、清晰度、可维护性、性能、隔离性

**常见测试坏味道：**
1. Assertion Roulette - 多个断言无清晰失败信息
2. Test Code Duplication - 重复的测试代码
3. Obscure Test - 难以理解的测试
4. Conditional Test Logic - 测试中包含 if/else
5. Fragile Test - 容易因小改动而失败
6. Mystery Guest - 依赖外部不可见数据
7. Slow Test - 运行时间过长

#### 5. Test Diagnostician Agent（测试诊断专家）
- **模型**：Sonnet（需要推理能力）
- **职责**：诊断测试失败原因
- **核心能力**：
  - 分析错误信息和堆栈跟踪
  - 分类失败类型（环境/测试代码/源代码/Flaky）
  - 提供具体修复建议
  - 学习历史失败模式

**失败分类：**
- **ENVIRONMENT**：服务未启动、端口占用、依赖缺失
- **TEST_CODE**：Mock 配置错误、断言错误、异步处理问题
- **SOURCE_CODE**：真正的代码 bug
- **FLAKY**：间歇性失败、时序问题、竞态条件

### Agent 协作流程设计

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

### 设计原则

1. **职责分离**：每个 Agent 专注于特定任务
2. **模型匹配**：根据任务复杂度选择合适的模型
3. **工具集成**：充分利用现有 Tool（TestGraphTool、TestMemoryTool 等）
4. **输出规范**：统一的输出格式，便于后续处理
5. **可扩展性**：易于添加新的 Agent 类型

### 与现有系统的集成

**利用现有工具：**
- TestGraphTool - 查询代码关系和覆盖率
- TestMemoryTool - 查询历史测试数据
- TestCoverageTool - 分析覆盖率
- LSPTool - 分析代码结构
- Read/Write/Edit - 读写文件
- Grep - 搜索代码模式

**为 Week 6 准备：**
- Agent 定义文件已就绪
- 输入输出格式已标准化
- 协作流程已设计
- 下一步：实现 TestOrchestrator 编排器

### 验收标准

- ✅ 5 个 Agent 定义文件已创建
- ✅ 每个 Agent 有清晰的职责说明
- ✅ 每个 Agent 有详细的工作流程
- ✅ 每个 Agent 有输出格式规范
- ✅ 每个 Agent 有使用示例
- ✅ Agent 之间的协作流程已设计

### 下一步（Week 6）

1. 实现 TestOrchestrator 服务
2. 实现 Agent 调度逻辑
3. 实现并行执行机制
4. 实现结果聚合
5. 实现审查循环
6. 集成到 Claude Code

### 常见问题与解决方案

#### 问题 1：Agent 调用失败 - "Agent type 'xxx' not found"

**现象：**
```
● test-reviewer(审查测试质量)
  Error: Agent type 'test-reviewer' not found. Available agents: 
  general-purpose, statusline-setup, claude-code-guide
```

**原因：**
1. 使用了错误的调用语法 `test-reviewer(...)`
2. 这种语法被解析为 `subagent_type` 参数
3. `subagent_type` 只支持内置 Agent（general-purpose, statusline-setup 等）
4. 自定义 Agent 不能用这种方式调用

**解决方案：**

✅ **正确的调用方式：**
```
使用 test-reviewer Agent 审查 test/tests/test_auth.c 的测试代码质量
```

❌ **错误的调用方式：**
```
test-reviewer(审查测试质量)  # 这会被解析为 subagent_type
```

**验证：**
```bash
# 检查 Agent 是否被加载
bun run verify-agents.ts
```

---

#### 问题 2：新创建的 Agent 不被识别

**现象：**
创建了 `.claude/agents/my-agent.md`，但 Claude Code 找不到这个 Agent。

**原因：**
Agent 定义在 Claude Code 启动时加载并缓存，新创建的文件不会自动加载。

**解决方案：**

**方案 1：重启 Claude Code（推荐）**
```bash
# 退出当前会话
exit

# 重新启动
./start.sh
```

**方案 2：清除缓存**
```bash
# 清除 Agent 缓存
rm -rf ~/.claude/cache/*
```

**方案 3：使用验证脚本检查**
```bash
# 运行验证脚本
bun run verify-agents.ts

# 如果显示 Agent 未加载，说明需要重启
```

---

#### 问题 3：Agent 文件无法提交到 Git

**现象：**
```bash
git add .claude/agents/*.md
# 错误：下列路径根据您的一个 .gitignore 文件而被忽略：.claude
```

**原因：**
`.claude` 目录在 `.gitignore` 中被忽略。

**解决方案：**

**使用 `-f` 强制添加：**
```bash
git add -f .claude/agents/*.md
```

**或者修改 .gitignore：**
```bash
# 在 .gitignore 中添加例外
.claude/*
!.claude/agents/
```

**注意：**
- Agent 定义文件应该提交到版本控制
- 但 `.claude/test-memory/` 等运行时数据不应提交

---

#### 问题 4：Agent frontmatter 格式错误

**现象：**
Agent 文件存在，但无法被加载，`verify-agents.ts` 显示解析错误。

**原因：**
frontmatter 格式不正确或缺少必需字段。

**正确的格式：**
```markdown
---
name: my-agent
description: My Agent - Does something useful
model: sonnet
---

# My Agent

Agent content here...
```

**必需字段：**
- `name`: Agent 类型名称（用于调用）
- `description`: Agent 描述（显示在列表中）
- `model`: 使用的模型（sonnet/opus/haiku/inherit）

**可选字段：**
- `tools`: 允许使用的工具列表
- `disallowedTools`: 禁止使用的工具列表
- `effort`: 努力程度（low/medium/high）
- `permissionMode`: 权限模式
- `background`: 是否后台运行

**验证格式：**
```bash
# 检查 frontmatter
head -10 .claude/agents/my-agent.md

# 运行验证脚本
./test-agents.sh
```

---

#### 问题 5：Agent 调用成功但没有使用预期的 Tool

**现象：**
Agent 被调用，但没有使用 TestGraphTool、TestMemoryTool 等工具。

**原因：**
1. Agent 定义中没有明确说明要使用哪些 Tool
2. Agent 的 prompt 不够具体
3. Tool 可能被 `disallowedTools` 禁用

**解决方案：**

**1. 在 Agent 定义中明确列出可用工具：**
```markdown
---
name: my-agent
description: My Agent
model: sonnet
---

# My Agent

## Available Tools

You have access to:
- **TestGraphTool**: Query code relationships
- **TestMemoryTool**: Review historical test data
- **Read**: Read source code
```

**2. 在 prompt 中明确要求使用工具：**
```
使用 test-architect Agent 分析 test/src/auth.c 的测试策略。
请使用 TestGraphTool 查询函数关系，使用 TestCoverageTool 分析覆盖率。
```

**3. 检查 tools 配置：**
```markdown
---
name: my-agent
tools: ['*']  # 允许所有工具
# 或者明确列出
tools: ['TestGraphTool', 'TestMemoryTool', 'Read', 'Grep']
---
```

---

#### 问题 6：Agent 输出格式不符合预期

**现象：**
Agent 输出的格式与 Agent 定义中的示例不一致。

**原因：**
1. Agent 定义中的输出格式示例不够清晰
2. 没有使用强制性的格式要求
3. 模型自由发挥

**解决方案：**

**在 Agent 定义中使用明确的格式要求：**
```markdown
## Output Format

**IMPORTANT**: Always structure your output as follows:

```
## Test Strategy for [Module]

### Priority 1: Critical Paths
- Function: `functionName` (file:line)
  - Complexity: X
  - Test types: Unit + Integration

### Priority 2: Important Functions
...
```

Use this exact format. Do not deviate.
```

**在调用时重申格式要求：**
```
使用 test-architect Agent 分析 auth.c，
输出必须包含：1) 优先级分类 2) 具体函数名和行号 3) 测试类型建议
```

---

### 调试技巧

**1. 查看 Agent 是否被加载：**
```bash
bun run verify-agents.ts
```

**2. 检查 Agent 定义格式：**
```bash
./test-agents.sh
```

**3. 测试 Agent 功能：**
```bash
# 使用简化的测试 prompts
cat SIMPLE_TEST_PROMPTS.md
```

**4. 查看 Claude Code 日志：**
```bash
tail -100 ~/.claude/debug/*.txt | grep -i agent
```

**5. 清除缓存重新加载：**
```bash
rm -rf ~/.claude/cache/*
# 重启 Claude Code
```

---

### 经验总结

1. **Agent 设计要具体**：不要只写"生成测试"，要详细说明如何生成、生成什么
2. **提供丰富示例**：好的示例胜过长篇说明
3. **考虑实际场景**：基于真实的测试问题设计 Agent 能力
4. **标准化输出**：统一的输出格式便于后续处理
5. **工具集成优先**：充分利用现有工具，避免重复造轮子
6. **调用语法要正确**：自定义 Agent 使用自然语言调用，不要用 `agent-name(...)` 语法
7. **修改后要重启**：修改 Agent 定义后需要重启 Claude Code
8. **格式要严格**：frontmatter 必须包含必需字段且格式正确
9. **测试要充分**：创建测试脚本和文档，方便验证和调试
10. **版本控制要注意**：Agent 定义文件要提交，但运行时数据不要提交

---

## Week 6: TestOrchestrator 多 Agent 编排

### 问题 1: 工具模块导入路径错误 ⭐⭐

**现象：** `Cannot find module '../Tool.js'`

**根本原因：** 导入路径相对于当前文件位置计算错误。

**解决方案：**
```typescript
// ❌ 错误：相对路径不正确
import { Tool } from '../Tool.js'

// ✅ 正确：使用正确的相对路径
import { Tool } from '../../Tool.js'
```

**关键文件：** `src/tools/TestOrchestratorTool/TestOrchestratorTool.ts`

---

### 问题 2: Agent 类型不被识别 ⭐⭐⭐

**现象：** `Agent type 'test-reviewer' not found`

**根本原因：** Agent 定义中缺少 `permissionMode: allow` 字段。

**解决方案：**
```yaml
---
name: unit-test-engineer
description: Unit Test Engineer Agent
model: haiku
permissionMode: allow  # 必须添加
---
```

**关键文件：** `.claude/agents/unit-test-engineer.md`, `.claude/agents/integration-test-engineer.md`

---

### 问题 3: Agent 未生成测试文件 ⭐⭐

**现象：** Agent 执行完成但没有创建测试文件。

**根本原因：** Agent prompt 中没有明确指定使用 Write 工具创建文件。

**解决方案：**
在 prompt 中明确告知：
```
**重要**：
- 必须使用 Write 工具创建实际的测试文件
- **只声明函数（extern），不要重新定义函数**
- **不要创建 Mock 函数，直接使用源文件中的函数**
```

---

### 问题 4: 审查循环分数提取失败 ⭐⭐⭐

**现象：** 审查返回的分数总是 0 或提取失败。

**根本原因：** 
1. reviewResult.data 是对象类型，需要提取 `.data.text` 字段
2. 需要处理多种分数格式（纯数字、"Score: 85" 等）

**解决方案：**
```typescript
// 正确提取审查分数
let reviewText = ''
if (typeof reviewResult.data === 'string') {
  reviewText = reviewResult.data
} else if (reviewResult.data?.data?.text) {
  reviewText = reviewResult.data.data.text  // 嵌套结构
} else if (reviewResult.data?.text) {
  reviewText = reviewResult.data.text
}

// 多种分数提取模式
const scorePatterns = [
  /score[:\s]+(\d+)/i,
  /评分[:\s]+(\d+)/i,
  /(\d+)\s*\/?\s*100/i,
  /(\d+)\s*分/i
]

for (const pattern of scorePatterns) {
  const match = reviewText.match(pattern)
  if (match) {
    score = parseInt(match[1], 10)
    break
  }
}
```

---

### 问题 5: 测试编译重复定义错误 ⭐⭐⭐

**现象：** `multiple definition of 'validate_password'`

**根本原因：** Agent 生成的测试代码中重新定义了函数，而不是使用 `extern` 声明。

**解决方案：**
明确告知 Agent 只使用 extern 声明：
```c
// ✅ 正确：只声明
extern int validate_password(const char* password);

// ❌ 错误：重新定义
int validate_password(const char* password) {
  // ...
}
```

---

### 问题 6: 审查迭代不工作 ⭐⭐

**现象：** 审查未通过时不会重新生成测试。

**根本原因：** 没有实现阈值判断和重试逻辑。

**解决方案：**
```typescript
const SCORE_THRESHOLD = 80
let maxAttempts = 3
let attempt = 0

while (attempt < maxAttempts) {
  const score = await extractReviewScore(reviewResult)
  
  if (score >= SCORE_THRESHOLD) {
    break  // 审查通过
  }
  
  // 审查不通过，重新生成
  generationResult = await runAgentWithFeedback(
    agentType,
    prompt,
    reviewFeedback
  )
  attempt++
}
```

---

### 核心实现要点

#### 1. AgentRunner - Agent 执行器
```typescript
class AgentRunner {
  async runAgent(
    agentType: string,
    prompt: string,
    context?: Record<string, unknown>
  ): Promise<AgentResult> {
    const result = await AgentTool.call({
      agentType,
      prompt,
      ...context
    })
    return this.parseAgentResult(result)
  }

  async runParallel(
    tasks: Array<{ agentType: string; prompt: string }>
  ): Promise<AgentResult[]> {
    return Promise.all(tasks.map(t => this.runAgent(t.agentType, t.prompt)))
  }
}
```

#### 2. ResultAggregator - 结果聚合
```typescript
class ResultAggregator {
  aggregate(results: AgentResult[]): AggregatedResult {
    return {
      allPassed: results.every(r => r.success),
      summary: this.generateSummary(results),
      details: results.map(r => r.data),
      suggestions: this.extractSuggestions(results)
    }
  }
}
```

#### 3. TestOrchestrator - 主编排器
```typescript
class TestOrchestrator {
  async generateTests(request: TestRequest): Promise<TestResult> {
    // 1. 策略规划
    const strategy = await this.planStrategy(request)
    
    // 2. 并行生成
    const generationResults = await this.runGenerationPhase(strategy)
    
    // 3. 审查循环
    const reviewResult = await this.runReviewPhase(generationResults)
    
    // 4. 编译运行
    return this.compileAndRun(reviewResult)
  }
}
```

---

### 调试技巧

**1. 查看 Agent 执行日志：**
```bash
tail -200 ~/.claude/debug/*.txt | grep -i "AgentTool\|test-orchestrator"
```

**2. 测试单个 Agent：**
```bash
使用 test-architect Agent 分析 src/auth.c 的测试策略
```

**3. 手动运行编排器：**
```bash
./test-week6-orchestrator.sh
```

**4. 检查工具是否注册：**
```bash
grep -n "TestOrchestratorTool" src/tools.ts
```

---

### 经验总结

1. **权限模式很重要** - Agent 定义必须包含 `permissionMode: allow`
2. **Prompt 要具体** - 明确告知使用什么工具、生成什么格式
3. **结果解析要健壮** - 处理多种返回格式（string/object）
4. **分数提取要全面** - 支持多种模式（中文/英文）
5. **迭代要有阈值** - 设定合理的审查阈值（80分）控制重试次数

---

## Week 7: ReAct 引擎 + 失败分类

### 问题 1: 工具模块导入路径错误 ⭐

**现象：** `Cannot find module '../Tool.js'`

**根本原因：** TestHealingTool 使用了旧的 `Tool` 基类导入方式。

**错误示例：**
```typescript
// ❌ 错误：从 Tool 基类继承
import { Tool } from '../Tool.js'
export class TestHealingTool extends Tool { ... }
```

**解决方案：**
```typescript
// ✅ 正确：使用 buildTool 工厂函数
import { buildTool, type ToolDef } from '../../Tool.js'
export const TestHealingTool: ToolDef = buildTool({ ... })
```

**关键要点：**
- 使用 `buildTool` 工厂函数而不是直接继承 `Tool`
- 必须实现 `description()` 和 `prompt()` 方法（异步函数）
- `mapToolResultToToolResultBlockParam` 必须接受两个参数

---

### 问题 2: TestMemoryTool 集成失败 ⭐⭐⭐

**现象：** ReActEngine 无法加载 TestMemoryTool 查询历史数据。

**根本原因：** 使用了不存在的 `Tool.fromName()` 方法。

**错误示例：**
```typescript
// ❌ 错误：Tool.fromName() 不存在
async function getTestMemoryTool() {
  const { Tool } = await import('../../index.js')
  testMemoryTool = Tool.fromName('TestMemoryTool')
  return testMemoryTool
}
```

**解决方案：**
```typescript
// ✅ 正确：直接 import Storage 类
import { TestMemoryStorage } from '../../tools/TestMemoryTool/storage.js'

function getTestStorage(): TestMemoryStorage {
  if (!testStorage) {
    testStorage = new TestMemoryStorage()
  }
  return testStorage
}

// 在 initialize 中使用
async initialize(): Promise<void> {
  const storage = getTestStorage()
  await this.loadFixPatterns(storage)
}
```

**关键要点：**
- 工具类通过 `buildTool` 创建，没有 `fromName` 方法
- 直接 import 底层存储类（TestMemoryStorage）而不是工具类
- TestMemoryStorage 是独立的，不依赖 Tool 基类

---

### 问题 3: 源代码错误分类不准确

**现象：** `at processPayment (src/payment.js:45)` 被分类为 UNKNOWN。

**根本原因：** 当前正则需要匹配 `throw.*new.*Error` 或 `catch.*block`，简单错误消息无法识别。

**示例：**
```typescript
// 输入
error: Error: something went wrong
stackTrace: at processPayment (src/payment.js:45)

// 输出
type: unknown (confidence: 0.3)
```

**临时解决方案：**
- 增加更多匹配模式
- 或使用堆栈跟踪中的文件路径判断（src/ vs test/）

---

### 问题 4: ReAct 循环不执行真正的测试

**现象：** ReActEngine 只生成修复建议，不实际运行测试验证。

**根本原因：** 当前实现是"诊断模式"，只分析错误并返回建议。

**代码说明：**
```typescript
// 当前实现
const observation = `执行修复: ${fixAction}`
step.success = false  // 永远 false，不验证

// Week 8 需要实现：
// 1. 实际修改测试文件
// 2. 运行测试验证
// 3. 检查分数
// 4. 循环直到通过或达到上限
```

---

### 经验总结

1. **工具定义方式** - 使用 `buildTool` 工厂函数，不是继承 `Tool`
2. **集成存储类** - 直接 import 底层类（如 TestMemoryStorage），不是工具类
3. **失败分类** - 依赖正则匹配，需要覆盖足够多的错误模式
4. **循环验证** - Week 7 只生成建议，真正的验证在 Week 8

---

## 下一阶段（Week 8: 修复策略 + 沙盒执行）

1. 实现环境问题修复（killPort、clearCache）
2. 实现测试代码修复（修改文件）
3. 集成 BashTool 执行系统命令
4. 实现真正的测试验证循环
5. 修复源代码错误分类问题
