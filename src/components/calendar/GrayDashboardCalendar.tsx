"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";

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

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const DEFAULT_HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const CALENDAR_BODY_RESERVED_HEIGHT = 140;

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
  showCreateButton?: boolean;
  onIntegrationAction?: () => void;
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
  showCreateButton = true,
  onIntegrationAction,
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
  const [nowReference, setNowReference] = useState<Date | null>(null);
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
        minimumHeight: 36,
        dayStart: dayAnchor,
      }),
    [dayAnchor, dayEvents, hourHeight]
  );

  const weekLayouts = useMemo(() => {
    return weekDays.map((day) => {
      const dayEventsForWeek = visibleEvents.filter((event) => isSameDay(event.start, day));
      return layoutDayEvents(dayEventsForWeek, {
        hourHeight,
        minimumHeight: 32,
        dayStart: startOfDay(day),
      });
    });
  }, [hourHeight, visibleEvents, weekDays]);

  useEffect(() => {
    const syncNow = () => setNowReference(new Date());
    syncNow();
    const interval = window.setInterval(syncNow, 60000);
    return () => window.clearInterval(interval);
  }, []);

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
  const { getDraggableProps } = dragControls;

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

  const handleCreateEvent = () => {
    const defaultStart = new Date(selectedDate);
    defaultStart.setHours(9, 0, 0, 0);
    openComposerAt(defaultStart);
  };

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
        <div className={styles.calendarHeaderRow}>
          <div className={styles.calendarHeaderPlaceholder} />
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
        <div className={styles.calendarBodyScroll}>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className={styles.calendarWeekColumns}>
            {weekDays.map((day, columnIndex) => {
              const isToday = nowReference ? isSameDay(day, nowReference) : false;
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
                    {weekLayouts[columnIndex]?.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => handleEditEvent(event)}
                      />
                    ))}
                    {isToday && nowReference && (
                      <div
                        className={styles.nowIndicator}
                        style={{ top: `${getNowOffset(nowReference)}px` }}
                      >
                        <span className={styles.nowIndicatorDot} />
                      </div>
                    )}
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
          <div className={styles.calendarHeaderPlaceholder} />
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
        <div className={styles.calendarBodyScroll} ref={dayColumnRef}>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label) => (
              <span key={label}>{label}</span>
            ))}
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
              {dayLayouts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={() => handleEditEvent(event)}
                  draggableProps={viewMode === "day" ? getDraggableProps(event) : undefined}
                  isDragging={draftPreview?.id === event.id}
                />
              ))}
              {dayIndicatorOffset !== null && (
                <div
                  className={styles.nowIndicator}
                  style={{ top: `${dayIndicatorOffset}px` }}
                >
                  <span className={styles.nowIndicatorDot} />
                </div>
              )}
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

  const calendarRootClassName = [
    styles.dashboardCalendar,
    showSidebar ? styles.dashboardCalendarWithSidebar : styles.dashboardCalendarStandalone,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const calendarStyle: CSSProperties & { [key: string]: string | number | undefined } = {
    "--calendar-hour-height": `${hourHeight}px`,
  };

  if (maxHeight !== undefined) {
    const resolvedMaxHeight = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
    calendarStyle["--calendar-max-height"] = resolvedMaxHeight;
    calendarStyle["--calendar-body-height"] = `max(300px, calc(${resolvedMaxHeight} - ${CALENDAR_BODY_RESERVED_HEIGHT}px))`;
  }

  const monthLabel = selectedDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const rangeLabel =
    viewMode === "week" ? formatWeekRange(selectedDate) : formatDayLabel(selectedDate);

  return (
    <div
      className={calendarRootClassName}
      style={calendarStyle}
    >
      <div
        className={[
          styles.calendarSurface,
          compactSurface ? styles.calendarSurfaceCompact : null,
          surfaceClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className={styles.calendarSurfaceHeader}>
          <div className={styles.calendarSurfaceHeaderLeft}>
            {showSurfaceLabel && <span className={styles.calendarSurfaceLabel}>Calendar</span>}
            {showSurfaceHeading && (
              <div>
                <h2 className={styles.calendarSurfaceTitle}>{monthLabel}</h2>
                <p className={styles.calendarSurfaceRange}>{rangeLabel}</p>
              </div>
            )}
          </div>
          <div className={styles.calendarSurfaceHeaderRight}>
            {!viewModeLocked && (
              <select
                aria-label="Calendar view"
                className={styles.calendarViewSelect}
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as CalendarViewMode)}
              >
                <option value="week">Week</option>
                <option value="day">Day</option>
              </select>
            )}
            {showHeaderControls && (
              <div className={styles.calendarSurfaceNav}>
                {showTodayButton && (
                  <button
                    type="button"
                    className={styles.calendarSurfaceButton}
                    onClick={handleGoToday}
                  >
                    Today
                  </button>
                )}
                <div className={styles.calendarSurfaceNavArrows}>
                  <button
                    type="button"
                    aria-label="Previous period"
                    onClick={() => handleNavigateRange(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next period"
                    onClick={() => handleNavigateRange(1)}
                  >
                    ›
                  </button>
                </div>
                {showCreateButton && (
                  <button
                    type="button"
                    className={styles.calendarSurfaceCreate}
                    onClick={handleCreateEvent}
                  >
                    + Create
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        <div
          className={styles.calendarSurfaceBody}
          data-has-sidebar={showSidebar ? "true" : "false"}
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
                onIntegrationAction={onIntegrationAction}
              />
            </div>
          )}
          <div className={styles.calendarBoard}>
            {viewMode === "week" ? renderWeekView() : renderDayView()}
          </div>
        </div>
      </div>

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
    </div>
  );
}
