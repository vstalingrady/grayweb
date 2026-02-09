"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";

export const GrayStreamingSpinner = ({
  toolLabel,
  searchQuery,
  searchState = "active",
  variant = "default",
}: {
  reasoningSeconds?: number | null; // Keep prop for compatibility but don't display
  toolLabel?: string | null;
  searchQuery?: string | null;
  searchState?: "active" | "completed";
  variant?: "default" | "search";
}) => {
  const { t } = useI18n();
  const resolvedLabel = toolLabel ?? (variant === "search" ? t("Searching") : null);
  const hasSearchQuery = variant === "search" && typeof searchQuery === "string" && searchQuery.trim().length > 0;
  const shouldShimmerSearchLabel = variant === "search" && searchState === "active";

  return (
    <div className={styles.chatStreamingInline} data-variant={variant}>
      <div className={styles.chatStreamingInlineHeader}>
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
        {resolvedLabel ? (
          <span
            className={`${styles.chatToolStatus} ${shouldShimmerSearchLabel ? styles.chatToolStatusShimmer : ""}`}
          >
            {resolvedLabel}
          </span>
        ) : null}
      </div>
      {hasSearchQuery ? (
        <div className={styles.chatSearchQueryBar} data-search-state={searchState}>
          <span className={styles.chatSearchQueryText}>{searchQuery}</span>
        </div>
      ) : null}
    </div>
  );
};
