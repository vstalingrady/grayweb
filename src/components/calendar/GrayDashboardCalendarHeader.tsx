import type { ChangeEvent } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { useI18n } from "@/contexts/I18nContext";

type CalendarViewMode = "week" | "day";

type GrayDashboardCalendarHeaderProps = {
  dashboardTab: "pulse" | "calendar";
  onSelectDashboardTab?: (tab: "pulse" | "calendar") => void;
  showSurfaceLabel: boolean;
  showSurfaceHeading: boolean;
  showHeaderDates: boolean;
  showNavigationControls: boolean;
  showTodayControl: boolean;
  showViewSelect: boolean;
  hasHeaderRight: boolean;
  rangeLabel: string;
  viewMode: CalendarViewMode;
  onMainMonthNavigate: (offset: number) => void;
  onGoToday: () => void;
  onViewModeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
};

export function GrayDashboardCalendarHeader({
  dashboardTab,
  onSelectDashboardTab,
  showSurfaceLabel,
  showSurfaceHeading,
  showHeaderDates,
  showNavigationControls,
  showTodayControl,
  showViewSelect,
  hasHeaderRight,
  rangeLabel,
  viewMode,
  onMainMonthNavigate,
  onGoToday,
  onViewModeChange,
}: GrayDashboardCalendarHeaderProps) {
  const { t } = useI18n();
  const shouldShowDashboardToggle = typeof onSelectDashboardTab === "function";

  return (
    <header className={styles.calendarSurfaceHeader}>
      <div className={styles.calendarSurfaceHeaderLeft}>
        {shouldShowDashboardToggle ? (
          <div className={styles.calendarSurfaceHeadingGroup}>
            <div className={styles.calendarSurfaceTabs}>
              <button
                type="button"
                className={styles.calendarSurfaceTab}
                data-active={dashboardTab === "pulse"}
                aria-pressed={dashboardTab === "pulse"}
                onClick={() => onSelectDashboardTab?.("pulse")}
              >
                {t("Pulse")}
              </button>
              <button
                type="button"
                className={styles.calendarSurfaceTab}
                data-active={dashboardTab === "calendar"}
                aria-pressed={dashboardTab === "calendar"}
                onClick={() => onSelectDashboardTab?.("calendar")}
              >
                {t("Calendar")}
              </button>
            </div>
          </div>
        ) : null}
        {showSurfaceHeading ? (
          <>
            {showSurfaceLabel ? (
              <span className={styles.calendarSurfaceLabel}>{t("Calendar")}</span>
            ) : null}
            <div className={styles.calendarSurfaceTitleRow}>
              {showNavigationControls ? (
                <div className={styles.calendarSurfaceNavArrows}>
                  <button
                    type="button"
                    aria-label={t("Previous month")}
                    onClick={() => onMainMonthNavigate(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label={t("Next month")}
                    onClick={() => onMainMonthNavigate(1)}
                  >
                    ›
                  </button>
                </div>
              ) : null}
            </div>
            {showHeaderDates ? <p className={styles.calendarSurfaceRange}>{rangeLabel}</p> : null}
          </>
        ) : null}
      </div>
      {hasHeaderRight ? (
        <div className={styles.calendarSurfaceHeaderRight}>
          <div className={styles.calendarSurfaceNav}>
            {showNavigationControls ? (
              <div className={styles.calendarSurfaceNavArrows} style={{ display: "none" }}>
                {/* Hidden here, moved to left */}
              </div>
            ) : null}
            {showTodayControl ? (
              <button type="button" className={styles.calendarSurfaceButton} onClick={onGoToday}>
                {t("Today")}
              </button>
            ) : null}
            {showViewSelect ? (
              <select
                className={styles.calendarViewSelect}
                value={viewMode}
                onChange={onViewModeChange}
              >
                <option value="week">{t("Week")}</option>
                <option value="day">{t("Day")}</option>
              </select>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

