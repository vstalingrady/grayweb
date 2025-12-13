"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import { Paperclip, ArrowUpRight, Globe, Brain, Plus } from "lucide-react";
import {
  type ClipboardEvent as ReactClipboardEvent,
  type FormEvent,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useI18n } from "@/contexts/I18nContext";

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
  modelSelector?: React.ReactNode;
  onPasteFiles?: (files: File[]) => void;
  attachmentTray?: React.ReactNode;
};

export function GrayChatBar({
  value,
  onChange,
  onSubmit,
  placeholder,
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
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("Ask Gray");
  const computedDisabled =
    typeof isSubmitDisabled === "boolean" ? isSubmitDisabled : value.trim().length === 0;

  // We trigger a re-render/check on mount to ensure mobile detection if needed, 
  // but for TextareaAutosize we mainly just need the component.
  // The original code had isMobile state to prevent enter-submit on mobile.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // Use width to determine mobile behavior (Enter = newline vs submit)
      // Pointer: coarse is unreliable on touch-capable laptops
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
  const actionLabel = isStreaming ? t("Stop response") : t("Send message");

  // Track if textarea is expanded beyond single line
  const [isExpanded, setIsExpanded] = useState(false);

  const singleLineHeightRef = useRef<number | null>(null);

  const handleHeightChange = useCallback(
    (height: number) => {
      // TextareaAutosize height can vary slightly by route/font rendering.
      // Use a calibrated single-line baseline instead of a hardcoded threshold
      // so we don't incorrectly enter the "expanded" layout (the “forehead”).
      if (value.trim().length === 0 || singleLineHeightRef.current === null) {
        singleLineHeightRef.current = height;
        setIsExpanded(false);
        return;
      }

      const baseline = singleLineHeightRef.current;
      setIsExpanded(height > baseline + 12);
    },
    [value]
  );

  return (
    <form className={styles.chatBarRounded} onSubmit={onSubmit} data-expanded={isExpanded} data-has-attachments={attachmentTray ? "true" : "false"}>
      {attachmentTray && (
        <div className={styles.chatAttachmentTrayTop}>
          {attachmentTray}
        </div>
      )}
      {/* Input row: on desktop includes all controls, on mobile just input */}
      <div className={styles.chatBarInputRow}>
        {/* Left group - visible on desktop only */}
        <div className={`${styles.chatBarLeftGroup} ${styles.hideOnMobile}`}>
          {onAddAttachment ? (
            <button
              type="button"
              className={styles.chatIconButton}
              aria-label={t("Upload a document")}
              onClick={onAddAttachment}
            >
              <Paperclip size={18} />
            </button>
          ) : null}
        </div>

        <div className={styles.chatInputWrapper}>
          <TextareaAutosize
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onHeightChange={handleHeightChange}
            placeholder={resolvedPlaceholder}
            className={styles.chatInput}
            aria-label={resolvedPlaceholder}
            minRows={1}
            maxRows={5}
            cacheMeasurements
            style={{
              resize: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              overflowY: "auto",
              flex: "1 1 auto",
              width: "100%",
              boxSizing: "border-box",
              lineHeight: "1.5",
            }}
          />
        </div>

        {/* Right group - visible on desktop only */}
        <div className={`${styles.chatBarRightGroup} ${styles.hideOnMobile}`}>
          <div className={styles.chatModelSelectorDirect}>
            {modelSelector}
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
        </div>
      </div>

      {/* Bottom row: Controls - visible on mobile only */}
      <div className={styles.chatBarControlsRow}>
        <div className={styles.chatBarLeftGroup}>
          {onAddAttachment ? (
            <button
              type="button"
              className={styles.chatIconButton}
              aria-label={t("Upload a document")}
              onClick={onAddAttachment}
            >
              <Paperclip size={18} />
            </button>
          ) : null}
        </div>
        <div className={styles.chatBarRightGroup}>
          <div className={styles.chatModelSelectorDirect}>
            {modelSelector}
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
        </div>
      </div>
    </form>
  );
}
