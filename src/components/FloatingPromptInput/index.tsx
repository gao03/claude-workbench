import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, X, Wand2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FilePicker } from "../FilePicker";
import { SlashCommandPicker } from "../SlashCommandPicker";
import { ImagePreview } from "../ImagePreview";
import { ModelSelector } from "./ModelSelector";
import { ThinkingModeSelector } from "./ThinkingModeSelector";
import { PlanModeToggle } from "./PlanModeToggle";
import { FloatingPromptInputProps, FloatingPromptInputRef, ThinkingMode, ModelType } from "./types";
import { THINKING_MODES } from "./constants";
import { useImageHandling } from "./hooks/useImageHandling";
import { useFileSelection } from "./hooks/useFileSelection";
import { useSlashCommands } from "./hooks/useSlashCommands";
import { usePromptEnhancement } from "./hooks/usePromptEnhancement";

// Re-export types for external use
export type { FloatingPromptInputRef, FloatingPromptInputProps, ThinkingMode, ModelType } from "./types";

/**
 * FloatingPromptInput - Refactored modular component
 * 
 * @example
 * const promptRef = useRef<FloatingPromptInputRef>(null);
 * <FloatingPromptInput
 *   ref={promptRef}
 *   onSend={(prompt, model, thinking) => console.log('Send:', prompt, model, thinking)}
 *   isLoading={false}
 *   isPlanMode={false}
 *   onTogglePlanMode={() => setPlanMode(!planMode)}
 * />
 */
