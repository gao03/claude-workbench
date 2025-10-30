# Revert Feature Fix Summary

## Fixed Issues

### 1. Message Index Calculation Error
**Problem**: New Claude version (2.0.29) introduced new message types that were counted incorrectly.

**Solution**: Added filtering for:
- `type: "summary"` - conversation summaries
- `type: "file-history-snapshot"` - file history
- `isSidechain: true` - agent warmup messages  
- `parent_tool_use_id !== null` - subagent messages
- Tool-result-only messages
- Warmup and Skills messages

**Files Modified**:
- `src-tauri/src/commands/prompt_tracker.rs` (backend)
- `src/components/ClaudeCodeSession.tsx` (frontend)

### 2. Agent File Handling
**Problem**: New version creates agent-*.jsonl files that weren't cleaned up.

**Solution**: 
- Revert to prompt #0: Delete all agent files
- Revert to prompt #N (N>0): Keep agent files (only contain initialization data)

**Files Modified**:
- `src-tauri/src/commands/prompt_tracker.rs`

### 3. Prompt Recording for New Sessions
**Problem**: `effectiveSession` is null for new sessions, preventing prompt recording.

**Solution**: Record prompt after receiving `system:init` message with session_id.

**Files Modified**:
- `src/hooks/usePromptExecution.ts`

### 4. Git Auto-Commit
**Problem**: Claude Code doesn't auto-commit changes, causing all prompts to share the same git_commit_before, resulting in all changes being lost on revert.

**Solution**: Auto-commit changes after each prompt completion.

**Files Modified**:
- `src-tauri/src/commands/simple_git.rs` - Added `git_commit_changes()` function
- `src-tauri/src/commands/prompt_tracker.rs` - Auto-commit in `mark_prompt_completed()`

### 5. JSONL File Corruption
**Problem**: Truncated JSONL files lacked trailing newline, causing JSON parse errors when new messages were appended.

**Solution**: Add trailing newline when truncating files.

**Files Modified**:
- `src-tauri/src/commands/prompt_tracker.rs`

### 6. Mark Completed Not Called for New Sessions
**Problem**: `mark_prompt_completed` wasn't called for new sessions due to null `effectiveSession`.

**Solution**: Use `currentSessionId` and `extractedSessionInfo` as fallback.

**Files Modified**:
- `src/hooks/usePromptExecution.ts`

## Key Filter Rules (Frontend & Backend Must Match)

| Rule | Description |
|------|-------------|
| `type !== "user"` | Only process user messages |
| `type === "summary"` | Skip conversation summaries |
| `type === "file-history-snapshot"` | Skip file history |
| `isSidechain === true` | Skip agent warmup messages |
| `parent_tool_use_id !== null` | Skip subagent messages |
| Tool-result-only | Skip tool execution results |
| Contains "Warmup" | Skip warmup content |
| Contains "<command-name>" | Skip skills messages |

## Git Commit Workflow

```
Initial: commit A

Prompt #0: "Create 1.txt"
- git_commit_before = A (recorded at send)
- Claude creates 1.txt
- Auto-commit -> commit B
- git_commit_after = B

Prompt #1: "Create 2.txt"  
- git_commit_before = B (latest commit at send time)
- Claude creates 2.txt
- Auto-commit -> commit C
- git_commit_after = C

Revert to Prompt #1:
- Git reset to commit B
- Result: 1.txt exists, 2.txt deleted ✓
```

## Test Scenarios

1. Basic revert to middle prompt
2. Revert to initial state (prompt #0)
3. Multiple consecutive reverts
4. Revert after subagent activation
5. Revert when no file changes

## Status

- ✅ Compiled successfully
- ✅ Message index calculation fixed
- ✅ Agent file handling implemented
- ✅ Git auto-commit enabled
- ✅ JSONL file format fixed
- ⏳ User testing required

## Version

v4.0.11+

