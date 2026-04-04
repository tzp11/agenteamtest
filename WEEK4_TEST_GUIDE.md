# Week 4 功能测试指南

## 测试环境

已创建的测试文件：
```
test/
├── src/
│   ├── auth.c          # 认证模块（5个函数）
│   └── session.c       # 会话模块（4个函数）
└── tests/
    ├── test_auth.c     # 认证测试（6个测试）
    └── test_session.c  # 会话测试（4个测试）
```

## 测试步骤

### 1. 初始化数据库

**Prompt:**
```
使用 TestGraphTool 初始化数据库
```

**预期结果:**
```json
{
  "data": {
    "message": "Database initialized successfully",
    "dbPath": "/home/tzp/work/agent/my_test/test/.claude/test-graph/test-graph.db"
  }
}
```

---

### 2. 构建调用图

**Prompt:**
```
使用 TestGraphTool 构建调用图，扫描 src/**/*.c 和 tests/**/*.c 文件
```

**预期结果:**
```json
{
  "data": {
    "message": "Call graph built successfully",
    "functionsProcessed": 9,  // 5个auth函数 + 4个session函数
    "callsFound": 6,           // login调用authenticate_user和generate_token等
    "errors": []
  }
}
```

**说明:** 应该识别出：
- `auth.c`: validate_password, user_exists, authenticate_user, generate_token, login
- `session.c`: validate_session, is_session_expired, refresh_token, logout

---

### 3. 查看未覆盖函数

**Prompt:**
```
使用 TestGraphTool 查找未覆盖的函数，最小复杂度为 0
```

**预期结果:**
```json
{
  "data": {
    "uncoveredFunctions": [
      {
        "name": "validate_password",
        "filePath": "src/auth.c",
        "complexity": 3,
        "language": "c"
      },
      {
        "name": "user_exists",
        "filePath": "src/auth.c",
        "complexity": 4,
        "language": "c"
      },
      // ... 其他未覆盖函数
    ],
    "count": 9,  // 所有函数都未覆盖（因为还没运行测试）
    "minComplexity": 0
  }
}
```

---

### 4. 模拟修改文件

**操作:**
```bash
# 在 test 目录下执行
echo "// Modified for testing" >> src/auth.c
```

---

### 5. 检测 Git 变更

**Prompt:**
```
使用 TestGraphTool 检测 Git 变更
```

**预期结果:**
```json
{
  "data": {
    "changes": [
      {
        "filePath": "src/auth.c",
        "changeType": "modified",
        "linesAdded": 1,
        "linesDeleted": 0
      }
    ],
    "count": 1,
    "fromCommit": "working directory",
    "toCommit": "HEAD"
  }
}
```

---

### 6. 分析变更影响（核心功能）

**Prompt:**
```
使用 TestGraphTool 分析影响，变更文件为 src/auth.c
```

**预期结果:**
```json
{
  "data": {
    "changedFiles": ["src/auth.c"],
    "affectedFunctions": [
      {
        "name": "validate_password",
        "filePath": "src/auth.c",
        "complexity": 3,
        "callDepth": 0
      },
      {
        "name": "user_exists",
        "filePath": "src/auth.c",
        "complexity": 4,
        "callDepth": 0
      },
      {
        "name": "authenticate_user",
        "filePath": "src/auth.c",
        "complexity": 5,
        "callDepth": 0
      },
      {
        "name": "generate_token",
        "filePath": "src/auth.c",
        "complexity": 2,
        "callDepth": 0
      },
      {
        "name": "login",
        "filePath": "src/auth.c",
        "complexity": 3,
        "callDepth": 0
      }
    ],
    "affectedTests": [],  // 空的，因为还没有测试覆盖率数据
    "recommendation": "无受影响的测试。建议检查是否缺少测试覆盖。",
    "estimatedTestTime": 0
  }
}
```

**说明:** 
- 因为还没有运行测试并记录覆盖率，所以 `affectedTests` 为空
- 这是正常的，说明系统检测到了变更的函数，但没有测试覆盖数据

---

### 7. 增量更新

**Prompt:**
```
使用 TestGraphTool 进行增量更新，扫描 src/**/*.c 文件
```

**预期结果:**
```json
{
  "data": {
    "message": "Incremental update completed",
    "filesProcessed": 1,      // 只处理 auth.c（因为它被修改了）
    "functionsUpdated": 5,    // auth.c 中的5个函数
    "callsUpdated": 2,        // login的调用关系
    "filesDeleted": 0,
    "timeSinceLastScan": "2 minutes ago"
  }
}
```

---

### 8. 获取覆盖率统计

**Prompt:**
```
使用 TestGraphTool 获取覆盖率统计
```

**预期结果:**
```json
{
  "data": {
    "totalFunctions": 9,
    "coveredFunctions": 0,
    "uncoveredFunctions": 9,
    "coveragePercentage": 0,
    "avgComplexity": 3.2
  }
}
```

---

## 功能验证要点

### ✅ 成功标准

1. **数据库初始化** - 能成功创建 SQLite 数据库
2. **函数识别** - 能识别出 9 个函数（5个auth + 4个session）
3. **调用关系** - 能识别出函数间的调用关系（如 login → authenticate_user）
4. **变更检测** - 能检测到 auth.c 被修改
5. **影响分析** - 能列出 auth.c 中的所有函数
6. **增量更新** - 只更新变更的文件，不重新扫描全部

### ⚠️ 已知限制

1. **测试覆盖率为空** - 因为还没有实际运行测试并记录覆盖率
   - 这是正常的，Week 4 只实现了影响分析框架
   - 实际的测试覆盖率记录需要集成测试运行器（Week 5-6）

2. **LSPTool 依赖** - CallGraphBuilder 依赖 LSPTool
   - 如果 LSPTool 未启动或不支持 C 语言，可能无法分析调用关系
   - 可以降级到只分析文件级别的变更

3. **复杂度估算简化** - 当前只是简单计数控制流关键字
   - 不是真正的圈复杂度
   - 足够用于优先级排序

---

## 测试命令速查

```bash
# 进入测试目录
cd /home/tzp/work/agent/my_test/test

# 启动 Claude Code
../bin/claude-haha

# 或者使用调试模式
../bin/claude-haha --debug
```

然后在交互界面中依次输入上面的 Prompt。

---

## 预期输出示例

当你运行 "分析影响" 时，应该看到类似这样的输出：

```
Change Impact Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: 2026-04-04T10:30:15.000Z

📝 Changed Files (1):
  - src/auth.c

🎯 Affected Functions (5):
  - validate_password (src/auth.c)
    Complexity: 3 🟢
  - user_exists (src/auth.c)
    Complexity: 4 🟢
  - authenticate_user (src/auth.c)
    Complexity: 5 🟢
  - generate_token (src/auth.c)
    Complexity: 2 🟢
  - login (src/auth.c)
    Complexity: 3 🟢

🧪 Affected Tests: None
⚠️  Warning: No tests found for changed code!

💡 Recommendation:
  无受影响的测试。建议检查是否缺少测试覆盖。
```

---

## 故障排查

如果遇到问题，检查：

1. **数据库文件是否创建**
   ```bash
   ls -la test/.claude/test-graph/
   ```

2. **查看调试日志**
   ```bash
   ls -lt ~/.claude/debug/*.txt | head -1
   tail -100 ~/.claude/debug/xxx.txt
   ```

3. **检查文件是否存在**
   ```bash
   ls -la test/src/
   ls -la test/tests/
   ```
