"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AudioLines, Flame, Mic, Plus, RefreshCw } from "lucide-react";
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

const formatClock = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDate = (date: Date) =>
  date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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

const viewerNameFromEmail = (email: string | null): string => {
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
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>(() =>
    PULSE_SEED.map((pulse) => ({ ...pulse }))
  );
  const [dayEvents] = useState<DayEvent[]>(() =>
    DAY_EVENTS_SEED.map((event) => ({ ...event }))
  );
  const [chatDraft, setChatDraft] = useState("");

  const viewerName = useMemo(
    () => viewerNameFromEmail(viewerEmail),
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

  const streakCount = 12;

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
      <div className={styles.container}>
        <section className={styles.header}>
          <div className={styles.streakBadge}>
            <Flame size={14} />
            <span className={styles.streakValue}>
              {String(streakCount).padStart(2, "0")}
            </span>
            <span className={styles.streakLabel}>Day streak</span>
          </div>
          <div className={styles.timeRow}>
            <div className={styles.clock}>{formatClock(now)}</div>
            <div className={styles.date}>{formatDate(now).toUpperCase()}</div>
          </div>
          <h1 className={styles.greeting}>
            Good {greetingForDate(now)}, {viewerName}
          </h1>
        </section>

        <section className={styles.main}>
          <div className={styles.calendarCard}>
            <header>Calendar</header>
            <div className={styles.calendarBody}>
              <ul className={styles.timeColumn}>
                {Array.from({ length: 13 }).map((_, index) => {
                  const hour = index + 7;
                  const label =
                    hour <= 12
                      ? `${hour} ${hour === 12 ? "PM" : "AM"}`
                      : `${hour - 12} PM`;
                  return (
                    <li key={label}>
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

          <div className={styles.sideColumn}>
            <div className={styles.planCard}>
              <div className={styles.planTabs}>
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
              {planTab === "plans" ? (
                <div className={styles.planBody}>
                  <h2>Plans</h2>
                  <ul>
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
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.secondaryButton}>
                    Add plans
                  </button>
                </div>
              ) : (
                <div className={styles.habitBody}>
                  <h2>Habits</h2>
                  <ul>
                    {HABIT_SEED.map((habit) => (
                      <li key={habit.id}>
                        <div>
                          <span>{habit.label}</span>
                          <span>{habit.previousLabel}</span>
                        </div>
                        <div className={styles.habitMeta}>
                          <Flame size={14} />
                          <span>{habit.streakLabel}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.secondaryButton}>
                    Add habits
                  </button>
                </div>
              )}
            </div>

            <div className={styles.pulseCard}>
              <header>
                <h2>Pulse</h2>
                <button type="button" onClick={rotatePulse}>
                  <RefreshCw size={14} />
                  Rotate
                </button>
              </header>
              <div className={styles.pulseBody}>
                {pulseEntries.map((pulse) => (
                  <article key={pulse.id}>
                    <div className={styles.pulseMeta}>
                      <span className={styles.pulseTime}>{pulse.time}</span>
                      <PulseStatus status={pulse.status} />
                    </div>
                    <p>{pulse.summary}</p>
                    <span>{pulse.focus}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

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
        />
        <div className={styles.chatActions}>
          <button type="button" aria-label="Start voice note">
            <Mic size={18} />
          </button>
          <button type="submit" aria-label="Send message">
            <AudioLines size={18} />
          </button>
        </div>
      </form>
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
