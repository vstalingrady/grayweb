"use client";

import type { MutableRefObject } from "react";
import styles from "@/components/gray/chat/ChatStyles.module.css";

export type ChatMessageEditorProps = {
  defaultValue: string;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  onCancel: () => void;
  onSave: () => void;
};

export function ChatMessageEditor({ defaultValue, textareaRef, onCancel, onSave }: ChatMessageEditorProps) {
  return (
    <div className={styles.chatEditContainer}>
      <textarea
        className={styles.chatEditInput}
        defaultValue={defaultValue}
        ref={(el) => {
          textareaRef.current = el;
          if (!el) {
            return;
          }
          if (typeof document === "undefined") {
            return;
          }
          if (document.activeElement !== el) {
            el.setSelectionRange(el.value.length, el.value.length);
            el.focus();
          }
        }}
        rows={1}
      />
      <div className={styles.chatEditActions}>
        <button onClick={onCancel} className={styles.chatEditCancelButton}>
          Cancel
        </button>
        <button onClick={onSave} className={styles.chatEditSaveButton}>
          Save
        </button>
      </div>
    </div>
  );
}
