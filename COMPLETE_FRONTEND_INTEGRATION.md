# 前端集成完成指南

**当前状态**: 后端已完成 ✅  
**待完成**: 前端集成（约 1-2 小时工作量）

---

## 📋 剩余步骤清单

### ✅ 已完成
- [x] 后端 Git 操作模块
- [x] 后端提示词追踪
- [x] Tauri 命令注册
- [x] API 封装
- [x] 项目加载时 Git 初始化

### 🔄 待完成（按顺序）

#### 1. 修改 `src/hooks/usePromptExecution.ts`

在 `handleSendPrompt` 函数中（约第 153-157 行之后）：

```typescript
try {
  setIsLoading(true);
  setError(null);
  hasActiveSessionRef.current = true;

  // 🆕 添加：记录提示词发送
  let recordedPromptIndex = -1;
  if (effectiveSession) {
    try {
      recordedPromptIndex = await api.recordPromptSent(
        effectiveSession.id,
        effectiveSession.project_id,
        projectPath,
        prompt  // 原始提示词文本
      );
      console.log('[Prompt Revert] Recorded prompt #', recordedPromptIndex);
    } catch (err) {
      console.error('[Prompt Revert] Failed to record prompt:', err);
    }
  }

  // ... 原有的发送逻辑 ...
```

在 claude-complete 事件处理中（搜索 `claude-complete`）：

```typescript
// 在 AI 完成后标记
if (recordedPromptIndex >= 0 && effectiveSession) {
  api.markPromptCompleted(
    effectiveSession.id,
    effectiveSession.project_id,
    projectPath,
    recordedPromptIndex
  ).catch(err => {
    console.error('[Prompt Revert] Failed to mark completed:', err);
  });
}
```

#### 2. 修改 `src/components/FloatingPromptInput/types.ts`

```typescript
export interface FloatingPromptInputRef {
  addImage: (imagePath: string) => void;
  setPrompt: (text: string) => void;  // 🆕 添加
}
```

#### 3. 修改 `src/components/FloatingPromptInput/index.tsx`

在 `useImperativeHandle` 中：

```typescript
useImperativeHandle(ref, () => ({
  addImage: (imagePath: string) => {
    // ... 现有逻辑
  },
  setPrompt: (text: string) => {  // 🆕 添加
    setPrompt(text);
  }
}));
```

#### 4. 修改 `src/components/ClaudeCodeSession.tsx`

添加辅助函数（在组件内）：

```typescript
// 计算用户消息对应的 promptIndex
const getPromptIndexForMessage = useCallback((messageArrayIndex: number): number => {
  return messages.slice(0, messageArrayIndex + 1)
    .filter(m => m.type === 'user')
    .length - 1;
}, [messages]);

// 提取提示词文本
const extractPromptText = useCallback((message: ClaudeStreamMessage): string => {
  const content = message.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('');
  }
  return '';
}, []);

// 撤回处理
const handleRevert = useCallback(async (promptIndex: number) => {
  if (!effectiveSession) return;
  
  try {
    const promptText = await api.revertToPrompt(
      effectiveSession.id,
      effectiveSession.project_id,
      projectPath,
      promptIndex
    );
    
    // 重新加载消息
    const history = await api.loadSessionHistory(
      effectiveSession.id,
      effectiveSession.project_id
    );
    
    if (Array.isArray(history)) {
      setMessages(history);
    } else if (history && typeof history === 'object' && 'messages' in history) {
      setMessages((history as any).messages);
    }
    
    // 恢复提示词到输入框
    if (floatingPromptRef.current && promptText) {
      floatingPromptRef.current.setPrompt(promptText);
    }
  } catch (error) {
    console.error('Failed to revert:', error);
    setError('撤回失败：' + error);
  }
}, [effectiveSession, projectPath]);
```

在渲染消息的地方传递 props：

```typescript
{displayableMessages.map((message, index) => {
  const promptIndex = message.type === 'user' 
    ? getPromptIndexForMessage(index) 
    : undefined;
  
  return (
    <StreamMessageV2
      message={message}
      promptIndex={promptIndex}
      promptText={message.type === 'user' ? extractPromptText(message) : undefined}
      onRevert={handleRevert}
      // ... 其他 props
    />
  );
})}
```

#### 5. 修改 `src/components/message/StreamMessageV2.tsx`

添加 props 并传递给 UserMessage：

```typescript
interface StreamMessageV2Props {
  // ... 现有 props
  promptIndex?: number;
  promptText?: string;
  onRevert?: (promptIndex: number) => void;
}

// 在 user 消息渲染中
if (messageType === 'user') {
  return (
    <UserMessage
      message={message}
      promptIndex={promptIndex}
      promptText={promptText}
      onRevert={onRevert}
      // ... 其他 props
    />
  );
}
```

#### 6. 修改 `src/components/message/UserMessage.tsx`

```typescript
interface UserMessageProps {
  promptIndex?: number;
  promptText?: string;
  onRevert?: (promptIndex: number) => void;
  // ... 现有 props
}

// 显示撤回按钮
const showRevertButton = promptIndex !== undefined && onRevert;

// 撤回按钮（悬停显示）
{showRevertButton && (
  <Button onClick={() => setShowConfirmDialog(true)}>
    <RotateCcw /> 撤回
  </Button>
)}

// 确认对话框
const handleConfirmRevert = () => {
  if (promptIndex !== undefined && onRevert) {
    setShowConfirmDialog(false);
    onRevert(promptIndex);
  }
};
```

---

## 🎯 实现要点

### 核心逻辑

1. **promptIndex 只计算 user 类型消息**（不包括 system/assistant/result）
2. **在 handleSendPrompt 开始时记录**（确保有 effectiveSession）
3. **在 claude-complete 事件中标记完成**
4. **所有用户消息都显示撤回按钮**（包括最新的）
5. **撤回后提示词恢复到输入框**

### 调试技巧

```typescript
console.log('[Prompt Revert] Recorded prompt #', index);
console.log('[Prompt Revert] Prompt completed #', index);
console.log('[Prompt Revert] Reverting to #', index);
```

---

## 预期效果

```
用户："创建登录组件"
  → 控制台：[Prompt Revert] Recorded prompt # 0
  → AI 响应
  → 控制台：[Prompt Revert] Prompt completed # 0
  → 用户消息上显示撤回按钮
  → 点击撤回
  → 代码回滚 + 消息删除
  → 输入框显示："创建登录组件"
  → 可修改重发
```

---

**继续实现这些步骤即可完成功能！** 🚀

