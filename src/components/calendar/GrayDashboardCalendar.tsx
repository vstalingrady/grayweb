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
import { GrayDashboardCalendarHeader } from "./GrayDashboardCalendarHeader";
import {
  EventComposer,
  type EventComposerPayload,
} from "./EventComposer";
import { GrayDashboardCalendarDayView } from "./GrayDashboardCalendarDayView";
import { GrayDashboardCalendarWeekView } from "./GrayDashboardCalendarWeekView";
import { useCalendarComposer } from "./useCalendarComposer";
import { useControlledCalendarData } from "./useControlledCalendarData";
import { useDashboardCalendarDateState } from "./useDashboardCalendarDateState";
import { useDashboardCalendarDragResize } from "./useDashboardCalendarDragResize";
import { useCalendarLayouts } from "./useCalendarLayouts";
import { useCalendarNowIndicators } from "./useCalendarNowIndicators";
import { startOfWeek } from "./dateUtils";
import {
  CalendarEvent,
  CalendarInfo,
  PositionedEvent,
} from "./types";
import { formatDateLabel } from "./timeUtils";
import type { DashboardHeaderProps } from "@/components/gray/DashboardHeader";
import { useI18n } from "@/contexts/I18nContext";
import type { CalendarViewMode, ComposerAnchorRect } from "./dashboardCalendarTypes";

