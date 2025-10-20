# 代码导航 - 斜杠命令系统

## 🗺️ 关键代码位置速查

### 前端 - 第一步入口

```
【用户输入 "/"】
         ↓
📄 src/components/FloatingPromptInput/index.tsx (主输入组件)
   - 第 37-50 行: FloatingPromptInputInner 组件定义
   - 第 63-83 行: useSlashCommands hook 初始化

         ↓
📄 src/components/FloatingPromptInput/hooks/useSlashCommands.ts (核心逻辑)
   ├─ 第 27-40 行: detectSlashSymbol() - / 检测函数
   │  输入: newValue="hello /", newCursorPosition=8
   │  输出: setShowSlashCommandPicker(true)
   │
   ├─ 第 43-67 行: updateSlashCommandQuery() - 查询更新
   │  作用: 随用户输入更新 slashCommandQuery
   │  例: "/" → "/opt" → "/optim"
   │
   └─ 第 70-121 行: handleSlashCommandSelect() - 命令选择
      输入: command={name: "optimize", full_command: "/optimize"}
      处理: 替换 "/" 和查询文本为完整命令
      输出: newPrompt="/optimize $ARGUMENTS"

         ↓
【UI 显示菜单】
         ↓
📄 src/components/SlashCommandPicker.tsx (菜单 UI)
   ├─ 第 70-90 行: 组件初始化和 props 接收
   ├─ 第 88-90 行: useEffect 触发 loadCommands()
   │  └─ 调用: api.slashCommandsList(projectPath)
   │
   ├─ 第 92-150 行: useEffect 过滤命令
   │  输入: searchQuery (用户输入后的部分)
   │  输出: filteredCommands (按相关性排序)
   │
   ├─ 第 151-170 行: 键盘导航处理
   │ │ 上下箭头选择
   │ │ Enter 确认选择
   │ └─ Escape 关闭菜单
   │
   └─ 第 171+ 行: 渲染菜单项和分组
```

---

### IPC 通信桥梁

```
【前端调用 api.slashCommandsList()】
         ↓
📄 src/lib/api.ts:1212-1219 (IPC 包装器)
┌─────────────────────────────────┐
│ async slashCommandsList(         │
│   projectPath?: string           │
│ ): Promise<SlashCommand[]>       │
│ {                               │
│   return await invoke<          │
│     SlashCommand[]              │
│   >(                            │
│     "slash_commands_list",       │ ← IPC 命令名
│     { projectPath }             │ ← 传递参数
│   );                            │
│ }                               │
└────────────┬────────────────────┘
             │ Tauri IPC 序列化
             │ Window → Rust 进程
             ↓
📄 src-tauri/src/main.rs:117-200 (命令注册)
   - 第 193 行: slash_commands::slash_commands_list,
                          ↑ 注册 Rust 函数
```

---

### Rust 后端 - 核心实现

```
【Rust 执行 slash_commands_list 函数】
         ↓
📄 src-tauri/src/commands/slash_commands.rs:523-584

#[tauri::command]
pub async fn slash_commands_list(
    project_path: Option<String>,
) -> Result<Vec<SlashCommand>, String>

🔍 函数流程:

1. 初始化 Vec
   let mut commands = Vec::new();

2. 🟢 加载默认命令 (第 530 行)
   commands.extend(create_default_commands());
   输出: [/help, /ask, /code, /debug, /optimize, /test, /explain, /vim]

3. 🟡 加载项目命令 (第 533-554 行)
   if let Some(proj_path) = project_path {
       project_commands_dir = proj_path/.claude/commands
       find_markdown_files() → load_command_from_file()
   }

4. 🔵 加载用户命令 (第 557-579 行)
   dirs::home_dir() → ~/.claude/commands
   find_markdown_files() → load_command_from_file()

5. 📤 返回结果 (第 582-583 行)
   info!("Found {} slash commands", commands.len());
   Ok(commands)
```

---

### 命令文件解析

```
【扫描和解析 .md 文件】
         ↓
📄 src-tauri/src/commands/slash_commands.rs:170-198

fn find_markdown_files(dir: &Path, files: &mut Vec<PathBuf>)
   - 递归遍历目录
   - 跳过隐藏文件 (以 '.' 开头)
   - 只收集 .md 扩展文件
   - 返回: Vec<PathBuf> 包含所有 .md 文件

         ↓
📄 src-tauri/src/commands/slash_commands.rs:115-167

fn load_command_from_file(
    file_path: &Path,
    base_path: &Path,
    scope: &str  // "default" | "project" | "user"
) -> Result<SlashCommand>

📖 关键步骤:

a) 读取文件 (第 123-124 行)
   let content = fs::read_to_string(file_path)?;

b) 解析 frontmatter (第 127 行)
   let (frontmatter, body) = parse_markdown_with_frontmatter(&content)?;
   结果: (CommandFrontmatter, String)
        - frontmatter: { description, allowed_tools }
        - body: 去除 YAML 后的内容

c) 提取命令信息 (第 130 行)
   let (name, namespace) = extract_command_info(file_path, base_path)?;
   例如:
   - File: frontend/optimize.md
   - Output: (name="optimize", namespace=Some("frontend"))

d) 构建完整命令 (第 133-136 行)
   let full_command = match &namespace {
       Some(ns) => format!("/{ns}:{name}"),
       None => format!("/{name}"),
   };
   例: "/frontend:optimize"

e) 检测特殊内容 (第 142-144 行)
   has_bash_commands = body.contains("!`");
   has_file_references = body.contains('@');
   accepts_arguments = body.contains("$ARGUMENTS");

