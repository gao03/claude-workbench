# 缓存读取统计修复

## 🐛 问题描述

**计费组件中缓存读取被错误地无限累加**，导致显示数据严重偏离实际：

| 指标 | 实际值 | 错误显示 | 倍数 |
|------|--------|---------|------|
| Cache 读取 | 118,163 tokens | 6,534,352 tokens | **55倍** |
| Cache 写入 | 3,976 tokens | 1,402,824 tokens | **353倍** |

## 🎯 根本原因

### 错误逻辑（修复前）
```typescript
// src/hooks/useSessionCostCalculation.ts:124
cacheReadTokens += tokens.cache_read_tokens;  // ❌ 错误累加！
```

**问题分析：**
如果有 50 条消息都读取相同的 118,163 tokens 缓存：
- 错误累加：118,163 × 50 = **5,908,150 tokens** ❌
- 正确显示：**118,163 tokens**（当前缓存大小）✅

### 概念理解

#### 缓存创建（Cache Write）
- **含义**：新创建或增量添加到缓存的内容
- **统计方式**：**累加**（每次创建都付费）
- **示例**：
  ```
  消息1: 创建 10,000 tokens
  消息2: 创建 100 tokens
  会话总计: 10,000 + 100 = 10,100 tokens ✅
  ```

#### 缓存读取（Cache Read）
- **含义**：从缓存中读取的内容（整个缓存的大小）
- **统计方式**：**取最大值**（显示当前缓存大小）
- **示例**：
  ```
  消息1: 创建缓存 10,000 tokens
  消息2: 读取缓存 10,000 tokens
  消息3: 读取缓存 10,000 tokens
  消息4: 创建 100 tokens，现在缓存 = 10,100
  消息5: 读取缓存 10,100 tokens

  ❌ 错误累加: 10,000 + 10,000 + 10,100 + 10,100 = 40,100
  ✅ 正确显示: 10,100 (当前缓存大小)
  ```

## ✅ 修复方案

### 修改文件
`src/hooks/useSessionCostCalculation.ts`

### 修复代码
```typescript
// 缓存读取：取最大值（当前缓存大小），不累加！
cacheReadTokens = Math.max(cacheReadTokens, tokens.cache_read_tokens);

// 缓存创建：累加（每次创建都付费）
cacheWriteTokens += tokens.cache_creation_tokens;

// 总tokens：输入+输出+缓存写入+当前缓存大小
totalTokens = inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens;
```

### 关键点

1. **显示统计**：
   - Cache 读取 = `Math.max()` 所有消息中的 cache_read_tokens
   - 显示的是**当前缓存的大小**，而不是累计读取量

2. **成本计算**：
   - `totalCost` 已经通过 `calculateMessageCost()` 正确计算
   - 每次读取缓存都会产生费用，这部分由成本计算函数处理
   - 不需要额外累加

## 📊 修复验证

### 预期结果

基于用户数据（真实缓存：118,163 tokens）：

| 指标 | 修复前（错误） | 修复后（正确） |
|------|--------------|--------------|
| 输入 | 1,124 | 1,124 ✅ |
| 输出 | 23,674 | 23,674 ✅ |
| Cache 写入 | 1,402,824 | ~3,976 ✅ |
| Cache 读取 | 6,534,352 | 118,163 ✅ |
| 总 Tokens | 7,961,974 | ~146,937 ✅ |

### 成本影响

**修复前（错误）：**
- 显示成本：$7.5794
- Cache 读取成本被严重高估

**修复后（正确）：**
- 成本计算基于实际 API 调用
- 每次读取缓存正确计费，但显示为当前缓存大小

## 🔧 相关修复

此次同时修复了两个问题：

### 1. 缓存创建的重复计算（已修复）
**文件**：`src/lib/tokenExtractor.ts:148-169`

**问题**：`cache_creation_input_tokens` 和 `cache_creation` 对象子项被重复累加

**修复**：使用互斥优先级逻辑，避免重复计算

### 2. 缓存读取的错误累加（本次修复）
**文件**：`src/hooks/useSessionCostCalculation.ts:128`

**问题**：每条消息的 `cache_read_tokens` 被累加

**修复**：改为取最大值，显示当前缓存大小

## 📚 参考

- [Anthropic Prompt Caching 官方文档](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [官方成本追踪工具 cccost](https://github.com/badlogic/cccost)

## ✅ 总结

- ✅ 修复了缓存读取的错误累加
- ✅ 修复了缓存创建的重复计算
- ✅ 统计数据现在准确反映实际使用情况
- ✅ 成本计算保持正确（每次 API 调用都计费）

---

**修复日期**：2025-11-03
**修复文件**：
- `src/lib/tokenExtractor.ts`
- `src/hooks/useSessionCostCalculation.ts`
