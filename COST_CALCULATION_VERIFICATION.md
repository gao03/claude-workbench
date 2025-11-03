# 成本计算修复验证指南

## 📋 修复内容总结

### 1. **修复 useMemo 依赖项** ✅

**文件**: `src/hooks/useSessionCostCalculation.ts:176`

**修改**:
```typescript
// 修改前
}, [messages.length]); // ❌ 只依赖消息数量

// 修改后
}, [messages]); // ✅ 依赖整个消息数组
```

**效果**:
- 消息内容变化时会重新计算成本
- 确保 token 数据更新后成本立即更新
- 解决成本显示滞后问题

---

### 2. **添加详细调试日志** ✅

**文件**: `src/hooks/useSessionCostCalculation.ts`

**新增日志**:
- 🔄 计算开始日志
- 📊 消息类型统计
- ⚠️ 非标准消息类型警告
- 📝 相关消息数量
- 💰 每条消息的详细成本
- ✅ 最终统计结果

**示例输出**:
```
[useSessionCostCalculation] 🔄 Calculating cost for 3 messages
[useSessionCostCalculation] 📊 Message types in session: ['user', 'assistant']
[useSessionCostCalculation] 📝 Relevant messages (assistant/user): 2
[useSessionCostCalculation] 💰 Message 1/2: {
  type: 'user',
  model: 'claude-sonnet-4.5',
  tokens: { input: 150, output: 0, cacheRead: 0, cacheWrite: 0, total: 150 },
  cost: '$0.000450'
}
[useSessionCostCalculation] 💰 Message 2/2: {
  type: 'assistant',
  model: 'claude-sonnet-4.5',
  tokens: { input: 150, output: 500, cacheRead: 0, cacheWrite: 0, total: 650 },
  cost: '$0.007950'
}
[useSessionCostCalculation] ✅ Final stats: {
  totalCost: '$0.008400',
  totalTokens: '800',
  inputTokens: '300',
  outputTokens: '500',
  cacheReadTokens: '0',
  cacheWriteTokens: '0',
  durationSeconds: '12s',
  apiDurationSeconds: '5s'
}
```

---

### 3. **优化 ClaudeStatusIndicator 日志** ✅

**文件**: `src/components/ClaudeStatusIndicator.tsx:120-153`

**新增日志**:
- 📊 无消息时的日志
- 💰 会话成本计算详情
- 活动状态判断逻辑
- 最终成本显示值

**示例输出**:
```
[ClaudeStatusIndicator] 💰 Session cost calculation: {
  sessionId: 'abc123',
  messagesCount: 3,
  rawCost: '$0.008400',
  isActive: true,
  shouldTrackCost: true,
  isCurrentSession: true,
  activityState: 'active',
  finalCost: '$0.008400'
}
```

---

## 🧪 验证步骤

### 步骤 1: 启动应用并打开控制台

1. 运行应用: `bun tauri dev`
2. 打开浏览器开发者工具 (F12)
3. 切换到 Console 标签
4. 清空控制台日志

---

### 步骤 2: 发送测试消息

1. 在应用中创建新会话或打开现有会话
2. 发送一条简单的测试消息，例如: "Hello, Claude!"
3. 等待 Claude 回复

---

### 步骤 3: 检查控制台日志

**预期看到的日志序列**:

```
[useSessionCostCalculation] 🔄 Calculating cost for 1 messages
[useSessionCostCalculation] 📊 Message types in session: ['user']
[useSessionCostCalculation] 📝 Relevant messages (assistant/user): 1
[useSessionCostCalculation] 💰 Message 1/1: { type: 'user', ... }
[useSessionCostCalculation] ✅ Final stats: { totalCost: '$0.000XXX', ... }
[ClaudeStatusIndicator] 💰 Session cost calculation: { ... }

// Claude 回复后
[useSessionCostCalculation] 🔄 Calculating cost for 2 messages
[useSessionCostCalculation] 📊 Message types in session: ['user', 'assistant']
[useSessionCostCalculation] 📝 Relevant messages (assistant/user): 2
[useSessionCostCalculation] 💰 Message 1/2: { type: 'user', ... }
[useSessionCostCalculation] 💰 Message 2/2: { type: 'assistant', ... }
[useSessionCostCalculation] ✅ Final stats: { totalCost: '$0.00XXXX', ... }
[ClaudeStatusIndicator] 💰 Session cost calculation: { ... }
```

---

### 步骤 4: 验证成本准确性

#### 4.1 手动计算预期成本

假设消息使用 `claude-sonnet-4.5` 模型:

**定价** (每百万 tokens):
- Input: $3.00
- Output: $15.00
- Cache Write: $3.75
- Cache Read: $0.30

**示例计算**:
```
用户消息: 150 input tokens
助手消息: 150 input tokens + 500 output tokens

成本计算:
- 用户输入: 150 / 1,000,000 * $3.00 = $0.00045
- 助手输入: 150 / 1,000,000 * $3.00 = $0.00045
- 助手输出: 500 / 1,000,000 * $15.00 = $0.0075
- 总计: $0.0084
```

#### 4.2 对比显示值

1. 查看控制台日志中的 `totalCost`
2. 查看 UI 中状态指示器显示的成本
3. 点击状态指示器打开 Popover，查看详细成本

**验证点**:
- ✅ 控制台日志中的成本与手动计算一致
- ✅ UI 显示的成本与控制台日志一致
- ✅ Popover 中的详细数据正确

