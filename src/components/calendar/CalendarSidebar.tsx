"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown } from "lucide-react";
import { CalendarInfo } from "./types";
import styles from "./GrayDashboardCalendar.module.css";
import { MiniMonth } from "./MiniMonth";
import { useI18n } from "@/contexts/I18nContext";

type CalendarSidebarProps = {
  monthDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onNavigate?: (offset: number) => void;
  calendars: CalendarInfo[];
  onToggleCalendar: (calendarId: string) => void;
  isCollapsed?: boolean;
  showHeader?: boolean;
  showMonthNavigation?: boolean;
  showTodayButton?: boolean;
  onGoToday?: () => void;
  showCreateAction?: boolean;
  onCreateAction?: () => void;
  integrationActionLabel?: string;
  onIntegrationAction?: () => void;
  className?: string;
  showCalendarList?: boolean;
  holidayEnabled?: boolean;
  holidayDateKeys?: ReadonlySet<string>;
  holidayNameByDateKey?: ReadonlyMap<string, string>;
  holidayDataLoading?: boolean;
  onHolidayEnabledChange?: (enabled: boolean) => void;
  children?: ReactNode;
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

export function CalendarSidebar({
  monthDate,
  selectedDate,
  onSelectDate,
  onNavigate,
  calendars,
  onToggleCalendar,
  isCollapsed,
  showHeader = true,
  showMonthNavigation = false,
  showTodayButton = false,
  onGoToday,
  showCreateAction = false,
  onCreateAction,
  integrationActionLabel = "Connect to Google Calendar",
  onIntegrationAction,
  className,
  showCalendarList = true,
  holidayEnabled = false,
  holidayDateKeys,
  holidayNameByDateKey,
  holidayDataLoading = false,
  onHolidayEnabledChange,
  children,
}: CalendarSidebarProps) {
  const { t } = useI18n();
  const sidebarClassName = [styles.calendarSidebar, className]
    .filter(Boolean)
    .join(" ");
  const shouldShowMonthNav = Boolean(showMonthNavigation && onNavigate);
  const shouldShowToday = Boolean(showTodayButton && onGoToday);
  const shouldShowCreate = Boolean(showCreateAction && onCreateAction);
  const shouldRenderHeaderActions = shouldShowToday || shouldShowCreate;

  return (
    <aside className={sidebarClassName}>
      {showHeader ? (
        <header className={styles.calendarSidebarHeader}>
          {shouldRenderHeaderActions ? (
            <div className={styles.calendarSidebarHeaderActions} style={{ marginLeft: "auto" }}>
              {shouldShowToday ? (
                <button
                  type="button"
                  className={styles.calendarSurfaceButton}
                  onClick={() => onGoToday?.()}
                >
                  {t("Today")}
                </button>
              ) : null}
              {shouldShowCreate ? (
                <button
                  type="button"
                  className={styles.calendarSidebarCreate}
                  onClick={() => onCreateAction?.()}
                >
                  + {t("Create")}
                </button>
              ) : null}
            </div>
          ) : null}
        </header>
      ) : null}

      <div
        className={styles.calendarSidebarContent}
        data-visible={isCollapsed ? "false" : "true"}
      >
        <div className={styles.calendarSidebarMonthRow}>
          <span className={styles.calendarSidebarMonthLabel}>{formatMonthLabel(monthDate)}</span>
          {shouldShowMonthNav ? (
            <div className={styles.calendarSurfaceNavArrows}>
              <button
                type="button"
                aria-label={t("Previous month")}
                title={t("Previous month")}
                onClick={() => onNavigate?.(-1)}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                aria-label={t("Next month")}
                title={t("Next month")}
                onClick={() => onNavigate?.(1)}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          ) : null}
        </div>

        <MiniMonth
          referenceDate={monthDate}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          holidayDateKeys={holidayDateKeys}
          holidayNameByDateKey={holidayNameByDateKey}
        />

        <section className={styles.calendarSidebarHolidayPanel}>
          <label className={styles.calendarSidebarHolidayToggle}>
            <input
              type="checkbox"
              checked={holidayEnabled}
              onChange={(event) => onHolidayEnabledChange?.(event.target.checked)}
            />
            <span>{t("Public holidays")}</span>
          </label>
          {holidayEnabled && holidayDataLoading ? (
            <span className={styles.calendarSidebarHolidayStatus}>{t("Loading holidays...")}</span>
          ) : null}
        </section>

        {onIntegrationAction ? (
          <div className={styles.calendarSidebarIntegration}>
            <button
              type="button"
              className={styles.calendarSidebarIntegrationButton}
              onClick={onIntegrationAction}
            >
              <Image
                className={styles.calendarSidebarIntegrationLogo}
                src="/logos/google-calendar.svg"
                alt=""
                aria-hidden="true"
                loading="lazy"
                width={20}
                height={20}
              />
              <span className={styles.calendarSidebarIntegrationText}>
                {t(integrationActionLabel)}
              </span>
            </button>
          </div>
        ) : null}

        {showCalendarList ? (
          <section className={styles.calendarSidebarList}>
            <div className={styles.calendarSidebarListBody}>
              {calendars.map((calendar) => (
                <div key={calendar.id} className={styles.calendarSidebarItemWrapper}>
                  <button
                    type="button"
                    className={styles.calendarSidebarChip}
                    aria-pressed={calendar.isVisible ? "true" : "false"}
                    onClick={() => onToggleCalendar(calendar.id)}
                  >
                    <span
                      className={styles.calendarSidebarSwatch}
                      style={{ background: calendar.color }}
                      aria-hidden="true"
                    />
                    <span>{calendar.label}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {children ? <div className={styles.calendarSidebarExtra}>{children}</div> : null}
      </div>
    </aside>
  );
}
