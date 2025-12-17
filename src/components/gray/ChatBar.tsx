"use client";

import styles from "@/components/gray/chat/ChatComposerStyles.module.css";
import pageStyles from "@/app/gray/GrayPageClient.module.css";
import Image from "next/image";
import { Paperclip, ArrowUpRight } from "lucide-react";
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
  isSearchEnabled?: boolean;
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
  isSearchEnabled = false,
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
  const isWebSearchInFlight = Boolean(isSubmitting && isSearchEnabled);

  // Track if textarea is expanded beyond single line
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Only expand when there are actual newlines (user pressed Enter)
  // This avoids premature expansion from text wrapping
  const handleHeightChange = useCallback(
    (_height: number, meta: { rowHeight: number }) => {
      // Check for explicit newlines in the content
      const hasExplicitNewlines = value.includes('\n');

      if (hasExplicitNewlines) {
        setIsExpanded(true);
        return;
      }

      // Also check if the textarea has actually grown beyond ~1.5 lines
      // based on its scrollHeight vs the row height
      const textarea = textareaRef.current;
      if (textarea && meta.rowHeight > 0) {
        const visualLines = textarea.scrollHeight / meta.rowHeight;
        setIsExpanded(visualLines > 1.8);
      } else {
        setIsExpanded(false);
      }
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
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onHeightChange={handleHeightChange}
            placeholder={resolvedPlaceholder}
            className={styles.chatInput}
            aria-label={resolvedPlaceholder}
            rows={1}
            minRows={1}
            maxRows={5}
          />
        </div>

        {/* Right group - visible on desktop only */}
        <div className={`${styles.chatBarRightGroup} ${styles.hideOnMobile}`}>
          {isWebSearchInFlight ? (
            <Image
              src="/grayaiwhitenotspinning.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              className={`${styles.chatSearchSpinner} ${pageStyles.uiIconImage}`}
            />
          ) : null}
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
          {isWebSearchInFlight ? (
            <Image
              src="/grayaiwhitenotspinning.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              className={`${styles.chatSearchSpinner} ${pageStyles.uiIconImage}`}
            />
          ) : null}
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
