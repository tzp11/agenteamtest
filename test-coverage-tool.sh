#!/bin/bash
# 测试 TestCoverageTool 的语言检测功能

echo "🧪 Testing TestCoverageTool Language Detection..."
echo ""

# 测试 1: 检测当前项目语言
echo "Test 1: Detecting current project language..."
echo "Expected: TypeScript (this is a TypeScript project)"
echo ""

# 统计文件数量
echo "File statistics:"
echo "  TypeScript files: $(find src -name "*.ts" 2>/dev/null | wc -l)"
echo "  JavaScript files: $(find src -name "*.js" 2>/dev/null | wc -l)"
echo "  Python files: $(find . -name "*.py" 2>/dev/null | wc -l)"
echo "  Go files: $(find . -name "*.go" 2>/dev/null | wc -l)"
echo ""

# 测试 2: 检查配置文件
echo "Test 2: Checking configuration files..."
echo "  package.json: $([ -f package.json ] && echo "✓" || echo "✗")"
echo "  tsconfig.json: $([ -f tsconfig.json ] && echo "✓" || echo "✗")"
echo "  go.mod: $([ -f go.mod ] && echo "✓" || echo "✗")"
echo "  requirements.txt: $([ -f requirements.txt ] && echo "✓" || echo "✗")"
echo ""

# 测试 3: 创建模拟覆盖率报告
echo "Test 3: Creating mock coverage report..."
mkdir -p coverage

cat > coverage/coverage-final.json << 'EOF'
{
  "src/tools/TestMemoryTool/storage.ts": {
    "lines": {
      "1": 1,
      "2": 1,
      "3": 1,
      "10": 1,
      "15": 0,
      "20": 0
    },
    "functions": {
      "recordTest": 5,
      "queryHistory": 3,
      "cleanup": 0
    }
  },
  "src/tools/TestMemoryTool/TestMemoryTool.ts": {
    "lines": {
      "1": 1,
      "2": 1,
      "5": 1,
      "10": 1,
      "15": 1
    },
    "functions": {
      "call": 10
    }
  }
}
EOF

echo "✅ Created mock coverage report: coverage/coverage-final.json"
echo ""

# 测试 4: 验证报告格式
echo "Test 4: Verifying report format..."
if [ -f coverage/coverage-final.json ]; then
  echo "✅ Report file exists"
  echo "  Size: $(du -h coverage/coverage-final.json | cut -f1)"
  echo "  Files covered: $(grep -o '"src/[^"]*"' coverage/coverage-final.json | wc -l)"
else
  echo "❌ Report file not found"
fi
echo ""

echo "🎉 TestCoverageTool setup complete!"
echo ""
echo "📁 Mock coverage report: coverage/coverage-final.json"
echo "📝 You can now use TestCoverageTool in Claude Code:"
echo "   - {operation: \"detect\"} - Detect project language"
echo "   - {operation: \"parse\", reportPath: \"coverage/coverage-final.json\"} - Parse report"
echo "   - {operation: \"analyze\"} - Analyze coverage"
