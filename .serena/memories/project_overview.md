# Claude Workbench Overview
- Windows-focused desktop manager for Claude CLI workflows, built with React + Tauri + Rust backend.
- Provides project/session management, agent switching, MCP server integration, cost analytics, and multilingual UI.
- Frontend: React 18, TypeScript, Tailwind CSS 4, Framer Motion, i18next; Backend: Tauri 2 + Rust + SQLite.
- Source layout: `src/` (React app with `components/`, `hooks/`, `lib/`, `contexts/`, `i18n/`), `src-tauri/` (Rust commands, Tauri config/build), static assets under `public/` and `src/assets/`.
- Integrates with Claude CLI and Anthropic SDK for agent execution and context management.
