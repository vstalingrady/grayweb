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
import { apiService, CalendarEvent as ApiCalendarEvent } from "@/lib/api";
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
import { createSeedCalendars, createSeedEvents } from "@/components/calendar/calendarSeed";

const PLAN_SEED: PlanItem[] = [
  {
    id: "plan-1",
    label: "Restore proactive cadence for the builder cohort.",
    completed: false,
  },
  {
    id: "plan-2",
    label: "Draft mitigation follow-up checklist.",
    completed: false,
  },
  {
    id: "plan-3",
    label: "Lock launch checklist scope for the revamp.",
    completed: true,
  },
  {
    id: "plan-4",
    label: "Draft async sync for builder cohort.",
    completed: false,
  },
];

const HABIT_SEED: HabitItem[] = [
  {
    id: "habit-1",
    label: "Coaching loop deferred until services stabilize.",
    streakLabel: "4 days",
    previousLabel: "Prev: Yesterday — 3 days",
  },
  {
    id: "habit-2",
    label: "No YouTube.",
    streakLabel: "6 days",
    previousLabel: "Prev: Yesterday — 5 days",
  },
  {
    id: "habit-3",
    label: "Movement break.",
    streakLabel: "2 days",
    previousLabel: "Prev: Yesterday — 1 day",
  },
];

const PROACTIVITY_SEED: ProactivityItem = {
  id: "proactivity-1",
  label: "Check-ins",
  description: "Daily sync nudges for squad channels.",
  cadence: "Daily",
  time: "09:00 AM",
};

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
  const [plans, setPlans] = useState<PlanItem[]>(() =>
    PLAN_SEED.map((plan) => ({ ...plan }))
  );
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [chatDraft, setChatDraft] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">("pulse");
  const [calendarCalendars, setCalendarCalendars] = useState<CalendarInfo[]>(createSeedCalendars);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(createSeedEvents);
  const { sessions, createSession } = useChatStore();

  const baseViewMode: ViewMode =
    variant === "chat"
      ? "chat"
      : variant === "dashboard"
        ? "dashboard"
        : "general";

  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(() =>
    activeNav === "history" && baseViewMode !== "chat" ? "history" : null
  );

  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : manualViewMode ?? (activeNav === "history" ? "history" : baseViewMode);

  // Fetch calendar events from API when user is available
  useEffect(() => {
    if (!user) {
      return;
    }

    apiService
      .getUserCalendarEvents(user.id)
      .then((apiEvents: ApiCalendarEvent[]) => {
        if (!apiEvents.length) {
          return;
        }

        const mapped = apiEvents.map((apiEvent) => ({
          id: apiEvent.id.toString(),
          calendarId: apiEvent.calendar_id?.toString() ?? "default",
          title: apiEvent.title,
          start: new Date(apiEvent.start_time),
          end: new Date(apiEvent.end_time),
          color: "linear-gradient(135deg, rgba(91, 141, 239, 0.85), rgba(48, 79, 254, 0.9))",
          entryType: "event",
        }));

        setCalendarEvents(mapped);

        const knownIds = new Set(mapped.map((event) => event.calendarId));
        setCalendarCalendars((previous) => {
          const next = [...previous];
          knownIds.forEach((id) => {
            if (!next.some((calendar) => calendar.id === id)) {
              next.push({
                id,
                label: id === "default" ? "Operations" : id,
                color: "linear-gradient(135deg, #5b8def, #304ffe)",
                isVisible: true,
              });
            }
          });
          return next;
        });
      })
      .catch((error) => {
        console.error("Failed to fetch calendar events:", error);
      });
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

  const streakCount = 12;

  const togglePlan = (id: string) => {
    setPlans((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
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
      router.push(`/chat/${session.id}`);
    } catch (error) {
      console.error("Failed to start chat session:", error);
      setChatDraft(draft);
    }
  };

  const handleOpenHistoryEntry = (entry: SidebarHistoryEntry) => {
    if (!entry.href || entry.href === "#") {
      return;
    }
    setIsSidebarExpanded(false);
    setManualViewMode(null);
    router.push(entry.href);
  };

  const timeLabel = formatClock(now);
  const dateLabel = formatDate(now);
  const greeting = `Good ${greetingForDate(now)}, ${viewerName}`;
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.layout}>
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
            activeChatId={activeChatId}
          />

          <div
            className={styles.main}
            data-dashboard={isDashboardView ? "true" : "false"}
          >
            <GrayWorkspaceHeader
              timeLabel={timeLabel}
              dateLabel={dateLabel}
              streakCount={streakCount}
            />

            <div className={styles.mainContent}>
              {isDashboardView ? (
                <GrayDashboardView
                  plans={plans}
                  habits={HABIT_SEED}
                  proactivity={proactivity}
                  dashboardDateLabel={dashboardDateLabel}
                  onTogglePlan={togglePlan}
                  activeTab={dashboardTab}
                  onSelectTab={setDashboardTab}
                  currentDate={now}
                  calendars={calendarCalendars}
                  onCalendarsChange={setCalendarCalendars}
                  calendarEvents={calendarEvents}
                  onCalendarEventsChange={setCalendarEvents}
                />
              ) : isChatView ? (
                <GrayChatView sessionId={activeChatId ?? null} />
              ) : isHistoryView ? (
                <GrayHistoryView
                  sections={historySections}
                  onOpenEntry={handleOpenHistoryEntry}
                  activeEntryId={activeChatId ?? null}
                />
              ) : (
                <GrayGeneralView
                  greeting={greeting}
                  calendarEvents={calendarEvents}
                  plans={plans}
                  habits={HABIT_SEED}
                  activeTab={planTab}
                  onChangeTab={setPlanTab}
                  onTogglePlan={togglePlan}
                  currentDate={now}
                  calendars={calendarCalendars}
                  onCalendarsChange={setCalendarCalendars}
                  onCalendarEventsChange={setCalendarEvents}
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
          initialTimestamp={initialTimestamp}
          activeNav={activeNav}
          variant={variant}
          activeChatId={activeChatId}
        />
      </ChatProvider>
    </UserProvider>
  );
}
