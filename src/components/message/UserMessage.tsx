import React from "react";
import { MessageBubble } from "./MessageBubble";
import { MessageHeader } from "./MessageHeader";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from '@/types/claude';

interface UserMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 自定义类名 */
  className?: string;
}

/**
 * 提取用户消息的纯文本内容
 */
const extractUserText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  // 如果是字符串，直接返回
  if (typeof content === 'string') return content;
  
  // 如果是数组，提取所有text类型的内容
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');
  }
  
  return '';
};

/**
 * 用户消息组件
 * 右对齐气泡样式，简洁展示
 */
export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  className
}) => {
  const text = extractUserText(message);
  
  // 如果没有文本内容，不渲染
  if (!text) return null;

  return (
    <div className={cn("group relative", className)}>
      <MessageBubble variant="user">
        {/* 消息头部 */}
        <MessageHeader 
          variant="user" 
          timestamp={message.timestamp}
          showAvatar={false}
        />
        
        {/* 消息内容 */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      </MessageBubble>
    </div>
  );
};
