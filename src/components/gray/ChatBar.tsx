"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import { ArrowUpRight, Loader2, Paperclip } from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef } from "react";

type GrayChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectFiles?: (files: File[]) => void;
  placeholder?: string;
  isSubmitDisabled?: boolean;
  isSubmitting?: boolean;
  fileAccept?: string;
};

export function GrayChatBar({
  value,
  onChange,
  onSubmit,
  onSelectFiles,
  placeholder = "Ask anything",
  isSubmitDisabled,
  isSubmitting = false,
  fileAccept,
}: GrayChatBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    onSelectFiles?.(Array.from(files));
    event.target.value = "";
  };

  const computedDisabled =
    typeof isSubmitDisabled === "boolean" ? isSubmitDisabled : value.trim().length === 0;

  return (
    <form className={styles.chatBar} onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileInputChange}
        accept={fileAccept}
      />
      <button
        type="button"
        className={styles.chatIconButton}
        aria-label="Attach files"
        title="Attach files"
        onClick={handleFileButtonClick}
      >
        <Paperclip size={18} />
      </button>
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
