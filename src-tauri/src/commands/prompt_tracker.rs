use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use log;

use super::simple_git;
use super::claude::get_claude_dir;

/// A record of a user prompt
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

/// Get path to prompts file
fn get_prompts_file_path(session_id: &str, project_id: &str) -> Result<PathBuf> {
    let claude_dir = get_claude_dir().context("Failed to get claude dir")?;
    let path = claude_dir
        .join("projects")
        .join(project_id)
        .join(format!("{}.prompts.json", session_id));
    Ok(path)
}

/// Load prompts from file
fn load_prompts(session_id: &str, project_id: &str) -> Result<Vec<PromptRecord>> {
    let path = get_prompts_file_path(session_id, project_id)?;
    
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let content = fs::read_to_string(&path)
        .context("Failed to read prompts file")?;
    
    let prompts: Vec<PromptRecord> = serde_json::from_str(&content)
        .context("Failed to parse prompts file")?;
    
    Ok(prompts)
}

/// Save prompts to file
fn save_prompts(session_id: &str, project_id: &str, prompts: &[PromptRecord]) -> Result<()> {
    let path = get_prompts_file_path(session_id, project_id)?;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("Failed to create prompts directory")?;
    }
    
    let content = serde_json::to_string_pretty(prompts)
        .context("Failed to serialize prompts")?;
    
    fs::write(&path, content).context("Failed to write prompts file")?;
    
    Ok(())
}

/// Truncate session JSONL file to before a specific prompt
fn truncate_session_to_prompt(
    session_id: &str,
    project_id: &str,
    prompt_index: usize,
) -> Result<()> {
    let claude_dir = get_claude_dir().context("Failed to get claude dir")?;
    let session_path = claude_dir
        .join("projects")
        .join(project_id)
        .join(format!("{}.jsonl", session_id));
    
    if !session_path.exists() {
        return Ok(());  // No session file, nothing to truncate
    }
    
    // Read all lines
    let content = fs::read_to_string(&session_path)
        .context("Failed to read session file")?;
    
    let lines: Vec<&str> = content.lines().collect();
    
    // Count user messages and find the line index to truncate at
    let mut user_message_count = 0;
    let mut truncate_at_line = 0;
    
    for (line_index, line) in lines.iter().enumerate() {
        // Parse line as JSON to check message type
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(line) {
            if msg.get("type").and_then(|t| t.as_str()) == Some("user") {
                // 检查是否是系统消息（Warmup 等）
                let content = msg.get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("");
                
                let is_system = content.contains("Warmup") || content.starts_with("System:");
                
                if !is_system {
                    // 只计算真实用户消息
                    log::debug!("Found user message at line {}, count={}, looking for={}", 
                        line_index, user_message_count, prompt_index);
                    
                    if user_message_count == prompt_index {
                        // Found the target prompt, truncate before it
                        truncate_at_line = line_index;
                        log::info!("Target prompt #{} found at line {}", prompt_index, line_index);
                        break;
                    }
                    user_message_count += 1;
                } else {
                    log::debug!("Skipping system message at line {}: {}", line_index, content);
                }
            }
        }
    }
    
    let total_lines = lines.len();
    log::info!("Total lines: {}, will keep lines 0..{} (delete prompt #{} at line {} and after)", 
        total_lines, truncate_at_line, prompt_index, truncate_at_line);
    
    // Truncate to the line before this prompt
    let truncated_lines: Vec<&str> = lines.into_iter().take(truncate_at_line).collect();
    let new_content = truncated_lines.join("\n");
    
    fs::write(&session_path, new_content)
        .context("Failed to write truncated session")?;
    
    log::info!("Truncated session: kept {} lines, deleted {} lines", 
        truncate_at_line, total_lines - truncate_at_line);
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
    
    // Get current commit (state before sending)
    let commit_before = simple_git::git_current_commit(&project_path)
        .map_err(|e| format!("Failed to get current commit: {}", e))?;
    
    // Load existing prompts
    let mut prompts = load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))?;
    
    // Create new prompt record
    let index = prompts.len();
    let record = PromptRecord {
        index,
        text: prompt_text,
        git_commit_before: commit_before,
        git_commit_after: None,
        timestamp: Utc::now().timestamp(),
    };
    
    prompts.push(record);
    
    // Save
    save_prompts(&session_id, &project_id, &prompts)
        .map_err(|e| format!("Failed to save prompts: {}", e))?;
    
    log::info!("Recorded prompt #{} for session: {}", index, session_id);
    Ok(index)
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
    
    // Get current commit (state after AI completion)
    let commit_after = simple_git::git_current_commit(&project_path)
        .map_err(|e| format!("Failed to get current commit: {}", e))?;
    
    // Load prompts
    let mut prompts = load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))?;
    
    // Update the prompt record
    if let Some(prompt) = prompts.get_mut(prompt_index) {
        prompt.git_commit_after = Some(commit_after);
    } else {
        return Err(format!("Prompt #{} not found", prompt_index));
    }
    
    // Save
    save_prompts(&session_id, &project_id, &prompts)
        .map_err(|e| format!("Failed to save prompts: {}", e))?;
    
    log::info!("Marked prompt #{} as completed", prompt_index);
    Ok(())
}

/// Revert to a specific prompt
#[tauri::command]
pub async fn revert_to_prompt(
    session_id: String,
    project_id: String,
    project_path: String,
    prompt_index: usize,
) -> Result<String, String> {
    log::info!("Reverting to prompt #{} in session: {}", prompt_index, session_id);
    
    // Load prompts
    let prompts = load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))?;
    
    let prompt = prompts.get(prompt_index)
        .ok_or_else(|| format!("Prompt #{} not found", prompt_index))?;
    
    // 1. Save any uncommitted changes to stash
    simple_git::git_stash_save(&project_path, &format!("Auto-stash before revert to prompt #{}", prompt_index))
        .map_err(|e| format!("Failed to stash changes: {}", e))?;
    
    // 2. Reset code to state before this prompt was sent
    simple_git::git_reset_hard(&project_path, &prompt.git_commit_before)
        .map_err(|e| format!("Failed to reset code: {}", e))?;
    
    // 3. Truncate session messages (delete this prompt and everything after)
    truncate_session_to_prompt(&session_id, &project_id, prompt_index)
        .map_err(|e| format!("Failed to truncate session: {}", e))?;
    
    // 4. Truncate prompts list
    let mut prompts_to_save = prompts.clone();
    prompts_to_save.truncate(prompt_index);
    save_prompts(&session_id, &project_id, &prompts_to_save)
        .map_err(|e| format!("Failed to save truncated prompts: {}", e))?;
    
    log::info!("Successfully reverted to prompt #{}", prompt_index);
    
    // 5. Return the prompt text for restoring to input
    Ok(prompt.text.clone())
}

/// Get all prompts for a session (for debugging)
#[tauri::command]
pub async fn get_prompt_list(
    session_id: String,
    project_id: String,
) -> Result<Vec<PromptRecord>, String> {
    load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))
}

