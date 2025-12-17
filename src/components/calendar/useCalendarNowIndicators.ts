"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isSameDay } from "./dateUtils";
import type { WeekNowIndicator } from "./dashboardCalendarTypes";

type UseCalendarNowIndicatorsOptions = {
  currentDate?: Date;
  selectedDate: Date;
  weekDays: Date[];
  hourHeight: number;
};

export const useCalendarNowIndicators = ({
  currentDate,
  selectedDate,
  weekDays,
  hourHeight,
}: UseCalendarNowIndicatorsOptions) => {
  const [internalNow, setInternalNow] = useState<Date | null>(() => currentDate ?? null);

  useEffect(() => {
    if (currentDate) {
      return;
    }

    let cancelled = false;
    const syncNow = () => {
      if (cancelled) {
        return;
      }
      setInternalNow(new Date());
    };

    void Promise.resolve().then(syncNow);
    const interval = window.setInterval(syncNow, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentDate]);

  const nowReference = currentDate ?? internalNow;

  const getNowOffset = useCallback(
    (reference: Date) => {
      const minutes =
        reference.getHours() * 60 + reference.getMinutes() + reference.getSeconds() / 60;
      const offset = (minutes / 60) * hourHeight;
      const maxOffset = hourHeight * 24;
      return Math.min(Math.max(offset, 0), maxOffset);
    },
    [hourHeight]
  );

  const dayIndicatorOffset = useMemo(() => {
    if (!nowReference) {
      return null;
    }
    if (!isSameDay(nowReference, selectedDate)) {
      return null;
    }
    return getNowOffset(nowReference);
  }, [getNowOffset, nowReference, selectedDate]);

  const weekNowIndicator = useMemo<WeekNowIndicator | null>(() => {
    if (!nowReference) {
      return null;
    }
    const dayIndex = weekDays.findIndex((day) => isSameDay(day, nowReference));
    if (dayIndex === -1) {
      return null;
    }
    return {
      offset: getNowOffset(nowReference),
      dayIndex,
    };
  }, [getNowOffset, nowReference, weekDays]);

  return { nowReference, dayIndicatorOffset, weekNowIndicator };
};

