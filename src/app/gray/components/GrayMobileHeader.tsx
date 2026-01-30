"use client";

import { Menu, MessageCircle, MessageSquarePlus, Zap, CalendarDays } from "lucide-react";

import styles from "./GrayMobileHeader.module.css";

type GrayMobileHeaderProps = {
  isSidebarExpanded: boolean;
  isPulseActive: boolean;
  activeDashboardTab: "pulse" | "calendar";
  showCalendarToggle: boolean;
  onToggleSidebar: () => void;
  onSelectChat: () => void;
  onSelectPulse: () => void;
  onSelectCalendar: () => void;
  onCreateNewChat: () => void;
};

export function GrayMobileHeader({
  isSidebarExpanded,
  isPulseActive,
  activeDashboardTab,
  showCalendarToggle,
  onToggleSidebar,
  onSelectChat,
  onSelectPulse,
  onSelectCalendar,
  onCreateNewChat,
}: GrayMobileHeaderProps) {
  const isCalendarActive = isPulseActive && activeDashboardTab === "calendar";
  const isPulseTabActive = isPulseActive && activeDashboardTab === "pulse";

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
          {showCalendarToggle ? (
            <button
              type="button"
              className={styles.mobileToggleOption}
              data-active={isCalendarActive ? "true" : "false"}
              onClick={onSelectCalendar}
            >
              <span className={styles.mobileToggleIcon}>
                <CalendarDays size={16} />
              </span>
              <span>Calendar</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.mobileHeaderRight}>
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
    </div>
  );
}
