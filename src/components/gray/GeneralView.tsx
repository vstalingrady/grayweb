import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Square, Zap, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { AddPlanHabitModal } from "./AddPlanHabitModal";
import { type HabitItem, type PlanItem, type PlanUpdates, type ProactivityItem } from "./types";
import { useI18n } from "@/contexts/I18nContext";
import { MiniMonth } from "@/components/calendar/MiniMonth";

const DEFAULT_PROACTIVITY_TIME = "09:00";
const FREQUENT_PROACTIVITY_TIMES = ["09:00", "12:00", "18:00"] as const;
const DAILY_PROACTIVITY_TIME_PRESETS = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"] as const;

type ProactivityMode = "off" | "daily" | "frequent";
type TasksTab = "plans" | "habits";

const resolveProactivityMode = (proactivity: ProactivityItem | null): ProactivityMode => {
  if (!proactivity) {
    return "off";
  }
  const cadence = proactivity.cadence?.trim().toLowerCase();
  if (cadence === "frequent") {
    return "frequent";
  }
  return "daily";
};

type GrayGeneralViewProps = {
  greeting: string;
  currentDate: Date;
  plans: PlanItem[];
  habits: HabitItem[];
  proactivity: ProactivityItem | null;
  onSelectProactivity: (next: ProactivityItem) => void;
  onRemoveProactivity: () => void;
  onTogglePlan: (id: string) => void;
  onToggleHabit: (id: string) => void;
  onSavePlan: (planId: string, updates: PlanUpdates) => Promise<void> | void;
  onDeletePlan: (plan: PlanItem) => void;
  onEditHabit: (habit: HabitItem) => void;
  onDeleteHabit: (habit: HabitItem) => void;
  onRefreshData: () => Promise<void>;
  showGreeting?: boolean;
  hidePlans?: boolean;
};

