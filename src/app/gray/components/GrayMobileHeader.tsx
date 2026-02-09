"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Flame, Menu, MessageCircle, MessageSquarePlus, Zap } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

import styles from "./GrayMobileHeader.module.css";

type GrayMobileHeaderProps = {
  isSidebarExpanded: boolean;
  isPulseActive: boolean;
  hideControls?: boolean;
  streakCount?: number | null;
  onToggleSidebar: () => void;
  onSelectChat: () => void;
  onSelectPulse: () => void;
  onCreateNewChat: () => void;
};

export function GrayMobileHeader({
  isSidebarExpanded,
  isPulseActive,
  hideControls = false,
  streakCount = null,
  onToggleSidebar,
  onSelectChat,
  onSelectPulse,
  onCreateNewChat,
}: GrayMobileHeaderProps) {
  const UNDERLINE_WIDTH_PX = 34;
  const { t } = useI18n();
  const isPulseTabActive = isPulseActive;
  const activeHeaderTab = isPulseTabActive ? "pulse" : "chat";
  const showStreak = typeof streakCount === "number" && streakCount > 0;
  const streakLabel = showStreak ? t("{count} day streak", { count: streakCount }) : "";
  const mobileToggleRef = useRef<HTMLDivElement | null>(null);
  const chatToggleRef = useRef<HTMLButtonElement | null>(null);
  const pulseToggleRef = useRef<HTMLButtonElement | null>(null);
  const [underlineX, setUnderlineX] = useState(0);

  const updateUnderlinePosition = useCallback(() => {
    if (hideControls) {
      return;
    }

    const toggleElement = mobileToggleRef.current;
    const activeButton = isPulseTabActive ? pulseToggleRef.current : chatToggleRef.current;
    if (!toggleElement || !activeButton) {
      return;
    }

    const toggleRect = toggleElement.getBoundingClientRect();
    const activeRect = activeButton.getBoundingClientRect();
    const centeredOffset = activeRect.left - toggleRect.left + activeRect.width / 2 - UNDERLINE_WIDTH_PX / 2;
    setUnderlineX(Math.max(0, centeredOffset));
  }, [hideControls, isPulseTabActive]);

  useEffect(() => {
    updateUnderlinePosition();
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(updateUnderlinePosition);
    window.addEventListener("resize", updateUnderlinePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateUnderlinePosition);
    };
  }, [updateUnderlinePosition, isSidebarExpanded]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateUnderlinePosition();
    });

    if (mobileToggleRef.current) {
      observer.observe(mobileToggleRef.current);
    }
    if (chatToggleRef.current) {
      observer.observe(chatToggleRef.current);
    }
    if (pulseToggleRef.current) {
      observer.observe(pulseToggleRef.current);
    }

    return () => observer.disconnect();
  }, [updateUnderlinePosition]);

  const mobileToggleStyle = {
    "--mobile-toggle-underline-x": `${underlineX}px`,
  } as CSSProperties;

  return (
    <div
      className={styles.mobileHeader}
      data-sidebar-expanded={isSidebarExpanded ? "true" : undefined}
    >
      <div className={styles.mobileHeaderLeft}>
        {!isSidebarExpanded ? (
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={onToggleSidebar}
            aria-label="Open menu"
            title="Open menu"
          >
            <Menu size={24} />
          </button>
        ) : null}
      </div>

      {!hideControls ? (
        <div className={styles.mobileHeaderToggle}>
          <div
            ref={mobileToggleRef}
            className={styles.mobileToggle}
            data-active-tab={activeHeaderTab}
            style={mobileToggleStyle}
          >
            <span className={styles.mobileToggleActiveUnderline} aria-hidden="true" />
            <button
              ref={chatToggleRef}
              type="button"
              className={styles.mobileToggleOption}
              data-active={!isPulseActive ? "true" : "false"}
              onClick={onSelectChat}
            >
              <span className={styles.mobileToggleIcon}>
                <MessageCircle size={16} />
              </span>
              <span>Chat</span>
            </button>
            <button
              ref={pulseToggleRef}
              type="button"
              className={styles.mobileToggleOption}
              data-active={isPulseTabActive ? "true" : "false"}
              onClick={onSelectPulse}
            >
              <span className={styles.mobileToggleIcon}>
                <Zap size={16} />
              </span>
              <span>Pulse</span>
            </button>
          </div>
        </div>
      ) : null}

      {!hideControls ? (
        <div className={styles.mobileHeaderRight}>
          {showStreak ? (
            <div className={styles.mobileStreakBadge} aria-label={streakLabel} title={streakLabel}>
              <Flame size={14} className={styles.mobileStreakIcon} aria-hidden="true" />
              <span className={styles.mobileStreakCount}>{streakCount}</span>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.mobileNewChatButton}
            onClick={onCreateNewChat}
            aria-label="New chat"
            title="New chat"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
