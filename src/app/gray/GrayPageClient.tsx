"use client";

import Image from "next/image";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  AudioLines,
  Bell,
  CheckSquare,
  ChevronDown,
  ChevronsUp,
  Flame,
  Gem,
  History,
  LayoutDashboard,
  MessageSquarePlus,
  Mic,
  Plus,
  Search,
  Square,
} from "lucide-react";
import styles from "./GrayPageClient.module.css";

type PlanItem = {
  id: string;
  label: string;
  completed: boolean;
};

type HabitItem = {
  id: string;
  label: string;
  streakLabel: string;
  previousLabel: string;
};

type DayEvent = {
  id: string;
  start: string;
  end?: string;
  label: string;
};

type SidebarNavItem = {
  id: string;
  icon: ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
};

type PulseEntry = {
  id: string;
  time: string;
  status: "stable" | "up" | "down";
  summary: string;
  focus: string;
};

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

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: "general", label: "General", icon: Gem },
  { id: "new-thread", label: "New Thread", icon: MessageSquarePlus },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, active: true },
  { id: "history", label: "History", icon: History },
];

const SIDEBAR_RAIL_ITEMS: SidebarNavItem[] = [
  { id: "search", label: "Search", icon: Search },
  ...SIDEBAR_ITEMS,
];

