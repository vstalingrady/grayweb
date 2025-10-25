import { useMemo } from "react";
import { CheckSquare, Square, Flame, Trash2, ChevronDown, Clock } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type ProactivityItem, type PulseEntry } from "./types";

type GrayDashboardViewProps = {
  pulseEntries: PulseEntry[];
  currentPulse: PulseEntry | null;
  isCurrentPulseEditable: boolean;
  onSelectPulse: (id: string) => void;
  proactivityFallback: ProactivityItem;
  dashboardDateLabel: string;
  onTogglePlan: (id: string) => void;
  activeTab: "pulse" | "calendar";
  onSelectTab: (tab: "pulse" | "calendar") => void;
  currentDate: Date;
  calendars: CalendarInfo[];
  onCalendarsChange: (calendars: CalendarInfo[]) => void;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
};

export function GrayDashboardView({
  pulseEntries,
  currentPulse,
  isCurrentPulseEditable,
  onSelectPulse,
  proactivityFallback,
  dashboardDateLabel,
  onTogglePlan,
  activeTab,
  onSelectTab,
  currentDate,
  calendars,
  onCalendarsChange,
  calendarEvents,
  onCalendarEventsChange,
}: GrayDashboardViewProps) {
  const displayPlans = currentPulse?.plans ?? [];
  const displayHabits = currentPulse?.habits ?? [];
  const displayProactivity = currentPulse?.proactivity ?? proactivityFallback;
  const activePulseId = currentPulse?.id ?? null;

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }),
    []
  );

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
      }),
    []
  );

  const longFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  const describePulseMeta = (entry: PulseEntry) => {
    const entryDate = new Date(entry.timestamp);
    entryDate.setHours(0, 0, 0, 0);
    const reference = new Date(currentDate);
    reference.setHours(0, 0, 0, 0);

    const diffDays = Math.round((reference.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return "Today";
    }
    if (diffDays === 1) {
      return "Yesterday";
    }
    if (diffDays > 1 && diffDays < 7) {
      return weekdayFormatter.format(entryDate);
    }
    if (reference.getFullYear() !== entryDate.getFullYear()) {
      return longFormatter.format(entryDate);
    }
    return dayFormatter.format(entryDate);
  };

  const handlePlanToggle = (planId: string) => {
    if (!isCurrentPulseEditable) {
      return;
    }
    onTogglePlan(planId);
  };

  const hasPulseData = Boolean(currentPulse);
  const showPlansList = displayPlans.length > 0;
  const showHabitsList = displayHabits.length > 0;

  return (
    <>
      <div className={styles.dashboardHeaderRow}>
        <div className={styles.dashboardHeaderLeft}>
          <h1 className={styles.dashboardHeadline}>Dashboard</h1>
        </div>
        <div className={styles.dashboardHeaderRight}>
          <div className={styles.dashboardToggle}>
            <button
              type="button"
              data-active={activeTab === "pulse"}
              aria-pressed={activeTab === "pulse"}
              onClick={() => onSelectTab("pulse")}
            >
              Pulse
            </button>
            <button
              type="button"
              data-active={activeTab === "calendar"}
              aria-pressed={activeTab === "calendar"}
              onClick={() => onSelectTab("calendar")}
            >
              Calendar
            </button>
          </div>
          <span className={styles.dashboardDate}>{dashboardDateLabel}</span>
        </div>
      </div>

      {activeTab === "pulse" ? (
        hasPulseData ? (
          <>
            <div className={styles.pulseHistoryBar}>
              <div className={styles.pulseHistoryRail} role="tablist" aria-label="Daily pulse history">
                {pulseEntries.map((entry) => {
                  const isActive = entry.id === activePulseId;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={styles.pulseHistoryItem}
                      data-active={isActive ? "true" : "false"}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => onSelectPulse(entry.id)}
                    >
                      <span className={styles.pulseHistoryItemPrimary}>
                        {dayFormatter.format(new Date(entry.timestamp))}
                      </span>
                      <span className={styles.pulseHistoryItemMeta}>{describePulseMeta(entry)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <section className={styles.dashboardGrid}>
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
                              <span className={styles.planLabel}>{plan.label}</span>
                            </button>
                          </li>
                        ))
                      : null}
                  </ul>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    disabled={!isCurrentPulseEditable}
                    data-disabled={!isCurrentPulseEditable ? "true" : "false"}
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
                      : null}
                  </ul>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    disabled={!isCurrentPulseEditable}
                    data-disabled={!isCurrentPulseEditable ? "true" : "false"}
                  >
                    Add habits
                  </button>
                </div>
              </article>

              <article className={`${styles.dashboardCard} ${styles.proactivityCard}`}>
                <header className={styles.dashboardCardHeader}>
                  <span>Proactivity</span>
                </header>
                <div className={styles.dashboardCardBody}>
                  <div className={styles.proactivityHeader}>
                    <div>
                      <div className={styles.proactivityTitle}>
                        <CheckSquare size={16} />
                        <span>{displayProactivity?.label ?? "—"}</span>
                      </div>
                      <p>{displayProactivity?.description ?? ""}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Remove proactivity item"
                      disabled={!isCurrentPulseEditable}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className={styles.proactivityControls}>
                    <label>
                      <span>Cadence</span>
                      <div className={styles.dashboardSelect}>
                        <span>{displayProactivity?.cadence ?? "Daily"}</span>
                        <ChevronDown size={14} />
                      </div>
                    </label>
                    <label>
                      <span>Time</span>
                      <div className={styles.dashboardSelect}>
                        <Clock size={14} />
                        <span>{displayProactivity?.time ?? "09:00 AM"}</span>
                      </div>
                    </label>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    disabled={!isCurrentPulseEditable}
                    data-disabled={!isCurrentPulseEditable ? "true" : "false"}
                  >
                    Add proactivity
                  </button>
                </div>
              </article>
            </section>
          </>
        ) : (
          <div className={styles.pulseEmptyState}>
            <p>No pulse data yet. Start by creating plans or habits for today.</p>
          </div>
        )
      ) : (
        <GrayDashboardCalendar
          initialDate={currentDate}
          showSidebar={true}
          calendars={calendars}
          events={calendarEvents}
          onCalendarsChange={onCalendarsChange}
          onEventsChange={onCalendarEventsChange}
        />
      )}
    </>
  );
}
