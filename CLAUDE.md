# Claude Workbench - 项目配置文档

## 一、项目基础信息

**项目名称**: Claude Workbench
**版本**: v3.0.2
**许可证**: AGPL-3.0
**类型**: React 18 + Tauri 2 桌面应用（Windows 优先）

### 核心功能定位

Claude Workbench 是一个专业的 Claude CLI 桌面管理工具，提供：
- Claude 项目与会话的可视化管理
- 流式 Claude 响应展示与 Markdown 渲染
- Agent 系统支持与 GitHub 集成
- Model Context Protocol (MCP) 服务器管理
- **Claude Code Hooks 配置管理**（核心创新特性）

---

## 二、技术栈与架构

### 2.1 前端技术栈
```
React 18.3.1          核心 UI 框架
TypeScript 5.9.2      类型安全开发
Tailwind CSS 4.1.8    实用优先的样式框架
Vite 6.0.3            现代化打包工具
Framer Motion 12.0    高级动画库
i18next 25.3.2        国际化支持（中文优先）
```

**关键 UI 库**:
- Radix UI (多个组件库)：Dialog、Dropdown、Select、Tabs、Tooltip 等
- react-hook-form + zod：表单管理与验证
- react-syntax-highlighter：代码高亮
- @uiw/react-md-editor：Markdown 编辑器
- lucide-react：图标库
- @tanstack/react-virtual：虚拟列表（高性能）

### 2.2 后端 & 桌面层
```
Tauri 2.1.1           Rust + WebView 桌面框架
Rust                  高性能系统编程
Windows API           原生 Windows 集成
@anthropic-ai/sdk     Claude API 集成
```

**Tauri 插件**:
- @tauri-apps/plugin-shell：shell 命令执行
- @tauri-apps/plugin-dialog：文件对话框
- @tauri-apps/plugin-global-shortcut：全局快捷键
- @tauri-apps/plugin-opener：打开系统应用

### 2.3 整体架构
```
┌──────────────────────────┐
│   React 前端 UI 层        │
│  • 组件库 (50+ 个)       │
│  • 路由与视图管理         │
│  • i18n 国际化            │
└────────────┬─────────────┘
             │ IPC 通信
┌────────────▼─────────────┐
│   Tauri 桥接层            │
│  • 类型安全的 RPC         │
│  • 事件系统               │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│   Rust 后端               │
│  • Claude CLI 管理        │
│  • 进程控制               │
│  • Windows 系统调用       │
└──────────────────────────┘
```

---

## 三、目录结构与职责

### 3.1 核心目录
```
src/
├── components/              # 50+ React 组件库
│   ├── ui/                 # Radix UI 组件封装 (15+ 基础组件)
│   ├── FloatingPromptInput/ # 浮动输入框 (复杂子模块)
│   ├── message/            # 消息显示组件
│   ├── *Manager.tsx        # 各类管理组件
│   └── ...                 # 业务组件
│
├── lib/                    # 核心业务逻辑库
│   ├── api.ts             # Claude API 与 IPC 通信接口
│   ├── claudeSDK.ts       # Claude SDK 包装
│   ├── hooksManager.ts    # Claude Code Hooks 配置管理 [核心]
│   ├── hooksConverter.ts  # Hooks 格式转换 [核心]
│   ├── tokenCounter.ts    # Token 计数逻辑
│   ├── errorHandling.ts   # 统一错误处理
│   └── ...                # 其他工具函数
│
├── types/                 # TypeScript 类型定义
│   ├── hooks.ts          # Claude Code Hooks 类型定义 [核心]
│   └── subagents.ts      # 子代理类型
│
├── hooks/                 # React Hooks 库
│   ├── useSessionSync.ts # 会话同步逻辑
│   ├── useTabs.tsx       # 标签页管理状态
│   ├── useTranslation.ts # i18n Hook
│   └── ...
│
├── contexts/              # React Context
│   └── ThemeContext.tsx   # 主题切换管理
│
├── i18n/                  # 国际化配置
│   └── index.ts          # i18next 初始化
│
├── assets/                # 静态资源
│   ├── shimmer.css       # 加载动画
│   └── nfo/              # NFO 音频文件
│
├── styles/                # 全局样式
│   ├── tabs.css
│   └── styles.css
│
├── App.tsx               # 主应用组件 [关键]
└── main.tsx              # React 挂载点

src-tauri/               # Rust 后端
├── src/main.rs         # Tauri 主程序
└── Cargo.toml          # Rust 依赖
```

