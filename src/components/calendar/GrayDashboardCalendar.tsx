"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { CalendarSidebar } from "./CalendarSidebar";
import { GrayDashboardCalendarHeader } from "./GrayDashboardCalendarHeader";
import {
  EventComposer,
  type EventComposerPayload,
  type ComposerState,
} from "./EventComposer";
import { GrayDashboardCalendarDayView } from "./GrayDashboardCalendarDayView";
import { GrayDashboardCalendarWeekView } from "./GrayDashboardCalendarWeekView";
import { useCalendarComposer } from "./useCalendarComposer";
import { useControlledCalendarData } from "./useControlledCalendarData";
import { useDashboardCalendarDateState } from "./useDashboardCalendarDateState";
import { useDashboardCalendarDragResize } from "./useDashboardCalendarDragResize";
import { useDashboardCalendarInitialScroll } from "./useDashboardCalendarInitialScroll";
import { useDashboardCalendarInteractions } from "./useDashboardCalendarInteractions";
import { useDashboardCalendarSelection } from "./useDashboardCalendarSelection";
import { useCalendarLayouts } from "./useCalendarLayouts";
import { useCalendarNowIndicators } from "./useCalendarNowIndicators";
import { startOfWeek } from "./dateUtils";
import {
  CalendarEvent,
  CalendarInfo,
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
  composerState?: {
    isOpen: boolean;
    editingEvent: CalendarEvent | null;
    range: { start: Date; end: Date } | null;
    anchorRect: ComposerAnchorRect | null;
    previewEvent: CalendarEvent | null;
  };
  composerHandlers?: {
    onOpenAt: (startDate: Date, anchorRect?: ComposerAnchorRect | null) => void;
    onEdit: (event: CalendarEvent, anchorRect?: ComposerAnchorRect | null) => void;
    onClose: () => void;
    onSubmit: (payload: EventComposerPayload) => void;
    onDelete: (eventId: string) => void;
    onStateChange: (state: ComposerState | null) => void;
  };
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
  composerState,
  composerHandlers,
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

  const { selectedEventIds, clearSelection, toggleSelection, selectSingle } =
    useDashboardCalendarSelection();

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const { calendars, events, updateCalendars, updateEvents } = useControlledCalendarData({
    calendars: externalCalendars,
    events: externalEvents,
    onCalendarsChange,
    onEventsChange,
  });

  const internalComposer = useCalendarComposer({
    events,
    updateEvents,
    onEventDelete,
    onCreatePlan,
    onCreateHabit,
    onClearSelection: clearSelection,
  });

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
  } = (composerState && composerHandlers)
      ? {
        composerOpen: composerState.isOpen,
        editingEvent: composerState.editingEvent,
        composerRange: composerState.range,
        composerAnchorRect: composerState.anchorRect,
        composerPreviewEvent: composerState.previewEvent,
        setComposerDraft: composerHandlers.onStateChange,
        openComposerAt: composerHandlers.onOpenAt,
        editEvent: composerHandlers.onEdit,
        closeComposer: composerHandlers.onClose,
        handleComposerSubmit: composerHandlers.onSubmit,
        handleComposerDelete: composerHandlers.onDelete,
      }
      : internalComposer;

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
    draggingEventIds,
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

  useDashboardCalendarInitialScroll({
    viewMode,
    dayColumnRef,
    weekScrollRef,
    dayIndicatorOffset,
    weekNowIndicator,
    dayLayouts,
    hourHeight,
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

  const handleToggleCalendar = (calendarId: string) => {
    updateCalendars((previous) =>
      previous.map((calendar) =>
        calendar.id === calendarId
          ? { ...calendar, isVisible: !calendar.isVisible }
          : calendar
      )
    );
  };

  const { isGoogleCalendarEvent, handleEventClick, handleColumnClick, handleDeleteEvent } =
    useDashboardCalendarInteractions({
      hourHeight,
      snapMinutes: SNAP_MINUTES,
      eventCardClassName: styles.eventCard,
      daySuppressClickRef,
      weekSuppressClickRef,
      events,
      updateEvents,
      onEventDelete,
      clearSelection,
      toggleSelection,
      selectSingle,
      editEvent,
      openComposerAt,
    });

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
            draggingEventIds={draggingEventIds}
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
            draggingEventIds={draggingEventIds}
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