const SIDEBAR_HISTORY = [
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

const PULSE_SEED: PulseEntry[] = [
  {
    id: "pulse-1",
    time: "08:03",
    status: "stable",
    summary: "Daily stand-up cleared blockers in 11m.",
    focus: "Keep async channel velocity high.",
  },
  {
    id: "pulse-2",
    time: "12:17",
    status: "up",
    summary: "Momentum spike: proactivity +12% vs. yesterday.",
    focus: "Double-down on outbound builder outreach.",
  },
  {
    id: "pulse-3",
    time: "16:42",
    status: "down",
    summary: "Two tasks at risk; builder cohort waiting on guidance.",
    focus: "Reprioritize checklist items to protect streak.",
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
};

export default function GrayPageClient({
  initialTimestamp,
  viewerEmail,
}: GrayPageClientProps) {
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [pulseEntries] = useState<PulseEntry[]>(() =>
    PULSE_SEED.map((entry) => ({ ...entry }))
  );
  const [plans, setPlans] = useState<PlanItem[]>(() =>
    PLAN_SEED.map((plan) => ({ ...plan }))
  );
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [chatDraft, setChatDraft] = useState("");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

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

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.layout}>
          <aside
            className={styles.sidebar}
            data-expanded={isSidebarExpanded ? "true" : "false"}
          >
            <div className={styles.sidebarRail}>
              <button
                type="button"
                className={styles.sidebarRailLogo}
                aria-label="Open Gray Alignment sidebar"
                onClick={() => setIsSidebarExpanded(true)}
              >
                <Image
                  src="/grayaiwhitenotspinning.svg"
                  alt="Gray Alignment emblem"
                  width={24}
                  height={24}
                  priority
                />
              </button>
              <nav aria-label="Sidebar quick actions" className={styles.railNav}>
                <ul>
                  {SIDEBAR_RAIL_ITEMS.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-label={item.label}
                        data-active={item.active ? "true" : "false"}
                        onClick={() => setIsSidebarExpanded(true)}
                      >
                        <item.icon size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className={styles.sidebarRailFooter}>
                <button
                  type="button"
                  className={styles.sidebarRailAvatar}
                  aria-label="View operator profile"
                  onClick={() => setIsSidebarExpanded(true)}
                >
                  <Image
                    src="/astronauttest.jpg"
                    alt="Operator avatar"
                    width={32}
                    height={32}
                  />
                </button>
                <button
                  type="button"
                  className={styles.sidebarRailToggle}
                  aria-label={
                    isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
                  }
                  onClick={() =>
                    setIsSidebarExpanded((previous) => !previous)
                  }
                >
                  <ChevronsUp
                    size={18}
                    data-rotated={isSidebarExpanded ? "true" : "false"}
                  />
                </button>
              </div>
            </div>
            <div
              className={styles.sidebarPanel}
              data-expanded={isSidebarExpanded ? "true" : "false"}
            >
              <div className={styles.sidebarPanelContent}>
                <div className={styles.sidebarTop}>
                  <button
                    type="button"
                    className={styles.sidebarLogo}
                    aria-label="Collapse Gray Alignment sidebar"
                    onClick={() => setIsSidebarExpanded(false)}
                  >
                    <Image
                      src="/grayaiwhitenotspinning.svg"
                      alt="Gray Alignment emblem"
                      width={28}
                      height={28}
                      priority
                      className={styles.sidebarLogoImage}
                    />
                  </button>
                  <div className={styles.sidebarScroll}>
                    <div className={styles.searchRow}>
                      <span className={styles.searchIcon}>
                        <Search size={16} />
                      </span>
                      <span className={styles.searchLabel}>Search</span>
                      <span className={styles.searchShortcut}>CTRL+K</span>
                    </div>
                    <nav aria-label="Primary">
                      <ul className={styles.sidebarNav}>
                        {SIDEBAR_ITEMS.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              data-active={item.active ? "true" : "false"}
                              aria-label={item.label}
                            >
                              <span className={styles.navIcon}>
                                <item.icon size={18} />
                              </span>
                              <span className={styles.navLabel}>
                                {item.label}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </nav>
                    <div className={styles.sidebarHistory}>
                      {SIDEBAR_HISTORY.map((section) => (
                        <div
                          key={section.month}
                          className={styles.historySection}
                        >
                          <h3>{section.month}</h3>
                          <ul>
                            {section.entries.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button type="button" className={styles.sidebarProfile}>
                  <span className={styles.profileAvatar}>{viewerInitials}</span>
                  <span className={styles.profileDetails}>
                    <span>V. Stalingrady</span>
                    <span>Operator</span>
                  </span>
                  <ChevronDown size={16} className={styles.profileChevron} />
                </button>
              </div>
            </div>
          </aside>

          <div className={styles.main}>
            <header className={styles.header}>
              <div className={styles.timeGroup}>
                <span className={styles.time}>{formatClock(now)}</span>
                <span className={styles.date}>{formatDate(now)}</span>
              </div>
              <div className={styles.headerRight}>
                <div className={styles.streakBadge}>
                  <Flame size={12} />
                  <span>{String(streakCount).padStart(2, "0")} day streak</span>
                </div>
                <span className={styles.notificationChip}>
                  <Bell size={12} />
                  12
                </span>
              </div>
            </header>

            <h1 className={styles.greeting}>
              Good {greetingForDate(now)}, {viewerName}
            </h1>

            <section className={styles.mainGrid}>
              <div className={styles.primaryColumn}>
                <div className={styles.calendarCard}>
                  <header>Calendar</header>
                  <div className={styles.calendarBody}>
                    <ul className={styles.calendarHours}>
                      {HOURS.map((hour) => (
                        <li key={hour} className={styles.calendarHour}>
                          <span className={styles.calendarHourLabel}>
                            {formatHourLabel(hour)}
                          </span>
                          <span className={styles.calendarHourLine} />
                        </li>
                      ))}
                    </ul>
                    <div className={styles.eventList}>
                      {dayEvents.map((event) => (
                        <article key={event.id} className={styles.eventItem}>
                          <span className={styles.eventTime}>
                            {event.start}
                            {event.end ? ` — ${event.end}` : ""}
                          </span>
                          <p className={styles.eventLabel}>{event.label}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.pulseCard}>
                  <header>
                    <h2>Pulse</h2>
                  </header>
                  <div className={styles.pulseList}>
                    {pulseEntries.map((entry) => (
                      <article key={entry.id}>
                        <div className={styles.pulseHeader}>
                          <span>{entry.time}</span>
                          <PulseStatus status={entry.status} />
                        </div>
                        <p>{entry.summary}</p>
                        <span>{entry.focus}</span>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.secondaryColumn}>
                <div className={styles.planPanel}>
                  <div className={styles.tabBar}>
                    <button
                      type="button"
                      data-active={planTab === "plans"}
                      onClick={() => setPlanTab("plans")}
                    >
                      Plans
                    </button>
                    <button
                      type="button"
                      data-active={planTab === "habits"}
                      onClick={() => setPlanTab("habits")}
                    >
                      Habits
                    </button>
                  </div>
                  <div className={styles.planBody}>
                    {planTab === "plans" ? (
                      <>
                        <ul className={styles.planList}>
                          {plans.map((plan) => (
                            <li key={plan.id}>
                              <button
                                type="button"
                                data-completed={plan.completed}
                                onClick={() => togglePlan(plan.id)}
                              >
                                <span>
                                  {plan.completed ? (
                                    <CheckSquare size={16} />
                                  ) : (
                                    <Square size={16} />
                                  )}
                                </span>
                                <span>{plan.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button type="button" className={styles.secondaryAction}>
                          Add plans
                        </button>
                      </>
                    ) : (
                      <>
                        <ul className={styles.habitList}>
                          {HABIT_SEED.map((habit) => (
                            <li key={habit.id}>
                              <div>
                                <span>{habit.label}</span>
                                <span>{habit.previousLabel}</span>
                              </div>
                              <div>
                                <Flame size={12} />
                                <span>{habit.streakLabel}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <button type="button" className={styles.secondaryAction}>
                          Add habits
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <form className={styles.chatBar} onSubmit={handleChatSubmit}>
              <button
                type="button"
                className={styles.chatIconButton}
                aria-label="Add attachment"
              >
                <Plus size={18} />
              </button>
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Ask anything"
                className={styles.chatInput}
              />
              <div className={styles.chatActions}>
                <button
                  type="button"
                  className={styles.chatActionButton}
                  aria-label="Start voice note"
                >
                  <Mic size={18} />
                </button>
                <button
                  type="submit"
                  className={styles.chatActionButton}
                  aria-label="Send message"
                >
                  <AudioLines size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function PulseStatus({ status }: { status: PulseEntry["status"] }) {
  return (
    <span className={styles.pulseStatus} data-status={status}>
      {status === "up" ? "▲" : status === "down" ? "▼" : "◆"}
    </span>
  );
}
