import { type ReactNode } from "react";
import { CalendarInfo } from "./types";
import styles from "./GrayDashboardCalendar.module.css";
import { MiniMonth } from "./MiniMonth";

type CalendarSidebarProps = {
  monthDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onNavigateMonth: (offset: number) => void;
  calendars: CalendarInfo[];
  onToggleCalendar: (calendarId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  showSelectedDateLabel?: boolean;
  showCreateAction?: boolean;
  showMonthNavigation?: boolean;
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
  onToggleCollapse,
  showSelectedDateLabel = true,
  showCreateAction = true,
  showMonthNavigation = true,
  integrationActionLabel = "Add Google Calendar integration",
  onIntegrationAction,
  className,
  showCalendarList = true,
  children,
}: CalendarSidebarProps) {
  const sidebarClassName = [styles.calendarSidebar, className]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClassName}>
      <header className={styles.calendarSidebarHeader}>
        <div>
          <span className={styles.calendarSidebarEyebrow}>Calendar</span>
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
        {(showMonthNavigation || showCreateAction || onToggleCollapse) && (
          <div className={styles.calendarSidebarHeaderActions}>
            {showMonthNavigation && (
              <>
                <button
                  type="button"
                  aria-label="Show previous month"
                  onClick={() => onNavigateMonth(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Show next month"
                  onClick={() => onNavigateMonth(1)}
                >
                  ›
                </button>
              </>
            )}
            {showCreateAction && (
              <button type="button" className={styles.calendarSidebarCreate}>
                + Create
              </button>
            )}
            {onToggleCollapse && (
              <button
                type="button"
                className={styles.calendarSidebarCollapse}
                aria-pressed={isCollapsed ? "true" : "false"}
                onClick={onToggleCollapse}
              >
                {isCollapsed ? "Expand" : "Collapse"}
              </button>
            )}
          </div>
        )}
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
            <header>
              <span>My calendars</span>
              <button type="button">+</button>
            </header>
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
              {onIntegrationAction ? (
                <li className={styles.calendarSidebarIntegration}>
                  <button
                    type="button"
                    className={styles.calendarSidebarIntegrationButton}
                    onClick={onIntegrationAction}
                  >
                    {integrationActionLabel}
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
        {children ? <div className={styles.calendarSidebarExtra}>{children}</div> : null}
      </div>
    </aside>
  );
}
