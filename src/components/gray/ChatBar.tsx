"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import { Paperclip, ArrowUpRight } from "lucide-react";
import {
  type ClipboardEvent as ReactClipboardEvent,
  type FormEvent,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";

export type GrayChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder?: string;
  isSubmitDisabled?: boolean;
  isSubmitting?: boolean;
  onAddAttachment?: () => void;
  isReasoningEnabled?: boolean;
  onToggleReasoning?: () => void;
  isReasoningLocked?: boolean;
  isSearchEnabled?: boolean;
  onToggleSearch?: () => void;
  onToggleSearch?: () => void;
  modelSelector?: React.ReactNode;
  onPasteFiles?: (files: File[]) => void;
  attachmentTray?: React.ReactNode;
};

export function GrayChatBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask anything",
  isSubmitDisabled,
  isSubmitting = false,
  onAddAttachment,
  isReasoningEnabled = false,
  onToggleReasoning,
  isReasoningLocked = false,
  isSearchEnabled = false,
  onToggleSearch,
  modelSelector,
  onPasteFiles,
  attachmentTray,
}: GrayChatBarProps) {
  const computedDisabled =
    typeof isSubmitDisabled === "boolean" ? isSubmitDisabled : value.trim().length === 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to 'inherit' to correctly calculate scrollHeight
    // This allows the textarea to shrink when text is deleted
    textarea.style.height = "inherit";

    // Calculate new height
    const computedStyle = window.getComputedStyle(textarea);
    const newHeight = Math.min(textarea.scrollHeight, 200);

    textarea.style.height = `${newHeight}px`;

    // Show scrollbar only if we hit the max height
    textarea.style.overflowY = newHeight >= 200 ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.matchMedia("(pointer: coarse)").matches);
      adjustHeight();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      if (!isMobile) {
        event.preventDefault();
        if (!computedDisabled) {
          // Create a synthetic event to match the expected signature
          const syntheticEvent = {
            preventDefault: () => { },
          } as FormEvent<HTMLFormElement>;
          onSubmit(syntheticEvent);
        }
      }
      // On mobile, let default behavior happen (newline)
    }
  };

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      if (!onPasteFiles) {
        return;
      }
      const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
      if (clipboardFiles.length === 0) {
        return;
      }
      onPasteFiles(clipboardFiles);
    },
    [onPasteFiles]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      if (!onPasteFiles) {
        return;
      }
      event.preventDefault();
      const droppedFiles = Array.from(event.dataTransfer.files ?? []);
      if (droppedFiles.length === 0) {
        return;
      }
      onPasteFiles(droppedFiles);
    },
    [onPasteFiles]
  );

  const isStreaming = isSubmitting;
  const actionLabel = isStreaming ? "Stop response" : "Send message";

  return (
    <form className={styles.chatBarRounded} onSubmit={onSubmit}>
      {onAddAttachment ? (
        <button
          type="button"
          className={styles.chatIconButton}
          aria-label="Upload a document"
          onClick={onAddAttachment}
        >
          <Paperclip size={18} />
        </button>
      ) : null}
      <div className={styles.chatInputWrapper}>
        {attachmentTray}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          placeholder={placeholder}
          className={styles.chatInput}
          aria-label={placeholder}
          rows={1}
          style={{ resize: "none", overflowY: "auto" }}
        />
        <div className={styles.chatModelSelectorWrapper}>
          {modelSelector}
        </div>
      </div>
      <button
        type="submit"
        aria-label={actionLabel}
        title={actionLabel}
        className={styles.chatActionButton}
        disabled={computedDisabled}
      >
        {isStreaming ? (
          <span className={styles.chatStopIcon} aria-hidden="true" />
        ) : (
          <ArrowUpRight size={18} />
        )}
      </button>
    </form>
  );
}
