import { MutableRefObject, useCallback, useRef, useState } from "react";

import { CalendarEvent, EventDraft } from "./types";

const MINUTES_IN_DAY = 24 * 60;

const minutesBetween = (anchor: Date, value: Date) =>
  (value.getTime() - anchor.getTime()) / 60000;

const addMinutes = (anchor: Date, minutes: number) =>
  new Date(anchor.getTime() + minutes * 60000);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const snapToInterval = (value: number, interval: number) =>
  interval > 0 ? Math.round(value / interval) * interval : value;

type HorizontalDragConfig = {
  columnCount: number;
  getColumnIndex: (pointerEvent: PointerEvent, calendarEvent: CalendarEvent) => number;
};

type UseEventDragParams = {
  containerRef: MutableRefObject<HTMLElement | null>;
  hourHeight: number;
  snapMinutes?: number;
  onPreview?: (draft: EventDraft | null) => void;
  onCommit?: (draft: EventDraft, calendarEvent: CalendarEvent) => void;
  horizontal?: HorizontalDragConfig | null;
};

type DragState = {
  eventId: string;
  pointerId: number;
  offsetMinutes: number;
  durationMinutes: number;
  anchor: Date;
  calendarEvent: CalendarEvent;
  column: number;
};

const addDays = (value: Date, days: number) => {
  if (!days) {
    return value;
  }
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

export const useEventDrag = ({
  containerRef,
  hourHeight,
  snapMinutes = 15,
  onPreview,
  onCommit,
  horizontal = null,
}: UseEventDragParams) => {
  const [activeDraft, setActiveDraft] = useState<EventDraft | null>(null);
  const activeDraftRef = useRef<EventDraft | null>(null);
  const suppressClickRef = useRef(false);
  const isDraggingRef = useRef(false);

  const getDraggableProps = useCallback(
    (calendarEvent: CalendarEvent) => {
      const handlePointerDown = (pointerEvent: React.PointerEvent<HTMLElement>) => {
        if (pointerEvent.pointerType === "touch") {
          // Allow native touch scrolling on mobile; dragging stays mouse/pen only
          return;
        }
        if (!containerRef.current) {
          return;
        }

        const eventAnchor = new Date(calendarEvent.start);
        eventAnchor.setHours(0, 0, 0, 0);

        pointerEvent.preventDefault();
        pointerEvent.stopPropagation();

        const target = pointerEvent.currentTarget;
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const minuteHeight = hourHeight / 60;
        const pointerOffsetY = pointerEvent.clientY - containerRect.top + scrollTop;

        const eventStartMinutes = minutesBetween(eventAnchor, calendarEvent.start);
        const eventEndMinutes = minutesBetween(eventAnchor, calendarEvent.end);
        const durationMinutes = Math.max(eventEndMinutes - eventStartMinutes, snapMinutes);
        const dragOffsetMinutes = eventStartMinutes - pointerOffsetY / minuteHeight;

        const dragState: DragState = {
          eventId: calendarEvent.id,
          pointerId: pointerEvent.pointerId,
          offsetMinutes: dragOffsetMinutes,
          durationMinutes,
          anchor: eventAnchor,
          calendarEvent,
          column: typeof (calendarEvent as CalendarEvent & { column?: number }).column === "number"
            ? ((calendarEvent as CalendarEvent & { column?: number }).column ?? 0)
            : 0,
        };

        suppressClickRef.current = false;
        isDraggingRef.current = false;

        const dispatchPreview = (startMinutes: number, targetColumn?: number) => {
          const clampedStart = clamp(
            snapToInterval(startMinutes, snapMinutes),
            0,
            MINUTES_IN_DAY - durationMinutes
          );

          const nextStart = addMinutes(dragState.anchor, clampedStart);
          const nextEnd = addMinutes(nextStart, durationMinutes);
          const draft: EventDraft = {
            id: calendarEvent.id,
            start: addDays(
              nextStart,
              typeof targetColumn === "number" ? targetColumn - dragState.column : 0
            ),
            end: addDays(
              nextEnd,
              typeof targetColumn === "number" ? targetColumn - dragState.column : 0
            ),
          };

          activeDraftRef.current = draft;
          setActiveDraft(draft);
          onPreview?.(draft);
        };

        const handleMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== dragState.pointerId || !containerRef.current) {
            return;
          }
          const containerBounds = containerRef.current.getBoundingClientRect();
          const pointerY = moveEvent.clientY - containerBounds.top + containerRef.current.scrollTop;
          const minuteHeightLocal = hourHeight / 60;
          const startMinutes = pointerY / minuteHeightLocal + dragState.offsetMinutes;

          const targetColumn =
            horizontal && horizontal.columnCount > 0
              ? Math.max(
                  0,
                  Math.min(
                    horizontal.columnCount - 1,
                    horizontal.getColumnIndex(moveEvent, calendarEvent)
                  )
                )
              : dragState.column;
          isDraggingRef.current = true;
          dispatchPreview(startMinutes, targetColumn);
        };

        const release = () => {
          target.removeEventListener("pointermove", handleMove);
          target.removeEventListener("pointerup", handleUp);
          target.removeEventListener("pointercancel", handleCancel);
          if (target.hasPointerCapture(dragState.pointerId)) {
            target.releasePointerCapture(dragState.pointerId);
          }
        };

        const finalize = () => {
          activeDraftRef.current = null;
          setActiveDraft(null);
          onPreview?.(null);
        };

        const handleUp = () => {
          if (isDraggingRef.current && activeDraftRef.current) {
            onCommit?.(activeDraftRef.current, dragState.calendarEvent);
          }
          if (isDraggingRef.current) {
            suppressClickRef.current = true;
            window.setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
          }
          isDraggingRef.current = false;
          release();
          finalize();
        };

        const handleCancel = () => {
          if (isDraggingRef.current) {
            suppressClickRef.current = true;
            window.setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
          }
          isDraggingRef.current = false;
          release();
          finalize();
        };

        target.setPointerCapture(dragState.pointerId);
        target.addEventListener("pointermove", handleMove);
        target.addEventListener("pointerup", handleUp);
        target.addEventListener("pointercancel", handleCancel);

        // Provide immediate preview so the event sticks to the pointer even on click
        dispatchPreview(eventStartMinutes, dragState.column);
      };

      return {
        onPointerDown: handlePointerDown,
      };
    },
    [containerRef, hourHeight, onCommit, onPreview, snapMinutes, horizontal]
  );

  return {
    activeDraft,
    suppressClickRef,
    getDraggableProps,
    clearDraft: () => {
      activeDraftRef.current = null;
      setActiveDraft(null);
      onPreview?.(null);
    },
  };
};
