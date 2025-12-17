"use client";

import { type ReactNode } from "react";
import { GrayChatBar, type GrayChatBarProps } from "./ChatBar";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useChatStore } from "./ChatProvider";
import { ModelSelector } from "./ModelSelector";

type GrayChatComposerProps = GrayChatBarProps & {
  showUnderline?: boolean;
  attachmentTray?: ReactNode;
};

const GrayChatComposerBase = ({
  showUnderline = false,
  attachmentTray,
  ...rest
}: GrayChatComposerProps) => {
  const { autoWebSearchEnabled, webSearchEnabled } = useChatStore();
  const isWebSearchEnabled = autoWebSearchEnabled || webSearchEnabled;

  return (
    <div
      className={styles.generalChatComposer}
      data-has-attachments={attachmentTray ? "true" : "false"}
    >
      <div className={styles.chatComposerSkirt} aria-hidden="true" />
      <div className={`${styles.chatBarRow} ${styles.generalChatBarRow}`}>
        <GrayChatBar
          {...rest}
          isSearchEnabled={isWebSearchEnabled}
          modelSelector={<ModelSelector />}
          attachmentTray={attachmentTray}
        />
        {showUnderline ? <div className={styles.chatBarUnderline} aria-hidden="true" /> : null}
      </div>
    </div>
  );
};

export const GrayChatComposer = GrayChatComposerBase;
