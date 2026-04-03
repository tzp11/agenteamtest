#!/bin/bash
# 测试 SimpleTestTool 的脚本

cd /home/tzp/work/agent/my_test/test

# 使用 --print 模式测试工具
../bin/claude-haha \
  --print \
  --debug \
  --output-format=json \
  "使用 SimpleTestTool 发送消息 'Hello World'" 2>&1 | tee ../logs/test-simple-tool-$(date +%Y%m%d-%H%M%S).log


