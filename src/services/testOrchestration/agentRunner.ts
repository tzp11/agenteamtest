/**
 * Agent Runner - Executes individual agents and handles their lifecycle
 */

import type { AgentTask, AgentResult } from './types.js'

export class AgentRunner {
  /**
   * Execute a single agent task
   * Note: This is a placeholder. Actual agent execution should be done
   * by the caller using the Agent tool directly.
   */
  async runAgent(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now()

    console.log(`[AgentRunner] Agent execution requested: ${task.agentType}`)
    console.log(`[AgentRunner] This is a placeholder - actual execution should use Agent tool`)

    // Return a mock result indicating the agent should be called externally
    return {
      agentType: task.agentType,
      success: false,
      output: null,
      error: 'AgentRunner cannot execute agents directly. Use Agent tool from the main context.',
      executionTime: Date.now() - startTime
    }
  }

  /**
   * Execute multiple agents in parallel
   */
  async runParallel(tasks: AgentTask[]): Promise<AgentResult[]> {
    console.log(`[AgentRunner] Running ${tasks.length} agents in parallel`)

    const promises = tasks.map(task => this.runAgent(task))
    const results = await Promise.all(promises)

    const successCount = results.filter(r => r.success).length
    console.log(`[AgentRunner] Parallel execution complete: ${successCount}/${tasks.length} succeeded`)

    return results
  }

  /**
   * Execute agents sequentially with dependency handling
   */
  async runSequential(tasks: AgentTask[]): Promise<AgentResult[]> {
    console.log(`[AgentRunner] Running ${tasks.length} agents sequentially`)

    const results: AgentResult[] = []

    for (const task of tasks) {
      const result = await this.runAgent(task)
      results.push(result)

      // Stop if a critical agent fails
      if (!result.success && task.agentType === 'test-architect') {
        console.error('[AgentRunner] Critical agent failed, stopping execution')
        break
      }
    }

    return results
  }

  /**
   * Parse agent output based on agent type
   */
  parseAgentOutput(agentType: string, output: any): any {
    if (!output) return null

    try {
      // If output is a string, try to extract structured data
      if (typeof output === 'string') {
        // Look for JSON blocks
        const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1])
        }

        // Return raw string if no JSON found
        return { rawOutput: output }
      }

      return output
    } catch (error) {
      console.warn(`[AgentRunner] Failed to parse ${agentType} output:`, error)
      return { rawOutput: String(output) }
    }
  }
}
