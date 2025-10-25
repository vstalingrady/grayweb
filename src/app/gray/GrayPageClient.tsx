"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Gem, MessageSquarePlus, LayoutDashboard, History, Search } from "lucide-react";
import { GrayEnhancedSidebar } from "@/components/gray/EnhancedSidebar";
import { GrayDashboardView } from "@/components/gray/DashboardView";
import { GrayGeneralView } from "@/components/gray/GeneralView";
import { GrayHistoryView } from "@/components/gray/HistoryView";
import { GrayChatBar } from "@/components/gray/ChatBar";
import { GrayChatView } from "@/components/gray/ChatView";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";
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
} from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { ChatProvider, useChatStore } from "@/components/gray/ChatProvider";
import { DEFAULT_HISTORY_SECTIONS } from "@/components/gray/historySeed";
import { GrayWorkspaceHeader } from "@/components/gray/WorkspaceHeader";
const PROACTIVITY_SEED: ProactivityItem = {
  id: "proactivity-1",
  label: "Check-ins",
  description: "Daily sync nudges for squad channels.",
  cadence: "Daily",
  time: "09:00 AM",
};

const DEFAULT_EVENT_COLOR = "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))";

const PULSE_STORAGE_KEY_PREFIX = "gray-dashboard-pulses:";
const MAX_PULSE_HISTORY = 30;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const clonePlans = (plans: PlanItem[]): PlanItem[] =>
  plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    completed: plan.completed,
  }));

const cloneHabits = (habits: HabitItem[]): HabitItem[] =>
  habits.map((habit) => ({
    id: habit.id,
    label: habit.label,
    streakLabel: habit.streakLabel,
    previousLabel: habit.previousLabel,
  }));

const cloneProactivity = (item: ProactivityItem): ProactivityItem => ({
  id: item.id,
  label: item.label,
  description: item.description,
  cadence: item.cadence,
  time: item.time,
});

const createPulseSnapshot = (
  referenceDate: Date,
  plans: PlanItem[],
  habits: HabitItem[],
  proactivity: ProactivityItem,
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
      plan.completed === other.completed
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
      habit.previousLabel === other.previousLabel
    );
  });

const areProactivityItemsEqual = (a: ProactivityItem, b: ProactivityItem) =>
  a.id === b.id &&
  a.label === b.label &&
  a.description === b.description &&
  a.cadence === b.cadence &&
  a.time === b.time;

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
        }))
        .filter((habit) => habit.id.length > 0)
    : [];

  const proactivity = raw.proactivity
    ? {
        id: String(raw.proactivity.id ?? PROACTIVITY_SEED.id),
        label: typeof raw.proactivity.label === "string" ? raw.proactivity.label : PROACTIVITY_SEED.label,
        description:
          typeof raw.proactivity.description === "string"
            ? raw.proactivity.description
            : PROACTIVITY_SEED.description,
        cadence:
          typeof raw.proactivity.cadence === "string"
            ? raw.proactivity.cadence
            : PROACTIVITY_SEED.cadence,
        time:
          typeof raw.proactivity.time === "string"
            ? raw.proactivity.time
            : PROACTIVITY_SEED.time,
      }
    : cloneProactivity(PROACTIVITY_SEED);

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
  { id: "new-thread", label: "New Thread", icon: MessageSquarePlus },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "history", label: "History", icon: History },
];

const SIDEBAR_RAIL_ITEMS: SidebarNavItem[] = [
  { id: "search", label: "Search", icon: Search },
  ...SIDEBAR_ITEMS,
];

const NAVIGATION_ROUTES: Partial<Record<SidebarNavKey, string>> = {
  general: "/",
  dashboard: "/dashboard",
};

