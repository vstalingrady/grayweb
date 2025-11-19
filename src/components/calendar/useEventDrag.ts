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
  selectedEventIds?: Set<string>;
  allEvents?: CalendarEvent[]; // Needed to find other selected events
  onPreview?: (drafts: Record<string, EventDraft> | null) => void;
  onCommit?: (drafts: Record<string, EventDraft>) => void;
  horizontal?: HorizontalDragConfig | null;
};

type DragState = {
  pointerId: number;
  initialClientY: number;
  initialClientX: number;
  anchor: Date; // Day start (00:00)
  draggingEvents: Record<
    string,
    { originalStart: Date; durationMinutes: number; column: number }
  >;
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
  selectedEventIds,
  allEvents = [],
  onPreview,
  onCommit,
  horizontal = null,
}: UseEventDragParams) => {
  const [activeDrafts, setActiveDrafts] = useState<Record<string, EventDraft> | null>(null);
  const activeDraftsRef = useRef<Record<string, EventDraft> | null>(null);
  const suppressClickRef = useRef(false);
  const isDraggingRef = useRef(false);

  const getDraggableProps = useCallback(
    (primaryEvent: CalendarEvent) => {
      const handlePointerDown = (pointerEvent: React.PointerEvent<HTMLElement>) => {
        if (pointerEvent.pointerType === "touch") {
          return;
        }
        if (!containerRef.current) {
          return;
        }

        // Prevent default to stop text selection, etc.
        pointerEvent.preventDefault();
        pointerEvent.stopPropagation();

        const eventAnchor = new Date(primaryEvent.start);
        eventAnchor.setHours(0, 0, 0, 0);

        // Identify all events to drag
        const eventsToDrag = new Map<string, CalendarEvent>();
        // Always include the primary event (the one clicked)
        eventsToDrag.set(primaryEvent.id, primaryEvent);

        // If the primary event is selected, include all other selected events
        if (selectedEventIds?.has(primaryEvent.id)) {
          allEvents.forEach((ev) => {
            if (selectedEventIds.has(ev.id)) {
              eventsToDrag.set(ev.id, ev);
            }
          });
        }

        const draggingEvents: DragState["draggingEvents"] = {};
        eventsToDrag.forEach((ev) => {
          const startMinutes = minutesBetween(eventAnchor, ev.start);
          const endMinutes = minutesBetween(eventAnchor, ev.end);
          draggingEvents[ev.id] = {
            originalStart: ev.start,
            durationMinutes: Math.max(endMinutes - startMinutes, snapMinutes),
            column:
              typeof (ev as CalendarEvent & { column?: number }).column === "number"
                ? (ev as CalendarEvent & { column?: number }).column ?? 0
                : 0,
          };
        });

        const dragState: DragState = {
          pointerId: pointerEvent.pointerId,
          initialClientY: pointerEvent.clientY,
          initialClientX: pointerEvent.clientX,
          anchor: eventAnchor,
          draggingEvents,
        };

        suppressClickRef.current = false;
        isDraggingRef.current = false;

        const target = pointerEvent.currentTarget;
        target.setPointerCapture(dragState.pointerId);

        const dispatchPreview = (deltaMinutes: number, targetColumn?: number) => {
          const drafts: Record<string, EventDraft> = {};

          // Calculate column delta if applicable
          const primaryOriginalColumn = draggingEvents[primaryEvent.id].column;
          const columnDelta = typeof targetColumn === "number" ? targetColumn - primaryOriginalColumn : 0;

          Object.entries(dragState.draggingEvents).forEach(
            ([id, { originalStart, durationMinutes }]) => {
              // 1. Calculate original start in minutes from anchor
              const originalStartMinutes = minutesBetween(dragState.anchor, originalStart);

              // 2. Apply delta
              const newStartMinutes = originalStartMinutes + deltaMinutes;

              // 3. Snap the RESULTING time, not the delta
              const snappedStartMinutes = snapToInterval(newStartMinutes, snapMinutes);

              // 4. Clamp to day bounds
              const clampedStart = clamp(
                snappedStartMinutes,
                0,
                MINUTES_IN_DAY - durationMinutes
              );

              const nextStart = addMinutes(dragState.anchor, clampedStart);
              const nextEnd = addMinutes(nextStart, durationMinutes);

              drafts[id] = {
                id,
                start: addDays(nextStart, columnDelta),
                end: addDays(nextEnd, columnDelta),
              };
            }
          );

          activeDraftsRef.current = drafts;
          setActiveDrafts(drafts);
          onPreview?.(drafts);
        };

        const handleMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== dragState.pointerId) {
            return;
          }

          // Check for drag threshold
          if (!isDraggingRef.current) {
            const dx = moveEvent.clientX - dragState.initialClientX;
            const dy = moveEvent.clientY - dragState.initialClientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 5) {
              return;
            }
            isDraggingRef.current = true;
          }

          const minuteHeight = (hourHeight / 60) || 1; // Safeguard against 0 division

          // Calculate delta in pixels
          const deltaY = moveEvent.clientY - dragState.initialClientY;

          // Convert to minutes
          const rawDeltaMinutes = deltaY / minuteHeight;

          const primaryColumn = draggingEvents[primaryEvent.id].column;

          const targetColumn =
            horizontal && horizontal.columnCount > 0
              ? Math.max(
                0,
                Math.min(
                  horizontal.columnCount - 1,
                  horizontal.getColumnIndex(moveEvent, primaryEvent)
                )
              )
              : primaryColumn;

          dispatchPreview(rawDeltaMinutes, targetColumn);
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
          activeDraftsRef.current = null;
          setActiveDrafts(null);
          onPreview?.(null);
        };

        const handleUp = () => {
          if (isDraggingRef.current && activeDraftsRef.current) {
            onCommit?.(activeDraftsRef.current);
          }

          // If we dragged, suppress the click that follows
          if (isDraggingRef.current) {
            suppressClickRef.current = true;
            // Reset suppression after a tick to allow future clicks
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

        target.addEventListener("pointermove", handleMove);
        target.addEventListener("pointerup", handleUp);
        target.addEventListener("pointercancel", handleCancel);
      };

      return {
        onPointerDown: handlePointerDown,
      };
    },
    [
      containerRef,
      hourHeight,
      onCommit,
      onPreview,
      snapMinutes,
      horizontal,
      selectedEventIds,
      allEvents,
    ]
  );

  return {
    activeDrafts,
    suppressClickRef,
    getDraggableProps,
    clearDraft: () => {
      activeDraftsRef.current = null;
      setActiveDrafts(null);
      onPreview?.(null);
    },
  };
};
