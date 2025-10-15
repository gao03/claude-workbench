// Message operations have been deprecated along with the checkpoint system
// These stub implementations return errors to maintain API compatibility

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
