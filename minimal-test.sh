#!/bin/bash
# 最小化测试

export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export DISABLE_TELEMETRY=1
export CLAUDE_CODE_SIMPLE=1

cd /home/tzp/work/agent/my_test/test

echo "测试 1: 检查 CLI 是否能启动..."
timeout 5 ../bin/claude-haha --version && echo "✓ CLI 可以启动" || echo "✗ CLI 启动失败"

echo ""
echo "测试 2: 检查 --bare 模式..."
echo "hello" | timeout 10 ../bin/claude-haha --bare --print 2>&1 | head -5

echo ""
echo "如果上面都失败了，问题可能是："
echo "1. API 连接超时"
echo "2. 某个初始化步骤卡住"
echo "3. 需要检查 debug 日志"
