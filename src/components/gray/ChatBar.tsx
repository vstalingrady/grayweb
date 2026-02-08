"use client";

import styles from "@/components/gray/chat/ChatComposerStyles.module.css";
import { Paperclip, ArrowUpRight, Mic, Square } from "lucide-react";
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
  isInputDisabled?: boolean;
  isSubmitting?: boolean;
  onAddAttachment?: () => void;
  onToggleVoiceInput?: () => void;
  isVoiceInputActive?: boolean;
  isVoiceInputSupported?: boolean;
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
  isInputDisabled = false,
  isSubmitting = false,
  onAddAttachment,
  onToggleVoiceInput,
  isVoiceInputActive = false,
  isVoiceInputSupported = false,
  modelSelector,
  onPasteFiles,
  attachmentTray,
}: GrayChatBarProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("Ask Gray");
  const isInputBlocked = Boolean(isInputDisabled);
  const computedDisabled =
    (isInputBlocked && !isSubmitting) ||
    (typeof isSubmitDisabled === "boolean" ? isSubmitDisabled : value.trim().length === 0);

  // We trigger a re-render/check on mount to ensure mobile detection if needed, 
  // but for TextareaAutosize we mainly just need the component.
  // Prefer pointer/hover capability over viewport width when deciding Enter behavior.
  const [isTouchPrimaryInput, setIsTouchPrimaryInput] = useState(false);

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const hoverNoneQuery = window.matchMedia("(hover: none)");

    const updateInputMode = () => {
      setIsTouchPrimaryInput(coarsePointerQuery.matches && hoverNoneQuery.matches);
    };
    updateInputMode();
    if (typeof coarsePointerQuery.addEventListener === "function") {
      coarsePointerQuery.addEventListener("change", updateInputMode);
      hoverNoneQuery.addEventListener("change", updateInputMode);
    } else {
      coarsePointerQuery.addListener(updateInputMode);
      hoverNoneQuery.addListener(updateInputMode);
    }
    return () => {
      if (typeof coarsePointerQuery.removeEventListener === "function") {
        coarsePointerQuery.removeEventListener("change", updateInputMode);
        hoverNoneQuery.removeEventListener("change", updateInputMode);
      } else {
        coarsePointerQuery.removeListener(updateInputMode);
        hoverNoneQuery.removeListener(updateInputMode);
      }
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isInputBlocked) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      const explicitlySubmit = event.metaKey || event.ctrlKey;
      if (explicitlySubmit || !isTouchPrimaryInput) {
        event.preventDefault();
        if (!computedDisabled) {
          // Create a synthetic event to match the expected signature
          const syntheticEvent = {
            preventDefault: () => { },
          } as FormEvent<HTMLFormElement>;
          onSubmit(syntheticEvent);
        }
      }
      // On touch-primary devices, Enter inserts a newline by default unless explicitly submitted.
    }
  };

  const handlePaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      if (isInputBlocked) {
        return;
      }
      if (!onPasteFiles) {
        return;
      }
      const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
      if (clipboardFiles.length === 0) {
        return;
      }
      onPasteFiles(clipboardFiles);
    },
    [isInputBlocked, onPasteFiles]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      if (isInputBlocked) {
        return;
      }
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
    [isInputBlocked, onPasteFiles]
  );


  const isStreaming = isSubmitting;
  const actionLabel = isStreaming ? t("Stop response") : t("Send message");
  const voiceInputLabel = isVoiceInputActive ? t("Stop voice input") : t("Start voice input");

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
          {isVoiceInputSupported && onToggleVoiceInput ? (
            <button
              type="button"
              className={styles.chatIconButton}
              aria-label={voiceInputLabel}
              title={voiceInputLabel}
              aria-pressed={isVoiceInputActive ? "true" : "false"}
              data-active={isVoiceInputActive ? "true" : undefined}
              onClick={onToggleVoiceInput}
              disabled={isInputBlocked && !isSubmitting}
            >
              {isVoiceInputActive ? <Square size={14} /> : <Mic size={18} />}
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
            disabled={isInputBlocked}
            rows={1}
            minRows={1}
            maxRows={5}
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
          {isVoiceInputSupported && onToggleVoiceInput ? (
            <button
              type="button"
              className={styles.chatIconButton}
              aria-label={voiceInputLabel}
              title={voiceInputLabel}
              aria-pressed={isVoiceInputActive ? "true" : "false"}
              data-active={isVoiceInputActive ? "true" : undefined}
              onClick={onToggleVoiceInput}
              disabled={isInputBlocked && !isSubmitting}
            >
              {isVoiceInputActive ? <Square size={14} /> : <Mic size={18} />}
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
