import { ArrowUpRight, Plus } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { type FormEvent } from "react";

type GrayChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function GrayChatBar({ value, onChange, onSubmit }: GrayChatBarProps) {
  return (
    <form className={styles.chatBar} onSubmit={onSubmit}>
      <button
        type="button"
        className={styles.chatIconButton}
        aria-label="Add attachment"
      >
        <Plus size={18} />
      </button>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask anything"
        className={styles.chatInput}
      />
      <button
        type="submit"
        className={styles.chatActionButton}
        aria-label="Send message"
      >
        <ArrowUpRight size={18} />
      </button>
    </form>
  );
}