export function GrayGeneralView({
  greeting,
  currentDate,
  plans,
  habits,
  proactivity,
  onSelectProactivity,
  onRemoveProactivity,
  onTogglePlan,
  onToggleHabit,
  onSavePlan,
  onDeletePlan,
  onEditHabit,
  onDeleteHabit,
  onRefreshData,
  showGreeting = true,
  hidePlans = false,
}: GrayGeneralViewProps) {
  const { t } = useI18n();
  const formatTimeLabel = useMemo(() => {
    return (value: string) => {
      const [hoursString, minutesString] = value.split(":");
      const hours = Number.parseInt(hoursString ?? "", 10);
      const minutes = Number.parseInt(minutesString ?? "", 10);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return value;
      }
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };
  }, []);
  const [calendarReferenceDate, setCalendarReferenceDate] = useState(() => {
    const base = new Date(currentDate);
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => {
    const base = new Date(currentDate);
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: "plan" | "habit" | null }>({
    isOpen: false,
    type: null,
  });
  const [planEditorTarget, setPlanEditorTarget] = useState<PlanItem | null>(null);
  const proactivityMode = resolveProactivityMode(proactivity);
  const [dailyTime, setDailyTime] = useState(() => proactivity?.time ?? DEFAULT_PROACTIVITY_TIME);
  const [tasksTab, setTasksTab] = useState<TasksTab>("plans");

  const calendarMonthLabel = useMemo(
    () =>
      calendarReferenceDate.toLocaleDateString([], {
        month: "long",
        year: "numeric",
      }),
    [calendarReferenceDate]
  );

  const shiftCalendarMonth = (delta: number) => {
    setCalendarReferenceDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + delta, 1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  useEffect(() => {
    if (proactivityMode !== "daily") {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDailyTime((previous) => {
      const next = proactivity?.time ?? DEFAULT_PROACTIVITY_TIME;
      return previous === next ? previous : next;
    });
  }, [proactivity?.time, proactivityMode]);

  const openModal = (type: "plan" | "habit") => {
    setModalState({ isOpen: true, type });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null });
  };

  const handleModalSuccess = async () => {
    // Trigger a refresh of the data
    await onRefreshData();
  };

  const applyProactivity = (nextMode: ProactivityMode, overrideTime?: string) => {
    if (nextMode === "off") {
      onRemoveProactivity();
      return;
    }

    const base: ProactivityItem = proactivity ?? {
      id: "proactivity-daily",
      label: "Check-ins",
      description: "Daily guided check-ins from Gray.",
      cadence: "Daily",
      time: DEFAULT_PROACTIVITY_TIME,
      times: [DEFAULT_PROACTIVITY_TIME],
      channels: ["assistant"],
      timezone: null,
    };

    if (nextMode === "frequent") {
      const nextTimes =
        proactivity?.times && proactivity.times.length > 1 ? proactivity.times : [...FREQUENT_PROACTIVITY_TIMES];
      onSelectProactivity({
        ...base,
        cadence: "Frequent",
        time: nextTimes[0] ?? DEFAULT_PROACTIVITY_TIME,
        times: nextTimes,
      });
      return;
    }

    const nextTime = overrideTime ?? dailyTime ?? DEFAULT_PROACTIVITY_TIME;
    onSelectProactivity({
      ...base,
      cadence: "Daily",
      time: nextTime,
      times: [nextTime],
    });
  };

  const plansContent = (
    <>
      <ul className={styles.planList}>
        {plans.length ? (
          plans.map((plan) => (
            <li key={plan.id} className={styles.planListItem}>
              <div className={styles.planItemButton} data-completed={plan.completed ? "true" : "false"} role="group">
                <button
                  type="button"
                  className={styles.planCheckboxButton}
                  aria-label={plan.completed ? t("Mark plan as incomplete") : t("Mark plan as complete")}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onTogglePlan(plan.id);
                  }}
                >
                  <span className={styles.planCheckbox} aria-hidden="true">
                    {plan.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                </button>
                <span className={styles.planLabelGroup}>
                  <span className={styles.planLabel}>{plan.label}</span>
                </span>
              </div>
              <span className={styles.listItemActions}>
                <button
                  type="button"
                  className={styles.listItemActionButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setPlanEditorTarget(plan);
                  }}
                  aria-label={t("Edit plan {label}", { label: plan.label })}
                  disabled={!onSavePlan}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className={styles.listItemActionButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeletePlan(plan);
                  }}
                  aria-label={t("Delete plan {label}", { label: plan.label })}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))
        ) : (
          <li className={styles.listEmptyMessage}>
            <span>{t("No plans captured yet.")}</span>
          </li>
        )}
      </ul>
      <button type="button" className={styles.secondaryAction} onClick={() => openModal("plan")}>
        {t("Add plans")}
      </button>
    </>
  );

  const habitsContent = (
    <>
      <ul className={styles.habitList}>
        {habits.length ? (
          habits.map((habit) => (
            <li key={habit.id} className={styles.habitListItem}>
              <div className={styles.planItemButton} data-completed={habit.completed ? "true" : "false"} role="group">
                <button
                  type="button"
                  className={styles.planCheckboxButton}
                  aria-label={habit.completed ? t("Mark habit as incomplete") : t("Mark habit as complete")}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleHabit(habit.id);
                  }}
                >
                  <span className={styles.planCheckbox} aria-hidden="true">
                    {habit.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                </button>
                <span className={styles.habitContent}>
                  <span className={styles.habitLabel}>{habit.label}</span>
                </span>
              </div>
              <span className={styles.habitRightSection}>
                <span className={styles.listItemActions}>
                  <button
                    type="button"
                    className={styles.listItemActionButton}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onEditHabit(habit);
                    }}
                    aria-label={t("Edit habit {label}", { label: habit.label })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.listItemActionButton}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteHabit(habit);
                    }}
                    aria-label={t("Delete habit {label}", { label: habit.label })}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
                <span className={styles.habitStreak}>
                  <Zap size={12} aria-hidden="true" />
                  <span>{habit.streakLabel}</span>
                </span>
              </span>
            </li>
          ))
        ) : (
          <li className={styles.listEmptyMessage}>
            <span>{t("No habits tracked yet.")}</span>
          </li>
        )}
      </ul>
      <button type="button" className={styles.secondaryAction} onClick={() => openModal("habit")}>
        {t("Add habits")}
      </button>
    </>
  );

  const tasksCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <div className={styles.dashboardTasksToggle} role="tablist" aria-label={t("Switch tasks view")}>
          <button
            type="button"
            className={styles.dashboardTasksToggleButton}
            role="tab"
            aria-selected={tasksTab === "plans"}
            data-active={tasksTab === "plans" ? "true" : "false"}
            onClick={() => setTasksTab("plans")}
          >
            {t("Plans")}
          </button>
          <button
            type="button"
            className={styles.dashboardTasksToggleButton}
            role="tab"
            aria-selected={tasksTab === "habits"}
            data-active={tasksTab === "habits" ? "true" : "false"}
            onClick={() => setTasksTab("habits")}
          >
            {t("Habits")}
          </button>
        </div>
      </header>
      <div className={styles.dashboardCardBody}>{tasksTab === "plans" ? plansContent : habitsContent}</div>
    </article>
  );

  const proactivityTimeLabels = useMemo(() => {
    if (!proactivity) {
      return [];
    }
    const times = (proactivity.times ?? []).length ? proactivity.times ?? [] : [proactivity.time];
    return times.filter(Boolean).map((value) => formatTimeLabel(value));
  }, [formatTimeLabel, proactivity]);

  const proactivityTimesLabel = useMemo(() => {
    if (!proactivity) {
      return t("Turn on to schedule check-ins.");
    }
    if (proactivityTimeLabels.length === 0) {
      return t("On");
    }
    return proactivityTimeLabels.join(" · ");
  }, [proactivity, proactivityTimeLabels, t]);

  const dailyTimeOptions = useMemo(() => {
    const presets = [...DAILY_PROACTIVITY_TIME_PRESETS] as string[];
    if (dailyTime && !presets.includes(dailyTime)) {
      presets.push(dailyTime);
    }
    return Array.from(new Set(presets)).sort();
  }, [dailyTime]);

  const calendarCard = (
    <article className={`${styles.dashboardCard} ${styles.miniCalendarCard}`}>
      <header className={styles.dashboardCardHeader}>
        <span className={styles.miniCalendarHeader}>
          <span className={styles.miniCalendarMonthLabel}>{calendarMonthLabel}</span>
          <span className={styles.miniCalendarHeaderControls}>
            <button
              type="button"
              className={styles.miniCalendarNavButton}
              aria-label={t("Previous")}
              title={t("Go to previous month")}
              onClick={() => shiftCalendarMonth(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={styles.miniCalendarNavButton}
              aria-label={t("Next")}
              title={t("Go to next month")}
              onClick={() => shiftCalendarMonth(1)}
            >
              <ChevronRight size={14} />
            </button>
          </span>
        </span>
      </header>
      <div className={`${styles.dashboardCardBody} ${styles.miniCalendarBody}`}>
        <div className={styles.miniCalendarCompact}>
          <MiniMonth
            referenceDate={calendarReferenceDate}
            selectedDate={calendarSelectedDate}
            onSelectDate={(nextDate) => {
              setCalendarSelectedDate(nextDate);
              if (
                nextDate.getMonth() !== calendarReferenceDate.getMonth() ||
                nextDate.getFullYear() !== calendarReferenceDate.getFullYear()
              ) {
                const nextReference = new Date(nextDate);
                nextReference.setDate(1);
                nextReference.setHours(0, 0, 0, 0);
                setCalendarReferenceDate(nextReference);
              }
            }}
          />
        </div>
      </div>
    </article>
  );

  const proactivityCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <span>{t("Proactivity")}</span>
      </header>
      <div className={styles.dashboardCardBody}>
        <div className={styles.proactivityControls}>
          <div className={styles.proactivityModeSegment} role="radiogroup" aria-label={t("Proactivity cadence")}>
            <button
              type="button"
              className={styles.proactivityModeOption}
              role="radio"
              aria-checked={proactivityMode === "off"}
              data-active={proactivityMode === "off" ? "true" : "false"}
              onClick={() => applyProactivity("off")}
            >
              {t("Off")}
            </button>
            <button
              type="button"
              className={styles.proactivityModeOption}
              role="radio"
              aria-checked={proactivityMode === "daily"}
              data-active={proactivityMode === "daily" ? "true" : "false"}
              onClick={() => applyProactivity("daily")}
            >
              {t("Daily")}
            </button>
            <button
              type="button"
              className={styles.proactivityModeOption}
              role="radio"
              aria-checked={proactivityMode === "frequent"}
              data-active={proactivityMode === "frequent" ? "true" : "false"}
              onClick={() => applyProactivity("frequent")}
            >
              {t("Frequent")}
            </button>
          </div>
        </div>
        <div className={styles.proactivitySummary}>
          {proactivityMode === "daily" ? (
            <div className={styles.proactivityScheduleRow}>
              <span className={styles.proactivityScheduleLabel}>{t("Time")}</span>
              <div className={styles.proactivityTimePill}>
                <select
                  className={styles.proactivityTimeSelect}
                  value={dailyTime}
                  aria-label={t("Daily time")}
                  onChange={(event) => {
                    const nextTime = event.target.value;
                    setDailyTime(nextTime);
                    applyProactivity("daily", nextTime);
                  }}
                >
                  {dailyTimeOptions.map((value) => (
                    <option key={value} value={value}>
                      {formatTimeLabel(value)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className={styles.proactivityTimeChevron} aria-hidden="true" />
              </div>
            </div>
          ) : proactivityMode === "frequent" ? (
            <div className={styles.proactivityScheduleRow}>
              <span className={styles.proactivityScheduleLabel}>{t("Times")}</span>
              <span className={styles.proactivityScheduleValue}>{proactivityTimesLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );

  return (
    <>
      {showGreeting ? (
        <div className={styles.greetingStack}>
          <h1 className={styles.greeting}>{greeting}</h1>
        </div>
      ) : null}

      {!hidePlans ? (
        <section className={styles.dashboardGrid}>
          <div className={`${styles.dashboardSectionCard} ${styles.dashboardGridItemCalendar}`}>{calendarCard}</div>
          <div className={`${styles.dashboardSectionCard} ${styles.dashboardGridItemProactivity}`}>
            {proactivityCard}
          </div>
          <div className={`${styles.dashboardSectionCard} ${styles.dashboardGridItemTasks}`}>{tasksCard}</div>
        </section>
      ) : null}

      {modalState.isOpen && modalState.type && (
        <AddPlanHabitModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          type={modalState.type}
          onSuccess={handleModalSuccess}
        />
      )}
      {planEditorTarget && onSavePlan ? (
        <AddPlanHabitModal
          isOpen={Boolean(planEditorTarget)}
          onClose={() => setPlanEditorTarget(null)}
          type="plan"
          onSuccess={handleModalSuccess}
          planToEdit={planEditorTarget}
          onSubmitPlan={async (planId, updates) => {
            if (!planId) {
              return;
            }
            await onSavePlan(planId, updates);
          }}
        />
      ) : null}
    </>
  );
}
