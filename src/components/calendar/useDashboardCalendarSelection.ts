"use client";

import { useCallback, useState } from "react";

export const useDashboardCalendarSelection = () => {
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(() => new Set());

  const clearSelection = useCallback(() => {
    setSelectedEventIds(new Set());
  }, []);

  const toggleSelection = useCallback((eventId: string) => {
    setSelectedEventIds((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const selectSingle = useCallback((eventId: string) => {
    setSelectedEventIds(new Set([eventId]));
  }, []);

  return {
    selectedEventIds,
    clearSelection,
    toggleSelection,
    selectSingle,
  };
};

