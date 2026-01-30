import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./DashboardView.module.css";
import composerStyles from "@/components/gray/chat/ChatComposerStyles.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { EventComposerPayload } from "@/components/calendar/EventComposer";
import { type ProactivityItem, type PulseEntry, type PlanItem, type PlanUpdates, type HabitItem } from "./types";
import { DashboardHeader } from "./DashboardHeader";
import { mapPlansToCalendarEvents, PLAN_EVENT_ID_PREFIX } from "./planCalendarUtils";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import { getProactivityTimes } from "./proactivityUtils";
import { ProactivitySettingsModal } from "./ProactivitySettingsModal";
import { DashboardPulseGrid } from "./dashboard/DashboardPulseGrid";
import { normalizePlanTier } from "@/components/gray/utils/helperFunctions";
import { useCalendarComposer } from "@/components/calendar/useCalendarComposer";
import { EventComposer } from "@/components/calendar/EventComposer";

const CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT =
  "clamp(360px, calc(100vh - (320px + var(--gray-chat-bar-clearance, 112px))), 660px)";
const CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT =
  "clamp(420px, calc(100vh - clamp(48px, 6vh, 120px)), calc(100vh - clamp(32px, 4vh, 96px)))";
const CALENDAR_PANEL_HOUR_HEIGHT = 62;
const CALENDAR_PANEL_MIN_HEIGHT_PX = 420;
const CALENDAR_PANEL_HEIGHT_STORAGE_KEY = "gray.dashboard.calendarPanelHeightPx";

const buildPanelSizingStyle = (hasChatBar: boolean) => {
  const maxHeight = hasChatBar
    ? CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT
    : CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT;
  return {
    "--calendar-max-height": maxHeight,
    "--dashboard-panel-max-height": maxHeight,
  } as CSSProperties & { [key: string]: string | number };
};

type GrayDashboardViewProps = {
  pulseEntries: PulseEntry[];
  currentPulse: PulseEntry | null;
  isCurrentPulseEditable: boolean;
  livePlans?: PlanItem[];
  liveHabits?: HabitItem[];
  onSelectPulse: (id: string) => void;
  proactivityFallback: ProactivityItem | null;
  isProactivityLoaded: boolean;
  onProactivitySelect?: (next: ProactivityItem) => void;
  onProactivityRemove?: () => void;
  onTestProactivity?: (proactivityId: string) => void;
  onSavePlan?: (planId: string, updates: PlanUpdates) => Promise<void> | void;
  onDeletePlan?: (plan: PlanItem) => void;
  onTogglePlan?: (id: string) => void;
  onToggleHabit?: (id: string) => void;
  activeTab: "pulse" | "calendar";
  onSelectTab: (tab: "pulse" | "calendar") => void;
  currentDate: Date;
  calendars: CalendarInfo[];
  onCalendarsChange: (calendars: CalendarInfo[]) => void;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
  calendarSelectedDate?: Date;
  onCalendarSelectedDateChange?: (date: Date) => void;
  onEditHabit?: (habit: { id: string; label: string; previousLabel: string }) => void;
  onDeleteHabit?: (habit: { id: string; label: string; previousLabel: string }) => void;
  onCreatePlan?: (plan: EventComposerPayload) => Promise<void> | void;
  onCreateHabit?: (habit: EventComposerPayload) => Promise<void> | void;
  onIntegrationAction?: () => void;
  chatBar?: ReactNode;
  isCompactLayout?: boolean;
  userId?: number | null;
  proactivityDeliveryKeys?: ReadonlySet<string>;
  onUpgradeClick?: () => void;
  showUpgradeButton?: boolean;
  isOverlay?: boolean;
  hideHeader?: boolean;
};

type DashboardTab = GrayDashboardViewProps["activeTab"];

