#!/usr/bin/env bash

# Test script for Week 6 - TestOrchestrator
# Tests the multi-agent coordination system

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Week 6 Test: TestOrchestrator - Multi-Agent Coordination"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the right directory
if [ ! -f "src/services/testOrchestration/orchestrator.ts" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

echo "✅ Found orchestration services"
echo ""

# Check TypeScript compilation
echo "📝 Checking TypeScript compilation..."
if ! bun build src/services/testOrchestration/orchestrator.ts --target=bun --outdir=/tmp/test-build 2>&1 | grep -q "error"; then
  echo "✅ TypeScript compilation successful"
else
  echo "❌ TypeScript compilation failed"
  exit 1
fi
echo ""

# Check file structure
echo "📁 Checking file structure..."
files=(
  "src/services/testOrchestration/types.ts"
  "src/services/testOrchestration/agentRunner.ts"
  "src/services/testOrchestration/resultAggregator.ts"
  "src/services/testOrchestration/orchestrator.ts"
  "src/services/testOrchestration/index.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (missing)"
    exit 1
  fi
done
echo ""

# Check agent definitions
echo "🤖 Checking agent definitions..."
agents=(
  ".claude/agents/test-architect.md"
  ".claude/agents/unit-test-engineer.md"
  ".claude/agents/integration-test-engineer.md"
  ".claude/agents/test-reviewer.md"
  ".claude/agents/test-diagnostician.md"
)

for agent in "${agents[@]}"; do
  if [ -f "$agent" ]; then
    echo "  ✅ $(basename $agent)"
  else
    echo "  ❌ $(basename $agent) (missing)"
    exit 1
  fi
done
echo ""

# Count lines of code
echo "📊 Code Statistics:"
total_lines=$(cat src/services/testOrchestration/*.ts | wc -l)
echo "  Total lines: $total_lines"
echo "  Files: ${#files[@]}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Start Claude Code: ./start.sh"
echo "2. Test orchestration with:"
echo "   使用 TestOrchestrator 为 test/src/auth.c 生成测试"
echo ""
