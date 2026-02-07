"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Atom, ChevronDown } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { MARKDOWN_PLUGINS } from "./markdown/plugins";

export const ThinkingBlock = ({
  content,
  markdownComponents,
  reasoningSeconds,
  isActivelyThinking,
  thinkingStartTime,
  isStreamingMessage,
}: {
  content: string;
  markdownComponents: Components;
  reasoningSeconds?: number | null;
  isActivelyThinking?: boolean;
  thinkingStartTime?: number | null;
  isStreamingMessage?: boolean;
}) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Live timer effect - updates every 100ms while actively thinking
  useEffect(() => {
    if (!isActivelyThinking || !thinkingStartTime) {
      return;
    }

    const interval = setInterval(() => {
      setLiveSeconds((Date.now() - thinkingStartTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [isActivelyThinking, thinkingStartTime]);

  // Format time display: "3.2 seconds" or "1:23.4" for longer durations
  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) {
      const unitKey = seconds >= 2 || seconds < 1 ? "seconds" : "second";
      return `${seconds.toFixed(1)} ${t(unitKey)}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  }, [t]);

  const timeLabel = useMemo(() => {
    // If actively thinking, show live timer
    if (isActivelyThinking && thinkingStartTime) {
      return t("Thinking for {time}", { time: formatTime(liveSeconds) });
    }
    // If we have a final duration, show it (even if still streaming content)
    if (typeof reasoningSeconds === "number" && reasoningSeconds > 0) {
      return t("Thought for {time}", { time: formatTime(reasoningSeconds) });
    }

    // Only show "Thinking" if purely streaming and no reasoning time yet
    if (isStreamingMessage) {
      return t("Thinking");
    }
    return t("Thought");
  }, [isActivelyThinking, thinkingStartTime, liveSeconds, reasoningSeconds, isStreamingMessage, t, formatTime]);

  return (
    <div className={styles.chatThinkingInline}>
      <button
        type="button"
        className={styles.chatThinkingInlineToggle}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? t("Collapse reasoning") : t("Expand reasoning")}
      >
        <div className={styles.chatThinkingInlineMeta}>
          <Atom size={14} className={styles.chatThinkingIcon} />
          <span className={styles.chatThinkingLabel}>{timeLabel}</span>
        </div>
        <ChevronDown
          size={14}
          className={`${styles.chatThinkingChevron} ${isExpanded ? styles.chatThinkingChevronExpanded : ""}`}
        />
      </button>
      {isExpanded ? (
        <blockquote className={styles.chatThinkingQuote}>
          <div className={styles.chatThinkingContent}>
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={MARKDOWN_PLUGINS}
              rehypePlugins={[[rehypeKatex, { strict: false }]]}
            >
              {content}
            </ReactMarkdown>
          </div>
        </blockquote>
      ) : null}
    </div>
  );
};
