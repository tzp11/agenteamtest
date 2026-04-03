#!/usr/bin/env bash
# 测试修复后的工具

cd /home/tzp/work/agent/my_test/test

echo "=========================================="
echo "测试 1: TestMemoryTool - 记录测试结果"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestMemoryTool 记录一个测试结果：测试名称 test_login_success，结果 pass，执行时间 125"

echo ""
echo "=========================================="
echo "测试 2: TestMemoryTool - 记录失败测试"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestMemoryTool 记录一个失败的测试：测试名称 test_login_invalid，结果 fail，错误信息 'TypeError: Cannot read property token'，执行时间 89"

echo ""
echo "=========================================="
echo "测试 3: TestMemoryTool - 查询失败模式"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestMemoryTool 查询常见的失败模式"

echo ""
echo "=========================================="
echo "测试 4: TestCoverageTool - 检测项目"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestCoverageTool 检测项目语言"
