use std::path::Path;
use std::process::Command;
use log;

/// Check if a directory is a Git repository
pub fn is_git_repo(project_path: &str) -> bool {
    Path::new(project_path).join(".git").exists()
}

/// Ensure Git repository exists, initialize if needed
pub fn ensure_git_repo(project_path: &str) -> Result<(), String> {
    if is_git_repo(project_path) {
        log::info!("Git repository already exists at: {}", project_path);
        return Ok(());
    }
    
    log::info!("Initializing Git repository at: {}", project_path);
    
    // Initialize Git repository
    let init_output = Command::new("git")
        .args(["init"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to init git: {}", e))?;
    
    if !init_output.status.success() {
        return Err(format!("Git init failed: {}", String::from_utf8_lossy(&init_output.stderr)));
    }
    
    // Add all files
    let add_output = Command::new("git")
        .args(["add", "."])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to add files: {}", e))?;
    
    if !add_output.status.success() {
        log::warn!("Git add warning: {}", String::from_utf8_lossy(&add_output.stderr));
    }
    
    // Create initial commit
    let commit_output = Command::new("git")
        .args(["commit", "-m", "[Claude Workbench] Initial commit"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to create initial commit: {}", e))?;
    
    if !commit_output.status.success() {
        // Try with --allow-empty if no files to commit
        Command::new("git")
            .args(["commit", "--allow-empty", "-m", "[Claude Workbench] Initial commit"])
            .current_dir(project_path)
            .output()
            .map_err(|e| format!("Failed to create empty commit: {}", e))?;
    }
    
    log::info!("Git repository initialized successfully");
    Ok(())
}

/// Get current HEAD commit hash
pub fn git_current_commit(project_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to get current commit: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git rev-parse failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    let commit = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in commit hash: {}", e))?
        .trim()
        .to_string();
    
    Ok(commit)
}

/// Reset repository to a specific commit
pub fn git_reset_hard(project_path: &str, commit: &str) -> Result<(), String> {
    log::info!("Resetting repository to commit: {}", commit);
    
    let output = Command::new("git")
        .args(["reset", "--hard", commit])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to reset: {}", e))?;
    
    if !output.status.success() {
        return Err(format!("Git reset failed: {}", String::from_utf8_lossy(&output.stderr)));
    }
    
    log::info!("Successfully reset to commit: {}", commit);
    Ok(())
}

/// Save uncommitted changes to stash
pub fn git_stash_save(project_path: &str, message: &str) -> Result<(), String> {
    // Check if there are uncommitted changes
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to check status: {}", e))?;
    
    if status_output.stdout.is_empty() {
        log::debug!("No uncommitted changes to stash");
        return Ok(());  // No changes to stash
    }
    
    log::info!("Stashing uncommitted changes: {}", message);
    
    let output = Command::new("git")
        .args(["stash", "save", "-u", message])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to stash: {}", e))?;
    
    if !output.status.success() {
        log::warn!("Git stash warning: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    Ok(())
}

/// Tauri command: Check and initialize Git repository
#[tauri::command]
pub fn check_and_init_git(project_path: String) -> Result<bool, String> {
    let was_not_initialized = !is_git_repo(&project_path);
    
    if was_not_initialized {
        ensure_git_repo(&project_path)?;
    }
    
    Ok(was_not_initialized)
}

