// import { AgentSession } from '@anthropic-ai/claude-agent-sdk';
// This file is deprecated after checkpoint removal

export interface AgentConfig {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  projectPath?: string;
  // Agent SDK 特有配置
  allowedTools?: string[];
  disallowedTools?: string[];
  mcpServers?: Record<string, any>;
}

export class ClaudeAgentService {
  private session: any | null = null;

  /**
   * 创建新的 Agent 会话
   */
  async createSession(_config: AgentConfig): Promise<string> {
    // This method is deprecated after checkpoint removal
    throw new Error('AgentSession is no longer supported');
  }

  /**
   * 发送消息（带自动上下文管理）
   */
  async sendMessage(_message: string): Promise<AsyncIterator<any>> {
    throw new Error('AgentSession is no longer supported');
  }

  /**
   * 获取会话历史
   */
  async getHistory(): Promise<any[]> {
    throw new Error('AgentSession is no longer supported');
  }

  /**
   * 恢复现有会话
   */
  async resumeSession(_sessionId: string, _config: AgentConfig): Promise<void> {
    throw new Error('AgentSession is no longer supported');
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.session = null;
  }

  /**
   * 获取当前会话 ID
   */
  get sessionId(): string | null {
    return this.session?.id || null;
  }
}

// 导出单例
export const agentSDK = new ClaudeAgentService();

