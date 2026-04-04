#!/bin/bash
# 快速测试 TestGraphTool

cd /home/tzp/work/agent/my_test/test

echo "=========================================="
echo "测试 1: 初始化数据库"
echo "=========================================="
../bin/claude-haha --print "使用 TestGraphTool 初始化数据库"

echo ""
echo "=========================================="
echo "测试 2: 检测 Git 变更"
echo "=========================================="
../bin/claude-haha --print "使用 TestGraphTool 检测当前的 Git 变更"

echo ""
echo "=========================================="
echo "测试 3: 获取覆盖率统计"
echo "=========================================="
../bin/claude-haha --print "使用 TestGraphTool 获取覆盖率统计信息"

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 运行 ./start-debug.sh 启动交互模式"
echo "2. 在聊天框输入：使用 TestGraphTool 构建调用图"
echo "3. 等待扫描完成（2-5分钟）"
echo "4. 查看结果并测试其他功能"
