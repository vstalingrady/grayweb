"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Gem, MessageSquarePlus, LayoutDashboard, History, Search } from "lucide-react";
import { GraySidebar } from "@/components/gray/Sidebar";
import { GrayWorkspaceHeader } from "@/components/gray/WorkspaceHeader";
import { GrayDashboardView } from "@/components/gray/DashboardView";
import { GrayGeneralView } from "@/components/gray/GeneralView";
import { GrayChatBar } from "@/components/gray/ChatBar";
import styles from "./GrayPageClient.module.css";
import {
  type PlanItem,
  type HabitItem,
  type ProactivityItem,
  type DayEvent,
  type SidebarNavKey,
  type SidebarNavItem,
  type CalendarDisplayEvent,
  type SidebarHistorySection,
} from "@/components/gray/types";

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

const DAY_EVENTS_SEED: DayEvent[] = [
  {
    id: "event-1",
    start: "08:30",
    end: "09:15",
    label: "Builder cohort sync",
  },
  {
    id: "event-2",
    start: "11:00",
    end: "12:00",
    label: "Proactivity instrumentation review",
  },
  {
    id: "event-3",
    start: "15:30",
    end: "16:00",
    label: "Pulse QA slot",
  },
  {
    id: "event-4",
    start: "19:00",
    end: "19:45",
    label: "Alignment recap + journaling",
  },
];

const HOURS = Array.from({ length: 24 }, (_, index) => index);

const MINUTES_IN_DAY = 24 * 60;
const CALENDAR_HOUR_HEIGHT = 72;
const DEFAULT_EVENT_DURATION_MINUTES = 60;
const MIN_EVENT_DURATION_MINUTES = 45;

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

const SIDEBAR_HISTORY: SidebarHistorySection[] = [
  {
    month: "July",
    entries: [
      "Subjective Attractiveness",
      "Comparing Decimal Numbers",
      "Mobile-Friendly Fade Effect",
      "Kill la Kill Character Moments",
      "Infinite Scrolling Payment Model",
      "Infinite Logo Scroller Implementation",
    ],
  },
  {
    month: "June",
    entries: [
      "Chat Log Analysis Techniques",
      "Debate on Content Creation Ethics",
    ],
  },
];

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

const timeLabelToMinutes = (time: string) => {
  const [hourPart, minutePart = "0"] = time.split(":");
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }
  return Math.max(0, Math.min(MINUTES_IN_DAY, hours * 60 + minutes));
};

