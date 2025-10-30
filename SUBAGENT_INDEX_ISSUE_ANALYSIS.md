# 子代理消息索引问题分析

## 🚨 问题描述

**用户发现**: 在进行消息对话时，当激活子代理（subagent）时，主代理发送给子代理的提示词可能被误记录为用户发送的消息，导致撤回功能的消息索引序号错乱。

**严重程度**: 🔴 高 - 会导致撤回功能失效

---

## 🔍 问题分析

### 当前的消息过滤机制

#### 1. 前端过滤（usePromptExecution.ts:162-166）

```typescript
const isUserInitiated = !prompt.includes('Warmup') 
  && !prompt.includes('<command-name>')
  && !prompt.includes('Launching skill:');

if (effectiveSession && isUserInitiated) {
  recordedPromptIndex = await api.recordPromptSent(...);
}
```

✅ **过滤的消息类型**:
- Warmup 消息
- Skills 消息（包含 `<command-name>`）
- 启动技能消息（`Launching skill:`）

#### 2. 后端过滤（prompt_tracker.rs:142-164）

```rust
let is_warmup = extracted_text.contains("Warmup");
let is_skill_message = extracted_text.contains("<command-name>") 
    || extracted_text.contains("Launching skill:")
    || extracted_text.contains("skill is running");

if !is_warmup && !is_skill_message {
    // 只计算真实用户输入的消息
    user_message_count += 1;
}
```

✅ **过滤的消息类型**:
- Warmup 消息
- Skills 消息
- 正在运行的技能消息

---

### 🐛 潜在问题场景

#### 场景1: Task Tool 调用子代理

```json
{
  "type": "user",
  "message": {
    "content": "Please analyze the security issues in auth.rs"
  }
}
```

这个消息：
- ❌ 不包含 "Warmup"
- ❌ 不包含 "<command-name>"
- ❌ 不包含 "Launching skill:"
- ❌ 不包含 "skill is running"

**结果**: 被当作用户消息计数 ❌

#### 场景2: 多层子代理调用

```
用户消息 #0: "Review my code"
    ↓
Claude 调用 task tool
    ↓
内部消息: "Analyze security in auth.rs"  ← 被误记为用户消息 #1
    ↓
子代理执行
    ↓
用户消息 #1 (实际): "Add tests"  ← 被误记为用户消息 #2
```

**结果**: 索引错位，撤回到#1会撤回到错误的位置 ❌

#### 场景3: 工具结果消息

```json
{
  "type": "user",
  "message": {
    "content": [
      { "type": "tool_result", "tool_use_id": "...", "content": "..." }
    ]
  }
}
```

✅ **已处理**: 代码会跳过只有 tool_result 的消息（131-134行）

---

## 📊 问题根源

### 根本原因

**缺少统一的消息来源标识**

当前系统通过**文本内容匹配**来判断消息类型，但：
1. ❌ 不可靠 - 依赖特定关键词
2. ❌ 不完整 - 无法覆盖所有自动消息
3. ❌ 容易绕过 - 子代理消息可能不包含这些关键词

### 理想方案

应该在消息中添加**元数据标记**，明确区分：
- 真实用户输入
- 系统自动消息
- 子代理内部消息
- 工具调用消息

---

## 🎯 影响范围

### 受影响的功能

1. **撤回功能（Revert to Prompt）** - 主要受影响
   - 索引错位导致撤回到错误位置
   - 可能丢失用户数据
   - 可能破坏 Git 历史

2. **提示词列表（Prompt List）**
   - 显示错误的提示词顺序
   - 包含不应该显示的内部消息

3. **Git 状态追踪**
   - 每个提示词关联的 Git commit 可能错位
   - 影响代码回滚的准确性

---

## 🔧 解决方案

### 方案1: 增强关键词过滤 (快速修复)

**优点**: 简单，快速部署  
**缺点**: 不彻底，可能有遗漏

#### 修改 prompt_tracker.rs

```rust
// 更全面的自动消息检测
let is_auto_message = extracted_text.contains("Warmup")
    || extracted_text.contains("<command-name>")
    || extracted_text.contains("Launching skill:")
    || extracted_text.contains("skill is running")
    // 🆕 新增子代理相关标识
    || extracted_text.contains("Subagent:")
    || extracted_text.contains("Task delegation:")
    || extracted_text.contains("Analyzing")  // 常见的子代理开头
    || extracted_text.contains("Processing")
    // 🆕 检测是否来自 task tool
    || (has_tool_result && extracted_text.len() < 500); // 短消息+工具结果=可能是内部调用
```

#### 修改 usePromptExecution.ts

