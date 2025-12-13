import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, Square, Zap, X, Plus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo, PositionedEvent } from "@/components/calendar/types";
import { type ProactivityItem, type PulseEntry, type PlanItem, type HabitItem, type PlanUpdates } from "./types";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { DashboardHeader } from "./DashboardHeader";
import { AddPlanHabitModal } from "./AddPlanHabitModal";
import { mapPlansToCalendarEvents, PLAN_EVENT_ID_PREFIX } from "./planCalendarUtils";
import { formatPlanTimeLabel } from "./planUtils";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";

import {
  CUSTOM_PROACTIVITY_ID,
  DEFAULT_CUSTOM_SETTINGS,
  DEFAULT_PROACTIVITY_TIME,
  PROACTIVITY_PRESETS,
  type ProactivityPreset,
  dedupeTimes,
  formatCustomTimeLabel,
  type CustomSettingsState,
  getProactivityTimes,
} from "./proactivityUtils";
import { ProactivitySettingsModal } from "./ProactivitySettingsModal";

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

const buildPanelSizingStyle = (hasChatBar: boolean) =>
  ({
    "--calendar-max-height": hasChatBar
      ? CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT
      : CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT,
    "--dashboard-panel-max-height": hasChatBar
      ? CALENDAR_PANEL_MAX_HEIGHT_WITH_CHAT
      : CALENDAR_PANEL_MAX_HEIGHT_NO_CHAT,
  }) as CSSProperties & { [key: string]: string | number };

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeToStartOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const formatRelativeDayLabel = (targetDate: Date, referenceDate: Date) => {
  const targetStart = normalizeToStartOfDay(targetDate);
  const referenceStart = normalizeToStartOfDay(referenceDate);
  const deltaDays = Math.round((targetStart.getTime() - referenceStart.getTime()) / DAY_IN_MS);

  if (deltaDays === 0) {
    return "Today";
  }
  if (deltaDays === -1) {
    return "Yesterday";
  }
  if (deltaDays === 1) {
    return "Tomorrow";
  }

  const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  if (targetStart.getFullYear() !== referenceStart.getFullYear()) {
    options.year = "numeric";
  }

  return targetStart.toLocaleDateString(undefined, options);
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type DashboardSectionSpec = {
  id: string;
  title: string;
  subtitle: string;
  layout?: "stacked";
  cards: Array<{ id: string; element: ReactNode }>;
};

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
  onEditHabit?: (habit: { id: string; label: string; previousLabel: string; streakLabel: string }) => void;
  onDeleteHabit?: (habit: { id: string; label: string; previousLabel: string; streakLabel: string }) => void;
  onIntegrationAction?: () => void;
  onRefreshData: () => Promise<void>;
  chatBar?: ReactNode;
  isCompactLayout?: boolean;
  userId?: number | null;
  reminderPlans?: PlanItem[];
  proactivityDeliveryKeys?: ReadonlySet<string>;
  onReminderMove?: (reminderId: number, range: { start: Date; end: Date }) => Promise<void> | void;
  streakCount?: number;
  onUpgradeClick?: () => void;
  showUpgradeButton?: boolean;
  isOverlay?: boolean;
};