const DEFAULT_HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const TIMELINE_WIDTH = 56;

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
  showSurfaceLabel?: boolean;
  showSurfaceHeading?: boolean;
  showHeaderControls?: boolean;
  showCalendarList?: boolean;
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
  onEventDelete?: (event: CalendarEvent) => void;
  onCreatePlan?: (payload: EventComposerPayload) => void;
  onCreateHabit?: (payload: EventComposerPayload) => void;
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
  showSurfaceLabel = true,
  showSurfaceHeading = true,
  showHeaderControls = true,
  showCalendarList = true,
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
  onEventDelete,
  onCreatePlan,
  onCreateHabit,
}: GrayDashboardCalendarProps) {
  const { t } = useI18n();
  const hourHeight = hourHeightProp ?? DEFAULT_HOUR_HEIGHT;
  const [viewMode, setViewMode] = useState<CalendarViewMode>(viewModeLocked ?? "week");

  const {
    selectedDate,
    monthDate,
    handleDaySelect,
    handleMonthNavigate,
    handleNavigateRange,
    handleGoToday,
    handleMainMonthNavigate,
  } = useDashboardCalendarDateState({
    initialDate,
    selectedDate: controlledSelectedDate,
    onSelectedDateChange,
    viewMode,
  });

  // Multi-select state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());


  const hasInitialDayScrollRef = useRef(false);
  const hasInitialWeekScrollRef = useRef(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const { calendars, events, updateCalendars, updateEvents } = useControlledCalendarData({
    calendars: externalCalendars,
    events: externalEvents,
    onCalendarsChange,
    onEventsChange,
  });

  const clearSelection = useCallback(() => {
    setSelectedEventIds(new Set());
  }, []);

  const {
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
  } = useCalendarComposer({
    events,
    updateEvents,
    onEventDelete,
    onCreatePlan,
    onCreateHabit,
    onClearSelection: clearSelection,
  });

  const {
    dayColumnRef,
    weekScrollRef,
    weekColumnsRef,
    daySuppressClickRef,
    weekSuppressClickRef,
    getDayDraggableProps,
    getWeekDraggableProps,
    getResizeProps,
    activeDrafts,
  } = useDashboardCalendarDragResize({
    hourHeight,
    snapMinutes: SNAP_MINUTES,
    selectedEventIds,
    events,
    updateEvents,
  });

  const weekAnchor = useMemo(() => startOfWeek(selectedDate), [selectedDate]);

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

  const { nowReference, dayIndicatorOffset, weekNowIndicator } = useCalendarNowIndicators({
    currentDate,
    selectedDate,
    weekDays,
    hourHeight,
  });

  const { dayLayouts, weekLayouts } = useCalendarLayouts({
    calendars,
    events,
    selectedDate,
    weekDays,
    hourHeight,
    activeDrafts,
    composerPreviewEvent,
  });

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

  const rangeNavigationLabel = viewMode === "week" ? t("Week") : t("Day");
  const shouldShowDashboardToggle = typeof onSelectDashboardTab === "function";



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



  const handleToggleCalendar = (calendarId: string) => {
    updateCalendars((previous) =>
      previous.map((calendar) =>
        calendar.id === calendarId
          ? { ...calendar, isVisible: !calendar.isVisible }
          : calendar
      )
    );
  };

  const isGoogleCalendarEvent = (event: CalendarEvent) =>
    typeof event.calendarId === "string" && event.calendarId.startsWith("google:");

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
      if (isGoogleCalendarEvent(event)) {
        return;
      }
      editEvent(event, anchorRect);
    }
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
    clearSelection();

    const bounds = target.getBoundingClientRect();
    const offsetY = event.clientY - bounds.top;
    const totalMinutes = Math.max(0, Math.min(24 * 60 - 1, Math.round((offsetY / hourHeight) * 60 / SNAP_MINUTES) * SNAP_MINUTES));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const start = new Date(day);
    start.setHours(hours, minutes, 0, 0);

    const startMinutes = hours * 60 + minutes;
    const startOffsetPx = (startMinutes / 60) * hourHeight;
    const defaultDurationMinutes = 60; // Default event length
    const eventHeightPx = (defaultDurationMinutes / 60) * hourHeight;

    const anchorRect: ComposerAnchorRect = {
      left: bounds.left,
      width: bounds.width,
      top: bounds.top + startOffsetPx,
      height: eventHeightPx,
    };
    openComposerAt(start, anchorRect);
  };

  const handleDeleteEvent = (event: PositionedEvent) => {
    const calendarEvent = events.find((e) => e.id === event.id);
    if (calendarEvent && onEventDelete) {
      onEventDelete(calendarEvent);
    }
    updateEvents((previous) => previous.filter((e) => e.id !== event.id));
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
    viewMode === "week" ? formatWeekRange(selectedDate) : formatDateLabel(selectedDate);

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
    label: showSurfaceLabel ? t("Calendar") : undefined,
    title: monthLabel,
    rangeLabel: showHeaderDates ? rangeLabel : undefined,
    timezoneLabel: timeZoneLabel,
    onPrevMonth: () => handleMonthNavigate(-1),
    onNextMonth: () => handleMonthNavigate(1),
    onPrevRange: () => handleNavigateRange(-1),
    onNextRange: () => handleNavigateRange(1),
    onGoToday: showTodayControl ? handleGoToday : undefined,
    viewMode,
    onViewModeChange: showViewSelect ? updateViewMode : undefined,
    viewModeOptions: [
      { value: "week", label: t("Week") },
      { value: "day", label: t("Day") },
    ],
    rangeNavigationLabel,
  };

  const headerNode = renderHeader
    ? renderHeader(headerProps)
    : shouldRenderHeader
      ? (
        <GrayDashboardCalendarHeader
          dashboardTab={dashboardTab}
          onSelectDashboardTab={onSelectDashboardTab}
          showSurfaceLabel={showSurfaceLabel}
          showSurfaceHeading={showSurfaceHeading}
          showHeaderDates={showHeaderDates}
          showNavigationControls={showNavigationControls}
          showTodayControl={showTodayControl}
          showViewSelect={showViewSelect}
          hasHeaderRight={hasHeaderRight}
          rangeLabel={rangeLabel}
          viewMode={viewMode}
          onMainMonthNavigate={handleMainMonthNavigate}
          onGoToday={handleGoToday}
          onViewModeChange={handleViewModeChange}
        />
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
            onNavigate={handleMonthNavigate}
            calendars={calendars}
            onToggleCalendar={handleToggleCalendar}
            showHeader
            className={styles.calendarSidebarIntegrated}
            showMonthNavigation
            showCalendarList={showCalendarList}
            onIntegrationAction={onIntegrationAction}
          />
        </div>
      )}
      <div
        className={styles.calendarBoard}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {viewMode === "week" ? (
          <GrayDashboardCalendarWeekView
            weekDays={weekDays}
            selectedDate={selectedDate}
            nowReference={nowReference}
            timeZoneLabel={timeZoneLabel}
            rangeNavigationLabel={rangeNavigationLabel}
            showTodayControl={showTodayControl}
            showViewSelect={showViewSelect}
            showHeaderDates={showHeaderDates}
            weekNowIndicator={weekNowIndicator}
            weekLayouts={weekLayouts}
            activeDrafts={activeDrafts}
            selectedEventIds={selectedEventIds}
            weekScrollRef={weekScrollRef}
            weekColumnsRef={weekColumnsRef}
            onNavigateRange={handleNavigateRange}
            onGoToday={handleGoToday}
            onUpdateViewMode={updateViewMode}
            onColumnClick={handleColumnClick}
            onEventClick={(event, anchorRect, mouseEvent) =>
              handleEventClick(event, anchorRect, mouseEvent)
            }
            isGoogleCalendarEvent={isGoogleCalendarEvent}
            getWeekDraggableProps={getWeekDraggableProps}
            getResizeProps={getResizeProps}
            onDeleteEvent={handleDeleteEvent}
          />
        ) : (
          <GrayDashboardCalendarDayView
            selectedDate={selectedDate}
            nowReference={nowReference}
            timeZoneLabel={timeZoneLabel}
            rangeNavigationLabel={rangeNavigationLabel}
            showTodayControl={showTodayControl}
            showViewSelect={showViewSelect}
            showHeaderDates={showHeaderDates}
            dayIndicatorOffset={dayIndicatorOffset}
            dayLayouts={dayLayouts}
            activeDrafts={activeDrafts}
            selectedEventIds={selectedEventIds}
            dayColumnRef={dayColumnRef}
            onNavigateRange={handleNavigateRange}
            onGoToday={handleGoToday}
            onUpdateViewMode={updateViewMode}
            onColumnClick={handleColumnClick}
            onEventClick={(event, anchorRect, mouseEvent) =>
              handleEventClick(event, anchorRect, mouseEvent)
            }
            isGoogleCalendarEvent={isGoogleCalendarEvent}
            getDayDraggableProps={getDayDraggableProps}
            getResizeProps={getResizeProps}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
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
        closeComposer();
      }}
      onSubmit={handleComposerSubmit}
      onDelete={handleComposerDelete}
      onStateChange={setComposerDraft}
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
