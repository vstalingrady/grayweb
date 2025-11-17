"use client";

import { type ReactNode } from "react";
import { GrayChatBar, type GrayChatBarProps } from "./ChatBar";
import styles from "@/app/gray/GrayPageClient.module.css";

type GrayChatComposerProps = GrayChatBarProps & {
  showUnderline?: boolean;
  attachmentTray?: ReactNode;
};

const GrayChatComposerBase = ({
  showUnderline = true,
  attachmentTray,
  ...rest
}: GrayChatComposerProps) => (
  <div
    className={styles.generalChatComposer}
    data-has-attachments={attachmentTray ? "true" : "false"}
  >
    <div className={`${styles.chatBarRow} ${styles.generalChatBarRow}`}>
      <GrayChatBar {...rest} />
      {showUnderline ? <div className={styles.chatBarUnderline} aria-hidden="true" /> : null}
    </div>
    {attachmentTray}
    <p className={styles.chatDisclaimer}>Gray can make mistakes. Check important info.</p>
  </div>
);

export const GrayChatComposer = GrayChatComposerBase;
