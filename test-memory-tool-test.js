#!/usr/bin/env bash
# 测试 TestMemoryTool 的脚本

cd /home/tzp/work/agent/my_test

echo "=== 测试 TestMemoryTool - 记录测试结果 ==="
/home/tzp/work/agent/MAi_Coding/bun-linux-x64/bun --env-file=.env ./src/entrypoints/cli.tsx \
  --print \
  --debug \
  "使用 TestMemoryTool 记录一个测试结果：测试名称 test_login_success，结果 pass，执行时间 125" 2>&1

echo ""
echo "=== 测试 TestMemoryTool - 查询失败模式 ==="
/home/tzp/work/agent/MAi_Coding/bun-linux-x64/bun --env-file=.env ./src/entrypoints/cli.tsx \
  --print \
  --debug \
  "使用 TestMemoryTool 查询常见的失败模式" 2>&1

echo ""
echo "=== 测试 TestCoverageTool - 检测项目 ==="
/home/tzp/work/agent/MAi_Coding/bun-linux-x64/bun --env-file=.env ./src/entrypoints/cli.tsx \
  --print \
  --debug \
  "使用 TestCoverageTool 检测项目语言" 2>&1
