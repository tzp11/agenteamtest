#!/usr/bin/env node
/**
 * 直接测试 TestMemoryTool 的功能
 */

import { TestMemoryTool } from './src/tools/TestMemoryTool/TestMemoryTool.ts'

async function testTool() {
  console.log('🧪 Testing TestMemoryTool directly...\n')

  // 测试 1: record 操作
  console.log('Test 1: Recording a test result...')
  const result1 = await TestMemoryTool.call({
    operation: 'record',
    testName: 'test_login_invalid',
    result: 'fail',
    errorMessage: "TypeError: Cannot read property 'token'",
    executionTime: 89
  })

  console.log('Result:', JSON.stringify(result1, null, 2))
  console.log()

  // 测试 2: query 操作
  console.log('Test 2: Querying test history...')
  const result2 = await TestMemoryTool.call({
    operation: 'query',
    limit: 10
  })

  console.log('Result:', JSON.stringify(result2, null, 2))
  console.log()

  // 测试 3: statistics 操作
  console.log('Test 3: Getting statistics...')
  const result3 = await TestMemoryTool.call({
    operation: 'statistics'
  })

  console.log('Result:', JSON.stringify(result3, null, 2))
  console.log()

  console.log('🎉 All tests completed!')
}

testTool().catch(console.error)
