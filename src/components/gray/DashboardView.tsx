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
import { type ProactivityItem, type PulseEntry, type PlanItem, type PlanUpdates } from "./types";
import { DashboardHeader } from "./DashboardHeader";
import { mapPlansToCalendarEvents, PLAN_EVENT_ID_PREFIX } from "./planCalendarUtils";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import { getProactivityTimes } from "./proactivityUtils";
import { ProactivitySettingsModal } from "./ProactivitySettingsModal";
import { DashboardPulseGrid } from "./dashboard/DashboardPulseGrid";
import { normalizePlanTier } from "@/components/gray/utils/helperFunctions";

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTimeSlotLabel = (start: Date, end?: Date | null) => {
  const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (!end) {
    return startLabel;
  }
  const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${startLabel}-${endLabel}`;
};

const CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT =
  "clamp(360px, calc(100vh - (320px + var(--gray-chat-bar-clearance, 112px))), 660px)";
const CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT =
  "clamp(420px, calc(100vh - clamp(48px, 6vh, 120px)), calc(100vh - clamp(32px, 4vh, 96px)))";
const CALENDAR_PANEL_HOUR_HEIGHT = 62;
const CALENDAR_PANEL_MIN_HEIGHT_PX = 420;
const CALENDAR_PANEL_HEIGHT_STORAGE_KEY = "gray.dashboard.calendarPanelHeightPx";

const buildPanelSizingStyle = (hasChatBar: boolean) =>
  ({
    "--calendar-max-height": hasChatBar
      ? CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT
      : CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT,
    "--dashboard-panel-max-height": hasChatBar
      ? CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT
      : CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT,
  }) as CSSProperties & { [key: string]: string | number };

type GrayDashboardViewProps = {
  pulseEntries: PulseEntry[];
  currentPulse: PulseEntry | null;
  isCurrentPulseEditable: boolean;
  livePlans?: PlanItem[];
  onSelectPulse: (id: string) => void;
  proactivityFallback: ProactivityItem | null;
  onProactivitySelect?: (next: ProactivityItem) => void;
  onProactivityRemove?: () => void;
  onTestProactivity?: (proactivityId: string) => void;
  onTogglePlan: (id: string) => void;
  onToggleHabit?: (id: string) => void;
  onSavePlan?: (planId: string, updates: PlanUpdates) => Promise<void> | void;
  onDeletePlan?: (plan: PlanItem) => void;
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
  onRefreshData: () => Promise<void>;
  chatBar?: ReactNode;
  isCompactLayout?: boolean;
  userId?: number | null;
  proactivityDeliveryKeys?: ReadonlySet<string>;
  onUpgradeClick?: () => void;
  showUpgradeButton?: boolean;
  isOverlay?: boolean;
};

export function GrayDashboardView({
  pulseEntries,
  currentPulse,
  isCurrentPulseEditable,
  livePlans,
  proactivityFallback,
  onProactivitySelect,
  onProactivityRemove,
  onTogglePlan,
  onDeletePlan,
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
  onRefreshData,
  chatBar,
  isCompactLayout = false,
  proactivityDeliveryKeys,
  onUpgradeClick,
  showUpgradeButton = false,
  isOverlay = false,
}: GrayDashboardViewProps) {
  const { t } = useI18n();
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
  const derivedTaskPlans = useMemo(() => {
    if (!calendarEvents.length) {
      return [];
    }
    return calendarEvents
      .filter(
        (event) =>
          event.entryType === "task" &&
          isSameDay(event.start, currentDate)
      )
      .map<PlanItem>((event) => ({
        id: `task-${event.id}`,
        label: event.title?.trim() || t("Untitled task"),
        completed: false,
        deadline: event.end ? event.end.toISOString() : null,
        scheduleSlot: formatTimeSlotLabel(event.start, event.end),
        details: event.description ?? null,
      }));
  }, [calendarEvents, currentDate, t]);

  const displayHabits = useMemo(() => {
    if (!hasPulseData) {
      return [];
    }
    return currentPulse?.habits ?? [];
  }, [currentPulse, hasPulseData]);
  const visiblePlans = useMemo(() => {
    const all = [...displayPlans, ...derivedTaskPlans];
    const seen = new Set<string>();
    return all.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }, [displayPlans, derivedTaskPlans]);
  const visibleHabits = displayHabits;
  const planCalendarEvents = useMemo(() => {
    if (activeTab !== "calendar") {
      return [];
    }
    return mapPlansToCalendarEvents(displayPlans);
  }, [activeTab, displayPlans]);

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
          // console.log(`[CALENDAR] Deleting plan event: ${event.id}`);
          onDeletePlan(targetPlan);
          return;
        }
      }
      console.warn(`[CALENDAR] Could not find plan for event: ${event.id}`);
    },
    [displayPlans, onDeletePlan]
  );
  const displayProactivity =
    hasPulseData && isCurrentPulseEditable
      ? currentPulse?.proactivity ?? proactivityFallback
      : proactivityFallback;
  const [isProactivityModalOpen, setIsProactivityModalOpen] = useState(false);
  const activeProactivityTimes = useMemo(() => getProactivityTimes(displayProactivity), [displayProactivity]);
  const isChatBarVisible = Boolean(chatBar);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const chatDockRef = useRef<HTMLDivElement | null>(null);
  const [panelAvailableHeightPx, setPanelAvailableHeightPx] = useState<number | null>(null);
  const [panelUserHeightPx, setPanelUserHeightPx] = useState<number | null>(null);
  const panelResizeRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const [isPanelResizing, setIsPanelResizing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY);
    if (!stored) {
      return;
    }
    const parsed = Number.parseInt(stored, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      Promise.resolve().then(() => setPanelUserHeightPx(parsed));
    }
  }, []);

  const effectivePanelHeightPx = useMemo(() => {
    if (panelAvailableHeightPx === null) {
      return null;
    }
    const maximum = Math.max(panelAvailableHeightPx, CALENDAR_PANEL_MIN_HEIGHT_PX);
    const desired = panelUserHeightPx ?? maximum;
    return Math.max(CALENDAR_PANEL_MIN_HEIGHT_PX, Math.min(desired, maximum));
  }, [panelAvailableHeightPx, panelUserHeightPx]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (panelUserHeightPx === null) {
      window.localStorage.removeItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CALENDAR_PANEL_HEIGHT_STORAGE_KEY, String(panelUserHeightPx));
  }, [panelUserHeightPx]);

  const panelSizingStyle = useMemo(() => {
    const style = buildPanelSizingStyle(isChatBarVisible);
    if (effectivePanelHeightPx !== null) {
      const maxHeightValue = `${effectivePanelHeightPx}px`;
      style["--calendar-max-height"] = maxHeightValue;
      style["--dashboard-panel-max-height"] = maxHeightValue;
    }
    return style;
  }, [effectivePanelHeightPx, isChatBarVisible]);

  const { user } = useUser();
  const normalizedTier = normalizePlanTier(user);
  const hasCalendarAccess = normalizedTier === "voyager" || normalizedTier === "pioneer";

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const computePanelHeight = () => {
      const container = calendarContainerRef.current;
      if (!container) {
        return;
      }
      const viewportHeight = window.innerHeight;
      const rect = container.getBoundingClientRect();
      const paddingBottom = Number.parseFloat(
        window.getComputedStyle(container).paddingBottom || "0"
      );
      const chatDockHeight =
        isChatBarVisible && chatDockRef.current
          ? chatDockRef.current.getBoundingClientRect().height
          : 0;
      const clearance = paddingBottom + chatDockHeight + (isChatBarVisible ? 24 : 16);
      const availableHeight = Math.max(
        CALENDAR_PANEL_MIN_HEIGHT_PX,
        viewportHeight - rect.top - clearance
      );
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
      if (event.pointerType === "touch") {
        return;
      }
      if (effectivePanelHeightPx === null || panelAvailableHeightPx === null) {
        return;
      }

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
        if (!state || moveEvent.pointerId !== state.pointerId) {
          return;
        }
        const deltaY = moveEvent.clientY - state.startY;
        const nextHeight = Math.round(state.startHeight + deltaY);
        const clamped = Math.max(
          CALENDAR_PANEL_MIN_HEIGHT_PX,
          Math.min(nextHeight, panelAvailableHeightPx)
        );
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
    if (!onProactivitySelect) {
      return;
    }
    setIsProactivityModalOpen(true);
  }, [onProactivitySelect]);

  const handleCloseProactivityModal = useCallback(() => {
    setIsProactivityModalOpen(false);
  }, []);

  const headerClassName = styles.pulseSurfaceHeader;

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
  const pulseContent = (
    <>
      {proactivityModal}
      <div className={styles.dashboardViewScrollContainer}>
        <DashboardHeader
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          className={headerClassName}
          onUpgradeClick={onUpgradeClick}
          showUpgradeButton={showUpgradeButton}
          showTabs={hasCalendarAccess}
        />
        <DashboardPulseGrid
          currentDate={currentDate}
          viewerName={user?.full_name ?? null}
          isEditable={isCurrentPulseEditable}
          plans={visiblePlans}
          habits={visibleHabits}
          proactivity={displayProactivity ?? null}
          proactivityDeliveryKeys={proactivityDeliveryKeys}
          onTogglePlan={onTogglePlan}
          onToggleHabit={onToggleHabit}
          canConfigureProactivity={Boolean(onProactivitySelect)}
          onConfigureProactivity={handleOpenProactivityModal}
          onRefreshData={onRefreshData}
        />
      </div>
    </>
  );

  const compactPulseContent = (
    <>
      {proactivityModal}
      <DashboardHeader
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        className={headerClassName}
        onUpgradeClick={onUpgradeClick}
        showUpgradeButton={showUpgradeButton}
        showTabs={hasCalendarAccess}
      />
      <div className={styles.dashboardCompact}>
        <DashboardPulseGrid
          currentDate={currentDate}
          viewerName={user?.full_name ?? null}
          isEditable={isCurrentPulseEditable}
          plans={visiblePlans}
          habits={visibleHabits}
          proactivity={displayProactivity ?? null}
          proactivityDeliveryKeys={proactivityDeliveryKeys}
          onTogglePlan={onTogglePlan}
          onToggleHabit={onToggleHabit}
          canConfigureProactivity={Boolean(onProactivitySelect)}
          onConfigureProactivity={handleOpenProactivityModal}
          onRefreshData={onRefreshData}
        />
      </div>
    </>
  );

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

  const calendarContent = (
    <GrayDashboardCalendar
      initialDate={currentDate}
      currentDate={currentDate}
      showSidebar={true}
      showHeaderDates={true}
      showCalendarList={hasCalendarAccess}
      calendars={calendars}
      events={mergedEvents}
      onCalendarsChange={onCalendarsChange}
      onEventsChange={onCalendarEventsChange}
      onEventDelete={handleCalendarEventDelete}
      onCreatePlan={onCreatePlan}
      onCreateHabit={onCreateHabit}
      selectedDate={calendarSelectedDate}
      onSelectedDateChange={onCalendarSelectedDateChange}
      hourHeight={CALENDAR_PANEL_HOUR_HEIGHT}
      onIntegrationAction={onIntegrationAction}
      dashboardTab="calendar"
      onSelectDashboardTab={() => { }}
      renderHeader={(headerProps) => (
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
      )}
      embedWithinParentSurface
      surfaceClassName={styles.dashboardCalendarInnerSurface}
    />
  );

  const compactCalendarContent = (
    <>
      <DashboardHeader
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        showTabs={false}
        className={headerClassName}
        onUpgradeClick={onUpgradeClick}
        showUpgradeButton={showUpgradeButton}
      />
      <div className={styles.dashboardCompactNotice}>
        <h3>{t("Calendar works best on a wider screen")}</h3>
        <p>{t("Expand your window or rotate your device to manage events and view the full schedule.")}</p>
      </div>
    </>
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
          {isCompactLayout || activeTab !== "calendar" ? null : (
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
