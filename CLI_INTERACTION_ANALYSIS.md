# Claude Workbench CLI 交互实现分析报告

**分析日期**: 2025-10-20
**项目版本**: v3.0.2
**技术栈**: React 18 + Tauri 2 + Rust
**分析范围**: 斜杠命令处理、CLI 交互、会话执行

---

## 📋 执行摘要

Claude Workbench 通过 **Tauri IPC 机制** 实现前端-后端通信。斜杠命令系统采用 **三层架构**：
1. **前端交互层** - React 组件捕获 / 符号并显示命令菜单
2. **IPC 桥接层** - Tauri invoke 调用 Rust 命令
3. **后端执行层** - Rust 从文件系统加载命令并执行 Claude CLI

---

## 🏗️ 系统架构

### 1. 前端交互流程

```
用户输入 "/"
   ↓
detectSlashSymbol() [useSlashCommands.ts:27-40]
   ↓
setShowSlashCommandPicker(true)
   ↓
SlashCommandPicker 组件加载 [SlashCommandPicker.tsx:88-90]
   ↓
invoke("slash_commands_list", { projectPath }) [api.ts:1214]
   ↓
【Tauri IPC Bridge】
   ↓
Rust: slash_commands_list() [slash_commands.rs:523]
   ↓
返回命令列表 JSON
   ↓
用户选择命令
   ↓
handleSlashCommandSelect() [useSlashCommands.ts:70-121]
   ↓
替换 prompt: beforeSlash + command.full_command + afterCursor
   ↓
用户提交提示 (Enter)
   ↓
usePromptExecution.handleSendPrompt()
   ↓
isSlashCommand() 检测 [translationMiddleware.ts]
   ↓
invoke("execute_claude_code" / "continue_claude_code" / "resume_claude_code")
   ↓
Rust: 构建命令行参数 → spawn_claude_process()
   ↓
Claude CLI 进程启动
```

### 2. 关键组件交互矩阵

| 组件/文件 | 功能 | 调用关系 |
|---------|-----|---------|
| `FloatingPromptInput/index.tsx` | 主输入组件 | 调用 useSlashCommands |
| `useSlashCommands.ts` | / 检测和命令处理 | 调用 SlashCommandPicker |
| `SlashCommandPicker.tsx` | 命令菜单 UI | 调用 api.slashCommandsList() |
| `api.ts:1212-1284` | IPC 包装器 | invoke("slash_commands_list") |
| `usePromptExecution.ts` | 会话执行 | 调用 api.executeClaudeCode() |
| `slash_commands.rs:523-605` | 后端实现 | 扫描文件系统、加载命令 |
| `claude.rs:1600-1695` | CLI 执行 | 构建命令行、启动进程 |

---

## 🔍 核心实现细节

### A. 前端 - 斜杠符号检测

**文件**: `src/components/FloatingPromptInput/hooks/useSlashCommands.ts`
**行号**: 27-40

```typescript
const detectSlashSymbol = (newValue: string, newCursorPosition: number) => {
  if (newValue.length > prompt.length && newValue[newCursorPosition - 1] === '/') {
    // 检查是否在行首或空格后
    const isStartOfCommand = newCursorPosition === 1 ||
      (newCursorPosition > 1 && /\s/.test(newValue[newCursorPosition - 2]));

    if (isStartOfCommand) {
      console.log('[useSlashCommands] / detected for slash command');
      setShowSlashCommandPicker(true);
      setSlashCommandQuery("");
    }
  }
};
```

**关键点**:
- 检测 `/` 字符输入
- 验证位置: 行首 (`cursorPosition === 1`) 或空格后 (`/\s/`)
- 触发状态: `setShowSlashCommandPicker(true)`

---

### B. 菜单加载 - IPC 调用

**前端** - `src/lib/api.ts:1212-1219`

```typescript
async slashCommandsList(projectPath?: string): Promise<SlashCommand[]> {
  try {
    return await invoke<SlashCommand[]>("slash_commands_list", { projectPath });
  } catch (error) {
    console.error("Failed to list slash commands:", error);
    throw error;
  }
}
```

**Rust 后端** - `src-tauri/src/commands/slash_commands.rs:523-584`

