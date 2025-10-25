"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

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
}: GrayDashboardCalendarProps) {
  const hourHeight = hourHeightProp ?? DEFAULT_HOUR_HEIGHT;
  const [viewMode, setViewMode] = useState<CalendarViewMode>(viewModeLocked ?? "week");
  const initial = initialDate ? new Date(initialDate) : new Date();
  const [selectedDate, setSelectedDate] = useState(() => initial);
  const [monthDate, setMonthDate] = useState(() => initial);
  const [calendarsState, setCalendarsState] = useState<CalendarInfo[]>(createSeedCalendars);
  const [eventsState, setEventsState] = useState<CalendarEvent[]>(createSeedEvents);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [draftPreview, setDraftPreview] = useState<EventDraft | null>(null);
  const [nowReference, setNowReference] = useState(() => new Date());

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
    setNowReference(new Date());
    const interval = window.setInterval(() => {
      setNowReference(new Date());
    }, 60000);
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
    () => isSameDay(nowReference, selectedDate),
    [nowReference, selectedDate]
  );

  const dayIndicatorOffset = useMemo(
    () => (showDayNowIndicator ? getNowOffset(nowReference) : null),
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

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setComposerOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setComposerOpen(true);
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
  };

  const renderWeekView = () => (
    <div className={styles.calendarGrid}>
      <div className={styles.calendarHeaderRow}>
        <div className={styles.calendarHeaderPlaceholder} />
        {weekDays.map((day) => (
          <div key={day.toISOString()} className={styles.calendarHeaderCell}>
            <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
            <strong>{day.getDate()}</strong>
          </div>
        ))}
      </div>
      <div className={styles.calendarBody}>
        <div className={styles.calendarBodyScroll}>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className={styles.calendarWeekColumns}>
            {weekDays.map((day, columnIndex) => (
              <div key={day.toISOString()} className={styles.calendarWeekColumn}>
                <div className={styles.calendarColumnScroller}>
                  {weekLayouts[columnIndex]?.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => handleEditEvent(event)}
                    />
                  ))}
                  {isSameDay(day, nowReference) && (
                    <div
                      className={styles.nowIndicator}
                      style={{ top: `${getNowOffset(nowReference)}px` }}
                    >
                      <span className={styles.nowIndicatorDot} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDayView = () => (
    <div className={styles.calendarGrid}>
      <div className={styles.calendarHeaderRow}>
        <div className={styles.calendarHeaderPlaceholder} />
        <div className={styles.calendarHeaderCell}>
          <span>{selectedDate.toLocaleDateString(undefined, { weekday: "short" })}</span>
          <strong>{selectedDate.getDate()}</strong>
        </div>
      </div>
      <div className={styles.calendarBody}>
        <div className={styles.calendarBodyScroll} ref={dayColumnRef}>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className={styles.calendarDayColumn}>
            <div className={styles.calendarColumnScroller}>
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

  const handleDaySelect = (nextDate: Date) => {
    setSelectedDate(nextDate);
    setMonthDate(nextDate);
  };

  const handleMonthNavigate = (offset: number) => {
    setMonthDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + offset);
      return next;
    });
  };

  const calendarRootClassName = [
    styles.dashboardCalendar,
    showSidebar ? styles.dashboardCalendarWithSidebar : styles.dashboardCalendarStandalone,
  ].join(" ");

  const calendarStyle: CSSProperties = {
    "--calendar-hour-height": `${hourHeight}px`,
  };

  if (maxHeight !== undefined) {
    calendarStyle["--calendar-max-height"] =
      typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
  }

  return (
    <div
      className={calendarRootClassName}
      style={calendarStyle}
    >
      {showSidebar && (
        <CalendarSidebar
          monthDate={monthDate}
          selectedDate={selectedDate}
          onSelectDate={handleDaySelect}
          onNavigateMonth={handleMonthNavigate}
          calendars={calendars}
          onToggleCalendar={handleToggleCalendar}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
        />
      )}

      <div className={styles.calendarSurface}>
        <header className={styles.calendarSurfaceHeader}>
          <div>
            <span className={styles.calendarSurfaceEyebrow}>
              {viewMode === "week" ? "Week" : "Day"}
            </span>
            <h2>
              {viewMode === "week" ? formatWeekRange(selectedDate) : formatDayLabel(selectedDate)}
            </h2>
          </div>
          <div className={styles.calendarSurfaceActions}>
            {!viewModeLocked && (
              <div className={styles.calendarViewToggle}>
                {(["week", "day"] as CalendarViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    data-active={viewMode === mode ? "true" : "false"}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={handleCreateEvent}>
              + New
            </button>
          </div>
        </header>

        {viewMode === "week" ? renderWeekView() : renderDayView()}
      </div>

      <EventComposer
        isOpen={composerOpen}
        referenceDate={selectedDate}
        activeEvent={editingEvent}
        calendars={calendars}
        onRequestClose={() => {
          setComposerOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={handleComposerSubmit}
      />
    </div>
  );
}
