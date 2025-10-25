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
 * 提取用户消息的纯文本内容
 */
const extractUserText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  // 如果是字符串，直接返回
  if (typeof content === 'string') return content;
  
  // 如果是数组，提取所有text类型的内容
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');
  }
  
  return '';
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

  const handleRevertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (promptIndex === undefined || !onRevert) return;
    console.log('[UserMessage] Revert clicked, promptIndex:', promptIndex);
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
            
            {/* 消息内容 */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {text}
            </div>

            {/* 撤回按钮 - 悬停显示 */}
            {showRevertButton && (
              <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                        onClick={handleRevertClick}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        撤回
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      撤回到此消息，删除后续对话
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
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
