/**
 * 消息操作 Hook
 *
 * 从 ClaudeCodeSession 提取（原 128-241 行）
 * 提供消息级别的撤销、编辑、删除、截断操作
 */

import { useCallback } from 'react';
import { api } from '@/lib/api';
import { agentSDK } from '@/lib/agentSDK';
import type { ClaudeStreamMessage } from '@/types/claude';
import type { Checkpoint } from '@/lib/agentSDK';

interface MessageOperationsConfig {
  /** 会话 ID 和项目 ID */
  sessionInfo: { sessionId: string; projectId: string } | null;
  /** 项目路径 */
  projectPath: string;
  /** 当前消息列表（用于计算撤销数量） */
  messages: ClaudeStreamMessage[];
  /** 设置消息列表（用于清空触发重新加载） */
  setMessages: React.Dispatch<React.SetStateAction<ClaudeStreamMessage[]>>;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
}

interface MessageOperations {
  /** 撤销消息到指定索引 */
  handleMessageUndo: (messageIndex: number) => Promise<void>;
  /** 编辑指定索引的消息 */
  handleMessageEdit: (messageIndex: number, newContent: string) => Promise<void>;
  /** 删除指定索引的消息 */
  handleMessageDelete: (messageIndex: number) => Promise<void>;
  /** 截断消息到指定索引 */
  handleMessageTruncate: (messageIndex: number) => Promise<void>;
  /** 回退到检查点 */
  handleRewindToCheckpoint: (checkpointId: string) => Promise<void>;
  /** 加载检查点列表 */
  loadCheckpoints: () => Promise<Checkpoint[]>;
}

/**
 * 消息操作 Hook
 *
 * @param config - 配置对象
 * @returns 消息操作函数集合
 *
 * @example
 * const { handleMessageUndo, handleMessageEdit, handleMessageDelete, handleMessageTruncate } =
 *   useMessageOperations({
 *     sessionInfo: extractedSessionInfo,
 *     projectPath,
 *     messages,
 *     setMessages,
 *     setError
 *   });
 */
export function useMessageOperations(config: MessageOperationsConfig): MessageOperations {
  const { sessionInfo, projectPath, messages, setMessages, setError } = config;

  /**
   * 撤销消息到指定索引
   */
  const handleMessageUndo = useCallback(async (messageIndex: number) => {
    if (!sessionInfo || !projectPath) {
      console.error('[MessageOps] Missing session info or project path');
      return;
    }

    try {
      console.log(`[MessageOps] Undoing to message index ${messageIndex}`);

      // Calculate how many messages to undo
      const currentCount = messages.length;
      const countToUndo = currentCount - messageIndex;

      await api.messageUndo(
        sessionInfo.sessionId,
        sessionInfo.projectId,
        projectPath,
        countToUndo
      );

      // Reload messages
      setMessages([]);
      // Trigger session reload would be handled by parent if needed
      console.log(`[MessageOps] Successfully undid ${countToUndo} messages`);
    } catch (error) {
      console.error('[MessageOps] Failed to undo messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to undo messages');
    }
  }, [sessionInfo, projectPath, messages, setMessages, setError]);

  /**
   * 编辑指定索引的消息
   */
  const handleMessageEdit = useCallback(async (messageIndex: number, newContent: string) => {
    if (!sessionInfo || !projectPath) {
      console.error('[MessageOps] Missing session info or project path');
      return;
    }

    try {
      console.log(`[MessageOps] Editing message index ${messageIndex}`);

      await api.messageEdit(
        sessionInfo.sessionId,
        sessionInfo.projectId,
        projectPath,
        messageIndex,
        newContent
      );

      // Clear messages and reload
      setMessages([]);
      console.log('[MessageOps] Message edited, ready to regenerate');
    } catch (error) {
      console.error('[MessageOps] Failed to edit message:', error);
      setError(error instanceof Error ? error.message : 'Failed to edit message');
    }
  }, [sessionInfo, projectPath, setMessages, setError]);

  /**
   * 删除指定索引的消息
   */
  const handleMessageDelete = useCallback(async (messageIndex: number) => {
    if (!sessionInfo || !projectPath) {
      console.error('[MessageOps] Missing session info or project path');
      return;
    }

    try {
      console.log(`[MessageOps] Deleting message index ${messageIndex}`);

      await api.messageDelete(
        sessionInfo.sessionId,
        sessionInfo.projectId,
        projectPath,
        messageIndex
      );

      // Reload messages
      setMessages([]);
      console.log('[MessageOps] Message deleted successfully');
    } catch (error) {
      console.error('[MessageOps] Failed to delete message:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete message');
    }
  }, [sessionInfo, projectPath, setMessages, setError]);

  /**
   * 截断消息到指定索引
   */
  const handleMessageTruncate = useCallback(async (messageIndex: number) => {
    if (!sessionInfo || !projectPath) {
      console.error('[MessageOps] Missing session info or project path');
      return;
    }

    try {
      console.log(`[MessageOps] Truncating to message index ${messageIndex}`);

      await api.messageTruncateToIndex(
        sessionInfo.sessionId,
        sessionInfo.projectId,
        projectPath,
        messageIndex
      );

      // Reload messages
      setMessages([]);
      console.log('[MessageOps] Messages truncated successfully');
    } catch (error) {
      console.error('[MessageOps] Failed to truncate messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to truncate messages');
    }
  }, [sessionInfo, projectPath, setMessages, setError]);

  /**
   * 回退到检查点 (Agent SDK)
   */
  const handleRewindToCheckpoint = useCallback(async (checkpointId: string) => {
    if (!sessionInfo) {
      console.error('[MessageOps] Missing session info');
      return;
    }

    try {
      console.log(`[MessageOps] Rewinding to checkpoint ${checkpointId}`);

      // 使用 Agent SDK 回退
      await api.rewindToCheckpoint(sessionInfo.sessionId, checkpointId);

      // 重新加载会话历史
      const history = await agentSDK.getHistory();
      setMessages(history);

      console.log('[MessageOps] Successfully rewound to checkpoint');
    } catch (error) {
      console.error('[MessageOps] Failed to rewind:', error);
      setError(error instanceof Error ? error.message : 'Failed to rewind to checkpoint');
    }
  }, [sessionInfo, setMessages, setError]);

  /**
   * 获取可用的检查点列表 (Agent SDK)
   */
  const loadCheckpoints = useCallback(async (): Promise<Checkpoint[]> => {
    if (!sessionInfo) {
      console.warn('[MessageOps] No session info, returning empty checkpoints');
      return [];
    }

    try {
      const checkpoints = await api.getCheckpoints(sessionInfo.sessionId);
      return checkpoints;
    } catch (error) {
      console.error('[MessageOps] Failed to load checkpoints:', error);
      return [];
    }
  }, [sessionInfo]);

  return {
    handleMessageUndo,
    handleMessageEdit,
    handleMessageDelete,
    handleMessageTruncate,
    handleRewindToCheckpoint,
    loadCheckpoints,
  };
}
