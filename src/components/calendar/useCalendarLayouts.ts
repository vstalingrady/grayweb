"use client";

import { useMemo } from "react";

import { ensureDateZone, startOfDay } from "./dateUtils";
import { layoutDayEvents } from "./layoutDayEvents";
import {
  doesEventIntersectDay,
  isAllDayCalendarEvent,
  sortAllDayEvents,
} from "./allDayUtils";
import type { CalendarEvent, CalendarInfo, EventDraft, PositionedEvent } from "./types";

type UseCalendarLayoutsOptions = {
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  selectedDate: Date;
  weekDays: Date[];
  hourHeight: number;
  activeDrafts: Record<string, EventDraft> | null;
  composerPreviewEvent: CalendarEvent | null;
};

export const useCalendarLayouts = ({
  calendars,
  events,
  selectedDate,
  weekDays,
  hourHeight,
  activeDrafts,
  composerPreviewEvent,
}: UseCalendarLayoutsOptions) => {
  const calendarMap = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars]
  );

  const shortEventMinimumHeight = useMemo(
    () => Math.max(Math.round(hourHeight / 4), 12),
    [hourHeight]
  );

  const visibleEvents = useMemo(
    () =>
      events.filter((event) => {
        return calendarMap.get(event.calendarId)?.isVisible !== false;
      }),
    [calendarMap, events]
  );

  const eventsForLayout = useMemo(() => {
    if (!composerPreviewEvent) {
      return visibleEvents;
    }
    const isPreviewVisible = calendarMap.get(composerPreviewEvent.calendarId)?.isVisible !== false;
    const filtered = visibleEvents.filter((event) => event.id !== composerPreviewEvent.id);
    return isPreviewVisible ? [...filtered, composerPreviewEvent] : filtered;
  }, [calendarMap, composerPreviewEvent, visibleEvents]);

  const eventsWithActiveDrafts = useMemo(() => {
    if (!activeDrafts) {
      return eventsForLayout;
    }
    return eventsForLayout.map((event) => {
      const draft = activeDrafts[event.id];
      if (!draft) {
        return event;
      }
      return {
        ...event,
        start: ensureDateZone(draft.start),
        end: ensureDateZone(draft.end),
      };
    });
  }, [activeDrafts, eventsForLayout]);

  const timedEventsForLayout = useMemo(
    () => eventsWithActiveDrafts.filter((event) => !isAllDayCalendarEvent(event)),
    [eventsWithActiveDrafts]
  );

  const allDayEventsForLayout = useMemo(
    () =>
      sortAllDayEvents(
        eventsWithActiveDrafts.filter((event) => isAllDayCalendarEvent(event))
      ),
    [eventsWithActiveDrafts]
  );

  const dayLayouts = useMemo<PositionedEvent[]>(() => {
    const dayTimedEvents = timedEventsForLayout.filter((event) =>
      doesEventIntersectDay(event, selectedDate)
    );
    return layoutDayEvents(dayTimedEvents, {
      hourHeight,
      minimumHeight: shortEventMinimumHeight,
      dayStart: startOfDay(selectedDate),
    });
  }, [hourHeight, selectedDate, shortEventMinimumHeight, timedEventsForLayout]);

  const dayAllDayEvents = useMemo(
    () =>
      allDayEventsForLayout.filter((event) =>
        doesEventIntersectDay(event, selectedDate)
      ),
    [allDayEventsForLayout, selectedDate]
  );

  const weekLayouts = useMemo(() => {
    return weekDays.map((day) => {
      const dayTimedEvents = timedEventsForLayout.filter((event) =>
        doesEventIntersectDay(event, day)
      );
      return layoutDayEvents(dayTimedEvents, {
        hourHeight,
        minimumHeight: shortEventMinimumHeight,
        dayStart: startOfDay(day),
      });
    });
  }, [hourHeight, shortEventMinimumHeight, timedEventsForLayout, weekDays]);

  const weekAllDayEvents = useMemo(
    () =>
      weekDays.map((day) =>
        allDayEventsForLayout.filter((event) => doesEventIntersectDay(event, day))
      ),
    [allDayEventsForLayout, weekDays]
  );

  return {
    dayLayouts,
    dayAllDayEvents,
    weekLayouts,
    weekAllDayEvents,
  };
};
