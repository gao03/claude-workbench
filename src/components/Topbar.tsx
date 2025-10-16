import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Settings, BarChart3, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaudeStatusIndicator } from "@/components/ClaudeStatusIndicator";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

import type { ClaudeStreamMessage } from '@/types/claude';

interface TopbarProps {
  /**
   * Callback when CLAUDE.md is clicked
   */
  onClaudeClick: () => void;
  /**
   * Callback when Settings is clicked
   */
  onSettingsClick: () => void;
  /**
   * Callback when Usage Dashboard is clicked
   */
  onUsageClick: () => void;
  /**
   * Callback when MCP is clicked
   */
  onMCPClick: () => void;
  /**
   * Optional messages for cost calculation
   */
  messages?: ClaudeStreamMessage[];
  /**
   * Optional session ID
   */
  sessionId?: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * 🎨 Modern Topbar Component - Material 3 Inspired
 * Features: Gradient background, glassmorphism, smooth animations
 * 
 * @example
 * <Topbar
 *   onClaudeClick={() => setView('editor')}
 *   onSettingsClick={() => setView('settings')}
 *   onMCPClick={() => setView('mcp')}
 * />
 */
export const Topbar: React.FC<TopbarProps> = ({
  onClaudeClick,
  onSettingsClick,
  onUsageClick,
  onMCPClick,
  messages,
  sessionId,
  className,
}) => {
  const { t } = useTranslation();
  
  // Memoize the status indicator to prevent recreation on every render
  const statusIndicator = useMemo(
    () => <ClaudeStatusIndicator
      onSettingsClick={onSettingsClick}
      messages={messages}
      sessionId={sessionId}
    />,
    [onSettingsClick, messages, sessionId]
  );
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={cn(
        "flex items-center justify-between px-6 py-3.5",
        "border-b border-border/60",
        "bg-gradient-to-b from-background via-background to-muted/20",
        "backdrop-blur-lg supports-[backdrop-filter]:bg-background/80",
        "shadow-sm",
        className
      )}
    >
      {/* Status Indicator */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {statusIndicator}
      </motion.div>
      
      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="flex items-center gap-1.5"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onUsageClick}
          className="text-sm font-medium px-3 hover:bg-muted/70 hover:scale-105 transition-all rounded-lg"
        >
          <BarChart3 className="mr-2 h-4 w-4" strokeWidth={2} />
          {t('navigation.usage')}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClaudeClick}
          className="text-sm font-medium px-3 hover:bg-muted/70 hover:scale-105 transition-all rounded-lg"
        >
          <FileText className="mr-2 h-4 w-4" strokeWidth={2} />
          CLAUDE.md
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onMCPClick}
          className="text-sm font-medium px-3 hover:bg-muted/70 hover:scale-105 transition-all rounded-lg"
        >
          <Network className="mr-2 h-4 w-4" strokeWidth={2} />
          {t('navigation.mcpManager')}
        </Button>
        
        {/* 分隔线 */}
        <div className="h-6 w-px bg-border/50 mx-1" />
        
        <Button
          variant="secondary"
          size="sm"
          onClick={onSettingsClick}
          className="text-sm font-medium px-3 shadow-sm hover:shadow-md hover:scale-105 transition-all rounded-lg"
        >
          <Settings className="mr-2 h-4 w-4" strokeWidth={2} />
          {t('navigation.settings')}
        </Button>
      </motion.div>
    </motion.div>
  );
}; 