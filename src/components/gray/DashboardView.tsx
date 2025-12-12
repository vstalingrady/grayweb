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

const DEFAULT_PROACTIVITY_TIME = "09:00";

type ProactivityPreset = {
  id: string;
  title: string;
  label: string;
  cadence: string;
  description: string;
  summary: string;
  defaultTime?: string;
  defaultTimes?: string[];
  recommendedFor: string;
};

const CUSTOM_PROACTIVITY_ID = "proactivity-custom";

const PROACTIVITY_PRESETS: ProactivityPreset[] = [
  {
    id: "proactivity-frequent",
    title: "Frequent",
    label: "Check-ins",
    cadence: "Frequent",
    description: "Built for launch mode. Morning, midday, and evening nudges to keep momentum compounding.",
    summary: "Three structured touchpoints each day with action follow-ups.",
    recommendedFor: "Teams sprinting toward a release window or coordinating across time zones.",
    defaultTime: "09:00",
    defaultTimes: ["09:00", "14:00", "18:00"],
  },
  {
    id: "proactivity-daily",
    title: "Stay Close",
    label: "Check-ins",
    cadence: "Daily",
    description: "One guided check-in every morning plus smart reminders when things drift.",
    summary: "Daily rhythm that keeps work moving without overwhelming signal.",
    recommendedFor: "Founders or leads who want a steady async cadence.",
    defaultTime: "09:00",
  },
  {
    id: "proactivity-manual",
    title: "Manual Only",
    label: "Check-ins",
    cadence: "Manual",
    description: "Gray stays quiet until you ask. All proactive nudges are paused.",
    summary: "Full manual control with quick access to on-demand help.",
    recommendedFor: "Exploration phases or when you need a temporary quiet period.",
    defaultTime: "—",
  },
];

type CustomSettingsState = {
  times: string[];
};

const DEFAULT_CUSTOM_SETTINGS: CustomSettingsState = {
  times: [DEFAULT_PROACTIVITY_TIME],
};

type DashboardSectionSpec = {
  id: string;
  title: string;
  subtitle: string;
  layout?: "stacked";
  cards: Array<{ id: string; element: ReactNode }>;
};

const formatCustomTimeLabel = (time: string) => {
  if (!time || time === "—") {
    return "Flexible";
  }
  const [rawHour, rawMinute] = time.split(":").map((value) => Number.parseInt(value, 10));
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) {
    return time;
  }
  const date = new Date();
  date.setHours(rawHour, rawMinute, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const normalizeTimeForInput = (value: string | null | undefined) => {
  if (!value) {
    return DEFAULT_PROACTIVITY_TIME;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) {
    return trimmed.slice(0, 5);
  }
  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "AM") {
    if (hours === 12) {
      hours = 0;
    }
  } else if (period === "PM") {
    if (hours !== 12) {
      hours += 12;
    }
  }
  const clampedHours = Math.max(0, Math.min(23, hours));
  const clampedMinutes = Math.max(0, Math.min(59, minutes));
  return `${String(clampedHours).padStart(2, "0")}:${String(clampedMinutes).padStart(2, "0")}`;
};

type TimePickerPeriod = "AM" | "PM";

const TIME_PICKER_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const TIME_PICKER_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const TIME_PICKER_PERIODS: TimePickerPeriod[] = ["AM", "PM"];
const TIME_PICKER_SUGGESTIONS: { label: string; times: string[] }[] = [
  { label: "Morning", times: ["06:30", "07:30", "09:00", "10:30"] },
  { label: "Midday", times: ["11:30", "12:00", "13:00"] },
  { label: "Afternoon", times: ["15:00", "16:00", "17:30"] },
  { label: "Evening", times: ["18:00", "19:00", "20:30"] },
];

const toTimePickerParts = (value: string) => {
  const normalized = normalizeTimeForInput(value);
  const [rawHour, rawMinute] = normalized.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) {
    return { hour: "09", minute: "00", period: "AM" as TimePickerPeriod };
  }
  const period: TimePickerPeriod = rawHour >= 12 ? "PM" : "AM";
  let hour12 = rawHour % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  return {
    hour: String(hour12).padStart(2, "0"),
    minute: String(rawMinute).padStart(2, "0"),
    period,
  };
};

