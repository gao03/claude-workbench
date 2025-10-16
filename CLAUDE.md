# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**Claude Workbench** 是一个专业的 Claude CLI 桌面管理工具，使用 **React 18 + Tauri 2** 构建，主要面向 Windows 平台。这是一个功能完整的桌面应用，提供可视化的 Claude 项目与会话管理、实时流式响应展示、MCP 服务器管理，以及核心创新特性 **Claude Code Hooks 配置管理**。

### 技术栈核心

- **前端**: React 18.3.1 + TypeScript 5.9.2 + Tailwind CSS 4.1.8 + Vite 6.0.3
- **后端**: Tauri 2.1.1 + Rust (高性能系统调用)
- **UI 组件库**: Radix UI (多个组件) + Framer Motion 12.0
- **国际化**: i18next 25.3.2 (中文优先)
- **数据持久化**: SQLite (通过 Rust rusqlite)

---

## 开发命令

### 前端开发
```bash
npm run dev              # 启动 Vite 开发服务器 (端口 1420)
npm run build            # TypeScript 编译 + Vite 打包
npm run preview          # 预览生产构建
```

### Tauri 应用开发
```bash
npm run tauri:dev        # 启动 Tauri 开发模式 (热重载)
npm run tauri:build-fast # 快速构建 dev-release 版本 (开发测试用)
npm run tauri:build      # 完整生产构建 (生成 MSI/NSIS 安装包)
```

**注意**: `npm run tauri:dev` 会自动启动 Vite 并打开桌面窗口，支持 HMR 热模块替换。

---

## 核心架构模式

### 1. 三层架构设计

```
React 前端 UI 层 (src/)
    ↕ IPC 通信 (Tauri API)
Tauri 桥接层 (invoke/emit)
    ↕ 类型安全 RPC
Rust 后端层 (src-tauri/src/)
    - Claude CLI 进程管理
    - Windows API 系统调用
    - SQLite 数据库操作
```

### 2. 状态管理架构

**App.tsx** 作为主控制器，采用 React Hooks + Context API 混合模式:

- **全局状态**: `useState` 管理视图导航、项目列表、流式状态
- **Context**: `ThemeContext` (主题切换), `TabProvider` (多标签管理)
- **导航历史栈**: `navigationHistory[]` 实现智能返回功能
- **LocalStorage**: Claude CLI 配置、会话历史持久化

**关键状态变量** (`App.tsx`):
```typescript
view: View                    // 当前视图 (10+ 种路由视图)
projects: Project[]           // 项目列表
selectedProject: Project      // 选中项目
isClaudeStreaming: boolean    // 流式响应状态
navigationHistory: View[]     // 导航历史栈
```

### 3. Claude Code Hooks 系统 (核心创新)

**三级别配置合并机制** (`src/lib/hooksManager.ts:17-61`):
```
优先级: local > project > user

user:    ~/.claude/CLAUDE.md           (全局配置)
project: ./CLAUDE.md                   (项目配置)
local:   ./.claude.md                  (本地临时配置)
```

**Matcher 匹配器格式** (所有 Hook 事件统一使用):
```typescript
{
  matcher?: string,        // 正则表达式匹配工具名 (如 "Bash", "Edit|Write", "*")
  hooks: HookCommand[]     // 要执行的命令数组
}
```

**支持的 Hook 事件类型** (`src/types/hooks.ts:18-32`):
- `PreToolUse` / `PostToolUse`: 工具执行前后
- `Notification`: 通知事件
- `UserPromptSubmit`: 用户提交输入
- `Stop` / `SubagentStop`: 会话/子代理停止
- `PreCompact`: 上下文压缩前
- `SessionStart` / `SessionEnd`: 会话生命周期

**安全性检查** (`src/lib/hooksManager.ts:164-197`):
- 自动检测危险命令模式 (如 `rm -rf /`, fork bomb, sudo 提权)
- 验证正则表达式语法
- 检测未引用的 Shell 变量 (代码注入风险)

### 4. IPC 通信模式

