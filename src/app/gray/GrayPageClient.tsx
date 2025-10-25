"use client";

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
  label: string;
  icon: ComponentType<{ size?: number }>;
  shortcut?: string;
  active?: boolean;
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
  { id: "search", label: "Search", icon: Search, shortcut: "CTRL+K" },
  { id: "general", label: "General", icon: Gem },
  { id: "new-thread", label: "New thread", icon: MessageSquarePlus },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    active: true,
  },
  { id: "history", label: "History", icon: History },
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
  const [plans, setPlans] = useState<PlanItem[]>(() =>
    PLAN_SEED.map((plan) => ({ ...plan }))
  );
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [chatDraft, setChatDraft] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

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
        <div className={styles.viewport}>
          <aside
            className={styles.sidebar}
            data-expanded={sidebarExpanded ? "true" : "false"}
          >
            <div className={styles.sidebarTop}>
              <button
                type="button"
                className={styles.logoButton}
                data-expanded={sidebarExpanded ? "true" : "false"}
                aria-label="Zenith dashboard"
              >
                <span className={styles.logoMark}>
                  <Gem size={16} />
                </span>
                <span className={styles.logoWordmark}>Zenith</span>
              </button>

              <nav className={styles.sidebarNav}>
                <ul>
                  {SIDEBAR_ITEMS.map((item) => (
                    <SidebarNavButton
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      shortcut={item.shortcut}
                      active={item.active}
                      expanded={sidebarExpanded}
                    />
                  ))}
                </ul>
              </nav>

              <div
                className={styles.sidebarHistory}
                data-expanded={sidebarExpanded ? "true" : "false"}
              >
                {SIDEBAR_HISTORY.map((section) => (
                  <div key={section.month} className={styles.historySection}>
                    <h3 className={styles.historyHeading}>{section.month}</h3>
                    <ul>
                      {section.entries.map((entry) => (
                        <li key={entry} className={styles.historyItem}>
                          {entry}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles.sidebarProfile}
              data-expanded={sidebarExpanded ? "true" : "false"}
              onClick={() => setSidebarExpanded((value) => !value)}
              aria-label="Toggle sidebar"
            >
              <span className={styles.profileAvatar}>{viewerInitials}</span>
              <span className={styles.profileMeta}>
                <span>V. Stalingrady</span>
                <span>Operator</span>
              </span>
              <ChevronDown size={16} className={styles.profileChevron} />
            </button>
          </aside>

          <div className={styles.content}>
            <header className={styles.header}>
              <div className={styles.headerTop}>
                <div className={styles.streakBadge}>
                  <Flame size={14} />
                  <span className={styles.streakValue}>
                    {String(streakCount).padStart(2, "0")}
                  </span>
                  <span className={styles.streakLabel}>Day streak</span>
                </div>
                <div className={styles.headerTopRight}>
                  <span className={styles.notificationChip}>
                    <Bell size={14} />
                    12
                  </span>
                  <span className={styles.avatar}>{viewerInitials}</span>
                </div>
              </div>
              <div className={styles.headerContent}>
                <div className={styles.clock}>{formatClock(now)}</div>
                <div className={styles.date}>{formatDate(now)}</div>
                <h1 className={styles.greeting}>
                  Good {greetingForDate(now)}, {viewerName}
                </h1>
              </div>
            </header>

            <section className={styles.main}>
              <div className={styles.calendarPanel}>
                <div className={styles.panelHeader}>Calendar</div>
                <div className={styles.calendarContent}>
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

              <div className={styles.plannerPanel}>
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
                <div className={styles.plannerBody}>
                  {planTab === "plans" ? (
                    <>
                      <h2 className={styles.sectionTitle}>Plans</h2>
                      <ul className={styles.planList}>
                        {plans.map((plan) => (
                          <li key={plan.id}>
                            <button
                              type="button"
                              className={styles.planButton}
                              data-completed={plan.completed}
                              onClick={() => togglePlan(plan.id)}
                            >
                              <span className={styles.planIcon}>
                                {plan.completed ? (
                                  <CheckSquare size={18} />
                                ) : (
                                  <Square size={18} />
                                )}
                              </span>
                              <span className={styles.planText}>
                                {plan.label}
                              </span>
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
                      <h2 className={styles.sectionTitle}>Habits</h2>
                      <ul className={styles.habitList}>
                        {HABIT_SEED.map((habit) => (
                          <li key={habit.id} className={styles.habitItem}>
                            <div className={styles.habitTexts}>
                              <span className={styles.habitLabel}>
                                {habit.label}
                              </span>
                              <span className={styles.habitPrevious}>
                                {habit.previousLabel}
                              </span>
                            </div>
                            <div className={styles.habitMeta}>
                              <Flame size={14} />
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

type SidebarNavButtonProps = {
  icon: ComponentType<{ size?: number }>;
  label: string;
  shortcut?: string;
  active?: boolean;
  expanded: boolean;
};

function SidebarNavButton({
  icon: Icon,
  label,
  shortcut,
  active,
  expanded,
}: SidebarNavButtonProps) {
  return (
    <li className={styles.navItem} data-active={active ? "true" : "false"}>
      <span className={styles.navIcon}>
        <Icon size={16} />
      </span>
      <span className={styles.navLabel} data-expanded={expanded ? "true" : "false"}>
        {label}
      </span>
      {shortcut && expanded ? (
        <span className={styles.navShortcut}>{shortcut}</span>
      ) : null}
    </li>
  );
}