f) 返回 SlashCommand 结构 (第 153-166 行)
   SlashCommand {
       id,
       name,
       full_command,
       scope,
       namespace,
       file_path,
       content: body,
       description,
       allowed_tools,
       has_bash_commands,
       has_file_references,
       accepts_arguments,
   }
```

---

### Markdown + YAML 解析

```
📄 src-tauri/src/commands/slash_commands.rs:45-82

fn parse_markdown_with_frontmatter(content: &str)
    -> Result<(Option<CommandFrontmatter>, String)>

🔍 解析流程:

输入:
---
description: "My command"
allowed-tools:
  - Read
  - Grep
---

Command body content here
with multiple lines

步骤 1: 检查开头是否为 --- (第 50 行)
   if lines[0] != "---" {
       return Ok((None, content.to_string()));  // 无 frontmatter
   }

步骤 2: 查找结尾 --- (第 56-62 行)
   for (i, line) in lines.iter().enumerate().skip(1) {
       if *line == "---" {
           frontmatter_end = Some(i);
           break;
       }
   }

步骤 3: 提取 YAML 部分 (第 66 行)
   let frontmatter_content = lines[1..end].join("\n");
   结果: "description: \"My command\"\nallowed-tools:\n  - Read\n  - Grep"

步骤 4: 提取内容体 (第 67 行)
   let body_content = lines[(end + 1)..].join("\n");
   结果: "Command body content here\nwith multiple lines"

步骤 5: YAML 反序列化 (第 70 行)
   match serde_yaml::from_str::<CommandFrontmatter>(&frontmatter_content) {
       Ok(frontmatter) => Ok((Some(frontmatter), body_content)),
       Err(e) => {
           debug!("Failed to parse frontmatter: {}", e);
           Ok((None, content.to_string()))
       }
   }
```

---

### 会话执行

```
【用户选择命令并提交】
         ↓
📄 src/hooks/usePromptExecution.ts:407-456

async function handleSendPrompt(prompt, model, thinkingInstruction)

步骤 1: 处理翻译 (第 370-423 行)
   const processedPrompt = translationMiddleware.translate(prompt);

步骤 2: 检测是否为斜杠命令 (第 ???)
   const isSlash = isSlashCommand(processedPrompt);

步骤 3: 决定执行方式
   if (isFirstPrompt) {
       ✅ 新会话: await api.executeClaudeCode()
   } else if (isSlash) {
       ✅ 继续模式: await api.continueClaudeCode()
   } else {
       ✅ 恢复会话: await api.resumeClaudeCode()
   }

         ↓
【IPC 调用 Rust 端】
         ↓
📄 src-tauri/src/commands/claude.rs:1600-1695

pub async fn execute_claude_code(
    app: AppHandle,
    project_path: String,
    prompt: String,
    model: String,
    plan_mode: Option<bool>,
) -> Result<(), String>

🔧 执行步骤:

1️⃣ 查找 Claude CLI (第 1618 行)
   let claude_path = find_claude_binary(&app)?;
   - Windows: 检查 PATH
   - macOS: 检查 /usr/local/bin, /opt/homebrew
   - Linux: 检查 /usr/bin, /usr/local/bin

2️⃣ 获取执行配置 (第 1656-1660 行)
   let mut execution_config = get_claude_execution_config(app.clone()).await
       .unwrap_or_else(|e| {
           log::warn!("Failed to load execution config, using default: {}", e);
           ClaudeExecutionConfig::default()
       });

3️⃣ 处理 Plan Mode (第 1663-1665 行)
   if plan_mode {
       execution_config.permissions = ClaudePermissionConfig::plan_mode();
   }

4️⃣ 映射模型名称 (第 1674 行)
   let mapped_model = map_model_to_claude_alias(&model);
   示例: "sonnet" → "sonnet", "opus" → "opus"

