# 故障排查指南

本文档记录开发过程中遇到的核心技术难题和解决方案。

---

## Week 1-2: 基础工具开发

### 问题：LSPTool 符号查询失败

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
