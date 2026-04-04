# TestOrchestrator 使用指南

## 概述

TestOrchestrator 是一个多 Agent 协同系统，用于自动生成高质量的测试代码。它协调 5 个专业 Agent 共同工作：

1. **Test Architect** - 分析代码，制定测试策略
2. **Unit Test Engineer** - 生成单元测试
3. **Integration Test Engineer** - 生成集成测试
4. **Test Reviewer** - 审查测试质量
5. **Test Diagnostician** - 诊断测试失败（未来使用）

## 快速开始

### 1. 基本用法

```
使用 TestOrchestratorTool 生成测试，描述为"为登录功能生成测试"，目标文件为 ["src/auth/login.ts"]
```

### 2. 指定测试类型

```
使用 TestOrchestratorTool 生成测试，描述为"为支付模块生成测试"，目标文件为 ["src/payment/process.ts"]，测试类型为 ["unit", "integration"]
```

### 3. 设置优先级

```
使用 TestOrchestratorTool 生成测试，描述为"为核心 API 生成测试"，目标文件为 ["src/api/users.ts"]，优先级为 "high"
```

## 工作流程

### Phase 1: 策略规划（Test Architect）

Test Architect 会：
- 使用 TestGraphTool 分析代码关系
- 使用 TestCoverageTool 识别覆盖盲区
- 基于复杂度和风险排序
- 输出结构化测试计划

**输出示例：**
```
## Test Strategy for auth module

### Priority 1: Critical Paths
- Function: `authenticateUser` (src/auth/login.ts:45)
  - Complexity: 12
  - Test types: Unit + Integration
  - Rationale: Core authentication logic, high complexity

### Priority 2: Important Functions
- Function: `validateToken` (src/auth/token.ts:23)
  - Complexity: 8
  - Test types: Unit
  - Rationale: Token validation, security critical
```

### Phase 2: 测试生成（Engineers 并行执行）

**Unit Test Engineer** 生成：
- 细粒度单元测试
- 覆盖所有分支
- 测试边界条件
- 使用 Mock 隔离依赖

**Integration Test Engineer** 生成：
- 模块间交互测试
- API 端点测试
- 数据流测试
- 错误传播测试

**并行执行优势：**
- 节省时间（2 个 Agent 同时工作）
- 独立生成（互不干扰）
- 总耗时约 30-60 秒

### Phase 3: 质量审查（Test Reviewer）

Test Reviewer 会检查：
1. **正确性** - 断言是否正确
2. **完整性** - 是否覆盖所有场景
3. **清晰度** - 是否易于理解
4. **可维护性** - 是否易于修改
5. **性能** - 是否有慢测试
6. **隔离性** - 是否相互独立

**审查结果示例：**
```
## Review Results
Approved: ✅
Score: 85/100

Issues:
  - [minor] Test names could be more descriptive
  - [minor] Consider adding more edge case tests

Suggestions:
  - Add tests for concurrent access scenarios
  - Consider using test fixtures for common setup
```

## 输出格式

### 成功输出

```json
{
  "success": true,
  "strategy": {
    "targetModule": "auth",
    "priorities": [...],
    "estimatedTime": 1500,
    "recommendations": [...]
  },
  "tests": [
    {
      "testName": "test_authenticate_user_success",
      "testFile": "test/auth/login.test.ts",
      "testCode": "...",
      "testType": "unit",
      "coverage": {
        "functions": ["authenticateUser"],
        "lines": [45, 46, 47, ...]
      }
    },
    ...
  ],
  "review": {
    "approved": true,
    "score": 85,
    "issues": [...],
    "suggestions": [...]
  },
  "totalTime": 45000
}
```

### 失败输出

```json
{
  "success": false,
  "tests": [],
  "totalTime": 15000,
  "error": "Strategy planning failed: Unable to analyze code structure"
}
```

## 高级用法

### 1. 只生成单元测试

```
使用 TestOrchestratorTool 生成测试，描述为"为工具函数生成单元测试"，目标文件为 ["src/utils/helpers.ts"]，测试类型为 ["unit"]
```

### 2. 只生成集成测试

```
使用 TestOrchestratorTool 生成测试，描述为"为 API 端点生成集成测试"，目标文件为 ["src/api/routes.ts"]，测试类型为 ["integration"]
```

### 3. 批量生成测试

```
使用 TestOrchestratorTool 生成测试，描述为"为整个认证模块生成测试"，目标文件为 ["src/auth/login.ts", "src/auth/session.ts", "src/auth/token.ts"]
```

## 性能指标

| 阶段 | 预期耗时 | 说明 |
|------|---------|------|
| 策略规划 | 10-20 秒 | Test Architect 分析代码 |
| 测试生成 | 30-60 秒 | 2 个 Engineer 并行执行 |
| 质量审查 | 10-20 秒 | Test Reviewer 审查 |
| **总计** | **50-100 秒** | 完整流程 |

