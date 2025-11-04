import React from "react";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { SystemMessage } from "./SystemMessage";
import { ResultMessage } from "./ResultMessage";
import { SummaryMessage } from "./SummaryMessage";
import type { ClaudeStreamMessage } from '@/types/claude';

interface StreamMessageV2Props {
  message: ClaudeStreamMessage;
  className?: string;
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
 * - system / result / summary → 对应消息组件
 * - 其他消息类型（meta 等）默认忽略
 */
export const StreamMessageV2: React.FC<StreamMessageV2Props> = ({
  message,
  className,
  onLinkDetected,
  claudeSettings,
  isStreaming = false,
  promptIndex,
  onRevert
}) => {
  const messageType = (message as ClaudeStreamMessage & { type?: string }).type ?? (message as any).type;

  switch (messageType) {
    case 'user':
      return (
        <UserMessage
          message={message}
          className={className}
          promptIndex={promptIndex}
          onRevert={onRevert}
        />
      );

    case 'assistant':
      return (
        <AIMessage
          message={message}
          isStreaming={isStreaming}
          onLinkDetected={onLinkDetected}
          className={className}
        />
      );

    case 'system':
      return (
        <SystemMessage
          message={message}
          className={className}
          claudeSettings={claudeSettings}
        />
      );

    case 'result':
      return (
        <ResultMessage
          message={message}
          className={className}
        />
      );

    case 'summary':
      return (
        <SummaryMessage
          message={message}
          className={className}
        />
      );

    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[StreamMessageV2] Unhandled message type:', (message as any).type, message);
      }

      return null;
  }
};
