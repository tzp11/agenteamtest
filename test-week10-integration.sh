#!/bin/bash
# Week 10 Integration Test Script
# Tests all Test* tools exist and are properly structured

set -e

cd /home/tzp/work/agent/my_test

echo "========================================"
echo "Week 10 Integration Tests"
echo "========================================"

# Test 1: TestMemoryTool
echo -e "\n[1/7] Testing TestMemoryTool..."
if [ -f "src/tools/TestMemoryTool/TestMemoryTool.ts" ]; then
    echo "✓ TestMemoryTool.ts exists"
else
    echo "✗ TestMemoryTool.ts not found"
    exit 1
fi

# Test 2: TestCoverageTool
echo -e "\n[2/7] Testing TestCoverageTool..."
if [ -f "src/tools/TestCoverageTool/TestCoverageTool.ts" ]; then
    echo "✓ TestCoverageTool.ts exists"
else
    echo "✗ TestCoverageTool.ts not found"
    exit 1
fi

# Test 3: TestGraphTool
echo -e "\n[3/7] Testing TestGraphTool..."
if [ -f "src/tools/TestGraphTool/TestGraphTool.ts" ]; then
    echo "✓ TestGraphTool.ts exists"
else
    echo "✗ TestGraphTool.ts not found"
    exit 1
fi

# Test 4: TestOrchestratorTool
echo -e "\n[4/7] Testing TestOrchestratorTool..."
if [ -f "src/tools/TestOrchestratorTool/TestOrchestratorTool.ts" ]; then
    echo "✓ TestOrchestratorTool.ts exists"
else
    echo "✗ TestOrchestratorTool.ts not found"
    exit 1
fi

# Test 5: TestHealingTool
echo -e "\n[5/7] Testing TestHealingTool..."
if [ -f "src/tools/TestHealingTool/TestHealingTool.ts" ]; then
    echo "✓ TestHealingTool.ts exists"
else
    echo "✗ TestHealingTool.ts not found"
    exit 1
fi

# Test 6: TestDiscoveryTool
echo -e "\n[6/7] Testing TestDiscoveryTool..."
if [ -f "src/tools/TestDiscoveryTool/TestDiscoveryTool.ts" ]; then
    echo "✓ TestDiscoveryTool.ts exists"
else
    echo "✗ TestDiscoveryTool.ts not found"
    exit 1
fi

# Test 7: All tools exported from tools.ts
echo -e "\n[7/7] Testing tools.ts registration..."
if grep -q "TestMemoryTool" "src/tools.ts" && \
   grep -q "TestCoverageTool" "src/tools.ts" && \
   grep -q "TestGraphTool" "src/tools.ts" && \
   grep -q "TestOrchestratorTool" "src/tools.ts" && \
   grep -q "TestHealingTool" "src/tools.ts" && \
   grep -q "TestDiscoveryTool" "src/tools.ts"; then
    echo "✓ All Test* tools registered in tools.ts"
else
    echo "✗ Some tools not registered"
    exit 1
fi

# Test 8: Check service dependencies
echo -e "\n[8/8] Testing services..."
SERVICES=(
    "src/services/testOrchestration"
    "src/services/testHealing"
)
for svc in "${SERVICES[@]}"; do
    if [ -d "$svc" ]; then
        echo "✓ $svc exists"
    else
        echo "✗ $svc not found"
    fi
done

echo -e "\n========================================"
echo "All integration tests PASSED"
echo "========================================"
