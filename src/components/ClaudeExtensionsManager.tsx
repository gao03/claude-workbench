import React, { useState, useEffect } from "react";
import {
  Bot,
  Code,
  FolderOpen,
  Plus,
  Package,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ClaudeExtensionsManagerProps {
  projectPath?: string;
  className?: string;
}

interface AgentFile {
  name: string;
  path: string;
  scope: 'project' | 'user';
  description?: string;
}

interface SkillFile {
  name: string;
  path: string;
  scope: 'project' | 'user';
  description?: string;
}

/**
 * Claude 扩展管理器
 * 
 * 根据官方文档管理：
 * - Subagents: .claude/agents/ 下的 Markdown 文件
 * - Agent Skills: .claude/skills/ 下的 SKILL.md 文件
 * - Slash Commands: 已有独立管理器
 */
export const ClaudeExtensionsManager: React.FC<ClaudeExtensionsManagerProps> = ({
  projectPath,
  className
}) => {
  const [_agents, _setAgents] = useState<AgentFile[]>([]);
  const [_skills, _setSkills] = useState<SkillFile[]>([]);
  const [activeTab, setActiveTab] = useState("agents");

  // 扫描文件的模拟实现（需要后端 API 支持）
  const loadAgents = async () => {
    // TODO: 实现后端 API 扫描 .claude/agents/ 目录
    console.log('[ClaudeExtensions] Loading agents from .claude/agents/');
  };

  const loadSkills = async () => {
    // TODO: 实现后端 API 扫描 .claude/skills/ 目录
    console.log('[ClaudeExtensions] Loading skills from .claude/skills/');
  };

  useEffect(() => {
    if (projectPath) {
      loadAgents();
      loadSkills();
    }
  }, [projectPath]);

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agents">
            <Bot className="h-4 w-4 mr-2" />
            子代理 (Subagents)
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Sparkles className="h-4 w-4 mr-2" />
            Agent Skills
          </TabsTrigger>
        </TabsList>

        {/* Subagents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">子代理</h3>
              <p className="text-sm text-muted-foreground">
                存储在 <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/agents/</code> 的专用代理
              </p>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新建子代理
            </Button>
          </div>

          {/* 提示：需要后端 API */}
          <Card className="p-6 text-center border-dashed">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-medium mb-2">查看已配置的子代理</h4>
            <p className="text-sm text-muted-foreground mb-4">
              根据官方文档，子代理存储为 .claude/agents/ 目录下的 Markdown 文件
            </p>
            <div className="space-y-2 text-xs text-muted-foreground text-left max-w-md mx-auto">
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>项目级: <code className="bg-muted px-1 py-0.5 rounded">{projectPath}/.claude/agents/</code></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>用户级: <code className="bg-muted px-1 py-0.5 rounded">~/.claude/agents/</code></span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              <FolderOpen className="h-4 w-4 mr-2" />
              打开目录
            </Button>
          </Card>
        </TabsContent>

        {/* Agent Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Agent Skills</h3>
              <p className="text-sm text-muted-foreground">
                存储在 <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/skills/</code> 的专用技能
              </p>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新建 Skill
            </Button>
          </div>

          {/* 提示：需要后端 API */}
          <Card className="p-6 text-center border-dashed">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-medium mb-2">查看已配置的 Agent Skills</h4>
            <p className="text-sm text-muted-foreground mb-4">
              根据官方文档，Agent Skills 存储为 .claude/skills/ 目录下的 SKILL.md 文件
            </p>
            <div className="space-y-2 text-xs text-muted-foreground text-left max-w-md mx-auto">
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>项目级: <code className="bg-muted px-1 py-0.5 rounded">{projectPath}/.claude/skills/</code></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>用户级: <code className="bg-muted px-1 py-0.5 rounded">~/.claude/skills/</code></span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              <FolderOpen className="h-4 w-4 mr-2" />
              打开目录
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 链接到 Slash Commands */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Code className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium">Slash Commands</h4>
              <p className="text-xs text-muted-foreground">
                自定义斜杠命令 - 已有独立管理器
              </p>
            </div>
          </div>
          <Badge variant="outline">已实现</Badge>
        </div>
      </Card>

      {/* 官方文档链接 */}
      <div className="text-xs text-muted-foreground border-t pt-4">
        <p className="mb-2">📚 官方文档参考：</p>
        <ul className="space-y-1 ml-4">
          <li>• <a href="https://docs.claude.com/en/docs/claude-code/subagents" target="_blank" className="text-primary hover:underline">Subagents 文档</a></li>
          <li>• <a href="https://docs.claude.com/en/docs/claude-code/agent-skills" target="_blank" className="text-primary hover:underline">Agent Skills 文档</a></li>
          <li>• <a href="https://docs.claude.com/en/docs/claude-code/slash-commands" target="_blank" className="text-primary hover:underline">Slash Commands 文档</a></li>
        </ul>
      </div>
    </div>
  );
};

