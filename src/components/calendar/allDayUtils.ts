import type { CalendarEvent } from "./types";
import { startOfDay } from "./dateUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

const isExactlyMidnight = (value: Date) =>
  value.getHours() === 0 &&
  value.getMinutes() === 0 &&
  value.getSeconds() === 0 &&
  value.getMilliseconds() === 0;

const isSameLocalDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const isAllDayCalendarEvent = (event: CalendarEvent) => {
  if (event.displayHint === "line" || event.entryType === "reminder") {
    return false;
  }

  const { start, end } = event;
  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) {
    return false;
  }

  if (isExactlyMidnight(start) && isExactlyMidnight(end)) {
    return true;
  }

  // Some providers export all-day events as 00:00 -> 23:59 on the same day.
  const isSingleDay = isSameLocalDate(start, end);
  const endsAtDayBoundary =
    end.getHours() === 23 &&
    end.getMinutes() >= 59 &&
    end.getSeconds() >= 0;
  if (isExactlyMidnight(start) && isSingleDay && endsAtDayBoundary) {
    return true;
  }

  // Guard for exact day-multiple durations even if millisecond math is used.
  return isExactlyMidnight(start) && durationMs >= DAY_MS && durationMs % DAY_MS === 0;
};

export const doesEventIntersectDay = (event: CalendarEvent, day: Date) => {
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return event.start < dayEnd && event.end > dayStart;
};

export const sortAllDayEvents = (events: CalendarEvent[]) =>
  [...events].sort((left, right) => {
    const startDifference = left.start.getTime() - right.start.getTime();
    if (startDifference !== 0) {
      return startDifference;
    }
    const endDifference = right.end.getTime() - left.end.getTime();
    if (endDifference !== 0) {
      return endDifference;
    }
    return left.title.localeCompare(right.title);
  });

