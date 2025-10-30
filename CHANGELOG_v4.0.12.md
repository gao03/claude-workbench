# Changelog v4.0.12

## 🎯 Major Fix: Revert Feature

### Fixed Issues

1. **Message Index Calculation Error**
   - Fixed: Message index mismatch due to new Claude v2.0.29 message types
   - Added filtering for: `summary`, `file-history-snapshot`, `isSidechain`, `parent_tool_use_id`
   - Frontend and backend filtering logic now fully synchronized

2. **Agent File Handling**
   - Fixed: Agent files (agent-*.jsonl) weren't cleaned up on revert
   - Solution: Delete agent files when reverting to prompt #0, keep unchanged for other prompts

3. **Prompt Recording for New Sessions**
   - Fixed: Prompts weren't recorded for new sessions (effectiveSession was null)
   - Solution: Record prompt after receiving system:init message with session_id

4. **Critical Git Auto-Commit Bug** 🔴
   - Fixed: Git wasn't auto-committing changes after each prompt
   - Result: All prompts shared the same git_commit_before, causing all changes to be lost on revert
   - Solution: Auto-commit changes after each prompt completion

5. **JSONL File Corruption**
   - Fixed: Truncated JSONL files lacked trailing newline, causing JSON parse errors
   - Solution: Add trailing newline when truncating files

6. **Mark Completed Not Called**
   - Fixed: mark_prompt_completed wasn't called for new sessions
   - Solution: Use currentSessionId and extractedSessionInfo as fallback

### Technical Details

#### Message Filtering Rules

Both frontend and backend now filter:
- `type: "summary"` - conversation summaries
- `type: "file-history-snapshot"` - file history snapshots
- `isSidechain: true` - agent warmup messages
- `parent_tool_use_id !== null` - subagent tool messages
- Tool-result-only messages
- Warmup content
- Skills messages

#### Git Commit Workflow

```
Prompt #0: "Create 1.txt"
- git_commit_before = Initial commit
- Creates 1.txt
- Auto-commits -> Commit A
- git_commit_after = Commit A

Prompt #1: "Create 2.txt"
- git_commit_before = Commit A (latest at record time)
- Creates 2.txt
- Auto-commits -> Commit B
- git_commit_after = Commit B

Revert to Prompt #1:
- Git reset to Commit A
- Result: Only 1.txt exists ✓
```

### Files Modified

**Backend (Rust)**:
- `src-tauri/src/commands/prompt_tracker.rs`
  - Added message type filtering (summary, file-history-snapshot, isSidechain, parent_tool_use_id)
  - Added agent file handling
  - Added Git auto-commit in mark_prompt_completed
  - Fixed JSONL truncation to include trailing newline
  - Enhanced debug logging

- `src-tauri/src/commands/simple_git.rs`
  - Added `git_commit_changes()` function for auto-committing

**Frontend (TypeScript)**:
- `src/hooks/usePromptExecution.ts`
  - Fixed prompt recording for new sessions (record after system:init)
  - Fixed mark_prompt_completed call for new sessions (use fallback parameters)
  - Added session-specific listener recording logic
  - Removed emoji characters (causing Tailwind CSS errors)

- `src/components/ClaudeCodeSession.tsx`
  - Added isSidechain filtering
  - Added parent_tool_use_id filtering
  - Synchronized with backend filtering logic

### Breaking Changes

None. All changes are backward compatible.

### Migration Notes

- Existing sessions will continue to work
- Old .prompts.json files without git_commit_after will be auto-fixed on next completion
- Corrupted JSONL files may need manual cleanup (delete and restart session)

### Known Issues

None identified.

### Contributors

- AI Assistant (Claude)

---

**Release Date**: 2025-10-30  
**Version**: 4.0.12

