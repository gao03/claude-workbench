/**
 * RevertPromptPicker - 撤回提示词选择器
 *
 * 按两次 ESC 键时显示，允许用户选择要撤回的提示词
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ArrowLeft, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClaudeStreamMessage } from '@/types/claude';
import type { RewindMode } from '@/lib/api';

interface PromptEntry {
  /** 提示词索引（从0开始） */
  index: number;
  /** 提示词内容 */
  content: string;
  /** 提示词预览（截断后的内容） */
  preview: string;
  /** 消息索引（在原始消息列表中的位置） */
  messageIndex: number;
}

interface RevertPromptPickerProps {
  /** 消息列表 */
  messages: ClaudeStreamMessage[];
  /** 选择回调 */
  onSelect: (promptIndex: number, mode: RewindMode) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 可选的样式类名 */
  className?: string;
}

/**
 * 从消息内容中提取文本
 */
const extractTextFromMessage = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';

  const content = message.message.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text' && item.text) return item.text;
        if (item.text) return item.text;
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
};

/**
 * 截断文本用于预览
 */
const truncateText = (text: string, maxLength: number = 80): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * RevertPromptPicker 组件
 */
export const RevertPromptPicker: React.FC<RevertPromptPickerProps> = ({
  messages,
  onSelect,
  onClose,
  className,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMode, setSelectedMode] = useState<RewindMode>('both');
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // 提取所有用户提示词
  const prompts = useMemo<PromptEntry[]>(() => {
    const userMessages: PromptEntry[] = [];
    let promptIndex = 0;

    messages.forEach((msg, messageIndex) => {
      if (msg.type === 'user') {
        const content = extractTextFromMessage(msg);
        if (content) {
          userMessages.push({
            index: promptIndex,
            content,
            preview: truncateText(content),
            messageIndex,
          });
          promptIndex++;
        }
      }
    });

    return userMessages;
  }, [messages]);

  // 如果没有可撤回的提示词，直接关闭
  useEffect(() => {
    if (prompts.length === 0) {
      console.log('[RevertPromptPicker] No prompts to revert, closing');
      onClose();
    }
  }, [prompts.length, onClose]);

  // 滚动到选中项
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prompts.length - 1, prev + 1));
          break;

        case 'Enter':
          e.preventDefault();
          if (prompts[selectedIndex]) {
            onSelect(prompts[selectedIndex].index, selectedMode);
            onClose();
          }
          break;

        case '1':
          e.preventDefault();
          setSelectedMode('conversation_only');
          break;

        case '2':
          e.preventDefault();
          setSelectedMode('code_only');
          break;

        case '3':
          e.preventDefault();
          setSelectedMode('both');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [prompts, selectedIndex, selectedMode, onSelect, onClose]);

  if (prompts.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
          className
        )}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-3xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                选择要撤回的提示词
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* 撤回模式选择 */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              撤回模式：
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMode('conversation_only')}
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md transition-colors',
                  selectedMode === 'conversation_only'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                )}
              >
                <span className="font-mono text-xs mr-1">[1]</span>
                仅删除对话
              </button>
              <button
                onClick={() => setSelectedMode('code_only')}
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md transition-colors',
                  selectedMode === 'code_only'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                )}
              >
                <span className="font-mono text-xs mr-1">[2]</span>
                仅回滚代码
              </button>
              <button
                onClick={() => setSelectedMode('both')}
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md transition-colors',
                  selectedMode === 'both'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                )}
              >
                <span className="font-mono text-xs mr-1">[3]</span>
                对话 + 代码
              </button>
            </div>
          </div>

          {/* 提示词列表 */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-2"
          >
            {prompts.map((prompt, idx) => (
              <div
                key={`${prompt.index}-${prompt.messageIndex}`}
                ref={idx === selectedIndex ? selectedItemRef : null}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-all',
                  idx === selectedIndex
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
                onClick={() => {
                  setSelectedIndex(idx);
                }}
                onDoubleClick={() => {
                  onSelect(prompt.index, selectedMode);
                  onClose();
                }}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        提示词 #{prompt.index}
                      </span>
                      <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
                      {prompt.preview}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                <span className="font-mono">↑↓</span> 上下移动 |{' '}
                <span className="font-mono">Enter</span> 确认 |{' '}
                <span className="font-mono">ESC</span> 取消 |{' '}
                <span className="font-mono">1/2/3</span> 切换模式
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
