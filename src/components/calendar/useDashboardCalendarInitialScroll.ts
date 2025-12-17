"use client";

import { useEffect, useRef } from "react";

import type { CalendarViewMode, WeekNowIndicator } from "./dashboardCalendarTypes";
import type { PositionedEvent } from "./types";

type UseDashboardCalendarInitialScrollOptions = {
  viewMode: CalendarViewMode;
  dayColumnRef: React.MutableRefObject<HTMLDivElement | null>;
  weekScrollRef: React.MutableRefObject<HTMLDivElement | null>;
  dayIndicatorOffset: number | null;
  weekNowIndicator: WeekNowIndicator | null;
  dayLayouts: PositionedEvent[];
  hourHeight: number;
};

export const useDashboardCalendarInitialScroll = ({
  viewMode,
  dayColumnRef,
  weekScrollRef,
  dayIndicatorOffset,
  weekNowIndicator,
  dayLayouts,
  hourHeight,
}: UseDashboardCalendarInitialScrollOptions) => {
  const hasInitialDayScrollRef = useRef(false);
  const hasInitialWeekScrollRef = useRef(false);

  useEffect(() => {
    // Only auto-scroll once on initial mount, never interfere with user scrolling
    if (hasInitialDayScrollRef.current || viewMode !== "day") {
      return;
    }
    const container = dayColumnRef.current;
    if (!container) {
      return;
    }

    // Scroll to current time indicator if available
    if (dayIndicatorOffset !== null) {
      const target = Math.max(dayIndicatorOffset - hourHeight, 0);
      container.scrollTo({ top: target });
      hasInitialDayScrollRef.current = true;
      return;
    }

    // Otherwise scroll to first event or top
    if (!dayLayouts.length) {
      return;
    }

    const earliestTop = dayLayouts.reduce(
      (min, event) => Math.min(min, event.top),
      Number.POSITIVE_INFINITY
    );
    const target = Math.max(earliestTop - hourHeight, 0);
    container.scrollTo({ top: target });
    hasInitialDayScrollRef.current = true;
  }, [dayColumnRef, dayIndicatorOffset, dayLayouts, hourHeight, viewMode]);

  useEffect(() => {
    // Only auto-scroll once on initial mount, never interfere with user scrolling
    if (hasInitialWeekScrollRef.current || viewMode !== "week") {
      return;
    }
    const container = weekScrollRef.current;
    if (!container || !weekNowIndicator) {
      return;
    }
    const target = Math.max(weekNowIndicator.offset - hourHeight, 0);
    container.scrollTo({ top: target });
    hasInitialWeekScrollRef.current = true;
  }, [hourHeight, viewMode, weekNowIndicator, weekScrollRef]);
};

