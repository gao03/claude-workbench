import { AgentSession } from '@anthropic-ai/claude-agent-sdk';

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

export interface Checkpoint {
  id: string;
  timestamp: string;
  message: string;
  filesChanged?: string[];
}

export class ClaudeAgentService {
  private session: AgentSession | null = null;

  /**
   * 创建新的 Agent 会话
   */
  async createSession(config: AgentConfig): Promise<string> {
    this.session = await AgentSession.create({
      apiKey: config.apiKey,
      model: config.model || 'claude-3-5-sonnet-20241022',
      systemPrompt: config.systemPrompt,
      workingDirectory: config.projectPath,
      // 工具权限配置
      permissions: {
        allowedTools: config.allowedTools,
        disallowedTools: config.disallowedTools,
      },
      // MCP 服务器配置
      mcpServers: config.mcpServers,
    });

    return this.session.id;
  }

  /**
   * 发送消息（带自动上下文管理）
   */
  async sendMessage(message: string): Promise<AsyncIterator<any>> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    // Agent SDK 自动处理:
    // - 上下文压缩
    // - 提示缓存
    // - 会话状态管理
    return this.session.sendMessage(message);
  }

  /**
   * 回退到检查点
   */
  async rewindToCheckpoint(checkpointId: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    await this.session.rewind(checkpointId);
  }

  /**
   * 获取所有检查点
   */
  async getCheckpoints(): Promise<Checkpoint[]> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    return this.session.getCheckpoints();
  }

  /**
   * 获取会话历史
   */
  async getHistory(): Promise<any[]> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    return this.session.getHistory();
  }

  /**
   * 恢复现有会话
   */
  async resumeSession(sessionId: string, config: AgentConfig): Promise<void> {
    this.session = await AgentSession.resume(sessionId, {
      apiKey: config.apiKey,
      workingDirectory: config.projectPath,
    });
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
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

