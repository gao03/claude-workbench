// 快速诊断脚本：检查会话中每条消息的缓存统计

console.log('请在浏览器控制台中运行以下代码来诊断：\n');
console.log(`
// 1. 打开 DevTools Console (F12)
// 2. 粘贴并运行以下代码：

const messages = window.__CLAUDE_WORKBENCH_MESSAGES__ || [];
console.log('=== 缓存统计诊断 ===\n');
console.log(\`总消息数: \${messages.length}\n\`);

messages.forEach((msg, i) => {
  const usage = msg.message?.usage || msg.usage || {};
  if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
    console.log(\`消息 \${i + 1}:\`);
    console.log(\`  类型: \${msg.type}\`);
    console.log(\`  输入: \${usage.input_tokens || 0}\`);
    console.log(\`  输出: \${usage.output_tokens || 0}\`);
    console.log(\`  Cache 创建: \${usage.cache_creation_input_tokens || usage.cache_creation_tokens || 0}\`);
    console.log(\`  Cache 读取: \${usage.cache_read_input_tokens || usage.cache_read_tokens || 0}\`);
    console.log('');
  }
});

// 计算总和
const totals = messages.reduce((sum, msg) => {
  const usage = msg.message?.usage || msg.usage || {};
  return {
    cache_creation: sum.cache_creation + (usage.cache_creation_input_tokens || usage.cache_creation_tokens || 0),
    cache_read: sum.cache_read + (usage.cache_read_input_tokens || usage.cache_read_tokens || 0),
    input: sum.input + (usage.input_tokens || 0),
    output: sum.output + (usage.output_tokens || 0)
  };
}, { cache_creation: 0, cache_read: 0, input: 0, output: 0 });

console.log('=== 累加总计 ===');
console.log(\`输入: \${totals.input}\`);
console.log(\`输出: \${totals.output}\`);
console.log(\`Cache 创建: \${totals.cache_creation}\`);
console.log(\`Cache 读取: \${totals.cache_read}\`);
console.log(\`总计: \${totals.input + totals.output + totals.cache_creation + totals.cache_read}\`);
`);
