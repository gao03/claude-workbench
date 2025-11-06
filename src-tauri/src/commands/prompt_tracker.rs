use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use chrono::Utc;
use log;
use sha2::{Sha256, Digest};

use super::simple_git;
use super::claude::get_claude_dir;

/// Rewind mode for reverting prompts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RewindMode {
    /// Revert conversation only (delete messages, keep code)
    ConversationOnly,
    /// Revert code only (rollback code, keep messages)
    CodeOnly,
    /// Revert both conversation and code (full revert)
    Both,
}

/// Capabilities for rewinding a specific prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewindCapabilities {
    /// Can revert conversation (always true)
    pub conversation: bool,
    /// Can revert code (true if has git_commit_before)
    pub code: bool,
    /// Can revert both (true if has git_commit_before)
    pub both: bool,
    /// Warning message if code revert is not available
    pub warning: Option<String>,
    /// Prompt source indicator
    pub source: String,  // "project" or "cli"
}

/// A record of a user prompt (legacy structure, kept for compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptRecord {
    /// Index of this prompt (0, 1, 2...)
    pub index: usize,
    /// The prompt text user entered
    pub text: String,
    /// Git commit before sending this prompt
    pub git_commit_before: String,
    /// Git commit after AI completed (optional)
    pub git_commit_after: Option<String>,
    /// Timestamp when prompt was sent
    pub timestamp: i64,
}

/// Git record for a prompt (stored by content hash)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRecord {
    /// Git commit before sending this prompt
    pub commit_before: String,
    /// Git commit after AI completed (optional)
    pub commit_after: Option<String>,
    /// Timestamp when prompt was sent
    pub timestamp: i64,
}

