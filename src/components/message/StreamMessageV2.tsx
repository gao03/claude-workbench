import React from "react";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { StreamMessage as LegacyStreamMessage } from "../StreamMessage";
import type { ClaudeStreamMessage } from '@/types/claude';

interface StreamMessageV2Props {
  message: ClaudeStreamMessage;
  className?: string;
  streamMessages: ClaudeStreamMessage[];
  onLinkDetected?: (url: string) => void;
  claudeSettings?: { showSystemInitialization?: boolean };
  isStreaming?: boolean;
  promptIndex?: number;
  onRevert?: (promptIndex: number) => void;
}

/**
 * StreamMessage V2 - 重构版消息渲染组件
 *
 * 使用新的气泡式布局和组件架构
 * Phase 1: 基础消息显示 ✓
 * Phase 2: 工具调用折叠 ✓（已在 ToolCallsGroup 中实现）
 * Phase 3: 工具注册中心集成 ✓（已集成 toolRegistry）
 *
 * 架构说明：
 * - user 消息 → UserMessage 组件
 * - assistant 消息 → AIMessage 组件（集成 ToolCallsGroup + 思考块）
 * - 其他消息 → LegacyStreamMessage（向下兼容）
 */
export const StreamMessageV2: React.FC<StreamMessageV2Props> = ({
  message,
  className,
  streamMessages,
  onLinkDetected,
  claudeSettings,
  isStreaming = false,
  promptIndex,
  onRevert
}) => {
  // 根据消息类型渲染不同组件
  const messageType = message.type;

  // 对于非用户/assistant消息，使用原有渲染逻辑
  if (messageType !== 'user' && messageType !== 'assistant') {
    return (
      <LegacyStreamMessage
        message={message}
        streamMessages={streamMessages}
        onLinkDetected={onLinkDetected}
        claudeSettings={claudeSettings}
        className={className}
      />
    );
  }

  // 用户消息
  if (messageType === 'user') {
    return (
      <UserMessage
        message={message}
        className={className}
        promptIndex={promptIndex}
        onRevert={onRevert}
      />
    );
  }

  // AI消息
  if (messageType === 'assistant') {
    return (
      <AIMessage
        message={message}
        streamMessages={streamMessages}
        isStreaming={isStreaming}
        onLinkDetected={onLinkDetected}
        className={className}
      />
    );
  }

  // 其他类型消息使用原有渲染逻辑
  return (
    <LegacyStreamMessage
      message={message}
      streamMessages={streamMessages}
      onLinkDetected={onLinkDetected}
      claudeSettings={claudeSettings}
      className={className}
    />
  );
};
