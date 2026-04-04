#!/bin/bash

# Week 5 Agent 测试脚本
# 测试 5 个 Agent 定义是否正确

echo "=========================================="
echo "Week 5 Agent 定义测试"
echo "=========================================="
echo ""

# 检查 Agent 文件是否存在
echo "1. 检查 Agent 文件..."
AGENTS=(
  "test-architect"
  "unit-test-engineer"
  "integration-test-engineer"
  "test-reviewer"
  "test-diagnostician"
)

ALL_EXIST=true
for agent in "${AGENTS[@]}"; do
  file=".claude/agents/${agent}.md"
  if [ -f "$file" ]; then
    echo "  ✅ $file 存在"
  else
    echo "  ❌ $file 不存在"
    ALL_EXIST=false
  fi
done

if [ "$ALL_EXIST" = false ]; then
  echo ""
  echo "❌ 部分 Agent 文件缺失"
  exit 1
fi

echo ""
echo "2. 检查 Agent frontmatter..."
for agent in "${AGENTS[@]}"; do
  file=".claude/agents/${agent}.md"

  # 检查是否有 frontmatter
  if head -n 1 "$file" | grep -q "^---$"; then
    echo "  ✅ $agent: frontmatter 格式正确"

    # 检查必需字段
    if grep -q "^name:" "$file" && grep -q "^description:" "$file" && grep -q "^model:" "$file"; then
      echo "     - 包含必需字段 (name, description, model)"
    else
      echo "     ⚠️  缺少必需字段"
    fi
  else
    echo "  ❌ $agent: frontmatter 格式错误"
  fi
done

echo ""
echo "3. 检查 Agent 内容..."
for agent in "${AGENTS[@]}"; do
  file=".claude/agents/${agent}.md"
  lines=$(wc -l < "$file")
  echo "  ✅ $agent: $lines 行"
done

echo ""
echo "4. 验证 Agent 模型配置..."
echo "  - test-architect: $(grep "^model:" .claude/agents/test-architect.md | cut -d' ' -f2)"
echo "  - unit-test-engineer: $(grep "^model:" .claude/agents/unit-test-engineer.md | cut -d' ' -f2)"
echo "  - integration-test-engineer: $(grep "^model:" .claude/agents/integration-test-engineer.md | cut -d' ' -f2)"
echo "  - test-reviewer: $(grep "^model:" .claude/agents/test-reviewer.md | cut -d' ' -f2)"
echo "  - test-diagnostician: $(grep "^model:" .claude/agents/test-diagnostician.md | cut -d' ' -f2)"

echo ""
echo "=========================================="
echo "✅ Week 5 Agent 定义验证完成"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 在 Claude Code 中测试调用这些 Agent"
echo "2. 验证 Agent 能否正确使用 Tool"
echo "3. 开始 Week 6: 实现 TestOrchestrator"
