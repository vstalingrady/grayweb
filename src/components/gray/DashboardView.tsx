import { useMemo, useCallback, useState, useEffect } from "react";
import { CheckSquare, Square, Flame, Trash2, ChevronDown, Clock } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type ProactivityItem, type PulseEntry } from "./types";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";

const CALENDAR_PANEL_MAX_HEIGHT = "min(900px, calc(100vh - 150px))";
const CALENDAR_PANEL_HOUR_HEIGHT = 62;

type GrayDashboardViewProps = {
  pulseEntries: PulseEntry[];
  currentPulse: PulseEntry | null;
  isCurrentPulseEditable: boolean;
  onSelectPulse: (id: string) => void;
  proactivityFallback: ProactivityItem;
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
  onTogglePlan,
  activeTab,
  onSelectTab,
  currentDate,
  calendars,
  onCalendarsChange,
  calendarEvents,
  onCalendarEventsChange,
}: GrayDashboardViewProps) {
  const hasPulseData = Boolean(currentPulse && pulseEntries.length > 0);
  const displayPlans = hasPulseData ? currentPulse?.plans ?? [] : [];
  const displayHabits = hasPulseData ? currentPulse?.habits ?? [] : [];
  const displayProactivity = hasPulseData ? currentPulse?.proactivity ?? proactivityFallback : null;
  const activePulseId = hasPulseData ? currentPulse?.id ?? null : null;
  const [pulseSelectedDate, setPulseSelectedDate] = useState<Date>(() => new Date(currentDate));
  const [pulseMonthDate, setPulseMonthDate] = useState<Date>(() => new Date(currentDate));

  useEffect(() => {
    setPulseSelectedDate(new Date(currentDate));
    setPulseMonthDate(new Date(currentDate));
  }, [currentDate]);

  const handlePulseDateSelect = useCallback((nextDate: Date) => {
    setPulseSelectedDate(nextDate);
    setPulseMonthDate(nextDate);
  }, []);

  const handlePulseMonthNavigate = useCallback((offset: number) => {
    setPulseMonthDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + offset);
      return next;
    });
  }, []);

  const handleCalendarVisibilityToggle = useCallback(
    (calendarId: string) => {
      onCalendarsChange(
        calendars.map((calendar) =>
          calendar.id === calendarId
            ? { ...calendar, isVisible: !calendar.isVisible }
            : calendar
        )
      );
    },
    [calendars, onCalendarsChange]
  );

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
        </div>
      </div>

      {activeTab === "pulse" ? (
        <div className={styles.dashboardPulseSurface}>
          <div className={styles.dashboardPulseLayout}>
            <aside className={styles.dashboardSidebarColumn}>
              {hasPulseData ? (
                <CalendarSidebar
                  monthDate={pulseMonthDate}
                  selectedDate={pulseSelectedDate}
                  onSelectDate={handlePulseDateSelect}
                  onNavigateMonth={handlePulseMonthNavigate}
                  calendars={calendars}
                  onToggleCalendar={handleCalendarVisibilityToggle}
                  showSelectedDateLabel={false}
                  showCreateAction={false}
                  className={styles.pulseSidebarIntegrated}
                />
              ) : (
                <div className={`${calendarStyles.calendarSidebar} ${styles.pulseCreateCard}`}>
                  <div className={styles.pulseCreateContent}>
                    <span className={styles.pulseCreateEyebrow}>Today</span>
                    <h3>Create your first pulse</h3>
                    <p>
                      Capture today&apos;s plans and habits to track your momentum. Add items and see them
                      reflected across your calendar.
                    </p>
                    <button
                      type="button"
                      className={styles.pulseCreateAction}
                      disabled={!isCurrentPulseEditable}
                    >
                      Start a pulse
                    </button>
                  </div>
                </div>
              )}
            </aside>
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
                      : (
                        <li className={styles.listEmptyMessage}>
                          <span>No plans captured yet.</span>
                        </li>
                      )}
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
                      : (
                        <li className={styles.listEmptyMessage}>
                          <span>No habits tracked yet.</span>
                        </li>
                      )}
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
                    {displayProactivity ? (
                      <>
                        <div className={styles.proactivityHeader}>
                          <div>
                            <div className={styles.proactivityTitle}>
                              <CheckSquare size={16} />
                              <span>{displayProactivity.label}</span>
                            </div>
                            <p>{displayProactivity.description}</p>
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
                              <span>{displayProactivity.cadence ?? "Daily"}</span>
                              <ChevronDown size={14} />
                            </div>
                          </label>
                          <label>
                            <span>Time</span>
                            <div className={styles.dashboardSelect}>
                              <Clock size={14} />
                              <span>{displayProactivity.time ?? "09:00 AM"}</span>
                            </div>
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className={styles.cardEmptyMessage}>
                        <span>No proactivity focus set yet.</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      disabled={!isCurrentPulseEditable}
                      data-disabled={!isCurrentPulseEditable ? "true" : "false"}
                    >
                      {displayProactivity ? "Update proactivity" : "Add proactivity"}
                    </button>
                  </div>
                </article>
              </section>
            </div>
          </div>
      ) : (
        <div className={styles.dashboardCalendarContainer}>
          <GrayDashboardCalendar
            initialDate={currentDate}
            showSidebar={true}
            calendars={calendars}
            events={calendarEvents}
            onCalendarsChange={onCalendarsChange}
            onEventsChange={onCalendarEventsChange}
            showSelectedDateLabel={false}
            className={styles.dashboardCalendarAligned}
            surfaceClassName={styles.dashboardCalendarSurface}
            maxHeight={CALENDAR_PANEL_MAX_HEIGHT}
            hourHeight={CALENDAR_PANEL_HOUR_HEIGHT}
          />
        </div>
      )}
    </>
  );
}
