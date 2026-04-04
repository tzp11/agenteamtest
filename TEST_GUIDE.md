# TestGraphTool 测试指南

## 启动调试模式

```bash
cd /home/tzp/work/agent/my_test
./start-debug.sh
```

这会启动 Claude Code 的调试模式，可以看到详细的错误日志。

## 测试场景和具体 Prompt

### 1. 初始化数据库

**在聊天框输入：**
```
使用 TestGraphTool 初始化数据库
```

**预期结果：**
```json
{
  "message": "Database initialized successfully",
  "dbPath": "/home/tzp/work/agent/my_test/test/.claude/test-graph/graph.db"
}
```

---

### 2. 检测 Git 变更

**在聊天框输入：**
```
使用 TestGraphTool 检测当前的 Git 变更
```

**预期结果：**
显示未暂存和已暂存的文件变更列表

---

### 3. 获取覆盖率统计

**在聊天框输入：**
```
使用 TestGraphTool 获取覆盖率统计信息
```

**预期结果：**
```json
{
  "totalFunctions": 0,
  "coveredFunctions": 0,
  "uncoveredFunctions": 0,
  "coveragePercentage": 0
}
```

（初始状态下都是 0，因为还没有扫描代码）

---

### 4. 构建调用图（核心功能）

**在聊天框输入：**
```
使用 TestGraphTool 构建调用图，扫描 src 目录下的所有 TypeScript 文件
```

**预期结果：**
```json
{
  "message": "Call graph built successfully",
  "functionsProcessed": 150,
  "callsFound": 320,
  "errors": []
}
```

**注意：** 这个操作可能需要几分钟，因为要扫描整个项目

---

### 5. 查找未覆盖的函数

**在聊天框输入：**
```
使用 TestGraphTool 查找复杂度大于 5 的未覆盖函数
```

**预期结果：**
显示未被测试覆盖的高复杂度函数列表

---

### 6. 查找高风险函数

**在聊天框输入：**
```
使用 TestGraphTool 查找前 10 个高风险函数
```

**预期结果：**
显示高复杂度且未覆盖的函数列表

---

### 7. 查找受影响的测试

**在聊天框输入：**
```
使用 TestGraphTool 查找函数 buildTool 会影响哪些测试
```

**预期结果：**
显示调用了 buildTool 的测试函数列表

---

### 8. 增量更新（智能更新）

**在聊天框输入：**
```
使用 TestGraphTool 执行增量更新，只扫描变更的文件
```

**预期结果：**
```json
{
  "message": "Incremental update completed",
  "filesProcessed": 3,
  "functionsUpdated": 12,
  "callsUpdated": 25,
  "filesDeleted": 0,
  "timeSinceLastScan": "5 minutes ago"
}
```

---

### 9. 获取文件变更历史

**在聊天框输入：**
```
使用 TestGraphTool 获取 src/tools/TestGraphTool/TestGraphTool.ts 的变更历史
```

**预期结果：**
显示该文件的 Git 提交历史

---

### 10. 清理旧数据

**在聊天框输入：**
```
使用 TestGraphTool 清理 30 天前的旧数据
```

**预期结果：**
```json
{
  "message": "Cleaned up 0 old records",
  "removed": 0,
  "retentionDays": 30
}
```

---

## 完整测试流程

### 步骤 1：启动调试模式
```bash
cd /home/tzp/work/agent/my_test
./start-debug.sh
```

### 步骤 2：按顺序测试

1. **初始化数据库**
   ```
   使用 TestGraphTool 初始化数据库,文件模式为 ["**/*.c"]   
   ```

2. **构建调用图**
   ```
   使用 TestGraphTool 构建调用图,文件模式为 ["**/*.c"]
   ```
   
   等待完成（可能需要 2-5 分钟）

3. **查看统计信息**
   ```
   使用 TestGraphTool 获取覆盖率统计信息
   ```

4. **查找未覆盖函数**
   ```
   使用 TestGraphTool 查找未覆盖的函数
   ```

5. **测试增量更新**
   ```
   使用 TestGraphTool 执行增量更新
   ```

---

## 常见问题排查

### 问题 1：工具调用失败

**症状：** 显示 "内部错误" 或 "工具调用失败"

**排查步骤：**
1. 检查 better-sqlite3 是否安装：
   ```bash
   ls node_modules/better-sqlite3
   ```

2. 检查数据库目录是否创建：
   ```bash
   ls -la test/.claude/test-graph/
   ```

3. 查看详细错误日志（调试模式下会显示）

---

### 问题 2：构建调用图很慢

**原因：** LSPTool 需要分析每个文件的符号和调用关系

**解决方案：**
- 第一次扫描会比较慢（2-5 分钟）
- 后续使用增量更新会快很多
- 可以限制扫描范围：
  ```
  使用 TestGraphTool 构建调用图，只扫描 src/tools 目录
  ```

---

### 问题 3：找不到函数

**原因：** 数据库中还没有该函数的记录

**解决方案：**
1. 先运行 "构建调用图"
2. 确保函数名拼写正确
3. 检查函数是否在扫描范围内

---

## 验证成功的标志

✅ **数据库初始化成功**
- 看到 "Database initialized successfully"
- 文件 `test/.claude/test-graph/graph.db` 存在

✅ **调用图构建成功**
- 看到 "functionsProcessed" > 0
- 看到 "callsFound" > 0
- 没有错误信息

✅ **查询功能正常**
- 能查询到函数列表
- 统计信息正确
- 没有数据库错误

✅ **增量更新正常**
- 看到 "timeSinceLastScan"
- 只处理变更的文件
- 更新速度快

---

## 快速测试脚本

如果想快速测试所有功能，可以创建一个测试脚本：

```bash
#!/bin/bash
# 快速测试 TestGraphTool

cd /home/tzp/work/agent/my_test/test

echo "=== 测试 1: 初始化数据库 ==="
../bin/claude-haha --print "使用 TestGraphTool 初始化数据库"

echo ""
echo "=== 测试 2: 检测变更 ==="
../bin/claude-haha --print "使用 TestGraphTool 检测当前的 Git 变更"

echo ""
echo "=== 测试 3: 获取统计 ==="
../bin/claude-haha --print "使用 TestGraphTool 获取覆盖率统计信息"

echo ""
echo "=== 测试完成 ==="
```

保存为 `quick-test-graph.sh`，然后运行：
```bash
chmod +x quick-test-graph.sh
./quick-test-graph.sh
```

---

## 下一步

测试通过后，可以：
1. 在实际项目中使用 TestGraphTool
2. 集成到 CI/CD 流程
3. 开始 Week 4：影响分析 + 自动触发
