# 消息撤回功能实现进度

**当前状态**: 后端完成，前端进行中  
**编译状态**: ✅ 全部通过

---

## ✅ 已完成

### 后端实现 (100%)

1. **simple_git.rs** - Git 基础操作
   - `is_git_repo()` - 检查 Git 仓库
   - `ensure_git_repo()` - 自动初始化
   - `git_current_commit()` - 获取 HEAD
   - `git_reset_hard()` - 代码回滚
   - `git_stash_save()` - 保存未提交
   - `check_and_init_git()` - Tauri 命令

2. **prompt_tracker.rs** - 提示词追踪
   - `record_prompt_sent()` - 记录发送
   - `mark_prompt_completed()` - 标记完成
   - `revert_to_prompt()` - 执行撤回
   - `get_prompt_list()` - 获取列表

3. **注册命令**
   - 导出模块 (mod.rs)
   - 注册 Tauri 命令 (main.rs)

4. **API 封装**
   - 5 个 API 方法已添加到 api.ts

5. **项目加载时Git初始化**
   - ClaudeCodeSession 中添加 useEffect
   - 自动检测并初始化 Git

---

## 🔄 待完成

### 前端集成 (剩余)

#### 步骤 5: 发送时记录提示词

文件：`src/hooks/usePromptExecution.ts`

需要在 `handleSendPrompt` 中：
```typescript
// 发送前
const promptIndex = await api.recordPromptSent(
  effectiveSession.id,
  effectiveSession.project_id,
  projectPath,
  prompt
);

// AI 完成后（在 claude-complete 事件中）
await api.markPromptCompleted(
  effectiveSession.id,
  effectiveSession.project_id,
  projectPath,
  promptIndex
);
```

#### 步骤 6-7: 撤回处理

文件：`src/components/ClaudeCodeSession.tsx`

添加：
- `getPromptIndexForMessage()` - 计算 promptIndex
- `handleRevert()` - 撤回处理函数

#### 步骤 8: FloatingPromptInput

文件：`src/components/FloatingPromptInput/types.ts`和`index.tsx`

添加 `setPrompt` 方法到 ref

#### 步骤 9-10: 消息组件

文件：`src/components/message/UserMessage.tsx` 和 `StreamMessageV2.tsx`

- 传递 promptIndex
- 显示撤回按钮
- 调用撤回函数

---

## 🎯 下一步

继续实现前端集成的 5 个步骤...