```rust
#[tauri::command]
pub async fn slash_commands_list(
    project_path: Option<String>,
) -> Result<Vec<SlashCommand>, String> {
    info!("Discovering slash commands");
    let mut commands = Vec::new();

    // 1️⃣ 加载默认命令
    commands.extend(create_default_commands());

    // 2️⃣ 加载项目命令 (如果提供了项目路径)
    if let Some(proj_path) = project_path {
        let project_commands_dir = PathBuf::from(&proj_path)
            .join(".claude")
            .join("commands");
        if project_commands_dir.exists() {
            debug!("Scanning project commands at: {:?}", project_commands_dir);
            let mut md_files = Vec::new();
            if let Err(e) = find_markdown_files(&project_commands_dir, &mut md_files) {
                error!("Failed to find project command files: {}", e);
            } else {
                for file_path in md_files {
                    match load_command_from_file(&file_path, &project_commands_dir, "project") {
                        Ok(cmd) => {
                            debug!("Loaded project command: {}", cmd.full_command);
                            commands.push(cmd);
                        }
                        Err(e) => {
                            error!("Failed to load command from {:?}: {}", file_path, e);
                        }
                    }
                }
            }
        }
    }

    // 3️⃣ 加载用户命令
    if let Some(home_dir) = dirs::home_dir() {
        let user_commands_dir = home_dir.join(".claude").join("commands");
        if user_commands_dir.exists() {
            debug!("Scanning user commands at: {:?}", user_commands_dir);
            let mut md_files = Vec::new();
            if let Err(e) = find_markdown_files(&user_commands_dir, &mut md_files) {
                error!("Failed to find user command files: {}", e);
            } else {
                for file_path in md_files {
                    match load_command_from_file(&file_path, &user_commands_dir, "user") {
                        Ok(cmd) => {
                            debug!("Loaded user command: {}", cmd.full_command);
                            commands.push(cmd);
                        }
                        Err(e) => {
                            error!("Failed to load command from {:?}: {}", file_path, e);
                        }
                    }
                }
            }
        }
    }

    info!("Found {} slash commands", commands.len());
    Ok(commands)
}
```

**加载优先级** (由低到高):
1. 默认命令 (内置): `/help`, `/ask`, `/code`, `/debug`, `/optimize`, `/test`, `/explain`, `/vim`
2. 项目命令: `<project>/.claude/commands/*.md`
3. 用户命令: `~/.claude/commands/*.md`

---

### C. 命令文件解析

**文件**: `src-tauri/src/commands/slash_commands.rs:115-167`

```rust
fn load_command_from_file(
    file_path: &Path,
    base_path: &Path,
    scope: &str,
) -> Result<SlashCommand> {
    debug!("Loading command from: {:?}", file_path);

    // 1️⃣ 读取文件
    let content = fs::read_to_string(file_path)
        .context("Failed to read command file")?;

    // 2️⃣ 解析 YAML frontmatter 和 markdown 内容
    let (frontmatter, body) = parse_markdown_with_frontmatter(&content)?;

    // 3️⃣ 提取命令信息 (从路径)
    let (name, namespace) = extract_command_info(file_path, base_path)?;

    // 4️⃣ 构建完整命令 (格式: /namespace:name 或 /name)
    let full_command = match &namespace {
        Some(ns) => format!("/{ns}:{name}"),
        None => format!("/{name}"),
    };

    // 5️⃣ 生成唯一 ID
    let id = format!("{}-{}", scope, file_path.to_string_lossy().replace('/', "-"));

    // 6️⃣ 检测特殊内容
    let has_bash_commands = body.contains("!`");        // Bash 命令: !command
    let has_file_references = body.contains('@');       // 文件引用: @filepath
    let accepts_arguments = body.contains("$ARGUMENTS"); // 参数: $ARGUMENTS

    // 7️⃣ 提取元数据
    let (description, allowed_tools) = if let Some(fm) = frontmatter {
        (fm.description, fm.allowed_tools.unwrap_or_default())
    } else {
        (None, Vec::new())
    };

    Ok(SlashCommand {
        id,
        name,
        full_command,
        scope: scope.to_string(),
        namespace,
        file_path: file_path.to_string_lossy().to_string(),
        content: body,
        description,
        allowed_tools,
        has_bash_commands,
        has_file_references,
        accepts_arguments,
    })
}
```

**支持的文件格式**:
```markdown
---
description: "命令描述"
allowed-tools:
  - Read
  - Grep
  - Edit
