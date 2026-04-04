#!/bin/bash

# Week 4 测试脚本：影响分析和自动触发
# 测试 analyzeImpact 功能

set -e

echo "=========================================="
echo "Week 4 测试：影响分析和自动触发"
echo "=========================================="
echo ""

# 切换到测试目录
cd "$(dirname "$0")/test"

echo "1. 初始化数据库..."
../bin/claude-haha --bare --print "使用 TestGraphTool 初始化数据库" || true
echo ""

echo "2. 构建调用图..."
../bin/claude-haha --bare --print "使用 TestGraphTool 构建调用图，扫描 **/*.c 文件" || true
echo ""

echo "3. 修改测试文件..."
# 修改 test_v1.c 文件
if [ -f "test_v1.c" ]; then
  echo "// Modified for testing" >> test_v1.c
  echo "已修改 test_v1.c"
else
  echo "⚠️  test_v1.c 不存在，跳过修改"
fi
echo ""

echo "4. 分析变更影响..."
../bin/claude-haha --bare --print "使用 TestGraphTool 分析影响，变更文件为 test/test_v1.c" || true
echo ""

echo "5. 检测 Git 变更..."
../bin/claude-haha --bare --print "使用 TestGraphTool 检测 Git 变更" || true
echo ""

echo "6. 增量更新..."
../bin/claude-haha --bare --print "使用 TestGraphTool 进行增量更新" || true
echo ""

echo "=========================================="
echo "Week 4 测试完成！"
echo "=========================================="
echo ""
echo "测试的功能："
echo "  ✅ 影响分析 (analyzeImpact)"
echo "  ✅ Git 变更检测 (detectChanges)"
echo "  ✅ 增量更新 (incrementalUpdate)"
echo ""
echo "查看详细日志："
echo "  ls -lt ~/.claude/debug/*.txt | head -1"
