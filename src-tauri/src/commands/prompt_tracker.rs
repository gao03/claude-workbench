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
    /// Unique message ID
    pub message_id: String,
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

/// Load prompts from file (HashMap keyed by message_id)
fn load_prompts(session_id: &str, project_id: &str) -> Result<std::collections::HashMap<String, PromptRecord>> {
    let path = get_prompts_file_path(session_id, project_id)?;
    
    if !path.exists() {
        return Ok(std::collections::HashMap::new());
    }
    
    let content = fs::read_to_string(&path)
        .context("Failed to read prompts file")?;
    
    let prompts: std::collections::HashMap<String, PromptRecord> = serde_json::from_str(&content)
        .context("Failed to parse prompts file")?;
    
    Ok(prompts)
}

/// Save prompts to file
fn save_prompts(session_id: &str, project_id: &str, prompts: &std::collections::HashMap<String, PromptRecord>) -> Result<()> {
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

/// Truncate session JSONL file to before a specific message
fn truncate_session_to_message(
    session_id: &str,
    project_id: &str,
    message_id: &str,
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
    
    // Find the message with this ID
    let mut truncate_at_line = 0;
    let mut found = false;
    
    for (line_index, line) in lines.iter().enumerate() {
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(line) {
            // Check if this is the target message
            if let Some(id) = msg.get("id").and_then(|id| id.as_str()) {
                if id == message_id {
                    truncate_at_line = line_index;
                    found = true;
                    break;
                }
            }
        }
    }
    
    if !found {
        log::warn!("Message {} not found in session file", message_id);
        return Ok(());
    }
    
    // Truncate to the line before this message
    let truncated_lines: Vec<&str> = lines.into_iter().take(truncate_at_line).collect();
    let new_content = truncated_lines.join("\n");
    
    fs::write(&session_path, new_content)
        .context("Failed to write truncated session")?;
    
    log::info!("Truncated session to {} lines (before message {})", truncate_at_line, message_id);
    Ok(())
}

/// Record a prompt being sent
#[tauri::command]
pub async fn record_prompt_sent(
    session_id: String,
    project_id: String,
    project_path: String,
    message_id: String,
    prompt_text: String,
) -> Result<(), String> {
    log::info!("Recording prompt {} for session: {}", message_id, session_id);
    
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
    let record = PromptRecord {
        message_id: message_id.clone(),
        text: prompt_text,
        git_commit_before: commit_before,
        git_commit_after: None,
        timestamp: Utc::now().timestamp(),
    };
    
    prompts.insert(message_id.clone(), record);
    
    // Save
    save_prompts(&session_id, &project_id, &prompts)
        .map_err(|e| format!("Failed to save prompts: {}", e))?;
    
    log::info!("Recorded prompt {} for session: {}", message_id, session_id);
    Ok(())
}

/// Mark a prompt as completed (after AI finishes)
#[tauri::command]
pub async fn mark_prompt_completed(
    session_id: String,
    project_id: String,
    project_path: String,
    message_id: String,
) -> Result<(), String> {
    log::info!("Marking prompt {} completed", message_id);
    
    // Get current commit (state after AI completion)
    let commit_after = simple_git::git_current_commit(&project_path)
        .map_err(|e| format!("Failed to get current commit: {}", e))?;
    
    // Load prompts
    let mut prompts = load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))?;
    
    // Update the prompt record
    if let Some(prompt) = prompts.get_mut(&message_id) {
        prompt.git_commit_after = Some(commit_after);
    } else {
        log::warn!("Prompt {} not found", message_id);
        return Ok(());  // Not an error, just skip
    }
    
    // Save
    save_prompts(&session_id, &project_id, &prompts)
        .map_err(|e| format!("Failed to save prompts: {}", e))?;
    
    log::info!("Marked prompt {} as completed", message_id);
    Ok(())
}

/// Revert to a specific prompt (by message ID)
#[tauri::command]
pub async fn revert_to_prompt(
    session_id: String,
    project_id: String,
    project_path: String,
    message_id: String,
) -> Result<String, String> {
    log::info!("Reverting to message {} in session: {}", message_id, session_id);
    
    // Load prompts
    let prompts = load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))?;
    
    let prompt = prompts.get(&message_id)
        .ok_or_else(|| format!("Message {} not found in prompts", message_id))?;
    
    // 1. Save any uncommitted changes to stash
    simple_git::git_stash_save(&project_path, &format!("Auto-stash before revert to {}", message_id))
        .map_err(|e| format!("Failed to stash changes: {}", e))?;
    
    // 2. Reset code to state before this prompt was sent
    simple_git::git_reset_hard(&project_path, &prompt.git_commit_before)
        .map_err(|e| format!("Failed to reset code: {}", e))?;
    
    // 3. Truncate session messages (delete this message and everything after)
    truncate_session_to_message(&session_id, &project_id, &message_id)
        .map_err(|e| format!("Failed to truncate session: {}", e))?;
    
    // 4. Remove this prompt and all after it from prompts map
    // (Just delete the entry - simpler than truncating)
    let mut prompts_to_save = prompts.clone();
    prompts_to_save.remove(&message_id);
    save_prompts(&session_id, &project_id, &prompts_to_save)
        .map_err(|e| format!("Failed to save prompts: {}", e))?;
    
    log::info!("Successfully reverted to message {}", message_id);
    
    // 5. Return the prompt text for restoring to input
    Ok(prompt.text.clone())
}

/// Get all prompts for a session (for debugging)
#[tauri::command]
pub async fn get_prompt_list(
    session_id: String,
    project_id: String,
) -> Result<std::collections::HashMap<String, PromptRecord>, String> {
    load_prompts(&session_id, &project_id)
        .map_err(|e| format!("Failed to load prompts: {}", e))
}


