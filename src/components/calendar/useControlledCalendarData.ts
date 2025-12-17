"use client";

import { useCallback, useState } from "react";

import { createSeedCalendars, createSeedEvents } from "./calendarSeed";
import type { CalendarEvent, CalendarInfo } from "./types";

type UseControlledCalendarDataOptions = {
  calendars?: CalendarInfo[];
  events?: CalendarEvent[];
  onCalendarsChange?: (calendars: CalendarInfo[]) => void;
  onEventsChange?: (events: CalendarEvent[]) => void;
};

export const useControlledCalendarData = ({
  calendars: externalCalendars,
  events: externalEvents,
  onCalendarsChange,
  onEventsChange,
}: UseControlledCalendarDataOptions) => {
  const [calendarsState, setCalendarsState] = useState<CalendarInfo[]>(createSeedCalendars);
  const [eventsState, setEventsState] = useState<CalendarEvent[]>(createSeedEvents);

  const calendars = externalCalendars ?? calendarsState;
  const events = externalEvents ?? eventsState;

  const updateCalendars = useCallback(
    (updater: (previous: CalendarInfo[]) => CalendarInfo[]) => {
      if (externalCalendars && onCalendarsChange) {
        onCalendarsChange(updater(externalCalendars));
        return;
      }
      setCalendarsState((previous) => {
        const next = updater(previous);
        onCalendarsChange?.(next);
        return next;
      });
    },
    [externalCalendars, onCalendarsChange]
  );

  const updateEvents = useCallback(
    (updater: (previous: CalendarEvent[]) => CalendarEvent[]) => {
      if (externalEvents && onEventsChange) {
        onEventsChange(updater(externalEvents));
        return;
      }
      setEventsState((previous) => {
        const next = updater(previous);
        onEventsChange?.(next);
        return next;
      });
    },
    [externalEvents, onEventsChange]
  );

  return { calendars, events, updateCalendars, updateEvents };
};