---

命令的 markdown 内容

包含 @filepath 文件引用
包含 !`bash command` 命令
包含 $ARGUMENTS 参数占位符
```

---

### D. 命令选择和替换

**文件**: `src/components/FloatingPromptInput/hooks/useSlashCommands.ts:70-121`

```typescript
const handleSlashCommandSelect = (command: SlashCommand) => {
  const textarea = isExpanded ? expandedTextareaRef.current : textareaRef.current;
  if (!textarea) return;

  // 1️⃣ 查找光标前的 / 位置
  let slashPosition = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    if (prompt[i] === '/') {
      slashPosition = i;
      break;
    }
  }

  if (slashPosition === -1) {
    setShowSlashCommandPicker(false);
    setSlashCommandQuery("");
    return;
  }

  // 2️⃣ 分割文本
  const beforeSlash = prompt.substring(0, slashPosition);
  const afterCursor = prompt.substring(cursorPosition);

  if (command.accepts_arguments) {
    // 3️⃣ 如果命令接受参数，插入命令并留出空间
    const newPrompt = `${beforeSlash}${command.full_command} `;
    onPromptChange(newPrompt);
    setShowSlashCommandPicker(false);

    // 4️⃣ 定位光标
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = newPrompt.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      onCursorPositionChange(newCursorPos);
    }, 0);
  } else {
    // 5️⃣ 否则直接替换并保留后续文本
    const newPrompt = `${beforeSlash}${command.full_command} ${afterCursor}`;
    onPromptChange(newPrompt);
    setShowSlashCommandPicker(false);

    // 6️⃣ 定位光标在命令后
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = beforeSlash.length + command.full_command.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      onCursorPositionChange(newCursorPos);
    }, 0);
  }
};
```

---

### E. 会话执行流程

**文件**: `src/hooks/usePromptExecution.ts` + `src-tauri/src/commands/claude.rs`

**前端执行**:
```typescript
// usePromptExecution.ts:407-456
await api.executeClaudeCode(projectPath, processedPrompt, model, isPlanMode);
```

**Rust 处理** - `claude.rs:1600-1622`:
```rust
#[tauri::command]
pub async fn execute_claude_code(
    app: AppHandle,
    project_path: String,
    prompt: String,
    model: String,
    plan_mode: Option<bool>,
) -> Result<(), String> {
    let plan_mode = plan_mode.unwrap_or(false);

    // 1️⃣ 查找 Claude CLI 二进制文件
    let claude_path = find_claude_binary(&app)?;

    // 2️⃣ 获取执行配置
    let mut execution_config = get_claude_execution_config(app.clone()).await
        .unwrap_or_else(|e| {
            log::warn!("Failed to load execution config, using default: {}", e);
            ClaudeExecutionConfig::default()
        });

    // 3️⃣ 如果启用 Plan Mode，使用 Claude CLI 原生的 plan 权限模式
    if plan_mode {
        execution_config.permissions = ClaudePermissionConfig::plan_mode();
    }

    // 4️⃣ 映射模型名称
    let mapped_model = map_model_to_claude_alias(&model);

    // 5️⃣ 构建执行参数
    let args = build_execution_args(&execution_config, &prompt, &mapped_model, escape_prompt_for_cli);

    // 6️⃣ 创建系统命令
    let cmd = create_system_command(&claude_path, args, &project_path, Some(&mapped_model))?;

    // 7️⃣ 生成并启动 Claude 进程
    spawn_claude_process(app, cmd, prompt, model, project_path).await
}
```

---

## ❌ 斜杠命令失败诊断

### 问题 1: 菜单不显示

**症状**: 输入 `/` 后没有出现命令菜单

**可能原因**:
1. **前端问题** (检查 `useSlashCommands.ts`):
   - [ ] `detectSlashSymbol()` 未被触发
   - [ ] `/` 后面有空格而不是直接在行首 (需要 `isStartOfCommand` 检查)
   - [ ] `showSlashCommandPicker` 状态未改变

2. **IPC 调用失败** (检查浏览器控制台):
   ```javascript
   // 在 SlashCommandPicker.tsx:88-90 添加调试
   console.log('[SlashCommandPicker] Loading commands for:', projectPath);
   api.slashCommandsList(projectPath)
     .then(cmds => console.log('Commands loaded:', cmds))
     .catch(err => console.error('Commands load failed:', err));
   ```

3. **Tauri IPC 错误** (检查 Tauri 日志):
   - 命令 `slash_commands_list` 未注册在 `main.rs:193`
   - 序列化失败

4. **后端文件系统问题** (检查 Rust 日志):
   - `dirs::home_dir()` 返回 `None` (Windows: 需要检查 `USERPROFILE` 环境变量)
   - 文件权限不足

---

### 问题 2: 命令列表获取失败

**症状**: 菜单出现但为空，或收到错误信息

**诊断步骤**:

1. **检查日志** (Rust 端):
   ```bash
   # Tauri 控制台中查看
   info!("Discovering slash commands");           # 应该出现
   info!("Found {} slash commands", commands.len()); # 显示数量
   error!("Failed to find project command files: {}", e); # 如果出现
   ```

2. **验证目录存在**:
   ```bash
   # Windows PowerShell
   Test-Path "$env:USERPROFILE\.claude\commands"
   Get-ChildItem "$env:USERPROFILE\.claude\commands" -Recurse -Filter "*.md"
   ```

3. **检查文件格式**:
   - 文件必须是 `.md` 扩展名
   - YAML frontmatter 可选但必须有效
   - 路径不能包含隐藏文件 (以 `.` 开头的目录被跳过)

4. **HOME 环境变量问题** (Windows 特定):
   ```rust
   // claude.rs 中使用的备选方案
   let home_dir = std::env::var("HOME")
       .or_else(|_| std::env::var("USERPROFILE"))
       .unwrap_or_else(|_| "~".to_string());
   ```

---

### 问题 3: 命令选择后提示未更新

**症状**: 选择命令后，输入框中没有显示命令

**可能原因**:
1. `handleSlashCommandSelect()` 函数中:
   - [ ] `slashPosition` 未找到 (返回 -1)
   - [ ] `beforeSlash` 计算错误
   - [ ] `onPromptChange` 回调未触发

2. **测试代码**:
   ```typescript
   // useSlashCommands.ts 中添加
   console.log('[handleSlashCommandSelect]', {
     slashPosition,
     beforeSlash: prompt.substring(0, slashPosition),
     afterCursor: prompt.substring(cursorPosition),
     newPrompt,
   });
   ```

---

### 问题 4: Claude CLI 进程启动失败

**症状**: 选择命令、提交提示后，没有看到响应

**诊断**:
1. **检查 Claude 二进制文件**:
   ```bash
   # 验证 Claude CLI 安装
   which claude        # macOS/Linux
   where claude        # Windows
   claude --version    # 检查版本
   ```

2. **检查执行权限配置** (`claude.rs:1656-1660`):
   ```rust
   let execution_config = get_claude_execution_config(app.clone()).await
       .unwrap_or_else(|e| {
           log::warn!("Failed to load execution config, using default: {}", e);
           ClaudeExecutionConfig::default()
       });
   ```

3. **查看进程生成错误** (添加日志):
   ```rust
   // spawn_claude_process 中
   match spawn_claude_process(...).await {
       Ok(_) => Ok(()),
       Err(e) => {
           log::error!("Failed to spawn process: {}", e);
           Err(e)
       }
   }
   ```

---

## 📁 关键文件参考

### 前端文件

| 文件路径 | 行号 | 功能 |
|---------|-----|------|
| `src/lib/api.ts` | 1212-1284 | IPC 命令包装器 |
| `src/components/SlashCommandPicker.tsx` | 全文 | 菜单 UI 组件 |
| `src/components/FloatingPromptInput/hooks/useSlashCommands.ts` | 全文 | / 检测和处理逻辑 |
| `src/hooks/usePromptExecution.ts` | 407-456 | 提示执行流程 |
| `src/lib/translationMiddleware.ts` | 全文 | 斜杠命令识别 |

### Rust 后端文件

| 文件路径 | 行号 | 功能 |
|---------|-----|------|
| `src-tauri/src/commands/slash_commands.rs` | 523-605 | 命令列表实现 |
| `src-tauri/src/commands/slash_commands.rs` | 115-167 | 命令文件解析 |
| `src-tauri/src/commands/slash_commands.rs` | 170-198 | 文件系统扫描 |
| `src-tauri/src/commands/claude.rs` | 1600-1695 | CLI 执行实现 |
| `src-tauri/src/main.rs` | 193 | 命令注册 |

---

## 🔧 调试技巧

### 1. 启用详细日志

**前端** (React 组件中):
```typescript
// 在 useSlashCommands.ts 中
console.log('[useSlashCommands] detectSlashSymbol', { newValue, newCursorPosition, isStartOfCommand });
console.log('[useSlashCommands] updateSlashCommandQuery', { slashCommandQuery });
console.log('[useSlashCommands] handleSlashCommandSelect', { command });
```

**后端** (Rust 中):
```bash
# 启用 Rust 日志 (RUST_LOG 环境变量)
RUST_LOG=debug npm run tauri:dev
```

### 2. Tauri 调试

```bash
# 在 Tauri 主窗口中 Ctrl+Shift+I 打开开发者工具
# 查看 Console 标签显示的 IPC 调用
```

### 3. 本地命令文件测试

创建测试命令文件:
```bash
# Windows PowerShell
mkdir "$env:USERPROFILE\.claude\commands"
@"
---
description: "测试命令"
allowed-tools:
  - Read
  - Grep
