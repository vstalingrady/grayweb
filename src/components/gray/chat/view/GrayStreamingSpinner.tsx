"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";

export const GrayStreamingSpinner = ({
  toolLabel,
  variant = "default",
}: {
  reasoningSeconds?: number | null; // Keep prop for compatibility but don't display
  toolLabel?: string | null;
  variant?: "default" | "search";
}) => {
  const { t } = useI18n();
  const resolvedLabel = toolLabel ?? (variant === "search" ? t("Searching") : null);

  return (
    <div className={styles.chatStreamingInline} data-variant={variant}>
      {variant === "search" ? (
        <Search className={styles.chatSearchIcon} size={16} aria-hidden="true" />
      ) : (
        <Image
          src="/grayaiwhite.svg"
          alt={t("Gray logo")}
          width={18}
          height={18}
          className={styles.chatStreamingSpinner}
        />
      )}
      {resolvedLabel && <span className={styles.chatToolStatus}>{resolvedLabel}</span>}
    </div>
  );
};
