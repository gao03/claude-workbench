/**
 * 可显示消息过滤 Hook
 *
 * 从 ClaudeCodeSession 提取（原 343-403 行）
 * 负责过滤出应该在 UI 中显示的消息
 */

import { useMemo } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * 过滤出可显示的消息
 *
 * 过滤规则：
 * 1. 跳过没有实际内容的元消息（isMeta && !leafUuid && !summary）
 * 2. 跳过只包含工具结果的用户消息（工具结果已在 assistant 消息中显示）
 * 3. 跳过空内容的用户消息
 *
 * @param messages - 原始消息列表
 * @returns 过滤后的可显示消息列表
 *
 * @example
 * const displayableMessages = useDisplayableMessages(messages);
 * // 用于渲染 UI
 */
export function useDisplayableMessages(messages: ClaudeStreamMessage[]): ClaudeStreamMessage[] {
  return useMemo(() => {
    return messages.filter((message, index) => {
      // 规则 1：跳过没有实际内容的元消息
      if (message.isMeta && !message.leafUuid && !message.summary) {
        return false;
      }

      // 规则 2 & 3：处理用户消息
      if (message.type === 'user' && message.message) {
        // 跳过元消息标记的用户消息
        if (message.isMeta) return false;

        const msg = message.message;

        // 检查是否有空内容
        if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
          return false;
        }

        // 检查是否只包含工具结果
        if (Array.isArray(msg.content)) {
          let hasVisibleContent = false;

          for (const content of msg.content) {
            // 如果有文本内容，保留消息
            if (content.type === 'text') {
              hasVisibleContent = true;
              break;
            }

            // 检查工具结果是否会被跳过（已在 assistant 消息中显示）
            if (content.type === 'tool_result') {
              let willBeSkipped = false;

              if (content.tool_use_id) {
                // 向前查找匹配的 tool_use
                for (let i = index - 1; i >= 0; i--) {
                  const prevMsg = messages[i];

                  if (
                    prevMsg.type === 'assistant' &&
                    prevMsg.message?.content &&
                    Array.isArray(prevMsg.message.content)
                  ) {
                    const toolUse = prevMsg.message.content.find(
                      (c: any) => c.type === 'tool_use' && c.id === content.tool_use_id
                    );

                    if (toolUse) {
                      const toolName = toolUse.name?.toLowerCase();

                      // 这些工具有专用的 Widget，结果不需要单独显示
                      const toolsWithWidgets = [
                        'task',
                        'edit',
                        'multiedit',
                        'todowrite',
                        'ls',
                        'read',
                        'glob',
                        'bash',
                        'write',
                        'grep'
                      ];

                      if (
                        toolsWithWidgets.includes(toolName) ||
                        toolUse.name?.startsWith('mcp__')
                      ) {
                        willBeSkipped = true;
                      }
                      break;
                    }
                  }
                }
              }

              // 如果工具结果不会被跳过，说明有可见内容
              if (!willBeSkipped) {
                hasVisibleContent = true;
                break;
              }
            }
          }

          // 如果没有可见内容，过滤掉这条消息
          if (!hasVisibleContent) {
            return false;
          }
        }
      }

      // 其他情况保留消息
      return true;
    });
  }, [messages]);
}
