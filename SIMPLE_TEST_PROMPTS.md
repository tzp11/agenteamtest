# Week 5 Agent 测试 Prompts（简化版）

## 直接复制粘贴到 Claude Code

### 测试 1: Test Architect
```
使用 test-architect Agent 分析 test/src/auth.c 的测试策略
```

### 测试 2: Unit Test Engineer
```
使用 unit-test-engineer Agent 为 test/src/auth.c 中的 authenticate_user 函数生成单元测试
```

### 测试 3: Integration Test Engineer
```
使用 integration-test-engineer Agent 为 test/src/auth.c 和 test/src/session.c 的交互生成集成测试
```

### 测试 4: Test Reviewer（修复版）
```
使用 test-reviewer Agent 审查 test/tests/test_auth.c 的测试代码质量
```

### 测试 5: Test Diagnostician
```
使用 test-diagnostician Agent 诊断测试失败：错误信息 "Segmentation fault (core dumped)"，堆栈 "test_auth.c:45 in authenticate_user()"，测试用例 "test_authenticate_user_null_password"
```

## 注意事项

1. **不要使用** `test-reviewer(...)` 这种语法
2. **使用** `使用 test-reviewer Agent ...` 这种自然语言
3. 所有 Agent 文件都在 `.claude/agents/` 目录下
4. 如果 Agent 没有被识别，重启 Claude Code

## 预期结果

- Test Architect: 输出测试策略和优先级
- Unit Test Engineer: 生成完整的单元测试代码
- Integration Test Engineer: 生成集成测试代码
- Test Reviewer: 输出审查报告，包含问题分类和改进建议
- Test Diagnostician: 分析失败原因并提供修复建议
