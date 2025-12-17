"use client";

import Image from "next/image";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";

export const GrayStreamingSpinner = ({
  toolLabel,
}: {
  reasoningSeconds?: number | null; // Keep prop for compatibility but don't display
  toolLabel?: string | null;
}) => {
  const { t } = useI18n();
  return (
    <div className={styles.chatStreamingInline}>
      <Image
        src="/grayaiwhite.svg"
        alt={t("Gray logo")}
        width={18}
        height={18}
        className={styles.chatStreamingSpinner}
      />
      {toolLabel && <span className={styles.chatToolStatus}>{toolLabel}</span>}
    </div>
  );
};
