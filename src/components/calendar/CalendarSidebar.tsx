import { type ReactNode } from "react";
import { CalendarInfo } from "./types";
import styles from "./GrayDashboardCalendar.module.css";
import { MiniMonth } from "./MiniMonth";

type CalendarSidebarProps = {
  monthDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onNavigateMonth?: (offset: number) => void;
  calendars: CalendarInfo[];
  onToggleCalendar: (calendarId: string) => void;
  isCollapsed?: boolean;
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
  onNavigateMonth,
  calendars,
  onToggleCalendar,
  isCollapsed,
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
  const sidebarClassName = [styles.calendarSidebar, className]
    .filter(Boolean)
    .join(" ");
  const shouldShowMonthNav = Boolean(showMonthNavigation && onNavigateMonth);
  const shouldShowToday = Boolean(showTodayButton && onGoToday);
  const shouldShowCreate = Boolean(showCreateAction);
  const shouldRenderHeaderActions =
    shouldShowMonthNav || shouldShowToday || shouldShowCreate;

  return (
    <aside className={sidebarClassName}>
      <header className={styles.calendarSidebarHeader}>
        <div>

          <h2>{formatMonthLabel(monthDate)}</h2>
          {showSelectedDateLabel ? (
            <span className={styles.calendarSidebarSubhead}>
              {selectedDate.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
        {shouldRenderHeaderActions ? (
          <div className={styles.calendarSidebarHeaderActions}>
            {shouldShowMonthNav ? (
              <div className={styles.calendarSurfaceNavArrows}>
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => onNavigateMonth?.(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => onNavigateMonth?.(1)}
                >
                  ›
                </button>
              </div>
            ) : null}
            {shouldShowToday ? (
              <button
                type="button"
                className={styles.calendarSurfaceButton}
                onClick={() => onGoToday?.()}
              >
                Today
              </button>
            ) : null}
            {shouldShowCreate ? (
              <button
                type="button"
                className={styles.calendarSidebarCreate}
              >
                + Create
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

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
            <ul>
              {calendars.map((calendar) => (
                <li key={calendar.id}>
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
                </li>
              ))}
              {/* {onIntegrationAction ? (
                <li className={styles.calendarSidebarIntegration}>
                  <button
                    type="button"
                    className={styles.calendarSidebarIntegrationButton}
                    onClick={onIntegrationAction}
                  >
                    {integrationActionLabel}
                  </button>
                </li>
              ) : null} */}
            </ul>
          </section>
        ) : null}
        {children ? <div className={styles.calendarSidebarExtra}>{children}</div> : null}
      </div>
    </aside>
  );
}
