/**
 * 工具注册初始化模块
 *
 * 将所有工具 Widget 组件注册到 toolRegistry
 * 在应用启动时调用 initializeToolRegistry() 完成注册
 */

import { toolRegistry, ToolRenderer, ToolRenderProps } from './toolRegistry';
import {
  TodoWidget,
  LSWidget,
  ReadWidget,
  EditWidget,
  MultiEditWidget,
  BashWidget,
  GrepWidget,
  GlobWidget,
  WriteWidget,
  WebSearchWidget,
  WebFetchWidget,
  BashOutputWidget,
  MCPWidget,
} from '@/components/ToolWidgets';

/**
 * 工具适配器工厂
 * 将旧的 Widget 组件适配到新的 ToolRenderProps 接口
 */
function createToolAdapter<T extends Record<string, any>>(
  WidgetComponent: React.FC<T>,
  propsMapper: (renderProps: ToolRenderProps) => T
): React.FC<ToolRenderProps> {
  return (renderProps: ToolRenderProps) => {
    const widgetProps = propsMapper(renderProps);
    return <WidgetComponent {...widgetProps} />;
  };
}

/**
 * 注册所有内置工具
 */
export function initializeToolRegistry(): void {
  const tools: ToolRenderer[] = [
    // TodoWrite / TodoRead
    {
      name: 'todowrite',
      render: createToolAdapter(TodoWidget, (props) => ({
        todos: props.input?.todos || [],
        result: props.result,
      })),
      description: 'Todo 列表管理工具',
    },
    {
      name: 'todoread',
      render: createToolAdapter(TodoWidget, (props) => ({
        todos: props.input?.todos || props.result?.content || [],
        result: props.result,
      })),
      description: 'Todo 列表读取工具',
    },

    // LS - 列出目录
    {
      name: 'ls',
      render: createToolAdapter(LSWidget, (props) => ({
        path: props.input?.path || '.',
        result: props.result,
      })),
      description: '目录列表工具',
    },

    // Read - 读取文件
    {
      name: 'read',
      render: createToolAdapter(ReadWidget, (props) => ({
        filePath: props.input?.file_path || props.input?.path || '',
        result: props.result,
      })),
      description: '文件读取工具',
    },

    // Edit - 编辑文件
    {
      name: 'edit',
      render: createToolAdapter(EditWidget, (props) => ({
        file_path: props.input?.file_path || '',
        old_string: props.input?.old_string || '',
        new_string: props.input?.new_string || '',
        result: props.result,
      })),
      description: '文件编辑工具（搜索替换）',
    },

    // MultiEdit - 批量编辑
    {
      name: 'multiedit',
      render: createToolAdapter(MultiEditWidget, (props) => ({
        file_path: props.input?.file_path || '',
        edits: props.input?.edits || [],
        result: props.result,
      })),
      description: '批量文件编辑工具',
    },

    // Bash - 执行命令
    {
      name: 'bash',
      render: createToolAdapter(BashWidget, (props) => ({
        command: props.input?.command || '',
        description: props.input?.description,
        result: props.result,
      })),
      description: 'Bash 命令执行工具',
    },

    // Grep - 搜索内容
    {
      name: 'grep',
      render: createToolAdapter(GrepWidget, (props) => ({
        pattern: props.input?.pattern || '',
        path: props.input?.path,
        include: props.input?.include,
        exclude: props.input?.exclude,
        result: props.result,
      })),
      description: '代码搜索工具',
    },

    // Glob - 查找文件
    {
      name: 'glob',
      render: createToolAdapter(GlobWidget, (props) => ({
        pattern: props.input?.pattern || '',
        path: props.input?.path,
        result: props.result,
      })),
      description: '文件匹配查找工具',
    },

    // Write - 写入文件
    {
      name: 'write',
      render: createToolAdapter(WriteWidget, (props) => ({
        filePath: props.input?.file_path || '',
        content: props.input?.content || '',
        result: props.result,
      })),
      description: '文件写入工具',
    },

    // WebSearch - 网络搜索
    {
      name: 'websearch',
      render: createToolAdapter(WebSearchWidget, (props) => ({
        query: props.input?.query || '',
        result: props.result,
      })),
      description: '网络搜索工具',
    },

    // WebFetch - 获取网页
    {
      name: 'webfetch',
      render: createToolAdapter(WebFetchWidget, (props) => ({
        url: props.input?.url || '',
        prompt: props.input?.prompt,
        result: props.result,
      })),
      description: '网页获取工具',
    },

    // BashOutput - 后台命令输出
    {
      name: 'bashoutput',
      render: createToolAdapter(BashOutputWidget, (props) => ({
        bash_id: props.input?.bash_id || '',
        result: props.result,
      })),
      description: '后台命令输出查看工具',
    },

    // MCP 工具（正则匹配）
    {
      name: 'mcp',
      pattern: /^mcp__/,
      priority: 10,
      render: createToolAdapter(MCPWidget, (props) => ({
        toolName: props.toolName,
        input: props.input,
        result: props.result,
      })),
      description: 'Model Context Protocol 工具（通用）',
    },

    // Task - 子代理工具（Claude Code 特有）
    {
      name: 'task',
      render: createToolAdapter(
        ({ input, result }: any) => (
          <div className="task-widget p-3 bg-purple-500/10 border border-purple-500/20 rounded">
            <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">
              🤖 子代理任务
            </div>
            {input?.description && (
              <div className="text-xs text-muted-foreground mb-2">{input.description}</div>
            )}
            {input?.subagent_type && (
              <div className="text-xs">
                <span className="text-muted-foreground">类型: </span>
                <span className="font-mono">{input.subagent_type}</span>
              </div>
            )}
            {result && (
              <div className="mt-2 text-xs bg-background/50 p-2 rounded">
                <div className="text-muted-foreground mb-1">任务结果:</div>
                <div className="whitespace-pre-wrap">
                  {typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}
                </div>
              </div>
            )}
          </div>
        ),
        (props) => props
      ),
      description: 'Claude Code 子代理工具',
    },
  ];

  // 批量注册所有工具
  toolRegistry.registerBatch(tools);

  // 输出注册统计
  const stats = toolRegistry.getStats();
  console.log(`[ToolRegistry] 工具注册完成: ${stats.total} 个工具, ${stats.withPattern} 个模式匹配工具`);
}

/**
 * 注册自定义工具（供外部扩展使用）
 */
export function registerCustomTool(tool: ToolRenderer): void {
  toolRegistry.register(tool);
  console.log(`[ToolRegistry] 自定义工具注册: ${tool.name}`);
}

/**
 * 获取所有已注册工具的列表（用于调试）
 */
export function getRegisteredTools(): ToolRenderer[] {
  return toolRegistry.getAllRenderers();
}
