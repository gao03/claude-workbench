# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Workbench is a React 18 + Tauri 2 desktop application for managing Claude CLI projects and sessions. The core innovation is the **Claude Code Hooks Configuration System** with three-level priority (user/project/local).

**Architecture**:
```
React 18 UI Layer (50+ components)
    ↓ IPC (Type-safe RPC)
Tauri 2 Bridge Layer
    ↓
Rust Backend (Process management + Claude CLI)
```

---

## Development Commands

### Quick Start
```bash
npm run tauri:dev           # Full development mode (Vite + Tauri + HMR)
                            # Opens desktop app with hot reload
                            # DevTools: Ctrl+Shift+I
```

### Build & Release
```bash
npm run build               # TypeScript + Vite build (prerequisite)
npm run tauri:build         # Full production build (MSI/NSIS installers)
npm run tauri:build-fast    # Fast dev-release build for testing
```

### Frontend Only
```bash
npm run dev                 # Vite dev server only (http://localhost:1420)
npm run preview             # Preview built assets
```

---

## Core Architecture

### Key Modules

| Module | Path | Responsibility |
|--------|------|----------------|
| **Main App** | `src/App.tsx` | View routing, global state, navigation history |
| **Hooks Core** | `src/lib/hooksManager.ts` | 3-level config merge, validation, security checks |
| **Hooks Converter** | `src/lib/hooksConverter.ts` | Old→New format compatibility |
| **Type Definitions** | `src/types/hooks.ts` | Hooks interfaces + templates (9 event types) |
| **Hooks UI** | `src/components/EnhancedHooksManager.tsx` | Interactive config editor with live validation |
| **IPC Bridge** | `src/lib/api.ts` | Claude API + Tauri RPC communication |

### Hooks System Architecture

**3-Level Configuration Priority** (higher level overrides lower):
```
1. User:    ~/.claude/CLAUDE.md         (Global defaults)
2. Project: ./CLAUDE.md                 (Project-specific)
3. Local:   ./.claude.md                (Temporary overrides) ← Highest
```

**9 Hook Event Types**:
- Tool-level: `PreToolUse`, `PostToolUse` (with matchers)
- Event-level: `Notification` (optional matcher), `UserPromptSubmit`, `Stop`, `SubagentStop`, `PreCompact`, `SessionStart`, `SessionEnd`

**Key Functions**:
- `mergeConfigs(user, project, local)` - Merges configs with priority resolution
- `validateConfig(hooks)` - Validates regex + detects 10+ dangerous patterns
- `triggerHooks(eventType, data)` - Executes matching hooks

**Security Checks** (automatic warnings):
```bash
✗ rm -rf / or ~           # Root/home deletion
✗ curl | bash             # Remote code execution
✗ sudo                    # Privilege escalation
✗ Unquoted $variables     # Code injection risks
```

---

## Code Conventions

### TypeScript Strict Mode
- All strict checks enabled (no rule disabling)
- Path alias: `@/*` → `src/*`
- Complete dependency arrays in hooks (no exhaustive-deps disable)

### React Component Pattern
```typescript
export function ComponentName({ prop }: Props) {
  const [state, setState] = useState<Type>(initial);

  useEffect(() => {
    // Side effects
  }, [complete, dependency, list]);  // Never omit dependencies

  return <div>Content</div>;
}

interface Props {
  prop: string;
}
```

### State Management
- **App.tsx**: Global state (view, projects, sessions, streaming status)
- **Context API**: `ThemeContext`, `TabProvider`
- **LocalStorage**: Claude config, session history
- **Custom Hooks**: `useTranslation`, `useTabs`, `useSessionSync`

### Hooks Security Best Practices
```bash
# Safe patterns:
✓ jq extraction: $(jq -r .field)
✓ Quoted variables: "$variable"
✓ Specific paths: /path/to/file (not /)
✓ Verification: echo "Debug: $value"

# Dangerous patterns (auto-detected):
✗ rm -rf / or ~
✗ curl | bash
✗ sudo commands
✗ Unquoted $variables
✗ Fork bombs: :(){ :|:& };:
```

---

## Build Configuration

### Vite Optimization (vite.config.ts)
- Port: 1420 (strict, fails if occupied)
- HMR: WebSocket on 1421
- Chunk splitting: `react-vendor`, `ui-vendor`, `editor-vendor`, `tauri`, `utils`
- Warning limit: 2000 KB

### Tauri Security (tauri.conf.json)
- CSP: Strict (asset:, ipc:, blob:, data: only)
- FS scope: `$HOME/**`, `$TEMP/**`
- HTTP scope: `https://api.siliconflow.cn/**`

---

## Tech Stack

```
React:              18.3.1
TypeScript:         5.9.2 (strict mode)
Tauri:              2.1.1 (plugins: shell, dialog, opener)
Vite:               6.0.3
Tailwind CSS:       4.1.8
Framer Motion:      12.0
@anthropic-ai/sdk:  0.63.1
Node.js:            18.0+ required
```

---

## Common Development Scenarios

### Debugging Hooks Configuration
```typescript
// Validate hooks config
const result = await HooksManager.validateConfig(hooks);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);

// Check merged config
const merged = HooksManager.mergeConfigs(userConfig, projectConfig, localConfig);
console.log('Final config:', merged);
```

### Adding New Hook Event Type
1. Add to `HooksConfiguration` interface in `src/types/hooks.ts`
2. Update `allEvents` array in `src/lib/hooksManager.ts`
3. Call `triggerHooks(newEvent, data)` where appropriate

### Modifying UI Components
- Base components: `src/components/ui/*` (Radix UI wrappers)
- Business components: `src/components/*Manager.tsx`
- Follow function component + hooks pattern
- Use Tailwind CSS utility classes

---

## Troubleshooting

**Window not showing on dev start**:
- `main.tsx` has intentional 100ms delay for React mount completion

**HMR not working**:
- Check `TAURI_DEV_HOST` environment variable
- Verify Vite WebSocket proxy on port 1421

**Rust compilation errors**:
- Try `npm run tauri:build-fast` for faster dev-release build

**Hooks not triggering**:
1. Verify file location (CLAUDE.md vs .claude.md)
2. Check JSON format validity
3. Test regex patterns in matcher
4. Review `validateConfig()` error messages

---

## Project Structure

```
src/
├── components/              # 50+ React components
│   ├── ui/                 # Radix UI base components (15+)
│   └── *Manager.tsx        # Business logic components
├── lib/                    # Core business logic
│   ├── hooksManager.ts    # Hooks config management [CORE]
│   ├── hooksConverter.ts  # Format conversion [CORE]
│   └── api.ts             # IPC communication
├── types/                 # TypeScript definitions
│   └── hooks.ts           # Hooks interfaces [CORE]
├── hooks/                 # React custom hooks
├── contexts/              # React Context providers
├── i18n/                  # Internationalization (Chinese-first)
├── App.tsx               # Main application [CRITICAL]
└── main.tsx              # React entry point

src-tauri/
├── src/main.rs           # Tauri backend
└── Cargo.toml            # Rust dependencies
```

---

**Version**: 3.0.2
**License**: AGPL-3.0
**Last Updated**: 2025-10-17