---

这是一个测试命令。

@\$ARGUMENTS
"@ | Out-File "$env:USERPROFILE\.claude\commands\test.md" -Encoding UTF8
```

---

## 📊 IPC 命令清单

### 斜杠命令相关

```typescript
// 获取命令列表
invoke<SlashCommand[]>("slash_commands_list", { projectPath?: string })

// 获取单个命令
invoke<SlashCommand>("slash_command_get", { commandId: string })

// 保存命令
invoke<SlashCommand>("slash_command_save", {
  scope: 'project' | 'user',
  name: string,
  namespace?: string,
  content: string,
  description?: string,
  allowedTools: string[],
  projectPath?: string
})

// 删除命令
invoke<string>("slash_command_delete", { commandId: string, projectPath?: string })
```

### 会话执行相关

```typescript
// 执行新会话
invoke<void>("execute_claude_code", {
  projectPath: string,
  prompt: string,
  model: 'sonnet' | 'opus' | 'sonnet1m',
  planMode?: boolean
})

// 继续对话
invoke<void>("continue_claude_code", {
  projectPath: string,
  prompt: string,
  model: 'sonnet' | 'opus' | 'sonnet1m',
  planMode?: boolean
})

// 恢复会话
invoke<void>("resume_claude_code", {
  projectPath: string,
  sessionId: string,
  prompt: string,
  model: 'sonnet' | 'opus' | 'sonnet1m',
  planMode?: boolean
})
```

---

## 🎯 总结

### 系统优势
✅ 完全分离的前后端架构 (React + Tauri)
✅ 类型安全的 IPC 通信 (TypeScript + Rust)
✅ 灵活的命令组织 (YAML frontmatter + markdown)
✅ 多层级命令加载 (默认 → 项目 → 用户)
✅ 完整的权限控制

### 常见故障点
❌ HOME/USERPROFILE 环境变量问题
❌ 文件格式解析失败
❌ IPC 序列化异常
❌ Claude CLI 二进制不可用
❌ 目录权限不足

### 调试优先级
1. 检查 Tauri IPC 日志 (浏览器开发者工具)
2. 验证 HOME 环境变量和 `.claude` 目录存在
3. 检查 Rust 日志 (RUST_LOG=debug)
4. 测试 Claude CLI 直接可用性
5. 验证文件格式和路径正确性

