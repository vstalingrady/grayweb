"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  Music,
  Plus,
  Sparkles,
  Square,
  Sun,
} from "lucide-react";
import styles from "./GrayPageClient.module.css";

type PlanItem = {
  id: string;
  label: string;
  completed: boolean;
  emphasis?: boolean;
};

type HabitItem = {
  id: string;
  label: string;
  streak: number;
  goal: number;
};

type PulseEntry = {
  id: string;
  time: string;
  status: "stable" | "up" | "down";
  summary: string;
  focus: string;
};

type DayEvent = {
  id: string;
  start: string;
  end?: string;
  label: string;
};

type WeekEvent = {
  day: string;
  items: Array<{
    id: string;
    slot: string;
    label: string;
  }>;
};

type ChatMessage = {
  id: string;
  actor: "user" | "ai";
  content: string;
  timestamp: string;
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
    emphasis: true,
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
    label: "Nightly alignment recap",
    streak: 12,
    goal: 21,
  },
  {
    id: "habit-2",
    label: "Weekly builder sync",
    streak: 5,
    goal: 6,
  },
  {
    id: "habit-3",
    label: "Inbox zero sweep",
    streak: 3,
    goal: 5,
  },
];

const PULSE_SEED: PulseEntry[] = [
  {
    id: "pulse-1",
    time: "08:03",
    status: "stable",
    summary: "Daily stand-up aligned, blockers cleared in 11m.",
    focus: "Keep async channel velocity high.",
  },
  {
    id: "pulse-2",
    time: "12:17",
    status: "up",
    summary: "Momentum spike: proactivity score +12% vs. yesterday.",
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

const WEEK_EVENTS_SEED: WeekEvent[] = [
  {
    day: "Mon",
    items: [
      { id: "mon-1", slot: "08:00", label: "Builder sync" },
      { id: "mon-2", slot: "15:30", label: "Pulse QA slot" },
    ],
  },
  {
    day: "Tue",
    items: [{ id: "tue-1", slot: "09:00", label: "Ops triage" }],
  },
  {
    day: "Wed",
    items: [
      { id: "wed-1", slot: "10:30", label: "Streak retro" },
      { id: "wed-2", slot: "18:00", label: "Deep work block" },
    ],
  },
  {
    day: "Thu",
    items: [
      { id: "thu-1", slot: "08:30", label: "Builder office hours" },
      { id: "thu-2", slot: "14:00", label: "Product surface review" },
    ],
  },
  {
    day: "Fri",
    items: [
      { id: "fri-1", slot: "11:30", label: "Pulse shipping lab" },
      { id: "fri-2", slot: "16:00", label: "Team demo" },
    ],
  },
  {
    day: "Sat",
    items: [{ id: "sat-1", slot: "12:00", label: "Builder town hall" }],
  },
  {
    day: "Sun",
    items: [{ id: "sun-1", slot: "19:00", label: "Alignment recap" }],
  },
];

const CHAT_SEED: ChatMessage[] = [
  {
    id: "chat-1",
    actor: "ai",
    content:
      "Morning, Vstalin. Momentum is steady. Ready to shape today’s plans?",
    timestamp: "07:59",
  },
  {
    id: "chat-2",
    actor: "user",
    content: "Queue the builder outreach follow-up after the first sync.",
    timestamp: "08:01",
  },
];

const nameFromEmail = (email: string | null): string => {
  if (!email) {
    return "Vstalin Grady";
  }
  const [username] = email.split("@");
  if (!username) {
    return "Vstalin Grady";
  }

  const parts = username
    .replace(/[\d_-]+/g, " ")
    .split(/[.\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1));

  if (!parts.length) {
    return "Vstalin Grady";
  }

  if (parts.length === 1) {
    return `${parts[0]} Grady`;
  }

  return parts.join(" ");
};

const formatClock = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDate = (date: Date) =>
  date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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
  const [habits] = useState<HabitItem[]>(() =>
    HABIT_SEED.map((habit) => ({ ...habit }))
  );
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>(() =>
    PULSE_SEED.map((pulse) => ({ ...pulse }))
  );
  const [dayEvents] = useState<DayEvent[]>(() =>
    DAY_EVENTS_SEED.map((event) => ({ ...event }))
  );
  const [weekEvents] = useState<WeekEvent[]>(() =>
    WEEK_EVENTS_SEED.map((week) => ({
      day: week.day,
      items: week.items.map((item) => ({ ...item })),
    }))
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    CHAT_SEED.map((message) => ({ ...message }))
  );
  const [chatDraft, setChatDraft] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeSurface, setActiveSurface] = useState<"workspace" | "dashboard">(
    "workspace"
  );
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const [weekCursor, setWeekCursor] = useState(0);

  const viewerName = useMemo(
    () => nameFromEmail(viewerEmail),
    [viewerEmail]
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

  const streakCount = habits[0]?.streak ?? 12;

  const togglePlan = (id: string) => {
    setPlans((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const rotatePulse = () => {
    setPulseEntries((prev) => {
      if (prev.length < 2) {
        return prev;
      }
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  };

  const handleChatSend = () => {
    const draft = chatDraft.trim();
    if (!draft) {
      return;
    }

    const timestamp = formatClock(new Date());
    setChatMessages((prev) => [
      ...prev,
      { id: `chat-${prev.length + 1}`, actor: "user", content: draft, timestamp },
      {
        id: `chat-${prev.length + 2}`,
        actor: "ai",
        content:
          "Logged. Nudging the builder cohort and updating your proactivity streak.",
        timestamp,
      },
    ]);
    setChatDraft("");
    setIsChatOpen(true);
  };

  const cycleWeek = (direction: 1 | -1) => {
    setWeekCursor((prev) => (prev + direction + weekEvents.length) % weekEvents.length);
  };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <button className={styles.logo} type="button" aria-label="Gray home">
          <Sparkles size={20} />
        </button>
        <nav className={styles.sidebarNav} aria-label="Primary">
          <button
            className={styles.sidebarButton}
            type="button"
            data-active={activeSurface === "workspace"}
            onClick={() => setActiveSurface("workspace")}
          >
            <LayoutDashboard size={18} />
          </button>
          <button
            className={styles.sidebarButton}
            type="button"
            data-active={activeSurface === "dashboard"}
            onClick={() => setActiveSurface("dashboard")}
          >
            <LineChart size={18} />
          </button>
          <button
            className={styles.sidebarButton}
            type="button"
            data-active={isChatOpen}
            onClick={() => setIsChatOpen((value) => !value)}
          >
            <MessageCircle size={18} />
          </button>
          <button className={styles.sidebarButton} type="button">
            <CalendarDays size={18} />
          </button>
          <button className={styles.sidebarButton} type="button">
            <Music size={18} />
          </button>
        </nav>
        <div className={styles.sidebarFooter}>
          <button className={styles.sidebarButton} type="button">
            <Bell size={18} />
          </button>
          <button className={styles.profile} type="button">
            <Image
              src="/astronauttest.jpg"
              alt="Vstalin avatar"
              width={48}
              height={48}
              className={styles.profileAvatar}
              priority
            />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.backdrop} aria-hidden="true" />

        <header className={styles.header}>
          <div className={styles.streakBadge}>
            <CircleDot size={12} />
            <span>{String(streakCount).padStart(2, "0")}</span>
          </div>
          <div className={styles.headerCenter}>
            <div className={styles.clock}>{formatClock(now)}</div>
            <div className={styles.date}>{formatDate(now).toUpperCase()}</div>
          </div>
          <div className={styles.headerRight}>
            <Sun size={16} />
            <span>Day mode</span>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.greeting}>
            <h1>Good morning, {viewerName}</h1>
            <p>Your alignment session is live. Momentum is steady.</p>
          </div>
          <div className={styles.surfaceSwitch}>
            <button
              type="button"
              data-active={activeSurface === "workspace"}
              onClick={() => setActiveSurface("workspace")}
            >
              Workspace
            </button>
            <button
              type="button"
              data-active={activeSurface === "dashboard"}
              onClick={() => setActiveSurface("dashboard")}
            >
              Dashboard
            </button>
          </div>
        </section>

        {activeSurface === "workspace" ? (
          <section className={styles.workspaceSurface}>
            <div className={styles.calendarColumn}>
              <div className={styles.cardHeader}>
                <h2>Calendar</h2>
                <div className={styles.cardControls}>
                  <button type="button" onClick={() => cycleWeek(-1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" onClick={() => cycleWeek(1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.dayCalendar}>
                <ul className={styles.timeColumn}>
                  {Array.from({ length: 13 }).map((_, index) => {
                    const hour = index + 7;
                    const label =
                      hour <= 12
                        ? `${hour} ${hour === 12 ? "PM" : "AM"}`
                        : `${hour - 12} PM`;
                    return (
                      <li key={label} className={styles.timeRow}>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className={styles.eventColumn}>
                  {dayEvents.map((event) => (
                    <div key={event.id} className={styles.eventBlock}>
                      <span className={styles.eventTime}>
                        {event.start}
                        {event.end ? ` — ${event.end}` : ""}
                      </span>
                      <p>{event.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.planColumn}>
              <div className={styles.planSwitcher}>
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
                  <ul className={styles.planList}>
                    {plans.map((plan) => (
                      <li key={plan.id} data-completed={plan.completed}>
                        <label>
                          <input
                            type="checkbox"
                            checked={plan.completed}
                            onChange={() => togglePlan(plan.id)}
                          />
                          <span>{plan.label}</span>
                        </label>
                        {plan.emphasis && <span className={styles.tag}>Focus</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className={styles.habitList}>
                    {habits.map((habit) => (
                      <li key={habit.id}>
                        <div>
                          <CheckSquare size={14} />
                          <span>{habit.label}</span>
                        </div>
                        <span className={styles.habitStreak}>
                          {habit.streak}/{habit.goal}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button className={styles.secondaryButton} type="button">
                <PlusIcon /> Add {planTab === "plans" ? "plans" : "habit"}
              </button>

              <article className={styles.pulseCard}>
                <header>
                  <h2>Pulse</h2>
                  <button type="button" onClick={rotatePulse}>
                    <RefreshIcon />
                    Rotate
                  </button>
                </header>
                <div className={styles.pulseList}>
                  {pulseEntries.map((pulse) => (
                    <div key={pulse.id} className={styles.pulseRow}>
                      <div className={styles.pulseMeta}>
                        <span className={styles.pulseTime}>{pulse.time}</span>
                        <PulseStatus status={pulse.status} />
                      </div>
                      <div className={styles.pulseBody}>
                        <p>{pulse.summary}</p>
                        <span>{pulse.focus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        ) : (
          <section className={styles.dashboardSurface}>
            <div className={styles.dashboardCard}>
              <header>
                <h2>Pulse overview</h2>
                <span>Proactivity is trending steady.</span>
              </header>
              <div className={styles.dashboardPulse}>
                {pulseEntries.map((pulse) => (
                  <div key={pulse.id}>
                    <span>{pulse.time}</span>
                    <PulseStatus status={pulse.status} />
                    <p>{pulse.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.dashboardCard}>
              <header>
                <h2>Week calendar</h2>
                <div className={styles.cardControls}>
                  <button type="button" onClick={() => cycleWeek(-1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" onClick={() => cycleWeek(1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </header>

              <div className={styles.weekCalendar}>
                {weekEvents.map((day, index) => (
                  <div
                    key={day.day}
                    className={styles.weekColumn}
                    data-active={index === weekCursor}
                  >
                    <div className={styles.weekLabel}>{day.day}</div>
                    <ul>
                      {day.items.map((item) => (
                        <li key={item.id}>
                          <span>{item.slot}</span>
                          <p>{item.label}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <div className={styles.chatToggle}>
        <button type="button" onClick={() => setIsChatOpen((value) => !value)}>
          <MessageCircle size={18} />
          Ask anything
        </button>
      </div>

      <div className={styles.chatDrawer} data-open={isChatOpen}>
        <header>
          <div>
            <h3>Gray pulse</h3>
            <span>Autonomous alignment agent</span>
          </div>
          <button type="button" onClick={() => setIsChatOpen(false)}>
            Close
          </button>
        </header>
        <div className={styles.chatBody}>
          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={styles.chatMessage}
              data-actor={message.actor}
            >
              <p>{message.content}</p>
              <span>{message.timestamp}</span>
            </div>
          ))}
        </div>
        <form
          className={styles.chatComposer}
          onSubmit={(event) => {
            event.preventDefault();
            handleChatSend();
          }}
        >
          <input
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="Type to nudge your agent…"
          />
          <button type="submit" aria-label="Send message">
            <SendIcon />
          </button>
        </form>
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

function PlusIcon() {
  return <Plus size={14} strokeWidth={2} />;
}

function RefreshIcon() {
  return <Clock size={14} />;
}

function SendIcon() {
  return <Square size={16} />;
}
