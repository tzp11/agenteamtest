# Claude Code 自定义工具开发项目

本项目是 Claude Code 的本地开发版本，用于开发和测试自定义工具。

## 快速开始

```bash
# 1. 启动 Claude Code（工作目录：test/）
./start.sh

# 2. 在交互界面中测试工具
使用 SimpleTestTool 发送消息 "Hello World"
```

## 项目特点

- ✅ **三个自定义工具**：SimpleTestTool、TestMemoryTool、TestCoverageTool
- ✅ **完整的开发环境**：支持调试、测试、日志记录
- ✅ **独立工作目录**：所有数据保存在 `test/` 目录，不污染源代码
- ✅ **详细教程**：包含工具开发、调试、Git 工作流程的完整指南

## 目录结构

```
.
├── src/                      # 源代码
│   ├── tools/               # 自定义工具
│   │   ├── SimpleTestTool/  # 简单测试工具
│   │   ├── TestMemoryTool/  # 测试记忆工具
│   │   └── TestCoverageTool/# 测试覆盖率工具
│   └── entrypoints/         # 入口文件
├── test/                    # 默认工作目录
│   └── .claude/            # 运行时数据（自动创建）
├── bin/                     # 启动脚本
├── start.sh                # 正常启动
├── start-debug.sh          # 调试启动
├── test-simple-tool.sh     # 测试脚本
└── TUTORIAL.md             # 完整教程
```

## 自定义工具

### 1. SimpleTestTool

简单的回显工具，用于测试基础功能。

```
使用 SimpleTestTool 发送消息 "Hello World"
```

### 2. TestMemoryTool

记录和查询测试执行历史、统计数据和失败模式。

```
# 记录测试结果
使用 TestMemoryTool 记录一个测试结果：测试名称 test_login，结果 pass，执行时间 125

# 查询失败模式
使用 TestMemoryTool 查询常见的失败模式
```

### 3. TestCoverageTool

分析项目的测试覆盖率，支持多种语言和覆盖率工具。

```
使用 TestCoverageTool 检测项目语言
```

## 启动方式

### 交互式模式

```bash
# 正常启动
./start.sh

# 调试模式（显示详细日志）
./start-debug.sh
```

### 非交互式测试

```bash
# 测试单个工具
./test-simple-tool.sh

# 测试所有工具
./test-all-tools.sh
```

## 开发指南

详细的开发教程请查看 [TUTORIAL.md](./TUTORIAL.md)，包含：

- 🛠️ 自定义工具开发
- 🐛 常见问题修复
- 📝 Git 工作流程
- 🔍 调试技巧
- 📚 最佳实践

## 环境要求

- Bun >= 1.3.11
- Node.js >= 12.22.9（可选）
- Git

## 配置

环境配置在 `.env` 文件中：

```bash
ANTHROPIC_AUTH_TOKEN=your-token-here
ANTHROPIC_BASE_URL=https://api.qnaigc.com
ANTHROPIC_MODEL=claude-sonnet-4-6
API_TIMEOUT_MS=60000
```

## 最近更新

### v1.1.0 (2026-04-03) - Week 4 完成

- ✅ 实现影响分析服务（ImpactAnalyzer）
- ✅ 实现调用图构建器（CallGraphBuilder）
- ✅ 实现报告格式化器（ReportFormatter）
- ✅ 实现查询缓存（QueryCache）
- ✅ 新增 analyzeImpact 操作到 TestGraphTool
- ✅ 优化数据库查询性能（递归 CTE + 缓存）
- ✅ 完善文档和测试脚本

### v1.0.0 (2026-04-03) - Week 1-3 完成

- ✅ 修复所有工具的方法签名问题
- ✅ 完善启动脚本，支持 MACRO 全局变量
- ✅ 新增 test/ 工作目录
- ✅ 添加完整的开发教程
- ✅ 优化 Git 工作流程
- ✅ 实现 TestMemoryTool、TestCoverageTool、TestGraphTool

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目仅供学习和开发使用。

## 相关链接

- [Claude Code 官方文档](https://docs.anthropic.com/claude/docs)
- [完整开发教程](./TUTORIAL.md)
- [测试工作目录](./test/)