5️⃣ 构建参数 (第 1675 行)
   let args = build_execution_args(
       &execution_config,
       &prompt,
       &mapped_model,
       escape_prompt_for_cli
   );
   结果: Vec<String> = ["-c", "command args..."]

6️⃣ 创建命令 (第 1684 行)
   let cmd = create_system_command(
       &claude_path,
       args,
       &project_path,
       Some(&mapped_model)
   )?;

7️⃣ 启动进程 (第 1685 行)
   spawn_claude_process(app, cmd, prompt, model, project_path).await
   - 创建子进程
   - 读取 stdout/stderr
   - 发送事件流
```

---

## 📑 完整文件树

```
src/
├── lib/
│   ├── api.ts                                  ⭐ IPC 接口定义 (1212-1284)
│   │   ├─ slashCommandsList()
│   │   ├─ slashCommandGet()
│   │   ├─ slashCommandSave()
│   │   ├─ slashCommandDelete()
│   │   ├─ executeClaudeCode()
│   │   ├─ continueClaudeCode()
│   │   └─ resumeClaudeCode()
│   │
│   ├── translationMiddleware.ts                 📝 文本处理和斜杠检测
│   │   └─ isSlashCommand()
│   │
│   └── sessionHelpers.ts                        🔧 会话辅助函数
│
├── components/
│   ├── FloatingPromptInput/                     🎯 主输入组件
│   │   ├── index.tsx                           (ref: 37-50, 63-83)
│   │   └── hooks/
│   │       └── useSlashCommands.ts              ⭐ 核心逻辑 (27-121)
│   │           ├─ detectSlashSymbol() [27-40]
│   │           ├─ updateSlashCommandQuery() [43-67]
│   │           └─ handleSlashCommandSelect() [70-121]
│   │
│   ├── SlashCommandPicker.tsx                   📋 菜单 UI (88-150)
│   ├── SlashCommandsManager.tsx                 🛠️ 命令管理
│   ├── ClaudeCodeSession.tsx                    💬 会话主体
│   └── message/
│       └── StreamMessageV2.tsx                  📨 消息显示
│
├── hooks/
│   ├── usePromptExecution.ts                    ⭐ 提示执行 (407-456)
│   ├── useSessionLifecycle.ts                   🔄 会话生命周期
│   ├── useMessageTranslation.ts                 🗣️ 消息翻译
│   └── useDisplayableMessages.ts                📊 消息过滤
│
└── types/
    ├── hooks.ts                                 🔌 类型定义
    └── claude.ts                                💬 Claude 类型

src-tauri/
├── src/
│   ├── main.rs                                  ⭐ 命令注册 (193)
│   │
│   ├── commands/
│   │   ├── slash_commands.rs                    ⭐ 斜杠命令实现 (523-605)
│   │   │   ├─ slash_commands_list() [523-584]
│   │   │   ├─ slash_command_get() [588-605]
│   │   │   ├─ load_command_from_file() [115-167]
│   │   │   ├─ find_markdown_files() [170-198]
│   │   │   └─ parse_markdown_with_frontmatter() [45-82]
│   │   │
│   │   ├── claude.rs                           ⭐ CLI 执行 (1600-1695)
│   │   │   ├─ execute_claude_code() [1600-1622]
│   │   │   ├─ continue_claude_code() [1560-1595]
│   │   │   ├─ resume_claude_code() [1627-1695]
│   │   │   ├─ create_system_command()
│   │   │   └─ spawn_claude_process()
│   │   │
│   │   ├── permission_config.rs                 🔐 权限配置
│   │   └── storage.rs                          💾 数据库
│   │
│   ├── claude_binary.rs                         🔍 二进制查找
│   ├── process/                                 🔄 进程管理
│   └── lib.rs                                   📚 模块声明
│
└── Cargo.toml                                   📦 依赖定义
```

---

## 🔗 关键函数调用链

### 场景 1: 加载菜单

```
用户输入 "/"
   ↓
detectSlashSymbol() [useSlashCommands.ts:27-40]
   ↓ 触发
setShowSlashCommandPicker(true)
   ↓ 导致
<SlashCommandPicker /> 挂载
   ↓ 触发
useEffect [SlashCommandPicker.tsx:88]
   ↓ 调用
loadCommands()
   ↓ 调用
api.slashCommandsList(projectPath) [api.ts:1214]
   ↓ IPC invoke
【Tauri Bridge】
   ↓
slash_commands_list() [slash_commands.rs:523]
   ├─ create_default_commands() [slash_commands.rs:500-519]
   ├─ find_markdown_files(project_commands_dir) [170-198]
   │  └─ load_command_from_file() [115-167]
   └─ find_markdown_files(user_commands_dir)
      └─ load_command_from_file()
   ↓ 返回
Vec<SlashCommand> JSON
   ↓ IPC 返回
【Tauri Bridge】
   ↓
