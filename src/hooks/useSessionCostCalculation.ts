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
  /** 会话时长（秒） - wall time */
  durationSeconds: number;
  /** API 执行时长（秒） - 累计所有 API 调用时间 */
  apiDurationSeconds: number;
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
    console.log('[useSessionCostCalculation] 🔄 Calculating cost for', messages.length, 'messages');

    if (messages.length === 0) {
      console.log('[useSessionCostCalculation] ✅ No messages, returning zero stats');
      return {
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        durationSeconds: 0,
        apiDurationSeconds: 0
      };
    }

    let totalCost = 0;
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;

    // 🔍 诊断：记录所有消息类型
    const messageTypes = new Set(messages.map(m => m.type));
    console.log('[useSessionCostCalculation] 📊 Message types in session:', Array.from(messageTypes));

    // 🔍 诊断：检查是否有非标准类型的消息包含 token 数据
    const messagesWithTokens = messages.filter(m => {
      const tokens = tokenExtractor.extract(m);
      return tokens.total_tokens > 0;
    });
    const nonStandardMessagesWithTokens = messagesWithTokens.filter(
      m => m.type !== 'assistant' && m.type !== 'user'
    );
    if (nonStandardMessagesWithTokens.length > 0) {
      console.warn('[useSessionCostCalculation] ⚠️ Found tokens in non-standard message types:',
        nonStandardMessagesWithTokens.map(m => ({
          type: m.type,
          tokens: tokenExtractor.extract(m)
        }))
      );
    }

    const relevantMessages = messages.filter(m => m.type === 'assistant' || m.type === 'user');
    console.log('[useSessionCostCalculation] 📝 Relevant messages (assistant/user):', relevantMessages.length);

    relevantMessages.forEach((message, index) => {
      const tokens = tokenExtractor.extract(message);

      // ✅ 使用消息的实际模型定价（支持多模型）
      const model = (message as any).model || 'claude-sonnet-4.5';
      const cost = calculateMessageCost(tokens, model);

      console.log(`[useSessionCostCalculation] 💰 Message ${index + 1}/${relevantMessages.length}:`, {
        type: message.type,
        model,
        tokens: {
          input: tokens.input_tokens,
          output: tokens.output_tokens,
          cacheRead: tokens.cache_read_tokens,
          cacheWrite: tokens.cache_creation_tokens,
          total: tokens.total_tokens
        },
        cost: `$${cost.toFixed(6)}`
      });

      totalCost += cost;
      inputTokens += tokens.input_tokens;
      outputTokens += tokens.output_tokens;
      cacheReadTokens += tokens.cache_read_tokens;
      cacheWriteTokens += tokens.cache_creation_tokens;
      totalTokens += tokens.input_tokens + tokens.output_tokens +
                    tokens.cache_creation_tokens + tokens.cache_read_tokens;
    });

    // 计算会话时长（wall time - 从第一条到最后一条消息）
    let durationSeconds = 0;
    if (messages.length >= 2) {
      const firstTime = messages[0].timestamp || messages[0].receivedAt;
      const lastTime = messages[messages.length - 1].timestamp || messages[messages.length - 1].receivedAt;

      if (firstTime && lastTime) {
        const start = new Date(firstTime).getTime();
        const end = new Date(lastTime).getTime();
        durationSeconds = Math.max(0, (end - start) / 1000);
      }
    }

    // 计算 API 执行时长（TODO: 需要从消息中提取实际 API 响应时间）
    // 目前使用简化估算：每条 assistant 消息平均 2-10 秒
    const assistantMessages = relevantMessages.filter(m => m.type === 'assistant');
    const apiDurationSeconds = assistantMessages.length * 5; // 粗略估算

    console.log('[useSessionCostCalculation] ✅ Final stats:', {
      totalCost: `$${totalCost.toFixed(6)}`,
      totalTokens: totalTokens.toLocaleString(),
      inputTokens: inputTokens.toLocaleString(),
      outputTokens: outputTokens.toLocaleString(),
      cacheReadTokens: cacheReadTokens.toLocaleString(),
      cacheWriteTokens: cacheWriteTokens.toLocaleString(),
      durationSeconds: `${durationSeconds}s`,
      apiDurationSeconds: `${apiDurationSeconds}s`
    });

    return {
      totalCost,
      totalTokens,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      durationSeconds,
      apiDurationSeconds
    };
  }, [messages]); // ✅ 修复：依赖整个 messages 数组，而不仅仅是 length

  return {
    stats,
    formatCost: formatCostUtil,
    formatDuration
  };
}
