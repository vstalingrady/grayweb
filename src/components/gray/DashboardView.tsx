import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckSquare, Square, Flame, X, Plus, ChevronDown, Pencil } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type ProactivityItem, type PulseEntry } from "./types";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { DashboardHeader } from "./DashboardHeader";
import { AddPlanHabitModal } from "./AddPlanHabitModal";

const CALENDAR_PANEL_MAX_HEIGHT = "100%";
const CALENDAR_PANEL_HOUR_HEIGHT = 62;
const DASHBOARD_PANEL_SIZING_STYLE = {
  "--calendar-max-height": CALENDAR_PANEL_MAX_HEIGHT,
} as CSSProperties & { [key: string]: string | number };

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

type CustomChannelValue = "assistant" | "email";

type CustomSettingsState = {
  times: string[];
  channels: CustomChannelValue[];
};

const ALL_CUSTOM_CHANNELS: CustomChannelValue[] = ["assistant", "email"];

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
  onEditHabit?: (habit: { id: string; label: string; previousLabel: string; streakLabel: string }) => void;
  onDeleteHabit?: (habit: { id: string; label: string; previousLabel: string; streakLabel: string }) => void;
  onIntegrationAction?: () => void;
  onRefreshData: () => Promise<void>;
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
  activeTab,
  onSelectTab,
  currentDate,
  calendars,
  onCalendarsChange,
  calendarEvents,
  onCalendarEventsChange,
  onIntegrationAction,
  onRefreshData,
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

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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

  const showPlansList = displayPlans.length > 0;
  const showHabitsList = displayHabits.length > 0;

  const headerClassName = styles.pulseSurfaceHeader;
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
          <div
            className={styles.proactivityChannelSwitches}
            aria-label="Notification channels"
          >
            {CUSTOM_CHANNEL_OPTIONS.map((option) => {
              const isActive = proactivityChannels.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={styles.proactivityChannelSwitch}
                  data-active={isActive ? "true" : "false"}
                  onClick={() => handleActiveChannelToggle(option.value)}
                  disabled={!isCurrentPulseEditable || !onProactivitySelect}
                >
                  <span>{option.label}</span>
                  <span className={styles.proactivityChannelSwitchTrack}>
                    <span className={styles.proactivityChannelSwitchThumb} />
                  </span>
                </button>
              );
            })}
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
        onPrevMonth={() => handlePulseMonthNavigate(-1)}
        onNextMonth={() => handlePulseMonthNavigate(1)}
        onGoToday={handlePulseGoToday}
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
          <div className={styles.calendarSidebarExtras}>
            <article
              className={`${styles.dashboardCard} ${styles.proactivityCard} ${styles.sidebarProactivityCard}`}
            >
              <header className={styles.dashboardCardHeader}>
                <span>Proactivity</span>
              </header>
              <div className={styles.dashboardCardBody}>
                {displayProactivity ? (
                  <>
                    <div className={styles.proactivityHeader}>
                      <div>
                        <div className={styles.proactivityTitle}>
                          <CheckSquare size={16} />
                          <span>{displayProactivity.label}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.proactivitySummaryInline}>
                      {proactivitySummaryTokens.length > 0
                        ? proactivitySummaryTokens.map((token, index) => (
                            <span key={`${token}-${index}`}>{token}</span>
                          ))
                        : <span>—</span>}
                    </div>
                  </>
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
          </div>
        </CalendarSidebar>
        </div>
        <div className={`${calendarStyles.calendarBoard} ${styles.pulseBoard}`}>
          <div className={calendarStyles.calendarGrid}>
            <div className={styles.pulseBoardContent}>
              <section className={`${styles.dashboardGrid} ${styles.pulseGridStacked}`}>
                <article className={styles.dashboardCard}>
                  <header className={styles.dashboardCardHeader}>
                    <span>Plans</span>
                  </header>
                  <div className={styles.dashboardCardBody}>
                    <ul className={styles.planList}>
                      {showPlansList
                        ? displayPlans.map((plan) => (
                            <li key={plan.id}>
                              <button
                                type="button"
                                data-completed={plan.completed}
                                onClick={() => handlePlanToggle(plan.id)}
                                disabled={!isCurrentPulseEditable}
                              >
                                <span>
                                  {plan.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                </span>
                                <span className={styles.planLabelGroup}>
                                  <span className={styles.planLabel}>{plan.label}</span>
                                  {(plan.scheduleSlot || plan.deadline) && (
                                    <span className={styles.habitMeta}>{formatPlanMeta(plan)}</span>
                                  )}
                                </span>
                              </button>
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

                <article className={styles.dashboardCard}>
                  <header className={styles.dashboardCardHeader}>
                    <span>Habits</span>
                  </header>
                  <div className={styles.dashboardCardBody}>
                    <ul className={`${styles.habitList} ${styles.dashboardHabitList}`}>
                      {showHabitsList
                        ? displayHabits.map((habit) => (
                            <li key={habit.id}>
                              <div>
                                <span className={styles.habitLabel}>{habit.label}</span>
                                <span className={styles.habitMeta}>Prev: {habit.previousLabel}</span>
                              </div>
                              <div>
                                <Flame size={12} />
                                <span>{habit.streakLabel}</span>
                              </div>
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
              </section>
            </div>
          </div>
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

  const dashboardSurfaceClassName = [
    styles.dashboardCalendarSurface,
    calendarStyles.calendarSurface,
    calendarStyles.calendarSurfaceCompact,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={styles.dashboardCalendarContainer}>
        <div
          className={styles.dashboardCalendarShell}
          style={DASHBOARD_PANEL_SIZING_STYLE}
        >
          <div className={dashboardSurfaceClassName}>
            {activeTab === "pulse" ? pulseContent : calendarContent}
          </div>
        </div>
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
