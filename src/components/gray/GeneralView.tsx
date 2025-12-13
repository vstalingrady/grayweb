import { useMemo, useState } from "react";
import { CheckSquare, Square, Zap, Pencil, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { AddPlanHabitModal } from "./AddPlanHabitModal";
import { type HabitItem, type PlanItem, type PlanUpdates, type ProactivityItem } from "./types";
import { useI18n } from "@/contexts/I18nContext";
import { MiniMonth } from "@/components/calendar/MiniMonth";
import {
  getProactivityTimes,
  formatCustomTimeLabel,
} from "./proactivityUtils";
import { ProactivitySettingsModal } from "./ProactivitySettingsModal";

type TasksTab = "plans" | "habits";

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

  const [isProactivityModalOpen, setIsProactivityModalOpen] = useState(false);
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

  const handleOpenProactivityModal = () => {
    setIsProactivityModalOpen(true);
  };

  const handleCloseProactivityModal = () => {
    setIsProactivityModalOpen(false);
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

  const activeProactivityTimes = useMemo(() => {
    return getProactivityTimes(proactivity);
  }, [proactivity]);

  const formattedProactivityTimes = useMemo(
    () => activeProactivityTimes.map((time) => formatCustomTimeLabel(time)),
    [activeProactivityTimes]
  );

  // To match dashboard checklist UI perfectly, we need "delivered" status.
  // However, GeneralView props might not have delivered keys. 
  // We can default delivery status to false for General View or just list the times.
  // The user requirement is: "checklist-style display for scheduled proactivity times".
  // So a static checklist (checked/unchecked or just list) is fine.
  // Dashboard view uses `delivered` to check/uncheck. 
  // If we don't have that info, maybe always uncheck or check? 
  // Or just use bullet points? The dashboard view uses Square/Check icons.
  // Let's assume unchecked (Square) if we don't know the status.
  // Or better, since this is "General" view, maybe it just shows the schedule?
  // Let's assume unchecked (Square) for scheduled times.

  const proactivityScheduleEntries = useMemo(() => {
    if (activeProactivityTimes.length > 0) {
      return activeProactivityTimes.map((time, index) => ({
        time,
        label: formattedProactivityTimes[index] ?? formatCustomTimeLabel(time),
        delivered: false, // GeneralView doesn't seem to track delivery deliveryKeys prop.
      }));
    }
    return [];
  }, [activeProactivityTimes, formattedProactivityTimes]);


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
    <article className={`${styles.dashboardCard} ${styles.proactivityCard}`}>
      <header className={styles.dashboardCardHeader}>
        <div className={`${styles.dashboardCardIcon} ${styles.iconBlue}`}>
          <Zap size={16} fill="white" />
        </div>
        <h2 className={styles.dashboardCardTitle}>{t("Proactivity")}</h2>
      </header>
      <div className={styles.dashboardCardBody}>
        {proactivityScheduleEntries.length > 0 ? (
          <ul className={styles.proactivityChecklist}>
            {proactivityScheduleEntries.map(({ label, delivered }, index) => (
              <li key={`${label}-${index}`} className={styles.proactivityChecklistItem}>
                <span className={styles.proactivityChecklistIcon} aria-hidden="true">
                  {delivered ? <Check size={14} /> : <Square size={14} />}
                </span>
                <span className={styles.proactivityChecklistLabel}>{t(label)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.proactivityEmptyState}>
            <span>{t("No check-ins scheduled")}</span>
          </div>
        )}
        <button
          type="button"
          className={styles.proactivityConfigureLink}
          onClick={handleOpenProactivityModal}
        >
          {t("configure")}
        </button>
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

      {isProactivityModalOpen && (
        <ProactivitySettingsModal
          isOpen={isProactivityModalOpen}
          onClose={handleCloseProactivityModal}
          activeProactivity={proactivity}
          activeProactivityTimes={activeProactivityTimes}
          onSelectProactivity={onSelectProactivity}
          onRemoveProactivity={onRemoveProactivity}
        />
      )}
    </>
  );
}
