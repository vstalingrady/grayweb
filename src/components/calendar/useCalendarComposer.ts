"use client";

import { useCallback, useMemo, useState } from "react";

import type { ComposerState, EventComposerPayload } from "./EventComposer";
import type { CalendarEvent } from "./types";
import type { ComposerAnchorRect } from "./dashboardCalendarTypes";

type UseCalendarComposerOptions = {
  events: CalendarEvent[];
  updateEvents: (updater: (previous: CalendarEvent[]) => CalendarEvent[]) => void;
  onEventDelete?: (event: CalendarEvent) => void;
  onCreatePlan?: (payload: EventComposerPayload) => void;
  onCreateHabit?: (payload: EventComposerPayload) => void;
  onClearSelection: () => void;
};

export const useCalendarComposer = ({
  events,
  updateEvents,
  onEventDelete,
  onCreatePlan,
  onCreateHabit,
  onClearSelection,
}: UseCalendarComposerOptions) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [composerRange, setComposerRange] = useState<{ start: Date; end: Date } | null>(null);
  const [composerAnchorRect, setComposerAnchorRect] = useState<ComposerAnchorRect | null>(null);
  const [composerDraft, setComposerDraft] = useState<ComposerState | null>(null);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setEditingEvent(null);
    setComposerRange(null);
    setComposerAnchorRect(null);
  }, []);

  const openComposerAt = useCallback(
    (startDate: Date, anchorRect?: ComposerAnchorRect | null) => {
      const alignedStart = new Date(startDate);
      alignedStart.setSeconds(0, 0);
      const alignedEnd = new Date(alignedStart.getTime() + 30 * 60000);
      setComposerRange({ start: alignedStart, end: alignedEnd });
      setEditingEvent(null);
      setComposerAnchorRect(anchorRect ?? null);
      setComposerOpen(true);
      onClearSelection();
    },
    [onClearSelection]
  );

  const editEvent = useCallback(
    (event: CalendarEvent, anchorRect?: DOMRect | DOMRectReadOnly | null) => {
      setEditingEvent(event);
      setComposerOpen(true);
      setComposerRange(null);
      if (anchorRect) {
        setComposerAnchorRect({
          top: anchorRect.top,
          left: anchorRect.left,
          width: anchorRect.width,
          height: anchorRect.height,
        });
      } else {
        setComposerAnchorRect(null);
      }
    },
    []
  );

  const handleComposerSubmit = useCallback(
    ({ id, ...payload }: EventComposerPayload) => {
      if (payload.entryType === "plan" && onCreatePlan) {
        onCreatePlan({ id, ...payload });
        closeComposer();
        return;
      }

      if (payload.entryType === "habit" && onCreateHabit) {
        onCreateHabit({ id, ...payload });
        closeComposer();
        return;
      }

      updateEvents((previous) => {
        if (id) {
          return previous.map((event) =>
            event.id === id
              ? {
                  ...event,
                  ...payload,
                }
              : event
          );
        }

        const newEvent: CalendarEvent = {
          id: `evt-${Date.now()}`,
          ...payload,
        };
        return [...previous, newEvent];
      });
      closeComposer();
    },
    [closeComposer, onCreateHabit, onCreatePlan, updateEvents]
  );

  const handleComposerDelete = useCallback(
    (eventId: string) => {
      const eventToDelete = events.find((event) => event.id === eventId);
      if (eventToDelete && onEventDelete) {
        onEventDelete(eventToDelete);
      }
      updateEvents((previous) => previous.filter((event) => event.id !== eventId));
      closeComposer();
    },
    [closeComposer, events, onEventDelete, updateEvents]
  );

  const composerPreviewEvent = useMemo<CalendarEvent | null>(() => {
    if (!composerOpen) {
      return null;
    }
    if (editingEvent) {
      const draftTitle = composerDraft?.title?.trim();
      return {
        ...editingEvent,
        title: draftTitle ? draftTitle : editingEvent.title,
        color: composerDraft?.color ?? editingEvent.color,
        entryType: composerDraft?.entryType ?? editingEvent.entryType,
        calendarId: composerDraft?.calendarId ?? editingEvent.calendarId,
        description: composerDraft?.details?.trim() ? composerDraft.details.trim() : editingEvent.description,
        reminderMinutesBefore:
          composerDraft?.reminderMinutesBefore ?? editingEvent.reminderMinutesBefore,
      };
    }
    if (!composerRange) {
      return null;
    }
    const draftTitle = composerDraft?.title?.trim();
    return {
      id: "composer-preview",
      title: draftTitle ? draftTitle : "",
      start: composerRange.start,
      end: composerRange.end,
      color: composerDraft?.color || "#3D6F73",
      entryType: composerDraft?.entryType || "event",
      calendarId: "preview",
    };
  }, [composerDraft, composerOpen, composerRange, editingEvent]);

  return {
    composerOpen,
    editingEvent,
    composerRange,
    composerAnchorRect,
    composerPreviewEvent,
    setComposerDraft,
    openComposerAt,
    editEvent,
    closeComposer,
    handleComposerSubmit,
    handleComposerDelete,
  };
};
