import React, { useState } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageHeader } from "./MessageHeader";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from '@/types/claude';

interface UserMessageProps {
  /** 消息数据 */
  message: ClaudeStreamMessage;
  /** 自定义类名 */
  className?: string;
  /** 提示词索引（只计算用户提示词） */
  promptIndex?: number;
  /** 撤回回调 */
  onRevert?: (promptIndex: number) => void;
}

/**
 * 检查是否是 Skills 消息
 */
const isSkillsMessage = (text: string): boolean => {
  return text.includes('<command-name>') 
    || text.includes('Launching skill:')
    || text.includes('skill is running');
};

/**
 * 格式化 Skills 消息显示
 */
const formatSkillsMessage = (text: string): React.ReactNode => {
  // 提取 command-name 和 command-message
  const commandNameMatch = text.match(/<command-name>(.+?)<\/command-name>/);
  const commandMessageMatch = text.match(/<command-message>(.+?)<\/command-message>/);
  
  if (commandNameMatch || commandMessageMatch) {
    return (
      <div className="space-y-2">
        {commandMessageMatch && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">✓</span>
            <span>{commandMessageMatch[1]}</span>
          </div>
        )}
        {commandNameMatch && (
          <div className="text-xs text-muted-foreground font-mono">
            Skill: {commandNameMatch[1]}
          </div>
        )}
      </div>
    );
  }
  
  // 处理 "Launching skill:" 格式
  if (text.includes('Launching skill:')) {
    const skillNameMatch = text.match(/Launching skill: (.+)/);
    if (skillNameMatch) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">✓</span>
            <span>Skill</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Launching skill: <span className="font-mono">{skillNameMatch[1]}</span>
          </div>
        </div>
      );
    }
  }
  
  return text;
};

/**
 * 提取用户消息的纯文本内容
 */
const extractUserText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  let text = '';
  
  // 如果是字符串，直接使用
  if (typeof content === 'string') {
    text = content;
  } 
  // 如果是数组，提取所有text类型的内容
  else if (Array.isArray(content)) {
    text = content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text || '')
      .join('\n');
  }
  
  // ⚡ 关键修复：JSONL 保存为 \\n（双反斜杠），需要替换为真正的换行
  // 正则 /\\\\n/ 匹配两个反斜杠+n
  if (text.includes('\\')) {
    text = text
      .replace(/\\\\n/g, '\n')      // \\n（双反斜杠+n）→ 换行符
      .replace(/\\\\r/g, '\r')      // \\r → 回车
      .replace(/\\\\t/g, '\t')      // \\t → 制表符
      .replace(/\\\\"/g, '"')       // \\" → 双引号
      .replace(/\\\\'/g, "'")       // \\' → 单引号
      .replace(/\\\\\\\\/g, '\\');  // \\\\ → 单个反斜杠（最后处理）
  }
  
  return text;
};

/**
 * 用户消息组件
 * 右对齐气泡样式，简洁展示
 */
export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  className,
  promptIndex,
  onRevert
}) => {
  const text = extractUserText(message);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // 如果没有文本内容，不渲染
  if (!text) return null;
  
  // ⚡ 检查是否是 Skills 消息
  const isSkills = isSkillsMessage(text);
  const displayContent = isSkills ? formatSkillsMessage(text) : text;

  const handleRevertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (promptIndex === undefined || !onRevert) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmRevert = () => {
    if (promptIndex !== undefined && onRevert) {
      setShowConfirmDialog(false);
      onRevert(promptIndex);
    }
  };

  const showRevertButton = promptIndex !== undefined && promptIndex >= 0 && onRevert;

  return (
    <>
    <div className={cn("group relative", className)}>
      <MessageBubble variant="user">
          <div className="relative">
        {/* 消息头部 */}
        <MessageHeader 
          variant="user" 
          timestamp={message.timestamp}
          showAvatar={false}
        />
        
        {/* 消息内容和撤回按钮 - 同一行显示 */}
        <div className="flex items-start gap-2">
        {/* 消息内容 */}
          <div className={cn(
            "text-sm leading-relaxed flex-1",
            isSkills ? "" : "whitespace-pre-wrap"
          )}>
            {displayContent}
            </div>

          {/* 撤回按钮 - Skills 消息不显示撤回按钮 */}
            {showRevertButton && !isSkills && (
            <div className="flex-shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                      variant="outline"
                        size="sm"
                      className="h-7 w-7 p-0 rounded-full border-primary-foreground/20 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground/40 transition-all"
                        onClick={handleRevertClick}
                      >
                      <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                  <TooltipContent side="top">
                    撤回到此消息
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
        </div>
        </div>
      </MessageBubble>
    </div>

      {/* 撤回确认对话框 */}
      {showConfirmDialog && (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                确认撤回操作
              </DialogTitle>
              <DialogDescription>
                撤回到此消息，删除后续所有对话并恢复代码
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">将会执行：</div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>删除提示词 #{(promptIndex ?? 0) + 1} 及之后的所有对话</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>代码回滚到发送此消息前的状态</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>提示词恢复到输入框，可修改重发</span>
                  </li>
                </ul>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>警告：</strong>此操作不可撤销，删除的对话无法恢复。
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmRevert}
              >
                确认撤回
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