export function GrayDashboardView({
  pulseEntries,
  currentPulse,
  isCurrentPulseEditable,
  livePlans,
  liveHabits,
  proactivityFallback,
  isProactivityLoaded,
  onProactivitySelect,
  onProactivityRemove,
  onDeletePlan,
  onTogglePlan,
  onToggleHabit,
  activeTab,
  onSelectTab,
  currentDate,
  calendars,
  onCalendarsChange,
  calendarEvents,
  onCalendarEventsChange,
  calendarSelectedDate,
  onCalendarSelectedDateChange,
  onCreatePlan,
  onCreateHabit,
  onIntegrationAction,
  chatBar,
  isCompactLayout = false,
  proactivityDeliveryKeys,
  onUpgradeClick,
  showUpgradeButton = false,
  isOverlay = false,
  hideHeader = false,
}: GrayDashboardViewProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const hasPulseData = Boolean(currentPulse && pulseEntries.length > 0);

  const displayPlans = useMemo(() => {
    const fallbackPlans = currentPulse?.plans ?? [];
    if (isCurrentPulseEditable) {
      return livePlans ?? fallbackPlans;
    }
    if (hasPulseData) {
      return fallbackPlans;
    }
    const rawPlans = livePlans ?? [];
    const seen = new Set<string>();
    return rawPlans.filter((plan) => {
      if (seen.has(plan.id)) return false;
      seen.add(plan.id);
      return true;
    });
  }, [currentPulse, hasPulseData, isCurrentPulseEditable, livePlans]);

  const displayHabits = useMemo(() => {
    const fallbackHabits = currentPulse?.habits ?? [];
    if (isCurrentPulseEditable) {
      return liveHabits ?? fallbackHabits;
    }
    if (hasPulseData) {
      return fallbackHabits;
    }
    const rawHabits = liveHabits ?? [];
    const seen = new Set<string>();
    return rawHabits.filter((habit) => {
      if (seen.has(habit.id)) return false;
      seen.add(habit.id);
      return true;
    });
  }, [currentPulse, hasPulseData, isCurrentPulseEditable, liveHabits]);

  const planCalendarEvents = useMemo(() => mapPlansToCalendarEvents(displayPlans), [displayPlans]);

  const mergedEvents = useMemo(() => {
    const allEvents = [...calendarEvents, ...planCalendarEvents];
    const seen = new Set<string>();
    return allEvents.filter((event) => {
      if (seen.has(event.id)) {
        return false;
      }
      seen.add(event.id);
      return true;
    });
  }, [calendarEvents, planCalendarEvents]);

  const handleCalendarEventDelete = useCallback(
    (event: CalendarEvent) => {
      if (!onDeletePlan) {
        return;
      }

      // Handle plan events (e.g., "plan-event-123")
      if (event.id.startsWith(PLAN_EVENT_ID_PREFIX)) {
        const planId = event.id.slice(PLAN_EVENT_ID_PREFIX.length);
        const targetPlan = displayPlans.find((plan) => plan.id === planId);
        if (targetPlan) {
          onDeletePlan(targetPlan);
          return;
        }
      }
      console.warn(`[CALENDAR] Could not find plan for event: ${event.id}`);
    },
    [displayPlans, onDeletePlan]
  );

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
    events: mergedEvents,
    updateEvents: (updater) => {
      const nextEvents = updater(mergedEvents);
      const nonPlanEvents = nextEvents.filter((e) => !e.id.startsWith(PLAN_EVENT_ID_PREFIX));
      onCalendarEventsChange(nonPlanEvents);
    },
    onEventDelete: handleCalendarEventDelete,
    onCreatePlan,
    onCreateHabit,
    onClearSelection: () => { },
  });

  const displayProactivity = useMemo(() => {
    if (isProactivityLoaded) {
      return proactivityFallback ?? null;
    }
    if (hasPulseData && isCurrentPulseEditable) {
      return currentPulse?.proactivity ?? proactivityFallback ?? null;
    }
    return proactivityFallback ?? null;
  }, [currentPulse, hasPulseData, isCurrentPulseEditable, isProactivityLoaded, proactivityFallback]);

  const [isProactivityModalOpen, setIsProactivityModalOpen] = useState(false);
  const activeProactivityTimes = useMemo(() => getProactivityTimes(displayProactivity), [displayProactivity]);
  const isChatBarVisible = Boolean(chatBar);
  const canResizePanel = isChatBarVisible;
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const chatDockRef = useRef<HTMLDivElement | null>(null);
  const [panelAvailableHeightPx, setPanelAvailableHeightPx] = useState<number | null>(null);
  const [panelUserHeightPx, setPanelUserHeightPx] = useState<number | null>(null);
  const panelResizeRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const [isPanelResizing, setIsPanelResizing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!canResizePanel) {
      Promise.resolve().then(() => setPanelUserHeightPx(null));
      window.localStorage.removeItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY);
      return;
    }
    const stored = window.localStorage.getItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY);
    if (!stored) return;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      Promise.resolve().then(() => setPanelUserHeightPx(parsed));
    }
  }, [canResizePanel]);

  const effectivePanelHeightPx = useMemo(() => {
    if (panelAvailableHeightPx === null) return null;
    const maximum = Math.max(panelAvailableHeightPx, CALENDAR_PANEL_MIN_HEIGHT_PX);
    const desired = canResizePanel ? (panelUserHeightPx ?? maximum) : maximum;
    return Math.max(CALENDAR_PANEL_MIN_HEIGHT_PX, Math.min(desired, maximum));
  }, [canResizePanel, panelAvailableHeightPx, panelUserHeightPx]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!canResizePanel || panelUserHeightPx === null) {
      window.localStorage.removeItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY, String(panelUserHeightPx));
  }, [canResizePanel, panelUserHeightPx]);

  const panelSizingStyle = useMemo(() => {
    const style = buildPanelSizingStyle(isChatBarVisible);
    if (effectivePanelHeightPx !== null) {
      const maxHeightValue = `${effectivePanelHeightPx}px`;
      style["--calendar-max-height"] = maxHeightValue;
      style["--dashboard-panel-max-height"] = maxHeightValue;
    }
    return style;
  }, [effectivePanelHeightPx, isChatBarVisible]);

  const normalizedTier = normalizePlanTier(user);
  const hasCalendarAccess = normalizedTier === "voyager" || normalizedTier === "pioneer";

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const computePanelHeight = () => {
      const container = calendarContainerRef.current;
      if (!container) return;
      const viewportHeight = window.innerHeight;
      const rect = container.getBoundingClientRect();
      const paddingBottom = Number.parseFloat(window.getComputedStyle(container).paddingBottom || "0");
      const chatDockHeight = isChatBarVisible && chatDockRef.current ? chatDockRef.current.getBoundingClientRect().height : 0;
      const clearance = paddingBottom + chatDockHeight + (isChatBarVisible ? 24 : 16);
      const availableHeight = Math.max(CALENDAR_PANEL_MIN_HEIGHT_PX, viewportHeight - rect.top - clearance);
      setPanelAvailableHeightPx((previous) => {
        const rounded = Math.round(availableHeight);
        return previous === rounded ? previous : rounded;
      });
    };

    computePanelHeight();
    const handleResize = () => computePanelHeight();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const observers: ResizeObserver[] = [];
    if (typeof ResizeObserver !== "undefined") {
      if (calendarContainerRef.current) {
        const observer = new ResizeObserver(() => computePanelHeight());
        observer.observe(calendarContainerRef.current);
        observers.push(observer);
      }
      if (chatDockRef.current) {
        const observer = new ResizeObserver(() => computePanelHeight());
        observer.observe(chatDockRef.current);
        observers.push(observer);
      }
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      observers.forEach((observer) => observer.disconnect());
    };
  }, [isChatBarVisible, activeTab]);

  const handlePanelResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      if (effectivePanelHeightPx === null || panelAvailableHeightPx === null) return;

      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
      panelResizeRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: effectivePanelHeightPx,
      };
      setIsPanelResizing(true);
      target.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const state = panelResizeRef.current;
        if (!state || moveEvent.pointerId !== state.pointerId) return;
        const deltaY = moveEvent.clientY - state.startY;
        const nextHeight = Math.round(state.startHeight + deltaY);
        const clamped = Math.max(CALENDAR_PANEL_MIN_HEIGHT_PX, Math.min(nextHeight, panelAvailableHeightPx));
        setPanelUserHeightPx(clamped);
      };

      const release = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onCancel);
        if (panelResizeRef.current?.pointerId === event.pointerId) {
          panelResizeRef.current = null;
        }
        setIsPanelResizing(false);
        if (target.hasPointerCapture(event.pointerId)) {
          target.releasePointerCapture(event.pointerId);
        }
      };

      const onUp = () => release();
      const onCancel = () => release();

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onCancel);
    },
    [effectivePanelHeightPx, panelAvailableHeightPx]
  );

  const handleOpenProactivityModal = useCallback(() => {
    if (!onProactivitySelect) return;
    setIsProactivityModalOpen(true);
  }, [onProactivitySelect]);

  const handleCloseProactivityModal = useCallback(() => {
    setIsProactivityModalOpen(false);
  }, []);

  const headerClassName = styles.pulseSurfaceHeader;
  const renderCalendarHeader = (headerProps: {
    activeTab: DashboardTab;
    onSelectTab: (tab: DashboardTab) => void;
  }) => (
    <DashboardHeader
      activeTab={headerProps.activeTab}
      onSelectTab={headerProps.onSelectTab}
      showTabs={false}
      onGoToday={undefined}
      viewMode={undefined}
      onViewModeChange={undefined}
      viewModeOptions={[]}
      label={undefined}
      rangeLabel={undefined}
      className={headerClassName}
      onUpgradeClick={onUpgradeClick}
      showUpgradeButton={showUpgradeButton}
    />
  );

  const proactivityModal = onProactivitySelect ? (
    <ProactivitySettingsModal
      isOpen={isProactivityModalOpen}
      onClose={handleCloseProactivityModal}
      activeProactivity={displayProactivity}
      activeProactivityTimes={activeProactivityTimes}
      onSelectProactivity={onProactivitySelect}
      onRemoveProactivity={onProactivityRemove}
      showRemoveButton={Boolean(onProactivityRemove && (displayProactivity ?? proactivityFallback))}
    />
  ) : null;

  const eventComposer = (
    <EventComposer
      isOpen={composerOpen}
      referenceDate={currentDate}
      activeEvent={editingEvent}
      initialRange={composerRange}
      calendars={calendars}
      anchorRect={composerAnchorRect}
      onRequestClose={closeComposer}
      onSubmit={handleComposerSubmit}
      onDelete={handleComposerDelete}
      onStateChange={setComposerDraft}
    />
  );

  const shouldShowPulseHeader = (hasCalendarAccess || showUpgradeButton) && !hideHeader;
  const pulseGridProps = {
    currentDate,
    selectedDate: calendarSelectedDate ?? currentDate,
    viewerName: user?.full_name ?? null,
    proactivity: displayProactivity ?? null,
    events: mergedEvents,
    plans: displayPlans,
    habits: displayHabits,
    proactivityDeliveryKeys,
    canConfigureProactivity: Boolean(onProactivitySelect),
    onConfigureProactivity: handleOpenProactivityModal,
    onSelectDate: (date: Date) => onCalendarSelectedDateChange?.(date),
    isCompactLayout,
    onAddEvent: (date: Date) => openComposerAt(date),
    onTogglePlan,
    onToggleHabit,
  };

  const pulseContent = (
    <div className={styles.dashboardViewScrollContainer}>
      {shouldShowPulseHeader ? (
        <DashboardHeader
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          className={headerClassName}
          onUpgradeClick={onUpgradeClick}
          showUpgradeButton={showUpgradeButton}
          showTabs={hasCalendarAccess}
        />
      ) : null}
      <DashboardPulseGrid {...pulseGridProps} />
    </div>
  );

  const compactPulseContent = <DashboardPulseGrid {...pulseGridProps} />;

  const calendarComposerState = {
    isOpen: composerOpen,
    editingEvent,
    range: composerRange,
    anchorRect: composerAnchorRect,
    previewEvent: composerPreviewEvent,
  };
  const calendarComposerHandlers = {
    onOpenAt: openComposerAt,
    onEdit: editEvent,
    onClose: closeComposer,
    onSubmit: handleComposerSubmit,
    onDelete: handleComposerDelete,
    onStateChange: setComposerDraft,
  };
  const baseCalendarProps = {
    initialDate: currentDate,
    currentDate,
    showHeaderDates: true,
    calendars,
    events: mergedEvents,
    onCalendarsChange,
    onEventsChange: onCalendarEventsChange,
    onEventDelete: handleCalendarEventDelete,
    onCreatePlan,
    onCreateHabit,
    selectedDate: calendarSelectedDate,
    onSelectedDateChange: onCalendarSelectedDateChange,
    composerState: calendarComposerState,
    composerHandlers: calendarComposerHandlers,
    hourHeight: CALENDAR_PANEL_HOUR_HEIGHT,
    onIntegrationAction,
    dashboardTab: "calendar" as const,
    onSelectDashboardTab: () => {},
    renderHeader: renderCalendarHeader,
    embedWithinParentSurface: true,
    surfaceClassName: styles.dashboardCalendarInnerSurface,
  };

  const calendarContent = (
    <GrayDashboardCalendar
      {...baseCalendarProps}
      showSidebar={true}
      showCalendarList={hasCalendarAccess}
    />
  );

  const compactCalendarContent = (
    <GrayDashboardCalendar
      {...baseCalendarProps}
      viewModeLocked="day"
      showSidebar={false}
      showCalendarList={false}
    />
  );

  const dashboardSurfaceClassName = styles.dashboardCalendarSurface;

  const surfaceContent =
    activeTab === "pulse"
      ? isCompactLayout
        ? compactPulseContent
        : pulseContent
      : isCompactLayout
        ? compactCalendarContent
        : calendarContent;

  return (
    <>
      {proactivityModal}
      {eventComposer}
      <div
        className={styles.dashboardCalendarContainer}
        data-compact={isCompactLayout ? "true" : "false"}
        data-overlay={isOverlay ? "true" : "false"}
        ref={calendarContainerRef}
      >
        <div
          className={styles.dashboardCalendarShell}
          style={panelSizingStyle}
          data-compact={isCompactLayout ? "true" : "false"}
          data-resizing={isPanelResizing ? "true" : "false"}
        >
          <div
            className={dashboardSurfaceClassName}
            data-compact={isCompactLayout ? "true" : "false"}
          >
            {surfaceContent}
          </div>
          {isCompactLayout || activeTab !== "calendar" || !canResizePanel ? null : (
            <div
              className={styles.dashboardCalendarResizeHandle}
              data-active={isPanelResizing ? "true" : "false"}
              role="separator"
              aria-orientation="horizontal"
              aria-label={t("Resize calendar panel")}
              onPointerDown={handlePanelResizePointerDown}
              onDoubleClick={() => setPanelUserHeightPx(null)}
            />
          )}
        </div>
        {isChatBarVisible ? (
          <div className={composerStyles.chatComposerDock} ref={chatDockRef}>
            {chatBar}
          </div>
        ) : null}
      </div>
    </>
  );
}
