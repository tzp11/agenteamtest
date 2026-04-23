#!/bin/bash
# Test script for TestDiscoveryTool
# Usage: ./test-week9-discovery.sh

set -e

cd "$(dirname "$0")"

echo "========================================"
echo "Testing TestDiscoveryTool (Week 9)"
echo "========================================"

# Test 1: Check if the tool file exists
echo -e "\n[1/5] Checking tool file exists..."
if [ -f "src/tools/TestDiscoveryTool/TestDiscoveryTool.ts" ]; then
    echo "✓ TestDiscoveryTool.ts exists"
else
    echo "✗ TestDiscoveryTool.ts not found"
    exit 1
fi

# Test 2: Check if coverage scanner exists
echo -e "\n[2/5] Checking coverage scanner..."
if [ -f "src/tools/TestDiscoveryTool/coverageScanner.ts" ]; then
    echo "✓ coverageScanner.ts exists"
else
    echo "✗ coverageScanner.ts not found"
    exit 1
fi

# Test 3: Check if complexity analyzer exists
echo -e "\n[3/5] Checking complexity analyzer..."
if [ -f "src/tools/TestDiscoveryTool/complexityAnalyzer.ts" ]; then
    echo "✓ complexityAnalyzer.ts exists"
else
    echo "✗ complexityAnalyzer.ts not found"
    exit 1
fi

# Test 4: Check if history analyzer exists
echo -e "\n[4/5] Checking history analyzer..."
if [ -f "src/tools/TestDiscoveryTool/historyAnalyzer.ts" ]; then
    echo "✓ historyAnalyzer.ts exists"
else
    echo "✗ historyAnalyzer.ts not found"
    exit 1
fi

# Test 5: Check if registered in tools.ts
echo -e "\n[5/5] Checking tools.ts registration..."
if grep -q "TestDiscoveryTool" "src/tools.ts"; then
    echo "✓ TestDiscoveryTool registered in tools.ts"
else
    echo "✗ TestDiscoveryTool not registered"
    exit 1
fi

echo -e "\n========================================"
echo "Week 9 TestDiscoveryTool - Basic Checks PASSED"
echo "========================================"
