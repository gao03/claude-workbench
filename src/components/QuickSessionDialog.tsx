import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Plus,
  Clock,
  Star,
  Zap,
  Search,
  Command,
  ArrowRight,
  Sparkles,
  FileText,
  Hash
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type Project, type Session } from "@/lib/api";
import { formatTimeAgo } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";

interface QuickSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSession: (projectPath: string, template?: SessionTemplate) => void;
  onOpenSession: (session: Session) => void;
}

interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  initialPrompt?: string;
  icon: React.ReactNode;
}

const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: "blank",
    name: "空白会话",
    description: "从零开始新的对话",
    icon: <FileText className="h-4 w-4" />
  },
  {
    id: "code-review",
    name: "代码审查",
    description: "让 Claude 审查你的代码",
    initialPrompt: "请帮我审查这段代码，关注潜在的问题和改进点",
    icon: <Search className="h-4 w-4" />
  },
  {
    id: "bug-fix",
    name: "Bug 修复",
    description: "快速定位和修复问题",
    initialPrompt: "我遇到了一个问题，请帮我分析原因并提供解决方案",
    icon: <Zap className="h-4 w-4" />
  },
  {
    id: "feature",
    name: "新功能开发",
    description: "实现新功能或增强",
    initialPrompt: "我想实现一个新功能，请帮我设计和实现",
    icon: <Sparkles className="h-4 w-4" />
  }
];

/**
 * QuickSessionDialog - 快速创建或打开会话的对话框
 * 提供智能项目推荐、模板选择和最近会话快速访问
 */
export const QuickSessionDialog: React.FC<QuickSessionDialogProps> = ({
  open,
  onOpenChange,
  onCreateSession,
  onOpenSession,
}) => {
  const [selectedTab, setSelectedTab] = useState<"new" | "recent">("new");
  const [projectPath, setProjectPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate>(SESSION_TEMPLATES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载数据
  useEffect(() => {
    if (open) {
      loadRecentData();
      loadFavorites();

      // 自动聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const loadRecentData = async () => {
    setIsLoading(true);
    try {
      // 加载最近的项目
      const projects = await api.listProjects();
      const sortedProjects = projects
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 10);
      setRecentProjects(sortedProjects);

      // 加载最近的会话
      const allSessions: Session[] = [];
      for (const project of sortedProjects.slice(0, 5)) {
        for (const session of project.sessions.slice(0, 3)) {
          allSessions.push(session);
        }
      }
      setRecentSessions(allSessions.slice(0, 10));
    } catch (error) {
      console.error("Failed to load recent data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavorites = () => {
    const saved = localStorage.getItem("favorite-projects");
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  };

  const toggleFavorite = (projectPath: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(projectPath)) {
      newFavorites.delete(projectPath);
    } else {
      newFavorites.add(projectPath);
    }
    setFavorites(newFavorites);
    localStorage.setItem("favorite-projects", JSON.stringify(Array.from(newFavorites)));
  };

  const handleSelectPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择项目目录"
      });

      if (selected) {
        setProjectPath(selected as string);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  };

  const handleCreateSession = () => {
    if (!projectPath) return;

    onCreateSession(projectPath, selectedTemplate);
    onOpenChange(false);

    // 重置状态
    setProjectPath("");
    setSelectedTemplate(SESSION_TEMPLATES[0]);
  };

  const getProjectName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  // 过滤项目
  const filteredProjects = recentProjects.filter(project => {
    const projectName = getProjectName(project.path).toLowerCase();
    return projectName.includes(searchQuery.toLowerCase());
  });

  // 排序项目（收藏优先）
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const aFav = favorites.has(a.path);
    const bFav = favorites.has(b.path);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            快速启动会话
          </DialogTitle>
          <DialogDescription>
            创建新会话或快速访问最近的会话
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">
              <Plus className="h-4 w-4 mr-2" />
              新建会话
            </TabsTrigger>
            <TabsTrigger value="recent">
              <Clock className="h-4 w-4 mr-2" />
              最近会话
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            {/* 项目选择 */}
            <div className="space-y-2">
              <Label>项目路径</Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="输入或选择项目路径..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && projectPath) {
                      handleCreateSession();
                    }
                  }}
                />
                <Button variant="outline" onClick={handleSelectPath}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 智能项目推荐 */}
            {!projectPath && sortedProjects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">推荐项目</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索..."
                      className="h-7 pl-7 w-32 text-xs"
                    />
                  </div>
                </div>

                <ScrollArea className="h-48">
                  <div className="space-y-1 pr-4">
                    {sortedProjects.map((project) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                          "hover:bg-accent"
                        )}
                        onClick={() => setProjectPath(project.path)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {getProjectName(project.path)}
                              </p>
                              {favorites.has(project.path) && (
                                <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {project.path}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {project.sessions.length} 会话
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(project.path);
                            }}
                          >
                            <Star
                              className="h-3 w-3"
                              fill={favorites.has(project.path) ? "currentColor" : "none"}
                            />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* 会话模板 */}
            <div className="space-y-2">
              <Label className="text-sm">选择模板</Label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      selectedTemplate.id === template.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{template.icon}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-2 pr-4">
                {recentSessions.length > 0 ? (
                  recentSessions.map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "group p-3 rounded-lg border cursor-pointer transition-all",
                        "hover:border-primary hover:bg-accent"
                      )}
                      onClick={() => {
                        onOpenSession(session);
                        onOpenChange(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs font-mono text-muted-foreground">
                              {session.id.slice(-12)}
                            </p>
                          </div>
                          {session.first_message && (
                            <p className="text-sm line-clamp-1">{session.first_message}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(session.created_at * 1000)}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    暂无最近会话
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {selectedTab === "new" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleCreateSession} disabled={!projectPath}>
              <Zap className="h-4 w-4 mr-2" />
              创建会话
            </Button>
          </DialogFooter>
        )}

        {/* 快捷键提示 */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          提示：按 <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-muted rounded">N</kbd> 快速打开此对话框
        </div>
      </DialogContent>
    </Dialog>
  );
};