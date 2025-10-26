/**
 * 统一的 Claude 模型定价模块
 * 
 * 根据官方文档：https://docs.claude.com/en/docs/claude-code/costs
 * 价格单位：美元/百万 tokens
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * 模型定价常量（每百万 tokens）
 * 来源：Anthropic 官方定价
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 4.1 Opus
  'claude-opus-4.1': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.50
  },
  
  // Claude 4.5 Sonnet (current latest)
  'claude-sonnet-4.5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  
  // Claude 3.5 Sonnet
  'claude-sonnet-3.5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  
  // Default fallback (use Sonnet 4.5 pricing)
  'default': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  }
};

/**
 * 根据模型名称获取定价
 * @param model - 模型名称或标识符
 * @returns 模型定价对象
 */
export function getPricingForModel(model?: string): ModelPricing {
  if (!model) {
    return MODEL_PRICING['default'];
  }
  
  const normalizedModel = model.toLowerCase();
  
  // Claude 4.1 Opus
  if (normalizedModel.includes('opus-4') || normalizedModel.includes('opus 4')) {
    return MODEL_PRICING['claude-opus-4.1'];
  }
  
  // Claude 4.5 Sonnet
  if (normalizedModel.includes('sonnet-4.5') || normalizedModel.includes('sonnet 4.5')) {
    return MODEL_PRICING['claude-sonnet-4.5'];
  }
  
  // Claude 3.5 Sonnet
  if (normalizedModel.includes('sonnet-3.5') || normalizedModel.includes('sonnet 3.5') || normalizedModel.includes('35')) {
    return MODEL_PRICING['claude-sonnet-3.5'];
  }
  
  // Default to Sonnet 4.5 pricing
  return MODEL_PRICING['default'];
}

/**
 * 计算单个消息的成本
 * @param tokens - token 使用统计
 * @param model - 模型名称
 * @returns 成本（美元）
 */
export function calculateMessageCost(
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  },
  model?: string
): number {
  const pricing = getPricingForModel(model);
  
  const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (tokens.cache_creation_tokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (tokens.cache_read_tokens / 1_000_000) * pricing.cacheRead;
  
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * 格式化成本显示
 * @param amount - 成本金额（美元）
 * @returns 格式化的字符串
 */
export function formatCost(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) {
    // 小于 1 美分时显示为美分
    const cents = amount * 100;
    return `$${cents.toFixed(3)}¢`;
  }
  return `$${amount.toFixed(4)}`;
}

/**
 * 格式化时长
 * @param seconds - 秒数
 * @returns 格式化的时长字符串（如 "6m 19s" 或 "6h 33m"）
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

