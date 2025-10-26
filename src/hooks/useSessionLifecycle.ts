import { useCallback } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { api, type Session } from '@/lib/api';
import { normalizeUsageData } from '@/lib/utils';
import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * useSessionLifecycle Hook
 *
 * 管理会话生命周期，包括：
 * - 加载会话历史
 * - 检查活跃会话
 * - 重连到活跃会话
 * - 事件监听器管理
 *
 * 从 ClaudeCodeSession.tsx 提取（Phase 3）
 */

interface UseSessionLifecycleConfig {
  session: Session | undefined;
  isMountedRef: React.MutableRefObject<boolean>;
  isListeningRef: React.MutableRefObject<boolean>;
  hasActiveSessionRef: React.MutableRefObject<boolean>;
  unlistenRefs: React.MutableRefObject<UnlistenFn[]>;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ClaudeStreamMessage[]>>;
  setRawJsonlOutput: React.Dispatch<React.SetStateAction<string[]>>;
  setClaudeSessionId: (sessionId: string) => void;
  initializeProgressiveTranslation: (messages: ClaudeStreamMessage[]) => Promise<void>;
  processMessageWithTranslation: (message: ClaudeStreamMessage, payload: string) => Promise<void>;
}

interface UseSessionLifecycleReturn {
  loadSessionHistory: () => Promise<void>;
  checkForActiveSession: () => Promise<void>;
  reconnectToSession: (sessionId: string) => Promise<void>;
}

export function useSessionLifecycle(config: UseSessionLifecycleConfig): UseSessionLifecycleReturn {
  const {
    session,
    isMountedRef,
    isListeningRef,
    hasActiveSessionRef,
    unlistenRefs,
    setIsLoading,
    setError,
    setMessages,
    setRawJsonlOutput,
    setClaudeSessionId,
    initializeProgressiveTranslation,
    processMessageWithTranslation
  } = config;

  /**
   * 加载会话历史记录
   */
  const loadSessionHistory = useCallback(async () => {
    if (!session) return;

    try {
      setIsLoading(true);
      setError(null);

      const history = await api.loadSessionHistory(session.id, session.project_id);

      // Convert history to messages format
      const loadedMessages: ClaudeStreamMessage[] = history.map(entry => ({
        ...entry,
        type: entry.type || "assistant"
      }));

      // ✨ NEW: Normalize usage data for historical messages
      const processedMessages = loadedMessages.map(msg => {
        if (msg.message?.usage) {
          msg.message.usage = normalizeUsageData(msg.message.usage);
        }
        return msg;
      });

      // ✨ NEW: Immediate display - no more blocking on translation
      console.log('[useSessionLifecycle] 🚀 Displaying messages immediately:', loadedMessages.length);
      
      // ⚡ CRITICAL FIX: Use React 18 batching to ensure atomic state update
      // This ensures messages and loading state update together
      setMessages(processedMessages);
      setRawJsonlOutput(history.map(h => JSON.stringify(h)));
      
      // MUST be in same synchronous block to ensure batching
      setIsLoading(false);
      
      console.log('[useSessionLifecycle] ✅ Loading state cleared, messages displayed');

      // ✨ NEW: Start progressive translation in TRUE background (completely non-blocking)
      // ⚡ OPTIMIZATION: Use queueMicrotask + Promise to ensure zero blocking
      // The initializeProgressiveTranslation function will check if translation is enabled internally
      queueMicrotask(() => {
        initializeProgressiveTranslation(processedMessages).catch(err => {
          console.error('[useSessionLifecycle] Background translation failed:', err);
        });
      });

      // After loading history, we're continuing a conversation
    } catch (err) {
      console.error("Failed to load session history:", err);
      setError("加载会话历史记录失败");
      setIsLoading(false);
    }
  }, [session, setIsLoading, setError, setMessages, setRawJsonlOutput, initializeProgressiveTranslation]);

  /**
   * 检查会话是否仍在活跃状态
   */
  const checkForActiveSession = useCallback(async () => {
    // If we have a session prop, check if it's still active
    if (session) {
      try {
        const activeSessions = await api.listRunningClaudeSessions();
        const activeSession = activeSessions.find((s: any) => {
          if ('process_type' in s && s.process_type && 'ClaudeSession' in s.process_type) {
            return (s.process_type as any).ClaudeSession.session_id === session.id;
          }
          return false;
        });

        if (activeSession) {
          // Session is still active, reconnect to its stream
          console.log('[useSessionLifecycle] Found active session, reconnecting:', session.id);
          // IMPORTANT: Set claudeSessionId before reconnecting
          setClaudeSessionId(session.id);

          // Don't add buffered messages here - they've already been loaded by loadSessionHistory
          // Just set up listeners for new messages

          // Set up listeners for the active session
          reconnectToSession(session.id);
        }
      } catch (err) {
        console.error('Failed to check for active sessions:', err);
      }
    }
  }, [session, setClaudeSessionId]);

  /**
   * 重新连接到活跃会话
   */
  const reconnectToSession = useCallback(async (sessionId: string) => {
    console.log('[useSessionLifecycle] Reconnecting to session:', sessionId);

    // Prevent duplicate listeners
    if (isListeningRef.current) {
      console.log('[useSessionLifecycle] Already listening to session, skipping reconnect');
      return;
    }

    // Clean up previous listeners
    unlistenRefs.current.forEach(unlisten => unlisten && typeof unlisten === 'function' && unlisten());
    unlistenRefs.current = [];

    // IMPORTANT: Set the session ID before setting up listeners
    setClaudeSessionId(sessionId);

    // Mark as listening
    isListeningRef.current = true;

    // Set up session-specific listeners
    const outputUnlisten = await listen<string>(`claude-output:${sessionId}`, async (event) => {
      try {
        console.log('[useSessionLifecycle] Received claude-output on reconnect:', event.payload);

        if (!isMountedRef.current) return;

        // Store raw JSONL
        setRawJsonlOutput(prev => [...prev, event.payload]);

        // 🔧 CRITICAL FIX: Apply translation to reconnect messages too
        // Parse message
        const message = JSON.parse(event.payload) as ClaudeStreamMessage;

        // Apply translation using the same logic as handleStreamMessage
        await processMessageWithTranslation(message, event.payload);

      } catch (err) {
        console.error("Failed to parse message:", err, event.payload);
      }
    });

    const errorUnlisten = await listen<string>(`claude-error:${sessionId}`, (event) => {
      console.error("Claude error:", event.payload);
      if (isMountedRef.current) {
        setError(event.payload);
      }
    });

    const completeUnlisten = await listen<boolean>(`claude-complete:${sessionId}`, async (event) => {
      console.log('[useSessionLifecycle] Received claude-complete on reconnect:', event.payload);
      if (isMountedRef.current) {
        setIsLoading(false);
        // 🔧 FIX: Reset hasActiveSessionRef when session completes
        hasActiveSessionRef.current = false;
        console.log('[useSessionLifecycle] Reconnect session completed - ready for new input');
      }
    });

    unlistenRefs.current = [outputUnlisten, errorUnlisten, completeUnlisten];

    // Mark as loading to show the session is active
    if (isMountedRef.current) {
      setIsLoading(true);
      hasActiveSessionRef.current = true;
    }
  }, [
    isMountedRef,
    isListeningRef,
    hasActiveSessionRef,
    unlistenRefs,
    setClaudeSessionId,
    setRawJsonlOutput,
    setError,
    setIsLoading,
    processMessageWithTranslation
  ]);

  return {
    loadSessionHistory,
    checkForActiveSession,
    reconnectToSession
  };
}
