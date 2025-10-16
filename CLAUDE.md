# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Workbench is a React 18 + Tauri 2 desktop application for managing Claude CLI projects and sessions. Built with TypeScript, Tailwind CSS, and Rust backend.

**Version**: v3.0.2 | **License**: AGPL-3.0

## Development Commands

### Essential Commands
```bash
npm run tauri:dev        # Start Tauri app with hot reload (primary dev command)
npm run dev              # Start Vite dev server only (port 1420)
npm run tauri:build-fast # Quick dev-release build
npm run tauri:build      # Production build (generates NSIS/MSI installers)
npm run build            # TypeScript + Vite build
npm run preview          # Preview production build
```

### Development Workflow
1. Run `npm run tauri:dev` - automatically starts Vite, compiles Rust, and opens desktop app
2. Frontend changes: Hot Module Reload (HMR) via Vite
3. Rust changes: Auto-recompile on save
4. Tauri config changes: Requires restart

## Architecture Overview

### Tech Stack
- **Frontend**: React 18.3.1, TypeScript 5.9.2, Vite 6.0.3, Tailwind CSS 4.1.8
- **Desktop**: Tauri 2.1.1 (Rust + WebView)
- **UI Libraries**: Radix UI (headless components), Framer Motion, react-hook-form + zod
- **Backend**: Rust 2021, Tokio, SQLite (rusqlite), reqwest

### Project Structure
```
src/
├── components/          # 50+ React components
│   ├── ui/             # Radix UI wrappers (Button, Dialog, Select, etc.)
│   ├── EnhancedHooksManager.tsx  # Claude Code Hooks editor [CRITICAL]
│   └── *Manager.tsx    # Feature managers (MCP, Projects, Sessions)
├── lib/                # Core business logic
│   ├── api.ts         # IPC communication layer (100+ commands)
│   ├── hooksManager.ts     # Hooks config management [CRITICAL]
│   ├── hooksConverter.ts   # Hooks format conversion [CRITICAL]
│   ├── claudeSDK.ts   # Claude API wrapper
│   └── tokenCounter.ts
├── types/
│   ├── hooks.ts       # Hook type definitions [CRITICAL]
│   └── subagents.ts
├── hooks/             # Custom React hooks
│   ├── useTabs.tsx    # Tab state management
│   └── useSessionSync.ts
├── contexts/          # React Context
│   └── ThemeContext.tsx
├── i18n/              # i18next internationalization
└── App.tsx            # Main app controller [CRITICAL]

src-tauri/
├── src/main.rs        # Rust backend entry
├── Cargo.toml         # 45+ Rust dependencies
└── tauri.conf.json    # App configuration
```

## Core System: Claude Code Hooks

**Priority**: This is the project's most innovative feature.

### Three-Level Configuration System
```
Priority: local > project > user
Files:
  user:    ~/.claude/CLAUDE.md
  project: ./CLAUDE.md
  local:   ./.claude.md
```

### Key Files
- **`lib/hooksManager.ts`**: Config merging, matcher priority resolution, dangerous command detection
- **`lib/hooksConverter.ts`**: Old/new format compatibility
- **`types/hooks.ts`**: 9 hook event types, HookMatcher interface, 5 predefined templates
- **`components/EnhancedHooksManager.tsx`**: Interactive hooks editor UI

### Hook Event Types
```typescript
PreToolUse, PostToolUse, Notification, UserPromptSubmit,
Stop, SubagentStop, PreCompact, SessionStart, SessionEnd
```

### Dangerous Command Detection
System automatically flags:
- `rm -rf /` or `rm -rf ~`
- `curl ... | bash` (remote code execution)
- `sudo` commands
- Fork bombs: `:(){ :|:& };:`
- Commands without proper quoting

## State Management

### App.tsx - Central State Hub
Manages 11 view routes:
```
welcome → projects → claude-code-session → editor/settings/mcp
                          ↓
                   claude-tab-manager
                          ↓
            project-settings → enhanced-hooks-manager
```

**Key State**:
- `view`: Current route
- `projects[]`: Project list
- `selectedProject`: Active project
- `navigationHistory[]`: Smart back navigation stack
- `isClaudeStreaming`: Streaming status