/// Calculate SHA256 hash of a string
fn calculate_hash(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Get path to git records file
fn get_git_records_path(session_id: &str, project_id: &str) -> Result<PathBuf> {
    let claude_dir = get_claude_dir().context("Failed to get claude dir")?;
    let records_path = claude_dir
        .join("projects")
        .join(project_id)
        .join("sessions")
        .join(format!("{}.git-records.json", session_id));
    Ok(records_path)
}

/// Load git records from .git-records.json
fn load_git_records(session_id: &str, project_id: &str) -> Result<HashMap<String, GitRecord>> {
    let records_path = get_git_records_path(session_id, project_id)?;

    if !records_path.exists() {
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(&records_path)
        .context("Failed to read git records file")?;

    let records: HashMap<String, GitRecord> = serde_json::from_str(&content)
        .context("Failed to parse git records")?;

    Ok(records)
}

/// Save git records to .git-records.json
fn save_git_records(session_id: &str, project_id: &str, records: &HashMap<String, GitRecord>) -> Result<()> {
    let records_path = get_git_records_path(session_id, project_id)?;

    // Ensure directory exists
    if let Some(parent) = records_path.parent() {
        fs::create_dir_all(parent)
            .context("Failed to create sessions directory")?;
    }

    let content = serde_json::to_string_pretty(&records)
        .context("Failed to serialize git records")?;

    fs::write(&records_path, content)
        .context("Failed to write git records file")?;

    Ok(())
}

/// Save a single git record
fn save_git_record(session_id: &str, project_id: &str, hash: String, record: GitRecord) -> Result<()> {
    let mut records = load_git_records(session_id, project_id)?;
    records.insert(hash, record);
    save_git_records(session_id, project_id, &records)?;
    Ok(())
}

/// Get a git record by hash
fn get_git_record(session_id: &str, project_id: &str, hash: &str) -> Result<Option<GitRecord>> {
    let records = load_git_records(session_id, project_id)?;
    Ok(records.get(hash).cloned())
}

/// Truncate git records (remove records for prompts after the specified index)
fn truncate_git_records(
    session_id: &str,
    project_id: &str,
    prompts: &[PromptRecord],
    prompt_index: usize,
) -> Result<()> {
    let mut records = load_git_records(session_id, project_id)?;

    // Remove git records for all prompts after prompt_index
    for i in (prompt_index + 1)..prompts.len() {
        if let Some(prompt) = prompts.get(i) {
            let hash = calculate_hash(&prompt.text);
            records.remove(&hash);
        }
    }

    save_git_records(session_id, project_id, &records)?;
    Ok(())
}

/// Truncate session JSONL file to before a specific prompt
/// 🆕 Now supports multiple files (main session + agent files)
fn truncate_session_to_prompt(
    session_id: &str,
    project_id: &str,
    prompt_index: usize,
) -> Result<()> {
    let claude_dir = get_claude_dir().context("Failed to get claude dir")?;
    let project_dir = claude_dir.join("projects").join(project_id);
    let session_path = project_dir.join(format!("{}.jsonl", session_id));
    
    if !session_path.exists() {
        return Ok(());  // No session file, nothing to truncate
    }
    
    // ========================================================================
    // Step 1: Process main session file
    // ========================================================================
    
    // Read all lines
    let content = fs::read_to_string(&session_path)
        .context("Failed to read session file")?;
    
    let lines: Vec<&str> = content.lines().collect();
    
    // Count user messages and find the line index to truncate at
    let mut user_message_count = 0;
    let mut truncate_at_line = 0;
    let mut found_target = false;  // Flag to track if we found the target prompt
    
    for (line_index, line) in lines.iter().enumerate() {
        // Parse line as JSON to check message type
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(line) {
            // 🆕 跳过非用户消息类型（新版 Claude 引入的消息类型）
            let msg_type = msg.get("type").and_then(|t| t.as_str());
            
            log::debug!("Line {}: type={:?}", line_index, msg_type);
            
            // 忽略 summary 和 file-history-snapshot 类型
            if msg_type == Some("summary") || msg_type == Some("file-history-snapshot") {
                log::debug!("Skipping {} message at line {}", msg_type.unwrap(), line_index);
                continue;
            }
            
            // 只处理用户消息
            if msg_type == Some("user") {
                // 检查是否是侧链消息（agent 消息）
                let is_sidechain = msg.get("isSidechain")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                
                if is_sidechain {
                    log::debug!("Skipping sidechain user message at line {}", line_index);
                    continue;
                }
                
                // 检查是否有 parent_tool_use_id（子代理的消息）
                let has_parent_tool_use_id = msg.get("parent_tool_use_id").is_some() 
                    && !msg.get("parent_tool_use_id").unwrap().is_null();
                
                if has_parent_tool_use_id {
                    log::debug!("Skipping subagent message at line {} (has parent_tool_use_id)", line_index);
                    continue;
                }
                
                // 提取消息内容（支持字符串和数组两种格式）
                let content_value = msg.get("message").and_then(|m| m.get("content"));
                
                log::debug!("Line {}: content_value exists={}", line_index, content_value.is_some());
                
                let mut extracted_text = String::new();
                let mut has_text_content = false;
                let mut has_tool_result = false;
                
                if let Some(content) = content_value {
                    if let Some(text) = content.as_str() {
                        // 字符串格式
                        extracted_text = text.to_string();
                        has_text_content = !text.trim().is_empty();
                        log::debug!("Line {}: extracted string content, length={}, has_text={}", 
                            line_index, extracted_text.len(), has_text_content);
                    } else if let Some(arr) = content.as_array() {
                        // 数组格式（可能包含 text 和 tool_result）
                        for item in arr {
                            if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                                if item_type == "text" {
                                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                        extracted_text.push_str(text);
                                        has_text_content = true;
                                    }
                                } else if item_type == "tool_result" {
                                    has_tool_result = true;
                                }
                            }
                        }
                    }
                }
                
                // 如果只有 tool_result 没有 text，跳过（这些是工具执行结果，不是用户输入）
                if has_tool_result && !has_text_content {
                    log::debug!("Skipping tool-result-only message at line {}", line_index);
                    continue;
                }
                
                // 必须有文本内容
                if !has_text_content {
                    log::debug!("Skipping empty user message at line {}", line_index);
                    continue;
                }
                
                // ⚡ 检查是否是自动发送的 Warmup 消息或 Skills 消息
                let is_warmup = extracted_text.contains("Warmup");
                let is_skill_message = extracted_text.contains("<command-name>") 
                    || extracted_text.contains("Launching skill:")
                    || extracted_text.contains("skill is running");
                
                log::debug!("Line {}: is_warmup={}, is_skill={}, text_preview={}", 
                    line_index, is_warmup, is_skill_message, 
                    extracted_text.chars().take(20).collect::<String>());
                
                if !is_warmup && !is_skill_message {
                    // 只计算真实用户输入的消息（排除自动 Warmup）
                    log::info!("[OK] Found real user message at line {}, count={}, looking for={}", 
                        line_index, user_message_count, prompt_index);
                    
                    if user_message_count == prompt_index {
                        // Found the target prompt, truncate before it
                        truncate_at_line = line_index;
                        found_target = true;  // Mark that we found it
                        log::info!("[TARGET] Target prompt #{} found at line {}", prompt_index, line_index);
                        break;
                    }
                    user_message_count += 1;
                } else if is_warmup {
                    log::debug!("Skipping Warmup message at line {}: {}", line_index, extracted_text.chars().take(50).collect::<String>());
                } else if is_skill_message {
                    log::debug!("Skipping Skills message at line {}: {}", line_index, extracted_text.chars().take(50).collect::<String>());
                }
            }
        }
    }
    
    let total_lines = lines.len();
    
    // 安全检查：如果没找到目标 prompt，返回错误而不是清空所有内容
    if !found_target {
        if user_message_count == 0 {
            return Err(anyhow::anyhow!(
                "Prompt #{} not found in session (no user messages found)", 
                prompt_index
            ));
        } else {
            return Err(anyhow::anyhow!(
                "Prompt #{} not found in session (only {} user messages found)", 
                prompt_index,
                user_message_count
            ));
        }
    }
    
    log::info!("Total lines: {}, will keep lines 0..{} (delete prompt #{} at line {} and after)", 
        total_lines, truncate_at_line, prompt_index, truncate_at_line);
    
    // Truncate to the line before this prompt
    let truncated_lines: Vec<&str> = lines.into_iter().take(truncate_at_line).collect();
    
    // Join with newline and add final newline if we have content
    let new_content = if truncated_lines.is_empty() {
        String::new()
    } else {
        truncated_lines.join("\n") + "\n"  // Add trailing newline
    };
    
    fs::write(&session_path, new_content)
        .context("Failed to write truncated session")?;
    
    log::info!("Truncated main session: kept {} lines, deleted {} lines", 
        truncate_at_line, total_lines - truncate_at_line);
    
    // ========================================================================
    // Step 2: Handle agent files (新版 Claude 引入的 sidechain 文件)
    // ========================================================================
    
    // Agent 文件处理策略：
    // - Agent 文件通常只包含会话初始化的 Warmup 消息（通常只有2行）
    // - 如果撤回到 prompt #0（首个用户输入之前），则删除所有 agent 文件
    // - 如果撤回到 prompt #N (N>0)，保持 agent 文件不变（因为它们只在初始化时创建一次）
    
    if prompt_index == 0 {
        // 撤回到初始状态，删除所有 agent 文件
        log::info!("Reverting to prompt #0, removing all agent files");
        
        if let Ok(entries) = fs::read_dir(&project_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    // Match pattern: agent-{id}.jsonl
                    if filename.starts_with("agent-") && filename.ends_with(".jsonl") {
                        log::info!("Removing agent file: {}", filename);
                        
                        if let Err(e) = fs::remove_file(&path) {
                            log::warn!("Failed to remove agent file {}: {}", filename, e);
                        } else {
                            log::info!("Successfully removed agent file: {}", filename);
                        }
                    }
                }
            }
        }
    } else {
        // 撤回到后续提示词，agent 文件保持不变
        log::info!("Reverting to prompt #{}, keeping agent files unchanged (they only contain initialization data)", prompt_index);
    }
    
    Ok(())
}

