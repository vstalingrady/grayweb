"use client";

import { useCallback, useMemo, useRef } from "react";

import { ensureDateZone } from "./dateUtils";
import { useEventDrag } from "./useEventDrag";
import { useEventResize } from "./useEventResize";
import type { CalendarEvent, EventDraft } from "./types";

type UseDashboardCalendarDragResizeOptions = {
  hourHeight: number;
  snapMinutes: number;
  selectedEventIds: Set<string>;
  events: CalendarEvent[];
  updateEvents: (updater: (previous: CalendarEvent[]) => CalendarEvent[]) => void;
};

export const useDashboardCalendarDragResize = ({
  hourHeight,
  snapMinutes,
  selectedEventIds,
  events,
  updateEvents,
}: UseDashboardCalendarDragResizeOptions) => {
  const dayColumnRef = useRef<HTMLDivElement | null>(null);
  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  const weekColumnsRef = useRef<HTMLDivElement | null>(null);

  const handleCommitDrag = useCallback(
    (drafts: Record<string, EventDraft>) => {
      updateEvents((previous) =>
        previous.map((event) => {
          const draft = drafts[event.id];
          if (draft) {
            return {
              ...event,
              start: ensureDateZone(draft.start),
              end: ensureDateZone(draft.end),
            };
          }
          return event;
        })
      );
    },
    [updateEvents]
  );

  const {
    getDraggableProps: getDayDraggableProps,
    suppressClickRef: daySuppressClickRef,
    activeDrafts: dayDragDrafts,
  } = useEventDrag({
    containerRef: dayColumnRef,
    hourHeight,
    snapMinutes,
    selectedEventIds,
    allEvents: events,
    onCommit: handleCommitDrag,
  });

  const { getResizeProps, activeDraft: blockResizeDraft } = useEventResize({
    containerRef: dayColumnRef,
    hourHeight,
    snapMinutes,
    onCommit: handleCommitDrag,
  });

  const dayDrafts = useMemo<Record<string, EventDraft> | null>(() => {
    if (blockResizeDraft) {
      return { [blockResizeDraft.id]: blockResizeDraft };
    }
    return dayDragDrafts;
  }, [blockResizeDraft, dayDragDrafts]);

  const {
    getDraggableProps: getWeekDraggableProps,
    suppressClickRef: weekSuppressClickRef,
    activeDrafts: weekDrafts,
  } = useEventDrag({
    containerRef: weekScrollRef,
    hourHeight,
    snapMinutes,
    selectedEventIds,
    allEvents: events,
    onCommit: handleCommitDrag,
    horizontal: {
      columnCount: 7,
      getColumnIndex: (pointerEvent: PointerEvent) => {
        const weekColumnsEl = weekColumnsRef.current;
        if (!weekColumnsEl) {
          return 0;
        }

        const rect = weekColumnsEl.getBoundingClientRect();
        const columnWidth = rect.width / 7;
        const relativeX = pointerEvent.clientX - rect.left;
        return Math.max(0, Math.min(6, Math.floor(relativeX / columnWidth)));
      },
    },
  });

  const activeDrafts = dayDrafts || weekDrafts;

  return {
    dayColumnRef,
    weekScrollRef,
    weekColumnsRef,
    daySuppressClickRef,
    weekSuppressClickRef,
    getDayDraggableProps,
    getWeekDraggableProps,
    getResizeProps,
    activeDrafts,
  };
};

