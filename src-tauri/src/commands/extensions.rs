use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use log::{debug, info};

use super::claude::get_claude_dir;

/// Represents a Subagent file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubagentFile {
    /// Agent name (file name without extension)
    pub name: String,
    /// Full file path
    pub path: String,
    /// Scope: "project" or "user"
    pub scope: String,
    /// Description from frontmatter or first line
    pub description: Option<String>,
    /// File content
    pub content: String,
}

/// Represents an Agent Skill file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSkillFile {
    /// Skill name (file name without SKILL.md)
    pub name: String,
    /// Full file path
    pub path: String,
    /// Scope: "project" or "user"
    pub scope: String,
    /// Description from frontmatter or first line
    pub description: Option<String>,
    /// File content
    pub content: String,
}

/// Parse YAML frontmatter if present
fn parse_description_from_content(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    
    // Check for YAML frontmatter
    if lines.len() > 2 && lines[0] == "---" {
        for (i, line) in lines.iter().enumerate().skip(1) {
            if *line == "---" {
                // Found end of frontmatter
                break;
            }
            if line.starts_with("description:") {
                return Some(line.trim_start_matches("description:").trim().to_string());
            }
        }
    }
    
    // Fallback: use first non-empty line as description
    lines.iter()
        .find(|line| !line.trim().is_empty() && !line.starts_with('#'))
        .map(|line| line.trim().to_string())
}

/// List all subagents in project and user directories
#[tauri::command]
pub async fn list_subagents(project_path: Option<String>) -> Result<Vec<SubagentFile>, String> {
    info!("Listing subagents");
    let mut agents = Vec::new();
    
    // User-level agents (~/.claude/agents/)
    if let Ok(claude_dir) = get_claude_dir() {
        let user_agents_dir = claude_dir.join("agents");
        if user_agents_dir.exists() {
            agents.extend(scan_agents_directory(&user_agents_dir, "user")?);
        }
    }
    
    // Project-level agents (.claude/agents/)
    if let Some(proj_path) = project_path {
        let project_agents_dir = Path::new(&proj_path).join(".claude").join("agents");
        if project_agents_dir.exists() {
            agents.extend(scan_agents_directory(&project_agents_dir, "project")?);
        }
    }
    
    Ok(agents)
}

/// Scan agents directory for .md files
fn scan_agents_directory(dir: &Path, scope: &str) -> Result<Vec<SubagentFile>, String> {
    let mut agents = Vec::new();
    
    for entry in WalkDir::new(dir)
        .max_depth(2)  // Limit depth
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // Only process .md files
        if !path.is_file() || path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        
        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();
        
        // Read file content
        match fs::read_to_string(path) {
            Ok(content) => {
                let description = parse_description_from_content(&content);
                
                agents.push(SubagentFile {
                    name,
                    path: path.to_string_lossy().to_string(),
                    scope: scope.to_string(),
                    description,
                    content,
                });
            }
            Err(e) => {
                debug!("Failed to read agent file {:?}: {}", path, e);
            }
        }
    }
    
    Ok(agents)
}

/// List all Agent Skills in project and user directories
#[tauri::command]
pub async fn list_agent_skills(project_path: Option<String>) -> Result<Vec<AgentSkillFile>, String> {
    info!("Listing agent skills");
    let mut skills = Vec::new();
    
    // User-level skills (~/.claude/skills/)
    if let Ok(claude_dir) = get_claude_dir() {
        let user_skills_dir = claude_dir.join("skills");
        if user_skills_dir.exists() {
            skills.extend(scan_skills_directory(&user_skills_dir, "user")?);
        }
    }
    
    // Project-level skills (.claude/skills/)
    if let Some(proj_path) = project_path {
        let project_skills_dir = Path::new(&proj_path).join(".claude").join("skills");
        if project_skills_dir.exists() {
            skills.extend(scan_skills_directory(&project_skills_dir, "project")?);
        }
    }
    
    Ok(skills)
}

/// Scan skills directory for SKILL.md files
fn scan_skills_directory(dir: &Path, scope: &str) -> Result<Vec<AgentSkillFile>, String> {
    let mut skills = Vec::new();
    
    for entry in WalkDir::new(dir)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // Only process files ending with SKILL.md
        if !path.is_file() {
            continue;
        }
        
        let file_name = path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        
        if !file_name.ends_with("SKILL.md") {
            continue;
        }
        
        // Extract skill name (remove SKILL.md suffix)
        let name = file_name.trim_end_matches("SKILL.md").trim_end_matches('.').to_string();
        
        // Read file content
        match fs::read_to_string(path) {
            Ok(content) => {
                let description = parse_description_from_content(&content);
                
                skills.push(AgentSkillFile {
                    name,
                    path: path.to_string_lossy().to_string(),
                    scope: scope.to_string(),
                    description,
                    content,
                });
            }
            Err(e) => {
                debug!("Failed to read skill file {:?}: {}", path, e);
            }
        }
    }
    
    Ok(skills)
}

/// Read a specific subagent file
#[tauri::command]
pub async fn read_subagent(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read subagent file: {}", e))
}

/// Read a specific skill file
#[tauri::command]
pub async fn read_skill(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read skill file: {}", e))
}

/// Open agents directory in file explorer
#[tauri::command]
pub async fn open_agents_directory(project_path: Option<String>) -> Result<String, String> {
    let agents_dir = if let Some(proj_path) = project_path {
        Path::new(&proj_path).join(".claude").join("agents")
    } else {
        get_claude_dir()
            .map_err(|e| e.to_string())?
            .join("agents")
    };
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&agents_dir)
        .map_err(|e| format!("Failed to create agents directory: {}", e))?;
    
    Ok(agents_dir.to_string_lossy().to_string())
}

/// Open skills directory in file explorer
#[tauri::command]
pub async fn open_skills_directory(project_path: Option<String>) -> Result<String, String> {
    let skills_dir = if let Some(proj_path) = project_path {
        Path::new(&proj_path).join(".claude").join("skills")
    } else {
        get_claude_dir()
            .map_err(|e| e.to_string())?
            .join("skills")
    };
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills directory: {}", e))?;
    
    Ok(skills_dir.to_string_lossy().to_string())
}

