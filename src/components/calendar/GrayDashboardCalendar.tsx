"use client";

import { useMemo, useRef, useState } from "react";

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

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const HOUR_HEIGHT = 64;
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

const seedCalendars: CalendarInfo[] = [
  { id: "default", label: "Operations", color: "linear-gradient(135deg, #5b8def, #304ffe)", isVisible: true },
  { id: "team", label: "Team", color: "linear-gradient(135deg, #ff7d9d, #ff14c6)", isVisible: true },
  { id: "personal", label: "Personal", color: "linear-gradient(135deg, #20d39c, #0c9f6f)", isVisible: true },
];

const seedEvents: CalendarEvent[] = [
  {
    id: "event-1",
    calendarId: "default",
    title: "Builder cohort sync",
    start: new Date("2025-10-20T09:00:00"),
    end: new Date("2025-10-20T10:30:00"),
    color: "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))",
    entryType: "event",
  },
  {
    id: "event-2",
    calendarId: "team",
    title: "Design review",
    start: new Date("2025-10-20T11:00:00"),
    end: new Date("2025-10-20T12:00:00"),
    color: "linear-gradient(135deg, rgba(255, 125, 157, 0.85), rgba(255, 20, 198, 0.9))",
    entryType: "event",
  },
  {
    id: "event-3",
    calendarId: "personal",
    title: "Run club",
    start: new Date("2025-10-21T07:30:00"),
    end: new Date("2025-10-21T08:15:00"),
    color: "linear-gradient(135deg, rgba(32, 211, 156, 0.9), rgba(12, 159, 111, 0.9))",
    entryType: "task",
  },
  {
    id: "event-4",
    calendarId: "default",
    title: "Roadmap alignment",
    start: new Date("2025-10-22T13:00:00"),
    end: new Date("2025-10-22T14:30:00"),
    color: "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))",
    entryType: "event",
  },
  {
    id: "event-5",
    calendarId: "default",
    title: "Internal demo",
    start: new Date("2025-10-24T16:00:00"),
    end: new Date("2025-10-24T17:00:00"),
    color: "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))",
    entryType: "event",
  },
  {
    id: "event-6",
    calendarId: "team",
    title: "Support rotation",
    start: new Date("2025-10-20T09:30:00"),
    end: new Date("2025-10-20T10:30:00"),
    color: "linear-gradient(135deg, rgba(255, 125, 157, 0.85), rgba(255, 20, 198, 0.9))",
    entryType: "task",
  },
];

const ensureDateZone = (value: Date) => new Date(value.getTime());

type GrayDashboardCalendarProps = {
  initialDate?: Date;
  viewModeLocked?: CalendarViewMode;
  showSidebar?: boolean;
};

export function GrayDashboardCalendar({ initialDate, viewModeLocked, showSidebar = true }: GrayDashboardCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(viewModeLocked ?? "week");
  const initial = initialDate ? new Date(initialDate) : new Date();
  const [selectedDate, setSelectedDate] = useState(() => initial);
  const [monthDate, setMonthDate] = useState(() => initial);
  const [calendars, setCalendars] = useState<CalendarInfo[]>(seedCalendars);
  const [events, setEvents] = useState<CalendarEvent[]>(seedEvents);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [draftPreview, setDraftPreview] = useState<EventDraft | null>(null);

  const dayAnchor = useMemo(() => startOfDay(selectedDate), [selectedDate]);
  const weekAnchor = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const calendarMap = useMemo(() => {
    return new Map(calendars.map((calendar) => [calendar.id, calendar]));
  }, [calendars]);

  const visibleEvents = useMemo(
    () =>
      events.filter((event) => calendarMap.get(event.calendarId)?.isVisible !== false),
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
        hourHeight: HOUR_HEIGHT,
        minimumHeight: 36,
        dayStart: dayAnchor,
      }),
    [dayAnchor, dayEvents]
  );

  const weekLayouts = useMemo(() => {
    return weekDays.map((day) => {
      const dayEventsForWeek = visibleEvents.filter((event) => isSameDay(event.start, day));
      return layoutDayEvents(dayEventsForWeek, {
        hourHeight: HOUR_HEIGHT,
        minimumHeight: 32,
        dayStart: startOfDay(day),
      });
    });
  }, [visibleEvents, weekDays]);

  const dayColumnRef = useRef<HTMLDivElement | null>(null);

  const dragControls = useEventDrag({
    containerRef: dayColumnRef,
    dayAnchor,
    hourHeight: HOUR_HEIGHT,
    snapMinutes: SNAP_MINUTES,
    onPreview: setDraftPreview,
    onCommit: (draft) => {
      setEvents((previous) =>
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
    setCalendars((previous) =>
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
    setEvents((previous) => {
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

  return (
    <div className={styles.dashboardCalendar}>
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
              {viewMode === "week"
                ? formatWeekRange(selectedDate)
                : formatDayLabel(selectedDate)}
            </h2>
          </div>
          <div className={styles.calendarSurfaceActions}>
            {!viewModeLocked && (
              <div className={styles.calendarViewToggle}>
                {["week", "day"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    data-active={viewMode === mode ? "true" : "false"}
                    onClick={() => setViewMode(mode as CalendarViewMode)}
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
        onRequestClose={() => setComposerOpen(false)}
        onSubmit={handleComposerSubmit}
      />
    </div>
  );
}