---

### 步骤 5: 验证实时更新

1. 发送第二条消息
2. 观察控制台日志是否立即输出新的计算结果
3. 观察 UI 中的成本是否立即更新

**预期行为**:
- ✅ 每次消息更新都会触发重新计算
- ✅ 控制台立即输出新的日志
- ✅ UI 成本立即更新，无延迟

---

### 步骤 6: 验证会话切换

1. 创建会话 A，发送消息，记录成本 (例如 $0.0084)
2. 创建会话 B，发送消息，记录成本 (例如 $0.0056)
3. 切换回会话 A
4. 检查会话 A 的成本是否仍为 $0.0084

**验证点**:
- ✅ 会话 A 的成本保持不变
- ✅ 会话 B 的成本保持不变
- ✅ 控制台日志显示正确的 sessionId
- ✅ 没有成本累加或混淆

---

### 步骤 7: 验证非标准消息类型

如果控制台出现以下警告:

```
[useSessionCostCalculation] ⚠️ Found tokens in non-standard message types: [...]
```

**需要检查**:
1. 记录警告中的消息类型
2. 检查这些消息是否应该被计入成本
3. 如果应该计入，修改过滤逻辑

**当前过滤逻辑**:
```typescript
const relevantMessages = messages.filter(m => m.type === 'assistant' || m.type === 'user');
```

**可能需要添加的类型**:
- `message_start`
- `content_block_delta`
- `message_delta`
- 其他流式消息类型

---

## 🐛 常见问题排查

### 问题 1: 成本显示为 $0.00

**可能原因**:
1. 会话被标记为非活动状态
2. 消息中没有 token 数据
3. 消息类型不在过滤范围内

**排查步骤**:
1. 检查控制台日志中的 `isActive` 值
2. 检查 `shouldTrackCost` 和 `isCurrentSession` 值
3. 检查 `rawCost` 是否为 0
4. 检查 `relevantMessages` 数量是否为 0

---

### 问题 2: 成本不更新

**可能原因**:
1. useMemo 依赖项未正确设置 (已修复)
2. 消息数组引用未变化
3. React 组件未重新渲染

**排查步骤**:
1. 检查控制台是否有新的计算日志
2. 检查消息数组是否真的变化了
3. 使用 React DevTools 检查组件渲染

---

### 问题 3: 成本计算不准确

**可能原因**:
1. Token 数据提取错误
2. 模型定价不正确
3. 消息被重复计算

**排查步骤**:
1. 检查每条消息的 token 详情日志
2. 验证模型名称和定价
3. 检查是否有重复的消息 ID

---

## ✅ 验证清单

完成以下所有检查项:

- [ ] 控制台日志正常输出
- [ ] 每条消息都有详细的成本日志
- [ ] 最终统计结果正确
- [ ] UI 显示的成本与日志一致
- [ ] 成本实时更新，无延迟
- [ ] 会话切换后成本保持正确
- [ ] 无重复计算警告
- [ ] 无非标准消息类型警告 (或已确认可忽略)
- [ ] 手动计算的成本与显示值一致
- [ ] Popover 中的详细数据正确

---

## 📊 性能影响评估

### 日志开销

**当前日志量**:
- 每次计算: 约 5-10 条日志
- 每条消息: 1 条详细日志
- 总计: 约 10-20 条日志/次计算

**建议**:
- 开发环境: 保留所有日志
- 生产环境: 可以通过环境变量控制日志级别

**优化方案**:
```typescript
const DEBUG_COST_CALCULATION = import.meta.env.DEV; // 仅在开发环境启用

if (DEBUG_COST_CALCULATION) {
  console.log('[useSessionCostCalculation] ...');
}
```

---

## 🎯 下一步优化建议

### 1. 添加成本计算性能监控

```typescript
const startTime = performance.now();
// ... 计算逻辑 ...
const endTime = performance.now();
console.log(`[useSessionCostCalculation] ⏱️ Calculation took ${(endTime - startTime).toFixed(2)}ms`);
```

### 2. 添加成本异常检测

```typescript
if (totalCost > 1.0) { // 单次会话成本超过 $1
  console.warn('[useSessionCostCalculation] ⚠️ High cost detected:', totalCost);
}

if (totalCost < 0) {
  console.error('[useSessionCostCalculation] ❌ Negative cost detected:', totalCost);
}
```

### 3. 添加 Token 数据验证

```typescript
relevantMessages.forEach((message, index) => {
  const tokens = tokenExtractor.extract(message);
  const validation = tokenExtractor.validate(tokens);

  if (!validation.isValid) {
    console.error(`[useSessionCostCalculation] ❌ Invalid tokens in message ${index}:`, validation.warnings);
  }
});
```

---

## 📝 总结

### 修复效果

1. ✅ **成本实时更新** - 修复 useMemo 依赖项
2. ✅ **详细调试信息** - 添加完整的日志系统
3. ✅ **问题可追溯** - 每个计算步骤都有日志
4. ✅ **准确性验证** - 可以手动验证计算结果

### 验证要点

1. 发送测试消息，检查日志
2. 手动计算成本，对比显示值
3. 切换会话，验证成本隔离
4. 检查非标准消息类型警告

### 后续优化

1. 根据实际使用情况调整日志级别
2. 添加性能监控和异常检测
3. 优化消息类型过滤逻辑
4. 考虑添加成本预警功能
