# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Workbench is a professional desktop application for managing Claude CLI projects, built with Tauri 2 (Rust backend) and React/TypeScript frontend. It provides a visual interface for Claude sessions, API provider management, and project organization.

## Common Development Commands

### Core Development
```bash
# Install dependencies (use Bun for faster installs)
bun install

# Start development mode with hot reload
bun run tauri:dev

# Build production version (optimized for size)
bun run tauri:build

# Fast build for testing (larger but quicker)
bun run tauri:build-fast

# Frontend-only development server
bun run dev

# Type checking
tsc --noEmit
```

### Testing & Debugging
```bash
# Run a specific Tauri command
cargo run --manifest-path src-tauri/Cargo.toml

# Check Rust code for errors
cd src-tauri && cargo check

# Run Rust linting
cd src-tauri && cargo clippy

# Format Rust code
cd src-tauri && cargo fmt
```

## High-Level Architecture

### Frontend-Backend Communication Flow
The application uses Tauri's IPC (Inter-Process Communication) system:
1. **Frontend** (`src/lib/api.ts`): TypeScript API client with typed methods
2. **IPC Bridge**: Tauri's `invoke()` function for type-safe calls
3. **Backend** (`src-tauri/src/commands/`): Rust command handlers
4. **Process Management** (`src-tauri/src/process/`): Claude CLI process spawning and monitoring

### Core Backend Modules
- **commands/claude.rs**: Main Claude CLI integration - handles session execution, streaming, and cancellation
- **commands/provider.rs**: API provider switching - manages environment variables for different Claude API endpoints
- **commands/agents.rs**: Agent system - stores and executes AI agents with custom prompts
- **commands/usage.rs**: Usage tracking - monitors token usage and costs across sessions
- **commands/mcp.rs**: MCP (Model Context Protocol) server management

### Frontend Architecture
- **Tab Management**: Multi-tab session support with background execution (`src/hooks/useTabs.tsx`)
- **Streaming Output**: Real-time Claude response rendering with JSONL parsing
- **Component Structure**:
  - `TabManager.tsx`: Manages multiple Claude sessions in tabs
  - `ClaudeCodeSession.tsx`: Individual session UI with streaming support
  - `ProviderManager.tsx`: API provider configuration interface
  - `UsageDashboard.tsx`: Token usage visualization

### State Management Patterns
- **Session State**: Managed per-tab with independent project contexts
- **Output Caching**: Progressive message rendering optimization (`src/lib/outputCache.tsx`)
- **Translation Cache**: Middleware for multi-language support (`src/lib/translationMiddleware.ts`)

### Database Schema
SQLite database at `~/.claude/claude_workbench.db`:
- `agents`: Stores AI agent configurations
- `agent_runs`: Tracks agent execution history
- `providers`: API provider configurations
- `subagent_specialties`: Specialized agent routing

## Critical Implementation Details

### Claude Process Management
The backend spawns Claude CLI processes with:
- Proper environment variable injection for API providers
- Real-time output streaming via JSONL
- Graceful cancellation with process cleanup
- Session recovery from crashes

### API Provider Switching
Silently switches Claude API endpoints by:
1. Setting environment variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, etc.)
2. Restarting Claude processes to apply new configuration
3. No system-wide environment pollution

### Performance Optimizations
- **Chunked Rendering**: Large outputs rendered progressively to prevent UI freezing
- **Virtual Scrolling**: Efficient rendering of long message histories
- **Build Profiles**:
  - `dev-release`: Fast builds for testing (2 min)
  - `release`: Production builds optimized for size (10+ min)

### Security Considerations
- API keys stored locally, never in code
- Sandboxed file access through Tauri permissions
- Process isolation for each Claude session

## Common Development Patterns

### Adding a New Tauri Command
1. Create Rust handler in `src-tauri/src/commands/`
2. Add to command module exports in `src-tauri/src/commands/mod.rs`
3. Register in `src-tauri/src/main.rs` command list
4. Add TypeScript types and API method in `src/lib/api.ts`

### Implementing New UI Features
1. Create component in `src/components/`
2. Add routing in `src/App.tsx` if needed
3. Use existing UI components from `src/components/ui/`
4. Follow existing patterns for API calls and state management

### Working with Claude Sessions
- Sessions are identified by UUID and stored in `~/.claude/projects/`
- Each session has a JSONL file with message history
- Project context is encoded in directory names

## Key Files to Understand

- **src/App.tsx**: Main application routing and view management
- **src/lib/api.ts**: Complete TypeScript API interface (2900+ lines)
- **src-tauri/src/commands/claude.rs**: Claude CLI integration logic
- **src-tauri/src/main.rs**: Tauri application entry point and command registration
- **src/components/TabManager.tsx**: Multi-session tab management