const FloatingPromptInputInner = (
  {
    onSend,
    isLoading = false,
    disabled = false,
    defaultModel = "sonnet",
    projectPath,
    className,
    onCancel,
    getConversationContext,
    isPlanMode = false,
    onTogglePlanMode,
  }: FloatingPromptInputProps,
  ref: React.Ref<FloatingPromptInputRef>,
) => {
  // State
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelType>(defaultModel);
  const [selectedThinkingMode, setSelectedThinkingMode] = useState<ThinkingMode>("auto");
  const [isExpanded, setIsExpanded] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks
  const {
    imageAttachments,
    embeddedImages,
    dragActive,
    handlePaste,
    handleRemoveImageAttachment,
    handleRemoveEmbeddedImage,
    handleDrag,
    handleDrop,
    addImage,
    setImageAttachments,
    setEmbeddedImages,
  } = useImageHandling({
    prompt,
    projectPath,
    isExpanded,
    onPromptChange: setPrompt,
    textareaRef,
    expandedTextareaRef,
  });

  const {
    showFilePicker,
    filePickerQuery,
    detectAtSymbol,
    updateFilePickerQuery,
    handleFileSelect,
    handleFilePickerClose,
    setShowFilePicker,
    setFilePickerQuery,
  } = useFileSelection({
    prompt,
    projectPath,
    cursorPosition,
    isExpanded,
    onPromptChange: setPrompt,
    onCursorPositionChange: setCursorPosition,
    textareaRef,
    expandedTextareaRef,
  });

  const {
    showSlashCommandPicker,
    slashCommandQuery,
    detectSlashSymbol,
    updateSlashCommandQuery,
    handleSlashCommandSelect,
    handleSlashCommandPickerClose,
    setShowSlashCommandPicker,
    setSlashCommandQuery,
  } = useSlashCommands({
    prompt,
    cursorPosition,
    isExpanded,
    onPromptChange: setPrompt,
    onCursorPositionChange: setCursorPosition,
    textareaRef,
    expandedTextareaRef,
  });

  const {
    isEnhancing,
    handleEnhancePrompt,
    handleEnhancePromptWithGemini,
  } = usePromptEnhancement({
    prompt,
    selectedModel,
    isExpanded,
    onPromptChange: setPrompt,
    getConversationContext,
    textareaRef,
    expandedTextareaRef,
  });

  // Imperative handle for ref
  useImperativeHandle(ref, () => ({
    addImage,
  }));

  // Focus management when expanded state changes
  useEffect(() => {
    if (isExpanded && expandedTextareaRef.current) {
      expandedTextareaRef.current.focus();
    } else if (!isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Event handlers
  const handleSend = () => {
    if (prompt.trim() && !disabled) {
      let finalPrompt = prompt.trim();
      
      // Add image attachment paths to the prompt
      if (imageAttachments.length > 0) {
        const imagePathMentions = imageAttachments.map(attachment => {
          return attachment.filePath.includes(' ') ? `@"${attachment.filePath}"` : `@${attachment.filePath}`;
        }).join(' ');
        
        finalPrompt = finalPrompt + (finalPrompt.endsWith(' ') || finalPrompt === '' ? '' : ' ') + imagePathMentions;
      }
      
      // Extract thinking instruction separately
      const thinkingMode = THINKING_MODES.find(m => m.id === selectedThinkingMode);
      const thinkingInstruction = thinkingMode?.phrase || undefined;

      // Send prompt and thinking instruction separately
      onSend(finalPrompt, selectedModel, thinkingInstruction);
      setPrompt("");
      setImageAttachments([]);
      setEmbeddedImages([]);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;

    // Detect slash command trigger
    detectSlashSymbol(newValue, newCursorPosition);

    // Detect @ file mention trigger
    detectAtSymbol(newValue, newCursorPosition);

    // Update slash command query
    updateSlashCommandQuery(newValue, newCursorPosition);

    // Update file picker query
    updateFilePickerQuery(newValue, newCursorPosition);

    setPrompt(newValue);
    setCursorPosition(newCursorPosition);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showFilePicker && e.key === 'Escape') {
      e.preventDefault();
      setShowFilePicker(false);
      setFilePickerQuery("");
      return;
    }

    if (showSlashCommandPicker && e.key === 'Escape') {
      e.preventDefault();
      setShowSlashCommandPicker(false);
      setSlashCommandQuery("");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !isExpanded && !showFilePicker && !showSlashCommandPicker) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl p-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Compose your prompt</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(false)}
                  className="h-8 w-8"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Image attachments preview */}
              {imageAttachments.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="text-sm font-medium mb-2">附件预览</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {imageAttachments.map((attachment) => (
                      <div key={attachment.id} className="relative flex-shrink-0 group">
                        <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                          <img
                            src={attachment.previewUrl}
                            alt="Screenshot preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleRemoveImageAttachment(attachment.id)}
                              className="w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded images preview */}
              {embeddedImages.length > 0 && (
                <ImagePreview
                  images={embeddedImages}
                  onRemove={handleRemoveEmbeddedImage}
                  className="border-t border-border pt-2"
                />
              )}

              <Textarea
                ref={expandedTextareaRef}
                value={prompt}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="在这里输入您的提示词..."
                className="min-h-[240px] resize-none"
                disabled={disabled}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <ModelSelector
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    disabled={disabled}
                  />
                  <ThinkingModeSelector
                    selectedMode={selectedThinkingMode}
                    onModeChange={setSelectedThinkingMode}
                    disabled={disabled}
                  />
                  {onTogglePlanMode && (
                    <PlanModeToggle
                      isPlanMode={isPlanMode || false}
                      onToggle={onTogglePlanMode}
                      disabled={disabled}
                    />
                  )}
                </div>

                <Button
                  onClick={handleSend}
                  disabled={!prompt.trim() || disabled}
                  size="default"
                >
                  Send
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Input */}
      <div className={cn("fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
        {/* Image attachments preview */}
        {imageAttachments.length > 0 && (
          <div className="border-b border-border p-4">
            <div className="text-sm font-medium mb-2">附件预览</div>
            <div className="flex gap-2 overflow-x-auto">
              {imageAttachments.map((attachment) => (
                <div key={attachment.id} className="relative flex-shrink-0 group">
                  <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                    <img
                      src={attachment.previewUrl}
                      alt="Screenshot preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveImageAttachment(attachment.id)}
                        className="w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embedded images preview */}
        {embeddedImages.length > 0 && (
          <ImagePreview
            images={embeddedImages}
            onRemove={handleRemoveEmbeddedImage}
            className="border-b border-border"
          />
        )}

        <div className="p-4">
          <div className="flex items-end gap-3">
            {/* Model Selector */}
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              disabled={disabled}
            />

            {/* Thinking Mode Selector */}
            <ThinkingModeSelector
              selectedMode={selectedThinkingMode}
              onModeChange={setSelectedThinkingMode}
              disabled={disabled}
            />

            {/* Plan Mode Toggle */}
            {onTogglePlanMode && (
              <PlanModeToggle
                isPlanMode={isPlanMode || false}
                onToggle={onTogglePlanMode}
                disabled={disabled}
              />
            )}

            {/* Prompt Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={dragActive ? "Drop images here..." : "Ask Claude anything..."}
                disabled={disabled}
                className={cn(
                  "min-h-[56px] max-h-[160px] resize-none pr-10",
                  dragActive && "border-primary"
                )}
                rows={1}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(true)}
                disabled={disabled}
                className="absolute right-1 bottom-1 h-8 w-8"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>

              {/* File Picker */}
              <AnimatePresence>
                {showFilePicker && projectPath && projectPath.trim() && (
                  <FilePicker
                    basePath={projectPath.trim()}
                    onSelect={handleFileSelect}
                    onClose={handleFilePickerClose}
                    initialQuery={filePickerQuery}
                  />
                )}
              </AnimatePresence>

              {/* Slash Command Picker */}
              <AnimatePresence>
                {showSlashCommandPicker && (
                  <SlashCommandPicker
                    projectPath={projectPath}
                    onSelect={handleSlashCommandSelect}
                    onClose={handleSlashCommandPickerClose}
                    initialQuery={slashCommandQuery}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Enhance Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  disabled={disabled || isEnhancing}
                  className="gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  {isEnhancing ? "Enhancing..." : "Enhance"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEnhancePrompt}>
                  Use Claude Code
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEnhancePromptWithGemini}>
                  Use Gemini
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Send/Cancel Button */}
            {isLoading ? (
              <Button
                onClick={onCancel}
                variant="destructive"
                size="default"
                disabled={disabled}
              >
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!prompt.trim() || disabled}
                size="default"
              >
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const FloatingPromptInput = forwardRef(FloatingPromptInputInner);
