# 斜杠命令系统 - 快速参考卡

## 🎯 三层架构速览

```
┌─────────────────────────────────────────────────────────────┐
│ 第 1 层: 前端交互 (React/TypeScript)                        │
├─────────────────────────────────────────────────────────────┤
│ useSlashCommands.ts (第27-121行)                           │
│ ├─ detectSlashSymbol() → 检测 / 符号                       │
│ ├─ updateSlashCommandQuery() → 更新查询                    │
│ └─ handleSlashCommandSelect() → 处理选择                   │
│                                                             │
│ SlashCommandPicker.tsx                                      │
│ └─ 调用 api.slashCommandsList(projectPath)                │
└────────────┬────────────────────────────────────────────────┘
             │ Tauri IPC invoke()
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 第 2 层: IPC 桥接 (Tauri)                                   │
├─────────────────────────────────────────────────────────────┤
│ api.ts:1212-1219 (前端)                                     │
│ invoke<SlashCommand[]>("slash_commands_list", { projectPath })
│                                                             │
│ main.rs:193 (注册点)                                       │
│ .invoke_handler(tauri::generate_handler![              │
│     slash_commands_list,                                   │
│     ...                                                    │
│ ])                                                         │
└────────────┬────────────────────────────────────────────────┘
             │ Rust 方法调用
             ↓
┌─────────────────────────────────────────────────────────────┐
│ 第 3 层: 后端实现 (Rust)                                   │
├─────────────────────────────────────────────────────────────┤
│ slash_commands.rs:523-584                                  │
│ pub async fn slash_commands_list() -> Result<Vec<...>>    │
│ ├─ create_default_commands()                              │
│ ├─ find_markdown_files(project_commands_dir)              │
│ ├─ load_command_from_file() for each .md                  │
│ └─ find_markdown_files(user_commands_dir)                 │
│                                                             │
│ 返回: JSON Vec<SlashCommand>                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 关键数据结构

### SlashCommand 类型定义

**位置**: `src/lib/api.ts:295-308` 和 `src-tauri/src/commands/slash_commands.rs:8-35`

```typescript
interface SlashCommand {
  id: string;                    // 唯一标识符: "{scope}-{path}"
  name: string;                  // 命令名称: "optimize"
  full_command: string;          // 完整命令: "/project:optimize" 或 "/optimize"
  scope: string;                 // 范围: "default" | "project" | "user"
  namespace?: string;            // 命名空间: "frontend:components"
  file_path: string;             // 文件路径
  content: string;               // Markdown 内容体
  description?: string;          // 描述 (从 YAML)
  allowed_tools: string[];       // 允许的工具 (从 YAML)
  has_bash_commands: boolean;    // 是否包含 !` 命令
  has_file_references: boolean;  // 是否包含 @ 文件引用
  accepts_arguments: boolean;    // 是否接受 $ARGUMENTS
}
```

### 命令文件格式

```markdown
---
description: "命令的人类可读描述"
allowed-tools:
  - Read
  - Grep
  - Edit
  - Write
  - Bash
---

# 标题可选

命令的 Markdown 内容可以包含：

1. **文件引用** (使用 @符号):
   - @src/components/Button.tsx
   - @src/lib/utils.ts