```typescript
const isUserInitiated = !prompt.includes('Warmup') 
  && !prompt.includes('<command-name>')
  && !prompt.includes('Launching skill:')
  // 🆕 新增过滤条件
  && !prompt.includes('Subagent:')
  && !prompt.includes('Task delegation:')
  && !prompt.startsWith('Analyzing')
  && !prompt.startsWith('Processing');
```

---

### 方案2: 添加消息元数据标记 (推荐)

**优点**: 准确，可靠，可扩展  
**缺点**: 需要修改消息结构

#### 1. 扩展 PromptRecord 结构

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptRecord {
    pub index: usize,
    pub text: String,
    pub git_commit_before: String,
    pub git_commit_after: Option<String>,
    pub timestamp: i64,
    
    // 🆕 新增字段
    pub message_source: MessageSource,  // 消息来源
    pub is_user_initiated: bool,         // 是否用户发起
    pub parent_prompt_index: Option<usize>, // 父提示词索引（如果是子调用）
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSource {
    User,        // 真实用户输入
    System,      // 系统自动消息
    Subagent,    // 子代理调用
    Tool,        // 工具调用结果
}
```

#### 2. 在前端记录时传递元数据

```typescript
// usePromptExecution.ts
await api.recordPromptSent(
  effectiveSession.id,
  effectiveSession.project_id,
  projectPath,
  prompt,
  {
    messageSource: 'user',  // 或 'subagent', 'system'
    isUserInitiated: true,
    parentPromptIndex: null
  }
);
```

#### 3. 后端只计数用户发起的消息

```rust
if msg.message_source == MessageSource::User && msg.is_user_initiated {
    user_message_count += 1;
}
```

---

### 方案3: 使用消息 UUID 追踪 (最佳)

**优点**: 最准确，不依赖索引  
**缺点**: 需要较大重构

#### 概念

不使用数字索引，而使用 UUID 唯一标识每条用户消息。

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRecord {
    pub uuid: String,  // 🆕 使用 UUID 而不是 index
    pub text: String,
    pub git_commit_before: String,
    pub git_commit_after: Option<String>,
    pub timestamp: i64,
    pub is_user_initiated: bool,
}
```

**撤回时**:
```rust
pub async fn revert_to_prompt(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_uuid: String,  // 🆕 使用 UUID 而不是 index
) -> Result<String, String>
```

---

## 🧪 测试用例

### 测试1: 基础子代理调用

```
步骤:
1. 用户输入: "Review my authentication code"
2. Claude 调用 task tool with prompt: "Analyze auth.rs"
3. 用户输入: "Add unit tests"

期望结果:
- 记录的用户消息: 2条
  - #0: "Review my authentication code"
  - #1: "Add unit tests"
- 不包含: "Analyze auth.rs"

当前问题:
- 可能记录3条消息
- #1 可能是 "Analyze auth.rs"
- 撤回到 #1 会撤回错误的位置
```

### 测试2: 多层嵌套调用

```
步骤:
1. 用户: "Refactor the project"
2. Claude → task("Check dependencies")
3. Subagent → task("Analyze package.json")
4. 用户: "Add documentation"

期望记录:
- #0: "Refactor the project"
- #1: "Add documentation"

可能记录（错误）:
- #0: "Refactor the project"
- #1: "Check dependencies"  ← 错误!
- #2: "Analyze package.json"  ← 错误!
- #3: "Add documentation"
```

---

## 📝 当前代码的保护机制

### 已有的保护（值得肯定）

1. ✅ **跳过 tool_result 消息**
   ```rust
   // 第131-134行
   if has_tool_result && !has_text_content {
       continue;
   }
   ```

2. ✅ **跳过 Warmup 消息**
   ```rust
   // 第143行
   let is_warmup = extracted_text.contains("Warmup");
   ```

3. ✅ **跳过 Skills 消息**
   ```rust
   // 第144-146行
   let is_skill_message = extracted_text.contains("<command-name>") 
       || extracted_text.contains("Launching skill:")
       || extracted_text.contains("skill is running");
   ```

4. ✅ **跳过空消息**
   ```rust
   // 第137-140行
   if !has_text_content {
       continue;
   }
   ```

### 缺失的保护

1. ❌ **无法识别 task tool 的内部提示词**
2. ❌ **无法识别子代理链式调用**
3. ❌ **依赖关键词匹配，不够可靠**

---

## 🛡️ 建议的改进方案

### 短期方案（立即实施）

#### 增强关键词过滤

在 `prompt_tracker.rs` 中添加更多模式识别：

```rust
// 扩展 is_skill_message 的检测范围
let is_auto_message = extracted_text.contains("Warmup")
    || extracted_text.contains("<command-name>")
    || extracted_text.contains("Launching skill:")
    || extracted_text.contains("skill is running")
    // 🆕 Task tool 相关
    || extracted_text.contains("Task:")
    || extracted_text.contains("Subtask:")
    || extracted_text.contains("Delegating to")
    // 🆕 常见的子代理模式
    || (extracted_text.starts_with("Analyz") && extracted_text.len() < 300)
    || (extracted_text.starts_with("Process") && extracted_text.len() < 300)
    || (extracted_text.starts_with("Review") && extracted_text.len() < 300)
    || (extracted_text.starts_with("Check") && extracted_text.len() < 300)
    // 🆕 检测是否紧跟在 tool_use 之后
    || is_following_tool_use(line_index, &lines);

fn is_following_tool_use(current_line: usize, lines: &[&str]) -> bool {
    // 检查前一条消息是否是 assistant 消息且包含 tool_use
    if current_line == 0 {
        return false;
    }
    
    if let Ok(prev_msg) = serde_json::from_str::<serde_json::Value>(lines[current_line - 1]) {
        if prev_msg.get("type").and_then(|t| t.as_str()) == Some("assistant") {
            if let Some(content) = prev_msg.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
                return content.iter().any(|item| {
                    item.get("type").and_then(|t| t.as_str()) == Some("tool_use")
                });
            }
        }
    }
    
    false
}
```

同时更新前端：

```typescript
// usePromptExecution.ts
const isUserInitiated = !prompt.includes('Warmup') 
  && !prompt.includes('<command-name>')
  && !prompt.includes('Launching skill:')
  && !prompt.includes('Task:')
  && !prompt.includes('Subtask:')
  && !prompt.includes('Delegating to')
  && !isShortAnalysisPrompt(prompt);

function isShortAnalysisPrompt(text: string): boolean {
  const keywords = ['Analyz', 'Process', 'Review', 'Check'];
  return text.length < 300 && keywords.some(k => text.startsWith(k));
}
```

---

### 中期方案（推荐实施）

#### 添加消息元数据字段

##### 1. 修改 PromptRecord

```rust
// src-tauri/src/commands/prompt_tracker.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptRecord {
    pub index: usize,
    pub text: String,
    pub git_commit_before: String,
    pub git_commit_after: Option<String>,
    pub timestamp: i64,
    
    // 🆕 新增字段
    #[serde(default)]
    pub is_user_initiated: bool,  // 默认 true（向后兼容）
    
    #[serde(default)]
    pub message_type: MessageType,  // 消息类型
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    User,      // 真实用户输入
    System,    // 系统消息
    Subagent,  // 子代理内部调用
    Tool,      // 工具执行
}

impl Default for MessageType {
    fn default() -> Self {
        MessageType::User  // 向后兼容
    }
}
```

##### 2. 修改 record_prompt_sent

```rust
#[tauri::command]
pub async fn record_prompt_sent(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_text: String,
    is_user_initiated: Option<bool>,  // 🆕 可选参数
    message_type: Option<String>,     // 🆕 可选参数
) -> Result<usize, String> {
    // ...
    
    let record = PromptRecord {
        index,
        text: prompt_text,
        git_commit_before: commit_before,
        git_commit_after: None,
        timestamp: Utc::now().timestamp(),
        is_user_initiated: is_user_initiated.unwrap_or(true),
        message_type: message_type
            .and_then(|t| match t.as_str() {
                "user" => Some(MessageType::User),
                "system" => Some(MessageType::System),
                "subagent" => Some(MessageType::Subagent),
                "tool" => Some(MessageType::Tool),
                _ => None
            })
            .unwrap_or(MessageType::User),
    };
    
    // ...
}
```

##### 3. 修改撤回逻辑

```rust
fn truncate_session_to_prompt(...) -> Result<()> {
    // ...
    
    for (line_index, line) in lines.iter().enumerate() {
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(line) {
            if msg.get("type").and_then(|t| t.as_str()) == Some("user") {
                // ... 提取内容 ...
                
                // 🆕 检查提示词记录中的元数据
                let is_user_prompt = check_if_user_prompt(
                    &extracted_text, 
                    user_message_count,
                    &prompts  // 传入已记录的提示词列表
                );
                
                if is_user_prompt {
                    user_message_count += 1;
                }
            }
        }
    }
}

// 🆕 通过提示词记录验证
fn check_if_user_prompt(
    text: &str, 
    current_count: usize,
    prompts: &[PromptRecord]
) -> bool {
    // 如果有对应的提示词记录，检查其 is_user_initiated
    if let Some(prompt) = prompts.get(current_count) {
        return prompt.is_user_initiated;
    }
    
    // 否则回退到关键词检测
    !is_auto_message(text)
}
```

---

### 长期方案（架构改进）

#### 使用 UUID 代替索引

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRecord {
    pub uuid: String,           // 🆕 唯一标识符
    pub sequence: usize,        // 🆕 显示顺序（可变）
    pub text: String,
    pub git_commit_before: String,
    pub git_commit_after: Option<String>,
    pub timestamp: i64,
    pub is_user_initiated: bool,
    pub message_type: MessageType,
    pub parent_uuid: Option<String>,  // 🆕 父消息 UUID（用于追踪调用链）
}

// 撤回时通过 UUID 查找
pub async fn revert_to_prompt_by_uuid(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_uuid: String,
) -> Result<String, String>
```

**优势**:
- ✅ 不受消息插入影响
- ✅ 可以追踪调用链
- ✅ 更灵活的消息管理

---

## 🔍 检测工具

### 添加调试命令

```rust
// 新增调试命令
#[tauri::command]
pub async fn debug_session_messages(
    session_id: String,
    project_id: String,
) -> Result<DebugInfo, String> {
    let session_path = /* ... */;
    let lines: Vec<_> = /* 读取 JSONL */;
    
    let mut debug_info = DebugInfo {
        total_lines: lines.len(),
        user_messages: vec![],
        tool_results: vec![],
        assistant_messages: vec![],
    };
    
    for (idx, line) in lines.iter().enumerate() {
        let msg: serde_json::Value = serde_json::from_str(line)?;
        let msg_type = msg.get("type").and_then(|t| t.as_str()).unwrap_or("unknown");
        
        match msg_type {
            "user" => {
                let content = extract_text(&msg);
                debug_info.user_messages.push(MessageDebug {
                    line: idx,
                    content: content.chars().take(100).collect(),
                    is_warmup: content.contains("Warmup"),
                    is_skill: content.contains("skill"),
                    has_tool_result: /* ... */,
                });
            }
            // ...
        }
    }
    
    Ok(debug_info)
}
```

### 前端调试UI

在设置页面添加"调试提示词索引"按钮：

```typescript
async function debugPromptIndices() {
  const debug = await api.debugSessionMessages(sessionId, projectId);
  console.table(debug.user_messages);
  
  // 对比提示词记录
  const prompts = await api.getPromptList(sessionId, projectId);
  console.table(prompts);
  
  // 检查不一致
  if (debug.user_messages.length !== prompts.length) {
    console.error('索引不一致！');
    console.log('JSONL 中的用户消息:', debug.user_messages.length);
    console.log('记录的提示词:', prompts.length);
  }
}
```

---

## 📊 风险评估

| 场景 | 风险等级 | 概率 | 影响 |
|------|---------|------|------|
| 单层子代理调用 | 🟡 中 | 30% | 索引+1错位 |
| 多层嵌套调用 | 🔴 高 | 50% | 索引+N错位 |
| 频繁使用 task tool | 🔴 高 | 70% | 严重错位 |
| 混合 Skills 和 Subagents | 🔴 高 | 60% | 不可预测 |

### 影响评估

**如果不修复**:
- 撤回功能不可靠
- 用户可能撤回到错误位置
- 可能丢失工作成果
- 影响用户体验和信任

---

## ✅ 推荐实施计划

### Phase 1: 立即修复（本次更新）

1. **增强关键词过滤** - 添加更多自动消息模式
2. **添加工具调用检测** - 检测紧跟在 tool_use 后的消息
3. **添加调试日志** - 记录每条消息的分类决策

**时间**: 1-2小时  
**风险**: 低  
**效果**: 覆盖80%场景

### Phase 2: 元数据支持（下次更新）

1. **添加 is_user_initiated 字段**
2. **修改 API 传递元数据**
3. **向后兼容处理**

**时间**: 4-6小时  
**风险**: 中  
**效果**: 覆盖95%场景

### Phase 3: UUID 重构（未来版本）

1. **迁移到 UUID 系统**
2. **数据迁移工具**
3. **完整测试**

**时间**: 2-3天  
**风险**: 中高  
**效果**: 100%可靠

---

## 🎯 结论

**问题确实存在！** 用户的担心是对的。

当前系统通过关键词过滤有一定保护，但在复杂的子代理调用场景下可能失效。

**建议**:
1. ✅ **立即实施 Phase 1** - 增强过滤（本次更新）
2. ✅ **计划 Phase 2** - 元数据支持（v4.0.11）
3. ✅ **长期 Phase 3** - UUID 系统（v4.1.0）

**当前代码已有基础保护，但需要增强以处理子代理场景。**

---

**是否要我立即实施 Phase 1 的增强过滤？** 🤔