const formatDashboardDate = (date: Date) =>
  date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
  });

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
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [chatDraft, setChatDraft] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">("pulse");
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>([]);
  const [activePulseId, setActivePulseId] = useState<string | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [calendarCalendars, setCalendarCalendars] = useState<CalendarInfo[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const {
    sessions,
    createSession,
    renameSession,
    deleteSession,
    setWorkspaceContext,
  } = useChatStore();
  const supportsInlineChat = variant !== "chat";
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => activeChatId ?? null);

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

  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : manualViewMode ?? (activeNav === "history" ? "history" : baseViewMode);

  useEffect(() => {
    if (user) {
      return;
    }
    setPlans([]);
    setHabits([]);
    setPulseEntries([]);
    setActivePulseId(null);
    setCalendarCalendars([]);
    setCalendarEvents([]);
    setStreakCount(0);
  }, [user]);

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
    } catch (error) {
      console.error("Failed to load pulse history:", error);
      setPulseEntries([]);
      setActivePulseId(null);
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
    if (!user) {
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
          apiService.getUserCalendars(user.id),
          apiService.getUserCalendarEvents(user.id),
          apiService.getUserPlans(user.id),
          apiService.getUserHabits(user.id),
          apiService
            .getUserStreak(user.id)
            .catch((error) => {
              console.error("Failed to load user streak:", error);
              return null;
            }),
        ]);

        if (!isMounted) {
          return;
        }

        const mappedCalendars: CalendarInfo[] = calendarResponse.map((calendar) => ({
          id: calendar.id.toString(),
          label: calendar.label,
          color: calendar.color,
          isVisible: Boolean(calendar.is_visible),
        }));

        const calendarColorMap = new Map<string, string>(
          mappedCalendars.map((calendar) => [calendar.id, calendar.color])
        );

        const fallbackCalendarId = mappedCalendars[0]?.id ?? "default";
        const fallbackEventColor =
          calendarColorMap.get(fallbackCalendarId) ?? DEFAULT_EVENT_COLOR;

        const mappedEvents: CalendarEvent[] = eventResponse.map((event) => {
          const associatedCalendarId = event.calendar_id ? event.calendar_id.toString() : fallbackCalendarId;
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
        });

        const mappedPlans: PlanItem[] = planResponse.map((plan) => ({
          id: plan.id.toString(),
          label: plan.label,
          completed: Boolean(plan.completed),
        }));

        const mappedHabits: HabitItem[] = habitResponse.map((habit) => ({
          id: habit.id.toString(),
          label: habit.label,
          streakLabel: habit.streak_label,
          previousLabel: habit.previous_label,
        }));

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
  }, [user]);

  const viewerName = useMemo(() => {
    if (loading) {
      return "Loading...";
    }
    return user?.full_name || "Operator";
  }, [user, loading]);

  const viewerAvatarUrl = user?.profile_picture_url ?? null;

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
    if (!sessions.length) {
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

    sessions.forEach((session) => {
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
        title: session.title,
        href: `/chat/${session.id}`,
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
  const proactivity = PROACTIVITY_SEED;
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
  const dashboardDateLabel = useMemo(
    () => formatDashboardDate(now),
    [now]
  );
  const isDashboardView = viewMode === "dashboard";
  const isChatView = viewMode === "chat";
  const isHistoryView = viewMode === "history";
  const sidebarActiveNav: SidebarNavKey =
    viewMode === "chat"
      ? "history"
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

    if (navId === "new-thread") {
      setManualViewMode(null);
      setIsSidebarExpanded(true);
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

  const derivedPlans = user ? plans : [];
  const derivedHabits = user ? habits : [];
  const derivedCalendars = user ? calendarCalendars : [];
  const derivedEvents = user ? calendarEvents : [];
  const workspaceContextSummary = useMemo(() => {
    const currentCalendars = user ? calendarCalendars : [];
    const currentPlans = user ? plans : [];
    const currentHabits = user ? habits : [];

    const calendarLines = currentCalendars.length
      ? currentCalendars
          .map((calendar) => `- ${calendar.label} (${calendar.isVisible ? "visible" : "hidden"})`)
          .join("\n")
      : "- No calendars connected.";

    const planLines = currentPlans.length
      ? currentPlans
          .map((plan) => `- ${plan.completed ? "done" : "pending"}: ${plan.label}`)
          .join("\n")
      : "- No plans captured.";

    const habitLines = currentHabits.length
      ? currentHabits
          .map(
            (habit) =>
              `- ${habit.label} (streak: ${habit.streakLabel}${habit.previousLabel ? ` | previous: ${habit.previousLabel}` : ""})`
          )
          .join("\n")
      : "- No habits tracked.";

    const proactivityLine = `- ${proactivity.label}: ${proactivity.description} (Cadence: ${proactivity.cadence}, Time: ${proactivity.time})`;

    return [
      "Calendars:",
      calendarLines,
      "",
      "Plans:",
      planLines,
      "",
      "Habits:",
      habitLines,
      "",
      "Proactivity:",
      proactivityLine,
    ]
      .join("\n")
      .trim();
  }, [calendarCalendars, habits, plans, proactivity, user]);

  useEffect(() => {
    setWorkspaceContext(workspaceContextSummary);
  }, [setWorkspaceContext, workspaceContextSummary]);
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

  const handleEventsChange = (nextEvents: CalendarEvent[]) => {
    setCalendarEvents(nextEvents);
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = chatDraft.trim();
    if (!draft) {
      return;
    }
    setChatDraft("");
    try {
      const session = await createSession(draft);
      if (supportsInlineChat) {
        setCurrentChatId(session.id);
        setManualViewMode("chat");
        setIsSidebarExpanded(false);
      } else {
        router.push(`/chat/${session.id}`);
      }
    } catch (error) {
      console.error("Failed to start chat session:", error);
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
      setIsSidebarExpanded(false);
      return;
    }
    setIsSidebarExpanded(false);
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
  return (
    <div className={styles.page}>
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
          />

          <div
            className={styles.main}
            data-dashboard={isDashboardView ? "true" : "false"}
            data-view={viewMode}
          >
            <div
              className={styles.mainContent}
              data-view={viewMode}
            >
              {(isDashboardView || viewMode === "general") && (
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
                  dashboardDateLabel={dashboardDateLabel}
                  onTogglePlan={togglePlan}
                  activeTab={dashboardTab}
                  onSelectTab={setDashboardTab}
                  currentDate={now}
                  calendars={derivedCalendars}
                  onCalendarsChange={handleCalendarsChange}
                  calendarEvents={derivedEvents}
                  onCalendarEventsChange={handleEventsChange}
                />
              ) : isChatView ? (
                <GrayChatView sessionId={currentChatId ?? null} />
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
                <GrayGeneralView
                  greeting={greeting}
                  calendarEvents={derivedEvents}
                  plans={derivedPlans}
                  habits={derivedHabits}
                  activeTab={planTab}
                  onChangeTab={setPlanTab}
                  onTogglePlan={togglePlan}
                  currentDate={now}
                  calendars={derivedCalendars}
                  onCalendarsChange={handleCalendarsChange}
                  onCalendarEventsChange={handleEventsChange}
                />
              )}
            </div>

            {viewMode === "general" && (
              <GrayChatBar
                value={chatDraft}
                onChange={setChatDraft}
                onSubmit={handleChatSubmit}
              />
            )}
          </div>
        </div>
      </div>
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
    <UserProvider userEmail={viewerEmail}>
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
