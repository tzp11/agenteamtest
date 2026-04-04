#!/usr/bin/env bun

// Week 5 Agent 注册验证脚本
// 检查自定义 Agent 是否被正确加载到系统中

import { getAgentDefinitionsWithOverrides } from './src/tools/AgentTool/loadAgentsDir.ts';

async function main() {
  console.log('========================================');
  console.log('Week 5 Agent 注册验证');
  console.log('========================================\n');

  const cwd = process.cwd();
  console.log(`工作目录: ${cwd}\n`);

  try {
    const result = await getAgentDefinitionsWithOverrides(cwd);

    console.log(`总共加载的 Agent: ${result.allAgents.length}`);
    console.log(`激活的 Agent: ${result.activeAgents.length}\n`);

    // 检查我们的测试 Agent
    const testAgents = [
      'test-architect',
      'unit-test-engineer',
      'integration-test-engineer',
      'test-reviewer',
      'test-diagnostician'
    ];

    console.log('检查 Week 5 测试 Agent:');
    console.log('----------------------------------------');

    for (const agentType of testAgents) {
      const found = result.activeAgents.find(a => a.agentType === agentType);
      if (found) {
        console.log(`✅ ${agentType}`);
        console.log(`   - 描述: ${found.whenToUse.substring(0, 60)}...`);
        console.log(`   - 模型: ${found.model || '继承'}`);
        console.log(`   - 来源: ${found.source}`);
      } else {
        console.log(`❌ ${agentType} - 未找到`);
      }
    }

    console.log('\n所有激活的 Agent:');
    console.log('----------------------------------------');
    result.activeAgents.forEach(agent => {
      console.log(`- ${agent.agentType} (${agent.source})`);
    });

    if (result.failedFiles && result.failedFiles.length > 0) {
      console.log('\n⚠️  加载失败的文件:');
      console.log('----------------------------------------');
      result.failedFiles.forEach(f => {
        console.log(`- ${f.path}`);
        console.log(`  错误: ${f.error}`);
      });
    }

    console.log('\n========================================');
    const allFound = testAgents.every(type =>
      result.activeAgents.find(a => a.agentType === type)
    );

    if (allFound) {
      console.log('✅ 所有 Week 5 Agent 已成功注册！');
    } else {
      console.log('❌ 部分 Agent 未注册');
      process.exit(1);
    }
    console.log('========================================');

  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

main();
