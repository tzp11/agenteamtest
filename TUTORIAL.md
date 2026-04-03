# Claude Code 自定义工具开发教程

本项目是 Claude Code 的本地开发版本，用于开发和测试自定义工具。

## 目录结构

```
/home/tzp/work/agent/my_test/
├── src/
│   ├── tools/                    # 工具目录
│   │   ├── SimpleTestTool/       # 简单测试工具
│   │   ├── TestMemoryTool/       # 测试记忆工具
│   │   └── TestCoverageTool/     # 测试覆盖率工具
│   ├── entrypoints/              # 入口文件
│   └── utils/                    # 工具函数
├── test/                         # 默认工作目录
│   ├── .claude/                  # Claude 运行时数据（自动创建）
│   │   ├── test-memory/          # 测试历史数据
│   │   └── memory/               # 会话记忆
│   └── README.md
├── bin/
│   └── claude-haha               # 启动脚本
├── .env                          # 环境配置
├── start.sh                      # 正常启动
├── start-debug.sh                # 调试启动
├── test-simple-tool.sh           # 测试 SimpleTestTool
└── test-all-tools.sh             # 测试所有工具
```

## 快速开始

### 1. 启动 Claude Code

```bash
# 正常启动（工作目录：test/）
./start.sh

# 调试模式启动
./start-debug.sh
```

### 2. 测试自定义工具

在 Claude Code 交互界面中：

```
# 测试 SimpleTestTool
使用 SimpleTestTool 发送消息 "Hello World"

# 测试 TestMemoryTool - 记录测试
使用 TestMemoryTool 记录一个测试结果：测试名称 test_login，结果 pass，执行时间 125

# 测试 TestMemoryTool - 查询
使用 TestMemoryTool 查询常见的失败模式

# 测试 TestCoverageTool
使用 TestCoverageTool 检测项目语言
```

### 3. 非交互式测试

```bash
# 测试单个工具
./test-simple-tool.sh

# 测试所有工具
./test-all-tools.sh
```

## 开发自定义工具

### 工具结构

每个工具需要实现以下接口：

```typescript
import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'

// 1. 定义输入 schema
const inputSchema = z.strictObject({
  message: z.string().describe('参数描述')
})

type InputSchema = z.infer<typeof inputSchema>

// 2. 使用 buildTool 创建工具
export const YourTool = buildTool({
  name: 'YourTool',
  
  maxResultSizeChars: 1000,
  
  // 3. 描述方法（可选参数）
  async description() {
    return '工具的详细描述'
  },
  
  // 4. 提示方法（可选参数）
  async prompt() {
    return '工具的简短描述'
  },
  
  // 5. 输入 schema
  get inputSchema() {
    return inputSchema
  },
  
  // 6. UI 渲染（可选参数）
  renderToolUseMessage() {
    return null
  },
  
  // 7. 结果映射（必需两个参数）
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: JSON.stringify(content)
    }
  },
  
  // 8. 核心逻辑（可以省略后面的参数）
  call: async (args: InputSchema) => {
    // 实现工具逻辑
    return {
      data: {
        result: 'success',
        message: args.message
      }
    }
  }
})
```

### 关键要点

1. **方法签名**：
   - `description()` 和 `prompt()` 可以不接受参数
   - `mapToolResultToToolResultBlockParam(content, toolUseID)` 必须接受两个参数
   - `call()` 可以只接受 `args` 参数，其他参数可选

2. **返回格式**：
   ```typescript
   // 成功
   return { data: { /* 数据 */ } }
   
   // 失败
   return { data: null, error: '错误信息' }
   ```

3. **注册工具**：
   在 `src/tools.ts` 中导入并添加到工具列表：
   ```typescript
   import { YourTool } from './tools/YourTool/YourTool.js'
   
   export function getAllBaseTools(): Tools {
     return [
       // ... 其他工具
       YourTool,
     ]
   }
   ```

## 常见问题修复

### 问题 1: 工具调用失败，显示"内部错误"

**原因**：`mapToolResultToToolResultBlockParam` 方法签名不正确

**修复**：
```typescript
// ❌ 错误
mapToolResultToToolResultBlockParam(result) {
  return result
}

// ✅ 正确
mapToolResultToToolResultBlockParam(content, toolUseID) {
  return {
    type: 'tool_result' as const,
    tool_use_id: toolUseID,
    content: JSON.stringify(content)
  }
}
```

