import React from "react";
import { Bot, Clock } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageContent } from "./MessageContent";
import { ToolCallsGroup } from "./ToolCallsGroup";
import { cn } from "@/lib/utils";
import { tokenExtractor } from "@/lib/tokenExtractor";
import type { ClaudeStreamMessage } from '@/types/claude';

interface AIMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 所有消息（用于工具结果查找） */
  streamMessages?: ClaudeStreamMessage[];
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 链接检测回调 */
  onLinkDetected?: (url: string) => void;
}

/**
 * 提取AI消息的文本内容
 */
const extractAIText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  // 如果是字符串，直接返回
  if (typeof content === 'string') return content;
  
  // 如果是数组，提取所有text类型的内容
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n\n');
  }
  
  return '';
};

/**
 * 检测消息中是否有工具调用
 */
const hasToolCalls = (message: ClaudeStreamMessage): boolean => {
  if (!message.message?.content) return false;
  
  const content = message.message.content;
  if (!Array.isArray(content)) return false;
  
  return content.some((item: any) => 
    item.type === 'tool_use' || item.type === 'tool_result'
  );
};

/**
 * AI消息组件
 * 左对齐卡片样式，支持工具调用展示
 */
export const AIMessage: React.FC<AIMessageProps> = ({
  message,
  streamMessages = [],
  isStreaming = false,
  className
}) => {
  const text = extractAIText(message);
  const hasTools = hasToolCalls(message);

  // 如果既没有文本又没有工具调用，不渲染
  if (!text && !hasTools) return null;

  // 格式化时间戳
  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('zh-CN', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  // 提取 tokens 统计
  const tokenStats = message.message?.usage ? (() => {
    const extractedTokens = tokenExtractor.extract({
      type: 'assistant',
      message: { usage: message.message.usage }
    });
    const parts = [`${extractedTokens.input_tokens}/${extractedTokens.output_tokens}`];
    if (extractedTokens.cache_creation_tokens > 0) {
      parts.push(`创建${extractedTokens.cache_creation_tokens}`);
    }
    if (extractedTokens.cache_read_tokens > 0) {
      parts.push(`缓存${extractedTokens.cache_read_tokens}`);
    }
    return parts.join(' | ');
  })() : null;

  return (
    <div className={cn("relative", className)}>
      <MessageBubble variant="assistant" isStreaming={isStreaming}>
        {/* 消息头部：整合标头和tokens统计 */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            {/* 左侧：头像 + 名称 + 时间 */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-500" />
              </div>
              <span className="font-medium">Claude</span>
              {formatTimestamp(message.timestamp) && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(message.timestamp)}
                  </span>
                </>
              )}
            </div>
            
            {/* 右侧：tokens统计 */}
            {tokenStats && (
              <div className="text-foreground/60 font-mono flex-shrink-0">
                Tokens: {tokenStats}
              </div>
            )}
          </div>
        </div>

        {/* 消息内容 */}
        {text && (
          <div className="px-4 pb-3">
            <MessageContent 
              content={text} 
              isStreaming={isStreaming && !hasTools}
            />
          </div>
        )}

        {/* 工具调用区域 */}
        {hasTools && (
          <ToolCallsGroup 
            message={message} 
            streamMessages={streamMessages}
          />
        )}
      </MessageBubble>
    </div>
  );
};
