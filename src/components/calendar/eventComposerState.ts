import type { CalendarEntryType, CalendarEvent, CalendarEventDisplayHint } from "./types";
import { DEFAULT_COLORS, formatTimeInput } from "./eventComposerUtils";

export type EventComposerPayload = {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
  description?: string;
  displayHint?: CalendarEventDisplayHint;
  reminderMinutesBefore?: number | null;
  isCompleted?: boolean;
  recurrence?: string;
  habitId?: number;
  reminderAt?: string;
};

export type ComposerState = {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
  details: string;
  reminderMinutesBefore: number | null;
  isCompleted: boolean;
  recurrence: string | null;
  habitId: number | null;
  reminderAt: string | null;
};

export type ComposerAction =
  | { type: "reset"; payload: ComposerState }
  | { type: "update"; payload: Partial<ComposerState> };

export const DEFAULT_STATE: ComposerState = {
  title: "",
  startTime: "09:00",
  endTime: "10:00",
  color: DEFAULT_COLORS.event,
  entryType: "event",
  calendarId: "default",
  details: "",
  reminderMinutesBefore: null,
  isCompleted: false,
  recurrence: null,
  habitId: null,
  reminderAt: null,
};

export const DEFAULT_EVENT_DURATION_MINUTES = 60;

export const VISIBLE_ENTRY_TYPES: CalendarEntryType[] = ["plan", "habit", "event"];

export const ENTRY_TYPE_LABELS: Record<CalendarEntryType, string> = {
  event: "Event",
  task: "Task",
  plan: "Plans",
  habit: "Habits",
  reminder: "Reminder",
};

export const composerReducer = (state: ComposerState, action: ComposerAction): ComposerState => {
  switch (action.type) {
    case "reset":
      return action.payload;
    case "update":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

export const resolveStateFromEvent = (
  event: CalendarEvent,
  fallbackCalendarId: string,
): ComposerState => ({
  title: event.title,
  startTime: formatTimeInput(event.start),
  endTime: formatTimeInput(event.end),
  color: event.color,
  entryType: event.entryType ?? "event",
  calendarId: event.calendarId ?? fallbackCalendarId,
  details: event.description ?? "",
  reminderMinutesBefore:
    typeof event.reminderMinutesBefore === "number" ? event.reminderMinutesBefore : null,
  isCompleted: !!event.isCompleted,
  recurrence: event.recurrence ?? null,
  habitId: event.habitId ?? null,
  reminderAt: event.reminderAt ?? null,
});