**前端调用 Rust** (`src/lib/api.ts`):
```typescript
// 所有后端调用通过 Tauri invoke
import { invoke } from "@tauri-apps/api/core";

export const api = {
  async listProjects(): Promise<Project[]> {
    return await invoke<Project[]>("list_projects");
  },
  // ... 100+ API 方法
}
```

**Rust 命令注册** (`src-tauri/src/main.rs:113-246`):
```rust
tauri::Builder::default()
  .invoke_handler(tauri::generate_handler![
    list_projects,
    get_hooks_config,
    execute_claude_code,
    // ... 所有暴露的命令
  ])
```

### 5. 视图路由系统

**View 类型定义** (`src/App.tsx:28-39`):
```typescript
type View =
  | "welcome"                  // 欢迎页
  | "projects"                 // 项目列表
  | "claude-code-session"      // Claude 互动窗口
  | "claude-tab-manager"       // 多标签管理
  | "editor"                   // CLAUDE.md 编辑器
  | "settings"                 // 应用设置
  | "mcp"                      // MCP 服务器管理
  | "usage-dashboard"          // 使用统计
  | "project-settings"         // 项目 Hooks 配置
  | "enhanced-hooks-manager"   // Hooks 详细编辑器
  | "claude-file-editor"       // CLAUDE.md 文件编辑
```

**导航保护机制** (`src/App.tsx:198-218`):
- 检测活跃的 Claude 流式会话
- 显示确认对话框防止意外中断
- 维护导航历史栈实现智能返回

---

## 关键文件与职责

### 前端核心模块

#### `src/App.tsx` (722 行)
- **职责**: 主应用控制器、视图路由管理、全局状态
- **关键函数**:
  - `handleViewChange()`: 视图切换 + 导航保护
  - `handleSmartBack()`: 智能返回 (基于历史栈)
  - `renderContent()`: 视图渲染分发器
  - `loadProjects()`: 项目列表加载
- **状态管理**: 10+ 种 `useState` + 导航历史栈

#### `src/lib/hooksManager.ts` (217 行)
- **职责**: Claude Code Hooks 配置管理核心
- **关键方法**:
  - `mergeConfigs()`: 三级别配置合并 (user/project/local)
  - `mergeMatchers()`: Matcher 数组合并与去重
  - `validateConfig()`: 配置验证 + 危险命令检测
  - `checkDangerousPatterns()`: 安全性模式匹配
- **安全特性**: 检测 10+ 种危险 Shell 命令模式

#### `src/lib/api.ts` (2148 行)
- **职责**: Tauri IPC 通信接口封装
- **包含**: 100+ 个 `async invoke()` 方法
- **模块分类**:
  - 项目与会话管理 (20+ 方法)
  - Claude CLI 执行 (流式输出处理)
  - MCP 服务器管理 (10+ 方法)
  - Hooks 配置 CRUD (5 方法)
  - 使用统计与分析 (15+ 方法)
  - Provider 代理商管理 (8 方法)
  - 翻译服务 (7 方法)
  - 自动压缩管理 (12+ 方法)

#### `src/types/hooks.ts` (136 行)
- **职责**: Claude Code Hooks 类型定义
- **核心类型**:
  - `HooksConfiguration`: 完整 Hooks 配置接口
  - `HookMatcher`: 匹配器 + 命令集合
  - `HookCommand`: 单个命令定义
  - `COMMON_TOOL_MATCHERS`: 常用工具匹配器列表 (15+ 个)
  - `HOOK_TEMPLATES`: 预定义模板库 (5 个模板)

#### `src/lib/hooksConverter.ts`
- **职责**: Hooks 格式转换 (旧格式 → 新 Matcher 格式)
- **用途**: 版本兼容性处理、配置序列化/反序列化

#### `src/components/EnhancedHooksManager.tsx`
- **职责**: Hooks 配置交互式编辑器 UI
- **功能**:
  - 实时验证与错误提示
  - Hook 模板快速应用
  - 命令预览与调试
  - 三级别配置切换 (user/project/local)

### 后端核心模块

