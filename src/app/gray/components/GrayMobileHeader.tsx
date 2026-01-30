"use client";

import { Menu, MessageCircle, MessageSquarePlus, Zap } from "lucide-react";
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
  const { t } = useI18n();
  const isPulseTabActive = isPulseActive;
  const showStreak = typeof streakCount === "number" && streakCount > 0;
  const streakLabel = showStreak ? t("{count} day streak", { count: streakCount }) : "";

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
          <div className={styles.mobileToggle}>
            <button
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
              <span className={styles.mobileStreakCount}>{streakCount}d</span>
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
