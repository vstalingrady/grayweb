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

type UseEventDragParams = {
  containerRef: MutableRefObject<HTMLElement | null>;
  dayAnchor: Date;
  hourHeight: number;
  snapMinutes?: number;
  onPreview?: (draft: EventDraft | null) => void;
  onCommit?: (draft: EventDraft) => void;
};

type DragState = {
  eventId: string;
  pointerId: number;
  offsetMinutes: number;
  durationMinutes: number;
  pointerOffsetY: number;
};

export const useEventDrag = ({
  containerRef,
  dayAnchor,
  hourHeight,
  snapMinutes = 15,
  onPreview,
  onCommit,
}: UseEventDragParams) => {
  const [activeDraft, setActiveDraft] = useState<EventDraft | null>(null);
  const activeDraftRef = useRef<EventDraft | null>(null);

  const getDraggableProps = useCallback(
    (calendarEvent: CalendarEvent) => {
      const handlePointerDown = (pointerEvent: React.PointerEvent<HTMLDivElement>) => {
        if (!containerRef.current) {
          return;
        }

        pointerEvent.preventDefault();
        pointerEvent.stopPropagation();

        const target = pointerEvent.currentTarget;
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollTop = containerRef.current.scrollTop;
        const minuteHeight = hourHeight / 60;
        const pointerOffsetY = pointerEvent.clientY - containerRect.top + scrollTop;

        const eventStartMinutes = minutesBetween(dayAnchor, calendarEvent.start);
        const eventEndMinutes = minutesBetween(dayAnchor, calendarEvent.end);
        const durationMinutes = Math.max(eventEndMinutes - eventStartMinutes, snapMinutes);
        const dragOffsetMinutes = eventStartMinutes - pointerOffsetY / minuteHeight;

        const dragState: DragState = {
          eventId: calendarEvent.id,
          pointerId: pointerEvent.pointerId,
          offsetMinutes: dragOffsetMinutes,
          durationMinutes,
          pointerOffsetY,
        };

        let isDragging = false;

        const dispatchPreview = (startMinutes: number) => {
          const clampedStart = clamp(
            snapToInterval(startMinutes, snapMinutes),
            0,
            MINUTES_IN_DAY - durationMinutes
          );

          const nextStart = addMinutes(dayAnchor, clampedStart);
          const nextEnd = addMinutes(nextStart, durationMinutes);
          const draft: EventDraft = {
            id: calendarEvent.id,
            start: nextStart,
            end: nextEnd,
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

          isDragging = true;
          dispatchPreview(startMinutes);
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
          if (isDragging && activeDraftRef.current) {
            onCommit?.(activeDraftRef.current);
          }
          release();
          finalize();
        };

        const handleCancel = () => {
          release();
          finalize();
        };

        target.setPointerCapture(dragState.pointerId);
        target.addEventListener("pointermove", handleMove);
        target.addEventListener("pointerup", handleUp);
        target.addEventListener("pointercancel", handleCancel);

        // Provide immediate preview so the event sticks to the pointer even on click
        dispatchPreview(eventStartMinutes);
      };

      return {
        onPointerDown: handlePointerDown,
      };
    },
    [containerRef, dayAnchor, hourHeight, onCommit, onPreview, snapMinutes]
  );

  return {
    activeDraft,
    getDraggableProps,
    clearDraft: () => {
      activeDraftRef.current = null;
      setActiveDraft(null);
      onPreview?.(null);
    },
  };
};
