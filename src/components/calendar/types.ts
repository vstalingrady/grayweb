export type CalendarEntryType = "plan" | "event" | "task" | "reminder" | "habit";
export type CalendarEventDisplayHint = "line";

export interface CalendarInfo {
  id: string;
  label: string;
  color: string;
  isVisible: boolean;
}

import type { ReminderStatus } from "@/lib/api";

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  entryType: CalendarEntryType;
  description?: string;
  displayHint?: CalendarEventDisplayHint;
  reminderId?: number;
  reminderStatus?: ReminderStatus;
}

export interface PositionedEvent extends CalendarEvent {
  top: number;
  height: number;
  column: number;
  columnSpan: number;
  width: number;
  columnCount: number;
  zIndex: number;
}

export interface LayoutOptions {
  hourHeight: number;
  snapMinutes?: number;
  minimumHeight?: number;
  dayStart?: Date;
}

export interface EventDraft {
  id: string;
  start: Date;
  end: Date;
}
