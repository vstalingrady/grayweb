"use client";

import { useCallback, useEffect, useState } from "react";

import { startOfDay } from "./dateUtils";
import type { CalendarViewMode } from "./dashboardCalendarTypes";

type UseDashboardCalendarDateStateOptions = {
  initialDate?: Date;
  selectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
  viewMode: CalendarViewMode;
};

export const useDashboardCalendarDateState = ({
  initialDate,
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
  viewMode,
}: UseDashboardCalendarDateStateOptions) => {
  const initial = initialDate ? new Date(initialDate) : new Date();

  const [internalSelectedDate, setInternalSelectedDate] = useState(
    () => controlledSelectedDate ?? initial
  );
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;

  const [monthDate, setMonthDate] = useState(() => selectedDate);

  useEffect(() => {
    if (!controlledSelectedDate) {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }
      setMonthDate(controlledSelectedDate);
    });

    return () => {
      cancelled = true;
    };
  }, [controlledSelectedDate]);

  const updateSelectedDate = useCallback(
    (compute: (previous: Date) => Date) => {
      const computeNext = (prev: Date) => {
        const next = compute(prev);
        setMonthDate(next);
        return next;
      };

      if (onSelectedDateChange) {
        const next = computeNext(selectedDate);
        onSelectedDateChange(next);
      } else {
        setInternalSelectedDate((previous) => computeNext(previous));
      }
    },
    [onSelectedDateChange, selectedDate]
  );

  const handleDaySelect = useCallback(
    (nextDate: Date) => {
      updateSelectedDate(() => nextDate);
    },
    [updateSelectedDate]
  );

  const handleMonthNavigate = useCallback((offset: number) => {
    setMonthDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + offset);
      return next;
    });
  }, []);

  const handleNavigateRange = useCallback(
    (direction: number) => {
      updateSelectedDate((previous) => {
        const next = new Date(previous);
        const delta = direction * (viewMode === "week" ? 7 : 1);
        next.setDate(previous.getDate() + delta);
        return next;
      });
    },
    [updateSelectedDate, viewMode]
  );

  const handleGoToday = useCallback(() => {
    updateSelectedDate(() => startOfDay(new Date()));
  }, [updateSelectedDate]);

  const handleMainMonthNavigate = useCallback(
    (offset: number) => {
      updateSelectedDate((previous) => {
        const next = new Date(previous);
        next.setMonth(previous.getMonth() + offset);
        return next;
      });
    },
    [updateSelectedDate]
  );

  return {
    selectedDate,
    monthDate,
    handleDaySelect,
    handleMonthNavigate,
    handleNavigateRange,
    handleGoToday,
    handleMainMonthNavigate,
  };
};
