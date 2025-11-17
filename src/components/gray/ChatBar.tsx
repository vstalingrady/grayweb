"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import { ArrowUpRight, Loader2, Paperclip } from "lucide-react";
import { type FormEvent } from "react";

export type GrayChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder?: string;
  isSubmitDisabled?: boolean;
  isSubmitting?: boolean;
  onAddAttachment?: () => void;
};

export function GrayChatBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask anything",
  isSubmitDisabled,
  isSubmitting = false,
  onAddAttachment,
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
      <button
        type="submit"
        aria-label="Send message"
        title="Send message"
        className={styles.chatActionButton}
        disabled={computedDisabled}
      >
        {isSubmitting ? <Loader2 size={18} className={styles.chatSpinner} /> : <ArrowUpRight size={18} />}
      </button>
    </form>
  );
}
