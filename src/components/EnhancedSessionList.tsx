import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Clock,
  MessageSquare,
  Plus,
  Search,
  Hash,
  Activity,
  Zap,
  BarChart3,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Filter,
  SortAsc,
  SortDesc
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ClaudeMemoriesDropdown } from "@/components/ClaudeMemoriesDropdown";
import { cn } from "@/lib/utils";
import { formatUnixTimestamp, formatISOTimestamp, truncateText, getFirstLine, formatTimeAgo } from "@/lib/date-utils";
import type { Session, ClaudeMdFile } from "@/lib/api";
import { api } from "@/lib/api";
import { useTranslation } from '@/hooks/useTranslation';

interface SessionInfo {
  messageCount?: number;
  totalTokens?: number;
  estimatedCost?: number;
  duration?: string;
  summary?: string;
  lastActivity?: string;
}

interface EnhancedSessionListProps {
  sessions: Session[];
  projectPath: string;
  onBack: () => void;
  onSessionClick?: (session: Session) => void;
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  onNewSession?: (projectPath: string) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 8; // 增加每页显示数量

/**
 * EnhancedSessionList - 增强的会话列表组件
 * 提供更丰富的会话信息展示和交互功能
 */
export const EnhancedSessionList: React.FC<EnhancedSessionListProps> = ({
  sessions,
  projectPath,
  onBack,
  onSessionClick,
  onEditClaudeFile,
  onNewSession,
  className,
}) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "messages" | "tokens">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sessionsInfo, setSessionsInfo] = useState<Map<string, SessionInfo>>(new Map());
  const [loadingInfo, setLoadingInfo] = useState(true);

  // 异步加载会话详细信息
  useEffect(() => {
    const loadSessionsInfo = async () => {
      setLoadingInfo(true);
      const infoMap = new Map<string, SessionInfo>();

      // 批量加载会话信息，限制并发数
      const batchSize = 5;
      for (let i = 0; i < sessions.length; i += batchSize) {
        const batch = sessions.slice(i, i + batchSize);
        const promises = batch.map(async (session) => {
          try {
            const history = await api.loadSessionHistory(session.id, session.project_id);

            // 计算统计信息
            const messages = history.filter(h => h.type === "user" || h.type === "assistant");
            const messageCount = messages.length;

            // 计算总token数
            let totalTokens = 0;
            let estimatedCost = 0;
            messages.forEach(msg => {
              if (msg.message?.usage) {
                const usage = msg.message.usage;
                totalTokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);

                // 简单成本估算（每100万token）
                const inputCost = ((usage.input_tokens || 0) / 1000000) * 3.00;
                const outputCost = ((usage.output_tokens || 0) / 1000000) * 15.00;
                estimatedCost += inputCost + outputCost;
              }
            });

            // 计算会话持续时间
            const firstMsg = messages[0];
            const lastMsg = messages[messages.length - 1];
            let duration = "";
            if (firstMsg && lastMsg) {
              const startTime = new Date(firstMsg.timestamp || firstMsg.sentAt || session.created_at * 1000);
              const endTime = new Date(lastMsg.timestamp || lastMsg.receivedAt || session.created_at * 1000);
              const durationMs = endTime.getTime() - startTime.getTime();
              const minutes = Math.floor(durationMs / 60000);
              const hours = Math.floor(minutes / 60);
              if (hours > 0) {
                duration = `${hours}h ${minutes % 60}m`;
              } else {
                duration = `${minutes}m`;
              }
            }

            // 提取摘要
            const firstAssistantMsg = history.find(h => h.type === "assistant");
            let summary = "";
            if (firstAssistantMsg?.message?.content) {
              const content = firstAssistantMsg.message.content;
              if (Array.isArray(content)) {
                const textContent = content.find(c => c.type === "text");
                summary = textContent?.text?.substring(0, 200) || "";
              }
            }

            const lastActivity = lastMsg?.timestamp || lastMsg?.receivedAt;

            infoMap.set(session.id, {
              messageCount,
              totalTokens,
              estimatedCost,
              duration,
              summary,
              lastActivity
            });
          } catch (error) {
            console.error(`Failed to load info for session ${session.id}:`, error);
          }
        });

        await Promise.all(promises);
      }

      setSessionsInfo(infoMap);
      setLoadingInfo(false);
    };

    if (sessions.length > 0) {
      loadSessionsInfo();
    }
  }, [sessions]);

  // 过滤和排序会话
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter(session => {
        const info = sessionsInfo.get(session.id);
        return (
          session.id.toLowerCase().includes(query) ||
          session.first_message?.toLowerCase().includes(query) ||
          info?.summary?.toLowerCase().includes(query)
        );
      });
    }

    // 排序
    const sorted = [...filtered].sort((a, b) => {
      const infoA = sessionsInfo.get(a.id);
      const infoB = sessionsInfo.get(b.id);

      let comparison = 0;
      switch (sortBy) {
        case "messages":
          comparison = (infoA?.messageCount || 0) - (infoB?.messageCount || 0);
          break;
        case "tokens":
          comparison = (infoA?.totalTokens || 0) - (infoB?.totalTokens || 0);
          break;
        case "date":
        default:
          const dateA = infoA?.lastActivity ? new Date(infoA.lastActivity).getTime() : a.created_at;
          const dateB = infoB?.lastActivity ? new Date(infoB.lastActivity).getTime() : b.created_at;
          comparison = dateA - dateB;
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [sessions, searchQuery, sortBy, sortOrder, sessionsInfo]);

  // 分页
  const totalPages = Math.ceil(filteredAndSortedSessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = filteredAndSortedSessions.slice(startIndex, endIndex);

  // 重置分页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  const formatCost = (amount: number): string => {
    if (amount === 0) return "$0.00";
    if (amount < 0.01) {
      return `$${(amount * 100).toFixed(2)}¢`;
    }
    return `$${amount.toFixed(3)}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 增强的头部导航 */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        {/* 返回按钮和项目信息 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="default"
              size="default"
              onClick={onBack}
              className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-200 shadow-md"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>返回项目列表</span>
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{projectPath}</h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {sessions.length} 个会话
                </span>
                {!loadingInfo && sessionsInfo.size > 0 && (
                  <>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {Array.from(sessionsInfo.values()).reduce((sum, info) => sum + (info.messageCount || 0), 0)} 条消息
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {Math.round(Array.from(sessionsInfo.values()).reduce((sum, info) => sum + (info.totalTokens || 0), 0) / 1000)}K tokens
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 新建会话按钮 */}
          {onNewSession && (
            <Button
              onClick={() => onNewSession(projectPath)}
              size="default"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('claude.newSession')}
            </Button>
          )}
        </div>

        {/* CLAUDE.md 下拉菜单 */}
        {onEditClaudeFile && (
          <ClaudeMemoriesDropdown
            projectPath={projectPath}
            onEditFile={onEditClaudeFile}
          />
        )}

        {/* 搜索和筛选栏 */}
        <div className="flex items-center gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索会话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 排序选项 */}
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="排序依据" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">按日期</SelectItem>
              <SelectItem value="messages">按消息数</SelectItem>
              <SelectItem value="tokens">按Token数</SelectItem>
            </SelectContent>
          </Select>

          {/* 排序顺序 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sortOrder === "asc" ? "升序" : "降序"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>

      {/* 会话卡片列表 */}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentSessions.map((session, index) => {
            const info = sessionsInfo.get(session.id);

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                <Card
                  className={cn(
                    "group transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-pointer",
                    "border-l-4",
                    session.todo_data ? "border-l-primary" : "border-l-muted-foreground/20"
                  )}
                  onClick={() => onSessionClick?.(session)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* 会话 ID 和徽章 */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="font-mono text-xs text-muted-foreground truncate">
                            {session.id.slice(-12)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.todo_data && (
                            <Badge variant="secondary" className="text-xs">
                              <Calendar className="h-3 w-3 mr-1" />
                              Todo
                            </Badge>
                          )}
                          {info && info.messageCount && info.messageCount > 10 && (
                            <Badge variant="outline" className="text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              活跃
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* 会话预览 */}
                      {session.first_message && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium line-clamp-2">
                            {getFirstLine(session.first_message)}
                          </p>
                          {info?.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {info.summary}
                            </p>
                          )}
                        </div>
                      )}

                      {/* 统计信息网格 */}
                      {info && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            <span>{info.messageCount || 0} 条消息</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Activity className="h-3 w-3" />
                            <span>{Math.round((info.totalTokens || 0) / 1000)}K tokens</span>
                          </div>
                          {info.duration && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{info.duration}</span>
                            </div>
                          )}
                          {info.estimatedCost !== undefined && info.estimatedCost > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <BarChart3 className="h-3 w-3" />
                              <span>{formatCost(info.estimatedCost)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 底部时间和操作 */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          <span>
                            {info?.lastActivity
                              ? formatTimeAgo(new Date(info.lastActivity).getTime())
                              : formatTimeAgo(session.created_at * 1000)}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* 悬停效果装饰 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {/* 分页 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* 空状态 */}
      {filteredAndSortedSessions.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "没有找到匹配的会话" : "暂无会话记录"}
          </p>
          {onNewSession && !searchQuery && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => onNewSession(projectPath)}
            >
              <Plus className="h-4 w-4 mr-2" />
              创建新会话
            </Button>
          )}
        </div>
      )}

      {/* 加载状态 */}
      {loadingInfo && sessions.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-background/95 backdrop-blur rounded-lg shadow-lg p-3 flex items-center gap-2">
          <div className="h-4 w-4 rotating-symbol text-primary" />
          <span className="text-sm text-muted-foreground">加载会话信息...</span>
        </div>
      )}
    </div>
  );
};