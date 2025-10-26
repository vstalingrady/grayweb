"use client";

import styles from "@/app/gray/GrayPageClient.module.css";
import { ArrowUpRight, Paperclip } from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef } from "react";

type GrayChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectFiles?: (files: File[]) => void;
};

export function GrayChatBar({
  value,
  onChange,
  onSubmit,
  onSelectFiles,
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

  const isSubmitDisabled = value.trim().length === 0;

  return (
    <form className={styles.chatBar} onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileInputChange}
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
        placeholder="Ask anything"
        className={styles.chatInput}
        aria-label="Ask anything"
      />
      <button
        type="submit"
        aria-label="Send message"
        title="Send message"
        className={styles.chatActionButton}
        disabled={isSubmitDisabled}
      >
        <ArrowUpRight size={18} />
      </button>
    </form>
  );
}
