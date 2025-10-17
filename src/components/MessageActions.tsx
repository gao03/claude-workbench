import React from "react";

export interface MessageActionsProps {
  messageIndex: number;
  messageType: "user" | "assistant";
  messageContent: string;
  sessionId: string | null;
  projectId: string | null;
  projectPath: string | null;
  onUndo?: (messageIndex: number) => Promise<void>;
  onEdit?: (messageIndex: number, newContent: string) => Promise<void>;
  onDelete?: (messageIndex: number) => Promise<void>;
  onTruncate?: (messageIndex: number) => Promise<void>;
  disabled?: boolean;
}

/**
 * Message action buttons (DEPRECATED)
 * All message operations have been removed as they are no longer supported
 */
export const MessageActions: React.FC<MessageActionsProps> = () => {
  // Message operations (undo/edit/delete/truncate) have been removed
  // as they are no longer supported by the backend
  return null;
};