2. **Bash 命令** (使用 !`):
   - !`npm run build`
   - !`git status`

3. **参数占位符** (使用 $ARGUMENTS):
   - 分析这些文件: $ARGUMENTS
   - 测试: $ARGUMENTS

## 示例

@src/components/MyComponent.tsx

!`npm test`

优化 $ARGUMENTS
```

---

## 🔍 执行流程追踪

### 示例场景: 用户输入 "/opt" 并选择 "/optimize"

```
时间轴                          │ 代码位置                    │ 状态变化
─────────────────────────────────┼──────────────────────────────┼──────────────
用户输入 "/"                     │ TextArea input event         │
     ↓                           │                              │ prompt="/opt"
detectSlashSymbol()              │ useSlashCommands.ts:27-40    │ detectSlashSymbol(
   检测 / 在行首 ✓               │                              │  "/opt", pos=1)
     ↓                           │                              │
setShowSlashCommandPicker(true)   │ useSlashCommands.ts:35      │ showSlash
   状态改变                       │                              │ CommandPicker=true
     ↓                           │                              │
【UI 显示菜单】                   │ SlashCommandPicker.tsx      │
   useEffect 触发                │ 第 88-90 行                  │
     ↓                           │                              │
api.slashCommandsList(project)    │ api.ts:1214                 │ invoke IPC
     ↓                           │ 【Tauri Bridge】            │
[Windows 进程边界]               │                              │
     ↓                           │                              │
Rust: slash_commands_list()       │ slash_commands.rs:523-584   │
   create_default_commands()      │ 第 530 行                   │
   scan project/.claude/commands  │ 第 533-554 行               │
   scan ~/.claude/commands        │ 第 557-579 行               │
     ↓                           │                              │
返回 JSON 数组                    │ Result<Vec<SlashCommand>>   │
     ↓                           │ 【Tauri Bridge】            │
[浏览器进程边界]                 │                              │
     ↓                           │                              │
setCommands(result)              │ SlashCommandPicker.tsx      │ commands=[...]
     ↓                           │ 第 77 行                     │
显示下拉列表                      │                              │
   带搜索过滤                     │ useEffect:94-149            │ filteredCommands
   /opt → 匹配 /optimize          │                              │ =[{optimize}]
     ↓                           │                              │
用户点击 /optimize                │ SlashCommandPicker.tsx      │
     ↓                           │ onSelect callback           │
handleSlashCommandSelect()        │ useSlashCommands.ts:70-121  │
   查找 / 位置                    │ 第 74-81 行                 │ slashPos=0
   分割: before="", after="t"    │                              │
   生成: "/optimize t"           │                              │
   更新 prompt                    │ onPromptChange()            │ prompt="/optim
     ↓                           │                              │  ize t"
【关闭菜单】                      │ setShowSlashCommandPicker   │
setShowSlashCommandPicker(false)  │ (false)                     │
     ↓                           │                              │
UI 返回单行输入框                 │                              │
     ↓                           │                              │
用户继续编辑或按 Enter            │ onSend callback             │
    "优化这段代码"               │                              │ prompt="/optim
     ↓                           │                              │ ize t优化这段代码"
提交 prompt                       │ handleSendPrompt()          │
     ↓                           │ usePromptExecution.ts       │
【处理提示】                      │ 第 407 行                   │
isSlashCommand(prompt)?          │ translationMiddleware.ts    │ → true
     ↓ YES                        │                              │
调用 executeClaudeCode()          │ api.ts:656-661              │ invoke IPC
     ↓                           │ 【Tauri Bridge】            │
Rust: execute_claude_code()       │ claude.rs:1600-1695         │
   find_claude_binary()           │ 第 1618 行                  │
   build_execution_args()         │ 第 1614 行                  │
   create_system_command()        │ 第 1620 行                  │
   spawn_claude_process()         │ 第 1621 行                  │
     ↓                           │                              │
Claude CLI 子进程启动             │ tokio::spawn()              │
   读取斜杠命令内容                │                              │ claude -c
   执行命令                       │                              │ "/optimize..."
     ↓                           │                              │
事件发送: "claude_output"         │ app.emit()                  │
   流式响应到前端                 │                              │
```

---

## ❌ 常见错误及解决

### 错误 1: "Failed to list slash commands"

```
症状: SlashCommandPicker 显示错误消息
日志: console.error("Failed to list slash commands:", error)

检查清单:
☐ Tauri 开发者工具是否显示 IPC 调用失败?
☐ slash_commands_list 是否在 main.rs 中注册?
☐ Rust 后端日志中是否有错误?
☐ dirs::home_dir() 是否返回 None?

解决步骤:
1. RUST_LOG=debug npm run tauri:dev
2. 查找日志中的 "Discovering slash commands" 信息
3. 检查 "Failed to find" 错误信息
4. 验证 ~/.claude/commands 目录权限
```

### 错误 2: 菜单为空

```
症状: 菜单出现但只有默认命令 (help, ask, code 等)
原因: 未找到用户/项目命令文件

检查清单:
☐ ~/.claude/commands/ 目录是否存在?
☐ 文件是否为 .md 扩展名?
☐ 路径是否包含隐藏目录 (被跳过)?
☐ YAML frontmatter 格式是否正确?

验证命令:
# Windows PowerShell
Get-ChildItem "$env:USERPROFILE\.claude\commands" -Recurse -Filter "*.md"
Get-ChildItem "$env:USERPROFILE\.claude\commands" -Recurse -Filter ".*" -Directory

# 测试文件格式
@"
---
description: Test
---
Test command
"@ | Out-File "$env:USERPROFILE\.claude\commands\test.md" -Encoding UTF8
```

### 错误 3: 命令选择后无响应

```
症状: 选择命令, 提交提示, 但没有响应
原因: Claude CLI 进程启动失败

检查清单:
☐ Claude CLI 是否已安装?
☐ claude --version 是否有效?
☐ Rust 日志中是否显示 "Failed to spawn process"?
☐ 执行权限配置是否正确?

验证 Claude:
# Windows PowerShell
where claude
claude --version
claude --help | head -10

# 直接测试
claude -c "Hello, world!"
```

### 错误 4: Windows 路径问题

```
症状: 日志显示 "could not find home directory"
原因: HOME/USERPROFILE 环境变量不可用

检查清单:
☐ echo %HOME% 是否返回值?
☐ echo %USERPROFILE% 是否返回值?
☐ 两者是否都为空?

解决方案:
# Windows PowerShell
$env:HOME = $env:USERPROFILE
$env:USERPROFILE = "C:\Users\YourUsername"

# 永久设置 (需要重启应用)
[Environment]::SetEnvironmentVariable("HOME", $env:USERPROFILE, "User")
```

---

## 🧪 测试命令

### 创建测试命令

```powershell
# Windows PowerShell

# 1. 创建目录
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\commands"

# 2. 创建简单命令
@"
---
description: "Generate documentation"
allowed-tools:
  - Read
  - Grep
  - Write
---

Generate comprehensive documentation for:

@`$ARGUMENTS

Include:
- Function signatures
- Parameter descriptions
- Return values
- Usage examples
"@ | Out-File "$env:USERPROFILE\.claude\commands\docs.md" -Encoding UTF8

# 3. 创建命名空间命令
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\commands\frontend"

@"
---
description: "Optimize React component"
allowed-tools:
  - Read
  - Edit
  - Grep
---

Optimize this React component for performance:

@`$ARGUMENTS

Focus on:
- Memoization opportunities
- Unnecessary re-renders
- Bundle size reduction
"@ | Out-File "$env:USERPROFILE\.claude\commands\frontend\optimize.md" -Encoding UTF8

# 4. 验证
Get-ChildItem "$env:USERPROFILE\.claude\commands" -Recurse -Filter "*.md"
```

### 在 Workbench 中测试

1. 打开 Workbench
2. 开始新会话
3. 在提示输入框中输入 `/`
4. 查看是否显示菜单，包括:
   - 默认命令: `/help`, `/ask`, `/code`
   - 用户命令: `/docs`, `/frontend:optimize`
5. 选择 `/docs` 并输入参数
6. 提交并观察响应

---

## 📊 性能优化

### 缓存策略

当前实现:
- 每次 `/` 后都重新加载命令 (热加载)
- 可以实现缓存减少文件系统访问

### 建议优化

```typescript
// 在 SlashCommandPicker.tsx 中
const [commandsCache, setCommandsCache] = useState<Map<string, SlashCommand[]>>(new Map());

useEffect(() => {
  const projectKey = projectPath || "default";

  if (commandsCache.has(projectKey)) {
    setCommands(commandsCache.get(projectKey)!);
    return;
  }

  loadCommands().then(cmds => {
    setCommandsCache(prev => new Map(prev).set(projectKey, cmds));
    setCommands(cmds);
  });
}, [projectPath, commandsCache]);
```

---

## 🔐 安全考虑

### 权限模型

```rust
// 从命令文件的 allowed-tools 读取
pub struct SlashCommand {
    pub allowed_tools: Vec<String>, // ["Read", "Grep", "Edit"]
}

// 执行时验证
fn validate_slash_command_permissions(
    command: &SlashCommand,
    execution_config: &ClaudeExecutionConfig,
) -> Result<(), String> {
    // 确保 allowed-tools 不超出执行配置
    for tool in &command.allowed_tools {
        if !execution_config.permissions.allowed_tools.contains(tool) {
            return Err(format!("Tool {} not allowed by execution config", tool));
        }
    }
    Ok(())
}
```

### 防护措施

```markdown
❌ 危险模式 - 避免:
allowed-tools: ["*"]  # 允许所有工具
!`rm -rf /`          # 危险的 bash 命令
@/*                  # 模糊的文件引用

✅ 安全模式 - 推荐:
allowed-tools: ["Read", "Grep", "Edit"]  # 明确指定
!`npm test`                              # 安全的命令
@src/components/Button.tsx              # 精确的引用
```

---

## 📝 调试检查清单

在遇到斜杠命令问题时，按顺序检查:

- [ ] **前端检查** (浏览器开发者工具):
  - [ ] `/ 符号检测是否工作? (输入 / 后是否出现菜单选择器)
  - [ ] IPC 调用是否显示在网络标签?
  - [ ] SlashCommandPicker 组件是否挂载?

- [ ] **IPC 检查** (Tauri 日志):
  - [ ] invoke("slash_commands_list") 是否被调用?
  - [ ] 返回什么错误 (如果有)?
  - [ ] 序列化格式是否正确?

- [ ] **后端检查** (Rust 日志 `RUST_LOG=debug`):
  - [ ] "Discovering slash commands" 消息是否出现?
  - [ ] 找到多少个命令?
  - [ ] "Failed to find" 错误是否出现?

- [ ] **文件系统检查**:
  - [ ] ~/.claude/commands 目录是否存在?
  - [ ] 文件是否为 .md 扩展?
  - [ ] 权限是否允许读取?
  - [ ] YAML frontmatter 格式是否有效?

- [ ] **环境检查**:
  - [ ] HOME / USERPROFILE 是否设置?
  - [ ] Claude CLI 是否可访问?
  - [ ] 项目路径参数是否正确?

