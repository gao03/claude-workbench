import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MessageSquare,
  FolderOpen,
  Star,
  ChevronRight,
  Search,
  Filter,
  Hash,
  Calendar,
  Zap,
  TrendingUp
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, type Session } from "@/lib/api";
import { formatTimeAgo } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface RecentSessionsProps {
  onSessionClick: (session: Session) => void;
  className?: string;
}

interface ExtendedSession extends Session {
  is_favorite?: boolean;
  message_count?: number;
  last_activity?: string;
  total_tokens?: number;
  summary?: string;
}

/**
 * RecentSessions - 最近会话快速访问组件
 * 显示用户最近使用的会话，支持搜索和快速访问
 */
export const RecentSessions: React.FC<RecentSessionsProps> = ({
  onSessionClick,
  className,
}) => {
  const [recentSessions, setRecentSessions] = useState<ExtendedSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ExtendedSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // 加载最近会话
  useEffect(() => {
    loadRecentSessions();
    loadFavorites();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = recentSessions.filter(session =>
        session.first_message?.toLowerCase().includes(query) ||
        session.project_path.toLowerCase().includes(query) ||
        session.summary?.toLowerCase().includes(query)
      );
      setFilteredSessions(filtered);
    } else {
      setFilteredSessions(recentSessions);
    }
  }, [searchQuery, recentSessions]);

  const loadRecentSessions = async () => {
    try {
      setIsLoading(true);

      // 获取所有项目和会话
      const projects = await api.listProjects();
      const allSessions: ExtendedSession[] = [];

      for (const project of projects.slice(0, 10)) { // 限制扫描前10个项目
        for (const session of project.sessions.slice(0, 5)) { // 每个项目最多取5个会话
          // 尝试加载会话历史获取更多信息
          try {
            const history = await api.loadSessionHistory(session.id, session.project_id);

            // 计算会话统计信息
            const messageCount = history.filter(h => h.type === "user" || h.type === "assistant").length;
            const lastMessage = history[history.length - 1];
            const lastActivity = lastMessage?.timestamp || lastMessage?.receivedAt;

            // 提取会话摘要（从第一个assistant消息）
            const firstAssistantMsg = history.find(h => h.type === "assistant");
            let summary = "";
            if (firstAssistantMsg?.message?.content) {
              const content = firstAssistantMsg.message.content;
              if (Array.isArray(content)) {
                const textContent = content.find(c => c.type === "text");
                summary = textContent?.text?.substring(0, 100) || "";
              } else if (typeof content === "string") {
                summary = content.substring(0, 100);
              }
            }

            allSessions.push({
              ...session,
              message_count: messageCount,
              last_activity: lastActivity,
              summary: summary,
            });
          } catch {
            // 如果无法加载历史，仍然添加基本会话信息
            allSessions.push(session);
          }
        }
      }

      // 按最后活动时间排序
      allSessions.sort((a, b) => {
        const timeA = a.last_activity ? new Date(a.last_activity).getTime() : a.created_at;
        const timeB = b.last_activity ? new Date(b.last_activity).getTime() : b.created_at;
        return timeB - timeA;
      });

      setRecentSessions(allSessions.slice(0, 20)); // 最多显示20个最近会话
      setFilteredSessions(allSessions.slice(0, 20));
    } catch (error) {
      console.error("Failed to load recent sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavorites = () => {
    // 从 localStorage 加载收藏的会话
    const savedFavorites = localStorage.getItem("favorite-sessions");
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  };

  const toggleFavorite = (sessionId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(sessionId)) {
      newFavorites.delete(sessionId);
    } else {
      newFavorites.add(sessionId);
    }
    setFavorites(newFavorites);
    localStorage.setItem("favorite-sessions", JSON.stringify(Array.from(newFavorites)));

    // 更新会话列表中的收藏状态
    setRecentSessions(prev => prev.map(session => ({
      ...session,
      is_favorite: newFavorites.has(session.id)
    })));
  };

  const getProjectName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  const displayedSessions = showAll ? filteredSessions : filteredSessions.slice(0, 6);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rotating-symbol text-primary" />
          <span className="text-sm text-muted-foreground">加载最近会话...</span>
        </div>
      </div>
    );
  }

  if (recentSessions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 标题和搜索栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">最近会话</h2>
          <Badge variant="secondary" className="ml-2">
            {filteredSessions.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索会话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* 会话网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {displayedSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1]
              }}
            >
              <Card
                className={cn(
                  "group relative overflow-hidden cursor-pointer transition-all duration-200",
                  "hover:shadow-lg hover:scale-[1.02] hover:ring-2 hover:ring-primary/20",
                  "border-l-4",
                  favorites.has(session.id) ? "border-l-yellow-500" : "border-l-primary"
                )}
                onClick={() => onSessionClick(session)}
              >
                <div className="p-4 space-y-3">
                  {/* 项目和收藏按钮 */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {getProjectName(session.project_path)}
                      </span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 w-8 p-0",
                              favorites.has(session.id) && "text-yellow-500"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(session.id);
                            }}
                          >
                            <Star
                              className="h-4 w-4"
                              fill={favorites.has(session.id) ? "currentColor" : "none"}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {favorites.has(session.id) ? "取消收藏" : "收藏会话"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* 会话预览 */}
                  <div className="space-y-2">
                    {session.first_message && (
                      <p className="text-sm line-clamp-2 text-foreground/80">
                        {session.first_message}
                      </p>
                    )}

                    {session.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {session.summary}
                      </p>
                    )}
                  </div>

                  {/* 统计信息 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {session.message_count !== undefined && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{session.message_count}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatTimeAgo(
                            session.last_activity
                              ? new Date(session.last_activity).getTime()
                              : session.created_at * 1000
                          )}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* 快速操作提示 */}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Hover 效果装饰 */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 查看更多按钮 */}
      {filteredSessions.length > 6 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setShowAll(!showAll)}
            className="gap-2"
          >
            {showAll ? "收起" : `查看全部 (${filteredSessions.length})`}
          </Button>
        </div>
      )}

      {/* 快捷提示 */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          <span>点击快速打开</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          <span>点击星标收藏</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span>按最近使用排序</span>
        </div>
      </div>
    </div>
  );
};