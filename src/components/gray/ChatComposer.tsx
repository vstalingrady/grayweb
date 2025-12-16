"use client";

import { type ReactNode } from "react";
import { GrayChatBar, type GrayChatBarProps } from "./ChatBar";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useUser } from "@/contexts/UserContext";
import { useChatStore } from "./ChatProvider";
import { ModelSelector } from "./ModelSelector";
import { normalizePlanTier } from "@/components/gray/utils/helperFunctions";

type GrayChatComposerProps = GrayChatBarProps & {
  showUnderline?: boolean;
  attachmentTray?: ReactNode;
};

const GrayChatComposerBase = ({
  showUnderline = false,
  attachmentTray,
  ...rest
}: GrayChatComposerProps) => {
  const { user } = useUser();
  const { reasoningMode, setReasoningMode, autoWebSearchEnabled, webSearchEnabled, toggleWebSearchEnabled } =
    useChatStore();

  const planTier = normalizePlanTier(user);
  const isReasoningLocked = planTier === "scout";
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
          isReasoningEnabled={reasoningMode}
          onToggleReasoning={() => setReasoningMode(!reasoningMode)}
          isReasoningLocked={isReasoningLocked}
          isSearchEnabled={isWebSearchEnabled}
          onToggleSearch={toggleWebSearchEnabled}
          modelSelector={<ModelSelector />}
          onPasteFiles={rest.onPasteFiles}
          attachmentTray={attachmentTray}
        />
        {showUnderline ? <div className={styles.chatBarUnderline} aria-hidden="true" /> : null}
      </div>
    </div>
  );
};

export const GrayChatComposer = GrayChatComposerBase;
