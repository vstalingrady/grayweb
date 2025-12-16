"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  RefreshCw,
  SignalHigh,
  Trash2,
} from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { ChatMessage as ChatSessionMessage } from "../types";

export type ChatMessageFooterProps = {
  message: ChatSessionMessage;
  isAssistant: boolean;
  rawContent: string;
  fullText: string;
  timestampIso?: string;
  timestampLabel: string;
  metadataRows: { label: string; value: string }[];
  copiedMessageId: string | null;
  isRegenerating: boolean;
  isResponding?: boolean;
  onCopyMessage: (text: string) => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onDelete: () => void;
  onCycleVariant: (direction: "prev" | "next") => void;
  t: (message: string, vars?: Record<string, string | number>) => string;
};

export function ChatMessageFooter({
  message,
  isAssistant,
  rawContent,
  fullText,
  timestampIso,
  timestampLabel,
  metadataRows,
  copiedMessageId,
  isRegenerating,
  isResponding,
  onCopyMessage,
  onRegenerate,
  onEdit,
  onRetry,
  onDelete,
  onCycleVariant,
  t,
}: ChatMessageFooterProps) {
  const isMetadataAvailable = isAssistant && metadataRows.length > 0;
  const variants = isAssistant && Array.isArray(message.variants) ? message.variants : [];
  const hasVariants = variants.length > 1;
  const copyText = isAssistant ? fullText : rawContent;
  const isCopyDisabled = !copyText.trim();

  return (
    <div className={styles.chatMessageFooter}>
      <div className={styles.chatMessageFooterInner} onClick={(event) => event.stopPropagation()}>
        <div className={styles.chatMessageFooterLeft}>
          <time className={styles.chatMessageTimestamp} dateTime={timestampIso}>
            {timestampLabel}
          </time>
          {hasVariants ? (
            <div className={styles.chatMessageVariantControls}>
              <button type="button" aria-label={t("Previous response")} onClick={() => onCycleVariant("prev")}>
                <ChevronLeft size={14} />
              </button>
              <span className={styles.chatMessageVariantLabel}>
                {(message.activeVariantIndex ?? variants.length - 1) + 1} / {variants.length}
              </span>
              <button type="button" aria-label={t("Next response")} onClick={() => onCycleVariant("next")}>
                <ChevronRight size={14} />
              </button>
            </div>
          ) : null}
        </div>
        <div className={styles.chatMessageFooterRight}>
          <div className={styles.chatActionIconRow}>
            {isMetadataAvailable ? (
              <div className={styles.chatMetadataControl}>
                <button type="button" aria-label={t("Response details")} tabIndex={0}>
                  <SignalHigh size={15} />
                </button>
                <div className={styles.chatMetadataPopover} role="tooltip" aria-hidden="true">
                  {metadataRows.map((row) => (
                    <div key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <button type="button" aria-label={t("Copy message")} onClick={() => onCopyMessage(copyText)} disabled={isCopyDisabled}>
              {copiedMessageId === message.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            </button>
            {isAssistant ? (
              <button
                type="button"
                aria-label={t("Regenerate response")}
                onClick={onRegenerate}
                disabled={isRegenerating || isResponding}
              >
                <RefreshCw size={15} className={isRegenerating ? styles.spin : undefined} />
              </button>
            ) : (
              <>
                <button type="button" aria-label={t("Edit message")} onClick={onEdit}>
                  <Pencil size={15} />
                </button>
                <button type="button" aria-label={t("Retry message")} onClick={onRetry} disabled={!rawContent.trim()}>
                  <RefreshCw size={15} />
                </button>
              </>
            )}
            <button type="button" aria-label={t("Delete message")} onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