## 最佳实践

### 1. 明确描述需求

❌ 不好：
```
使用 TestOrchestratorTool 生成测试，描述为"生成测试"
```

✅ 好：
```
使用 TestOrchestratorTool 生成测试，描述为"为用户登录功能生成测试，包括成功登录、密码错误、用户不存在等场景"
```

### 2. 指定目标文件

❌ 不好：
```
使用 TestOrchestratorTool 生成测试，描述为"为整个项目生成测试"
```

✅ 好：
```
使用 TestOrchestratorTool 生成测试，描述为"为认证模块生成测试"，目标文件为 ["src/auth/login.ts", "src/auth/session.ts"]
```

### 3. 选择合适的测试类型

- **只需要单元测试**：纯函数、工具类、算法
- **只需要集成测试**：API 端点、数据库操作、服务集成
- **两者都需要**：核心业务逻辑、复杂模块

### 4. 设置优先级

- **high**：核心功能、安全相关、高风险代码
- **medium**：一般业务逻辑（默认）
- **low**：辅助功能、简单工具

## 故障排查

### 问题 1：策略规划失败

**现象：** `Strategy planning failed: Unable to analyze code structure`

**可能原因：**
- 目标文件不存在
- 代码格式错误
- LSP 服务未启动

**解决方案：**
1. 检查文件路径是否正确
2. 确保代码可以编译
3. 重启 Claude Code

### 问题 2：测试生成失败

**现象：** `No tests were generated`

**可能原因：**
- 策略规划不完整
- Agent 超时
- 代码过于复杂

**解决方案：**
1. 减少目标文件数量
2. 增加超时时间
3. 简化代码结构

### 问题 3：审查不通过

**现象：** `Review failed: Multiple critical issues found`

**可能原因：**
- 生成的测试质量低
- 测试覆盖不完整
- 测试代码有错误

**解决方案：**
1. 查看审查意见
2. 手动修改测试代码
3. 重新生成测试

## 与其他工具的集成

### 1. 与 TestGraphTool 集成

TestOrchestrator 会自动使用 TestGraphTool 分析代码关系：

```
# 先构建调用图
使用 TestGraphTool 构建调用图，文件模式为 ["**/*.ts"]

# 再生成测试
使用 TestOrchestratorTool 生成测试，描述为"为核心模块生成测试"
```

### 2. 与 TestCoverageTool 集成

TestOrchestrator 会自动使用 TestCoverageTool 识别盲区：

```
# 先分析覆盖率
使用 TestCoverageTool 运行覆盖率分析

# 再生成测试
使用 TestOrchestratorTool 生成测试，描述为"为未覆盖代码生成测试"
```

### 3. 与 TestMemoryTool 集成

TestOrchestrator 会自动查询历史测试数据：

```
# 历史数据会自动被使用
使用 TestOrchestratorTool 生成测试，描述为"为经常失败的模块生成更好的测试"
```

## 示例场景

### 场景 1：新功能开发

```
# 1. 开发完成后，生成测试
使用 TestOrchestratorTool 生成测试，描述为"为新开发的支付功能生成完整测试"，目标文件为 ["src/payment/process.ts", "src/payment/validate.ts"]，测试类型为 ["unit", "integration"]，优先级为 "high"

# 2. 查看生成的测试
# 3. 运行测试
# 4. 根据审查意见调整
```

### 场景 2：重构代码

```
# 1. 重构前，生成基准测试
使用 TestOrchestratorTool 生成测试，描述为"为即将重构的认证模块生成测试"，目标文件为 ["src/auth/*.ts"]

# 2. 重构代码
# 3. 运行测试确保行为不变
```

### 场景 3：提升覆盖率

```
# 1. 分析当前覆盖率
使用 TestCoverageTool 运行覆盖率分析

# 2. 为未覆盖代码生成测试
使用 TestOrchestratorTool 生成测试，描述为"为覆盖率低于 80% 的模块生成测试"

# 3. 再次运行覆盖率分析
```

## 未来功能（Week 7-8）

- **自动修复失败测试**：集成 Test Diagnostician
- **ReAct 自愈循环**：自动诊断和修复
- **测试执行集成**：自动运行生成的测试
- **迭代改进**：根据审查意见自动改进测试

## 参考资料

- [implementation_plan.md](../implementation_plan.md) - 完整实施规划
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - 故障排查指南
- [test-agents-guide.md](../test-agents-guide.md) - Agent 详细文档

---

**版本**: v1.0  
**更新时间**: 2026-04-04  
**状态**: Week 6 完成
