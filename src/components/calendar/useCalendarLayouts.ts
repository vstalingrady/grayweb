"use client";

import { useMemo } from "react";

import { ensureDateZone, isSameDay, startOfDay } from "./dateUtils";
import { layoutDayEvents } from "./layoutDayEvents";
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
  const dayKey = useMemo(() => {
    return (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
  }, []);

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

  const dayLayouts = useMemo<PositionedEvent[]>(() => {
    const filtered = visibleEvents.filter((event) => isSameDay(event.start, selectedDate));
    let result = filtered;

    if (activeDrafts) {
      result = result.map((event) => {
        const draft = activeDrafts[event.id];
        if (draft) {
          return {
            ...event,
            start: ensureDateZone(draft.start),
            end: ensureDateZone(draft.end),
          };
        }
        return event;
      });
    }

    if (composerPreviewEvent && isSameDay(composerPreviewEvent.start, selectedDate)) {
      result = [...result, composerPreviewEvent];
    }

    return layoutDayEvents(result, {
      hourHeight,
      minimumHeight: shortEventMinimumHeight,
      dayStart: startOfDay(selectedDate),
    });
  }, [
    activeDrafts,
    composerPreviewEvent,
    hourHeight,
    selectedDate,
    shortEventMinimumHeight,
    visibleEvents,
  ]);

  const weekLayouts = useMemo(() => {
    const movedDraftsByDayKey = (() => {
      if (!activeDrafts) {
        return null;
      }
      const visibleEventsById = new Map(visibleEvents.map((event) => [event.id, event]));
      const movedByDay = new Map<string, CalendarEvent[]>();
      for (const draft of Object.values(activeDrafts)) {
        const originalEvent = visibleEventsById.get(draft.id);
        if (!originalEvent) {
          continue;
        }
        if (isSameDay(originalEvent.start, draft.start)) {
          continue;
        }
        const key = dayKey(draft.start);
        const next = movedByDay.get(key) ?? [];
        next.push({
          ...originalEvent,
          start: ensureDateZone(draft.start),
          end: ensureDateZone(draft.end),
        });
        movedByDay.set(key, next);
      }
      return movedByDay;
    })();

    return weekDays.map((day) => {
      const dayEventsForWeek = visibleEvents.filter((event) => isSameDay(event.start, day));
      const mappedEvents = activeDrafts
        ? dayEventsForWeek.map((event) => {
            const draft = activeDrafts[event.id];
            if (draft) {
              return {
                ...event,
                start: ensureDateZone(draft.start),
                end: ensureDateZone(draft.end),
              };
            }
            return event;
          })
        : dayEventsForWeek;

      const eventsWithPreview = mappedEvents.filter((event) => isSameDay(event.start, day));

      const movedDraftEvents = movedDraftsByDayKey?.get(dayKey(day));
      if (movedDraftEvents) {
        eventsWithPreview.push(...movedDraftEvents);
      }

      if (composerPreviewEvent && isSameDay(composerPreviewEvent.start, day)) {
        eventsWithPreview.push(composerPreviewEvent);
      }

      return layoutDayEvents(eventsWithPreview, {
        hourHeight,
        minimumHeight: shortEventMinimumHeight,
        dayStart: startOfDay(day),
      });
    });
  }, [
    activeDrafts,
    composerPreviewEvent,
    dayKey,
    hourHeight,
    shortEventMinimumHeight,
    visibleEvents,
    weekDays,
  ]);

  return { dayLayouts, weekLayouts };
};
