"use client";

import { type ReactNode } from "react";
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
  showSelectedDateLabel?: boolean;
  showMonthNavigation?: boolean;
  showTodayButton?: boolean;
  onGoToday?: () => void;
  showCreateAction?: boolean;
  integrationActionLabel?: string;
  onIntegrationAction?: () => void;
  className?: string;
  showCalendarList?: boolean;
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
  showSelectedDateLabel = true,
  showMonthNavigation = false,
  showTodayButton = false,
  onGoToday,
  showCreateAction = false,
  integrationActionLabel = "Add Google Calendar integration",
  onIntegrationAction,
  className,
  showCalendarList = true,
  children,
}: CalendarSidebarProps) {
  const { t } = useI18n();
  const sidebarClassName = [styles.calendarSidebar, className]
    .filter(Boolean)
    .join(" ");
  const shouldShowMonthNav = Boolean(showMonthNavigation && onNavigate);
  const shouldShowToday = Boolean(showTodayButton && onGoToday);
  const shouldShowCreate = Boolean(showCreateAction);
  const shouldRenderHeaderActions =
    shouldShowMonthNav || shouldShowToday || shouldShowCreate;

  return (
    <aside className={sidebarClassName}>
      {showHeader ? (
        <header className={styles.calendarSidebarHeader}>
          {shouldRenderHeaderActions ? (
            <div className={styles.calendarSidebarHeaderActions} style={{ marginLeft: "auto" }}>
              {shouldShowMonthNav ? (
                <div className={styles.calendarSurfaceNavArrows}>
                  <button
                    type="button"
                    aria-label={t("Previous month")}
                    onClick={() => onNavigate?.(-1)}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("Next month")}
                    onClick={() => onNavigate?.(1)}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              ) : null}
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
        <MiniMonth
          referenceDate={monthDate}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

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
              {onIntegrationAction ? (
                <div className={styles.calendarSidebarIntegration}>
                  <button
                    type="button"
                    className={styles.calendarSidebarIntegrationButton}
                    onClick={onIntegrationAction}
                  >
                    {t(integrationActionLabel)}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        {children ? <div className={styles.calendarSidebarExtra}>{children}</div> : null}
      </div>
    </aside>
  );
}