### 问题 2: MACRO is not defined

**原因**：没有正确加载 `preload.ts`

**修复**：使用 `bin/claude-haha` 启动，不要直接调用 bun

```bash
# ❌ 错误
bun --env-file=.env ./src/entrypoints/cli.tsx

# ✅ 正确
./bin/claude-haha
```

### 问题 3: 工作目录不正确

**原因**：启动脚本没有切换到 `test/` 目录

**修复**：使用提供的启动脚本
```bash
./start.sh        # 自动在 test/ 目录启动
./start-debug.sh  # 调试模式
```

## Git 工作流程

### 初始化仓库

```bash
git init
git add .
git commit -m "feat: 初始化 Claude Code 自定义工具项目"
```

### 开发新功能

```bash
# 1. 创建功能分支
git checkout -b feature/new-tool

# 2. 开发工具
# 编辑 src/tools/NewTool/NewTool.ts

# 3. 测试工具
./test-simple-tool.sh

# 4. 提交更改
git add src/tools/NewTool/
git commit -m "feat: 添加 NewTool 工具"

# 5. 合并到主分支
git checkout main
git merge feature/new-tool
```

### 修复 Bug

```bash
# 1. 创建修复分支
git checkout -b fix/tool-error

# 2. 修复代码
# 编辑相关文件

# 3. 测试修复
./test-all-tools.sh

# 4. 提交修复
git add .
git commit -m "fix: 修复 TestMemoryTool 的 mapToolResultToToolResultBlockParam 方法"

# 5. 合并到主分支
git checkout main
git merge fix/tool-error
```

### 提交规范

使用 Conventional Commits 规范：

- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `style:` - 代码格式调整
- `refactor:` - 重构
- `test:` - 测试相关
- `chore:` - 构建/工具相关

示例：
```bash
git commit -m "feat: 添加 SimpleTestTool 用于基础测试"
git commit -m "fix: 修复工具方法签名问题"
git commit -m "docs: 更新使用教程"
```

## 环境配置

### .env 文件

```bash
# API 配置
ANTHROPIC_AUTH_TOKEN=your-token-here
ANTHROPIC_BASE_URL=https://api.qnaigc.com
ANTHROPIC_MODEL=claude-sonnet-4-6

# 超时设置
API_TIMEOUT_MS=60000

# 调试选项
DEBUG=*
CLAUDE_CODE_DEBUG=1
NODE_ENV=development
```

### 模型配置

支持的模型：
- `claude-sonnet-4-6` - 推荐，平衡性能和成本
- `claude-opus-4-6` - 最强性能
- `deepseek-v3` - 经济选择

## 调试技巧

### 1. 启用调试模式

```bash
./start-debug.sh
```

### 2. 查看详细日志

```bash
# 在 .env 中添加
DEBUG=*
CLAUDE_CODE_DEBUG=1
```

### 3. 测试单个工具

```bash
# 创建测试脚本
cat > test-my-tool.sh << 'EOF'
#!/bin/bash
cd /home/tzp/work/agent/my_test/test
../bin/claude-haha --print "使用 MyTool 测试参数"
EOF

chmod +x test-my-tool.sh
./test-my-tool.sh
```

### 4. 检查工具输出

```typescript
call: async (args: InputSchema) => {
  console.log('输入参数:', args)  // 调试输出
  
  const result = {
    data: { message: 'success' }
  }
  
  console.log('返回结果:', result)  // 调试输出
  return result
}
```

## 最佳实践

1. **工具命名**：使用清晰的名称，如 `TestMemoryTool`、`TestCoverageTool`
2. **参数验证**：在 `call` 方法中验证必需参数
3. **错误处理**：使用 try-catch 捕获异常，返回友好的错误信息
4. **文档注释**：为工具添加详细的描述和使用示例
5. **测试覆盖**：为每个工具创建测试脚本
6. **版本控制**：及时提交代码，使用有意义的提交信息

## 参考资源

- [Claude Code 官方文档](https://docs.anthropic.com/claude/docs)
- [Zod Schema 文档](https://zod.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)

## 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-tool`)
3. 提交更改 (`git commit -m 'feat: 添加 amazing-tool'`)
4. 推送到分支 (`git push origin feature/amazing-tool`)
5. 创建 Pull Request

## 许可证

本项目仅供学习和开发使用。
