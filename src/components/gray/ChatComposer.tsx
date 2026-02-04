"use client";

import { type ReactNode } from "react";
import { GrayChatBar, type GrayChatBarProps } from "./ChatBar";
import styles from "@/components/gray/chat/ChatComposerStyles.module.css";
import { useChatStore } from "./ChatProvider";
import { ModelSelector } from "./ModelSelector";

type GrayChatComposerProps = GrayChatBarProps & {
  showUnderline?: boolean;
  attachmentTray?: ReactNode;
};

const GrayChatComposerBase = ({
  showUnderline = false,
  attachmentTray,
  isSearchEnabled,
  ...rest
}: GrayChatComposerProps) => {
  const { autoWebSearchEnabled, webSearchEnabled } = useChatStore();
  const resolvedWebSearchEnabled =
    typeof isSearchEnabled === "boolean" ? isSearchEnabled : autoWebSearchEnabled || webSearchEnabled;

  return (
    <div
      className={styles.generalChatComposer}
      data-has-attachments={attachmentTray ? "true" : "false"}
    >
      <div className={styles.chatComposerSkirt} aria-hidden="true" />
      <div className={`${styles.chatBarRow} ${styles.generalChatBarRow}`}>
        <GrayChatBar
          {...rest}
          isSearchEnabled={resolvedWebSearchEnabled}
          modelSelector={<ModelSelector />}
          attachmentTray={attachmentTray}
        />
        {showUnderline ? <div className={styles.chatBarUnderline} aria-hidden="true" /> : null}
      </div>
    </div>
  );
};

export const GrayChatComposer = GrayChatComposerBase;
