/**
 * 诊断会话中的缓存行为
 *
 * 检查：
 * 1. 每条消息的缓存使用情况
 * 2. 是否正确使用了缓存读取而不是每次都创建
 * 3. 会话总计是否合理
 */

console.log('=== 缓存行为诊断工具 ===\n');
console.log('请将以下代码粘贴到浏览器控制台运行：\n');

const diagnosticCode = `
// 1. 获取当前会话的所有消息
const messages = []; // 替换为你的实际消息数组

console.log('🔍 诊断开始...\\n');
console.log(\`总消息数: \${messages.length}\\n\`);

// 2. 分析每条消息
const analysis = {
  total: messages.length,
  withCacheCreation: 0,
  withCacheRead: 0,
  neitherCache: 0,
  messages: []
};

messages.forEach((msg, i) => {
  const usage = msg.message?.usage || msg.usage || {};
  const hasCreate = (usage.cache_creation_input_tokens || 0) > 0;
  const hasRead = (usage.cache_read_input_tokens || 0) > 0;

  if (hasCreate) analysis.withCacheCreation++;
  if (hasRead) analysis.withCacheRead++;
  if (!hasCreate && !hasRead) analysis.neitherCache++;

  analysis.messages.push({
    index: i + 1,
    type: msg.type,
    input: usage.input_tokens || 0,
    output: usage.output_tokens || 0,
    cacheCreate: usage.cache_creation_input_tokens || 0,
    cacheRead: usage.cache_read_input_tokens || 0,
    behavior: hasCreate ? 'CREATE' : hasRead ? 'READ' : 'NONE'
  });
});

// 3. 显示结果
console.log('📊 缓存行为统计:\\n');
console.log(\`  ✏️  创建缓存的消息: \${analysis.withCacheCreation} 条\`);
console.log(\`  📖 读取缓存的消息: \${analysis.withCacheRead} 条\`);
console.log(\`  ⚪ 无缓存的消息: \${analysis.neitherCache} 条\\n\`);

// 4. 检查异常模式
console.log('🚨 异常检测:\\n');

if (analysis.withCacheCreation > 2) {
  console.warn(\`  ⚠️  过多的缓存创建！\`);
  console.warn(\`     预期：前1-2条消息创建缓存，后续消息应读取缓存\`);
  console.warn(\`     实际：\${analysis.withCacheCreation} 条消息都在创建缓存\\n\`);
  console.warn(\`  可能原因:\`);
  console.warn(\`     1. 缓存过期（5分钟TTL）\`);
  console.warn(\`     2. Prompt内容变化导致缓存失效\`);
  console.warn(\`     3. 没有正确设置cache_control\\n\`);
} else if (analysis.withCacheRead === 0 && analysis.total > 2) {
  console.warn(\`  ⚠️  没有命中任何缓存！\`);
  console.warn(\`     所有消息都在创建新缓存，未复用已有缓存\\n\`);
} else {
  console.log(\`  ✅ 缓存行为正常\`);
  console.log(\`     前期消息创建缓存，后续消息读取缓存\\n\`);
}

// 5. 详细消息列表（只显示前10条和最后5条）
console.log('📝 详细消息列表:\\n');

const toShow = analysis.messages.slice(0, Math.min(10, analysis.messages.length));
const tail = analysis.messages.length > 15 ? analysis.messages.slice(-5) : [];

toShow.forEach(m => {
  const icon = m.behavior === 'CREATE' ? '✏️' : m.behavior === 'READ' ? '📖' : '⚪';
  console.log(\`  \${icon} 消息 \${m.index}: [\${m.behavior}] \${m.type}\`);
  console.log(\`     输入: \${m.input.toLocaleString()}, 输出: \${m.output.toLocaleString()}\`);
  if (m.cacheCreate > 0) {
    console.log(\`     🔴 Cache创建: \${m.cacheCreate.toLocaleString()} tokens\`);
  }
  if (m.cacheRead > 0) {
    console.log(\`     🟢 Cache读取: \${m.cacheRead.toLocaleString()} tokens\`);
  }
  console.log('');
});

if (tail.length > 0) {
  console.log('  ... (中间消息省略) ...\\n');
  tail.forEach(m => {
    const icon = m.behavior === 'CREATE' ? '✏️' : m.behavior === 'READ' ? '📖' : '⚪';
    console.log(\`  \${icon} 消息 \${m.index}: [\${m.behavior}] \${m.type}\`);
    console.log(\`     输入: \${m.input.toLocaleString()}, 输出: \${m.output.toLocaleString()}\`);
    if (m.cacheCreate > 0) {
      console.log(\`     🔴 Cache创建: \${m.cacheCreate.toLocaleString()} tokens\`);
    }
    if (m.cacheRead > 0) {
      console.log(\`     🟢 Cache读取: \${m.cacheRead.toLocaleString()} tokens\`);
    }
    console.log('');
  });
}

// 6. 计算累加总计（按照官方cccost的方式）
const totals = analysis.messages.reduce((sum, m) => ({
  input: sum.input + m.input,
  output: sum.output + m.output,
  cacheCreate: sum.cacheCreate + m.cacheCreate,
  cacheRead: sum.cacheRead + m.cacheRead
}), { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 });

console.log('\\n💰 会话总计（官方cccost统计方式）:\\n');
console.log(\`  输入 Tokens: \${totals.input.toLocaleString()}\`);
console.log(\`  输出 Tokens: \${totals.output.toLocaleString()}\`);
console.log(\`  Cache 创建: \${totals.cacheCreate.toLocaleString()} tokens\`);
console.log(\`  Cache 读取: \${totals.cacheRead.toLocaleString()} tokens\`);
console.log(\`  总计: \${(totals.input + totals.output + totals.cacheCreate + totals.cacheRead).toLocaleString()} tokens\\n\`);

// 7. 成本估算（Sonnet 4.5定价）
const PRICING = {
  input: 3.0 / 1_000_000,
  output: 15.0 / 1_000_000,
  cacheWrite: 3.75 / 1_000_000,
  cacheRead: 0.30 / 1_000_000
};

const cost = {
  input: totals.input * PRICING.input,
  output: totals.output * PRICING.output,
  cacheWrite: totals.cacheCreate * PRICING.cacheWrite,
  cacheRead: totals.cacheRead * PRICING.cacheRead
};
cost.total = cost.input + cost.output + cost.cacheWrite + cost.cacheRead;

console.log('💵 成本估算（Claude Sonnet 4.5）:\\n');
console.log(\`  输入成本: $\${cost.input.toFixed(4)}\`);
console.log(\`  输出成本: $\${cost.output.toFixed(4)}\`);
console.log(\`  Cache创建成本: $\${cost.cacheWrite.toFixed(4)}\`);
console.log(\`  Cache读取成本: $\${cost.cacheRead.toFixed(4)}\`);
console.log(\`  \\n  总成本: $\${cost.total.toFixed(4)}\\n\`);

console.log('✅ 诊断完成！');
`;

console.log(diagnosticCode);
console.log('\n\n提示：将上面的代码粘贴到浏览器 DevTools Console 中运行');
console.log('需要先替换 messages 变量为你的实际消息数组');
