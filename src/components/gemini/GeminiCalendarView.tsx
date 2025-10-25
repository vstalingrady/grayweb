"use client";

import { useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import styles from "@/app/gemini/GeminiPageClient.module.css";
import { getWeekDays, isSameDay } from "@/lib/gemini/date";

type GeminiCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
};

type GeminiCalendarViewProps = {
  activeDate: Date;
  onNavigate: (action: "today" | "prev" | "next") => void;
  events: GeminiCalendarEvent[];
};

const hours = Array.from({ length: 24 }, (_, index) => index);

const formatLabel = (hour: number) => {
  if (hour === 0) {
    return "12 AM";
  }
  if (hour === 12) {
    return "12 PM";
  }
  if (hour > 12) {
    return `${hour - 12} PM`;
  }
  return `${hour} AM`;
};

const minutesFrom = (label: string) => {
  const date = new Date(label);
  return date.getHours() * 60 + date.getMinutes();
};

export function GeminiCalendarView({
  activeDate,
  onNavigate,
  events,
}: GeminiCalendarViewProps) {
  const week = useMemo(() => getWeekDays(activeDate), [activeDate]);
  const today = useMemo(() => new Date(), []);

  const eventLayouts = useMemo(() => {
    const byDay = new Map<string, GeminiCalendarEvent[]>();
    week.forEach((day) => {
      byDay.set(day.toDateString(), []);
    });
    events.forEach((event) => {
      const start = new Date(event.start);
      const key = start.toDateString();
      if (!byDay.has(key)) {
        byDay.set(key, []);
      }
      byDay.get(key)?.push(event);
    });

    return week.map((day) => {
      const dayEvents = byDay.get(day.toDateString()) ?? [];
      return dayEvents.map((event) => {
        const startMinutes = minutesFrom(event.start);
        const endMinutes = minutesFrom(event.end);
        const height = Math.max(64, ((endMinutes - startMinutes) / 60) * 52);
        const offset = (startMinutes / 60) * 52;
        return {
          event,
          style: {
            top: `${offset}px`,
            height: `${height}px`,
          },
        };
      });
    });
  }, [events, week]);

  return (
    <div className={styles.calendarFrame}>
      <div className={styles.calendarHeader}>
        <div className={styles.calendarToolbar}>
          <button type="button" className={styles.toggleButton} data-active="true">
            <Calendar size={16} />
            Week
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => onNavigate("today")}
          >
            Today
          </button>
          <div className={styles.calendarControls}>
            <button
              type="button"
              aria-label="Previous week"
              className={styles.toggleButton}
              onClick={() => onNavigate("prev")}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next week"
              className={styles.toggleButton}
              onClick={() => onNavigate("next")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className={styles.chip}>
          <Loader2 size={14} className={styles.chatSpinner} />
          Synced
        </div>
      </div>

      <div className={styles.calendarGrid}>
        <div className={styles.hoursColumn}>
          {hours.map((hour) => (
            <span key={`hour-${hour}`}>{formatLabel(hour)}</span>
          ))}
        </div>

        <div className={styles.daysGrid}>
          {week.map((day, dayIndex) => (
            <div key={day.toISOString()} className={styles.dayCell}>
              <div className={styles.dayHeader}>
                <div className={styles.dayName}>
                  {day.toLocaleDateString([], { weekday: "short" })}
                </div>
                <div
                  className={`${styles.dayBadge} ${
                    isSameDay(day, activeDate)
                      ? styles.dayBadgeActive
                      : isSameDay(day, today)
                        ? styles.dayBadgeToday
                        : ""
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>

              {hours.map((hour) => (
                <div key={`${day.toISOString()}-${hour}`} className={styles.gridRow} />
              ))}

              {eventLayouts[dayIndex]?.map(({ event, style }) => (
                <div key={event.id} className={styles.eventCard} style={style}>
                  <strong>{event.title}</strong>
                  <span>
                    {new Date(event.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(event.end).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {event.location ? <span>{event.location}</span> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
