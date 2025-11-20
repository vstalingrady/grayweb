"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import { Loader2, Paperclip, Lightbulb, Send, Search } from "lucide-react";
import { type FormEvent } from "react";

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
}: GrayChatBarProps) {
  const computedDisabled =
    typeof isSubmitDisabled === "boolean" ? isSubmitDisabled : value.trim().length === 0;

  return (
    <form className={styles.chatBar} onSubmit={onSubmit}>
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
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={styles.chatInput}
        aria-label={placeholder}
      />
      {onToggleSearch ? (
        <button
          type="button"
          className={`${styles.chatIconButton} ${isSearchEnabled ? styles.chatIconButtonActive : ""}`}
          aria-label="Toggle web search"
          onClick={onToggleSearch}
          title="Toggle web search"
        >
          <Search size={18} />
        </button>
      ) : null}
      {onToggleReasoning && !isReasoningLocked ? (
        <button
          type="button"
          className={`${styles.chatIconButton} ${isReasoningEnabled ? styles.chatIconButtonActive : ""}`}
          aria-label="Toggle reasoning mode"
          onClick={onToggleReasoning}
          title="Toggle reasoning mode"
        >
          <Lightbulb size={18} />
        </button>
      ) : null}
      <button
        type="submit"
        aria-label="Send message"
        title="Send message"
        className={styles.chatActionButton}
        disabled={computedDisabled}
      >
        {isSubmitting ? <Loader2 size={18} className={styles.chatSpinner} /> : <Send size={18} />}
      </button>
    </form>
  );
}
