#!/bin/bash
echo "=== 测试 Git 变更检测 ==="
echo ""

# 确保有变更
echo "// test" >> test_v1.c

echo "1. 检查 git status:"
git status --short test_v1.c

echo ""
echo "2. 检查 git diff:"
git diff --numstat test_v1.c

echo ""
echo "3. 现在在 Claude Code 中执行:"
echo "   使用 TestGraphTool 检测当前的 Git 变更"
echo ""
echo "应该能看到 test_v1.c 的修改"