const minutesToDisplayLabel = (minutes: number) => {
  const clampedMinutes = Math.max(0, Math.min(MINUTES_IN_DAY, minutes));
  const hours = Math.floor(clampedMinutes / 60);
  const remainder = clampedMinutes % 60;
  const date = new Date();
  date.setHours(hours, remainder, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const minutesToPixels = (minutes: number) =>
  (minutes / 60) * CALENDAR_HOUR_HEIGHT;

const formatHourLabel = (hour: number) => {
  if (hour === 0) {
    return "12 AM";
  }
  if (hour < 12) {
    return `${hour} AM`;
  }
  if (hour === 12) {
    return "12 PM";
  }
  return `${hour - 12} PM`;
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

const DEFAULT_VIEWER_NAME = "Vstalin Grady";

const viewerNameFromEmail = (email: string | null): string => {
  if (!email) {
    return DEFAULT_VIEWER_NAME;
  }
  const [username] = email.split("@");
  if (!username) {
    return DEFAULT_VIEWER_NAME;
  }

  const parts = username
    .replace(/[\d_-]+/g, " ")
    .split(/[.\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1));

  if (!parts.length) {
    return DEFAULT_VIEWER_NAME;
  }

  if (parts.length === 1) {
    return DEFAULT_VIEWER_NAME;
  }

  return parts.join(" ");
};

const viewerInitialsFromName = (name: string) => {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "");

  const initials = parts.join("");
  return initials || "VG";
};

type GrayPageClientProps = {
  initialTimestamp: number;
  viewerEmail: string | null;
  activeNav?: SidebarNavKey;
  variant?: "general" | "dashboard";
};

export default function GrayPageClient({
  initialTimestamp,
  viewerEmail,
  activeNav,
  variant = "general",
}: GrayPageClientProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [plans, setPlans] = useState<PlanItem[]>(() =>
    PLAN_SEED.map((plan) => ({ ...plan }))
  );
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [chatDraft, setChatDraft] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">("pulse");

  const viewerName = useMemo(
    () => viewerNameFromEmail(viewerEmail),
    [viewerEmail]
  );
  const viewerInitials = useMemo(
    () => viewerInitialsFromName(viewerName),
    [viewerName]
  );
  const dayEvents = useMemo(
    () => DAY_EVENTS_SEED.map((event) => ({ ...event })),
    []
  );
  const calendarEvents = useMemo<CalendarDisplayEvent[]>(
    () =>
      dayEvents.map((event) => {
        const startMinutes = timeLabelToMinutes(event.start);
        const desiredEnd = event.end
          ? timeLabelToMinutes(event.end)
          : startMinutes + DEFAULT_EVENT_DURATION_MINUTES;
        const safeEnd = Math.min(
          Math.max(desiredEnd, startMinutes + MIN_EVENT_DURATION_MINUTES),
          MINUTES_IN_DAY
        );
        const durationMinutes = safeEnd - startMinutes;
        const eventHeight = Math.max(minutesToPixels(durationMinutes), 42);

        return {
          id: event.id,
          label: event.label,
          rangeLabel: `${minutesToDisplayLabel(startMinutes)} — ${minutesToDisplayLabel(
            safeEnd
          )}`,
          topOffset: minutesToPixels(startMinutes),
          height: eventHeight,
        };
      }),
    [dayEvents]
  );
  const isDashboardView = variant === "dashboard";
  const resolvedActiveNav =
    activeNav ?? (isDashboardView ? "dashboard" : "general");
  const proactivity = PROACTIVITY_SEED;
  const dashboardDateLabel = useMemo(
    () => formatDashboardDate(now),
    [now]
  );
  const handleNavigate = (navId: SidebarNavKey) => {
    if (navId === "search") {
      setIsSidebarExpanded(true);
      return;
    }

    const target = NAVIGATION_ROUTES[navId];
    if (target) {
      router.push(target);
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

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = chatDraft.trim();
    if (!draft) {
      return;
    }
    setChatDraft("");
  };

  const timeLabel = formatClock(now);
  const dateLabel = formatDate(now);
  const greeting = `Good ${greetingForDate(now)}, ${viewerName}`;
  const calendarTrackHeight = CALENDAR_HOUR_HEIGHT * HOURS.length;

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.layout}>
          <GraySidebar
            isExpanded={isSidebarExpanded}
            viewerName={viewerName}
            viewerInitials={viewerInitials}
            activeNav={resolvedActiveNav}
            railItems={SIDEBAR_RAIL_ITEMS}
            navItems={SIDEBAR_ITEMS}
            historySections={SIDEBAR_HISTORY}
            onExpand={() => setIsSidebarExpanded(true)}
            onCollapse={() => setIsSidebarExpanded(false)}
            onToggle={() => setIsSidebarExpanded((previous) => !previous)}
            onNavigate={handleNavigate}
          />

          <div className={styles.main}>
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
                />
              ) : (
                <GrayGeneralView
                  greeting={greeting}
                  hours={HOURS}
                  hourLabelFor={formatHourLabel}
                  calendarEvents={calendarEvents}
                  calendarTrackHeight={calendarTrackHeight}
                  calendarHourHeight={CALENDAR_HOUR_HEIGHT}
                  plans={plans}
                  habits={HABIT_SEED}
                  activeTab={planTab}
                  onChangeTab={setPlanTab}
                  onTogglePlan={togglePlan}
                />
              )}
            </div>

            <GrayChatBar
              value={chatDraft}
              onChange={setChatDraft}
              onSubmit={handleChatSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
