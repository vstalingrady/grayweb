"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gem, MessageSquarePlus, LayoutDashboard, History, Search } from "lucide-react";
import { GrayEnhancedSidebar } from "@/components/gray/EnhancedSidebar";
import { GrayDashboardView } from "@/components/gray/DashboardView";
import { GrayGeneralView } from "@/components/gray/GeneralView";
import { GrayHistoryView } from "@/components/gray/HistoryView";
import { GrayChatBar } from "@/components/gray/ChatBar";
import { GrayChatView } from "@/components/gray/ChatView";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";
import { formatDisplayName } from "@/lib/names";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./GrayPageClient.module.css";
import {
  type PlanItem,
  type HabitItem,
  type ProactivityItem,
  type SidebarNavKey,
  type SidebarNavItem,
  type SidebarHistorySection,
  type SidebarHistoryEntry,
  type PulseEntry,
  type ContextUsageSummary,
} from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import {
  ChatProvider,
  useChatStore,
  GENERAL_CHAT_SESSION_ID,
  deriveTitleFromMessage,
  type ChatSession,
} from "@/components/gray/ChatProvider";
import { DEFAULT_HISTORY_SECTIONS } from "@/components/gray/historySeed";
import { GrayWorkspaceHeader } from "@/components/gray/WorkspaceHeader";
import { PersonalizationPanel } from "@/components/gray/PersonalizationPanel";
const PROACTIVITY_SEED: ProactivityItem = {
  id: "proactivity-1",
  label: "Check-ins",
  description: "Daily sync nudges for squad channels.",
  cadence: "Daily",
  time: "09:00",
  times: ["09:00"],
  channels: ["assistant"],
};

const SIDEBAR_EXPANDED_STORAGE_KEY = "gray-sidebar-expanded";

const DEFAULT_EVENT_COLOR = "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))";

const PULSE_STORAGE_KEY_PREFIX = "gray-dashboard-pulses:";
const MAX_PULSE_HISTORY = 30;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeTimeValue = (value: string | null | undefined): string => {
  if (!value) {
    return "09:00";
  }
  const trimmed = value.trim();
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!timeMatch) {
    return trimmed.slice(0, 5);
  }
  let hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "09:00";
  }
  const period = timeMatch[3]?.toUpperCase();
  if (period === "AM") {
    if (hour === 12) {
      hour = 0;
    }
  } else if (period === "PM") {
    if (hour !== 12) {
      hour += 12;
    }
  }
  const normalizedHour = Math.max(0, Math.min(23, hour));
  const normalizedMinute = Math.max(0, Math.min(59, minute));
  return `${String(normalizedHour).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`;
};

const normalizeProactivityTimes = (
  times: string[] | null | undefined,
  fallback: string | null | undefined = null
): string[] => {
  const sourceTimes =
    Array.isArray(times) && times.length > 0
      ? times
      : fallback
        ? [fallback]
        : [];

  const normalized = sourceTimes
    .map((value) => normalizeTimeValue(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  return normalized.length > 0 ? normalized : [normalizeTimeValue(null)];
};

const primaryProactivityTime = (times: string[] | null | undefined, fallback?: string | null) =>
  normalizeProactivityTimes(times ?? null, fallback)[0];

const normalizeProactivityChannels = (channels: string[] | null | undefined): string[] => {
  if (!Array.isArray(channels)) {
    return [];
  }

  const normalized = channels
    .map((channel) => (typeof channel === "string" ? channel.trim() : ""))
    .filter((channel) => channel.length > 0);

  return normalized.filter((channel, index, array) => array.indexOf(channel) === index);
};

const isGenericSessionTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const trimmed = title.trim();
  return trimmed.length === 0 || trimmed.toLowerCase() === "new chat";
};

const getReadableSessionTitle = (session: ChatSession): string => {
  if (!isGenericSessionTitle(session.title)) {
    return session.title.trim();
  }
  const firstMeaningfulUserMessage = session.messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0
  );
  if (firstMeaningfulUserMessage) {
    return deriveTitleFromMessage(firstMeaningfulUserMessage.content);
  }
  return "New Chat";
};

const clonePlans = (plans: PlanItem[]): PlanItem[] =>
  plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    completed: plan.completed,
    deadline: plan.deadline ?? null,
    scheduleSlot: plan.scheduleSlot ?? null,
  }));

const cloneHabits = (habits: HabitItem[]): HabitItem[] =>
  habits.map((habit) => ({
    id: habit.id,
    label: habit.label,
    streakLabel: habit.streakLabel,
    previousLabel: habit.previousLabel,
    completed: Boolean(habit.completed),
  }));

const cloneProactivity = (item: ProactivityItem | null | undefined): ProactivityItem | null =>
  item
    ? {
        id: item.id,
        label: item.label,
        description: item.description,
        cadence: item.cadence,
        times: normalizeProactivityTimes(item.times ?? null, item.time),
        time: primaryProactivityTime(item.times ?? null, item.time),
        channels: normalizeProactivityChannels(item.channels ?? null),
      }
    : null;

const createPulseSnapshot = (
  referenceDate: Date,
  plans: PlanItem[],
  habits: HabitItem[],
  proactivity: ProactivityItem | null,
  stableId?: string
): PulseEntry => ({
  id: stableId ?? `pulse-${toDateKey(referenceDate)}`,
  dateKey: toDateKey(referenceDate),
  timestamp: referenceDate.getTime(),
  plans: clonePlans(plans),
  habits: cloneHabits(habits),
  proactivity: cloneProactivity(proactivity),
});

const arePlanListsEqual = (a: PlanItem[], b: PlanItem[]) =>
  a.length === b.length &&
  a.every((plan, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      plan.id === other.id &&
      plan.label === other.label &&
      plan.completed === other.completed &&
      (plan.deadline ?? null) === (other.deadline ?? null) &&
      (plan.scheduleSlot ?? null) === (other.scheduleSlot ?? null)
    );
  });

const areHabitListsEqual = (a: HabitItem[], b: HabitItem[]) =>
  a.length === b.length &&
  a.every((habit, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      habit.id === other.id &&
      habit.label === other.label &&
      habit.streakLabel === other.streakLabel &&
      habit.previousLabel === other.previousLabel &&
      Boolean(habit.completed) === Boolean(other.completed)
    );
  });

const areProactivityItemsEqual = (a: ProactivityItem | null, b: ProactivityItem | null) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.description === b.description &&
    a.cadence === b.cadence &&
    primaryProactivityTime(a.times ?? null, a.time) === primaryProactivityTime(b.times ?? null, b.time) &&
    normalizeProactivityTimes(a.times ?? null, a.time).join("|") ===
      normalizeProactivityTimes(b.times ?? null, b.time).join("|") &&
    normalizeProactivityChannels(a.channels ?? null).join("|") ===
      normalizeProactivityChannels(b.channels ?? null).join("|")
  );
};

