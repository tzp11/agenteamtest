# 故障排查指南

## Week 3: TestGraphTool 核心问题

### 问题 1: Git 变更检测的 changeType 判断错误

**现象：**
- 删除行被误报为"文件删除"（changeType: deleted）
- 新增行被误报为"新文件"（changeType: added）
- 实际应该是"文件修改"（changeType: modified）

**根本原因：**
仅从 `git diff --numstat` 无法区分文件级别的状态和行级别的变更：
```bash
# git diff --numstat 输出
0  1  test/test_v1.c  # 0 新增，1 删除

# 原始错误逻辑
if (linesAdded === 0 && linesDeleted > 0) {
  changeType = 'deleted'  // ❌ 错误：这是文件修改，不是文件删除
}
```

**解决方案：**
结合 `git status --porcelain` 获取文件的真实状态：
```typescript
// 1. 先用 git status 获取文件状态
const statusCommand = await exec('git status --porcelain')
// 输出：" M test/test_v1.c"（M = modified）

// 2. 再用 git diff --numstat 获取行数变更
const diffCommand = await exec('git diff --numstat')

// 3. 结合两者判断
if (status === 'M') changeType = 'modified'  // ✅ 正确
```

**相关提交：** `ae7e9dc`

---

### 问题 2: 增量更新的路径拼接错误

**现象：**
- 增量更新总是返回 0 个文件被处理
- 日志显示路径重复：`/home/tzp/work/agent/my_test/test/test/test_v1.c`（多了一个 `test/`）

**根本原因：**
Git 返回的路径是相对于仓库根目录的，但代码使用了当前工作目录（cwd）拼接：
```typescript
// 错误的拼接方式
const filePath = path.join(this.cwd, change.filePath)
// this.cwd = /home/tzp/work/agent/my_test/test（当前目录）
// change.filePath = test/test_v1.c（相对于仓库根目录）
// 结果 = /home/tzp/work/agent/my_test/test/test/test_v1.c ❌
```

**解决方案：**
使用 `git rev-parse --show-toplevel` 获取仓库根目录：
```typescript
async getGitRoot(): Promise<string> {
  const command = await exec('git rev-parse --show-toplevel')
  return command.result.stdout.trim()
}

// 正确的拼接方式
const gitRoot = await this.getGitRoot()
const filePath = path.join(gitRoot, change.filePath)
// gitRoot = /home/tzp/work/agent/my_test
// change.filePath = test/test_v1.c
// 结果 = /home/tzp/work/agent/my_test/test/test_v1.c ✅
```

**相关提交：** `a2f7206`

---

### 问题 3: smartUpdate 忽略工作目录未提交变更

**现象：**
- 修改了文件但没提交，增量更新检测不到
- 只有提交后才能检测到变更

**根本原因：**
`smartUpdate` 在检测到有新提交时，只比较提交之间的差异：
```typescript
// 错误的逻辑
if (relevantCommits.length > 0) {
  // 只检查提交之间的变更
  result = await this.incrementalUpdate({
    fromCommit: oldestCommit.commitHash  // ❌ 忽略了工作目录的变更
  })
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

  // 3. 合并去重
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

**相关提交：** `289aea6`

---

### 问题 4: shouldProcessFile 过滤逻辑过于宽泛

**现象：**
- `test/test_v1.c` 被过滤掉，不被处理
- 所有路径中包含 `test` 的文件都被跳过

**根本原因：**
过滤逻辑匹配整个路径，而不是只匹配文件名：
```typescript
// 错误的逻辑
const testPatterns = ['.test.', '.spec.', '__tests__', '__mocks__']
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

**相关提交：** `e3a66e9`

---

## 调试技巧

### 1. 查看调试日志
```bash
# 找到最新的调试日志
ls -lt ~/.claude/debug/*.txt | head -1

# 查看特定关键字
grep -A 10 "incrementalUpdate\|shouldProcessFile" ~/.claude/debug/xxx.txt
```

### 2. 测试 Git 命令
```bash
# 测试 git status
git status --porcelain

# 测试 git diff
git diff --numstat

# 测试获取仓库根目录
git rev-parse --show-toplevel
```

### 3. 清理数据库重新测试
```bash
rm -rf test/.claude/test-graph/
# 然后重新初始化和构建
```

---

## 启动问题

### 使用交互模式（推荐）
```bash
cd /home/tzp/work/agent/my_test
./start-debug.sh  # 带调试日志
```

### 检查卡住的进程
```bash
ps aux | grep bun
pkill -9 bun
```