#### `src-tauri/src/main.rs` (249 行)
- **职责**: Tauri 应用入口、插件注册、命令注册
- **初始化**:
  - SQLite 数据库 (`init_database`)
  - 进程注册表 (`ProcessRegistryState`)
  - Claude 进程状态 (`ClaudeProcessState`)
  - 自动压缩管理器 (`AutoCompactManager`)
  - 翻译服务 (后台初始化)
- **命令分类**: 100+ 个 Rust 命令通过 `invoke_handler` 暴露

#### `src-tauri/src/commands/` 模块
- `claude.rs`: Claude CLI 进程管理、会话执行
- `mcp.rs`: MCP 服务器管理
- `storage.rs`: SQLite 数据库操作
- `usage.rs`: 使用统计分析
- `provider.rs`: 代理商配置管理
- `translator.rs`: 翻译服务 (AI 翻译接口)
- `context_manager.rs`: 自动上下文压缩
- `enhanced_hooks.rs`: Hooks 事件触发与执行

#### `src-tauri/Cargo.toml` (81 行)
- **依赖管理**: 40+ Rust crates
- **构建配置**:
  - `[profile.dev-release]`: 快速开发构建 (opt-level=2, thin LTO)
  - `[profile.release]`: 生产优化 (opt-level="z", full LTO, strip=true)

---

## TypeScript 配置要点

**`tsconfig.json`**:
```json
{
  "compilerOptions": {
    "strict": true,              // 严格模式启用
    "noUnusedLocals": true,      // 禁止未使用变量
    "noUnusedParameters": true,  // 禁止未使用参数
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }  // 路径别名
  }
}
```

**`vite.config.ts` 关键配置**:
```typescript
{
  server: {
    port: 1420,          // Tauri 固定端口
    strictPort: true,    // 端口被占用则失败
    hmr: { port: 1421 }  // WebSocket 热更新端口
  },
  build: {
    chunkSizeWarningLimit: 2000,  // 2MB 块大小限制
    manualChunks: {
      'react-vendor': ['react', 'react-dom'],
      'ui-vendor': [...],  // Radix UI 组件分块
      'tauri': [...],      // Tauri 插件分块
    }
  }
}
```

---

## 构建与打包流程

### 开发构建 (快速迭代)
```bash
npm run tauri:build-fast
```
- 使用 `dev-release` profile (Cargo.toml:54-60)
- 优化级别 `opt-level=2` (平衡速度与性能)
- Thin LTO + 增量编译启用
- 保留 debug 信息

### 生产构建 (最小体积)
```bash
npm run tauri:build
```
- 使用 `release` profile (Cargo.toml:63-72)
- 优化级别 `opt-level="z"` (最小体积)
- Full LTO + Strip symbols
- 生成 Windows 安装包: MSI + NSIS

### 构建输出
```
dist/                     # Vite 前端打包结果
src-tauri/target/release/ # Rust 二进制文件
*.msi                     # Windows MSI 安装包
*.exe                     # NSIS 安装包
```

---

## 关键开发注意事项

### 1. Hooks 配置最佳实践

**危险命令会被自动检测**:
```bash
✗ rm -rf /          # 根目录删除
✗ curl | bash       # 远程代码执行
✗ sudo              # 提权命令
✗ :(){ :|:& };:     # Fork bomb
```

**推荐的安全模式**:
```bash
✓ jq -r '.field' < input.json     # JSON 提取
✓ "$variable"                     # 引用变量 (防注入)
✓ /specific/path                  # 精确路径
✓ echo "验证输出"                  # 调试输出
```

### 2. 状态管理规范

**遵循 React Hooks 规则**:
- 仅在函数组件或自定义 Hook 内调用
- 在函数顶部调用，不在循环/条件/嵌套函数中
- `useCallback`/`useMemo` 的依赖项要完整
- Hook 依赖列表不可省略

**组件编写模式**:
```typescript
export function ComponentName({ prop1, prop2 }: Props) {
  const [state, setState] = useState<Type>(initial);

  useEffect(() => {
    // 副作用逻辑
  }, [dependencies]);

  return <div>Content</div>;
}
```

### 3. 样式规范

**优先使用 Tailwind CSS 实用类**:
```tsx
<div className="flex items-center justify-center p-8 bg-gradient-to-br">
  {/* 内容 */}
</div>
```

