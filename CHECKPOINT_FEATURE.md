# 检查点功能使用说明

## 功能概述

检查点功能已成功集成到 claude-workbench 项目中，允许你在会话过程中创建、恢复和管理代码状态的快照。

## 功能特性

### 1. 创建检查点
- 在任意时刻保存当前会话状态
- 可添加描述信息，方便识别
- 自动记录代码变更和 token 使用情况

### 2. 时间线可视化
- 树形结构展示所有检查点
- 清晰显示检查点之间的关系
- 展示每个检查点的元数据（时间、描述、文件变更等）

### 3. 恢复检查点
- 一键恢复到任意历史检查点
- 恢复前自动保存当前状态
- 安全的状态回滚机制

### 4. 检查点对比
- 查看两个检查点之间的差异
- 显示文件增删改统计
- Token 使用量变化追踪

### 5. 分叉功能
- 从任意检查点创建新的会话分支
- 支持多个并行开发路径
- 独立管理不同的代码版本

## 使用方法

### 在消息页面访问

1. **打开检查点面板**
   - 在会话页面顶部，点击"显示检查点"按钮
   - 按钮图标：🌿 (GitBranch)

2. **创建新检查点**
   - 在时间线面板中，点击"创建检查点"按钮
   - 输入可选的描述信息
   - 点击"创建检查点"确认

3. **管理检查点**
   - **恢复**: 点击检查点卡片上的 ↺ (RotateCcw) 图标
   - **分叉**: 点击检查点卡片上的 ⑂ (GitFork) 图标
   - **对比**: 点击检查点卡片上的 ⚏ (Diff) 图标

## 文件结构

### 新增文件

```
src/
├── lib/
│   └── api.ts                          # 添加了检查点相关类型和 API 方法
├── hooks/
│   └── useCheckpoints.ts               # 检查点管理 Hook
└── components/
    ├── TimelineNavigator.tsx           # 时间线导航器组件
    └── ClaudeCodeSession.tsx           # 已集成检查点功能
```

### API 方法

在 `src/lib/api.ts` 中添加的方法：

```typescript
// 创建检查点
createCheckpoint(sessionId, projectId, projectPath, messageIndex?, description?)

// 恢复检查点
restoreCheckpoint(checkpointId, sessionId, projectId, projectPath)

// 列出检查点
listCheckpoints(sessionId, projectId, projectPath)

// 获取会话时间线
getSessionTimeline(sessionId, projectId, projectPath)

// 获取检查点差异
getCheckpointDiff(fromCheckpointId, toCheckpointId, sessionId, projectId)

// 从检查点分叉
forkFromCheckpoint(checkpointId, sessionId, projectId, projectPath, newSessionId, description?)

// 更新检查点设置
updateCheckpointSettings(sessionId, projectId, projectPath, autoCheckpointEnabled, checkpointStrategy)

// 清理旧检查点
cleanupOldCheckpoints(sessionId, projectId, projectPath, keepCount)
```

### 类型定义

```typescript
// 检查点
interface Checkpoint {
  id: string;
  sessionId: string;
  projectId: string;
  messageIndex: number;
  timestamp: string;
  description?: string;
  parentCheckpointId?: string;
  metadata: CheckpointMetadata;
}

// 检查点元数据
interface CheckpointMetadata {
  totalTokens: number;
  modelUsed: string;
  userPrompt: string;
  fileChanges: number;
  snapshotSize: number;
}

// 会话时间线
interface SessionTimeline {
  sessionId: string;
  rootNode?: TimelineNode;
  currentCheckpointId?: string;
  autoCheckpointEnabled: boolean;
  checkpointStrategy: CheckpointStrategy;
  totalCheckpoints: number;
}

// 检查点策略
type CheckpointStrategy = 'manual' | 'per_prompt' | 'per_tool_use' | 'smart';
```

## UI 界面

### 检查点按钮
- 位置：会话页面顶部工具栏
- 文本：显示检查点 / 隐藏检查点
- 图标：🌿 GitBranch

### 时间线面板
- 树形结构展示
- 每个检查点卡片包含：
  - 检查点 ID（前8位）
  - 创建时间
  - 描述信息
  - Token 使用量
  - 文件变更数量
  - 操作按钮（恢复、分叉、对比）

### 对话框
- **创建检查点对话框**: 输入描述信息
- **时间线对话框**: 查看和管理所有检查点
- **对比对话框**: 显示两个检查点之间的差异

## 注意事项

⚠️ **实验性功能警告**

检查点功能是实验性的，使用时请注意：

1. 检查点可能会影响目录结构
2. 建议在重要操作前创建检查点
3. 定期清理不需要的旧检查点
4. 大型项目的检查点可能占用较多存储空间

## 未来计划

- [ ] 自动检查点功能（基于策略）
- [ ] 检查点搜索和过滤
- [ ] 检查点标签系统
- [ ] 导出/导入检查点
- [ ] 检查点压缩和优化

## 技术支持

如有问题或建议，请在项目 Issues 中反馈。
