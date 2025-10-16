/**
 * 会话成本计算 Hook
 *
 * 从 ClaudeCodeSession 提取（原 116-152 行）
 * 负责计算会话的 Token 成本并格式化显示
 */

import { useMemo } from 'react';
import { tokenExtractor } from '@/lib/tokenExtractor';
import type { ClaudeStreamMessage } from '@/types/claude';

interface SessionCostResult {
  /** 总成本（美元） */
  sessionCost: number;
  /** 格式化后的成本字符串 */
  formatCost: (amount: number) => string;
}

/**
 * 计算会话的 Token 成本
 *
 * @param messages - 会话消息列表
 * @returns 成本统计对象
 *
 * @example
 * const { sessionCost, formatCost } = useSessionCostCalculation(messages);
 * console.log(formatCost(sessionCost)); // "$0.0123" 或 "$1.234¢"
 */
export function useSessionCostCalculation(messages: ClaudeStreamMessage[]): SessionCostResult {
  // 计算总成本
  const sessionCost = useMemo(() => {
    if (messages.length === 0) return 0;

    let totalCost = 0;
    const relevantMessages = messages.filter(m => m.type === 'assistant' || m.type === 'user');

    relevantMessages.forEach(message => {
      const tokens = tokenExtractor.extract(message);

      // Claude 3.5 Sonnet 定价（每百万 Token）
      const pricing = {
        input: 3.00,
        output: 15.00,
        cache_write: 3.75,
        cache_read: 0.30
      };

      const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
      const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
      const cacheWriteCost = (tokens.cache_creation_tokens / 1_000_000) * pricing.cache_write;
      const cacheReadCost = (tokens.cache_read_tokens / 1_000_000) * pricing.cache_read;

      totalCost += inputCost + outputCost + cacheWriteCost + cacheReadCost;
    });

    return totalCost;
  }, [messages.length]); // 优化：仅在消息数量变化时重新计算

  // 格式化成本显示
  const formatCost = (amount: number): string => {
    if (amount === 0) return '$0.00';
    if (amount < 0.01) {
      // 小于 1 美分时显示为美分
      return `$${(amount * 100).toFixed(3)}¢`;
    }
    return `$${amount.toFixed(4)}`;
  };

  return { sessionCost, formatCost };
}
