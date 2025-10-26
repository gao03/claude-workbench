/**
 * 会话成本计算 Hook
 *
 * 优化：支持多模型定价，符合官方 Claude Code 规范
 * 参考：https://docs.claude.com/en/docs/claude-code/costs
 */

import { useMemo } from 'react';
import { tokenExtractor } from '@/lib/tokenExtractor';
import { calculateMessageCost, formatCost as formatCostUtil, formatDuration } from '@/lib/pricing';
import type { ClaudeStreamMessage } from '@/types/claude';

export interface SessionCostStats {
  /** 总成本（美元） */
  totalCost: number;
  /** 总 tokens */
  totalTokens: number;
  /** 输入 tokens */
  inputTokens: number;
  /** 输出 tokens */
  outputTokens: number;
  /** Cache 读取 tokens */
  cacheReadTokens: number;
  /** Cache 写入 tokens */
  cacheWriteTokens: number;
  /** 会话时长（秒） */
  durationSeconds: number;
}

interface SessionCostResult {
  /** 成本统计 */
  stats: SessionCostStats;
  /** 格式化成本字符串 */
  formatCost: (amount: number) => string;
  /** 格式化时长字符串 */
  formatDuration: (seconds: number) => string;
}

/**
 * 计算会话的 Token 成本和统计
 *
 * @param messages - 会话消息列表
 * @returns 成本统计对象
 *
 * @example
 * const { stats, formatCost } = useSessionCostCalculation(messages);
 * console.log(formatCost(stats.totalCost)); // "$0.0123"
 */
export function useSessionCostCalculation(messages: ClaudeStreamMessage[]): SessionCostResult {
  // 计算总成本和统计
  const stats = useMemo(() => {
    if (messages.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        durationSeconds: 0
      };
    }

    let totalCost = 0;
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    const relevantMessages = messages.filter(m => m.type === 'assistant' || m.type === 'user');

    relevantMessages.forEach(message => {
      const tokens = tokenExtractor.extract(message);
      
      // ✅ 使用消息的实际模型定价（支持多模型）
      const model = (message as any).model || 'claude-sonnet-4.5';
      const cost = calculateMessageCost(tokens, model);
      
      totalCost += cost;
      inputTokens += tokens.input_tokens;
      outputTokens += tokens.output_tokens;
      cacheReadTokens += tokens.cache_read_tokens;
      cacheWriteTokens += tokens.cache_creation_tokens;
      totalTokens += tokens.input_tokens + tokens.output_tokens + 
                    tokens.cache_creation_tokens + tokens.cache_read_tokens;
    });

    // 计算会话时长（从第一条到最后一条消息）
    let durationSeconds = 0;
    if (messages.length >= 2) {
      const firstTime = messages[0].timestamp || messages[0].receivedAt;
      const lastTime = messages[messages.length - 1].timestamp || messages[messages.length - 1].receivedAt;
      
      if (firstTime && lastTime) {
        const start = new Date(firstTime).getTime();
        const end = new Date(lastTime).getTime();
        durationSeconds = (end - start) / 1000;
      }
    }

    return {
      totalCost,
      totalTokens,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      durationSeconds
    };
  }, [messages.length]); // 优化：仅在消息数量变化时重新计算

  return { 
    stats, 
    formatCost: formatCostUtil,
    formatDuration
  };
}
