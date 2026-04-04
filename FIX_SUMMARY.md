# 修复说明

## 发现的问题

1. **路径匹配问题** - `ImpactAnalyzer` 只支持精确路径匹配
2. **数据库访问问题** - `db['db']` 访问私有属性失败

## 已修复

### 1. 路径匹配（impactAnalyzer.ts）

```typescript
// 修复前：只支持精确匹配
WHERE file_path = ?

// 修复后：支持3种匹配方式
1. 精确匹配：file_path = 'src/auth.c'
2. 后缀匹配：file_path LIKE '%src/auth.c'
3. 文件名匹配：file_path LIKE '%auth.c'
```

### 2. 数据库访问（database.ts + TestGraphTool.ts）

```typescript
// 修复前
const analyzer = new ImpactAnalyzer(db['db'], cwd)  // ❌ 访问私有属性

// 修复后
// 1. 添加 getter 方法到 database.ts
getDatabase(): Database {
  return this.db
}

// 2. 使用 getter 方法
const analyzer = new ImpactAnalyzer(db.getDatabase(), cwd)  // ✅
```

## 重新测试

在 Claude Code 中运行：

```
使用 TestGraphTool 分析影响，变更文件为 src/auth.c
```

**预期结果：**
```json
{
  "changedFiles": ["src/auth.c"],
  "affectedFunctions": [
    {"name": "validate_password", "complexity": 3},
    {"name": "user_exists", "complexity": 4},
    {"name": "authenticate_user", "complexity": 5},
    {"name": "generate_token", "complexity": 2},
    {"name": "login", "complexity": 3}
  ],
  "affectedTests": [],
  "recommendation": "无受影响的测试。建议检查是否缺少测试覆盖。"
}
```

## 如果还是不工作

添加调试日志到 `impactAnalyzer.ts`：

```typescript
async analyzeImpact(changedFiles: string[]): Promise<ImpactReport> {
  console.log('[DEBUG ImpactAnalyzer] changedFiles:', changedFiles)
  
  for (const file of changedFiles) {
    const functions = this.getFunctionsInFile(file)
    console.log('[DEBUG ImpactAnalyzer] functions found:', functions.length)
    // ...
  }
}
```

然后查看调试日志：
```bash
tail -100 ~/.claude/debug/*.txt | grep "ImpactAnalyzer"
```
