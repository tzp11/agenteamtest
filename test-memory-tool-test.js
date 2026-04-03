#!/usr/bin/env node
/**
 * 测试 TestMemoryTool 的基本功能
 */

import { TestMemoryStorage } from './src/tools/TestMemoryTool/storage.js'

async function testStorage() {
  console.log('🧪 Testing TestMemoryTool Storage...\n')

  const storage = new TestMemoryStorage()

  // 测试 1: 记录测试结果
  console.log('Test 1: Recording test results...')
  await storage.recordTest({
    testName: 'test_login_success',
    result: 'pass',
    timestamp: Date.now(),
    executionTime: 125,
    filePath: 'tests/auth.test.ts'
  })

  await storage.recordTest({
    testName: 'test_login_invalid',
    result: 'fail',
    timestamp: Date.now(),
    executionTime: 89,
    filePath: 'tests/auth.test.ts',
    errorMessage: 'TypeError: Cannot read property token',
    stackTrace: 'at login.ts:45'
  })

  await storage.recordTest({
    testName: 'test_login_success',
    result: 'pass',
    timestamp: Date.now(),
    executionTime: 130,
    filePath: 'tests/auth.test.ts'
  })

  console.log('✅ Recorded 3 test results\n')

  // 测试 2: 查询历史
  console.log('Test 2: Querying history...')
  const history = await storage.queryHistory({
    testName: 'test_login_success',
    limit: 10
  })
  console.log(`✅ Found ${history.length} records for test_login_success`)
  console.log(JSON.stringify(history, null, 2))
  console.log()

  // 测试 3: 获取统计
  console.log('Test 3: Getting statistics...')
  const stats = await storage.getStatistics()
  console.log(`✅ Found statistics for ${stats.length} tests`)
  for (const stat of stats) {
    console.log(`  - ${stat.testName}: ${stat.passCount}/${stat.totalRuns} passed (${(stat.passRate * 100).toFixed(1)}%)`)
  }
  console.log()

  // 测试 4: 获取失败模式
  console.log('Test 4: Getting failure patterns...')
  const patterns = await storage.getFailurePatterns(5)
  console.log(`✅ Found ${patterns.length} failure patterns`)
  for (const pattern of patterns) {
    console.log(`  - "${pattern.errorSignature.substring(0, 50)}..." (${pattern.count} occurrences)`)
  }
  console.log()

  console.log('🎉 All tests passed!')
}

testStorage().catch(console.error)
