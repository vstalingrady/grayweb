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
import { Check, Square, Flame, X, Plus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type ProactivityItem, type PulseEntry, type PlanItem, type HabitItem } from "./types";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { DashboardHeader } from "./DashboardHeader";
import { AddPlanHabitModal } from "./AddPlanHabitModal";

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

const formatPlanMeta = (plan: { scheduleSlot?: string | null; deadline?: string | null }) => {
  const parts: string[] = [];
  if (plan.scheduleSlot) {
    const [startRaw, endRaw] = plan.scheduleSlot.split("-").map((value) => value?.trim() ?? "");
    const parseTime = (time: string) => {
      const [h, m] = time.split(":").map((value) => Number.parseInt(value, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) {
        return null;
      }
      const date = new Date();
      date.setHours(h, m, 0, 0);
      return date;
    };
    const startTime = parseTime(startRaw);
    const endTime = parseTime(endRaw);
    if (startTime && endTime) {
      parts.push(
        `Slot ${startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${endTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      );
    } else if (startTime) {
      parts.push(`Slot ${startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    } else {
      parts.push(`Slot ${plan.scheduleSlot}`);
    }
  }

  if (plan.deadline) {
    const deadlineDate = new Date(plan.deadline);
    if (!Number.isNaN(deadlineDate.getTime())) {
      parts.push(
        `Due ${deadlineDate.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })}`
      );
    } else {
      parts.push(`Due ${plan.deadline}`);
    }
  }

  return parts.join(" • ");
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

const PROACTIVITY_PRESETS: ProactivityPreset[] = [
  {
    id: "proactivity-frequent",
    title: "Frequent",
    label: "Check-ins",
    cadence: "Frequent",
    description: "Built for launch mode. Morning, midday, and evening nudges to keep momentum compounding.",
    summary: "Three structured touchpoints each day with action follow-ups.",
    recommendedFor: "Teams sprinting toward a release window or coordinating across time zones.",
    defaultTime: "08:00",
    defaultTimes: ["08:00", "12:30", "18:30"],
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
    id: "proactivity-weekly",
    title: "Light Touch",
    label: "Check-ins",
    cadence: "Weekly",
    description: "End-of-week recap with highlights, gaps, and next-step prompts.",
    summary: "Weekly sweep so nothing slips through the cracks.",
    recommendedFor: "Calmer seasons or teams that already sync live each day.",
    defaultTime: "16:30",
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

type CustomChannelValue = "assistant" | "email" | "browser";

type CustomSettingsState = {
  times: string[];
  channels: CustomChannelValue[];
};

const ALL_CUSTOM_CHANNELS: CustomChannelValue[] = ["assistant", "email", "browser"];

const CUSTOM_CHANNEL_OPTIONS: Array<{
  value: CustomChannelValue;
  label: string;
  helper: string;
}> = [
  {
    value: "assistant",
    label: "In-app assistant",
    helper: "Notifications inside Gray with quick actions.",
  },
  {
    value: "email",
    label: "Email digest",
    helper: "A summary sent to your inbox.",
  },
  {
    value: "browser",
    label: "Browser notifications",
    helper: "Web push notifications directly to your browser.",
  },
];

const DEFAULT_CUSTOM_CHANNELS: CustomChannelValue[] = ["assistant"];

const DEFAULT_CUSTOM_SETTINGS: CustomSettingsState = {
  times: [DEFAULT_PROACTIVITY_TIME],
  channels: [...DEFAULT_CUSTOM_CHANNELS],
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
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

const dedupeTimes = (times: string[]) =>
  times
    .map((value) => normalizeTimeForInput(value))
    .filter((value, index, array) => array.indexOf(value) === index);

const getProactivityTimes = (item: ProactivityItem | null | undefined) => {
  if (!item) {
    return [DEFAULT_PROACTIVITY_TIME];
  }
  if (Array.isArray(item.times) && item.times.length > 0) {
    return dedupeTimes(item.times);
  }
  if (item.time) {
    return dedupeTimes([item.time]);
  }
  return [DEFAULT_PROACTIVITY_TIME];
};

const sanitizeCustomChannels = (channels?: (string | CustomChannelValue)[] | null) => {
  if (!Array.isArray(channels)) {
    return [...DEFAULT_CUSTOM_CHANNELS];
  }
  const filtered = channels
    .map((channel) => channel as CustomChannelValue)
    .filter((channel): channel is CustomChannelValue => ALL_CUSTOM_CHANNELS.includes(channel));
  const unique = filtered.filter((channel, index, array) => array.indexOf(channel) === index);
  return unique.length > 0 ? unique : [...DEFAULT_CUSTOM_CHANNELS];
};

type GrayDashboardViewProps = {
  pulseEntries: PulseEntry[];
  currentPulse: PulseEntry | null;
  isCurrentPulseEditable: boolean;
  onSelectPulse: (id: string) => void;
  proactivityFallback: ProactivityItem | null;
  onProactivitySelect?: (next: ProactivityItem) => void;
  onProactivityRemove?: () => void;
  onTogglePlan: (id: string) => void;
  onToggleHabit?: (id: string) => void;
  onEditPlan?: (plan: { id: string; label: string; completed: boolean }) => void;
  onDeletePlan?: (plan: { id: string; label: string; completed: boolean }) => void;
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
};

export function GrayDashboardView({
  pulseEntries,
  currentPulse,
  isCurrentPulseEditable,
  onSelectPulse,
  proactivityFallback,
  onProactivitySelect,
  onProactivityRemove,
  onTogglePlan,
  onEditPlan,
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
}: GrayDashboardViewProps) {
  const hasPulseData = Boolean(currentPulse && pulseEntries.length > 0);
  const displayPlans = hasPulseData ? currentPulse?.plans ?? [] : [];
  const displayHabits = hasPulseData ? currentPulse?.habits ?? [] : [];
  const displayProactivity = hasPulseData
    ? currentPulse?.proactivity ?? proactivityFallback
    : proactivityFallback;
  const [pulseSelectedDate, setPulseSelectedDate] = useState<Date>(() => new Date(currentDate));
  const [pulseMonthDate, setPulseMonthDate] = useState<Date>(() => new Date(currentDate));
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: "plan" | "habit" | null }>({
    isOpen: false,
    type: null,
  });
  const [isProactivityModalOpen, setIsProactivityModalOpen] = useState(false);
  const [isProactivityChannelDropdownOpen, setIsProactivityChannelDropdownOpen] = useState(false);
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
  const activeProactivityCadence =
    displayProactivity?.cadence ?? proactivityFallback?.cadence ?? null;
  const proactivityButtonLabel = displayProactivity ? "Configure" : "Setup";
  const proactivityTimes = activeProactivityTimes;
  const timezoneLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  const proactivityChannels = useMemo(
    () =>
      sanitizeCustomChannels(
        displayProactivity?.channels ?? proactivityFallback?.channels ?? null
      ),
    [displayProactivity?.channels, proactivityFallback?.channels]
  );
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomSettingsState>(() => ({
    times: activeProactivityTimes.length > 0 ? activeProactivityTimes : [...DEFAULT_CUSTOM_SETTINGS.times],
    channels: sanitizeCustomChannels(
      displayProactivity?.channels ?? proactivityFallback?.channels ?? null
    ),
  }));
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
      return activeProactivityId;
    }
    return "";
  });
  const customTimes = customSettings.times;
  const customChannels = customSettings.channels;
  const customTimeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const proactivityChannelDropdownRef = useRef<HTMLDivElement>(null);
  const customChannelSummary = useMemo(() => {
    return customChannels
      .map(
        (channel) =>
          CUSTOM_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel
      )
      .join(" · ");
  }, [customChannels]);
  const formattedProactivityTimes = useMemo(
    () => proactivityTimes.map((time) => formatCustomTimeLabel(time)),
    [proactivityTimes]
  );
  const proactivitySummaryTokens = useMemo(() => {
    const tokens: string[] = [];
    if (displayProactivity?.cadence) {
      tokens.push(displayProactivity.cadence);
    }
    if (proactivityChannels.length > 0) {
      tokens.push(
        proactivityChannels
          .map(
            (channel) =>
              CUSTOM_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel
          )
          .join(" / ")
      );
    }
    if (formattedProactivityTimes.length > 0) {
      tokens.push(formattedProactivityTimes.join(" • "));
    }
    return tokens;
  }, [displayProactivity?.cadence, formattedProactivityTimes, proactivityChannels]);
  const canApplyCustom = customChannels.length > 0 && customTimes.length > 0;
  const canOpenProactivityModal = Boolean(isCurrentPulseEditable && onProactivitySelect);
  const showModalRemoveButton = Boolean(
    onProactivityRemove && (displayProactivity ?? proactivityFallback)
  );
  const modalRemoveLabel = displayProactivity ? "Remove proactivity" : "Skip for now";
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

  useEffect(() => {
    setPulseSelectedDate(new Date(currentDate));
    setPulseMonthDate(new Date(currentDate));
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
      channels: sanitizeCustomChannels(
        (displayProactivity?.channels ??
          proactivityFallback?.channels ??
          prev.channels) as (string | CustomChannelValue)[] | null
      ),
    }));
    setIsCustomExpanded(activeProactivityId === "proactivity-custom");
    if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
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

    const handleClickOutside = (event: MouseEvent) => {
      if (
        isProactivityChannelDropdownOpen &&
        proactivityChannelDropdownRef.current &&
        !proactivityChannelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProactivityChannelDropdownOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    activeProactivityId,
    activeProactivityTimes,
    displayProactivity?.channels,
    isProactivityModalOpen,
    proactivityFallback?.channels,
  ]);

  useEffect(() => {
    customTimeInputRefs.current.length = customTimes.length;
  }, [customTimes.length]);

  const handleCustomReset = useCallback(() => {
    setCustomSettings({
      times:
        activeProactivityTimes.length > 0
          ? activeProactivityTimes
          : [...DEFAULT_CUSTOM_SETTINGS.times],
      channels: sanitizeCustomChannels(
        (displayProactivity?.channels ?? proactivityFallback?.channels ?? DEFAULT_CUSTOM_CHANNELS) as
          | (string | CustomChannelValue)[]
          | null
      ),
    });
    setIsCustomExpanded(true);
  }, [
    activeProactivityTimes,
    displayProactivity?.channels,
    proactivityFallback?.channels,
  ]);

  const handleCustomApply = useCallback(() => {
    if (!onProactivitySelect) {
      return;
    }
    const sortedTimes = dedupeTimes(customTimes);
    const firstTime = sortedTimes[0] ?? DEFAULT_PROACTIVITY_TIME;
    const formattedTimes = sortedTimes.map((time) => formatCustomTimeLabel(time)).join(", ");
    const channelSummary = customChannelSummary || "selected channels";
    const descriptionParts = [`${sortedTimes.length} touchpoints`, formattedTimes, `via ${channelSummary}`];
    onProactivitySelect({
      id: "proactivity-custom",
      label: "Custom plan",
      description: descriptionParts.join(" • "),
      cadence: "Custom",
      time: firstTime,
      times: sortedTimes,
      channels: customChannels,
    });
    setIsProactivityModalOpen(false);
  }, [
    customChannels,
    customTimes,
    customChannelSummary,
    onProactivitySelect,
  ]);

  const handleCustomTimeChange = useCallback((index: number, value: string) => {
    setCustomSettings((prev) => {
      const nextTimes = [...prev.times];
      nextTimes[index] = normalizeTimeForInput(value);
      return {
        ...prev,
        times: dedupeTimes(nextTimes),
      };
    });
  }, []);
  const handleCustomTimeEdit = useCallback((index: number) => {
    const input = customTimeInputRefs.current[index];
    if (!input) {
      return;
    }
    const enhancedInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };
    if (typeof enhancedInput.showPicker === "function") {
      enhancedInput.showPicker();
      return;
    }
    input.focus();
  }, []);

  const handleCustomTimeAdd = useCallback(() => {
    setCustomSettings((prev) => ({
      ...prev,
      times: [...prev.times, DEFAULT_PROACTIVITY_TIME],
    }));
  }, []);

  const handleCustomTimeRemove = useCallback((index: number) => {
    setCustomSettings((prev) => {
      if (prev.times.length <= 1) {
        return prev;
      }
      customTimeInputRefs.current.splice(index, 1);
      const nextTimes = prev.times.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...prev,
        times: nextTimes.length > 0 ? nextTimes : [...DEFAULT_CUSTOM_SETTINGS.times],
      };
    });
  }, []);

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

  const handlePulseGoToday = useCallback(() => {
    const today = new Date(currentDate);
    setPulseSelectedDate(today);
    setPulseMonthDate(today);
    const key = toDateKey(today);
    const matchingEntry = pulseEntriesByDate.get(key);
    if (matchingEntry) {
      onSelectPulse(matchingEntry.id);
    }
  }, [currentDate, onSelectPulse, pulseEntriesByDate]);

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
    if (!isCurrentPulseEditable || !onProactivitySelect) {
      return;
    }
    setIsProactivityModalOpen(true);
  }, [isCurrentPulseEditable, onProactivitySelect]);

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
        channels: proactivityChannels,
      });
    },
    [activeProactivityTime, onProactivitySelect, proactivityChannels]
  );

  const handleCloseProactivityModal = useCallback(() => {
    setIsProactivityModalOpen(false);
    setIsProactivityChannelDropdownOpen(false);
  }, []);

  const handlePresetSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextPresetId = event.target.value;
      setSelectedPresetId(nextPresetId);
      if (!nextPresetId) {
        return;
      }
      const preset = PROACTIVITY_PRESETS.find((option) => option.id === nextPresetId);
      if (preset) {
        handleProactivityPresetSelect(preset);
      }
    },
    [handleProactivityPresetSelect]
  );

  const handleActiveChannelToggle = useCallback(
    (channel: CustomChannelValue) => {
      if (!displayProactivity || !onProactivitySelect || !isCurrentPulseEditable) {
        return;
      }
      const hasChannel = proactivityChannels.includes(channel);
      if (hasChannel && proactivityChannels.length === 1) {
        return;
      }
      const nextChannels = hasChannel
        ? proactivityChannels.filter((value) => value !== channel)
        : [...proactivityChannels, channel];
      onProactivitySelect({
        ...displayProactivity,
        channels: nextChannels,
      });
    },
    [displayProactivity, isCurrentPulseEditable, onProactivitySelect, proactivityChannels]
  );

  const handleModalProactivityRemove = useCallback(() => {
    if (!onProactivityRemove || !isCurrentPulseEditable) {
      return;
    }
    onProactivityRemove();
    setIsProactivityModalOpen(false);
  }, [isCurrentPulseEditable, onProactivityRemove]);

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

  const handlePlanEdit = useCallback(
    (plan: PlanItem) => {
      if (!isCurrentPulseEditable || !onEditPlan) {
        return;
      }
      onEditPlan(plan);
    },
    [isCurrentPulseEditable, onEditPlan]
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

  const showPlansList = displayPlans.length > 0;
  const showHabitsList = displayHabits.length > 0;

  const headerClassName = styles.pulseSurfaceHeader;
  const canManagePlans = isCurrentPulseEditable && Boolean(onEditPlan || onDeletePlan);
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
              Proactivity
            </span>
          </div>
          <button
            type="button"
            className={styles.proactivityModalClose}
            onClick={handleCloseProactivityModal}
            aria-label="Close proactivity options"
          >
            <X size={16} />
          </button>
        </header>
        <div className={styles.proactivityModalMeta}>
          <span>
            <span className={styles.proactivityModalMetaLabel}>Current</span>
            <span className={styles.proactivityModalMetaValue}>
              {activeProactivityCadence ?? "Not set"}
            </span>
          </span>
          <span>
            <span className={styles.proactivityModalMetaLabel}>Timezone</span>
            <span className={styles.proactivityModalMetaValue}>{timezoneLabel}</span>
          </span>
        </div>
        <div className={styles.proactivityChannelsLabel}>
          <label className={styles.proactivityChannelDropdownLabel}>
            Notification channels
          </label>
          <div className={styles.proactivityChannelDropdown} ref={proactivityChannelDropdownRef}>
            <button
              type="button"
              className={styles.proactivityChannelDropdownButton}
              onClick={() => setIsProactivityChannelDropdownOpen(!isProactivityChannelDropdownOpen)}
              disabled={!isCurrentPulseEditable || !onProactivitySelect}
            >
              <span className={styles.proactivityChannelDropdownSummary}>
                {proactivityChannels.length > 0
                  ? proactivityChannels
                      .map(
                        (channel) =>
                          CUSTOM_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel
                      )
                      .join(", ")
                  : "Select channels"}
              </span>
              <ChevronDown
                size={14}
                className={`${styles.proactivityChannelDropdownIcon} ${
                  isProactivityChannelDropdownOpen ? styles.proactivityChannelDropdownIconOpen : ""
                }`}
                aria-hidden="true"
              />
            </button>
            {isProactivityChannelDropdownOpen && (
              <div className={styles.proactivityChannelDropdownMenu}>
                {CUSTOM_CHANNEL_OPTIONS.map((option) => {
                  const isActive = proactivityChannels.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={styles.proactivityChannelDropdownItem}
                    >
                      <input
                        type="checkbox"
                        className={styles.proactivityChannelDropdownCheckbox}
                        checked={isActive}
                        onChange={() => handleActiveChannelToggle(option.value)}
                      />
                      <span className={styles.proactivityChannelDropdownItemContent}>
                        <span className={styles.proactivityChannelDropdownItemLabel}>{option.label}</span>
                        <span className={styles.proactivityChannelDropdownItemHelper}>{option.helper}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className={styles.proactivityModalActions}>
          <section className={styles.proactivityPresetMenu} aria-labelledby="proactivityPresetLabel">
            <label
              id="proactivityPresetLabel"
              htmlFor="proactivityPresetSelect"
              className={styles.proactivityPresetLabel}
            >
              Preset cadence
            </label>
            <div className={styles.proactivityPresetSelectWrapper}>
              <select
                id="proactivityPresetSelect"
                className={styles.proactivityPresetSelect}
                value={selectedPresetId}
                onChange={handlePresetSelectChange}
              >
                <option value="">Select a preset</option>
                {PROACTIVITY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className={styles.proactivityPresetSelectIcon} aria-hidden="true" />
            </div>
            {selectedPreset ? (
              <div className={styles.proactivityPresetDetails}>
                <div className={styles.proactivityPresetHeader}>
                  <span className={styles.proactivityPresetTitle}>{selectedPreset.title}</span>
                  <span className={styles.proactivityPresetBadge}>{selectedPreset.cadence}</span>
                </div>
                <span className={styles.proactivityPresetSummary}>{selectedPreset.summary}</span>
              </div>
            ) : (
              <p className={styles.proactivityPresetPlaceholder}>Select a preset to preview it.</p>
            )}
          </section>
          <button
            type="button"
            className={styles.proactivityCustomTrigger}
            data-active={isCustomExpanded ? "true" : "false"}
            onClick={() => setIsCustomExpanded((value) => !value)}
          >
            <span className={styles.proactivityPresetHeader}>
              <span className={styles.proactivityPresetTitle}>Custom cadence</span>
              <span className={styles.proactivityPresetBadge}>
                {isCustomExpanded ? "Open" : "Configure"}
              </span>
            </span>
            <span className={styles.proactivityPresetSummary}>
              {customTimes.length} touchpoint{customTimes.length === 1 ? "" : "s"} •{" "}
              {customTimes.map((time) => formatCustomTimeLabel(time)).join(", ")}
            </span>
            <span className={styles.proactivityPresetMeta}>
              {customChannelSummary || "Select channels"}
            </span>
          </button>
        </div>
        {isCustomExpanded ? (
          <section className={styles.proactivityCustomSection}>
            <header className={styles.proactivityCustomHeader}>
              <div>
                <span className={styles.proactivityCustomEyebrow}>Custom setup</span>
                <h4 className={styles.proactivityCustomTitle}>Build your own cadence</h4>
              </div>
              <button
                type="button"
                className={styles.proactivityCustomReset}
                onClick={handleCustomReset}
              >
                Reset
              </button>
            </header>
            <p className={styles.proactivityCustomCopy}>
              Set the exact moments Gray nudges you and choose where those prompts appear.
            </p>
            <div className={styles.proactivityCustomControls}>
              <div className={styles.proactivityCustomField}>
                <span className={styles.proactivityCustomLabel}>Touchpoints</span>
                <div className={styles.proactivityTimes}>
                  {customTimes.map((time, index) => (
                    <div key={`${time}-${index}`} className={styles.proactivityTimeListItem}>
                      <button
                        type="button"
                        className={styles.proactivityTimeListButton}
                        onClick={() => handleCustomTimeEdit(index)}
                      >
                        <span className={styles.proactivityTimeLabel}>{formatCustomTimeLabel(time)}</span>
                      </button>
                      <div className={styles.proactivityTimeActions}>
                        <button
                          type="button"
                          className={styles.listItemActionButton}
                          onClick={() => handleCustomTimeEdit(index)}
                          aria-label={`Edit custom start time ${time}`}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className={styles.listItemActionButton}
                          onClick={() => handleCustomTimeRemove(index)}
                          aria-label={`Remove custom start time ${time}`}
                          disabled={customTimes.length <= 1}
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <input
                        type="time"
                        value={time}
                        ref={(element) => {
                          customTimeInputRefs.current[index] = element;
                        }}
                        onChange={(event) => handleCustomTimeChange(index, event.target.value)}
                        className={styles.proactivityTimeHiddenInput}
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.proactivityTimeAdd}
                    onClick={handleCustomTimeAdd}
                  >
                    <Plus size={14} />
                    <span>Add time</span>
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.proactivityCustomActions}>
              <button
                type="button"
                className={styles.proactivityCustomApply}
                onClick={handleCustomApply}
                disabled={!canApplyCustom}
              >
                Apply custom settings
              </button>
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
            Done
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
        <span>Proactivity</span>
      </header>
      <div className={styles.dashboardCardBody}>
        {displayProactivity ? (
          <div className={styles.proactivitySummaryInline}>
            {proactivitySummaryTokens.length > 0
              ? proactivitySummaryTokens.map((token, index) => (
                  <span key={`${token}-${index}`}>{token}</span>
                ))
              : <span>—</span>}
          </div>
        ) : (
          <div className={styles.cardEmptyMessage}>
            <span>Not configured</span>
          </div>
        )}
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!canOpenProactivityModal}
          data-disabled={!canOpenProactivityModal ? "true" : "false"}
          onClick={handleOpenProactivityModal}
        >
          {proactivityButtonLabel}
        </button>
      </div>
    </article>
  );

  const sidebarProactivityCard = renderProactivityCard(styles.sidebarProactivityCard);
  const proactivityCard = renderProactivityCard();

  const plansCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <span>Plans</span>
      </header>
      <div className={styles.dashboardCardBody}>
        <ul className={styles.planList}>
          {showPlansList
            ? displayPlans.map((plan) => (
                <li key={plan.id} className={styles.planListItem}>
                  <button
                    type="button"
                    className={styles.planItemButton}
                    data-completed={plan.completed ? "true" : "false"}
                    onClick={() => handlePlanToggle(plan.id)}
                    disabled={!isCurrentPulseEditable}
                  >
                    <span className={styles.planCheckbox} aria-hidden="true">
                      {plan.completed ? <Check size={14} /> : <Square size={14} />}
                    </span>
                    <span className={styles.planLabelGroup}>
                      <span className={styles.planLabel}>{plan.label}</span>
                      {plan.details ? (
                        <span className={styles.planDetails}>{plan.details}</span>
                      ) : null}
                      {(plan.scheduleSlot || plan.deadline) && (
                        <span className={styles.planMeta}>{formatPlanMeta(plan)}</span>
                      )}
                    </span>
                  </button>
                  {canManagePlans ? (
                    <span className={styles.listItemActions}>
                      {onEditPlan ? (
                        <button
                          type="button"
                          className={styles.listItemActionButton}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handlePlanEdit(plan);
                          }}
                          aria-label={`Edit plan ${plan.label}`}
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
                          aria-label={`Delete plan ${plan.label}`}
                          disabled={!isCurrentPulseEditable}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))
            : (
              <li className={styles.listEmptyMessage}>
                <span>No plans captured yet.</span>
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
          Add plans
        </button>
      </div>
    </article>
  );

  const habitsCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <span>Habits</span>
      </header>
      <div className={styles.dashboardCardBody}>
        <ul className={`${styles.habitList} ${styles.dashboardHabitList}`}>
          {showHabitsList
            ? displayHabits.map((habit) => (
                <li key={habit.id} className={styles.habitListItem}>
                  <button
                    type="button"
                    className={styles.planItemButton}
                    data-completed={habit.completed ? "true" : "false"}
                    onClick={() => handleHabitToggle(habit.id)}
                    disabled={!isCurrentPulseEditable || !onToggleHabit}
                  >
                    <span className={styles.planCheckbox} aria-hidden="true">
                      {habit.completed ? <Check size={14} /> : <Square size={14} />}
                    </span>
                    <span className={styles.habitContent}>
                      <span className={styles.habitLabel}>{habit.label}</span>
                      {habit.details ? (
                        <span className={styles.habitDetails}>{habit.details}</span>
                      ) : null}
                    </span>
                  </button>
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
                            aria-label={`Edit habit ${habit.label}`}
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
                            aria-label={`Delete habit ${habit.label}`}
                            disabled={!isCurrentPulseEditable}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                    <span className={styles.habitStreak}>
                      <Flame size={12} aria-hidden="true" />
                      <span>{habit.streakLabel}</span>
                    </span>
                  </span>
                </li>
              ))
            : (
              <li className={styles.listEmptyMessage}>
                <span>No habits tracked yet.</span>
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
          Add habits
        </button>
      </div>
    </article>
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
        onPrevRange={() => handlePulseShiftDay(-1)}
        onNextRange={() => handlePulseShiftDay(1)}
        onGoToday={handlePulseGoToday}
        todayButtonLabel={pulseTodayButtonLabel}
        className={headerClassName}
      />
      <div className={calendarStyles.calendarSurfaceBody} data-has-sidebar="true">
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
          >
            <div className={styles.calendarSidebarExtras}>{sidebarProactivityCard}</div>
          </CalendarSidebar>
        </div>
        <div className={`${calendarStyles.calendarBoard} ${styles.pulseBoard}`}>
          <div className={calendarStyles.calendarGrid}>
            <div className={styles.pulseBoardContent}>
              <section className={`${styles.dashboardGrid} ${styles.pulseGridStacked}`}>
                {plansCard}
                {habitsCard}
              </section>
            </div>
          </div>
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
        onPrevRange={() => handlePulseShiftDay(-1)}
        onNextRange={() => handlePulseShiftDay(1)}
        onGoToday={handlePulseGoToday}
        todayButtonLabel={pulseTodayButtonLabel}
        className={headerClassName}
      />
      <div className={styles.dashboardCompact}>
        <div className={styles.dashboardCompactMeta}>
          <span className={styles.dashboardCompactRange}>{pulseRangeLabel}</span>
          <span className={styles.dashboardCompactTimezone}>{timezoneLabel}</span>
        </div>
        <div className={styles.dashboardCompactGrid}>
          {plansCard}
          {habitsCard}
          {proactivityCard}
        </div>
      </div>
    </>
  );

  const calendarContent = (
    <GrayDashboardCalendar
      initialDate={currentDate}
      currentDate={currentDate}
      showSidebar={true}
      showSelectedDateLabel={false}
      calendars={calendars}
      events={calendarEvents}
      onCalendarsChange={onCalendarsChange}
      onEventsChange={onCalendarEventsChange}
      selectedDate={calendarSelectedDate}
      onSelectedDateChange={onCalendarSelectedDateChange}
      hourHeight={CALENDAR_PANEL_HOUR_HEIGHT}
      onIntegrationAction={onIntegrationAction}
      dashboardTab={activeTab}
      onSelectDashboardTab={onSelectTab}
      renderHeader={(headerProps) => (
        <DashboardHeader
          {...headerProps}
          onPrevRange={undefined}
          onNextRange={undefined}
          label={undefined}
          title={undefined}
          rangeLabel={undefined}
          className={headerClassName}
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
        className={headerClassName}
      />
      <div className={styles.dashboardCompactNotice}>
        <h3>Calendar works best on a wider screen</h3>
        <p>Expand your window or rotate your device to manage events and view the full schedule.</p>
      </div>
    </>
  );

  const dashboardSurfaceClassName = [
    styles.dashboardCalendarSurface,
    calendarStyles.calendarSurface,
    calendarStyles.calendarSurfaceCompact,
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
            <div className={`${styles.chatBarRow} ${styles.dashboardChatBarRow}`}>
              {chatBar}
            </div>
            <p className={styles.chatDisclaimer}>Gray can make mistakes. Check important info.</p>
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
    </>
  );
}
