# 缓存 Token 统计的最终解释

## 🎯 官方实现验证

根据 **ccusage-rs**（Rust 官方 Claude Code 成本追踪工具）的源码：

```rust
// src/entry_processor.rs:138-142
daily_stat.input_tokens += entry.usage.input_tokens;
daily_stat.output_tokens += entry.usage.output_tokens;
daily_stat.cache_creation_tokens += entry.usage.cache_creation_input_tokens;  // ✅ 累加
daily_stat.cache_read_tokens += entry.usage.cache_read_input_tokens;          // ✅ 累加

// 第 146-150 行
daily_stat.total_tokens = daily_stat.input_tokens
    + daily_stat.output_tokens
    + daily_stat.cache_creation_tokens
    + daily_stat.cache_read_tokens;  // ✅ 全部累加
```

**结论：缓存读取的累加是正确的！**

## 💡 为什么要累加缓存读取？

### 成本角度
每次 API 调用都要**真实付费**读取缓存：

```
消息1: 创建缓存 118,163 tokens → 付费 $0.442（$3.75/MTok 写入）
消息2: 读取缓存 118,163 tokens → 付费 $0.035（$0.30/MTok 读取）
消息3: 读取缓存 118,163 tokens → 付费 $0.035（$0.30/MTok 读取）
...
消息55: 读取缓存 118,163 tokens → 付费 $0.035（$0.30/MTok 读取）

会话总计：
- Cache 创建：118,163 tokens（付费1次）
- Cache 读取：118,163 × 54 = 6,381,802 tokens（付费54次）
- 总成本：$0.442 + $0.035 × 54 = $2.332
```

**如果不累加缓存读取，成本计算就错了！**

## 📊 你的数据分析

根据你的截图：

| 项目 | 真实值 | 显示值 | 说明 |
|------|--------|--------|------|
| Cache 写入 | 118,163 | 1,402,824 | 需要检查为何创建这么多缓存 |
| Cache 读取 | 118,163/次 | 6,534,352 | ≈ 118,163 × 55 = 55次读取 ✅ |

### 问题诊断

**Cache 写入异常高（1,402,824）的可能原因：**

1. ❌ **重复计算问题**（已修复）
   - `tokenExtractor.ts` 中的 `cache_creation_input_tokens` 和 `cache_creation` 对象被重复累加
   - **修复**：使用互斥优先级逻辑

2. ⚠️ **缓存失效问题**（需要验证）
   - 如果缓存不断过期（5分钟TTL），每条消息都会重新创建缓存
   - 需要检查：是否大部分消息都有 `cache_creation_input_tokens > 0`？

3. ⚠️ **Prompt 变化问题**（需要验证）
   - 如果 system prompt 或 context 不断变化，会导致缓存失效
   - 需要检查：是否 prompt 内容在会话中频繁改变？

## ✅ 当前代码状态

### src/lib/tokenExtractor.ts
```typescript
// ✅ 已修复：避免重复计算
if (rawUsage.cache_creation_input_tokens !== undefined) {
  cache_creation_tokens = rawUsage.cache_creation_input_tokens;  // 优先使用总和
} else if ((rawUsage as any).cache_creation) {
  // 仅当没有总和时才从子项计算
  cache_creation_tokens += cacheCreation.ephemeral_5m_input_tokens;
  cache_creation_tokens += cacheCreation.ephemeral_1h_input_tokens;
}
```

### src/hooks/useSessionCostCalculation.ts
```typescript
// ✅ 正确：与官方 ccusage-rs 一致
cacheReadTokens += tokens.cache_read_tokens;      // 累加（每次读取都付费）
cacheWriteTokens += tokens.cache_creation_tokens; // 累加（每次创建都付费）
totalTokens = inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens;
```

## 🔧 建议的下一步

### 1. 验证缓存创建是否正常
运行以下诊断来检查每条消息的缓存行为：

```javascript
// 在浏览器控制台运行
const messages = /* 你的消息数组 */;
let createCount = 0, readCount = 0;

messages.forEach((msg, i) => {
  const usage = msg.message?.usage || msg.usage;
  if (usage) {
    const create = usage.cache_creation_input_tokens || usage.cache_creation_tokens || 0;
    const read = usage.cache_read_input_tokens || usage.cache_read_tokens || 0;
    if (create > 0) {
      console.log(`消息 ${i+1}: 创建缓存 ${create.toLocaleString()} tokens`);
      createCount++;
    }
    if (read > 0) {
      console.log(`消息 ${i+1}: 读取缓存 ${read.toLocaleString()} tokens`);
      readCount++;
    }
  }
});

console.log(`\n总结: ${createCount} 条创建缓存, ${readCount} 条读取缓存`);
console.log(`预期: 前1-2条创建，其余读取`);
```

### 2. 如果大部分消息都在创建缓存
这说明缓存没有被复用，可能的原因：
- ⏰ 缓存过期（5分钟TTL）→ 考虑使用1小时缓存
- 🔄 Prompt 变化 → 保持 system prompt 稳定
- ⚙️ 配置问题 → 检查 `cache_control` 设置

### 3. 如果是正常的缓存复用
那么显示的数据**就是正确的**：
- ✅ Cache 写入累加 = 所有创建的缓存总和
- ✅ Cache 读取累加 = 所有读取的缓存总和（多次读取）
- ✅ 成本 = 基于真实 API 调用计算

## 📚 参考资料

1. [ccusage-rs 官方实现](https://github.com/snowmead/ccusage-rs/blob/main/src/entry_processor.rs)
2. [Anthropic Prompt Caching 文档](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
3. [cccost 成本追踪工具](https://github.com/badlogic/cccost)

---

**最终结论：**
- ✅ 代码逻辑正确（与官方工具一致）
- ✅ 缓存读取累加是必要的（反映真实成本）
- ⚠️ 如果数据看起来异常高，需要检查是否缓存复用正常
