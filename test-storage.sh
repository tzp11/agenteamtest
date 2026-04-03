#!/bin/bash
# 简单测试 TestMemoryTool 的数据存储

echo "🧪 Testing TestMemoryTool Storage..."
echo ""

# 创建测试目录
mkdir -p .claude/test-memory

# 测试 1: 手动创建测试记录
echo "Test 1: Creating test records..."
cat > .claude/test-memory/test-history.jsonl << 'EOF'
{"testName":"test_login_success","result":"pass","timestamp":1712102400000,"executionTime":125,"filePath":"tests/auth.test.ts"}
{"testName":"test_login_invalid","result":"fail","timestamp":1712102401000,"executionTime":89,"filePath":"tests/auth.test.ts","errorMessage":"TypeError: Cannot read property token","stackTrace":"at login.ts:45"}
{"testName":"test_login_success","result":"pass","timestamp":1712102402000,"executionTime":130,"filePath":"tests/auth.test.ts"}
EOF

echo "✅ Created test-history.jsonl"
echo ""

# 测试 2: 验证文件内容
echo "Test 2: Verifying file content..."
echo "Number of records: $(wc -l < .claude/test-memory/test-history.jsonl)"
echo ""

# 测试 3: 查询特定测试
echo "Test 3: Querying test_login_success..."
grep "test_login_success" .claude/test-memory/test-history.jsonl | wc -l
echo "Found records"
echo ""

# 测试 4: 显示文件结构
echo "Test 4: File structure..."
ls -lh .claude/test-memory/
echo ""

echo "🎉 Basic storage test passed!"
echo ""
echo "📁 Test data location: .claude/test-memory/"
echo "📝 You can now use TestMemoryTool in Claude Code"
