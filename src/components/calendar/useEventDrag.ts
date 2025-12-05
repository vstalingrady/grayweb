/* eslint-disable react-hooks/refs */
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
  (interval > 0 ? Math.round(value / interval) * interval : value);

type HorizontalDragConfig = {
  columnCount: number;
  getColumnIndex: (pointerEvent: PointerEvent, calendarEvent: CalendarEvent) => number;
};

type UseEventDragParams = {
  containerRef: MutableRefObject<HTMLElement | null>;
  hourHeight: number;
  snapMinutes?: number;
  selectedEventIds?: Set<string>;
  allEvents?: CalendarEvent[];
  onCommit?: (drafts: Record<string, EventDraft>) => void;
  horizontal?: HorizontalDragConfig | null;
};

type DragState = {
  pointerId: number;
  initialClientY: number;
  initialClientX: number;
  anchor: Date; // Day start (00:00)
  // Column index (e.g. week-day index) where the drag started
  primaryColumnIndex: number;
  activeDrafts: Record<string, EventDraft>;
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
  onCommit,
  horizontal = null,
}: UseEventDragParams) => {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const isDraggingRef = useRef(false);
  const latestDraftsRef = useRef<Record<string, EventDraft> | null>(null);

  // We need a ref to access the latest state inside event listeners without re-binding
  const stateRef = useRef<DragState | null>(null);
  stateRef.current = dragState;

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
        const initialDrafts: Record<string, EventDraft> = {};

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
          initialDrafts[ev.id] = {
            id: ev.id,
            start: ev.start,
            end: ev.end,
          };
        });

        // Capture the horizontal column index at drag start (for week view)
        const primaryColumnIndex =
          horizontal && horizontal.columnCount > 0
            ? clamp(
              horizontal.getColumnIndex(
                // Cast is safe: React.PointerEvent wraps the native PointerEvent
                pointerEvent.nativeEvent as unknown as PointerEvent,
                primaryEvent
              ),
              0,
              horizontal.columnCount - 1
            )
            : 0;

        const newDragState: DragState = {
          pointerId: pointerEvent.pointerId,
          initialClientY: pointerEvent.clientY,
          initialClientX: pointerEvent.clientX,
          anchor: eventAnchor,
          primaryColumnIndex,
          draggingEvents,
          activeDrafts: initialDrafts,
        };

        setDragState(newDragState);
        latestDraftsRef.current = initialDrafts;
        suppressClickRef.current = false;
        isDraggingRef.current = false;

        const target = pointerEvent.currentTarget;
        target.setPointerCapture(newDragState.pointerId);

        const frameRef = { current: 0 }; // Local ref for RAF ID within the closure
        const pendingStateRef = { current: null as DragState | null }; // Local ref for pending state

        const handleMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== newDragState.pointerId) {
            return;
          }

          // Check for drag threshold
          if (!isDraggingRef.current) {
            const dx = moveEvent.clientX - newDragState.initialClientX;
            const dy = moveEvent.clientY - newDragState.initialClientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 5) {
              return;
            }
            isDraggingRef.current = true;
          }

          const minuteHeight = (hourHeight / 60) || 1; // Safeguard against 0 division

          // Calculate delta in pixels
          const deltaY = moveEvent.clientY - newDragState.initialClientY;

          // Convert to minutes
          const rawDeltaMinutes = deltaY / minuteHeight;

          // Determine the target column index (e.g. day index in week view)
          const baseColumnIndex = newDragState.primaryColumnIndex;
          const targetColumnIndex =
            horizontal && horizontal.columnCount > 0
              ? clamp(
                horizontal.getColumnIndex(moveEvent, primaryEvent),
                0,
                horizontal.columnCount - 1
              )
              : baseColumnIndex;

          // Calculate drafts
          const nextDrafts: Record<string, EventDraft> = {};
          // Horizontal drag moves events by entire days; vertical drag stays within the same day.
          const columnDelta =
            horizontal && horizontal.columnCount > 0
              ? targetColumnIndex - baseColumnIndex
              : 0;

          Object.entries(newDragState.draggingEvents).forEach(
            ([id, { originalStart, durationMinutes }]) => {
              // 1. Calculate original start in minutes from anchor
              const originalStartMinutes = minutesBetween(newDragState.anchor, originalStart);

              // 2. Apply delta
              const newStartMinutes = originalStartMinutes + rawDeltaMinutes;

              // 3. Snap the RESULTING time, not the delta
              const snappedStartMinutes = snapToInterval(newStartMinutes, snapMinutes);

              // 4. Clamp to day bounds
              const clampedStart = clamp(
                snappedStartMinutes,
                0,
                MINUTES_IN_DAY - durationMinutes
              );

              const nextStart = addMinutes(newDragState.anchor, clampedStart);
              const nextEnd = addMinutes(nextStart, durationMinutes);

              nextDrafts[id] = {
                id,
                start: addDays(nextStart, columnDelta),
                end: addDays(nextEnd, columnDelta),
              };
            }
          );

          latestDraftsRef.current = nextDrafts;

          // Schedule state update
          pendingStateRef.current = { ...newDragState, activeDrafts: nextDrafts };
          if (!frameRef.current) {
            frameRef.current = requestAnimationFrame(() => {
              if (pendingStateRef.current) {
                setDragState(pendingStateRef.current);
              }
              frameRef.current = 0;
            });
          }
        };

        const release = () => {
          target.removeEventListener("pointermove", handleMove);
          target.removeEventListener("pointerup", handleUp);
          target.removeEventListener("pointercancel", handleCancel);
          if (target.hasPointerCapture(newDragState.pointerId)) {
            target.releasePointerCapture(newDragState.pointerId);
          }
          if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = 0;
          }
        };

        const handleUp = () => {
          // Use ref to get the absolute latest drafts, avoiding render-cycle staleness
          const finalDrafts = latestDraftsRef.current;

          if (isDraggingRef.current && finalDrafts) {
            onCommit?.(finalDrafts);
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
          setDragState(null);
          latestDraftsRef.current = null;
          release();
        };

        const handleCancel = () => {
          if (isDraggingRef.current) {
            suppressClickRef.current = true;
            window.setTimeout(() => {
              suppressClickRef.current = false;
            }, 0);
          }
          isDraggingRef.current = false;
          setDragState(null);
          latestDraftsRef.current = null;
          release();
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
      snapMinutes,
      horizontal,
      selectedEventIds,
      allEvents,
    ]
  );

  return {
    activeDrafts: dragState?.activeDrafts ?? null,
    suppressClickRef,
    getDraggableProps,
    isDragging: isDraggingRef.current,
  };
};