export function GrayDashboardView({
  pulseEntries,
  currentPulse,
  isCurrentPulseEditable,
  livePlans,
  onSelectPulse,
  proactivityFallback,
  onProactivitySelect,
  onProactivityRemove,
  onTestProactivity,
  onTogglePlan,
  onSavePlan,
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
  onEditHabit,
  onDeleteHabit,
  onIntegrationAction,
  onRefreshData,
  chatBar,
  isCompactLayout = false,
  userId,
  reminderPlans,
  proactivityDeliveryKeys,
  onReminderMove,
  streakCount = 0,
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
  const [pulseSelectedDate, setPulseSelectedDate] = useState<Date>(() => new Date(currentDate));
  const [pulseMonthDate, setPulseMonthDate] = useState<Date>(() => new Date(currentDate));
  const lastCurrentDayRef = useRef<Date>(normalizeToStartOfDay(currentDate));
  const derivedTaskPlans = useMemo(() => {
    if (!calendarEvents.length) {
      return [];
    }
    return calendarEvents
      .filter(
        (event) =>
          event.entryType === "task" &&
          isSameDay(event.start, pulseSelectedDate)
      )
      .map<PlanItem>((event) => ({
        id: `task-${event.id}`,
        label: event.title?.trim() || t("Untitled task"),
        completed: false,
        deadline: event.end ? event.end.toISOString() : null,
        scheduleSlot: formatTimeSlotLabel(event.start, event.end),
        details: event.description ?? null,
      }));
  }, [calendarEvents, pulseSelectedDate, t]);

  const displayHabits = hasPulseData ? currentPulse?.habits ?? [] : [];
  const derivedReminderPlans = reminderPlans ?? [];
  const visiblePlans = useMemo(() => {
    const all = [...displayPlans, ...derivedTaskPlans, ...derivedReminderPlans];
    const seen = new Set<string>();
    return all.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }, [displayPlans, derivedTaskPlans, derivedReminderPlans]);
  const visibleHabits = useMemo(() => [...displayHabits], [displayHabits]);
  const derivedReminderIds = useMemo(
    () => new Set(derivedReminderPlans.map((plan) => plan.id)),
    [derivedReminderPlans]
  );
  const planCalendarEvents = useMemo(() => {
    const plansExcludingReminders = displayPlans.filter((plan) => !plan.id.startsWith("reminder-"));
    return mapPlansToCalendarEvents(plansExcludingReminders);
  }, [displayPlans]);

  const handleCalendarTaskToggle = useCallback(
    (event: CalendarEvent) => {
      if (!event.id.startsWith(PLAN_EVENT_ID_PREFIX)) {
        return;
      }
      onTogglePlan(event.id.slice(PLAN_EVENT_ID_PREFIX.length));
    },
    [onTogglePlan]
  );

  const handleCalendarEventDelete = useCallback(
    (event: CalendarEvent) => {
      if (!onDeletePlan) {
        return;
      }

      // Handle reminder events (e.g., "reminder-31")
      if (event.id.startsWith("reminder-")) {
        const targetPlan = displayPlans.find((plan) => plan.id === event.id);
        if (targetPlan) {
          // console.log(`[CALENDAR] Deleting reminder event: ${event.id}`);
          onDeletePlan(targetPlan);
          return;
        }

        // Fallback 1: Try to match complex chat-session reminder IDs (reminder-assistant-{id}-{iso})
        // to the normalized plan ID (reminder-{id}).
        const complexMatch = event.id.match(/^reminder-[^-]+-(\d+)-/);
        if (complexMatch) {
          const numericId = complexMatch[1];
          const simpleId = `reminder-${numericId}`;
          const fallbackPlan = displayPlans.find((plan) => plan.id === simpleId);
          if (fallbackPlan) {
            // console.log(`[CALENDAR] Deleting reminder event via fallback: ${event.id} -> ${simpleId}`);
            onDeletePlan(fallbackPlan);
            return;
          }
        }

        // Fallback 2: If still not found (e.g. stale displayPlans but valid chat event),
        // construct a synthetic plan to trigger deletion by ID.
        // console.log(`[CALENDAR] Deleting reminder event via synthetic fallback: ${event.id}`);
        const syntheticPlan: PlanItem = {
          id: event.id,
          label: event.title,
          completed: false,
          deadline: null,
          scheduleSlot: null,
          details: null,
        };
        onDeletePlan(syntheticPlan);
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
      console.warn(`[CALENDAR] Could not find plan/reminder for event: ${event.id}`);
    },
    [displayPlans, onDeletePlan]
  );
  const displayProactivity =
    hasPulseData && isCurrentPulseEditable
      ? currentPulse?.proactivity ?? proactivityFallback
      : proactivityFallback;
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: "plan" | "habit" | null }>({
    isOpen: false,
    type: null,
  });
  const [planEditorTarget, setPlanEditorTarget] = useState<PlanItem | null>(null);
  const [isProactivityModalOpen, setIsProactivityModalOpen] = useState(false);
  const fallbackProactivityTimes = useMemo(
    () => getProactivityTimes(proactivityFallback),
    [proactivityFallback]
  );
  const activeProactivityTimes = useMemo(() => {
    if (displayProactivity) {
      return getProactivityTimes(displayProactivity);
    }
    return fallbackProactivityTimes;
  }, [displayProactivity, fallbackProactivityTimes]);
  const fallbackProactivityTime = fallbackProactivityTimes[0];
  const activeProactivityTime = activeProactivityTimes[0] ?? fallbackProactivityTime;
  const isChatBarVisible = Boolean(chatBar) && !modalState.isOpen;
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const chatDockRef = useRef<HTMLDivElement | null>(null);
  const [panelMaxHeightPx, setPanelMaxHeightPx] = useState<number | null>(null);
  const panelSizingStyle = useMemo(() => {
    const style = buildPanelSizingStyle(isChatBarVisible);
    if (panelMaxHeightPx !== null) {
      const maxHeightValue = `${panelMaxHeightPx}px`;
      style["--calendar-max-height"] = maxHeightValue;
      style["--dashboard-panel-max-height"] = maxHeightValue;
    }
    return style;
  }, [isChatBarVisible, panelMaxHeightPx]);

  const { user } = useUser();
  const planTierRaw = (user?.plan_tier || "pioneer").toLowerCase();
  const planTier = planTierRaw === "scout" ? "pioneer" : planTierRaw;
  const isScout = planTier === "scout";

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
      const availableHeight = Math.max(420, viewportHeight - rect.top - clearance);
      setPanelMaxHeightPx((previous) => {
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
  const pulseTodayButtonLabel = useMemo(
    () => formatRelativeDayLabel(pulseSelectedDate, currentDate),
    [pulseSelectedDate, currentDate]
  );
  const activeProactivityId = displayProactivity?.id ?? proactivityFallback?.id ?? null;
  const timezoneLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const [customSettings, setCustomSettings] = useState<CustomSettingsState>(() => ({
    times: activeProactivityTimes.length > 0 ? activeProactivityTimes : [...DEFAULT_CUSTOM_SETTINGS.times],
  }));
  const resolveNotificationPermission = useCallback((): NotificationPermission | "unsupported" => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    if (window.isSecureContext === false) {
      return "unsupported";
    }
    return Notification.permission;
  }, []);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() =>
    resolveNotificationPermission()
  );
  useEffect(() => {
    setNotificationPermission(resolveNotificationPermission());
  }, [resolveNotificationPermission]);
  const handleNotificationEnable = useCallback(async () => {
    const permission = await requestNotificationPermission();
    if (permission) {
      setNotificationPermission(permission);
    }
  }, []);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
      return activeProactivityId;
    }
    if (activeProactivityId === CUSTOM_PROACTIVITY_ID) {
      return CUSTOM_PROACTIVITY_ID;
    }
    return "";
  });
  /* Helper vars for modal UI */

  const formattedProactivityTimes = useMemo(
    () => activeProactivityTimes.map((time) => formatCustomTimeLabel(time)),
    [activeProactivityTimes]
  );

  const proactivityScheduleEntries = useMemo(() => {
    const todayKey = toDateKey(currentDate);
    // Safe access to keySet, assumed to be part of props or overlapping context
    const keySet = proactivityDeliveryKeys;
    if (activeProactivityTimes.length > 0) {
      return activeProactivityTimes.map((time, index) => ({
        time,
        label: formattedProactivityTimes[index] ?? formatCustomTimeLabel(time),
        delivered: keySet?.has(`${todayKey}T${time}`) ?? false,
      }));
    }
    if (activeProactivityTime) {
      return [
        {
          time: activeProactivityTime,
          label: formatCustomTimeLabel(activeProactivityTime),
          delivered: keySet?.has(`${todayKey}T${activeProactivityTime}`) ?? false,
        },
      ];
    }
    return [];
  }, [
    activeProactivityTimes,
    formattedProactivityTimes,
    activeProactivityTime,
    proactivityDeliveryKeys,
    currentDate,
  ]);
  const proactivityButtonLabel = displayProactivity ? t("Configure") : t("Setup");
  const canApplyCustom = customTimes.length > 0;
  const canOpenProactivityModal = Boolean(onProactivitySelect);
  const showModalRemoveButton = Boolean(
    onProactivityRemove && (displayProactivity ?? proactivityFallback)
  );
  const modalRemoveLabel = displayProactivity ? t("Remove proactivity") : t("Skip for now");
  const shouldShowNotificationBanner =
    notificationPermission !== "granted" && notificationPermission !== "unsupported";
  const notificationBannerLabel =
    notificationPermission === "denied"
      ? t("Desktop alerts are off. Allow notifications in your browser settings to get nudges.")
      : t("Enable desktop alerts so Gray can nudge you when check-ins land.");
  const pulseEntriesByDate = useMemo(() => {
    const map = new Map<string, PulseEntry>();
    pulseEntries.forEach((entry) => {
      map.set(entry.dateKey, entry);
    });
    return map;
  }, [pulseEntries]);

  const selectedPreset = useMemo(
    () => PROACTIVITY_PRESETS.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId]
  );
  const isCustomPresetSelected = selectedPresetId === CUSTOM_PROACTIVITY_ID;

  useEffect(() => {
    const nextCurrentDay = normalizeToStartOfDay(currentDate);
    const previousCurrentDay = lastCurrentDayRef.current;

    if (
      previousCurrentDay.getFullYear() === nextCurrentDay.getFullYear() &&
      previousCurrentDay.getMonth() === nextCurrentDay.getMonth() &&
      previousCurrentDay.getDate() === nextCurrentDay.getDate()
    ) {
      return;
    }

    lastCurrentDayRef.current = nextCurrentDay;

    setPulseSelectedDate((previous) =>
      isSameDay(previous, previousCurrentDay) ? new Date(currentDate) : previous
    );
    setPulseMonthDate((previous) =>
      previous.getFullYear() === previousCurrentDay.getFullYear() &&
        previous.getMonth() === previousCurrentDay.getMonth()
        ? new Date(currentDate)
        : previous
    );
  }, [currentDate]);

  useEffect(() => {
    if (!isProactivityModalOpen) {
      return;
    }
    setCustomSettings((prev) => ({
      times:
        activeProactivityTimes.length > 0
          ? activeProactivityTimes
          : [...DEFAULT_CUSTOM_SETTINGS.times],
    }));
    if (activeProactivityId === CUSTOM_PROACTIVITY_ID) {
      setSelectedPresetId(CUSTOM_PROACTIVITY_ID);
    } else if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
      setSelectedPresetId(activeProactivityId);
    } else {
      setSelectedPresetId("");
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsProactivityModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeProactivityId,
    activeProactivityTimes,
    isProactivityModalOpen,
  ]);

  useEffect(() => {
    if (!isProactivityModalOpen) {
      setEditingCustomTimeIndex(null);
      setEditingCustomTimeDraft("");
    }
  }, [isProactivityModalOpen]);

  /* Removed custom time handlers as they are now in ProactivitySettingsModal */

  const handlePulseDateSelect = useCallback(
    (nextDate: Date) => {
      setPulseSelectedDate(nextDate);
      setPulseMonthDate(nextDate);
      const key = toDateKey(nextDate);
      const matchingEntry = pulseEntriesByDate.get(key);
      if (matchingEntry) {
        onSelectPulse(matchingEntry.id);
      }
    },
    [onSelectPulse, pulseEntriesByDate]
  );

  const handlePulseShiftDay = useCallback(
    (offset: number) => {
      const base = pulseSelectedDate ?? currentDate;
      const next = new Date(base);
      next.setDate(base.getDate() + offset);
      handlePulseDateSelect(next);
    },
    [currentDate, handlePulseDateSelect, pulseSelectedDate]
  );

  const handlePulseMonthNavigate = useCallback((offset: number) => {
    setPulseMonthDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + offset);
      return next;
    });
  }, []);

  const handleCalendarVisibilityToggle = useCallback(
    (calendarId: string) => {
      onCalendarsChange(
        calendars.map((calendar) =>
          calendar.id === calendarId
            ? { ...calendar, isVisible: !calendar.isVisible }
            : calendar
        )
      );
    },
    [calendars, onCalendarsChange]
  );

  const openModal = useCallback(
    (type: "plan" | "habit") => {
      if (!isCurrentPulseEditable) {
        return;
      }
      setModalState({ isOpen: true, type });
    },
    [isCurrentPulseEditable]
  );

  const closeModal = useCallback(() => {
    setModalState({ isOpen: false, type: null });
  }, []);

  const handleModalSuccess = useCallback(async () => {
    await onRefreshData();
  }, [onRefreshData]);

  const handleOpenProactivityModal = useCallback(() => {
    if (!onProactivitySelect) {
      return;
    }
    setIsProactivityModalOpen(true);
  }, [onProactivitySelect]);

  const handleCloseProactivityModal = useCallback(() => {
    setIsProactivityModalOpen(false);
    setEditingCustomTimeIndex(null);
    setEditingCustomTimeDraft("");
  }, []);

  const handleModalProactivityRemove = useCallback(() => {
    if (!onProactivityRemove) {
      return;
    }
    onProactivityRemove();
    setIsProactivityModalOpen(false);
  }, [onProactivityRemove]);

  const handleProactivityTimeRemove = useCallback(
    (index: number) => {
      const baseTimes =
        activeProactivityTimes.length > 0
          ? activeProactivityTimes
          : activeProactivityTime
            ? [activeProactivityTime]
            : [];

      if (baseTimes.length <= 1) {
        handleModalProactivityRemove();
        return;
      }

      if (!onProactivitySelect) {
        handleModalProactivityRemove();
        return;
      }

      const nextTimes = baseTimes.filter((_, currentIndex) => currentIndex !== index);
      if (nextTimes.length === 0) {
        handleModalProactivityRemove();
        return;
      }

      const sortedTimes = dedupeTimes(nextTimes);
      const firstTime = sortedTimes[0] ?? DEFAULT_PROACTIVITY_TIME;
      const formattedTimes = sortedTimes.map((time) => formatCustomTimeLabel(time)).join(", ");
      const descriptionParts = [`${sortedTimes.length} touchpoints`, formattedTimes];

      onProactivitySelect({
        id: CUSTOM_PROACTIVITY_ID,
        label: "Custom plan",
        description: descriptionParts.join(" • "),
        cadence: "Custom",
        time: firstTime,
        times: sortedTimes,
      });
    },
    [
      activeProactivityTimes,
      activeProactivityTime,
      handleModalProactivityRemove,
      onProactivitySelect,
    ]
  );

  const handlePlanToggle = (planId: string) => {
    if (!isCurrentPulseEditable) {
      return;
    }
    onTogglePlan(planId);
  };

  const handleHabitToggle = (habitId: string) => {
    if (!isCurrentPulseEditable || !onToggleHabit) {
      return;
    }
    onToggleHabit(habitId);
  };

  const resolvePlanFromEvent = useCallback(
    (eventId: string) => {
      if (!eventId.startsWith(PLAN_EVENT_ID_PREFIX)) {
        return null;
      }
      const planId = eventId.slice(PLAN_EVENT_ID_PREFIX.length);
      return displayPlans.find((plan) => plan.id === planId) ?? null;
    },
    [displayPlans]
  );

  const handlePlanDelete = useCallback(
    (plan: PlanItem) => {
      if (!isCurrentPulseEditable || !onDeletePlan) {
        return;
      }
      onDeletePlan(plan);
    },
    [isCurrentPulseEditable, onDeletePlan]
  );

  const handleHabitEdit = useCallback(
    (habit: HabitItem) => {
      if (!isCurrentPulseEditable || !onEditHabit) {
        return;
      }
      onEditHabit(habit);
    },
    [isCurrentPulseEditable, onEditHabit]
  );

  const handleHabitDelete = useCallback(
    (habit: HabitItem) => {
      if (!isCurrentPulseEditable || !onDeleteHabit) {
        return;
      }
      onDeleteHabit(habit);
    },
    [isCurrentPulseEditable, onDeleteHabit]
  );

  const showPlansList = visiblePlans.length > 0;
  const showHabitsList = visibleHabits.length > 0;

  const headerClassName = styles.pulseSurfaceHeader;
  const canManagePlans =
    isCurrentPulseEditable && Boolean(onSavePlan || onDeletePlan);
  const canManageHabits = isCurrentPulseEditable && Boolean(onToggleHabit || onEditHabit || onDeleteHabit);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const renderProactivityCard = (additionalClassName?: string) => (
    <article
      className={[
        styles.dashboardCard,
        styles.proactivityCard,
        additionalClassName ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={styles.dashboardCardHeader}>
        <span>{t("Proactivity")}</span>
      </header>
      <div className={styles.dashboardCardBody}>
        {shouldShowNotificationBanner ? (
          <div className={styles.proactivityNotificationBanner}>
            <p>{notificationBannerLabel}</p>
            {notificationPermission !== "denied" ? (
              <button type="button" onClick={handleNotificationEnable} className={styles.proactivityNotificationButton}>
                {t("Enable alerts")}
              </button>
            ) : null}
          </div>
        ) : null}
        {displayProactivity ? (
          <ul className={styles.planList}>
            {proactivityScheduleEntries.length > 0 ? (
              proactivityScheduleEntries.map(({ label, delivered }, index) => (
                <li key={`${label}-${index}`} className={styles.planListItem}>
                  <span className={styles.planCheckbox} aria-hidden="true">
                    {delivered ? <Check size={14} /> : <Square size={14} />}
                  </span>
                  <span className={styles.planLabelGroup}>
                    <span className={styles.planLabel}>{t(label)}</span>
                  </span>
                  {canOpenProactivityModal || showModalRemoveButton ? (
                    <span className={styles.listItemActions}>
                      {canOpenProactivityModal ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
                          onClick={handleOpenProactivityModal}
                          aria-label={t("Edit proactivity schedule")}
                          disabled={!canOpenProactivityModal}
                        >
                          <Pencil size={12} />
                        </button>
                      ) : null}
                      {showModalRemoveButton ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
                          onClick={() => handleProactivityTimeRemove(index)}
                          aria-label={t("Remove proactivity time {label}", { label })}
                          disabled={!showModalRemoveButton}
                        >
                          <X size={12} />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))
            ) : (
              <li className={styles.listEmptyMessage}>
                <span>{t("No schedule yet.")}</span>
              </li>
            )}
          </ul>
        ) : (
          <div className={styles.cardEmptyMessage}>
            <span>{t("Not configured")}</span>
          </div>
        )}
        <button
          type="button"
          className={`${styles.secondaryAction} ${styles.proactivitySetupButton}`}
          disabled={!canOpenProactivityModal}
          data-disabled={!canOpenProactivityModal ? "true" : "false"}
          onClick={handleOpenProactivityModal}
        >
          {proactivityButtonLabel}
        </button>
      </div>
    </article>
  );

  const proactivityCard = renderProactivityCard();

  const plansCard = (
    <div className={`${styles.dashboardCard} ${styles.dashboardCardPlans}`}>
      <div className={styles.dashboardCardHeader}>
        <div className={`${styles.dashboardCardIcon} ${styles.iconBlue}`}>
          <Square size={16} />
        </div>
        <h2 className={styles.dashboardCardTitle}>{t("Plans")}</h2>
      </div>
      <div className={styles.dashboardCardBody}>
        {showPlansList ? (
          <ul className={styles.dashboardList}>
            {visiblePlans.map(plan => (
              <li key={plan.id} className={styles.dashboardListItem}>
                <button
                  className={styles.planCheckboxButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handlePlanToggle(plan.id);
                  }}
                >
                  {plan.completed ? <Check size={14} /> : <Square size={14} color="#52525b" />}
                </button>
                <span
                  className={styles.dashboardTaskLabel}
                  data-completed={plan.completed ? "true" : "false"}
                >
                  {plan.label}
                </span>
                {/* Actions (Edit/Delete) could go here but kept simple for now per redesign focus on layout */}
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.dashboardListEmpty}>{t("No active plans")}</div>
        )}
        <button
          className={styles.dashboardButtonNeutral}
          onClick={() => openModal("plan")}
        >
          {t("Add plans")}
        </button>
      </div>
    </div>
  );

  const habitsCard = (
    <div className={`${styles.dashboardCard} ${styles.dashboardCardHabits}`}>
      <div className={styles.dashboardCardHeader}>
        <div className={`${styles.dashboardCardIcon} ${styles.iconCyan}`}>
          <Check size={16} />
        </div>
        <h2 className={styles.dashboardCardTitle}>{t("Habits")}</h2>
      </div>
      <div className={styles.dashboardCardBody}>
        {showHabitsList ? (
          <ul className={styles.dashboardList}>
            {visibleHabits.map(habit => (
              <li key={habit.id} className={styles.dashboardListItem}>
                <button
                  className={styles.planCheckboxButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleHabitToggle(habit.id);
                  }}
                >
                  {habit.completed ? <Check size={14} /> : <Square size={14} color="#52525b" />}
                </button>
                <span
                  className={styles.dashboardTaskLabel}
                  data-completed={habit.completed ? "true" : "false"}
                >
                  {habit.label}
                </span>
                {/* Actions (Edit/Delete) omitted for standard view per redesign */}
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.dashboardListEmpty}>{t("No active habits")}</div>
        )}
        <button
          className={styles.dashboardButtonNeutral}
          onClick={() => openModal("habit")}
        >
          {t("Add habits")}
        </button>
      </div>
    </div>
  );
  /* NEW DASHBOARD GRID */
  const dashboardGrid = (
    <div className={styles.dashboardGridFinal}>
      <div className={styles.dashboardHeaderArea}>
        <div>
          <h1 className={styles.dashboardGreeting}>{greetingForDate(currentDate)}, {user?.full_name?.split(" ")[0] || "there"}</h1>
          <div className={styles.dashboardDate}>
            {currentDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <div className={styles.dashboardHeaderSide}>
          {streakCount > 0 ? (
            <div
              className={styles.streakBadge}
              aria-label={t("{count} day streak", { count: streakCount })}
            >
              <Zap size={12} />
              <span>{streakCount}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Proactivity Card */}
      <div className={`${styles.dashboardCard} ${styles.dashboardCardProactivity}`}>
        <div className={styles.dashboardCardHeader}>
          <div className={`${styles.dashboardCardIcon} ${styles.iconBlue}`}>
            <Zap size={16} fill="white" />
          </div>
          <h2 className={styles.dashboardCardTitle}>{t("Proactivity")}</h2>
        </div>
        <div className={styles.dashboardCardBody}>
          {proactivityScheduleEntries.length > 0 ? (
            <ul className={styles.proactivityChecklist}>
              {proactivityScheduleEntries.map(({ label, delivered }, index) => (
                <li key={`${label}-${index}`} className={styles.proactivityChecklistItem}>
                  <span className={styles.proactivityChecklistIcon} aria-hidden="true">
                    {delivered ? <Check size={14} /> : <Square size={14} />}
                  </span>
                  <span className={styles.proactivityChecklistLabel}>{t(label)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.proactivityEmptyState}>
              <span>{t("No check-ins scheduled")}</span>
            </div>
          )}
          <button
            type="button"
            className={styles.proactivityConfigureLink}
            onClick={handleOpenProactivityModal}
            disabled={!canOpenProactivityModal}
          >
            {t("configure")}
          </button>
        </div>
      </div>

      {plansCard}
      {habitsCard}
    </div>
  );

  const pulseMonthLabel = pulseMonthDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const pulseRangeLabel = pulseSelectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const pulseContent = (
    <>
      {proactivityModal}
      <DashboardHeader
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        className={headerClassName}
        onUpgradeClick={onUpgradeClick}
        showUpgradeButton={showUpgradeButton}
      />
      <div className={styles.dashboardViewScrollContainer}>
        {dashboardGrid}
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
      />
      <div className={styles.dashboardCompact}>
        {dashboardGrid}
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
      showSelectedDateLabel={false}
      showCalendarList={!isScout}
      calendars={calendars}
      events={mergedEvents}
      onCalendarsChange={onCalendarsChange}
      onEventsChange={onCalendarEventsChange}
      onEventDelete={handleCalendarEventDelete}
      selectedDate={calendarSelectedDate}
      onSelectedDateChange={onCalendarSelectedDateChange}
      hourHeight={CALENDAR_PANEL_HOUR_HEIGHT}
      onIntegrationAction={onIntegrationAction}
      dashboardTab={activeTab}
      onSelectDashboardTab={onSelectTab}
      renderHeader={(headerProps) => (
        <DashboardHeader
          activeTab={headerProps.activeTab}
          onSelectTab={headerProps.onSelectTab}
          onGoToday={headerProps.onGoToday}
          viewMode={headerProps.viewMode}
          onViewModeChange={headerProps.onViewModeChange}
          viewModeOptions={headerProps.viewModeOptions}
          rangeNavigationLabel={headerProps.rangeNavigationLabel}
          label={undefined}
          title={undefined}
          rangeLabel={undefined}
          className={headerClassName}
          onUpgradeClick={onUpgradeClick}
          showUpgradeButton={showUpgradeButton}
        />
      )}
      embedWithinParentSurface
      maxHeight={panelMaxHeightPx !== null ? `${panelMaxHeightPx}px` : undefined}
      surfaceClassName={styles.dashboardCalendarInnerSurface}
    />
  );

  const compactCalendarContent = (
    <>
      <DashboardHeader
        activeTab={activeTab}
        onSelectTab={onSelectTab}
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

  const dashboardSurfaceClassName = [
    styles.dashboardCalendarSurface,
  ]
    .filter(Boolean)
    .join(" ");

  const surfaceContent = isCompactLayout
    ? activeTab === "pulse"
      ? compactPulseContent
      : compactCalendarContent
    : activeTab === "pulse"
      ? pulseContent
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
        >
          <div
            className={dashboardSurfaceClassName}
            data-compact={isCompactLayout ? "true" : "false"}
          >
            {surfaceContent}
          </div>
        </div>
        {isChatBarVisible ? (
          <div className={styles.chatComposerDock} ref={chatDockRef}>
            {chatBar}
          </div>
        ) : null}
      </div>
      {modalState.isOpen && modalState.type && (
        <AddPlanHabitModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          type={modalState.type}
          onSuccess={handleModalSuccess}
        />
      )}
      {planEditorTarget && onSavePlan ? (
        <AddPlanHabitModal
          isOpen={Boolean(planEditorTarget)}
          onClose={() => setPlanEditorTarget(null)}
          type="plan"
          onSuccess={handleModalSuccess}
          planToEdit={planEditorTarget}
          onSubmitPlan={async (planId, updates) => {
            if (!planId) {
              return;
            }
            await onSavePlan(planId, updates);
          }}
        />
      ) : null}
    </>
  );
}
