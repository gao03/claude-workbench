import { ReactNode } from "react";

/**
 * Model type definition
 */
export type ModelType = "sonnet" | "opus" | "sonnet1m";

/**
 * Thinking mode type definition
 */
export type ThinkingMode = "auto" | "think" | "keep_thinking" | "think_more" | "think_a_lot" | "think_longer";

/**
 * Model configuration
 */
export interface ModelConfig {
  id: ModelType;
  name: string;
  description: string;
  icon: ReactNode;
}

/**
 * Thinking mode configuration
 */
export interface ThinkingModeConfig {
  id: ThinkingMode;
  name: string;
  description: string;
  level: number; // 0-5 for visual indicator
  phrase?: string; // The phrase to append
}

/**
 * Image attachment interface
 */
export interface ImageAttachment {
  id: string;
  filePath: string;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Floating prompt input props
 */
export interface FloatingPromptInputProps {
  /**
   * Callback when prompt is sent - includes thinking instruction separately
   */
  onSend: (prompt: string, model: ModelType, thinkingInstruction?: string) => void;
  /**
   * Whether the input is loading
   */
  isLoading?: boolean;
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  /**
   * Default model to select
   */
  defaultModel?: ModelType;
  /**
   * Project path for file picker
   */
  projectPath?: string;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Callback when cancel is clicked (only during loading)
   */
  onCancel?: () => void;
  /**
   * Optional function to get conversation context for prompt enhancement
   */
  getConversationContext?: () => string[];
  /**
   * Whether Plan Mode is enabled
   */
  isPlanMode?: boolean;
  /**
   * Callback when Plan Mode is toggled
   */
  onTogglePlanMode?: () => void;
}

/**
 * Floating prompt input ref interface
 */
export interface FloatingPromptInputRef {
  addImage: (imagePath: string) => void;
}
