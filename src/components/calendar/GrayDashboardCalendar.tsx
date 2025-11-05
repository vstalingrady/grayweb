"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { CalendarSidebar } from "./CalendarSidebar";
import { EventCard } from "./EventCard";
import { EventComposer, EventComposerPayload } from "./EventComposer";
import { layoutDayEvents } from "./layoutDayEvents";
import { useEventDrag } from "./useEventDrag";
import {
  CalendarEvent,
  CalendarInfo,
  EventDraft,
  PositionedEvent,
} from "./types";
import { createSeedCalendars, createSeedEvents } from "./calendarSeed";
import type { DashboardHeaderProps } from "@/components/gray/DashboardHeader";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const DEFAULT_HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const CALENDAR_BODY_RESERVED_HEIGHT = 140;
const TIMELINE_WIDTH = 56;

type CalendarViewMode = "week" | "day";

const startOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

const startOfWeek = (value: Date) => {
  const result = startOfDay(value);
  result.setDate(result.getDate() - result.getDay());
  return result;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatWeekRange = (reference: Date) => {
  const start = startOfWeek(reference);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  });

  const startLabel = formatter.format(start);
  const endLabel = formatter.format(end);
  const year = end.getFullYear();
  return `${startLabel} — ${endLabel}, ${year}`;
};

const formatDayLabel = (value: Date) =>
  value.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const HOURS_LABEL = HOURS.map((hour) => {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
});

const ensureDateZone = (value: Date) => new Date(value.getTime());

type GrayDashboardCalendarProps = {
  initialDate?: Date;
  viewModeLocked?: CalendarViewMode;
  showSidebar?: boolean;
  events?: CalendarEvent[];
  calendars?: CalendarInfo[];
  onEventsChange?: (events: CalendarEvent[]) => void;
  onCalendarsChange?: (calendars: CalendarInfo[]) => void;
  hourHeight?: number;
  maxHeight?: number | string;
  showSelectedDateLabel?: boolean;
  showSurfaceLabel?: boolean;
  showSurfaceHeading?: boolean;
  showHeaderControls?: boolean;
  showHeaderDates?: boolean;
  compactSurface?: boolean;
  className?: string;
  surfaceClassName?: string;
  showTodayButton?: boolean;
  onIntegrationAction?: () => void;
  dashboardTab?: "pulse" | "calendar";
  onSelectDashboardTab?: (tab: "pulse" | "calendar") => void;
  renderHeader?: (props: DashboardHeaderProps) => ReactNode;
  embedWithinParentSurface?: boolean;
  currentDate?: Date;
};