const fromTimePickerParts = (hour: string, minute: string, period: TimePickerPeriod) => {
  let hourNumber = Number.parseInt(hour, 10);
  if (Number.isNaN(hourNumber) || hourNumber < 1 || hourNumber > 12) {
    hourNumber = 12;
  }
  let resolvedHour = hourNumber % 12;
  if (period === "PM") {
    resolvedHour += 12;
  }
  const minuteNumber = Number.parseInt(minute, 10);
  const resolvedMinute = Math.max(0, Math.min(59, Number.isNaN(minuteNumber) ? 0 : minuteNumber));
  return `${String(resolvedHour).padStart(2, "0")}:${String(resolvedMinute).padStart(2, "0")}`;
};

const dedupeTimes = (times: string[]) =>
  times
    .map((value) => normalizeTimeForInput(value))
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();

const findNextCustomTime = (existingTimes: string[]): string => {
  const normalizedExisting = dedupeTimes(existingTimes);
  const existingSet = new Set(normalizedExisting);
  const base = normalizedExisting[normalizedExisting.length - 1] ?? DEFAULT_PROACTIVITY_TIME;
  const [baseHour, baseMinute] = base.split(":").map((value) => Number.parseInt(value, 10));
  const baseTotalMinutes =
    (Number.isFinite(baseHour) && Number.isFinite(baseMinute) ? baseHour * 60 + baseMinute : 9 * 60) %
    (24 * 60);
  const stepMinutes = 90;

  for (let index = 1; index <= Math.ceil((24 * 60) / stepMinutes); index += 1) {
    const totalMinutes = (baseTotalMinutes + index * stepMinutes) % (24 * 60);
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const candidate = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_PROACTIVITY_TIME;
};

const getProactivityTimes = (item: ProactivityItem | null | undefined) => {
  if (!item) {
    return [];
  }
  if (Array.isArray(item.times) && item.times.length > 0) {
    return dedupeTimes(item.times);
  }
  if (item.time) {
    return dedupeTimes([item.time]);
  }
  return [];
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
  hideCalendar?: boolean;
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
  hideCalendar = false,
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
  const customTimes = customSettings.times;
  const [editingCustomTimeIndex, setEditingCustomTimeIndex] = useState<number | null>(null);
  const [editingCustomTimeDraft, setEditingCustomTimeDraft] = useState<string>("");
  const formattedProactivityTimes = useMemo(
    () => activeProactivityTimes.map((time) => formatCustomTimeLabel(time)),
    [activeProactivityTimes]
  );
  const proactivityScheduleEntries = useMemo(() => {
    const todayKey = toDateKey(currentDate);
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
  }, [activeProactivityTimes, formattedProactivityTimes, activeProactivityTime, proactivityDeliveryKeys, currentDate]);
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

  const handleCustomReset = useCallback(() => {
    setCustomSettings({
      times:
        activeProactivityTimes.length > 0
          ? activeProactivityTimes
          : [...DEFAULT_CUSTOM_SETTINGS.times],
    });
    setEditingCustomTimeIndex(null);
    setEditingCustomTimeDraft("");
  }, [activeProactivityTimes]);

  const applyCustomProactivity = useCallback(
    (nextTimes: string[]) => {
      if (!onProactivitySelect) {
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
    [onProactivitySelect]
  );

  const handleCustomApply = useCallback(() => {
    applyCustomProactivity(customTimes);
    setIsProactivityModalOpen(false);
    setEditingCustomTimeIndex(null);
    setEditingCustomTimeDraft("");
  }, [
    applyCustomProactivity,
    customTimes,
  ]);

  const handleCustomTimeChange = useCallback((value: string) => {
    setEditingCustomTimeDraft(value);
  }, []);

  const commitCustomTimeEdit = useCallback(
    (index: number, draftValue: string) => {
      // Update local custom settings state.
      setCustomSettings((prev) => {
        const nextTimes = [...prev.times];
        const previousValue = nextTimes[index] ?? DEFAULT_PROACTIVITY_TIME;
        const normalized = normalizeTimeForInput(draftValue || previousValue);
        nextTimes[index] = normalized;
        return {
          ...prev,
          times: dedupeTimes(nextTimes),
        };
      });
      setEditingCustomTimeIndex(null);
      setEditingCustomTimeDraft("");
      // Notify parent about the updated schedule using the latest customTimes snapshot.
      const baseTimes = customTimes;
      const previousValue = baseTimes[index] ?? DEFAULT_PROACTIVITY_TIME;
      const normalized = normalizeTimeForInput(draftValue || previousValue);
      const nextTimes = [...baseTimes];
      nextTimes[index] = normalized;
      const deduped = dedupeTimes(nextTimes);
      applyCustomProactivity(deduped);
    },
    [applyCustomProactivity, customTimes]
  );
  const handleCustomTimeEdit = useCallback((index: number) => {
    setEditingCustomTimeIndex(index);
    setEditingCustomTimeDraft(customTimes[index] ?? DEFAULT_PROACTIVITY_TIME);
  }, [customTimes]);

  const handleCustomTimeAdd = useCallback(() => {
    const nextTime = findNextCustomTime(customTimes);
    setCustomSettings((prev) => ({
      ...prev,
      times: [...prev.times, nextTime],
    }));
    const nextTimes = [...customTimes, nextTime];
    setEditingCustomTimeIndex(nextTimes.length - 1);
    setEditingCustomTimeDraft(nextTime);
    applyCustomProactivity(nextTimes);
  }, [applyCustomProactivity, customTimes]);

  const handleCustomTimeRemove = useCallback((index: number) => {
    setCustomSettings((prev) => {
      if (prev.times.length <= 1) {
        return prev;
      }
      const nextTimes = prev.times.filter((_, currentIndex) => currentIndex !== index);
      const finalTimes = nextTimes.length > 0 ? nextTimes : [...DEFAULT_CUSTOM_SETTINGS.times];
      return {
        ...prev,
        times: finalTimes,
      };
    });
    setEditingCustomTimeIndex(null);
    setEditingCustomTimeDraft("");
    const nextTimes = customTimes.filter((_, currentIndex) => currentIndex !== index);
    const finalTimes = nextTimes.length > 0 ? nextTimes : [...DEFAULT_CUSTOM_SETTINGS.times];
    applyCustomProactivity(finalTimes);
  }, [applyCustomProactivity, customTimes]);

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

  const handleProactivityPresetSelect = useCallback(
    (preset: ProactivityPreset) => {
      if (!onProactivitySelect) {
        return;
      }
      const presetTimes =
        preset.defaultTimes && preset.defaultTimes.length > 0
          ? dedupeTimes(preset.defaultTimes)
          : dedupeTimes([preset.defaultTime ?? activeProactivityTime]);
      const primaryTime = presetTimes[0] ?? DEFAULT_PROACTIVITY_TIME;
      onProactivitySelect({
        id: preset.id,
        label: preset.label,
        description: preset.description,
        cadence: preset.cadence,
        time: primaryTime,
        times: presetTimes,
      });
    },
    [activeProactivityTime, onProactivitySelect]
  );

  const handleCloseProactivityModal = useCallback(() => {
    setIsProactivityModalOpen(false);
    setEditingCustomTimeIndex(null);
    setEditingCustomTimeDraft("");
  }, []);

  const handlePresetSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextPresetId = event.target.value;
      setSelectedPresetId(nextPresetId);
      if (!nextPresetId || nextPresetId === CUSTOM_PROACTIVITY_ID) {
        return;
      }
      const preset = PROACTIVITY_PRESETS.find((option) => option.id === nextPresetId);
      if (preset) {
        handleProactivityPresetSelect(preset);
      }
    },
    [handleProactivityPresetSelect]
  );

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

      applyCustomProactivity(nextTimes);
    },
    [
      activeProactivityTimes,
      activeProactivityTime,
      applyCustomProactivity,
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

  const proactivityModalContent = !isProactivityModalOpen
    ? null
    : (
      <div
        className={styles.proactivityModalBackdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proactivityModalHeading"
      >
        <div className={styles.proactivityModal}>
	          <header className={styles.proactivityModalHeader}>
	            <div className={styles.proactivityModalHeading}>
	              <span className={styles.proactivityModalEyebrow} id="proactivityModalHeading">
	                {t("Proactivity")}
	              </span>
	            </div>
	            <button
	              type="button"
	              className={styles.proactivityModalClose}
	              onClick={handleCloseProactivityModal}
	              aria-label={t("Close proactivity options")}
	            >
	              <X size={16} />
	            </button>
	          </header>
          <label
            id="proactivityPresetLabel"
	            htmlFor="proactivityPresetSelect"
	            className={styles.proactivityPresetLabel}
	          >
	            {t("Preset cadence")}
	          </label>
          <div className={styles.proactivityPresetSelectWrapper}>
            <select
              id="proactivityPresetSelect"
              className={styles.proactivityPresetSelect}
	              value={selectedPresetId}
	              onChange={handlePresetSelectChange}
	            >
	              <option value="">{t("Select a preset")}</option>
	              {PROACTIVITY_PRESETS.map((preset) => (
	                <option key={preset.id} value={preset.id}>
	                  {t(preset.title)}
	                </option>
	              ))}
	              <option value={CUSTOM_PROACTIVITY_ID}>{t("Custom")}</option>
	            </select>
            <ChevronDown size={14} className={styles.proactivityPresetSelectIcon} aria-hidden="true" />
          </div>
          {isCustomPresetSelected ? (
            <section className={styles.proactivityCustomSection}>
              <header className={styles.proactivityCustomHeader}>
                <div>
	                  <span className={styles.proactivityCustomEyebrow}>{t("Custom setup")}</span>
                </div>
	                <button
	                  type="button"
	                  className={styles.proactivityCustomReset}
	                  onClick={handleCustomReset}
	                >
	                  {t("Reset")}
	                </button>
              </header>
              <div className={styles.proactivityCustomControls}>
                <div className={styles.proactivityCustomField}>
                  <div className={styles.proactivityTimes}>
                    {customTimes.map((time, index) => (
                      <div key={`${time}-${index}`} className={styles.proactivityTimeListItem}>
                        {editingCustomTimeIndex === index ? (
                          <input
                            type="time"
                            value={editingCustomTimeDraft}
                            onChange={(event) => handleCustomTimeChange(event.target.value)}
                            className={styles.proactivityTimeInput}
                            autoFocus
                            step={300}
                            onBlur={() => commitCustomTimeEdit(index, editingCustomTimeDraft)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === "Escape") {
                                event.preventDefault();
                                commitCustomTimeEdit(index, editingCustomTimeDraft);
                              }
                            }}
	                            aria-label={t("Edit custom start time {time}", { time })}
	                          />
                        ) : (
                          <button
                            type="button"
                            className={styles.proactivityTimeListButton}
                            onClick={() => handleCustomTimeEdit(index)}
                          >
	                            <span className={styles.proactivityTimeLabel}>
	                              {t(formatCustomTimeLabel(time))}
	                            </span>
	                          </button>
                        )}
                        <div className={styles.proactivityTimeActions}>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={() => handleCustomTimeEdit(index)}
	                            aria-label={t("Edit custom start time {time}", { time })}
	                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={() => handleCustomTimeRemove(index)}
	                            aria-label={t("Remove custom start time {time}", { time })}
	                            disabled={customTimes.length <= 1}
	                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.proactivityTimeAdd}
                      onClick={handleCustomTimeAdd}
	                    >
	                      <Plus size={14} />
	                      <span>{t("Add time")}</span>
	                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
          <footer className={styles.proactivityModalFooter}>
            {showModalRemoveButton ? (
              <button
                type="button"
                className={styles.proactivityModalSecondary}
                onClick={handleModalProactivityRemove}
              >
                {modalRemoveLabel}
              </button>
            ) : null}
	            <button
	              type="button"
	              className={styles.proactivityModalDismiss}
	              onClick={handleCloseProactivityModal}
	            >
	              {t("Done")}
	            </button>
          </footer>
        </div>
      </div>
    );

  const proactivityModal =
    isMounted && isProactivityModalOpen && typeof document !== "undefined"
      ? createPortal(proactivityModalContent, document.body)
      : null;

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
	    <article className={styles.dashboardCard}>
	      <header className={styles.dashboardCardHeader}>
	        <span>{t("Plans")}</span>
	      </header>
      <div className={styles.dashboardCardBody}>
        <ul className={styles.planList}>
          {showPlansList
	            ? visiblePlans.map((plan) => {
	              const isDerivedReminder = derivedReminderIds.has(plan.id);
	              const timeLabel = formatPlanTimeLabel(plan);
	              const tagLabel = isDerivedReminder ? t("Reminder") : t("Plan");
              return (
                <li key={plan.id} className={styles.planListItem}>
                  <div
                    className={styles.planItemButton}
                    data-completed={plan.completed ? "true" : "false"}
                    role="group"
                  >
	                    <button
	                      type="button"
	                      className={styles.planCheckboxButton}
	                      aria-label={
	                        plan.completed ? t("Mark plan as incomplete") : t("Mark plan as complete")
	                      }
	                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handlePlanToggle(plan.id);
                      }}
                      disabled={!isCurrentPulseEditable}
                    >
                      <span className={styles.planCheckbox} aria-hidden="true">
                        {plan.completed ? <Check size={14} /> : <Square size={14} />}
                      </span>
                    </button>
                    <span className={styles.planLabelGroup}>
                      <span className={styles.planLabel}>{plan.label}</span>
                      {!isDerivedReminder && plan.details ? (
                        <span className={styles.planDetails}>{plan.details}</span>
                      ) : null}
                      {timeLabel ? (
                        <span className={styles.planTime}>
                          <time dateTime={plan.deadline ?? undefined}>{timeLabel}</time>
                        </span>
                      ) : null}
                      <span className={styles.planDerivedTag}>{tagLabel}</span>
                    </span>
                  </div>
                  {canManagePlans ? (
                    <span className={styles.listItemActions}>
                      {onSavePlan ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
	                          onClick={(event) => {
	                            event.preventDefault();
	                            event.stopPropagation();
	                            setPlanEditorTarget(plan);
	                          }}
	                          aria-label={t("Edit plan {label}", { label: plan.label })}
	                          disabled={!isCurrentPulseEditable}
	                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                      {onDeletePlan ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
	                          onClick={(event) => {
	                            event.preventDefault();
	                            event.stopPropagation();
	                            handlePlanDelete(plan);
	                          }}
	                          aria-label={t("Delete plan {label}", { label: plan.label })}
	                          disabled={!isCurrentPulseEditable}
	                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              );
            })
	            : (
	              <li className={styles.listEmptyMessage}>
	                <span>{t("No plans captured yet.")}</span>
	              </li>
	            )}
	        </ul>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!isCurrentPulseEditable}
	          data-disabled={!isCurrentPulseEditable ? "true" : "false"}
	          onClick={() => openModal("plan")}
	        >
	          {t("Add plans")}
	        </button>
	      </div>
	    </article>
	  );

	  const habitsCard = (
	    <article className={styles.dashboardCard}>
	      <header className={styles.dashboardCardHeader}>
	        <span>{t("Habits")}</span>
	      </header>
      <div className={styles.dashboardCardBody}>
        <ul className={`${styles.habitList} ${styles.dashboardHabitList}`}>
          {showHabitsList
            ? visibleHabits.map((habit) => (
              <li key={habit.id} className={styles.habitListItem}>
                <div
                  className={styles.planItemButton}
                  data-completed={habit.completed ? "true" : "false"}
                  role="group"
                >
	                  <button
	                    type="button"
	                    className={styles.planCheckboxButton}
	                    aria-label={
	                      habit.completed ? t("Mark habit as incomplete") : t("Mark habit as complete")
	                    }
	                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleHabitToggle(habit.id);
                    }}
                    disabled={!isCurrentPulseEditable || !onToggleHabit}
                  >
                    <span className={styles.planCheckbox} aria-hidden="true">
                      {habit.completed ? <Check size={14} /> : <Square size={14} />}
                    </span>
                  </button>
                  <span className={styles.habitContent}>
                    <span className={styles.habitLabel}>{habit.label}</span>
                    {habit.details ? (
                      <span className={styles.habitDetails}>{habit.details}</span>
                    ) : null}
                  </span>
                </div>
                <span className={styles.habitRightSection}>
                  {canManageHabits ? (
                    <span className={styles.listItemActions}>
                      {onEditHabit ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
	                          onClick={(event) => {
	                            event.preventDefault();
	                            event.stopPropagation();
	                            handleHabitEdit(habit);
	                          }}
	                          aria-label={t("Edit habit {label}", { label: habit.label })}
	                          disabled={!isCurrentPulseEditable}
	                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                      {onDeleteHabit ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
	                          onClick={(event) => {
	                            event.preventDefault();
	                            event.stopPropagation();
	                            handleHabitDelete(habit);
	                          }}
	                          aria-label={t("Delete habit {label}", { label: habit.label })}
	                          disabled={!isCurrentPulseEditable}
	                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                  <span className={styles.habitStreak}>
                    <Zap size={12} aria-hidden="true" />
                    <span>{habit.streakLabel}</span>
                  </span>
                </span>
              </li>
            ))
	            : (
	              <li className={styles.listEmptyMessage}>
	                <span>{t("No habits tracked yet.")}</span>
	              </li>
	            )}
	        </ul>
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!isCurrentPulseEditable}
	          data-disabled={!isCurrentPulseEditable ? "true" : "false"}
	          onClick={() => openModal("habit")}
	        >
	          {t("Add habits")}
	        </button>
	      </div>
	    </article>
	  );
	  const dashboardSections = useMemo<DashboardSectionSpec[]>(
	    () => [
	      {
	        id: "execution",
	        title: t("Execution"),
	        subtitle: t("Plans and habits shaping today's pulse"),
	        layout: "stacked",
	        cards: [
	          { id: "plans", element: plansCard },
	          { id: "habits", element: habitsCard },
	        ],
	      },
	    ],
	    [plansCard, habitsCard, t]
	  );
  const renderDashboardSections = useCallback(
    (variant: "default" | "compact" = "default") => {
      const sections =
        variant === "compact"
          ? [
            ...dashboardSections,
	            {
	              id: "compact-automation",
	              title: t("Signals & Automation"),
	              subtitle: t("Reminders, notifications, and proactive nudges"),
	              cards: [{ id: "proactivity", element: proactivityCard }],
	            },
          ]
          : dashboardSections;
      return sections.map((section) => {
        const gridClass =
          variant === "compact"
            ? styles.dashboardCompactGrid
            : (section as any).layout === "stacked"
              ? `${styles.dashboardGrid} ${styles.pulseGridStacked}`
              : styles.dashboardGrid;
        const showHeader = false; // Don't show section headers in pulse view
        return (
          <div key={section.id} className={gridClass}>
            {section.cards.map(({ id, element }) => (
              <div key={`${section.id}-${id}`} className={styles.dashboardSectionCard}>
                {element}
              </div>
            ))}
          </div>
        );
      });
    },
    [dashboardSections, proactivityCard, t]
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
        hideCalendar={hideCalendar}
      />
      <div
        className={calendarStyles.calendarSurfaceBody}
        data-has-sidebar="true"
      >
        <div className={styles.calendarSidebarColumn}>
          <div className={calendarStyles.calendarSidebarPanel}>
            <CalendarSidebar
              monthDate={pulseMonthDate}
              selectedDate={pulseSelectedDate}
              onSelectDate={handlePulseDateSelect}
              onNavigateMonth={handlePulseMonthNavigate}
              calendars={calendars}
              onToggleCalendar={handleCalendarVisibilityToggle}
              showSelectedDateLabel={false}
              showMonthNavigation
              className={calendarStyles.calendarSidebarIntegrated}
              showCalendarList={false}
              showCreateAction={false}
              onIntegrationAction={onIntegrationAction}
            />
          </div>
          <div className={styles.calendarProactivityColumn}>{proactivityCard}</div>
        </div>
        <div className={`${calendarStyles.calendarBoard} ${styles.pulseBoard}`}>
          <div className={styles.pulseBoardContent}>{renderDashboardSections()}</div>
        </div>
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
        hideCalendar={hideCalendar}
      />
      <div className={styles.dashboardCompact}>

        {renderDashboardSections("compact")}
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