/// Record a prompt being sent
#[tauri::command]
pub async fn record_prompt_sent(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_text: String,
) -> Result<usize, String> {
    log::info!("Recording prompt sent for session: {}", session_id);

    // Ensure Git repository is initialized
    simple_git::ensure_git_repo(&project_path)
        .map_err(|e| format!("Failed to ensure Git repo: {}", e))?;

    // IMPORTANT: Always get the LATEST commit
    // This ensures we start from the correct state even if previous prompt made no changes
    let commit_before = simple_git::git_current_commit(&project_path)
        .map_err(|e| format!("Failed to get current commit: {}", e))?;

    log::info!("Current git commit: {}", commit_before);

    // Calculate hash of prompt text
    let hash = calculate_hash(&prompt_text);

    // Save git record using hash as key
    let git_record = GitRecord {
        commit_before: commit_before.clone(),
        commit_after: None,
        timestamp: Utc::now().timestamp(),
    };

    save_git_record(&session_id, &project_id, hash.clone(), git_record)
        .map_err(|e| format!("Failed to save git record: {}", e))?;

    log::info!("Recorded prompt with hash {} for session: {} with git_commit_before: {}",
        hash, session_id, commit_before);

    // Return the current index from JSONL
    let prompts = extract_prompts_from_jsonl(&session_id, &project_id)
        .map_err(|e| format!("Failed to extract prompts from JSONL: {}", e))?;

    Ok(prompts.len()) // Return the index of the next prompt (current count)
}

