import { useMemo } from "react";
import styles from "@/app/gray/GrayPageClient.module.css";

type CalendarColor =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quaternary"
  | "quinary";

type CalendarListItem = {
  id: string;
  label: string;
  color?: CalendarColor;
  checked?: boolean;
};

type CalendarListGroup = {
  id: string;
  title: string;
  items: CalendarListItem[];
};

type GrayCalendarViewProps = {
  currentDate: Date;
};

type MiniCalendarDay = {
  key: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
};

const CALENDAR_GROUPS: CalendarListGroup[] = [
  {
    id: "booking",
    title: "Booking pages",
    items: [
      { id: "create", label: "Create new", color: "primary", checked: true },
    ],
  },
  {
    id: "my",
    title: "My calendars",
    items: [
      { id: "owner", label: "V. Stalingrady", color: "secondary", checked: true },
      { id: "birthdays", label: "Birthdays", color: "tertiary" },
      { id: "family", label: "Family", color: "quaternary", checked: true },
      { id: "tasks", label: "Tasks", color: "quinary" },
    ],
  },
  {
    id: "other",
    title: "Other calendars",
    items: [
      { id: "browse", label: "Browse resources" },
      { id: "shared", label: "Shared team" },
    ],
  },
];

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatDayNumber = (date: Date) =>
  date.getDate().toString().padStart(2, "0");

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildMiniCalendarWeeks = (reference: Date): MiniCalendarDay[][] => {
  const today = new Date();
  const year = reference.getFullYear();
  const month = reference.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthStartWeekday = monthStart.getDay();
  const gridStart = new Date(
    year,
    month,
    1 - monthStartWeekday,
    0,
    0,
    0,
    0
  );

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const offset = weekIndex * 7 + dayIndex;
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + offset);

      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        date,
        inMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
      };
    })
  );
};

const buildWeekRange = (reference: Date) => {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const HOURS = Array.from({ length: 24 }, (_, index) => index);

export function GrayCalendarView({ currentDate }: GrayCalendarViewProps) {
  const miniWeeks = useMemo(
    () => buildMiniCalendarWeeks(currentDate),
    [currentDate]
  );
  const weekDays = useMemo(() => buildWeekRange(currentDate), [currentDate]);
  const monthLabel = MONTH_NAMES[currentDate.getMonth()];
  const yearLabel = currentDate.getFullYear();

  return (
    <section className={styles.dashboardCalendarLayout}>
      <aside className={styles.dashboardCalendarSidebar}>
        <header className={styles.dashboardCalendarSidebarHeader}>
          <div>
            <span className={styles.calendarSidebarEyebrow}>Calendar</span>
            <h2>
              {monthLabel} {yearLabel}
            </h2>
          </div>
          <button type="button">+ Create</button>
        </header>

        <div className={styles.dashboardMiniCalendar}>
          <div className={styles.dashboardMiniCalendarWeekdays}>
            {WEEKDAY_SHORT.map((weekday) => (
              <span key={weekday}>{weekday[0]}</span>
            ))}
          </div>
          <div className={styles.dashboardMiniCalendarGrid}>
            {miniWeeks.map((week, index) => (
              <div key={index} className={styles.dashboardMiniCalendarRow}>
                {week.map((day) => (
                  <span
                    key={day.key}
                    className={styles.dashboardMiniCalendarCell}
                    data-active={day.inMonth ? "true" : "false"}
                    data-today={day.isToday ? "true" : "false"}
                  >
                    {day.inMonth ? day.date.getDate() : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.calendarSidebarSearch}>
          <input
            type="search"
            placeholder="Search for people"
            aria-label="Search for people"
          />
        </div>

        <div className={styles.calendarSidebarSectionList}>
          {CALENDAR_GROUPS.map((group) => (
            <section key={group.id}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        defaultChecked={Boolean(item.checked)}
                      />
                      <span className={styles.calendarSidebarCheckbox} />
                      {item.color ? (
                        <span
                          className={styles.calendarSidebarColor}
                          data-variant={item.color}
                        />
                      ) : (
                        <span className={styles.calendarSidebarColorPlaceholder} />
                      )}
                      <span className={styles.calendarSidebarLabel}>
                        {item.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>

      <div className={styles.dashboardCalendarBoard}>
        <header className={styles.calendarBoardHeader}>
          <div>
            <span className={styles.calendarBoardEyebrow}>Week</span>
            <h3>
              {MONTH_NAMES[weekDays[0].getMonth()]} {formatDayNumber(weekDays[0])} —{" "}
              {MONTH_NAMES[weekDays[6].getMonth()]} {formatDayNumber(weekDays[6])},{" "}
              {weekDays[6].getFullYear()}
            </h3>
          </div>
          <div className={styles.calendarBoardActions}>
            <button type="button">Week</button>
            <button type="button">Today</button>
          </div>
        </header>

        <div className={styles.calendarBoardGrid}>
          <div className={styles.calendarBoardWeekdays}>
            <span />
            {weekDays.map((day) => (
              <span key={day.toISOString()}>
                <strong>{WEEKDAY_SHORT[day.getDay()].toUpperCase()}</strong>
                <span>{day.getDate()}</span>
              </span>
            ))}
          </div>
          <div className={styles.calendarBoardBody}>
            <div className={styles.calendarBoardTimes}>
              {HOURS.map((hour) => (
                <span key={hour}>
                  {hour === 0
                    ? "12 AM"
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? "12 PM"
                    : `${hour - 12} PM`}
                </span>
              ))}
            </div>
            <div className={styles.calendarBoardColumns}>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className={styles.calendarBoardColumn}>
                  {HOURS.map((hour) => (
                    <span key={`${day.toISOString()}-${hour}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

