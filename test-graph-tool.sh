#!/usr/bin/env bash
# 测试 TestGraphTool 的脚本

cd /home/tzp/work/agent/my_test/test

echo "=========================================="
echo "测试 1: TestGraphTool - 初始化数据库"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestGraphTool 初始化数据库"

echo ""
echo "=========================================="
echo "测试 2: TestGraphTool - 检测 Git 变更"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestGraphTool 检测当前的 Git 变更"

echo ""
echo "=========================================="
echo "测试 3: TestGraphTool - 获取覆盖率统计"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestGraphTool 获取覆盖率统计"

echo ""
echo "=========================================="
echo "测试 4: TestGraphTool - 查找未覆盖函数"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestGraphTool 查找复杂度大于 5 的未覆盖函数"

echo ""
echo "=========================================="
echo "测试 5: TestGraphTool - 构建调用图"
echo "=========================================="
../bin/claude-haha \
  --print \
  "使用 TestGraphTool 构建项目的函数调用图"
