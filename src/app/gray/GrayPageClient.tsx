"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Gem, MessageSquarePlus, LayoutDashboard, History, Search } from "lucide-react";
import { GrayEnhancedSidebar } from "@/components/gray/EnhancedSidebar";
import { GrayWorkspaceHeader } from "@/components/gray/WorkspaceHeader";
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
} from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { ChatProvider, useChatStore } from "@/components/gray/ChatProvider";
import { DEFAULT_HISTORY_SECTIONS } from "@/components/gray/historySeed";
const PROACTIVITY_SEED: ProactivityItem = {
  id: "proactivity-1",
  label: "Check-ins",
  description: "Daily sync nudges for squad channels.",
  cadence: "Daily",
  time: "09:00 AM",
};

const DEFAULT_EVENT_COLOR = "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))";

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

const formatClock = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatDate = (date: Date) =>
  date
    .toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

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
  const [calendarCalendars, setCalendarCalendars] = useState<CalendarInfo[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [streakCount, setStreakCount] = useState(0);
  const { sessions, createSession } = useChatStore();
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
    setCalendarCalendars([]);
    setCalendarEvents([]);
    setStreakCount(0);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    const loadWorkspaceData = async () => {
      try {
        const [calendarResponse, eventResponse, planResponse, habitResponse] = await Promise.all([
          apiService.getUserCalendars(user.id),
          apiService.getUserCalendarEvents(user.id),
          apiService.getUserPlans(user.id),
          apiService.getUserHabits(user.id),
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

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    apiService
      .touchUserStreak(user.id)
      .then((streak) => {
        if (!isMounted) {
          return;
        }
        setStreakCount(streak.current_streak ?? 0);
      })
      .catch((error) => {
        console.error("Failed to update streak:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

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

  const togglePlan = (id: string) => {
    if (!user) {
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

  const timeLabel = formatClock(now);
  const dateLabel = formatDate(now);
  const greeting = `Good ${greetingForDate(now)}, ${viewerName}`;
  const showHeader = viewMode !== "chat";
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
            {showHeader && (
              <GrayWorkspaceHeader
                timeLabel={timeLabel}
                dateLabel={dateLabel}
                streakCount={streakCount}
              />
            )}

            <div
              className={styles.mainContent}
              data-view={viewMode}
            >
              {isDashboardView ? (
                <GrayDashboardView
                  plans={derivedPlans}
                  habits={derivedHabits}
                  proactivity={proactivity}
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
