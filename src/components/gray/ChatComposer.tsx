"use client";

import { type ReactNode, useState } from "react";
import { GrayChatBar, type GrayChatBarProps } from "./ChatBar";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useUser } from "@/contexts/UserContext";
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
  const { user } = useUser();
  const { reasoningMode, setReasoningMode, modelTier } = useChatStore();
  const [searchEnabled, setSearchEnabled] = useState(true);

  const planTier = (user?.plan_tier || "scout").toLowerCase();
  const isReasoningLocked = planTier === "scout" || modelTier === "lite";

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
          isSearchEnabled={searchEnabled}
          onToggleSearch={() => setSearchEnabled(!searchEnabled)}
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