### 3.2 关键模块职责

**App.tsx - 主应用控制器**
- 多视图状态管理（welcome/projects/editor/settings/mcp 等）
- 导航历史跟踪与智能返回
- 项目/会话生命周期管理
- 流式状态与 Claude 交互状态

**lib/hooksManager.ts - Hooks 管理核心**
- 合并三级别 Hooks 配置（user/project/local）
- 正则匹配器处理与优先级解决
- 命令安全性检查（危险模式识别）
- Hook 验证与错误报告

**lib/hooksConverter.ts - Hooks 格式转换**
- 旧格式 → 新 Matcher 格式转换
- 版本兼容性处理
- 配置序列化/反序列化

**components/EnhancedHooksManager.tsx - Hooks UI 编辑器**
- 交互式 Hooks 配置界面
- 实时验证与错误提示
- Hook 模板快速应用
- 命令预览与调试

---

## 四、开发命令清单

### 4.1 常用命令
```bash
# 前端开发
npm run dev              # 启动 Vite 开发服务器 (http://localhost:1420)

# Tauri 开发
npm run tauri:dev       # 启动 Tauri 应用 (含热重载)
npm run tauri:build-fast # 快速构建 dev-release 版本
npm run tauri:build     # 生产构建

# 构建
npm run build           # TypeScript + Vite 完整构建
npm run preview         # 预览打包结果

# 其他
npm run tauri           # 直接调用 Tauri CLI
```

### 4.2 项目脚本配置 (package.json)
```json
{
  "type": "module",        // ES Module 模式
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:build": "tauri build",
    "tauri:build-fast": "tauri build --profile dev-release",
    "tauri:dev": "tauri dev"
  }
}
```

---

## 五、关键架构要点

### 5.1 视图路由系统
```typescript
type View =
  | "welcome"                  // 欢迎页
  | "projects"               // 项目列表
  | "claude-code-session"    // Claude 互动窗口
  | "claude-tab-manager"     // 多标签管理
  | "editor"                 // CLAUDE.md 编辑器
  | "settings"               // 应用设置
  | "mcp"                    // MCP 服务器管理
  | "usage-dashboard"        // 使用统计
  | "project-settings"       // 项目 Hooks 配置
  | "enhanced-hooks-manager" // Hooks 详细编辑器
  | "claude-file-editor"    // CLAUDE.md 文件编辑
```

### 5.2 状态管理架构
```
App 组件
├── 全局状态
│   ├── view (当前视图)
│   ├── projects[] (项目列表)
│   ├── selectedProject (选中项目)
│   ├── navigationHistory[] (导航历史)
│   ├── isClaudeStreaming (流式状态)
│   └── ...其他 UI 状态
│
├── Context API
│   ├── ThemeContext (主题：亮/暗)
│   └── TabProvider (标签页管理)
│
└── LocalStorage
    └── Claude CLI 配置、会话历史

自定义 Hooks
├── useTabs (标签页状态)
├── useSessionSync (会话同步)
└── useTranslation (i18n)
```

### 5.3 Hooks 配置三级别系统
```
优先级: local > project > user

user:    ~/.claude/CLAUDE.md (全局配置)
project: ./CLAUDE.md (项目配置)
local:   ./.claude.md (本地临时配置)

合并规则:
- 按事件类型合并
- 相同 matcher 后者覆盖前者
- 最终保留所有非重复 matcher
```