/// Mark a prompt as completed (after AI finishes)
#[tauri::command]
pub async fn mark_prompt_completed(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_index: usize,
) -> Result<(), String> {
    log::info!("Marking prompt #{} completed", prompt_index);

    // Auto-commit any changes made by AI
    // This ensures each prompt has a distinct git state
    let commit_message = format!("[Claude Code] After prompt #{}", prompt_index);
    match simple_git::git_commit_changes(&project_path, &commit_message) {
        Ok(true) => {
            log::info!("Auto-committed changes after prompt #{}", prompt_index);
        },
        Ok(false) => {
            log::debug!("No changes to commit after prompt #{}", prompt_index);
        },
        Err(e) => {
            log::warn!("Failed to auto-commit after prompt #{}: {}", prompt_index, e);
            // Continue anyway, don't fail the whole operation
        }
    }

    // Get current commit (state after AI completion and auto-commit)
    let commit_after = simple_git::git_current_commit(&project_path)
        .map_err(|e| format!("Failed to get current commit: {}", e))?;

    // Extract prompts from JSONL to get the prompt text
    let prompts = extract_prompts_from_jsonl(&session_id, &project_id)
        .map_err(|e| format!("Failed to extract prompts from JSONL: {}", e))?;

    let prompt = prompts.get(prompt_index)
        .ok_or_else(|| format!("Prompt #{} not found", prompt_index))?;

    // Calculate hash and update git record
    let hash = calculate_hash(&prompt.text);

    // Load existing git record
    let mut git_record = get_git_record(&session_id, &project_id, &hash)
        .map_err(|e| format!("Failed to get git record: {}", e))?
        .ok_or_else(|| format!("Git record not found for prompt #{}", prompt_index))?;

    // Update commit_after
    git_record.commit_after = Some(commit_after.clone());

    // Save updated git record
    save_git_record(&session_id, &project_id, hash, git_record)
        .map_err(|e| format!("Failed to save git record: {}", e))?;

    log::info!("Marked prompt #{} as completed with git_commit_after: {}", prompt_index, commit_after);
    Ok(())
}

