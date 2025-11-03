# 缓存 Token 重复计算修复总结

## 📋 问题描述

计费统计小组件中的**缓存创建 (Cache Creation)** 和 **缓存写入 (Cache Writing)** 数据被错误地重复计算，导致会话总成本被严重高估。

## 🔍 根本原因

**文件位置:** `src/lib/tokenExtractor.ts` 第148-169行

### 原始错误代码
```typescript
let cache_creation_tokens =
  rawUsage.cache_creation_tokens ??
  rawUsage.cache_write_tokens ??
  rawUsage.cache_creation_input_tokens ?? 0;

// ❌ 错误：使用 += 累加子项
if ((rawUsage as any).cache_creation) {
  const cacheCreation = (rawUsage as any).cache_creation;
  if (cacheCreation.ephemeral_5m_input_tokens) {
    cache_creation_tokens += cacheCreation.ephemeral_5m_input_tokens;
  }
  if (cacheCreation.ephemeral_1h_input_tokens) {
    cache_creation_tokens += cacheCreation.ephemeral_1h_input_tokens;
  }
}
```

### 问题分析

根据 Anthropic API 官方文档：
- `cache_creation_input_tokens` 是所有缓存写入的**总和**
- `cache_creation.ephemeral_5m_input_tokens` 和 `ephemeral_1h_input_tokens` 是**子项**
- 它们的关系：`cache_creation_input_tokens = ephemeral_5m + ephemeral_1h`

当 API 同时返回总和字段和子项对象时，原代码会：
1. 先获取 `cache_creation_input_tokens = 1000`
2. 再累加 `ephemeral_5m_input_tokens = 600`
3. 再累加 `ephemeral_1h_input_tokens = 400`
4. **错误结果：1000 + 600 + 400 = 2000**（正确应该是 1000）

## ✅ 修复方案

### 修复后代码
```typescript
let cache_creation_tokens = 0;

// 优先级1：使用API标准字段（这些字段已经是总和）
if (rawUsage.cache_creation_input_tokens !== undefined) {
  cache_creation_tokens = rawUsage.cache_creation_input_tokens;
} else if (rawUsage.cache_creation_tokens !== undefined) {
  cache_creation_tokens = rawUsage.cache_creation_tokens;
} else if (rawUsage.cache_write_tokens !== undefined) {
  cache_creation_tokens = rawUsage.cache_write_tokens;
}
// 优先级2：如果没有总和字段，才从cache_creation对象计算
else if ((rawUsage as any).cache_creation) {
  const cacheCreation = (rawUsage as any).cache_creation;
  if (cacheCreation.ephemeral_5m_input_tokens) {
    cache_creation_tokens += cacheCreation.ephemeral_5m_input_tokens;
  }
  if (cacheCreation.ephemeral_1h_input_tokens) {
    cache_creation_tokens += cacheCreation.ephemeral_1h_input_tokens;
  }
}
```

### 修复原理

使用**互斥选择**逻辑而非累加：
1. **优先使用总和字段**：如果 API 已经提供总和，直接使用
2. **降级到子项计算**：仅当没有总和字段时，才从子项计算
3. **避免重复**：确保总和字段和子项**永远不会同时使用**

## 📊 测试验证结果

### 场景1：同时返回总和和子项（重复计算场景）
```json
{
  "cache_creation_input_tokens": 1000,
  "cache_creation": {
    "ephemeral_5m_input_tokens": 600,
    "ephemeral_1h_input_tokens": 400
  }
}
```

| 版本 | 计算结果 | 状态 |
|------|---------|------|
| 修复前 | 2,000 tokens | ❌ 重复计算 50% |
| 修复后 | 1,000 tokens | ✅ 正确 |

### 场景2：仅返回总和字段
```json
{
  "cache_creation_input_tokens": 1000
}
```

| 版本 | 计算结果 | 状态 |
|------|---------|------|
| 修复前 | 1,000 tokens | ✅ 正确 |
| 修复后 | 1,000 tokens | ✅ 正确 |

### 场景3：仅返回子项（降级场景）
```json
{
  "cache_creation": {
    "ephemeral_5m_input_tokens": 600,
    "ephemeral_1h_input_tokens": 400
  }
}
```

| 版本 | 计算结果 | 状态 |
|------|---------|------|
| 修复前 | 1,000 tokens | ✅ 正确 |
| 修复后 | 1,000 tokens | ✅ 正确 |

## 💰 成本影响分析

以 **Claude Sonnet 4.5** 为例（缓存写入: $3.75/百万 tokens）：

| 会话规模 | 缓存 Tokens | 修复前成本 | 修复后成本 | 多计费用 | 高估比例 |
|---------|-----------|-----------|-----------|---------|---------|
| 小型会话 | 10,000 | $0.0750 | $0.0375 | $0.0375 | 100% |
| 中型会话 | 50,000 | $0.3750 | $0.1875 | $0.1875 | 100% |
| 大型会话 | 200,000 | $1.5000 | $0.7500 | $0.7500 | 100% |

**结论：** 修复前会导致缓存成本被高估 **100%**（翻倍）！

## 🎯 影响范围

此修复影响所有使用 `tokenExtractor` 的组件：

1. ✅ `useSessionCostCalculation.ts` - 会话成本计算 Hook
2. ✅ `ClaudeStatusIndicator.tsx` - 状态栏计费小组件
3. ✅ `ConversationMetrics.tsx` - 对话指标显示
4. ✅ `TokenCounter.tsx` - Token 计数器组件
5. ✅ `StreamMessage.tsx` - 流消息显示
6. ✅ `AIMessage.tsx` - AI 消息显示

## 📚 参考文档

- [Anthropic Prompt Caching 官方文档](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Anthropic API Usage 响应格式](https://anthropic.mintlify.app/en/docs/about-claude/pricing)

## ✅ 验证清单

- [x] 分析并定位重复计算的根本原因
- [x] 修复 `tokenExtractor.ts` 中的逻辑错误
- [x] 创建测试用例验证修复
- [x] 确认所有场景均正常工作
- [x] 验证成本计算准确性
- [x] 文档化修复过程

## 🚀 下一步建议

1. **运行完整测试套件** - 确保没有引入回归
2. **监控生产环境** - 观察修复后的计费准确性
3. **用户通知** - 考虑通知受影响的用户重新计算历史数据

---

**修复日期:** 2025-11-03
**修复文件:** `src/lib/tokenExtractor.ts`
**影响组件:** 所有使用计费统计的小组件
