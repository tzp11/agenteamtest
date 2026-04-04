#!/bin/bash
# 交互式测试 TestGraphTool

echo "启动 Claude Code 交互模式..."
echo ""
echo "启动后，在聊天框中输入以下命令测试："
echo ""
echo "1. 使用 TestGraphTool 初始化数据库"
echo "2. 使用 TestGraphTool 检测当前的 Git 变更"
echo "3. 使用 TestGraphTool 获取覆盖率统计信息"
echo ""
echo "按 Ctrl+C 退出"
echo ""
echo "=========================================="
echo ""

cd /home/tzp/work/agent/my_test/test
exec ../bin/claude-haha --debug
