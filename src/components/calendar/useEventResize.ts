/* eslint-disable react-hooks/refs */
import { useCallback, useRef, useState } from "react";

import { CalendarEvent, EventDraft } from "./types";

const addMinutes = (anchor: Date, minutes: number) =>
    new Date(anchor.getTime() + minutes * 60000);

const snapToInterval = (value: number, interval: number) =>
    (interval > 0 ? Math.round(value / interval) * interval : value);

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
    activeDraft: EventDraft;
};

export const useEventResize = ({
    hourHeight,
    snapMinutes = 15,
    onCommit,
}: UseEventResizeParams) => {
    const [resizeState, setResizeState] = useState<ResizeState | null>(null);
    const isResizingRef = useRef(false);
    const latestDraftRef = useRef<EventDraft | null>(null);

    const getResizeProps = useCallback(
        (event: CalendarEvent, edge: "start" | "end") => {
            const handlePointerDown = (pointerEvent: React.PointerEvent<HTMLElement>) => {
                if (pointerEvent.pointerType === "touch") {
                    return;
                }

                pointerEvent.preventDefault();
                pointerEvent.stopPropagation();

                const newResizeState: ResizeState = {
                    pointerId: pointerEvent.pointerId,
                    initialClientY: pointerEvent.clientY,
                    eventId: event.id,
                    originalStart: event.start,
                    originalEnd: event.end,
                    edge,
                    activeDraft: {
                        id: event.id,
                        start: event.start,
                        end: event.end,
                    },
                };

                setResizeState(newResizeState);
                latestDraftRef.current = newResizeState.activeDraft;
                isResizingRef.current = true;

                const target = pointerEvent.currentTarget;
                target.setPointerCapture(newResizeState.pointerId);

                const frameRef = { current: 0 };
                const pendingStateRef = { current: null as ResizeState | null };

                const handleMove = (moveEvent: PointerEvent) => {
                    if (moveEvent.pointerId !== newResizeState.pointerId) return;

                    const minuteHeight = (hourHeight / 60) || 1;
                    const deltaY = moveEvent.clientY - newResizeState.initialClientY;
                    const rawDeltaMinutes = deltaY / minuteHeight;

                    // Round to nearest snap interval
                    const snappedDeltaMinutes = snapToInterval(rawDeltaMinutes, snapMinutes);

                    let newStart = newResizeState.originalStart;
                    let newEnd = newResizeState.originalEnd;

                    if (edge === "start") {
                        newStart = addMinutes(newResizeState.originalStart, snappedDeltaMinutes);
                        // Constraint: End time must be at least snapMinutes after start
                        const minEnd = addMinutes(newStart, snapMinutes);
                        if (minEnd > newEnd) {
                            newStart = addMinutes(newEnd, -snapMinutes);
                        }
                    } else {
                        newEnd = addMinutes(newResizeState.originalEnd, snappedDeltaMinutes);
                        // Constraint: End time must be at least snapMinutes after start
                        const minEnd = addMinutes(newStart, snapMinutes);
                        if (newEnd < minEnd) {
                            newEnd = minEnd;
                        }
                    }

                    const nextDraft: EventDraft = {
                        id: event.id,
                        start: newStart,
                        end: newEnd,
                    };

                    latestDraftRef.current = nextDraft;
                    pendingStateRef.current = { ...newResizeState, activeDraft: nextDraft };

                    if (!frameRef.current) {
                        frameRef.current = requestAnimationFrame(() => {
                            if (pendingStateRef.current) {
                                setResizeState(pendingStateRef.current);
                            }
                            frameRef.current = 0;
                        });
                    }
                };

                const release = () => {
                    target.removeEventListener("pointermove", handleMove);
                    target.removeEventListener("pointerup", handleUp);
                    target.removeEventListener("pointercancel", handleCancel);
                    if (target.hasPointerCapture(newResizeState.pointerId)) {
                        target.releasePointerCapture(newResizeState.pointerId);
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
                    setResizeState(null);
                    latestDraftRef.current = null;
                    release();
                };

                const handleCancel = () => {
                    isResizingRef.current = false;
                    setResizeState(null);
                    latestDraftRef.current = null;
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
        [hourHeight, onCommit, snapMinutes]
    );

    return {
        activeDraft: resizeState?.activeDraft ?? null,
        getResizeProps,
        isResizing: isResizingRef.current,
    };
};