setCommands(result) [SlashCommandPicker.tsx:77]
   ↓ 导致
setFilteredCommands(filtered) [SlashCommandPicker.tsx:145]
   ↓
🎨 UI 显示菜单
```

### 场景 2: 执行命令

```
用户选择 "/optimize" 命令
   ↓
onSelect callback [SlashCommandPicker.tsx:26]
   ↓
handleSlashCommandSelect(command) [useSlashCommands.ts:70]
   ├─ 查找 / 位置
   ├─ 分割 before/after
   └─ 更新 prompt
   ↓
用户继续输入并提交
   ↓
handleSendPrompt(prompt) [usePromptExecution.ts]
   ├─ 翻译处理
   └─ isSlashCommand() 检测 ✓
   ↓
api.executeClaudeCode() [api.ts:656]
   ↓ IPC invoke
【Tauri Bridge】
   ↓
execute_claude_code() [claude.rs:1600]
   ├─ find_claude_binary()
   ├─ get_claude_execution_config()
   ├─ build_execution_args()
   ├─ create_system_command()
   └─ spawn_claude_process()
   ↓
🔄 Claude CLI 进程启动
   ↓
📨 事件流回传前端
```

---

## 🐛 调试断点位置

### TypeScript/React 断点

```javascript
// 1. 斜杠检测
src/components/FloatingPromptInput/hooks/useSlashCommands.ts:35
  debugger;  // 在 setShowSlashCommandPicker 前

// 2. 菜单加载
src/components/SlashCommandPicker.tsx:89
  debugger;  // 在 loadCommands() 前

// 3. IPC 调用
src/lib/api.ts:1214
  debugger;  // 在 invoke 前

// 4. 命令选择
src/components/FloatingPromptInput/hooks/useSlashCommands.ts:95
  debugger;  // 在 handleSlashCommandSelect 前

// 5. 会话执行
src/hooks/usePromptExecution.ts:407
  debugger;  // 在 executeClaudeCode 前
```

### Rust 调试断点

```rust
// 1. 命令列表加载
src-tauri/src/commands/slash_commands.rs:526
  info!("Discovering slash commands");
  println!("DEBUG: project_path = {:?}", project_path);

// 2. 文件扫描
src-tauri/src/commands/slash_commands.rs:539
  for file_path in md_files {
      println!("DEBUG: Loading file: {:?}", file_path);

// 3. 文件解析
src-tauri/src/commands/slash_commands.rs:120
  println!("DEBUG: Parsing file: {:?}", file_path);

// 4. CLI 执行
src-tauri/src/commands/claude.rs:1618
  let claude_path = find_claude_binary(&app)?;
  println!("DEBUG: Claude path: {:?}", claude_path);

// 5. 参数构建
src-tauri/src/commands/claude.rs:1675
  let args = build_execution_args(...);
  println!("DEBUG: Command args: {:?}", args);
```

---

## 📚 函数签名快速查询

```typescript
// src/lib/api.ts
async slashCommandsList(projectPath?: string): Promise<SlashCommand[]>
async slashCommandGet(commandId: string): Promise<SlashCommand>
async slashCommandSave(...): Promise<SlashCommand>
async slashCommandDelete(commandId: string, projectPath?: string): Promise<string>
async executeClaudeCode(projectPath, prompt, model, planMode?): Promise<void>
async continueClaudeCode(projectPath, prompt, model, planMode?): Promise<void>
async resumeClaudeCode(projectPath, sessionId, prompt, model, planMode?): Promise<void>

// src/components/FloatingPromptInput/hooks/useSlashCommands.ts
function useSlashCommands(options): {
  showSlashCommandPicker: boolean;
  slashCommandQuery: string;
  detectSlashSymbol(newValue, newCursorPosition): void;
  updateSlashCommandQuery(newValue, newCursorPosition): void;
  handleSlashCommandSelect(command): void;
  handleSlashCommandPickerClose(): void;
}

// src-tauri/src/commands/slash_commands.rs
pub async fn slash_commands_list(project_path: Option<String>) -> Result<Vec<SlashCommand>, String>
pub async fn slash_command_get(command_id: String) -> Result<SlashCommand, String>
fn load_command_from_file(file_path: &Path, base_path: &Path, scope: &str) -> Result<SlashCommand>
fn find_markdown_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<()>
fn parse_markdown_with_frontmatter(content: &str) -> Result<(Option<CommandFrontmatter>, String)>

// src-tauri/src/commands/claude.rs
pub async fn execute_claude_code(...) -> Result<(), String>
pub async fn continue_claude_code(...) -> Result<(), String>
pub async fn resume_claude_code(...) -> Result<(), String>
fn create_system_command(claude_path, args, project_path, model) -> Result<Command>
async fn spawn_claude_process(...) -> Result<(), String>
```

