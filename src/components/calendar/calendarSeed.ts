import type { CalendarEvent, CalendarInfo } from "./types";

export const createSeedCalendars = (): CalendarInfo[] => [
  {
    id: "default",
    label: "Operations",
    color: "linear-gradient(135deg, #5b8def, #304ffe)",
    isVisible: true,
  },
  {
    id: "team",
    label: "Team",
    color: "linear-gradient(135deg, #ff7d9d, #ff14c6)",
    isVisible: true,
  },
  {
    id: "personal",
    label: "Personal",
    color: "linear-gradient(135deg, #20d39c, #0c9f6f)",
    isVisible: true,
  },
];

const event = (
  id: string,
  calendarId: string,
  title: string,
  startISO: string,
  endISO: string,
  color: string,
  entryType: "event" | "task" = "event"
): CalendarEvent => ({
  id,
  calendarId,
  title,
  start: new Date(startISO),
  end: new Date(endISO),
  color,
  entryType,
});

export const createSeedEvents = (): CalendarEvent[] => [
  event(
    "event-1",
    "default",
    "Builder cohort sync",
    "2025-10-25T08:30:00",
    "2025-10-25T09:15:00",
    "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))"
  ),
  event(
    "event-2",
    "default",
    "Proactivity instrumentation review",
    "2025-10-25T11:00:00",
    "2025-10-25T12:00:00",
    "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))"
  ),
  event(
    "event-3",
    "default",
    "Pulse QA slot",
    "2025-10-25T15:30:00",
    "2025-10-25T16:00:00",
    "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))"
  ),
  event(
    "event-4",
    "default",
    "Alignment recap + journaling",
    "2025-10-25T19:00:00",
    "2025-10-25T19:45:00",
    "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))"
  ),
  event(
    "event-5",
    "team",
    "Design review",
    "2025-10-24T11:00:00",
    "2025-10-24T12:00:00",
    "linear-gradient(135deg, rgba(255, 125, 157, 0.85), rgba(255, 20, 198, 0.9))"
  ),
  event(
    "event-6",
    "personal",
    "Run club",
    "2025-10-23T07:30:00",
    "2025-10-23T08:15:00",
    "linear-gradient(135deg, rgba(32, 211, 156, 0.9), rgba(12, 159, 111, 0.9))",
    "task"
  ),
];
