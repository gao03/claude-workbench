import React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PlanModeToggleProps {
  isPlanMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * PlanModeToggle component - Toggle button for Plan Mode
 */
export const PlanModeToggle: React.FC<PlanModeToggleProps> = ({
  isPlanMode,
  onToggle,
  disabled = false
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isPlanMode ? "default" : "outline"}
            size="default"
            onClick={onToggle}
            disabled={disabled}
            className={cn(
              "gap-2",
              isPlanMode && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
            )}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm font-medium">Plan</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">
            {isPlanMode ? "Plan Mode (Active)" : "Plan Mode"}
          </p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {isPlanMode 
              ? "只读研究模式 - Claude 只能分析和规划，不会修改文件"
              : "点击启用只读研究模式（快捷键: Shift+Tab 两次）"
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
