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
const TIMELINE_WIDTH = 56;

type CalendarViewMode = "week" | "day";
type ComposerAnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

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
  selectedDate?: Date;
  onSelectedDateChange?: (date: Date) => void;
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
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
}: GrayDashboardCalendarProps) {
  const hourHeight = hourHeightProp ?? DEFAULT_HOUR_HEIGHT;
  const [viewMode, setViewMode] = useState<CalendarViewMode>(viewModeLocked ?? "week");
  const initial = initialDate ? new Date(initialDate) : new Date();

  const [internalSelectedDate, setInternalSelectedDate] = useState(() => controlledSelectedDate ?? initial);
  const selectedDate = controlledSelectedDate ?? internalSelectedDate;

  const [monthDate, setMonthDate] = useState(() => selectedDate);
  const [calendarsState, setCalendarsState] = useState<CalendarInfo[]>(createSeedCalendars);
  const [eventsState, setEventsState] = useState<CalendarEvent[]>(createSeedEvents);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Multi-select state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());


  const [nowReference, setNowReference] = useState<Date | null>(() => currentDate ?? null);
  const [composerRange, setComposerRange] = useState<{ start: Date; end: Date } | null>(null);
  const [composerAnchorRect, setComposerAnchorRect] = useState<ComposerAnchorRect | null>(null);


  const dayColumnRef = useRef<HTMLDivElement | null>(null);
  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  const weekColumnsRef = useRef<HTMLDivElement | null>(null);
  const hasInitialDayScrollRef = useRef(false);
  const hasInitialWeekScrollRef = useRef(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (controlledSelectedDate) {
      setMonthDate(controlledSelectedDate);
    }
  }, [controlledSelectedDate]);

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

  const handleCommitDrag = (drafts: Record<string, EventDraft>) => {
    updateEvents((previous) =>
      previous.map((event) => {
        const draft = drafts[event.id];
        if (draft) {
          return {
            ...event,
            start: ensureDateZone(draft.start),
            end: ensureDateZone(draft.end),
          };
        }
        return event;
      })
    );
  };

  const dragControls = useEventDrag({
    containerRef: dayColumnRef,
    hourHeight,
    snapMinutes: SNAP_MINUTES,
    selectedEventIds,
    allEvents: events,
    onCommit: handleCommitDrag,
  });
  const {
    getDraggableProps,
    suppressClickRef: daySuppressClickRef,
    activeDrafts: dayDrafts,
  } = dragControls;

  // Week view drag with horizontal support
  const weekDragControls = useEventDrag({
    containerRef: weekScrollRef,
    hourHeight,
    snapMinutes: SNAP_MINUTES,
    selectedEventIds,
    allEvents: events,
    onCommit: handleCommitDrag,
    horizontal: {
      columnCount: 7,
      getColumnIndex: (pointerEvent: PointerEvent) => {
        const weekColumnsEl = weekColumnsRef.current;
        if (!weekColumnsEl) return 0;

        const rect = weekColumnsEl.getBoundingClientRect();
        const columnWidth = rect.width / 7;
        const relativeX = pointerEvent.clientX - rect.left;
        return Math.max(0, Math.min(6, Math.floor(relativeX / columnWidth)));
      },
    },
  });
  const {
    getDraggableProps: getWeekDraggableProps,
    suppressClickRef: weekSuppressClickRef,
    activeDrafts: weekDrafts,
  } = weekDragControls;

  const activeDrafts = dayDrafts || weekDrafts;

  const dayAnchor = useMemo(() => startOfDay(selectedDate), [selectedDate]);
  const weekAnchor = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

  const calendarMap = useMemo(() => new Map(calendars.map((calendar) => [calendar.id, calendar])), [calendars]);

  const shortEventMinimumHeight = useMemo(
    () => Math.max(Math.round(hourHeight / 4), 12),
    [hourHeight]
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => {
      // Always show reminder events, even if they don't have a matching calendar
      if (event.entryType === "reminder") {
        return true;
      }
      // For regular events, check if their calendar is visible
      return calendarMap.get(event.calendarId)?.isVisible !== false;
    }),
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
    if (activeDrafts) {
      return filtered.map((event) => {
        const draft = activeDrafts[event.id];
        if (draft) {
          return {
            ...event,
            start: ensureDateZone(draft.start),
            end: ensureDateZone(draft.end),
          };
        }
        return event;
      });
    }
    return filtered;
  }, [activeDrafts, selectedDate, visibleEvents]);

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
      const mappedEvents = activeDrafts
        ? dayEventsForWeek.map((event) => {
          const draft = activeDrafts[event.id];
          if (draft) {
            return {
              ...event,
              start: ensureDateZone(draft.start),
              end: ensureDateZone(draft.end),
            };
          }
          return event;
        })
        : dayEventsForWeek;

      const eventsWithPreview = mappedEvents.filter((event) => isSameDay(event.start, day));

      // Also add any active drafts if they belong to this day but weren't originally
      if (activeDrafts) {
        Object.values(activeDrafts).forEach((draft) => {
          if (isSameDay(draft.start, day) && !dayEventsForWeek.some((e) => e.id === draft.id)) {
            const originalEvent = visibleEvents.find((e) => e.id === draft.id);
            if (originalEvent) {
              eventsWithPreview.push({
                ...originalEvent,
                start: ensureDateZone(draft.start),
                end: ensureDateZone(draft.end),
              });
            }
          }
        });
      }

      return layoutDayEvents(eventsWithPreview, {
        hourHeight,
        minimumHeight: shortEventMinimumHeight,
        dayStart: startOfDay(day),
      });
    });
  }, [hourHeight, shortEventMinimumHeight, visibleEvents, weekDays, activeDrafts]);

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



  useEffect(() => {
    if (viewMode !== "day") {
      return;
    }
    const container = dayColumnRef.current;
    if (!container || hasInitialDayScrollRef.current) {
      return;
    }
    if (dayIndicatorOffset !== null) {
      const target = Math.max(dayIndicatorOffset - hourHeight, 0);
      if (Math.abs(container.scrollTop - target) > 4) {
        container.scrollTo({ top: target });
      }
      hasInitialDayScrollRef.current = true;
      return;
    }

    if (!dayLayouts.length) {
      container.scrollTop = 0;
      hasInitialDayScrollRef.current = true;
      return;
    }

    const earliestTop = dayLayouts.reduce(
      (min, event) => Math.min(min, event.top),
      Number.POSITIVE_INFINITY
    );
    const target = Math.max(earliestTop - hourHeight, 0);
    if (Math.abs(container.scrollTop - target) > 4) {
      container.scrollTo({ top: target });
    }
    hasInitialDayScrollRef.current = true;
  }, [dayIndicatorOffset, dayLayouts, hourHeight, viewMode]);

  useEffect(() => {
    if (viewMode !== "week") {
      return;
    }
    const container = weekScrollRef.current;
    if (!container || !weekNowIndicator || hasInitialWeekScrollRef.current) {
      return;
    }
    const target = Math.max(weekNowIndicator.offset - hourHeight, 0);
    if (Math.abs(container.scrollTop - target) > 4) {
      container.scrollTo({ top: target });
    }
    hasInitialWeekScrollRef.current = true;
  }, [hourHeight, viewMode, weekNowIndicator]);



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
    (startDate: Date, anchorRect?: ComposerAnchorRect | null) => {
      const alignedStart = new Date(startDate);
      alignedStart.setMinutes(Math.floor(alignedStart.getMinutes() / SNAP_MINUTES) * SNAP_MINUTES, 0, 0);
      const alignedEnd = new Date(alignedStart.getTime() + 30 * 60000);
      setComposerRange({ start: alignedStart, end: alignedEnd });
      setEditingEvent(null);
      setComposerAnchorRect(anchorRect ?? null);
      setComposerOpen(true);
      // Clear selection when opening composer
      setSelectedEventIds(new Set());
    },
    []
  );

  const handleEventClick = (
    event: CalendarEvent,
    anchorRect?: DOMRect | DOMRectReadOnly | null,
    mouseEvent?: MouseEvent
  ) => {
    if (daySuppressClickRef.current || weekSuppressClickRef.current) return;

    if (mouseEvent?.ctrlKey || mouseEvent?.metaKey) {
      // Toggle selection
      setSelectedEventIds((prev) => {
        const next = new Set(prev);
        if (next.has(event.id)) {
          next.delete(event.id);
        } else {
          next.add(event.id);
        }
        return next;
      });
    } else {
      // Single select and edit
      setSelectedEventIds(new Set([event.id]));
      handleEditEvent(event, anchorRect);
    }
  };

  const handleEditEvent = (event: CalendarEvent, anchorRect?: DOMRect | DOMRectReadOnly | null) => {
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
    setComposerAnchorRect(null);
  };

  const handleComposerDelete = (eventId: string) => {
    updateEvents((previous) => previous.filter((event) => event.id !== eventId));
    setComposerOpen(false);
    setEditingEvent(null);
    setComposerRange(null);
    setComposerAnchorRect(null);
  };

  const handleColumnClick = (event: MouseEvent<HTMLDivElement>, day: Date) => {
    if (daySuppressClickRef.current || weekSuppressClickRef.current) {
      return;
    }
    const target = event.currentTarget;
    if (event.target instanceof HTMLElement) {
      // Ignore clicks that originate from an existing event card so we don't
      // create a new draft on top of the one being edited.
      if (event.target.closest(`.${styles.eventCard}`)) {
        return;
      }
    }

    // Clear selection on background click
    setSelectedEventIds(new Set());

    const bounds = target.getBoundingClientRect();
    const offsetY = event.clientY - bounds.top;
    const minutes = Math.max(0, Math.min(24 * 60, Math.round((offsetY / hourHeight) * 60 / SNAP_MINUTES) * SNAP_MINUTES));
    const start = new Date(day);
    start.setHours(0, minutes, 0, 0);
    const anchorRect: ComposerAnchorRect = {
      left: bounds.right,
      width: 16,
      top: event.clientY - 12,
      height: 24,
    };
    openComposerAt(start, anchorRect);
  };

  // Helper to override event position if dragged
  const getEventOverride = (event: PositionedEvent, dayStart: Date) => {
    const draft = activeDrafts?.[event.id];
    if (!draft) return event;

    const startMinutes = (draft.start.getTime() - dayStart.getTime()) / 60000;
    const endMinutes = (draft.end.getTime() - dayStart.getTime()) / 60000;
    const durationMinutes = Math.max(endMinutes - startMinutes, 5);

    const minuteHeight = hourHeight / 60;
    const top = Math.max(startMinutes * minuteHeight, 0);
    const height = Math.max(durationMinutes * minuteHeight, shortEventMinimumHeight);

    return {
      ...event,
      top,
      height,
    };
  };

  const renderWeekView = () => (
    <div className={styles.calendarGrid}>
      <div className={styles.calendarBody}>
        {showHeaderDates && (
          <div className={styles.calendarHeaderRow}>
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
          <div className={styles.calendarWeekColumns} ref={weekColumnsRef}>
            {weekDays.map((day, columnIndex) => {
              const isToday = nowReference ? isSameDay(day, nowReference) : false;
              const columnNowIndicatorOffset =
                weekNowIndicator?.dayIndex === columnIndex ? weekNowIndicator.offset : null;

              const eventsToRender = weekLayouts[columnIndex] || [];

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
                      </>
                    )}

                    {eventsToRender.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={(_e, anchorRect, mouseEvent) => handleEventClick(event, anchorRect, mouseEvent)}
                        draggableProps={viewMode === "week" ? getWeekDraggableProps(event) : undefined}
                        isDragging={!!activeDrafts?.[event.id]}
                        isSelected={selectedEventIds.has(event.id)}
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
      <div className={styles.calendarBody}>
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
                </>
              )}

              {/* Events */}
              {dayLayouts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={(_e, anchorRect, mouseEvent) => handleEventClick(event, anchorRect, mouseEvent)}
                  draggableProps={viewMode === "day" ? getDraggableProps(event) : undefined}
                  isDragging={!!activeDrafts?.[event.id]}
                  isSelected={selectedEventIds.has(event.id)}
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
      const computeNext = (prev: Date) => {
        const next = compute(prev);
        setMonthDate(next);
        return next;
      };

      if (onSelectedDateChange) {
        // If controlled, compute the next date based on current prop (or internal if falling back)
        // and notify parent. Parent is responsible for updating prop.
        const next = computeNext(selectedDate);
        onSelectedDateChange(next);
      } else {
        setInternalSelectedDate((previous) => computeNext(previous));
      }
    },
    [onSelectedDateChange, selectedDate]
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const diffX = touchStartRef.current.x - touchEnd.x;
    const diffY = touchStartRef.current.y - touchEnd.y;

    // Determine if swipe is horizontal (X diff > Y diff) and significant enough
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swiped left -> Next
        handleNavigateRange(1);
      } else {
        // Swiped right -> Previous
        handleNavigateRange(-1);
      }
    }

    touchStartRef.current = null;
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
  } else {
    calendarStyle["--calendar-max-height"] = "100%";
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
      <div
        className={styles.calendarBoard}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
      anchorRect={composerAnchorRect}
      onRequestClose={() => {
        setComposerOpen(false);
        setEditingEvent(null);
        setComposerRange(null);
        setComposerAnchorRect(null);
      }}
      onSubmit={handleComposerSubmit}
      onDelete={handleComposerDelete}
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
