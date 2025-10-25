export type CalendarEntryType = "event" | "task";

export interface CalendarInfo {
  id: string;
  label: string;
  color: string;
  isVisible: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  entryType: CalendarEntryType;
  description?: string;
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