/// Revert to a specific prompt with support for different rewind modes
#[tauri::command]
pub async fn revert_to_prompt(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_index: usize,
    mode: RewindMode,
) -> Result<String, String> {
    log::info!("Reverting to prompt #{} in session: {} with mode: {:?}",
        prompt_index, session_id, mode);

    // Get prompts from JSONL (single source of truth)
    let prompts = extract_prompts_from_jsonl(&session_id, &project_id)
        .map_err(|e| format!("Failed to extract prompts: {}", e))?;

    let prompt = prompts.get(prompt_index)
        .ok_or_else(|| format!("Prompt #{} not found", prompt_index))?;

    // Calculate hash and get git record
    let hash = calculate_hash(&prompt.text);
    let git_record = get_git_record(&session_id, &project_id, &hash)
        .map_err(|e| format!("Failed to get git record: {}", e))?;

    // Validate mode compatibility
    match mode {
        RewindMode::CodeOnly | RewindMode::Both => {
            if git_record.is_none() {
                return Err(format!(
                    "无法回滚代码：提示词 #{} 没有关联的 Git 记录（可能来自 CLI 终端）",
                    prompt_index
                ));
            }
        }
        _ => {}
    }

    // Execute revert based on mode
    match mode {
        RewindMode::ConversationOnly => {
            log::info!("Reverting conversation only (deleting messages)");

            // Truncate session messages in JSONL
            truncate_session_to_prompt(&session_id, &project_id, prompt_index)
                .map_err(|e| format!("Failed to truncate session: {}", e))?;

            // Truncate git records (remove records for prompts after this index)
            truncate_git_records(&session_id, &project_id, &prompts, prompt_index)
                .map_err(|e| format!("Failed to truncate git records: {}", e))?;

            log::info!("Successfully reverted conversation to prompt #{}", prompt_index);
        }

        RewindMode::CodeOnly => {
            log::info!("Reverting code only (keeping messages)");

            let record = git_record.unwrap(); // Safe because we validated above

            // 1. Stash any uncommitted changes
            simple_git::git_stash_save(&project_path,
                &format!("Auto-stash before code revert to prompt #{}", prompt_index))
                .map_err(|e| format!("Failed to stash changes: {}", e))?;

            // 2. Reset code to state before this prompt
            simple_git::git_reset_hard(&project_path, &record.commit_before)
                .map_err(|e| format!("Failed to reset code: {}", e))?;

            log::info!("Successfully reverted code to prompt #{}", prompt_index);
        }

        RewindMode::Both => {
            log::info!("Reverting both conversation and code");

            let record = git_record.unwrap(); // Safe because we validated above

            // 1. Stash any uncommitted changes
            simple_git::git_stash_save(&project_path,
                &format!("Auto-stash before full revert to prompt #{}", prompt_index))
                .map_err(|e| format!("Failed to stash changes: {}", e))?;

            // 2. Reset code to state before this prompt
            simple_git::git_reset_hard(&project_path, &record.commit_before)
                .map_err(|e| format!("Failed to reset code: {}", e))?;

            // 3. Truncate session messages
            truncate_session_to_prompt(&session_id, &project_id, prompt_index)
                .map_err(|e| format!("Failed to truncate session: {}", e))?;

            // 4. Truncate git records
            truncate_git_records(&session_id, &project_id, &prompts, prompt_index)
                .map_err(|e| format!("Failed to truncate git records: {}", e))?;

            log::info!("Successfully reverted both conversation and code to prompt #{}", prompt_index);
        }
    }

    // Return the prompt text for restoring to input
    Ok(prompt.text.clone())
}

/// Get all prompts for a session (for debugging)
#[tauri::command]
pub async fn get_prompt_list(
    session_id: String,
    project_id: String,
) -> Result<Vec<PromptRecord>, String> {
    extract_prompts_from_jsonl(&session_id, &project_id)
        .map_err(|e| format!("Failed to extract prompts from JSONL: {}", e))
}

/// Check rewind capabilities for a specific prompt
/// This determines whether a prompt can be reverted fully (conversation + code) or partially (conversation only)
#[tauri::command]
pub async fn check_rewind_capabilities(
    session_id: String,
    project_id: String,
    prompt_index: usize,
) -> Result<RewindCapabilities, String> {
    log::info!("Checking rewind capabilities for prompt #{} in session: {}", prompt_index, session_id);

    // Extract prompts from JSONL (single source of truth)
    let prompts = extract_prompts_from_jsonl(&session_id, &project_id)
        .map_err(|e| format!("Failed to extract prompts from JSONL: {}", e))?;

    // Get the prompt at the specified index
    let prompt = prompts.get(prompt_index)
        .ok_or_else(|| format!("Prompt #{} not found", prompt_index))?;

    // Calculate hash and check if git record exists
    let hash = calculate_hash(&prompt.text);
    let git_record = get_git_record(&session_id, &project_id, &hash)
        .map_err(|e| format!("Failed to get git record: {}", e))?;

    // Determine capabilities based on whether git record exists
    if let Some(record) = git_record {
        // This prompt has git records (sent from project interface)
        let has_valid_commit = !record.commit_before.is_empty() && record.commit_before != "NONE";

        Ok(RewindCapabilities {
            conversation: true,
            code: has_valid_commit,
            both: has_valid_commit,
            warning: if !has_valid_commit {
                Some("此提示词没有关联的 Git 记录，只能删除消息，无法回滚代码".to_string())
            } else {
                None
            },
            source: "project".to_string(),
        })
    } else {
        // No git record found - this prompt was sent from CLI
        Ok(RewindCapabilities {
            conversation: true,
            code: false,
            both: false,
            warning: Some("此提示词来自 CLI 终端，只能删除消息，无法回滚代码".to_string()),
            source: "cli".to_string(),
        })
    }
}