**颜色变量约定**:
- `bg-foreground`, `text-muted-foreground`
- `bg-accent`, `text-accent-foreground`
- `border-destructive`, `bg-destructive/10`

### 4. IPC 调用模式

**前端调用后端**:
```typescript
// 正确: 使用 api.ts 封装
const projects = await api.listProjects();

// 错误: 直接调用 invoke (难以维护)
const projects = await invoke("list_projects");
```

**错误处理**:
```typescript
try {
  const result = await api.someMethod();
} catch (error) {
  console.error("Failed to ...", error);
  setToast({ message: "操作失败", type: "error" });
}
```

### 5. 路径处理约定

**Windows 路径兼容性**:
```typescript
// Rust 侧使用 std::path::Path/PathBuf
// 前端使用反斜杠 \\ 或正斜杠 / (Tauri 自动转换)

// 示例:
const projectPath = "C:\\Users\\Admin\\Projects\\my-app";
const projectPath = "C:/Users/Admin/Projects/my-app"; // 也可接受
```

---

## 常见问题排查

### Q: Tauri 开发时窗口不显示
**A**: `main.tsx` 有意设置 100ms 延迟，确保 React 挂载完成后再显示窗口。检查 `tauri.conf.json` 中 `visible: false` 配置。

### Q: HMR 热更新不工作
**A**: 检查环境变量 `TAURI_DEV_HOST`，确认 `vite.config.ts` 中 WebSocket 代理配置正确 (端口 1421)。

### Q: Rust 编译失败
**A**:
1. 运行 `npm run tauri:build-fast` (使用开发配置快速编译)
2. 检查 Rust 版本: `rustc --version` (推荐 1.70+)
3. 清理缓存: `cd src-tauri && cargo clean`

### Q: Hooks 配置不生效
**A**:
1. 检查文件位置 (CLAUDE.md, .claude.md)
2. 验证 JSON 格式有效性
3. 查看 `hooksManager.validateConfig()` 的错误信息
4. 确认 Matcher 正则表达式正确

### Q: 前端构建包过大
**A**: Vite 已配置 `manualChunks` 代码分割 (vite.config.ts:54-63)，检查是否误引入大型依赖。

---

## 扩展开发指南

### 新增 Hook 事件类型

1. **修改类型定义** (`src/types/hooks.ts`):
```typescript
export interface HooksConfiguration {
  NewEvent?: HookMatcher[];  // 新增事件
}
```

2. **更新 HooksManager** (`src/lib/hooksManager.ts:27-37`):
```typescript
const allEvents: (keyof HooksConfiguration)[] = [
  'PreToolUse',
  'NewEvent',  // 新增
  // ...
];
```

3. **在 Hooks 触发器中调用**:
```typescript
await HooksManager.triggerHooks('NewEvent', contextData);
```

### 新增 UI 组件

**组件位置**: `src/components/NewComponent.tsx`
```typescript
import { FC } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  onBack: () => void;
}

export const NewComponent: FC<Props> = ({ onBack }) => {
  return (
    <div className="p-6">
      {/* 组件内容 */}
    </div>
  );
};
```

### 新增 Tauri 命令

1. **Rust 侧** (`src-tauri/src/commands/module.rs`):
```rust
#[tauri::command]
pub async fn my_new_command(param: String) -> Result<String, String> {
    // 实现逻辑
    Ok("Success".to_string())
}
```

2. **注册命令** (`src-tauri/src/main.rs`):
```rust
.invoke_handler(tauri::generate_handler![
    my_new_command,  // 新增
    // ...
])
```

3. **前端调用** (`src/lib/api.ts`):
```typescript
async myNewCommand(param: string): Promise<string> {
  return await invoke<string>("my_new_command", { param });
}
```

---

## 许可证与贡献

- **许可证**: AGPL-3.0
- **贡献指南**: 遵循现有代码风格、添加适当的类型注解、保持函数职责单一
- **提交规范**: 使用清晰的中英文混合提交信息

---

**文档版本**: 1.0.0
**最后更新**: 2025-10-17
**维护状态**: 主动维护中
