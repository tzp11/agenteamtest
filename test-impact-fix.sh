#!/bin/bash

# 快速验证 analyzeImpact 修复

cd /home/tzp/work/agent/my_test/test

echo "=========================================="
echo "测试 analyzeImpact 路径匹配修复"
echo "=========================================="
echo ""

echo "测试 1: 使用相对路径 src/auth.c"
../bin/claude-haha --bare --print "使用 TestGraphTool 分析影响，变更文件为 src/auth.c" 2>&1 | grep -A 5 "affectedFunctions"
echo ""

echo "测试 2: 使用文件名 auth.c"
../bin/claude-haha --bare --print "使用 TestGraphTool 分析影响，变更文件为 auth.c" 2>&1 | grep -A 5 "affectedFunctions"
echo ""

echo "=========================================="
echo "如果看到 affectedFunctions 不为空，说明修复成功"
echo "=========================================="
