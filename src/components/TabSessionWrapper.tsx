import React, { useRef, useEffect } from 'react';
import { ClaudeCodeSession } from './ClaudeCodeSession';
import { useTabSession } from '@/hooks/useTabs';
import type { Session } from '@/lib/api';

interface TabSessionWrapperProps {
  tabId: string;
  session?: Session;
  initialProjectPath?: string;
  onProjectSettings?: (projectPath: string) => void;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  isActive: boolean;
}

/**
 * TabSessionWrapper - 标签页会话包装器
 * 为每个标签页提供独立的会话状态管理和生命周期控制
 * 使用React.memo优化，避免不必要的重新渲染
 */
const TabSessionWrapperComponent: React.FC<TabSessionWrapperProps> = ({
  tabId,
  session,
  initialProjectPath,
  onProjectSettings,
  onStreamingChange,
  isActive,
}) => {
  const { tab, updateStreaming, setCleanup } = useTabSession(tabId);
  const sessionRef = useRef<{ hasChanges: boolean; sessionId: string | null }>({
    hasChanges: false,
    sessionId: null,
  });

  // 🔧 NEW: Register cleanup callback for proper resource management
  useEffect(() => {
    const cleanup = async () => {
      console.log(`[TabSessionWrapper] Cleaning up resources for tab ${tabId}`);
      // This will be called when the tab is closed
      // The ClaudeCodeSession cleanup is handled by its own useEffect
    };

    setCleanup(cleanup);
  }, [tabId, setCleanup]);

  // 包装 onStreamingChange 以更新标签页状态
  const handleStreamingChange = (isStreaming: boolean, sessionId: string | null) => {
    sessionRef.current.sessionId = sessionId;
    updateStreaming(isStreaming, sessionId);
    onStreamingChange?.(isStreaming, sessionId);

    // 🔧 移除标题自动更新逻辑
    // 会话 ID 已经在 Tooltip 中显示，不需要在标题中重复显示
  };

  // 监听会话变化并标记为已更改
  useEffect(() => {
    // 这里可以监听会话内容变化
    // 暂时注释掉，等待 ClaudeCodeSession 组件支持变更回调
  }, []);

  // 当标签页变为非活跃时，保持会话状态在后台
  useEffect(() => {
    // 使用tabId来获取最新的tab信息，避免依赖tab对象引用
    const currentTab = tab; // tab来自useTabSession，但不作为依赖

    if (!isActive && currentTab) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now in background, preserving state`);
    } else if (isActive && currentTab) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now active`);
    }
  }, [isActive, tabId]); // 只依赖isActive和tabId，避免对象引用变化导致的无限循环

  return (
    <div
      className="h-full w-full"
      // 🔧 REMOVED: display control CSS - now using conditional rendering
    >
      <ClaudeCodeSession
        session={session}
        initialProjectPath={initialProjectPath}
        onProjectSettings={onProjectSettings}
        onStreamingChange={handleStreamingChange}
        isActive={isActive}
      />
    </div>
  );
};

// 使用React.memo优化，避免不必要的重新渲染
export const TabSessionWrapper = React.memo(TabSessionWrapperComponent, (prevProps, nextProps) => {
  // 自定义比较函数，只有这些props变化时才重新渲染
  return (
    prevProps.tabId === nextProps.tabId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.session?.id === nextProps.session?.id &&
    prevProps.initialProjectPath === nextProps.initialProjectPath
    // onProjectSettings, onStreamingChange 等函数props通常是稳定的
  );
});