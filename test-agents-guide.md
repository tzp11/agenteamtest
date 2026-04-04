# Week 5 Agent 功能测试指南

## 测试目的

验证 5 个 Agent 定义是否能在 Claude Code 中正常工作。

## 测试环境

- Claude Code CLI
- 已完成 Week 1-4 的工具（TestMemoryTool, TestCoverageTool, TestGraphTool）

## 测试用例

### 测试 1: Test Architect Agent

**测试命令：**
```
使用 test-architect Agent 分析 test/src/auth.c 的测试策略
```

**预期输出：**
- 分析代码结构
- 识别关键函数
- 提供测试策略建议
- 输出优先级排序

**验证点：**
- [ ] Agent 能被正确加载
- [ ] Agent 能使用 TestGraphTool 查询函数
- [ ] Agent 能使用 LSPTool 分析复杂度
- [ ] 输出格式符合规范

---

### 测试 2: Unit Test Engineer Agent

**测试命令：**
```
使用 unit-test-engineer Agent 为 test/src/auth.c 中的 authenticate_user 函数生成单元测试
```

**预期输出：**
- 生成完整的测试代码
- 覆盖所有分支
- 包含边界条件测试
- 使用正确的测试框架（C/Unity）

**验证点：**
- [ ] Agent 能读取源代码
- [ ] Agent 能识别函数签名
- [ ] 生成的测试代码可编译
- [ ] 测试覆盖所有分支

---

### 测试 3: Integration Test Engineer Agent

**测试命令：**
```
使用 integration-test-engineer Agent 为 auth 和 session 模块的交互生成集成测试
```

**预期输出：**
- 识别模块间交互点
- 生成集成测试代码
- 包含数据流测试
- 包含错误传播测试

**验证点：**
- [ ] Agent 能使用 TestGraphTool 查询调用关系
- [ ] Agent 能识别集成点
- [ ] 生成的测试覆盖模块交互
- [ ] 测试包含 setup/teardown

---

### 测试 4: Test Reviewer Agent

**测试命令：**
```
使用 test-reviewer Agent 审查 test/tests/test_auth.c 的测试质量
```

**预期输出：**
- 识别测试问题
- 按严重程度分类
- 提供具体改进建议
- 给出审查结论

**验证点：**
- [ ] Agent 能读取测试代码
- [ ] Agent 能识别测试坏味道
- [ ] 输出包含具体行号
- [ ] 建议具有可操作性

---

### 测试 5: Test Diagnostician Agent

**前置条件：** 需要有一个失败的测试

**测试命令：**
```
使用 test-diagnostician Agent 诊断测试失败：
错误信息：TypeError: Cannot read property 'token' of undefined
堆栈：test_auth.c:45
```

**预期输出：**
- 分类失败类型
- 分析根本原因
- 提供修复建议
- 给出置信度

**验证点：**
- [ ] Agent 能分析错误信息
- [ ] Agent 能查询历史失败（TestMemoryTool）
- [ ] 分类准确
- [ ] 修复建议可行

---

## 测试步骤

### 方式 1: 交互式测试（推荐）

1. 启动 Claude Code：
   ```bash
   cd /home/tzp/work/agent/my_test
   ./start.sh
   ```

2. 在聊天中输入测试命令（见上面各测试用例）

3. 观察 Agent 输出，验证功能

### 方式 2: 脚本测试

创建测试脚本 `test-agent-functionality.sh`：

```bash
#!/bin/bash

echo "测试 Test Architect Agent..."
echo "使用 test-architect Agent 分析 test/src/auth.c" | ../bin/claude-haha --print

echo ""
echo "测试 Unit Test Engineer Agent..."
echo "使用 unit-test-engineer Agent 为 authenticate_user 生成测试" | ../bin/claude-haha --print

# ... 其他测试
```

## 已知限制

1. **Agent 调用语法**：需要确认 Claude Code 如何调用自定义 Agent
   - 可能是：`@test-architect 分析 auth.c`
   - 或者：`使用 test-architect Agent ...`

2. **Tool 访问权限**：Agent 是否能访问所有 Tool 需要验证

3. **并行执行**：Week 5 只测试单个 Agent，并行编排在 Week 6

## 测试结果记录

### Test Architect Agent
- [ ] 能被加载
- [ ] 能使用 Tool
- [ ] 输出格式正确
- [ ] 分析结果合理

### Unit Test Engineer Agent
- [ ] 能被加载
- [ ] 能生成测试代码
- [ ] 代码语法正确
- [ ] 覆盖率充分

### Integration Test Engineer Agent
- [ ] 能被加载
- [ ] 能识别集成点
- [ ] 生成集成测试
- [ ] 测试逻辑正确

### Test Reviewer Agent
- [ ] 能被加载
- [ ] 能识别问题
- [ ] 建议具体可行
- [ ] 分类合理

### Test Diagnostician Agent
- [ ] 能被加载
- [ ] 能分析失败
- [ ] 分类准确
- [ ] 修复建议有效

## 问题记录

如果测试中发现问题，记录在这里：

1. **问题描述**：
   - 现象：
   - 预期：
   - 实际：

2. **解决方案**：
   - 修改内容：
   - 验证结果：

## 下一步

测试通过后：
1. 提交 Week 5 代码
2. 更新 implementation_plan.md
3. 开始 Week 6: TestOrchestrator 实现
