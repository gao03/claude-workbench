// Message operations have been deprecated along with the checkpoint system
// These stub implementations return errors to maintain API compatibility
//
// NEW: Agent SDK checkpoint operations
use std::process::Command;
use serde_json::Value;

/// Undo the last N messages (deprecated)
#[tauri::command]
pub async fn message_undo(
    _session_id: String,
    _project_id: String,
    _project_path: String,
    _count: Option<usize>,
) -> Result<serde_json::Value, String> {
    Err("Message undo feature has been removed along with checkpoints".to_string())
}

/// Truncate messages to a specific index (deprecated)
#[tauri::command]
pub async fn message_truncate_to_index(
    _session_id: String,
    _project_id: String,
    _project_path: String,
    _message_index: usize,
) -> Result<serde_json::Value, String> {
    Err("Message truncate feature has been removed along with checkpoints".to_string())
}

/// Edit a specific message (deprecated)
#[tauri::command]
pub async fn message_edit(
    _session_id: String,
    _project_id: String,
    _project_path: String,
    _message_index: usize,
    _new_content: String,
) -> Result<serde_json::Value, String> {
    Err("Message edit feature has been removed along with checkpoints".to_string())
}

/// Delete a specific message (deprecated)
#[tauri::command]
pub async fn message_delete(
    _session_id: String,
    _project_id: String,
    _project_path: String,
    _message_index: usize,
) -> Result<serde_json::Value, String> {
    Err("Message delete feature has been removed along with checkpoints".to_string())
}

/// Get the current number of messages in a session (deprecated)
#[tauri::command]
pub async fn message_get_count(
    _session_id: String,
    _project_id: String,
    _project_path: String,
) -> Result<usize, String> {
    Err("Message count feature has been removed along with checkpoints".to_string())
}

/// Get a specific message by index (deprecated)
#[tauri::command]
pub async fn message_get_by_index(
    _session_id: String,
    _project_id: String,
    _project_path: String,
    _message_index: usize,
) -> Result<String, String> {
    Err("Message get feature has been removed along with checkpoints".to_string())
}

/// Get all messages in a session (deprecated)
#[tauri::command]
pub async fn message_get_all(
    _session_id: String,
    _project_id: String,
    _project_path: String,
) -> Result<Vec<String>, String> {
    Err("Message get all feature has been removed along with checkpoints".to_string())
}

// ============================================================================
// Agent SDK Checkpoint Operations (NEW)
// ============================================================================

/// Rewind session to a specific checkpoint using Claude CLI
#[tauri::command]
pub async fn message_rewind(
    session_id: String,
    checkpoint_id: String,
) -> Result<Value, String> {
    log::info!("Rewinding session {} to checkpoint {}", session_id, checkpoint_id);
    
    // 调用 Claude CLI
    let output = Command::new("claude")
        .args(&["session", "rewind", &session_id, &checkpoint_id])
        .output()
        .map_err(|e| format!("Failed to execute Claude CLI: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI error: {}", error));
    }

    let result = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&result)
        .map_err(|e| format!("Failed to parse response: {}", e))
}

/// Get checkpoints for a session using Claude CLI
#[tauri::command]
pub async fn get_checkpoints(session_id: String) -> Result<Vec<Value>, String> {
    log::info!("Getting checkpoints for session {}", session_id);
    
    let output = Command::new("claude")
        .args(&["session", "checkpoints", &session_id, "--json"])
        .output()
        .map_err(|e| format!("Failed to execute Claude CLI: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI error: {}", error));
    }

    let result = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&result)
        .map_err(|e| format!("Failed to parse checkpoints: {}", e))
}