const sanitizePulseEntry = (raw: Partial<PulseEntry> | null | undefined): PulseEntry | null => {
  if (!raw) {
    return null;
  }

  const timestamp =
    typeof raw.timestamp === "number"
      ? raw.timestamp
      : typeof raw.timestamp === "string"
        ? Number.parseInt(raw.timestamp, 10)
        : Number.NaN;

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const referenceDate = new Date(timestamp);
  const dateKey =
    typeof raw.dateKey === "string" && raw.dateKey
      ? raw.dateKey
      : toDateKey(referenceDate);
  const id =
    typeof raw.id === "string" && raw.id
      ? raw.id
      : `pulse-${dateKey}`;

  const plans = Array.isArray(raw.plans)
    ? raw.plans
        .map((plan) => ({
          id: String(plan?.id ?? ""),
          label: typeof plan?.label === "string" ? plan.label : "",
          completed: Boolean(plan?.completed),
        }))
        .filter((plan) => plan.id.length > 0)
    : [];

  const habits = Array.isArray(raw.habits)
    ? raw.habits
        .map((habit) => ({
          id: String(habit?.id ?? ""),
          label: typeof habit?.label === "string" ? habit.label : "",
          streakLabel: typeof habit?.streakLabel === "string" ? habit.streakLabel : "",
          previousLabel: typeof habit?.previousLabel === "string" ? habit.previousLabel : "",
          completed: Boolean((habit as HabitItem | { completed?: boolean })?.completed),
        }))
        .filter((habit) => habit.id.length > 0)
    : [];

  const rawProactivity = raw.proactivity;
  let proactivity: ProactivityItem | null;
  if (rawProactivity === undefined) {
    proactivity = cloneProactivity(PROACTIVITY_SEED);
  } else if (rawProactivity === null) {
    proactivity = null;
  } else {
    proactivity = {
      id: String(rawProactivity.id ?? PROACTIVITY_SEED.id),
      label: typeof rawProactivity.label === "string" ? rawProactivity.label : PROACTIVITY_SEED.label,
      description:
        typeof rawProactivity.description === "string"
          ? rawProactivity.description
          : PROACTIVITY_SEED.description,
      cadence:
        typeof rawProactivity.cadence === "string"
          ? rawProactivity.cadence
          : PROACTIVITY_SEED.cadence,
      times: normalizeProactivityTimes(
        Array.isArray(rawProactivity.times) ? rawProactivity.times : null,
        typeof rawProactivity.time === "string" ? rawProactivity.time : PROACTIVITY_SEED.time
      ),
      time: primaryProactivityTime(
        Array.isArray(rawProactivity.times) ? rawProactivity.times : null,
        typeof rawProactivity.time === "string" ? rawProactivity.time : PROACTIVITY_SEED.time
      ),
      channels: normalizeProactivityChannels(
        Array.isArray(rawProactivity.channels) ? rawProactivity.channels : null
      ),
    };
  }

  return {
    id,
    dateKey,
    timestamp,
    plans,
    habits,
    proactivity,
  };
};

const sanitizePulseEntries = (raw: unknown): PulseEntry[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => sanitizePulseEntry(entry))
    .filter((entry): entry is PulseEntry => entry !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
};

const arePulseEntriesEqual = (a: PulseEntry[], b: PulseEntry[]) =>
  a.length === b.length &&
  a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.id === other.id &&
      entry.dateKey === other.dateKey &&
      entry.timestamp === other.timestamp &&
      arePlanListsEqual(entry.plans, other.plans) &&
      areHabitListsEqual(entry.habits, other.habits) &&
      areProactivityItemsEqual(entry.proactivity, other.proactivity)
    );
  });

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: "general", label: "General", icon: Gem },
  { id: "threads", label: "Threads", icon: MessageSquarePlus },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "history", label: "History", icon: History },
];

const SIDEBAR_RAIL_ITEMS: SidebarNavItem[] = [
  { id: "search", label: "Search", icon: Search },
  ...SIDEBAR_ITEMS,
];

const NAVIGATION_ROUTES: Partial<Record<SidebarNavKey, string>> = {
  general: "/g",
  threads: "/",
  dashboard: "/dashboard",
};

const deriveInitials = (fullName: string | null | undefined) => {
  if (!fullName) {
    return "";
  }

  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  if (parts.length === 1) {
    const [first] = parts;
    return first.slice(0, Math.min(first.length, 2)).toUpperCase();
  }

  const firstInitial = parts[0][0] ?? "";
  const lastInitial = parts[parts.length - 1][0] ?? "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const greetingForDate = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) {
    return "morning";
  }
  if (hour < 18) {
    return "afternoon";
  }
  return "evening";
};

type GrayPageClientProps = {
  initialTimestamp: number;
  viewerEmail: string | null;
  activeNav?: SidebarNavKey;
  variant?: "general" | "dashboard" | "chat";
  activeChatId?: string | null;
};

type ViewMode = "general" | "dashboard" | "history" | "chat";

