"use client";

import { Menu, MessageCircle, Zap } from "lucide-react";

import styles from "./GrayMobileHeader.module.css";

type GrayMobileHeaderProps = {
  isSidebarExpanded: boolean;
  isPulseActive: boolean;
  onToggleSidebar: () => void;
  onSelectChat: () => void;
  onSelectPulse: () => void;
};

export function GrayMobileHeader({
  isSidebarExpanded,
  isPulseActive,
  onToggleSidebar,
  onSelectChat,
  onSelectPulse,
}: GrayMobileHeaderProps) {
  return (
    <div
      className={styles.mobileHeader}
      data-sidebar-expanded={isSidebarExpanded ? "true" : undefined}
    >
      <div className={styles.mobileHeaderLeft}>
        {!isSidebarExpanded ? (
          <button type="button" className={styles.mobileMenuButton} onClick={onToggleSidebar}>
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
            data-active={isPulseActive ? "true" : "false"}
            onClick={onSelectPulse}
          >
            <span className={styles.mobileToggleIcon}>
              <Zap size={16} />
            </span>
            <span>Pulse</span>
          </button>
        </div>
      </div>
    </div>
  );
}
