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
    <aside className={styles.calendarSidebar}>
      <header className={styles.calendarSidebarHeader}>
        <div>
          <span className={styles.calendarSidebarEyebrow}>Calendar</span>
          <h2>{formatMonthLabel(monthDate)}</h2>
          <span className={styles.calendarSidebarSubhead}>
            {selectedDate.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <div className={styles.calendarSidebarHeaderActions}>
          <button type="button" onClick={() => onNavigateMonth(-1)}>
            Prev
          </button>
          <button type="button" onClick={() => onNavigateMonth(1)}>
            Next
          </button>
          <button type="button" className={styles.calendarSidebarCreate}>+ Create</button>
        </div>
      </header>

      <div className={styles.calendarSidebarContent}>
        <MiniMonth
          referenceDate={monthDate}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

        <div className={styles.calendarSidebarMeta}>
          <span>Time</span>
          <strong>{`GMT${Intl.DateTimeFormat().resolvedOptions().timeZone}`}</strong>
        </div>

        <div className={styles.calendarSidebarSearch}>
          <input
            type="search"
            placeholder="Search for people"
            onChange={() => {}}
          />
        </div>

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
          </ul>
        </section>

        <section className={styles.calendarSidebarList}>
          <header>
            <span>Other calendars</span>
            <button type="button">+</button>
          </header>
          <ul>
            <li>
              <label>
                <input type="checkbox" />
                <span className={styles.calendarSidebarSwatch} />
                <span>Browse resources</span>
              </label>
            </li>
          </ul>
        </section>

        <footer className={styles.calendarSidebarFooter}>
          <button type="button">Terms</button>
          <button type="button">Privacy</button>
        </footer>
      </div>
    </aside>
  );
}