### 5.4 Hook 事件类型
```typescript
PreToolUse       // 工具执行前
PostToolUse      // 工具执行后
Notification     // 通知事件
UserPromptSubmit // 用户输入提交
Stop             // 会话停止
SubagentStop     // 子代理停止
PreCompact       // 压缩前
SessionStart     // 会话开始
SessionEnd       // 会话结束
```

---

## 六、开发工作流

### 6.1 启动开发环境
```bash
# 终端 1: 运行 Tauri 应用
npm run tauri:dev

# 应用会自动:
# 1. 启动 Vite 开发服务器 (端口 1420)
# 2. 编译 Rust 代码
# 3. 打开桌面应用窗口
# 4. 启用热模块重载 (HMR)
```

### 6.2 代码修改后自动重载
- **前端文件** (src/*.tsx): Vite HMR 自动刷新
- **Rust 代码** (src-tauri/src/*.rs): 自动重新编译
- **Tauri 配置**: 需要重启应用

### 6.3 构建与部署
```bash
# 完整生产构建
npm run build && npm run tauri:build

# 生成的文件:
# - dist/                        (前端静态资源)
# - src-tauri/target/release/   (Rust 二进制)
# - MSI 安装包
# - NSIS 安装包
```

---

## 七、重要的修改文件说明

### 7.1 最近修改的核心文件 (git status)
```
M src/components/HooksEditor.tsx     # Hooks 编辑器 UI 组件
M src/lib/hooksConverter.ts          # Hooks 格式转换逻辑
M src/lib/hooksManager.ts            # Hooks 配置管理核心
M src/types/hooks.ts                 # Hooks 类型定义
D CLAUDE.md                          # 项目配置文档 (被删除，待重建)
```

### 7.2 Hooks 系统核心改动说明

**hooksManager.ts**:
- `mergeConfigs()`: 三级别配置合并 (user/project/local)
- `mergeMatchers()`: Matcher 数组合并与去重
- `validateConfig()`: 配置验证 + 危险命令检测
- `checkDangerousPatterns()`: 安全性检查

**hooksConverter.ts**:
- 新旧格式兼容性转换
- Matcher 格式标准化

**types/hooks.ts**:
- `HookCommand`: 单个命令定义
- `HookMatcher`: 匹配器与命令集合
- `HooksConfiguration`: 完整配置接口
- `COMMON_TOOL_MATCHERS[]`: 常用工具匹配器列表
- `HOOK_TEMPLATES[]`: 预定义模板库

---

## 八、编码规范与最佳实践

### 8.1 TypeScript 配置
```
严格模式启用:
- strict: true
- noUnusedLocals: true
- noUnusedParameters: true
- noFallthroughCasesInSwitch: true

路径别名:
- @/* => src/*
```

### 8.2 组件编写规范
```typescript
// 使用函数组件 + React Hooks
export function ComponentName({ prop1, prop2 }: Props) {
  const [state, setState] = useState<Type>(initial);

  useEffect(() => {
    // 副作用
  }, [dependencies]);

  return <div>Content</div>;
}

// 类型定义位置
interface Props {
  prop1: string;
  prop2?: number;
}
```

### 8.3 Hooks 使用规范
```typescript
// 遵循 Hooks 规则:
1. 仅在 React 函数组件或自定义 Hook 内调用
2. 在函数顶部调用，不在循环/条件/嵌套函数中调用
3. useCallback/useMemo 的依赖项要完整
4. Hook 依赖列表不可省略
```

### 8.4 样式规范
```
使用 Tailwind CSS:
- 优先使用实用类
- @apply 用于复杂组件样式
- CSS-in-JS 用于动态样式
- 颜色变量: bg-foreground, text-muted-foreground, etc.
```

### 8.5 Hooks 配置最佳实践
```bash
# 危险命令会被检测:
✗ rm -rf /        # 根目录删除
✗ rm -rf ~        # 主目录删除
✗ curl | bash     # 远程代码执行
✗ sudo            # 提权命令
✗ fork bomb       # :(){ :|:& };:

# 推荐的安全模式:
✓ 使用 jq 提取值: $(jq -r .field)
✓ 引用变量: "$variable" (带双引号)
✓ 指定精确路径: /specific/path 而非 /
✓ 使用 echo 检查: echo "验证输出"
```

---

## 九、调试与问题排查

### 9.1 常见问题

**Q: Tauri 开发时窗口不显示**
```
A: main.tsx 中有意为之的 100ms 延迟，确保 React 挂载完成后再显示窗口
```

**Q: HMR 热更新不工作**
```
A: 检查环境变量 TAURI_DEV_HOST，vite.config.ts 已配置 WebSocket 代理
```

**Q: 构建失败 - Rust 编译错误**
```
A: 运行: npm run tauri:build-fast (使用开发发布配置快速编译)
```

**Q: Hooks 配置不生效**
```
A: 1. 检查文件位置 (CLAUDE.md, .claude.md)
   2. 验证 JSON 格式有效性
   3. 查看 hooksManager.validateConfig() 的错误信息
   4. 确认 Matcher 正则表达式正确
```

### 9.2 开发调试技巧
```typescript
// 在 Rust 端输出日志
println!("Debug: {:?}", value);

// 在前端输出 Hooks 配置
console.log('Hooks Config:', hooks);

// 验证 Hooks 配置
const result = HooksManager.validateConfig(config);
console.log('Validation:', result.errors, result.warnings);
```

---

## 十、扩展开发指南

### 10.1 新增 Hook 事件类型
```typescript
// 1. 修改 src/types/hooks.ts
export interface HooksConfiguration {
  NewEvent?: HookMatcher[];  // 新增事件
}

// 2. 更新 hooksManager.ts 的 allEvents 数组
const allEvents: (keyof HooksConfiguration)[] = [
  'PreToolUse',
  'NewEvent',  // 新增
  ...
];

// 3. 在 Hook 触发器中调用
await HooksManager.triggerHooks('NewEvent', data);
```

### 10.2 新增 Hook 模板
```typescript
// src/types/hooks.ts - HOOK_TEMPLATES 数组
{
  id: 'new-template',
  name: 'Template Name',
  description: 'Description',
  event: 'PreToolUse',
  matcher: 'Tool.*',
  commands: ['command 1', 'command 2']
}
```

### 10.3 新增 UI 组件
```typescript
// src/components/NewComponent.tsx
import { FC } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  onBack: () => void;
}

export const NewComponent: FC<Props> = ({ onBack }) => {
  return <div>Content</div>;
};
```

---

## 十一、依赖版本说明

### 核心依赖版本锁定
```
React:           18.3.1  (LTS 版本)
TypeScript:      5.9.2
Tauri:           2.1.1
Vite:            6.0.3   (最新稳定版)
Tailwind CSS:    4.1.8
Node.js 需求:    18.0+
```

### 重要插件
```
@anthropic-ai/sdk:      0.63.1  (Claude API)
@tauri-apps/cli:        2       (Tauri 工具链)
@hookform/resolvers:    3.9.1   (表单验证)
```

---

## 十二、相关文档链接

- [Claude Code Hooks 官方文档](https://docs.claude.com/en/docs/claude-code/hooks)
- [Tauri 文档](https://tauri.app/)
- [React 18 文档](https://react.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [Vite 文档](https://vitejs.dev/)

---

## 十三、项目维护信息

**主要功能领域**:
1. 项目与会话管理
2. Claude API 交互与流式处理
3. Claude Code Hooks 系统
4. MCP 服务器管理
5. 国际化与主题支持

**核心代码维护者需要关注**:
- src/lib/hooksManager.ts (Hooks 业务逻辑)
- src/types/hooks.ts (类型定义)
- src/components/EnhancedHooksManager.tsx (UI 层)
- src/App.tsx (路由与状态)

**最近修改记录**:
```
2025-10-17: 删除 CC Agent 功能，重新索引 hooksManager.ts
2025-10-15: 修复 Rust 编译警告
2025-10-14: 代码更新
```

---

**文档版本**: 1.0.0 (2025-10-17)
**最后更新**: 2025-10-17
**维护状态**: 主动维护中
