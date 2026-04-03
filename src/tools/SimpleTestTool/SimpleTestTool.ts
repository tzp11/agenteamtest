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

  mapToolResultToToolResultBlockParam(result) {
    return result
  },

  call: async (args: InputSchema, context, canUseTool, parentMessage) => {
    return {
      data: {
        echo: args.message,
        timestamp: Date.now()
      }
    }
  }
})
