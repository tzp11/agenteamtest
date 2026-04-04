# Claude Code 启动问题排查

## 问题现象

`--print` 模式启动后卡住，无法接收输入或输出结果。

## 已确认正常的部分

✅ CLI 可以显示 `--version`
✅ API 连接正常（curl 测试通过）
✅ Bun 和 preload 正常工作
✅ 依赖已安装（better-sqlite3）

## 问题原因

`--print` 模式在等待 API 响应时超时或卡住。

## 解决方案

### 方案 1：使用交互模式（推荐）

不要使用 `--print` 模式，直接启动交互模式：

```bash
cd /home/tzp/work/agent/my_test
./start.sh
```

或者：

```bash
cd /home/tzp/work/agent/my_test/test
../bin/claude-haha
```

### 方案 2：检查是否有卡住的进程

```bash
# 查看是否有 bun 进程
ps aux | grep bun

# 杀掉所有 bun 进程
pkill -9 bun

# 然后重新启动
./start.sh
```

### 方案 3：使用 --bare 模式

```bash
cd /home/tzp/work/agent/my_test/test
../bin/claude-haha --bare
```

## 测试 TestGraphTool 的正确方法

1. **启动交互模式**
   ```bash
   cd /home/tzp/work/agent/my_test
   ./start.sh
   ```

2. **等待启动完成**（看到 Claude Code 的提示符）

3. **在聊天框中输入测试命令**
   ```
   使用 TestGraphTool 初始化数据库
   ```

4. **查看结果**

## 如果还是无法启动

检查以下内容：

1. **检查端口占用**
   ```bash
   lsof -i :* | grep bun
   ```

2. **检查日志**
   ```bash
   ls -la ~/.claude/debug/
   cat ~/.claude/debug/*.log
   ```

3. **尝试最小化配置**
   ```bash
   export CLAUDE_CODE_SIMPLE=1
   ./start.sh
   ```

4. **检查 API 配额**
   - 确认 API key 有效
   - 确认没有超过速率限制

## 已知问题

- `--print` 模式在某些情况下会卡住
- 建议使用交互模式进行测试
