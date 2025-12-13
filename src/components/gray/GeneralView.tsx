import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Square, Zap, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { AddPlanHabitModal } from "./AddPlanHabitModal";
import { type HabitItem, type PlanItem, type PlanUpdates, type ProactivityItem } from "./types";
import { useI18n } from "@/contexts/I18nContext";

const DEFAULT_PROACTIVITY_TIME = "09:00";
const FREQUENT_PROACTIVITY_TIMES = ["09:00", "12:00", "18:00"] as const;

type ProactivityMode = "off" | "daily" | "frequent";

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
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: "plan" | "habit" | null }>({
    isOpen: false,
    type: null,
  });
  const [planEditorTarget, setPlanEditorTarget] = useState<PlanItem | null>(null);
  const proactivityMode = resolveProactivityMode(proactivity);
  const [dailyTime, setDailyTime] = useState(() => proactivity?.time ?? DEFAULT_PROACTIVITY_TIME);

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

  const plansCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <span>{t("Plans")}</span>
      </header>
      <div className={styles.dashboardCardBody}>
        <ul className={styles.planList}>
          {plans.length ? (
            plans.map((plan) => (
              <li key={plan.id} className={styles.planListItem}>
                <div
                  className={styles.planItemButton}
                  data-completed={plan.completed ? "true" : "false"}
                  role="group"
                >
                  <button
                    type="button"
                    className={styles.planCheckboxButton}
                    aria-label={
                      plan.completed ? t("Mark plan as incomplete") : t("Mark plan as complete")
                    }
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
      </div>
    </article>
  );

  const habitsCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <span>{t("Habits")}</span>
      </header>
      <div className={styles.dashboardCardBody}>
        <ul className={styles.habitList}>
          {habits.length ? (
            habits.map((habit) => (
              <li key={habit.id} className={styles.habitListItem}>
                <div
                  className={styles.planItemButton}
                  data-completed={habit.completed ? "true" : "false"}
                  role="group"
                >
                  <button
                    type="button"
                    className={styles.planCheckboxButton}
                    aria-label={
                      habit.completed ? t("Mark habit as incomplete") : t("Mark habit as complete")
                    }
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
      </div>
    </article>
  );

  const proactivityTimesLabel = useMemo(() => {
    if (!proactivity) {
      return t("Off");
    }
    const times = (proactivity.times ?? []).length ? proactivity.times ?? [] : [proactivity.time];
    const normalizedTimes = times.filter(Boolean).join(", ");
    if (!normalizedTimes) {
      return t("On");
    }
    return t("Times: {times}", { times: normalizedTimes });
  }, [proactivity, t]);

  const proactivityCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <span>{t("Proactivity")}</span>
      </header>
      <div className={styles.dashboardCardBody}>
        <div className={styles.proactivityControls}>
          <label>
            <span>{t("Mode")}</span>
            <select
              className={styles.proactivityPresetSelect}
              value={proactivityMode}
              onChange={(event) => applyProactivity(event.target.value as ProactivityMode)}
            >
              <option value="off">{t("Off")}</option>
              <option value="daily">{t("Daily")}</option>
              <option value="frequent">{t("Frequent")}</option>
            </select>
          </label>
          {proactivityMode === "daily" ? (
            <label>
              <span>{t("Time")}</span>
              <input
                type="time"
                className={styles.proactivityTimeInput}
                value={dailyTime}
                onChange={(event) => {
                  const nextTime = event.target.value;
                  setDailyTime(nextTime);
                  applyProactivity("daily", nextTime);
                }}
              />
            </label>
          ) : null}
        </div>
        <div className={styles.cardEmptyMessage}>
          <span>{proactivityTimesLabel}</span>
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
          <div className={styles.dashboardSectionCard}>{plansCard}</div>
          <div className={styles.dashboardSectionCard}>{habitsCard}</div>
          <div className={styles.dashboardSectionCard}>{proactivityCard}</div>
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
