# Test Directory

这是 Claude Code 的默认工作目录，用于基础功能测试和开发。

## 目录说明

- 所有 Claude Code 会话默认在此目录启动
- 测试数据和临时文件会保存在这里
- `.claude/` 子目录会自动创建，用于存储：
  - `test-memory/` - TestMemoryTool 的测试历史数据
  - `memory/` - 会话记忆数据
  - 其他 Claude Code 运行时数据

## 启动脚本

从项目根目录运行：

- `./start.sh` - 正常启动 Claude Code
- `./start-debug.sh` - 调试模式启动
- `./test-simple-tool.sh` - 测试 SimpleTestTool
- `./test-all-tools.sh` - 测试所有自定义工具

## 注意事项

- 此目录下的文件可以随时删除，不会影响源代码
- 测试数据会持久化保存在 `.claude/` 目录中
