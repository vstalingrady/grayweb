import { useMemo } from "react";

import styles from "./GrayDashboardCalendar.module.css";

type MiniMonthProps = {
  referenceDate: Date;
  selectedDate: Date;
  onSelectDate: (nextDate: Date) => void;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfMonth = (value: Date) => {
  const result = new Date(value);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

const startOfGrid = (value: Date) => {
  const result = startOfMonth(value);
  const weekday = result.getDay();
  result.setDate(result.getDate() - weekday);
  return result;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function MiniMonth({ referenceDate, selectedDate, onSelectDate }: MiniMonthProps) {
  const grid = useMemo(() => {
    const firstVisible = startOfGrid(referenceDate);
    return Array.from({ length: 6 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(firstVisible);
        date.setDate(firstVisible.getDate() + weekIndex * 7 + dayIndex);
        return date;
      })
    );
  }, [referenceDate]);

  const currentMonth = referenceDate.getMonth();
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  return (
    <div className={styles.miniMonth}>
      <div className={styles.miniMonthWeekdays}>
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={weekday}>{weekday[0]}</span>
        ))}
      </div>
      <div className={styles.miniMonthGrid}>
        {grid.map((week, index) => (
          <div key={index} className={styles.miniMonthRow}>
            {week.map((date) => {
              const inMonth = date.getMonth() === currentMonth;
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={styles.miniMonthCell}
                  data-active={inMonth ? "true" : "false"}
                  data-selected={isSelected ? "true" : "false"}
                  data-today={isToday ? "true" : "false"}
                  onClick={() => onSelectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

