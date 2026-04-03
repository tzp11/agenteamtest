import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'

const inputSchema = z.strictObject({
  message: z.string().describe('Test message')
})

type InputSchema = z.infer<typeof inputSchema>

export const SimpleTestTool = buildTool({
  name: 'SimpleTestTool',

  maxResultSizeChars: 1000,

  async description() {
    return 'A simple test tool that just echoes back your message'
  },

  async prompt() {
    return 'A simple test tool that just echoes back your message'
  },

  get inputSchema() {
    return inputSchema
  },

  renderToolUseMessage() {
    return null
  },

  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: JSON.stringify(content)
    }
  },

  call: async (args: InputSchema) => {
    return {
      data: {
        echo: args.message,
        timestamp: Date.now()
      }
    }
  }
})
