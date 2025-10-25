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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
}: CalendarSidebarProps) {
  return (
    <aside
      className={styles.calendarSidebar}
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      <header className={styles.calendarSidebarHeader}>
        <div>
          <span className={styles.calendarSidebarEyebrow}>Calendars</span>
          <h2>{formatMonthLabel(monthDate)}</h2>
        </div>
        <button
          type="button"
          className={styles.calendarSidebarToggle}
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </header>

      <div className={styles.calendarSidebarContent} data-visible={isCollapsed ? "false" : "true"}>
        <div className={styles.calendarSidebarNavRow}>
          <button type="button" onClick={() => onNavigateMonth(-1)}>
            Prev
          </button>
          <button type="button" onClick={() => onNavigateMonth(1)}>
            Next
          </button>
        </div>

        <MiniMonth
          referenceDate={monthDate}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

        <section className={styles.calendarSidebarList}>
          <h3>My calendars</h3>
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
          </ul>
        </section>
      </div>
    </aside>
  );
}

