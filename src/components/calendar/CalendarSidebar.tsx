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
  integrationActionLabel?: string;
  onIntegrationAction?: () => void;
  className?: string;
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
  integrationActionLabel = "Add Google Calendar integration",
  onIntegrationAction,
  className,
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
        <div className={styles.calendarSidebarHeaderActions}>
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

        <section className={styles.calendarSidebarList}>
          <header>
            <span>My calendars</span>
            <button type="button">+</button>
          </header>
          <ul>
            {calendars.map((calendar) => (
              <li key={calendar.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={calendar.isVisible}
                    onChange={() => onToggleCalendar(calendar.id)}
                  />
                  <span
                    className={styles.calendarSidebarSwatch}
                    style={{ background: calendar.color }}
                    aria-hidden="true"
                  />
                  <span>{calendar.label}</span>
                </label>
              </li>
            ))}
            <li className={styles.calendarSidebarIntegration}>
              <button
                type="button"
                className={styles.calendarSidebarIntegrationButton}
                onClick={onIntegrationAction}
              >
                {integrationActionLabel}
              </button>
            </li>
          </ul>
        </section>
      </div>
    </aside>
  );
}