### Context Providers
- `ThemeContext`: Light/dark theme switching
- `TabProvider`: Multi-tab session management

### Custom Hooks
- `useTabs`: Tab lifecycle (open/close/switch)
- `useSessionSync`: Session synchronization
- `useTranslation`: i18next integration

## IPC Communication

**File**: `src/lib/api.ts` (2147 lines)

100+ typed commands via Tauri's `invoke()`:
```typescript
// Examples
await listProjects()
await createProject(name, path)
await openSession(projectId, sessionId)
await getHooksConfig(level)  // user/project/local
await validateHooksConfig(config)
await runMCPCommand(serverId, command)
```

All commands are type-safe with TypeScript interfaces.

## Building and Testing

### Build Profiles
```toml
[profile.dev-release]  # Fast iteration builds
opt-level = 2
debug = true

[profile.release]      # Production builds
opt-level = "z"        # Size optimization
lto = true
```

### Build Output
- **Frontend**: `dist/` (Vite static assets)
- **Rust**: `src-tauri/target/release/`
- **Installers**: NSIS/MSI (Windows), DMG/APP (macOS)

### TypeScript Configuration
- **Strict mode**: Enabled (`strict: true`)
- **Path aliases**: `@/*` → `src/*`
- **Target**: ES2020
- **No unused locals/parameters**: Enforced

## Code Splitting Strategy (vite.config.ts)

```javascript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'ui-vendor': ['@radix-ui/*'],
  'editor-vendor': ['@uiw/react-md-editor'],
  'tauri-vendor': ['@tauri-apps/api'],
  'utils': ['clsx', 'lucide-react']
}
```

## Important Development Notes

### Hooks System Development
When modifying Hooks:
1. **Types first**: Update `types/hooks.ts`
2. **Manager logic**: Modify `lib/hooksManager.ts` (merging/validation)
3. **UI updates**: Edit `components/EnhancedHooksManager.tsx`
4. **Test validation**: Ensure `validateConfig()` catches errors
5. **Check security**: Verify dangerous command detection works

### IPC Command Development
1. Define Rust command in `src-tauri/src/main.rs`
2. Add TypeScript interface in `src/lib/api.ts`
3. Export typed function from `api.ts`
4. Use in components with autocomplete support

### Component Development
- Use functional components + hooks (no class components)
- Prefer Radix UI primitives over custom implementations
- Use Tailwind utility classes (avoid CSS-in-JS unless dynamic)
- Follow React hooks rules (top-level, no conditionals)

### Navigation Flow
Use `setNavigationHistory()` to enable smart back button:
```typescript
setNavigationHistory(prev => [...prev, currentView]);
setView(newView);
```

## Debugging

### Frontend Debugging
- React DevTools: Inspect component tree
- Console logs: `console.log('Debug:', value)`
- Network: Check IPC calls in browser DevTools

### Rust Debugging
- Logs: `println!("Debug: {:?}", value);`
- Enable debug mode: `tauri.conf.json` → `build.devPath`

### Common Issues
- **Hooks not triggering**: Check file location and JSON validity
- **IPC failures**: Verify command exists in Rust backend
- **Build errors**: Try `npm run tauri:build-fast` for faster iteration
- **HMR not working**: Check Vite WebSocket connection (port 1421)

## Project Conventions

### File Naming
- Components: PascalCase (e.g., `EnhancedHooksManager.tsx`)
- Utilities: camelCase (e.g., `hooksManager.ts`)
- Types: camelCase files (e.g., `hooks.ts`) with PascalCase interfaces

### Import Aliases
```typescript
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
```

### i18n Support
Primary language: Chinese (zh)
Fallback: English (en)

All user-facing strings should use:
```typescript
const { t } = useTranslation();
<div>{t('key.path')}</div>
```

## Recent Changes

**Last Modified** (2025-10-17):
- Navigation history stack improvements
- Hooks system refinements
- Hooks format conversion updates

**Critical Files Recently Changed**:
- `src/App.tsx`
- `src/lib/hooksManager.ts`
- `src/lib/hooksConverter.ts`
- `src/types/hooks.ts`
