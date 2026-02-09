"use client";

import { useCallback, type MouseEvent, type MutableRefObject } from "react";

import type { ComposerAnchorRect } from "./dashboardCalendarTypes";
import type { CalendarEvent, PositionedEvent } from "./types";

type UseDashboardCalendarInteractionsOptions = {
  hourHeight: number;
  snapMinutes: number;
  eventCardClassName: string;
  daySuppressClickRef: MutableRefObject<boolean>;
  weekSuppressClickRef: MutableRefObject<boolean>;
  events: CalendarEvent[];
  updateEvents: (updater: (previous: CalendarEvent[]) => CalendarEvent[]) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  clearSelection: () => void;
  toggleSelection: (eventId: string) => void;
  selectSingle: (eventId: string) => void;
  editEvent: (event: CalendarEvent, anchorRect?: DOMRect | DOMRectReadOnly | null) => void;
  openComposerAt: (start: Date, anchorRect: ComposerAnchorRect) => void;
};

export const useDashboardCalendarInteractions = ({
  hourHeight,
  snapMinutes,
  eventCardClassName,
  daySuppressClickRef,
  weekSuppressClickRef,
  events,
  updateEvents,
  onEventDelete,
  clearSelection,
  toggleSelection,
  selectSingle,
  editEvent,
  openComposerAt,
}: UseDashboardCalendarInteractionsOptions) => {
  const isGoogleCalendarEvent = useCallback((event: CalendarEvent) => {
    return typeof event.calendarId === "string" && event.calendarId.startsWith("google:");
  }, []);

  const handleEventClick = useCallback(
    (
      calendarEvent: CalendarEvent,
      anchorRect?: DOMRect | DOMRectReadOnly | null,
      mouseEvent?: MouseEvent
    ) => {
      if (daySuppressClickRef.current || weekSuppressClickRef.current) {
        return;
      }

      if (mouseEvent?.ctrlKey || mouseEvent?.metaKey) {
        toggleSelection(calendarEvent.id);
        return;
      }

      selectSingle(calendarEvent.id);
      if (isGoogleCalendarEvent(calendarEvent)) {
        return;
      }
      editEvent(calendarEvent, anchorRect);
    },
    [
      daySuppressClickRef,
      editEvent,
      isGoogleCalendarEvent,
      selectSingle,
      toggleSelection,
      weekSuppressClickRef,
    ]
  );

  const handleColumnClick = useCallback(
    (mouseEvent: MouseEvent<HTMLDivElement>, day: Date) => {
      if (daySuppressClickRef.current || weekSuppressClickRef.current) {
        return;
      }
      const target = mouseEvent.currentTarget;
      if (mouseEvent.target instanceof HTMLElement) {
        // Ignore clicks that originate from an existing event card so we don't
        // create a new draft on top of the one being edited.
        if (mouseEvent.target.closest(`.${eventCardClassName}`)) {
          return;
        }
      }

      // Clear selection on background click
      clearSelection();

      const bounds = target.getBoundingClientRect();
      const offsetY = mouseEvent.clientY - bounds.top;
      const snappedMinutes =
        Math.round((offsetY / hourHeight) * (60 / snapMinutes)) * snapMinutes;
      const maxStartMinutes = Math.max(0, 24 * 60 - snapMinutes);
      const totalMinutes = Math.max(0, Math.min(maxStartMinutes, snappedMinutes));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const start = new Date(day);
      start.setHours(hours, minutes, 0, 0);

      const startMinutes = hours * 60 + minutes;
      const startOffsetPx = (startMinutes / 60) * hourHeight;
      const defaultDurationMinutes = 60;
      const eventHeightPx = (defaultDurationMinutes / 60) * hourHeight;

      const anchorRect: ComposerAnchorRect = {
        left: bounds.left,
        width: bounds.width,
        top: bounds.top + startOffsetPx,
        height: eventHeightPx,
      };
      openComposerAt(start, anchorRect);
    },
    [
      clearSelection,
      daySuppressClickRef,
      eventCardClassName,
      hourHeight,
      openComposerAt,
      snapMinutes,
      weekSuppressClickRef,
    ]
  );

  const handleDeleteEvent = useCallback(
    (positionedEvent: PositionedEvent) => {
      const calendarEvent = events.find((event) => event.id === positionedEvent.id);
      if (calendarEvent && onEventDelete) {
        onEventDelete(calendarEvent);
      }
      updateEvents((previous) => previous.filter((event) => event.id !== positionedEvent.id));
    },
    [events, onEventDelete, updateEvents]
  );

  return {
    isGoogleCalendarEvent,
    handleEventClick,
    handleColumnClick,
    handleDeleteEvent,
  };
};