/// Extract prompts from JSONL session file
/// This function reads the .jsonl file and extracts all user prompts
/// This is the single source of truth for all prompts (both CLI and project interface)
fn extract_prompts_from_jsonl(
    session_id: &str,
    project_id: &str,
) -> Result<Vec<PromptRecord>> {
    let claude_dir = get_claude_dir().context("Failed to get claude dir")?;
    let session_path = claude_dir
        .join("projects")
        .join(project_id)
        .join(format!("{}.jsonl", session_id));

    if !session_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&session_path)
        .context("Failed to read session file")?;

    let mut prompts = Vec::new();
    let mut prompt_index = 0;

    for line in content.lines() {
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(line) {
            let msg_type = msg.get("type").and_then(|t| t.as_str());

            // Skip non-user message types
            if msg_type != Some("user") {
                continue;
            }

            // Skip sidechain messages (agent messages)
            let is_sidechain = msg.get("isSidechain")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            if is_sidechain {
                continue;
            }

            // Skip subagent messages (has parent_tool_use_id)
            let has_parent_tool_use_id = msg.get("parent_tool_use_id").is_some()
                && !msg.get("parent_tool_use_id").unwrap().is_null();

            if has_parent_tool_use_id {
                continue;
            }

            // Extract text content
            let content_value = msg.get("message").and_then(|m| m.get("content"));
            let mut extracted_text = String::new();
            let mut has_text_content = false;
            let mut has_tool_result = false;

            if let Some(content) = content_value {
                if let Some(text) = content.as_str() {
                    extracted_text = text.to_string();
                    has_text_content = !text.trim().is_empty();
                } else if let Some(arr) = content.as_array() {
                    for item in arr {
                        if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                            if item_type == "text" {
                                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                    extracted_text.push_str(text);
                                    has_text_content = true;
                                }
                            } else if item_type == "tool_result" {
                                has_tool_result = true;
                            }
                        }
                    }
                }
            }

            // Skip tool-result-only messages
            if has_tool_result && !has_text_content {
                continue;
            }

            // Must have text content
            if !has_text_content {
                continue;
            }

            // Skip Warmup and Skills messages
            let is_warmup = extracted_text.contains("Warmup");
            let is_skill_message = extracted_text.contains("<command-name>")
                || extracted_text.contains("Launching skill:")
                || extracted_text.contains("skill is running");

            if is_warmup || is_skill_message {
                continue;
            }

            // Extract timestamp
            let timestamp = msg.get("timestamp")
                .and_then(|t| t.as_str())
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.timestamp())
                .unwrap_or_else(|| Utc::now().timestamp());

            // Create prompt record
            // Note: CLI prompts won't have git_commit_before, so we use a placeholder
            prompts.push(PromptRecord {
                index: prompt_index,
                text: extracted_text,
                git_commit_before: "NONE".to_string(),  // CLI prompts don't have git records
                git_commit_after: None,
                timestamp,
            });

            prompt_index += 1;
        }
    }

    Ok(prompts)
}

/// Get unified prompt list with git records from .git-records.json
/// This merges prompts from JSONL with their corresponding git records (if any)
#[tauri::command]
pub async fn get_unified_prompt_list(
    session_id: String,
    project_id: String,
) -> Result<Vec<PromptRecord>, String> {
    log::info!("Getting unified prompt list for session: {}", session_id);

    // Get all prompts from .jsonl (single source of truth)
    let mut prompts = extract_prompts_from_jsonl(&session_id, &project_id)
        .map_err(|e| format!("Failed to extract prompts from JSONL: {}", e))?;

    // Load git records
    let git_records = load_git_records(&session_id, &project_id)
        .map_err(|e| format!("Failed to load git records: {}", e))?;

    // Enrich prompts with git records where available
    let mut project_count = 0;
    let mut cli_count = 0;

    for prompt in &mut prompts {
        let hash = calculate_hash(&prompt.text);
        if let Some(record) = git_records.get(&hash) {
            // This prompt has git records (sent from project interface)
            prompt.git_commit_before = record.commit_before.clone();
            prompt.git_commit_after = record.commit_after.clone();
            project_count += 1;
        } else {
            // No git record (CLI prompt)
            prompt.git_commit_before = "NONE".to_string();
            prompt.git_commit_after = None;
            cli_count += 1;
        }
    }

    log::info!("Found {} total prompts ({} from project interface, {} from CLI)",
        prompts.len(), project_count, cli_count);

    Ok(prompts)
}

