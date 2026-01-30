/* eslint-disable react-hooks/refs */
import { useCallback, useRef, useState } from "react";

import { CalendarEvent, EventDraft } from "./types";

const addMinutes = (anchor: Date, minutes: number) =>
  new Date(anchor.getTime() + minutes * 60000);

const snapToInterval = (value: number, interval: number) =>
  interval > 0 ? Math.round(value / interval) * interval : value;

type UseEventResizeParams = {
  hourHeight: number;
  snapMinutes?: number;
  onCommit?: (drafts: Record<string, EventDraft>) => void;
};

type ResizeState = {
  pointerId: number;
  initialClientY: number;
  eventId: string;
  originalStart: Date;
  originalEnd: Date;
  edge: "start" | "end";
};

export const useEventResize = ({
  hourHeight,
  snapMinutes = 15,
  onCommit,
}: UseEventResizeParams) => {
  const [activeDraft, setActiveDraft] = useState<EventDraft | null>(null);
  const latestDraftRef = useRef<EventDraft | null>(null);
  const isResizingRef = useRef(false);

  const getResizeProps = useCallback(
    (event: CalendarEvent, edge: "start" | "end") => {
      const handlePointerDown = (pointerEvent: React.PointerEvent<HTMLElement>) => {
        if (pointerEvent.pointerType === "touch") {
          return;
        }

        pointerEvent.preventDefault();
        pointerEvent.stopPropagation();

        const resizeState: ResizeState = {
          pointerId: pointerEvent.pointerId,
          initialClientY: pointerEvent.clientY,
          eventId: event.id,
          originalStart: event.start,
          originalEnd: event.end,
          edge,
        };

        const initialDraft: EventDraft = {
          id: event.id,
          start: event.start,
          end: event.end,
        };

        latestDraftRef.current = initialDraft;
        setActiveDraft(initialDraft);
        isResizingRef.current = true;

        const target = pointerEvent.currentTarget;
        if (target.setPointerCapture) {
          target.setPointerCapture(resizeState.pointerId);
        }

        const frameRef = { current: 0 };
        const pendingDraftRef = { current: null as EventDraft | null };

        const handleMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== resizeState.pointerId) {
            return;
          }

          const minuteHeight = hourHeight / 60 || 1;
          const deltaY = moveEvent.clientY - resizeState.initialClientY;
          const rawDeltaMinutes = deltaY / minuteHeight;
          const snappedDeltaMinutes = snapToInterval(rawDeltaMinutes, snapMinutes);

          let newStart = resizeState.originalStart;
          let newEnd = resizeState.originalEnd;

          if (resizeState.edge === "start") {
            newStart = addMinutes(resizeState.originalStart, snappedDeltaMinutes);
            const minEnd = addMinutes(newStart, snapMinutes);
            if (minEnd > newEnd) {
              newStart = addMinutes(newEnd, -snapMinutes);
            }
          } else {
            newEnd = addMinutes(resizeState.originalEnd, snappedDeltaMinutes);
            const minEnd = addMinutes(newStart, snapMinutes);
            if (newEnd < minEnd) {
              newEnd = minEnd;
            }
          }

          const nextDraft: EventDraft = {
            id: resizeState.eventId,
            start: newStart,
            end: newEnd,
          };

          latestDraftRef.current = nextDraft;
          pendingDraftRef.current = nextDraft;

          if (!frameRef.current) {
            frameRef.current = requestAnimationFrame(() => {
              if (pendingDraftRef.current) {
                setActiveDraft(pendingDraftRef.current);
              }
              frameRef.current = 0;
            });
          }
        };

        const release = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          window.removeEventListener("pointercancel", handleCancel);
          if (target.hasPointerCapture?.(resizeState.pointerId)) {
            target.releasePointerCapture(resizeState.pointerId);
          }
          if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = 0;
          }
        };

        const handleUp = () => {
          const finalDraft = latestDraftRef.current;
          if (finalDraft && onCommit) {
            onCommit({ [finalDraft.id]: finalDraft });
          }
          isResizingRef.current = false;
          setActiveDraft(null);
          latestDraftRef.current = null;
          release();
        };

        const handleCancel = () => {
          isResizingRef.current = false;
          setActiveDraft(null);
          latestDraftRef.current = null;
          release();
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        window.addEventListener("pointercancel", handleCancel);
      };

      return {
        onPointerDown: handlePointerDown,
      };
    },
    [hourHeight, onCommit, snapMinutes]
  );

  return {
    activeDraft,
    getResizeProps,
    isResizing: isResizingRef.current,
  };
};