function GrayPageClientInner({
  initialTimestamp,
  activeNav,
  variant = "general",
  activeChatId = null,
}: Omit<GrayPageClientProps, 'viewerEmail'>) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [proactivity, setProactivity] = useState<ProactivityItem | null>(() =>
    cloneProactivity(PROACTIVITY_SEED)
  );
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [chatDraft, setChatDraft] = useState("");
  const [hasSeenGeneralChat, setHasSeenGeneralChat] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [hasLoadedSidebarPref, setHasLoadedSidebarPref] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">("pulse");
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [contextUsageSummary, setContextUsageSummary] = useState<ContextUsageSummary | null>(null);
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>([]);
  const [activePulseId, setActivePulseId] = useState<string | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [calendarCalendars, setCalendarCalendars] = useState<CalendarInfo[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => new Date(initialTimestamp));
  const {
    sessions,
    renameSession,
    deleteSession,
    setWorkspaceContext,
    sendGeneralMessage,
    createThreadSession,
    generalSessionId,
    updateSession,
    getSession,
    ensureSession,
  } = useChatStore();
  const supportsInlineChat = variant !== "chat";
  const shouldShowDashboardChatBar = variant !== "dashboard";
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => activeChatId ?? null);
  const [pendingRedirectChatId, setPendingRedirectChatId] = useState<string | null>(null);
  const userId = typeof user?.id === "number" ? user.id : null;
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const ensureSessionRef = useRef(ensureSession);

  useEffect(() => {
    ensureSessionRef.current = ensureSession;
  }, [ensureSession]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setIsSidebarExpanded(stored === "true");
      }
    } catch (error) {
      console.warn("Failed to load sidebar state:", error);
    } finally {
      setHasLoadedSidebarPref(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPref || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        SIDEBAR_EXPANDED_STORAGE_KEY,
        isSidebarExpanded ? "true" : "false"
      );
    } catch (error) {
      console.warn("Failed to persist sidebar state:", error);
    }
  }, [hasLoadedSidebarPref, isSidebarExpanded]);

  const baseViewMode: ViewMode =
    variant === "chat"
      ? "chat"
      : variant === "dashboard"
        ? "dashboard"
        : "general";

  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(() => {
    if (supportsInlineChat && (activeChatId ?? null)) {
      return "chat";
    }
    return activeNav === "history" && baseViewMode !== "chat" ? "history" : null;
  });

  const effectiveManualViewMode =
    activeNav === "general" || activeNav === "dashboard" || activeNav === "threads"
      ? null
      : manualViewMode;

  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : effectiveManualViewMode ?? (activeNav === "history" ? "history" : baseViewMode);

  useEffect(() => {
    if (baseViewMode === "chat") {
      return;
    }
    if (activeNav === "general" && manualViewMode !== null) {
      setManualViewMode(null);
    }
  }, [activeNav, baseViewMode, manualViewMode]);

  useEffect(() => {
    if (user) {
      return;
    }
    setPlans([]);
    setHabits([]);
    setProactivity(cloneProactivity(PROACTIVITY_SEED));
    setPulseEntries([]);
    setActivePulseId(null);
    setCalendarCalendars([]);
    setCalendarEvents([]);
    setStreakCount(0);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const evaluateViewport = () => {
      const width = window.innerWidth || 0;
      const height = window.innerHeight || 0;
      const aspectRatio = height > 0 ? height / Math.max(width, 1) : 0;
      const shouldUseCompactLayout = width <= 1024 || aspectRatio >= 1.1;
      setIsCompactLayout((previous) =>
        previous === shouldUseCompactLayout ? previous : shouldUseCompactLayout
      );
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    window.addEventListener("orientationchange", evaluateViewport);
    return () => {
      window.removeEventListener("resize", evaluateViewport);
      window.removeEventListener("orientationchange", evaluateViewport);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const storageKey = `${PULSE_STORAGE_KEY_PREFIX}${user.id}`;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setPulseEntries([]);
        setActivePulseId(null);
        setProactivity(cloneProactivity(PROACTIVITY_SEED));
        return;
      }
      const parsed = JSON.parse(stored) as unknown;
      const sanitized = sanitizePulseEntries(parsed).slice(0, MAX_PULSE_HISTORY);
      setPulseEntries((previous) => {
        if (arePulseEntriesEqual(previous, sanitized)) {
          return previous;
        }
        return sanitized;
      });
      setActivePulseId((previous) => {
        if (previous && sanitized.some((entry) => entry.id === previous)) {
          return previous;
        }
        return sanitized[0]?.id ?? null;
      });
      const nextProactivity = sanitized[0]?.proactivity ?? cloneProactivity(PROACTIVITY_SEED);
      setProactivity((previous) => {
        if (areProactivityItemsEqual(previous, nextProactivity ?? null)) {
          return previous;
        }
        return cloneProactivity(nextProactivity) ?? null;
      });
    } catch (error) {
      console.error("Failed to load pulse history:", error);
      setPulseEntries([]);
      setActivePulseId(null);
      setProactivity(cloneProactivity(PROACTIVITY_SEED));
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const storageKey = `${PULSE_STORAGE_KEY_PREFIX}${user.id}`;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pulseEntries));
    } catch (error) {
      console.error("Failed to persist pulse history:", error);
    }
  }, [pulseEntries, user?.id]);

  useEffect(() => {
    if (loading || userId === null) {
      return;
    }

    let isMounted = true;

    const loadWorkspaceData = async () => {
      try {
        const [
          calendarResponse,
          eventResponse,
          planResponse,
          habitResponse,
          streakResponse,
        ] = await Promise.all([
          apiService.getUserCalendars(userId),
          apiService.getUserCalendarEvents(userId),
          apiService.getUserPlans(userId),
          apiService.getUserHabits(userId),
          apiService
            .getUserStreak(userId)
            .catch((error) => {
              console.error("Failed to load user streak:", error);
              return null;
            }),
        ]);

        if (!isMounted) {
          return;
        }

        const mappedCalendars: CalendarInfo[] = Array.isArray(calendarResponse)
          ? calendarResponse.map((calendar) => ({
              id: calendar.id.toString(),
              label: calendar.label,
              color: calendar.color,
              isVisible: Boolean(calendar.is_visible),
            }))
          : [];

        const calendarColorMap = new Map<string, string>(
          mappedCalendars.map((calendar) => [calendar.id, calendar.color])
        );

        const fallbackCalendarId = mappedCalendars[0]?.id ?? "default";
        const fallbackEventColor =
          calendarColorMap.get(fallbackCalendarId) ?? DEFAULT_EVENT_COLOR;

        const mappedEvents: CalendarEvent[] = Array.isArray(eventResponse)
          ? eventResponse.map((event) => {
              const associatedCalendarId = event.calendar_id
                ? event.calendar_id.toString()
                : fallbackCalendarId;
              return {
                id: event.id.toString(),
                calendarId: associatedCalendarId,
                title: event.title,
                start: new Date(event.start_time),
                end: new Date(event.end_time),
                color: calendarColorMap.get(associatedCalendarId) ?? fallbackEventColor,
                entryType: "event",
                description: event.description ?? undefined,
              };
            })
          : [];

        const mappedPlans: PlanItem[] = Array.isArray(planResponse)
          ? planResponse.map((plan) => ({
              id: plan.id.toString(),
              label: plan.label,
              completed: Boolean(plan.completed),
              deadline: plan.deadline ?? null,
              scheduleSlot: plan.schedule_slot ?? null,
            }))
          : [];

        const mappedHabits: HabitItem[] = Array.isArray(habitResponse)
          ? habitResponse.map((habit) => ({
              id: habit.id.toString(),
              label: habit.label,
              streakLabel: habit.streak_label,
              previousLabel: habit.previous_label,
              completed: false,
            }))
          : [];

        setCalendarCalendars(mappedCalendars);
        setCalendarEvents(mappedEvents);
        setPlans(mappedPlans);
        setHabits(mappedHabits);
        setStreakCount(streakResponse?.current_streak ?? 0);
      } catch (error) {
        console.error("Failed to load workspace data:", error);
      }
    };

    void loadWorkspaceData();

    return () => {
      isMounted = false;
    };
    // apiService is a module singleton with stable identity; dependencies limited to auth state.
  }, [loading, userId]);

  const viewerName = useMemo(() => {
    if (loading) {
      return "Loading...";
    }
    return formatDisplayName(user?.full_name, user?.email);
  }, [loading, user?.email, user?.full_name]);

  const viewerAvatarUrl =
    user?.profile_picture_url && user.profile_picture_url.trim().length > 0
      ? user.profile_picture_url
      : "/astronauttest.jpg";

  const viewerInitials = useMemo(() => {
    if (loading) {
      return "--";
    }
    if (user?.initials) {
      return user.initials;
    }
    return deriveInitials(user?.full_name ?? viewerName) || "OP";
  }, [user, loading, viewerName]);
  const historySections = useMemo<SidebarHistorySection[]>(() => {
    const threadSessions = sessions.filter((session) => session.scope === "thread");
    if (!threadSessions.length) {
      return DEFAULT_HISTORY_SECTIONS.map((section) => ({
        ...section,
        entries: section.entries.map((entry) => ({ ...entry })),
      }));
    }

    const currentYear = new Date().getFullYear();
    const groups = new Map<
      string,
      {
        id: string;
        label: string;
        entries: SidebarHistorySection["entries"];
        sortKey: number;
      }
    >();

    threadSessions.forEach((session) => {
      const date = new Date(session.updatedAt);
      const groupId = `${date.getFullYear()}-${date.getMonth()}`;
      const label =
        date.getFullYear() === currentYear
          ? date.toLocaleDateString([], { month: "long" })
          : date.toLocaleDateString([], { month: "long", year: "numeric" });
      const sortKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          label,
          entries: [],
          sortKey,
        });
      }

      groups.get(groupId)?.entries.push({
        id: session.id,
        title: getReadableSessionTitle(session),
        href: `/c/${session.id}`,
        createdAt: session.updatedAt,
      });
    });

    return Array.from(groups.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .map((group) => ({
        id: group.id,
        label: group.label,
        entries: group.entries.sort((a, b) => b.createdAt - a.createdAt),
      }));
  }, [sessions]);
  const nowDateKey = useMemo(() => toDateKey(now), [now]);
  const workspaceTimeLabel = useMemo(
    () =>
      now
        .toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .toUpperCase(),
    [now]
  );
  const workspaceDateLabel = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [now]
  );
  const todayAnchor = useMemo(() => {
    const [yearString, monthString, dayString] = nowDateKey.split("-");
    const year = Number.parseInt(yearString ?? "", 10);
    const monthIndex = Number.parseInt(monthString ?? "", 10) - 1;
    const day = Number.parseInt(dayString ?? "", 10);

    if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) {
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }

    return new Date(year, monthIndex, day, 0, 0, 0, 0);
  }, [nowDateKey]);
  const isDashboardView = viewMode === "dashboard";
  const isChatView = viewMode === "chat";
  const isHistoryView = viewMode === "history";
  const sidebarActiveNav: SidebarNavKey =
    activeNav === "threads"
      ? "threads"
      : viewMode === "chat"
        ? currentChatId && generalSessionId && currentChatId === generalSessionId
          ? "general"
          : "history"
        : viewMode === "history"
          ? "history"
          : viewMode === "dashboard"
            ? "dashboard"
            : "general";
  const handleNavigate = (navId: SidebarNavKey) => {
    if (navId === "search") {
      setIsSidebarExpanded(true);
      return;
    }

    if (navId === "history") {
      setManualViewMode("history");
      setIsSidebarExpanded(true);
      return;
    }

    if (navId === "dashboard") {
      setManualViewMode(null);
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        router.push(target);
      }
      return;
    }

    if (navId === "general") {
      setManualViewMode(null);
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        router.push(target);
      }
      return;
    }

    if (navId === "threads") {
      setIsSidebarExpanded(true);
      setManualViewMode(null);
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        router.push(target);
      }
      return;
    }

    setIsSidebarExpanded(true);
  };

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setNow(new Date(initialTimestamp + elapsed));
    };

    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [initialTimestamp]);

  const handleOpenPersonalization = () => {
    setIsPersonalizationOpen(true);
  };

  const handleClosePersonalization = () => {
    setIsPersonalizationOpen(false);
  };

  const handleOpenSettings = () => {
    console.info("Settings panel is not implemented yet.");
  };

  const handleOpenHelp = () => {
    console.info("Help center is not implemented yet.");
  };

  const handleLogOut = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      router.push("/login");
    }
  }, [router]);

  const derivedPlans = user ? plans : [];
  const derivedHabits = user ? habits : [];
  const derivedCalendars = user ? calendarCalendars : [];
  const derivedEvents = user ? calendarEvents : [];
  const workspaceContextSummary = useMemo<string | null>(() => {
    if (!user) {
      return null;
    }

    const sections: string[] = [];
    const currentCalendars = calendarCalendars;
    const currentPlans = plans;
    const currentHabits = habits;

    if (currentCalendars.length > 0) {
      sections.push(
        "Calendars:",
        currentCalendars
          .map((calendar) => `- ${calendar.label} (${calendar.isVisible ? "visible" : "hidden"})`)
          .join("\n")
      );
    }

    if (currentPlans.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push(
        "Plans:",
        currentPlans.map((plan) => `- ${plan.completed ? "done" : "pending"}: ${plan.label}`).join("\n")
      );
    }

    if (currentHabits.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push(
        "Habits:",
        currentHabits
          .map(
            (habit) =>
              `- ${habit.label} (streak: ${habit.streakLabel}${
                habit.previousLabel ? ` | previous: ${habit.previousLabel}` : ""
              })`
          )
          .join("\n")
      );
    }

    const hasWorkspaceDetails = sections.length > 0;
    const defaultProactivity = cloneProactivity(PROACTIVITY_SEED);
    const shouldIncludeProactivity =
      hasWorkspaceDetails &&
      proactivity !== null &&
      !areProactivityItemsEqual(proactivity, defaultProactivity);

    if (shouldIncludeProactivity && proactivity) {
      sections.push(
        "",
        "Proactivity:",
        `- ${proactivity.label}: ${proactivity.description} (Cadence: ${proactivity.cadence}, Times: ${(proactivity.times ?? [proactivity.time]).join(", ")})`
      );
    }

    const visibleCalendarMap = new Map(currentCalendars.map((calendar) => [calendar.id, calendar.label]));
    const nowTime = now.getTime();
    const upcomingEvents = derivedEvents
      .filter((event) => {
        const startDate = event.start instanceof Date ? event.start : new Date(event.start);
        return startDate.getTime() >= nowTime - 30 * 60 * 1000;
      })
      .sort((a, b) => {
        const aTime = (a.start instanceof Date ? a.start : new Date(a.start)).getTime();
        const bTime = (b.start instanceof Date ? b.start : new Date(b.start)).getTime();
        return aTime - bTime;
      })
      .slice(0, 3);

    if (upcomingEvents.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push(
        "Upcoming events:",
        upcomingEvents
          .map((event) => {
            const startDate = event.start instanceof Date ? event.start : new Date(event.start);
            const dateLabel = startDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
            const timeLabel = startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const calendarLabel = visibleCalendarMap.get(event.calendarId) ?? "Calendar";
            return `- ${dateLabel} ${timeLabel}: ${event.title} [${calendarLabel}]`;
          })
          .join("\n")
      );
    }

    const recentPulses = [...pulseEntries]
      .filter((entry) => Number.isFinite(entry.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);

    if (recentPulses.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      const pulseLines = recentPulses.map((pulse) => {
        const dateLabel = new Date(pulse.timestamp).toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const totalPlans = pulse.plans.length;
        const completedPlans = pulse.plans.filter((plan) => plan.completed).length;
        const totalHabits = pulse.habits.length;
        const activeHabits = pulse.habits.filter((habit) => Boolean(habit.completed)).length;
        const proactivityLabel = pulse.proactivity?.label ?? "No proactivity focus";
        return `- ${dateLabel}: ${completedPlans}/${totalPlans} plans complete, ${activeHabits}/${totalHabits} habits on track, Proactivity: ${proactivityLabel}`;
      });
      sections.push("Pulse snapshots:", pulseLines.join("\n"));
    }

    const summary = sections.join("\n").trim();
    return summary.length > 0 ? summary : null;
  }, [calendarCalendars, calendarEvents, habits, plans, proactivity, pulseEntries, user, now, derivedEvents]);

  useEffect(() => {
    setWorkspaceContext(workspaceContextSummary);
  }, [setWorkspaceContext, workspaceContextSummary]);

  useEffect(() => {
    if (!pendingRedirectChatId) {
      return;
    }
    const pendingSession = sessions.find((session) => session.id === pendingRedirectChatId);
    if (!pendingSession || pendingSession.isResponding) {
      return;
    }
    setPendingRedirectChatId(null);
    const generalId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
    if (pendingSession.id === generalId) {
      router.push("/g");
    } else {
      router.push(`/c/${pendingSession.id}`);
    }
  }, [generalSessionId, pendingRedirectChatId, router, sessions]);
  useEffect(() => {
    if (activeNav === "threads") {
      return;
    }
    if (!currentChatId && generalSessionId) {
      setCurrentChatId(generalSessionId);
    }
  }, [activeNav, currentChatId, generalSessionId]);

  /**
   * Synchronize currentChatId with /c/[chatId] when in full-page chat mode.
   *
   * Behavior:
   * - /c/{thread_session_id}:
   *     use that local session (messages stream & persist correctly).
   * - /c/{conversation_id}:
   *     if any session has conversationId === id, use that session.
   * - unknown /c/{id}:
   *     create a real thread ChatSession with id === {id}, so sending messages works.
   * - missing id:
   *     fall back to generalSessionId.
   */
  useEffect(() => {
    if (variant !== "chat") {
      return;
    }

    // No explicit chat id -> keep using general session.
    if (!activeChatId) {
      if (!currentChatId && generalSessionId) {
        setCurrentChatId(generalSessionId);
      }
      return;
    }

    // Already selected the right session.
    if (currentChatId === activeChatId) {
      return;
    }

    // 1) Exact local session id match (/c/{session.id}).
    const directSession = sessions.find((session) => session.id === activeChatId);
    if (directSession) {
      if (currentChatId !== directSession.id) {
        setCurrentChatId(directSession.id);
      }
      return;
    }

    // 2) Match by conversationId so /c/{conversationId} works.
    const byConversation = sessions.find(
      (session) => session.conversationId && session.conversationId === activeChatId
    );
    if (byConversation) {
      if (currentChatId !== byConversation.id) {
        setCurrentChatId(byConversation.id);
      }
      return;
    }

    // 3) Unknown id: seed a real session so /c/{id} can hydrate & stream normally.
    let resolved = getSession(activeChatId);
    if (!resolved) {
      const ensureSessionFn = ensureSessionRef.current;
      if (!ensureSessionFn) {
        return;
      }
      const nowTs = Date.now();
      resolved = ensureSessionFn(activeChatId, () => ({
        id: activeChatId,
        title: "Shared Chat",
        createdAt: nowTs,
        updatedAt: nowTs,
        messages: [],
        isResponding: false,
        scope: "thread",
        conversationId: activeChatId,
        pendingAutoStream: false,
      }));
    } else if (!resolved.conversationId) {
      updateSession(resolved.id, { conversationId: activeChatId });
    }

    setCurrentChatId(resolved?.id ?? activeChatId);
  }, [
    activeChatId,
    currentChatId,
    generalSessionId,
    getSession,
    sessions,
    updateSession,
    variant,
  ]);
  const activePulse = useMemo(() => {
    if (!pulseEntries.length) {
      return null;
    }
    if (!activePulseId) {
      return pulseEntries[0];
    }
    return pulseEntries.find((entry) => entry.id === activePulseId) ?? pulseEntries[0];
  }, [pulseEntries, activePulseId]);
  const isActivePulseEditable = activePulse?.dateKey === nowDateKey;

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const currentPlans = user ? plans : [];
    const currentHabits = user ? habits : [];
    const snapshotBase = createPulseSnapshot(todayAnchor, currentPlans, currentHabits, proactivity);

    setPulseEntries((previous) => {
      const existingIndex = previous.findIndex((entry) => entry.dateKey === snapshotBase.dateKey);
      const stableId = existingIndex >= 0 ? previous[existingIndex].id : snapshotBase.id;
      const snapshot: PulseEntry = {
        ...snapshotBase,
        id: stableId,
      };

      if (existingIndex === 0) {
        const current = previous[0];
        if (
          arePlanListsEqual(current.plans, snapshot.plans) &&
          areHabitListsEqual(current.habits, snapshot.habits) &&
          areProactivityItemsEqual(current.proactivity, snapshot.proactivity)
        ) {
          return previous;
        }
        return [
          { ...current, ...snapshot },
          ...previous.slice(1),
        ];
      }

      if (existingIndex > 0) {
        const without = previous.filter((_, index) => index !== existingIndex);
        return [snapshot, ...without].slice(0, MAX_PULSE_HISTORY);
      }

      return [snapshot, ...previous].slice(0, MAX_PULSE_HISTORY);
    });
  }, [user, plans, habits, proactivity, todayAnchor]);

  useEffect(() => {
    if (!pulseEntries.length) {
      if (activePulseId !== null) {
        setActivePulseId(null);
      }
      return;
    }

    if (!activePulseId || !pulseEntries.some((entry) => entry.id === activePulseId)) {
      setActivePulseId(pulseEntries[0].id);
    }
  }, [pulseEntries, activePulseId]);

  const togglePlan = (id: string) => {
    if (!user) {
      return;
    }

    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const planId = Number(id);
    if (Number.isNaN(planId)) {
      return;
    }

    const previousPlans = plans;
    const targetPlan = previousPlans.find((plan) => plan.id === id);
    if (!targetPlan) {
      return;
    }

    const nextCompleted = !targetPlan.completed;
    const updatedPlans = previousPlans.map((plan) =>
      plan.id === id ? { ...plan, completed: nextCompleted } : plan
    );

    setPlans(updatedPlans);

    apiService
      .updatePlan(user.id, planId, { completed: nextCompleted })
      .catch((error) => {
        console.error("Failed to update plan:", error);
        setPlans(previousPlans);
      });
  };

  const editPlan = (planToEdit: PlanItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const planId = Number(planToEdit.id);
    if (Number.isNaN(planId)) {
      return;
    }

    const nextLabel = window.prompt("Edit plan", planToEdit.label)?.trim();
    if (!nextLabel || nextLabel === planToEdit.label) {
      return;
    }

    const previousPlans = plans;
    const updatedPlans = previousPlans.map((plan) =>
      plan.id === planToEdit.id ? { ...plan, label: nextLabel } : plan
    );

    setPlans(updatedPlans);

    apiService
      .updatePlan(user.id, planId, { label: nextLabel })
      .catch((error) => {
        console.error("Failed to rename plan:", error);
        setPlans(previousPlans);
      });
  };

  const deletePlan = (planToDelete: PlanItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const planId = Number(planToDelete.id);
    if (Number.isNaN(planId)) {
      return;
    }

    const previousPlans = plans;
    const updatedPlans = previousPlans.filter((plan) => plan.id !== planToDelete.id);
    setPlans(updatedPlans);

    apiService
      .deletePlan(user.id, planId)
      .catch((error) => {
        console.error("Failed to delete plan:", error);
        setPlans(previousPlans);
      });
  };

  const toggleHabit = (id: string) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }
    const previousHabits = habits;
    const targetHabit = previousHabits.find((habit) => habit.id === id);
    if (!targetHabit) {
      return;
    }

    const updatedHabits = previousHabits.map((habit) =>
      habit.id === id ? { ...habit, completed: !habit.completed } : habit
    );
    setHabits(updatedHabits);
  };

  const editHabit = (habitToEdit: HabitItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const habitId = Number(habitToEdit.id);
    if (Number.isNaN(habitId)) {
      return;
    }

    const nextLabel = window.prompt("Edit habit", habitToEdit.label)?.trim();
    if (!nextLabel || nextLabel === habitToEdit.label) {
      return;
    }

    const previousHabits = habits;
    const updatedHabits = previousHabits.map((habit) =>
      habit.id === habitToEdit.id ? { ...habit, label: nextLabel } : habit
    );

    setHabits(updatedHabits);

    apiService
      .updateHabit(user.id, habitId, { label: nextLabel })
      .catch((error) => {
        console.error("Failed to rename habit:", error);
        setHabits(previousHabits);
      });
  };

  const deleteHabit = (habitToDelete: HabitItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const habitId = Number(habitToDelete.id);
    if (Number.isNaN(habitId)) {
      return;
    }

    const previousHabits = habits;
    const updatedHabits = previousHabits.filter((habit) => habit.id !== habitToDelete.id);
    setHabits(updatedHabits);

    apiService
      .deleteHabit(user.id, habitId)
      .catch((error) => {
        console.error("Failed to delete habit:", error);
        // If habit is already deleted on backend, keep it removed from UI
        if (error.message.includes("Habit not found")) {
          console.log("Habit was already deleted on backend, keeping UI updated");
          return;
        }
        // For other errors, restore the habit in UI
        setHabits(previousHabits);
      });
  };

  const selectProactivityPreset = (next: ProactivityItem) => {
    setProactivity({
      ...next,
      times: normalizeProactivityTimes(next.times ?? null, next.time),
      time: primaryProactivityTime(next.times ?? null, next.time),
      channels: normalizeProactivityChannels(next.channels ?? null),
    });
  };

  const removeProactivity = () => {
    setProactivity(null);
  };

  const refreshPlansAndHabits = async () => {
    if (!user?.id) {
      return;
    }

    try {
      const [planResponse, habitResponse] = await Promise.all([
        apiService.getUserPlans(user.id),
        apiService.getUserHabits(user.id),
      ]);

      const mappedPlans: PlanItem[] = Array.isArray(planResponse)
        ? planResponse.map((plan) => ({
            id: plan.id.toString(),
            label: plan.label,
            completed: Boolean(plan.completed),
            deadline: plan.deadline ?? null,
            scheduleSlot: plan.schedule_slot ?? null,
          }))
        : [];

      const mappedHabits: HabitItem[] = Array.isArray(habitResponse)
        ? habitResponse.map((habit) => ({
            id: habit.id.toString(),
            label: habit.label,
            streakLabel: habit.streak_label,
            previousLabel: habit.previous_label,
            completed: false,
          }))
        : [];

      setPlans(mappedPlans);
      setHabits(mappedHabits);
    } catch (error) {
      console.error("Failed to refresh plans and habits:", error);
    }
  };

  const handleCalendarsChange = (nextCalendars: CalendarInfo[]) => {
    const previousCalendars = new Map(calendarCalendars.map((calendar) => [calendar.id, calendar]));
    setCalendarCalendars(nextCalendars);

    if (!user) {
      return;
    }

    nextCalendars.forEach((calendar) => {
      const previous = previousCalendars.get(calendar.id);
      if (
        !previous ||
        previous.label !== calendar.label ||
        previous.color !== calendar.color ||
        previous.isVisible !== calendar.isVisible
      ) {
        const calendarId = Number(calendar.id);
        if (Number.isNaN(calendarId)) {
          return;
        }

        apiService
          .updateCalendar(user.id, calendarId, {
            label: calendar.label,
            color: calendar.color,
            is_visible: calendar.isVisible,
          })
          .catch((error) => {
            console.error("Failed to update calendar:", error);
          });
      }
    });
  };

  const handleEventsChange = async (nextEvents: CalendarEvent[]) => {
    const previousEvents = calendarEvents;
    setCalendarEvents(nextEvents);

    if (!user) {
      return;
    }

    // Find deleted events (in previous but not in next)
    const deletedEventIds = previousEvents
      .filter(prev => !nextEvents.find(next => next.id === prev.id))
      .map(event => event.id);

    // Find new events (in next but not in previous)
    const newEvents = nextEvents.filter(
      next => !previousEvents.find(prev => prev.id === next.id)
    );

    // Find updated events (in both, but with different data)
    const updatedEvents = nextEvents.filter(next => {
      const prev = previousEvents.find(p => p.id === next.id);
      if (!prev) return false;
      return (
        prev.title !== next.title ||
        prev.start.getTime() !== next.start.getTime() ||
        prev.end.getTime() !== next.end.getTime() ||
        prev.description !== next.description ||
        prev.calendarId !== next.calendarId
      );
    });

    // Delete removed events
    for (const eventId of deletedEventIds) {
      const numericId = Number(eventId);
      if (!Number.isNaN(numericId)) {
        // Real event - delete from backend
        apiService.deleteCalendarEvent(user.id, numericId).catch((error) => {
          console.error("Failed to delete calendar event:", error);
          // Revert the change on error
          setCalendarEvents(previousEvents);
        });
      } else if (eventId.startsWith('evt-')) {
        // Temporary event - just remove from local state
        // No need to call API
        console.log("Removing temporary event:", eventId);
      }
    }

    // Create new events
    for (const event of newEvents) {
      const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
      if (!Number.isNaN(numericCalendarId) || event.calendarId === "default") {
        try {
          const createdEvent = await apiService.createCalendarEvent(user.id, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
          });
          // Update the local state with the real ID from the backend
          setCalendarEvents(prev => prev.map(e => e.id === event.id ? {
            ...e,
            id: createdEvent.id.toString()
          } : e));
        } catch (error) {
          console.error("Failed to create calendar event:", error);
          // Revert the change on error
          setCalendarEvents(previousEvents);
        }
      }
    }

    // Update existing events
    for (const event of updatedEvents) {
      const numericEventId = Number(event.id);
      const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
      if (!Number.isNaN(numericEventId) && (!Number.isNaN(numericCalendarId) || event.calendarId === "default")) {
        try {
          await apiService.updateCalendarEvent(user.id, numericEventId, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
          });
        } catch (error) {
          console.error("Failed to update calendar event:", error);
          // Revert the change on error
          setCalendarEvents(previousEvents);
        }
      }
    }
  };

  const handleCalendarIntegration = useCallback(async () => {
    if (!user) {
      console.warn("Unable to start Google Calendar integration without a user.");
      return;
    }

    const callbackUrl = typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/google-calendar/callback`
      : undefined;

    try {
      const response = await apiService.requestGoogleCalendarAuth(user.id, {
        redirectUri: callbackUrl,
      });
      const authUrl = response?.authorization_url;

      if (authUrl) {
        window.open(authUrl, "_blank", "noopener,noreferrer");
      } else {
        console.error("Google Calendar integration response did not include an authorization URL.");
      }
    } catch (error) {
      console.error("Failed to initiate Google Calendar integration:", error);
    }
  }, [user]);

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = chatDraft.trim();
    if (!draft) {
      return;
    }
    setChatDraft("");

    try {
      const isGeneralChatActive =
        Boolean(currentChatId) &&
        Boolean(generalSessionId) &&
        currentChatId === generalSessionId;

      const shouldStartStandaloneThread =
        viewMode === "general" && (!currentChatId || isGeneralChatActive);

      // When starting a standalone thread from the dashboard/general view,
      // immediately navigate to the thread route (no deferred redirect),
      // so the main chat view renders and begins streaming without extra delay.
      if (shouldStartStandaloneThread) {
        const session = await createThreadSession(draft);
        setHasSeenGeneralChat(true);
        setCurrentChatId(session.id);

        // Push directly instead of prefetch-then-lazy-redirect.
        router.push(`/c/${session.id}`);
        return;
      }

      const sessionId = await sendGeneralMessage(draft);
      setHasSeenGeneralChat(true);
      setCurrentChatId(sessionId);

      const generalId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
      const isGeneralSession = sessionId === generalId;

      if (supportsInlineChat) {
        // Switch layout immediately to chat mode so the user sees the reply begin
        // without waiting for an asynchronous redirect effect chain.
        setManualViewMode("chat");
        setPendingRedirectChatId(null);
      } else if (isGeneralSession) {
        router.push("/g");
      } else if (activeChatId !== sessionId) {
        router.push(`/c/${sessionId}`);
      }
    } catch (error) {
      console.error("Failed to send general message:", error);
      setChatDraft(draft);
    }
  };

  const handleOpenHistoryEntry = (entry: SidebarHistoryEntry) => {
    if (!entry.href || entry.href === "#") {
      return;
    }
    if (supportsInlineChat) {
      setCurrentChatId(entry.id);
      setManualViewMode("chat");
      return;
    }
    setManualViewMode(null);
    router.push(entry.href);
  };

  const handleOpenHistoryEntryExternal = (entry: SidebarHistoryEntry) => {
    if (!entry.href || entry.href === "#") {
      return;
    }
    window.open(entry.href, "_blank", "noopener,noreferrer");
  };

  const handleRenameHistoryEntry = (entry: SidebarHistoryEntry) => {
    const nextTitle = window.prompt("Rename conversation", entry.title);
    if (!nextTitle) {
      return;
    }
    renameSession(entry.id, nextTitle);
  };

  const handleDeleteHistoryEntry = (entry: SidebarHistoryEntry) => {
    const confirmed = window.confirm("Delete this conversation? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    deleteSession(entry.id);
    if (currentChatId === entry.id) {
      setCurrentChatId(null);
    }
  };

  const greeting = `Good ${greetingForDate(now)}, ${viewerName}`;
  const dashboardTabAttr = isDashboardView ? dashboardTab : undefined;

  return (
    <div
      className={styles.page}
      data-dashboard-tab={dashboardTabAttr}
      data-compact={isCompactLayout ? "true" : "false"}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.layout} data-view={viewMode}>
          <GrayEnhancedSidebar
            isExpanded={isSidebarExpanded}
            viewerName={viewerName}
            viewerInitials={viewerInitials}
            viewerAvatarUrl={viewerAvatarUrl}
            activeNav={sidebarActiveNav}
            railItems={SIDEBAR_RAIL_ITEMS}
            navItems={SIDEBAR_ITEMS}
            historySections={historySections}
            onExpand={() => setIsSidebarExpanded(true)}
            onCollapse={() => setIsSidebarExpanded(false)}
            onToggle={() => setIsSidebarExpanded((previous) => !previous)}
            onNavigate={handleNavigate}
            activeChatId={currentChatId}
            onOpenPersonalization={handleOpenPersonalization}
            onOpenSettings={handleOpenSettings}
            onOpenHelp={handleOpenHelp}
            onLogOut={handleLogOut}
          />

          <div
            className={styles.main}
            data-dashboard={isDashboardView ? "true" : "false"}
            data-view={viewMode}
            data-dashboard-tab={dashboardTabAttr}
            data-compact={isCompactLayout ? "true" : "false"}
          >
            <div
              className={styles.mainContent}
              data-view={viewMode}
              data-compact={isCompactLayout ? "true" : "false"}
            >
              {viewMode === "general" && (
                <GrayWorkspaceHeader
                  timeLabel={workspaceTimeLabel}
                  dateLabel={workspaceDateLabel}
                  streakCount={streakCount}
                />
              )}
              {isDashboardView ? (
                <GrayDashboardView
                  pulseEntries={pulseEntries}
                  currentPulse={activePulse}
                  isCurrentPulseEditable={Boolean(isActivePulseEditable)}
                  onSelectPulse={setActivePulseId}
                  proactivityFallback={proactivity}
                  onProactivitySelect={selectProactivityPreset}
                  onProactivityRemove={removeProactivity}
                  onTogglePlan={togglePlan}
                  onToggleHabit={toggleHabit}
                  onEditPlan={editPlan}
                  onDeletePlan={deletePlan}
                  activeTab={dashboardTab}
                  onSelectTab={setDashboardTab}
                  currentDate={now}
                  calendars={derivedCalendars}
                  onCalendarsChange={handleCalendarsChange}
                  calendarEvents={derivedEvents}
                  onCalendarEventsChange={handleEventsChange}
                  calendarSelectedDate={calendarSelectedDate}
                  onCalendarSelectedDateChange={setCalendarSelectedDate}
                  onEditHabit={editHabit}
                  onDeleteHabit={deleteHabit}
                  onIntegrationAction={handleCalendarIntegration}
                  onRefreshData={refreshPlansAndHabits}
                  chatBar={
                    shouldShowDashboardChatBar ? (
                      <GrayChatBar
                        value={chatDraft}
                        onChange={setChatDraft}
                        onSubmit={handleChatSubmit}
                      />
                    ) : undefined
                  }
                  isCompactLayout={isCompactLayout}
                />
              ) : isChatView ? (
                <GrayChatView
                  sessionId={currentChatId ?? null}
                  onContextUsageChange={setContextUsageSummary}
                  introContent={
                    activeNav !== "threads" &&
                    supportsInlineChat &&
                    !hasSeenGeneralChat &&
                    currentChatId &&
                    generalSessionId &&
                    currentChatId === generalSessionId ? (
                      <div className={styles.introStack}>
                        <GrayWorkspaceHeader
                          timeLabel={workspaceTimeLabel}
                          dateLabel={workspaceDateLabel}
                          streakCount={streakCount}
                        />
                        <GrayGeneralView
                          greeting={greeting}
                          calendarEvents={derivedEvents}
                          plans={derivedPlans}
                          habits={derivedHabits}
                          activeTab={planTab}
                          onChangeTab={setPlanTab}
                          onTogglePlan={togglePlan}
                          onToggleHabit={toggleHabit}
                          onEditPlan={editPlan}
                          onDeletePlan={deletePlan}
                          currentDate={now}
                          calendars={derivedCalendars}
                          onCalendarsChange={handleCalendarsChange}
                          onCalendarEventsChange={handleEventsChange}
                          calendarSelectedDate={calendarSelectedDate}
                          onCalendarSelectedDateChange={setCalendarSelectedDate}
                          isCompactLayout={isCompactLayout}
                          onEditHabit={editHabit}
                          onDeleteHabit={deleteHabit}
                          onRefreshData={refreshPlansAndHabits}
                        />
                      </div>
                    ) : null
                  }
                />
              ) : isHistoryView ? (
                <GrayHistoryView
                  sections={historySections}
                  onOpenEntry={handleOpenHistoryEntry}
                  activeEntryId={currentChatId ?? null}
                  onOpenEntryExternal={handleOpenHistoryEntryExternal}
                  onRenameEntry={handleRenameHistoryEntry}
                  onDeleteEntry={handleDeleteHistoryEntry}
                />
              ) : (
                <div className={styles.generalViewSection}>
                  <GrayGeneralView
                    greeting={greeting}
                    calendarEvents={derivedEvents}
                    plans={derivedPlans}
                    habits={derivedHabits}
                    activeTab={planTab}
                    onChangeTab={setPlanTab}
                    onTogglePlan={togglePlan}
                    onToggleHabit={toggleHabit}
                    onEditPlan={editPlan}
                    onDeletePlan={deletePlan}
                    currentDate={now}
                    calendars={derivedCalendars}
                    onCalendarsChange={handleCalendarsChange}
                    onCalendarEventsChange={handleEventsChange}
                    calendarSelectedDate={calendarSelectedDate}
                    onCalendarSelectedDateChange={setCalendarSelectedDate}
                    isCompactLayout={isCompactLayout}
                    onEditHabit={editHabit}
                    onDeleteHabit={deleteHabit}
                    onRefreshData={refreshPlansAndHabits}
                  />
                  <div className={`${styles.chatBarRow} ${styles.generalChatBarRow}`}>
                    <GrayChatBar
                      value={chatDraft}
                      onChange={setChatDraft}
                      onSubmit={handleChatSubmit}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      {isPersonalizationOpen && (
        <PersonalizationPanel
          viewerName={viewerName}
          viewerRole={user?.role || "Operator"}
          userId={userId}
          contextUsage={contextUsageSummary}
          onClose={handleClosePersonalization}
        />
      )}
    </div>
  );
}

// Wrapper component that provides the UserContext
export default function GrayPageClient({
  initialTimestamp,
  viewerEmail,
  activeNav,
  variant = "general",
  activeChatId = null,
}: GrayPageClientProps) {
  return (
    <UserProvider userEmail={viewerEmail ?? undefined}>
      <ChatProvider>
        <GrayPageClientInner
          key={variant === "chat" ? `chat-${activeChatId ?? "new"}` : "gray-root"}
          initialTimestamp={initialTimestamp}
          activeNav={activeNav}
          variant={variant}
          activeChatId={activeChatId}
        />
      </ChatProvider>
    </UserProvider>
  );
}