export function GrayDashboardCalendar({
  initialDate,
  viewModeLocked,
  showSidebar = true,
  events: externalEvents,
  calendars: externalCalendars,
  onEventsChange,
  onCalendarsChange,
  hourHeight: hourHeightProp,
  maxHeight,
  showSelectedDateLabel = true,
  showSurfaceLabel = true,
  showSurfaceHeading = true,
  showHeaderControls = true,
  showHeaderDates = true,
  compactSurface = false,
  className,
  surfaceClassName,
  showTodayButton = true,
  onIntegrationAction,
  dashboardTab = "calendar",
  onSelectDashboardTab,
  renderHeader,
  embedWithinParentSurface = false,
  currentDate,
}: GrayDashboardCalendarProps) {
  const hourHeight = hourHeightProp ?? DEFAULT_HOUR_HEIGHT;
  const [viewMode, setViewMode] = useState<CalendarViewMode>(viewModeLocked ?? "week");
  const initial = initialDate ? new Date(initialDate) : new Date();
  const [selectedDate, setSelectedDate] = useState(() => initial);
  const [monthDate, setMonthDate] = useState(() => initial);
  const [calendarsState, setCalendarsState] = useState<CalendarInfo[]>(createSeedCalendars);
  const [eventsState, setEventsState] = useState<CalendarEvent[]>(createSeedEvents);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [draftPreview, setDraftPreview] = useState<EventDraft | null>(null);
  const [nowReference, setNowReference] = useState<Date | null>(() => currentDate ?? null);
  const [composerRange, setComposerRange] = useState<{ start: Date; end: Date } | null>(null);

  const calendars = externalCalendars ?? calendarsState;
  const events = externalEvents ?? eventsState;

  const updateCalendars = (updater: (previous: CalendarInfo[]) => CalendarInfo[]) => {
    if (externalCalendars && onCalendarsChange) {
      onCalendarsChange(updater(externalCalendars));
      return;
    }
    setCalendarsState((previous) => {
      const next = updater(previous);
      onCalendarsChange?.(next);
      return next;
    });
  };

  const updateEvents = (updater: (previous: CalendarEvent[]) => CalendarEvent[]) => {
    if (externalEvents && onEventsChange) {
      onEventsChange(updater(externalEvents));
      return;
    }
    setEventsState((previous) => {
      const next = updater(previous);
      onEventsChange?.(next);
      return next;
    });
  };

  const dayAnchor = useMemo(() => startOfDay(selectedDate), [selectedDate]);
  const weekAnchor = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const calendarMap = useMemo(() => new Map(calendars.map((calendar) => [calendar.id, calendar])), [calendars]);

  const shortEventMinimumHeight = useMemo(
    () => Math.max(Math.round(hourHeight / 4), 12),
    [hourHeight]
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => calendarMap.get(event.calendarId)?.isVisible !== false),
    [calendarMap, events]
  );

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekAnchor);
        date.setDate(weekAnchor.getDate() + index);
        return date;
      }),
    [weekAnchor]
  );

  const timeZoneLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" });
    const parts = formatter.formatToParts(new Date());
    const zone = parts.find((part) => part.type === "timeZoneName")?.value;
    return zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  const dayEvents = useMemo(() => {
    const filtered = visibleEvents.filter((event) => isSameDay(event.start, selectedDate));
    if (draftPreview) {
      return filtered.map((event) =>
        event.id === draftPreview.id
          ? { ...event, start: ensureDateZone(draftPreview.start), end: ensureDateZone(draftPreview.end) }
          : event
      );
    }
    return filtered;
  }, [draftPreview, selectedDate, visibleEvents]);

  const dayLayouts = useMemo<PositionedEvent[]>(
    () =>
      layoutDayEvents(dayEvents, {
        hourHeight,
        minimumHeight: shortEventMinimumHeight,
        dayStart: dayAnchor,
      }),
    [dayAnchor, dayEvents, hourHeight, shortEventMinimumHeight]
  );

  const weekLayouts = useMemo(() => {
    return weekDays.map((day) => {
      const dayEventsForWeek = visibleEvents.filter((event) => isSameDay(event.start, day));
      return layoutDayEvents(dayEventsForWeek, {
        hourHeight,
        minimumHeight: shortEventMinimumHeight,
        dayStart: startOfDay(day),
      });
    });
  }, [hourHeight, shortEventMinimumHeight, visibleEvents, weekDays]);

  const updateViewMode = useCallback(
    (nextMode: CalendarViewMode) => {
      if (viewModeLocked) {
        return;
      }
      setViewMode(nextMode);
    },
    [viewModeLocked]
  );

  const handleViewModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    updateViewMode(event.target.value as CalendarViewMode);
  };

  const rangeNavigationLabel = viewMode === "week" ? "week" : "day";
  const shouldShowDashboardToggle = typeof onSelectDashboardTab === "function";

  useEffect(() => {
    if (currentDate) {
      setNowReference(currentDate);
    } else {
      const syncNow = () => setNowReference(new Date());
      syncNow();
      const interval = window.setInterval(syncNow, 60000);
      return () => window.clearInterval(interval);
    }
  }, [currentDate]);

  const getNowOffset = useCallback(
    (reference: Date) => {
      const minutes = reference.getHours() * 60 + reference.getMinutes() + reference.getSeconds() / 60;
      const offset = (minutes / 60) * hourHeight;
      const maxOffset = hourHeight * 24;
      return Math.min(Math.max(offset, 0), maxOffset);
    },
    [hourHeight]
  );

  const showDayNowIndicator = useMemo(
    () => (nowReference ? isSameDay(nowReference, selectedDate) : false),
    [nowReference, selectedDate]
  );

  const dayIndicatorOffset = useMemo(
    () => (showDayNowIndicator && nowReference ? getNowOffset(nowReference) : null),
    [showDayNowIndicator, nowReference, getNowOffset]
  );

  const weekNowIndicator = useMemo(() => {
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

  const dayColumnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (viewMode !== "day") {
      return;
    }
    const container = dayColumnRef.current;
    if (!container) {
      return;
    }
    if (!dayLayouts.length) {
      container.scrollTop = 0;
      return;
    }

    const earliestTop = dayLayouts.reduce((min, event) => Math.min(min, event.top), Number.POSITIVE_INFINITY);
    const target = Math.max(earliestTop - hourHeight, 0);
    if (Math.abs(container.scrollTop - target) > 4) {
      container.scrollTo({ top: target });
    }
  }, [dayLayouts, hourHeight, viewMode]);

  const dragControls = useEventDrag({
    containerRef: dayColumnRef,
    dayAnchor,
    hourHeight,
    snapMinutes: SNAP_MINUTES,
    onPreview: setDraftPreview,
    onCommit: (draft) => {
      updateEvents((previous) =>
        previous.map((event) =>
          event.id === draft.id
            ? { ...event, start: ensureDateZone(draft.start), end: ensureDateZone(draft.end) }
            : event
        )
      );
      setDraftPreview(null);
    },
  });
  const { getDraggableProps, suppressClickRef } = dragControls;

  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  const [weekScrollbarWidth, setWeekScrollbarWidth] = useState(0);

  useEffect(() => {
    if (viewMode !== "week") {
      return;
    }
    const element = weekScrollRef.current;
    if (!element) {
      return;
    }

    const updateScrollbarWidth = () => {
      const nextWidth = element.offsetWidth - element.clientWidth;
      setWeekScrollbarWidth(nextWidth > 0 ? nextWidth : 0);
    };

    updateScrollbarWidth();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollbarWidth);
      resizeObserver.observe(element);
    } else {
      window.addEventListener("resize", updateScrollbarWidth);
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateScrollbarWidth);
    };
  }, [viewMode, weekDays]);

  const handleToggleCalendar = (calendarId: string) => {
    updateCalendars((previous) =>
      previous.map((calendar) =>
        calendar.id === calendarId
          ? { ...calendar, isVisible: !calendar.isVisible }
          : calendar
      )
    );
  };

  const openComposerAt = useCallback(
    (startDate: Date) => {
      const alignedStart = new Date(startDate);
      alignedStart.setMinutes(Math.floor(alignedStart.getMinutes() / SNAP_MINUTES) * SNAP_MINUTES, 0, 0);
      const alignedEnd = new Date(alignedStart.getTime() + 30 * 60000);
      setComposerRange({ start: alignedStart, end: alignedEnd });
      setEditingEvent(null);
      setComposerOpen(true);
    },
    []
  );

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setComposerOpen(true);
    setComposerRange(null);
  };

  const handleComposerSubmit = ({ id, ...payload }: EventComposerPayload) => {
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
    setComposerOpen(false);
    setEditingEvent(null);
    setComposerRange(null);
  };

  const handleColumnClick = (event: MouseEvent<HTMLDivElement>, day: Date) => {
    if (suppressClickRef.current) {
      return;
    }
    if (event.target !== event.currentTarget) {
      return;
    }
    const target = event.currentTarget;
    const bounds = target.getBoundingClientRect();
    const offsetY = event.clientY - bounds.top;
    const minutes = Math.max(0, Math.min(24 * 60, Math.round((offsetY / hourHeight) * 60 / SNAP_MINUTES) * SNAP_MINUTES));
    const start = new Date(day);
    start.setHours(0, minutes, 0, 0);
    openComposerAt(start);
  };

  const renderWeekView = () => (
    <div className={styles.calendarGrid}>
      {showHeaderDates && (
        <div
          className={styles.calendarHeaderRow}
          style={
            weekScrollbarWidth > 0
              ? ({ "--calendar-scrollbar-compensation": `${weekScrollbarWidth}px` } as CSSProperties)
              : undefined
          }
        >
          <div className={styles.calendarHeaderPlaceholder}>
            <span className={styles.calendarTimezoneLabel}>{timeZoneLabel}</span>
          </div>
          {weekDays.map((day) => {
            const isSelectedDay = isSameDay(day, selectedDate);
            const isToday = nowReference ? isSameDay(day, nowReference) : false;
            return (
              <div
                key={day.toISOString()}
                className={styles.calendarHeaderCell}
                data-selected={isSelectedDay ? "true" : "false"}
                data-today={isToday ? "true" : "false"}
              >
                <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <strong>{day.getDate()}</strong>
              </div>
            );
          })}
        </div>
      )}
      <div className={styles.calendarBody}>
        <div className={styles.calendarBodyScroll} ref={weekScrollRef}>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label, hour) => (
              <span key={label} data-hour={hour}>
                {label}
              </span>
            ))}
            {weekNowIndicator && (
              <>
                <div
                  className={styles.calendarTimelineNowLine}
                  style={{ top: `${weekNowIndicator.offset}px` }}
                  aria-hidden="true"
                />
                <div
                  className={styles.calendarTimelineNowMarker}
                  style={{ top: `${weekNowIndicator.offset}px` }}
                  aria-hidden="true"
                />
              </>
            )}
          </div>
          <div className={styles.calendarWeekColumns}>
            {weekDays.map((day, columnIndex) => {
              const isToday = nowReference ? isSameDay(day, nowReference) : false;
              const columnNowIndicatorOffset =
                weekNowIndicator?.dayIndex === columnIndex ? weekNowIndicator.offset : null;
              return (
                <div
                  key={day.toISOString()}
                  className={styles.calendarWeekColumn}
                  data-today={isToday ? "true" : "false"}
                  data-selected={isSameDay(day, selectedDate) ? "true" : "false"}
                >
                  <div
                    className={styles.calendarColumnScroller}
                    onClick={(event) => handleColumnClick(event, day)}
                  >
                    <div className={styles.calendarHourGrid} aria-hidden="true">
                      {HOURS.map((hour) => (
                        <div key={hour} className={styles.calendarHourRow} />
                      ))}
                    </div>
                    {columnNowIndicatorOffset !== null && (
                      <>
                        <div
                          className={styles.nowIndicator}
                          style={{ top: `${columnNowIndicatorOffset}px` }}
                          aria-hidden="true"
                        />
                        <div
                          className={styles.nowIndicatorDot}
                          style={{ top: `${columnNowIndicatorOffset}px` }}
                          aria-hidden="true"
                        />
                      </>
                    )}
                    {weekLayouts[columnIndex]?.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => {
                          if (!suppressClickRef.current) {
                            handleEditEvent(event);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDayView = () => (
    <div className={styles.calendarGrid}>
      {showHeaderDates && (
        <div className={styles.calendarHeaderRow}>
          <div className={styles.calendarHeaderPlaceholder}>
            <span className={styles.calendarTimezoneLabel}>{timeZoneLabel}</span>
          </div>
          <div
            className={styles.calendarHeaderCell}
            data-selected="true"
            data-today={(nowReference ? isSameDay(selectedDate, nowReference) : false) ? "true" : "false"}
          >
            <span>{selectedDate.toLocaleDateString(undefined, { weekday: "short" })}</span>
            <strong>{selectedDate.getDate()}</strong>
          </div>
        </div>
      )}
      <div className={styles.calendarBody}>
        <div
          className={styles.calendarBodyScroll}
          ref={dayColumnRef}
          style={{ "--calendar-grid-columns": "1" } as CSSProperties}
        >
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label, hour) => (
              <span key={label} data-hour={hour}>
                {label}
              </span>
            ))}
            {dayIndicatorOffset !== null && (
              <>
                <div
                  className={styles.calendarTimelineNowLine}
                  style={{ top: `${dayIndicatorOffset}px` }}
                  aria-hidden="true"
                />
                <div
                  className={styles.calendarTimelineNowMarker}
                  style={{ top: `${dayIndicatorOffset}px` }}
                  aria-hidden="true"
                />
              </>
            )}
          </div>
          <div
            className={styles.calendarDayColumn}
            data-selected="true"
            data-today={(nowReference ? isSameDay(selectedDate, nowReference) : false) ? "true" : "false"}
          >
            <div
              className={styles.calendarColumnScroller}
              onClick={(event) => handleColumnClick(event, selectedDate)}
            >
              <div className={styles.calendarHourGrid} aria-hidden="true">
                {HOURS.map((hour) => (
                  <div key={hour} className={styles.calendarHourRow} />
                ))}
              </div>
              {dayIndicatorOffset !== null && (
                <>
                  <div
                    className={styles.nowIndicator}
                    style={{ top: `${dayIndicatorOffset}px` }}
                    aria-hidden="true"
                  />
                  <div
                    className={styles.nowIndicatorDot}
                    style={{ top: `${dayIndicatorOffset}px` }}
                    aria-hidden="true"
                  />
                </>
              )}
              {dayLayouts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => {
                    if (!suppressClickRef.current) {
                      handleEditEvent(event);
                    }
                  }}
                  draggableProps={viewMode === "day" ? getDraggableProps(event) : undefined}
                  isDragging={draftPreview?.id === event.id}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const updateSelectedDate = useCallback(
    (compute: (previous: Date) => Date) => {
      setSelectedDate((previous) => {
        const next = compute(previous);
        setMonthDate(next);
        return next;
      });
    },
    []
  );

  const handleDaySelect = (nextDate: Date) => {
    updateSelectedDate(() => nextDate);
  };

  const handleMonthNavigate = (offset: number) => {
    setMonthDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + offset);
      return next;
    });
  };

  const handleNavigateRange = (direction: number) => {
    updateSelectedDate((previous) => {
      const next = new Date(previous);
      const delta = direction * (viewMode === "week" ? 7 : 1);
      next.setDate(previous.getDate() + delta);
      return next;
    });
  };

  const handleGoToday = () => {
    updateSelectedDate(() => startOfDay(new Date()));
  };

  const calendarStyle: CSSProperties & { [key: string]: string | number | undefined } = {
    "--calendar-hour-height": `${hourHeight}px`,
    "--calendar-timeline-width": `${TIMELINE_WIDTH}px`,
  };

  if (maxHeight !== undefined) {
    const resolvedMaxHeight = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
    calendarStyle["--calendar-max-height"] = resolvedMaxHeight;

    if (compactSurface) {
      calendarStyle["--calendar-body-height"] = resolvedMaxHeight;
    } else if (embedWithinParentSurface) {
      calendarStyle["--calendar-body-height"] = resolvedMaxHeight;
    } else {
      calendarStyle["--calendar-body-height"] = `max(300px, calc(${resolvedMaxHeight} - ${CALENDAR_BODY_RESERVED_HEIGHT}px))`;
    }
  } else if (embedWithinParentSurface || compactSurface) {
    calendarStyle["--calendar-max-height"] = "100%";
    calendarStyle["--calendar-body-height"] = "calc(100% - 0px)";
  } else {
    calendarStyle["--calendar-max-height"] = "100%";
    calendarStyle["--calendar-body-height"] = "calc(100% - 0px)";
  }

  const monthLabel = selectedDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const rangeLabel =
    viewMode === "week" ? formatWeekRange(selectedDate) : formatDayLabel(selectedDate);

  const calendarSurfaceClassName = [
    styles.dashboardCalendar,
    showSidebar ? styles.dashboardCalendarWithSidebar : styles.dashboardCalendarStandalone,
    styles.calendarSurface,
    compactSurface ? styles.calendarSurfaceCompact : null,
    surfaceClassName,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const showViewSelect = showHeaderControls && !viewModeLocked;
  const showTodayControl = showHeaderControls && showTodayButton;
  const showNavigationControls = showHeaderControls;
  const hasHeaderRight =
    showNavigationControls || showTodayControl || showViewSelect;
  const shouldRenderHeader = shouldShowDashboardToggle || showSurfaceHeading || hasHeaderRight;

  const headerProps: DashboardHeaderProps = {
    activeTab: dashboardTab ?? "calendar",
    onSelectTab: (tab) => onSelectDashboardTab?.(tab),
    label: showSurfaceLabel ? "Calendar" : undefined,
    title: monthLabel,
    rangeLabel: showHeaderDates ? rangeLabel : undefined,
    onPrevMonth: () => handleMonthNavigate(-1),
    onNextMonth: () => handleMonthNavigate(1),
    onPrevRange: () => handleNavigateRange(-1),
    onNextRange: () => handleNavigateRange(1),
    onGoToday: showTodayControl ? handleGoToday : undefined,
    viewMode,
    onViewModeChange: showViewSelect ? updateViewMode : undefined,
    viewModeOptions: [
      { value: "week", label: "Week" },
      { value: "day", label: "Day" },
    ],
    rangeNavigationLabel,
  };

  const dashboardToggle = shouldShowDashboardToggle ? (
    <div className={styles.calendarSurfaceHeadingGroup}>
      <div className={styles.calendarSurfaceTabs}>
        <button
          type="button"
          className={styles.calendarSurfaceTab}
          data-active={dashboardTab === "pulse"}
          aria-pressed={dashboardTab === "pulse"}
          onClick={() => onSelectDashboardTab?.("pulse")}
        >
          Pulse
        </button>
        <button
          type="button"
          className={styles.calendarSurfaceTab}
          data-active={dashboardTab === "calendar"}
          aria-pressed={dashboardTab === "calendar"}
          onClick={() => onSelectDashboardTab?.("calendar")}
        >
          Calendar
        </button>
      </div>
    </div>
  ) : null;

  const headerNode = renderHeader
    ? renderHeader(headerProps)
    : shouldRenderHeader
      ? (
        <header className={styles.calendarSurfaceHeader}>
          <div className={styles.calendarSurfaceHeaderLeft}>
            {dashboardToggle}
            {showSurfaceHeading && (
              <>
                {showSurfaceLabel && (
                  <span className={styles.calendarSurfaceLabel}>Calendar</span>
                )}
                <h2 className={styles.calendarSurfaceTitle}>{monthLabel}</h2>
                {showHeaderDates && (
                  <p className={styles.calendarSurfaceRange}>{rangeLabel}</p>
                )}
              </>
            )}
          </div>
          {hasHeaderRight && (
            <div className={styles.calendarSurfaceHeaderRight}>
              <div className={styles.calendarSurfaceNav}>
                {showNavigationControls && (
                  <>
                    <div className={styles.calendarSurfaceNavArrows}>
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => handleMonthNavigate(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => handleMonthNavigate(1)}
                      >
                        ›
                      </button>
                    </div>
                    <div className={styles.calendarSurfaceNavArrows}>
                      <button
                        type="button"
                        aria-label={`Previous ${rangeNavigationLabel}`}
                        onClick={() => handleNavigateRange(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label={`Next ${rangeNavigationLabel}`}
                        onClick={() => handleNavigateRange(1)}
                      >
                        ›
                      </button>
                    </div>
                  </>
                )}
                {showTodayControl && (
                  <button
                    type="button"
                    className={styles.calendarSurfaceButton}
                    onClick={handleGoToday}
                  >
                    Today
                  </button>
                )}
                {showViewSelect && (
                  <select
                    className={styles.calendarViewSelect}
                    value={viewMode}
                    onChange={handleViewModeChange}
                  >
                    <option value="week">Week</option>
                    <option value="day">Day</option>
                  </select>
                )}
              </div>
            </div>
          )}
        </header>
      )
      : null;

  const bodyClassName = [
    styles.calendarSurfaceBody,
    embedWithinParentSurface && surfaceClassName ? surfaceClassName : null,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyElement = (
    <div
      className={bodyClassName}
      data-has-sidebar={showSidebar ? "true" : "false"}
      style={embedWithinParentSurface ? calendarStyle : undefined}
    >
      {showSidebar && (
        <div className={styles.calendarSidebarPanel}>
          <CalendarSidebar
            monthDate={monthDate}
            selectedDate={selectedDate}
            onSelectDate={handleDaySelect}
            onNavigateMonth={handleMonthNavigate}
            calendars={calendars}
            onToggleCalendar={handleToggleCalendar}
            showSelectedDateLabel={showSelectedDateLabel}
            className={styles.calendarSidebarIntegrated}
            showMonthNavigation
            onIntegrationAction={onIntegrationAction}
          />
        </div>
      )}
      <div className={styles.calendarBoard}>
        {viewMode === "week" ? renderWeekView() : renderDayView()}
      </div>
    </div>
  );

  const eventComposer = (
    <EventComposer
      isOpen={composerOpen}
      referenceDate={selectedDate}
      activeEvent={editingEvent}
      initialRange={composerRange}
      calendars={calendars}
      onRequestClose={() => {
        setComposerOpen(false);
        setEditingEvent(null);
        setComposerRange(null);
      }}
      onSubmit={handleComposerSubmit}
    />
  );

  if (embedWithinParentSurface) {
    return (
      <>
        {headerNode}
        {bodyElement}
        {eventComposer}
      </>
    );
  }

  return (
    <div
      className={calendarSurfaceClassName}
      style={calendarStyle}
    >
      {headerNode}
      {bodyElement}
      {eventComposer}
    </div>
  );
}
