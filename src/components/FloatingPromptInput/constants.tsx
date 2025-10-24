import { Zap, Brain, Sparkles } from "lucide-react";
import { ModelConfig, ThinkingModeConfig } from "./types";

/**
 * Available models
 */
export const MODELS: ModelConfig[] = [
  {
    id: "sonnet",
    name: "Claude 4.5 Sonnet",
    description: "Faster, efficient for most tasks",
    icon: <Zap className="h-4 w-4" />
  },
  {
    id: "sonnet1m",
    name: "Claude 4.5 Sonnet 1M",
    description: "Sonnet with 1 million token context",
    icon: <Brain className="h-4 w-4" />
  },
  {
    id: "opus",
    name: "Claude 4.1 Opus",
    description: "Latest model with enhanced coding & reasoning capabilities",
    icon: <Sparkles className="h-4 w-4" />
  }
];

/**
 * Thinking modes configuration
 * Now using maxThinkingTokens parameter instead of phrases
 */
export const THINKING_MODES: ThinkingModeConfig[] = [
  {
    id: "auto",
    name: "Auto",
    description: "让 Claude 自己决定",
    level: 0,
    tokens: undefined // No extended thinking
  },
  {
    id: "think",
    name: "Think",
    description: "基本推理 (5K tokens)",
    level: 1,
    tokens: 5000
  },
  {
    id: "keep_thinking",
    name: "持续思考",
    description: "持续深入思考 (10K tokens)",
    level: 2,
    tokens: 10000
  },
  {
    id: "think_more",
    name: "更多思考",
    description: "进行更深层次的思考 (15K tokens)",
    level: 3,
    tokens: 15000
  },
  {
    id: "think_a_lot",
    name: "大量思考",
    description: "进行广泛而深入的思考 (20K tokens)",
    level: 4,
    tokens: 20000
  },
  {
    id: "think_longer",
    name: "长时间思考",
    description: "进行长时间的深度分析 (30K tokens)",
    level: 5,
    tokens: 30000
  }
];
