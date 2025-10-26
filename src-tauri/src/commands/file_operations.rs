use std::process::Command as StdCommand;

/// Open a directory in the system file explorer (cross-platform)
#[tauri::command]
pub async fn open_directory_in_explorer(directory_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = StdCommand::new("explorer");
        cmd.arg(&directory_path);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        StdCommand::new("open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        StdCommand::new("xdg-open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    
    Ok(())
}

