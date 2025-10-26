import { useMemo, useCallback, useState, useEffect, type CSSProperties } from "react";
import { CheckSquare, Square, Flame, Trash2, ChevronDown, Clock } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type ProactivityItem, type PulseEntry } from "./types";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";

const CALENDAR_PANEL_MAX_HEIGHT = "min(900px, calc(100vh - 150px))";
const CALENDAR_PANEL_HOUR_HEIGHT = 62;
const DASHBOARD_PANEL_SIZING_STYLE = {
  "--calendar-max-height": CALENDAR_PANEL_MAX_HEIGHT,
} as CSSProperties & { [key: string]: string | number };

const startOfWeek = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

type GrayDashboardViewProps = {
  pulseEntries: PulseEntry[];
  currentPulse: PulseEntry | null;
  isCurrentPulseEditable: boolean;
  onSelectPulse: (id: string) => void;
  proactivityFallback: ProactivityItem;
  onTogglePlan: (id: string) => void;
  onToggleHabit?: (id: string) => void;
  onEditPlan?: (plan: { id: string; label: string; completed: boolean }) => void;
  onDeletePlan?: (plan: { id: string; label: string; completed: boolean }) => void;
  activeTab: "pulse" | "calendar";
  onSelectTab: (tab: "pulse" | "calendar") => void;
  currentDate: Date;
  calendars: CalendarInfo[];
  onCalendarsChange: (calendars: CalendarInfo[]) => void;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
  onEditHabit?: (habit: { id: string; label: string; previousLabel: string; streakLabel: string }) => void;
  onDeleteHabit?: (habit: { id: string; label: string; previousLabel: string; streakLabel: string }) => void;
  onIntegrationAction?: () => void;
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
  onIntegrationAction,
}: GrayDashboardViewProps) {
  const hasPulseData = Boolean(currentPulse && pulseEntries.length > 0);
  const displayPlans = hasPulseData ? currentPulse?.plans ?? [] : [];
  const displayHabits = hasPulseData ? currentPulse?.habits ?? [] : [];
  const displayProactivity = hasPulseData ? currentPulse?.proactivity ?? proactivityFallback : null;
  const activePulseId = hasPulseData ? currentPulse?.id ?? null : null;
  const [pulseSelectedDate, setPulseSelectedDate] = useState<Date>(() => new Date(currentDate));
  const [pulseMonthDate, setPulseMonthDate] = useState<Date>(() => new Date(currentDate));

  const pulseEntriesByDate = useMemo(() => {
    const map = new Map<string, PulseEntry>();
    pulseEntries.forEach((entry) => {
      map.set(entry.dateKey, entry);
    });
    return map;
  }, [pulseEntries]);

  useEffect(() => {
    setPulseSelectedDate(new Date(currentDate));
    setPulseMonthDate(new Date(currentDate));
  }, [currentDate]);

  const handlePulseDateSelect = useCallback(
    (nextDate: Date) => {
      setPulseSelectedDate(nextDate);
      setPulseMonthDate(nextDate);
      const key = toDateKey(nextDate);
      const matchingEntry = pulseEntriesByDate.get(key);
      if (matchingEntry) {
        onSelectPulse(matchingEntry.id);
      }
    },
    [onSelectPulse, pulseEntriesByDate]
  );

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

  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
      }),
    []
  );

  const rangeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
      }),
    []
  );

  const pulseMonthLabel = monthFormatter.format(pulseSelectedDate);
  const pulseWeekAnchor = useMemo(() => startOfWeek(pulseSelectedDate), [pulseSelectedDate]);

  const pulseWeekRangeLabel = useMemo(() => {
    const end = new Date(pulseWeekAnchor);
    end.setDate(pulseWeekAnchor.getDate() + 6);
    const startLabel = rangeFormatter.format(pulseWeekAnchor);
    const endLabel = rangeFormatter.format(end);
    return `${startLabel} — ${endLabel}, ${end.getFullYear()}`;
  }, [pulseWeekAnchor, rangeFormatter]);

  const pulseWeekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(pulseWeekAnchor);
        day.setDate(pulseWeekAnchor.getDate() + index);
        return day;
      }),
    [pulseWeekAnchor]
  );

  const todayReference = useMemo(() => {
    const now = new Date(currentDate);
    now.setHours(0, 0, 0, 0);
    return now;
  }, [currentDate]);

  const handlePulseWeekNavigate = useCallback(
    (offset: number) => {
      const next = new Date(pulseSelectedDate);
      next.setDate(pulseSelectedDate.getDate() + offset * 7);
      handlePulseDateSelect(next);
    },
    [handlePulseDateSelect, pulseSelectedDate]
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
        <div className={styles.dashboardCalendarContainer}>
          <div
            className={styles.dashboardCalendarShell}
            style={DASHBOARD_PANEL_SIZING_STYLE}
          >
            <div className={styles.dashboardCalendarSurface}>
              <header className={`${calendarStyles.calendarSurfaceHeader} ${styles.pulseSurfaceHeader}`}>
                <div className={calendarStyles.calendarSurfaceHeaderLeft}>
                  <span className={calendarStyles.calendarSurfaceLabel}>Pulse</span>
                  <div>
                    <h2 className={calendarStyles.calendarSurfaceTitle}>
                      {pulseMonthLabel}
                    </h2>
                    <p className={calendarStyles.calendarSurfaceRange}>{pulseWeekRangeLabel}</p>
                  </div>
                </div>
                <div className={calendarStyles.calendarSurfaceHeaderRight}>
                  <div className={calendarStyles.calendarSurfaceNav}>
                    <div className={calendarStyles.calendarSurfaceNavArrows}>
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => handlePulseMonthNavigate(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => handlePulseMonthNavigate(1)}
                      >
                        ›
                      </button>
                    </div>
                    <div className={calendarStyles.calendarSurfaceNavArrows}>
                      <button
                        type="button"
                        aria-label="Previous week"
                        onClick={() => handlePulseWeekNavigate(-1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label="Next week"
                        onClick={() => handlePulseWeekNavigate(1)}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
              </header>
              <div
                className={calendarStyles.calendarSurfaceBody}
                data-has-sidebar="true"
              >
                <div className={calendarStyles.calendarSidebarPanel}>
                  <CalendarSidebar
                    monthDate={pulseMonthDate}
                    selectedDate={pulseSelectedDate}
                    onSelectDate={handlePulseDateSelect}
                    onNavigateMonth={handlePulseMonthNavigate}
                    calendars={calendars}
                    onToggleCalendar={handleCalendarVisibilityToggle}
                    showSelectedDateLabel={false}
                    className={calendarStyles.calendarSidebarIntegrated}
                    showCalendarList={false}
                    showCreateAction={false}
                    showMonthNavigation={false}
                    onIntegrationAction={onIntegrationAction}
                  >
                    <div className={styles.calendarSidebarExtras}>
                      <article
                        className={`${styles.dashboardCard} ${styles.proactivityCard} ${styles.sidebarProactivityCard}`}
                      >
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
                    </div>
                  </CalendarSidebar>
                </div>
                <div className={`${calendarStyles.calendarBoard} ${styles.pulseBoard}`}>
                  <div className={calendarStyles.calendarGrid}>
                    <div className={calendarStyles.calendarHeaderRow}>
                      <div className={calendarStyles.calendarHeaderPlaceholder} />
                      {pulseWeekDays.map((day) => {
                        const isSelectedDay = isSameDay(day, pulseSelectedDate);
                        const isToday = isSameDay(day, todayReference);
                        return (
                          <div
                            key={day.toISOString()}
                            className={calendarStyles.calendarHeaderCell}
                            data-selected={isSelectedDay ? "true" : "false"}
                            data-today={isToday ? "true" : "false"}
                            role="button"
                            tabIndex={0}
                            onClick={() => handlePulseDateSelect(day)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handlePulseDateSelect(day);
                              }
                            }}
                          >
                            <span>{weekdayFormatter.format(day)}</span>
                            <strong>{day.getDate()}</strong>
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.pulseBoardContent}>
                      <section className={`${styles.dashboardGrid} ${styles.pulseGridStacked}`}>
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

                      </section>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            onIntegrationAction={onIntegrationAction}
          />
        </div>
      )}
    </>
  );
}
