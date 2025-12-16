import { useMemo, useRef, useState } from "react";
import { CheckSquare, Square, Pencil, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { type HabitItem, type PlanItem, type PlanUpdates, type ProactivityItem } from "./types";
import { useI18n } from "@/contexts/I18nContext";
import { MiniMonth } from "@/components/calendar/MiniMonth";
import {
  getProactivityTimes,
  formatCustomTimeLabel,
} from "./proactivityUtils";
import { ProactivityInlineMenu } from "./ProactivityInlineMenu";
import { PlanHabitInlineEditor } from "./PlanHabitInlineEditor";

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
  const [activeEditor, setActiveEditor] = useState<
    | null
    | { type: "plan" | "habit"; plan: PlanItem | null; habit: HabitItem | null }
  >(null);

  const [isProactivityMenuOpen, setIsProactivityMenuOpen] = useState(false);
  const proactivityAnchorRef = useRef<HTMLButtonElement | null>(null);

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

  const handleEditorSuccess = async () => {
    await onRefreshData();
  };

  const handleOpenProactivityModal = () => {
    setIsProactivityMenuOpen(true);
  };

  const handleCloseProactivityModal = () => {
    setIsProactivityMenuOpen(false);
  };

  const isAdding = Boolean(activeEditor && !activeEditor.plan && !activeEditor.habit);

  const unifiedItems = useMemo(
    () => {
      const next = [
        ...plans.map((plan) => ({ kind: "plan" as const, item: plan })),
        ...habits.map((habit) => ({ kind: "habit" as const, item: habit })),
      ];

      const toTimestamp = (value: string | null | undefined): number => {
        if (!value) return 0;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      next.sort((a, b) => {
        const aTime =
          toTimestamp(a.item.updatedAt) ||
          toTimestamp(a.item.createdAt) ||
          (a.kind === "plan" ? toTimestamp(a.item.deadline) : 0);
        const bTime =
          toTimestamp(b.item.updatedAt) ||
          toTimestamp(b.item.createdAt) ||
          (b.kind === "plan" ? toTimestamp(b.item.deadline) : 0);
        return bTime - aTime;
      });

      return next;
    },
    [habits, plans]
  );

  const shouldShowEmptyState = unifiedItems.length === 0 && !isAdding;

  const plansContent = (
    <>
      {unifiedItems.length ? (
        <ul className={styles.planList}>
          {unifiedItems.map(({ kind, item }) => (
            <li key={`${kind}-${item.id}`} className={styles.planListItem}>
              <div
                className={styles.planItemButton}
                data-completed={item.completed ? "true" : "false"}
                role="group"
              >
                <button
                  type="button"
                  className={styles.planCheckboxButton}
                  aria-label={
                    item.completed
                      ? t("Mark plan as incomplete")
                      : t("Mark plan as complete")
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (kind === "plan") {
                      onTogglePlan(item.id);
                    } else {
                      onToggleHabit(item.id);
                    }
                  }}
                >
                  <span className={styles.planCheckbox} aria-hidden="true">
                    {item.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                </button>
                <span className={styles.planLabelGroup}>
                  <span className={styles.planLabel}>{item.label}</span>
                  {(() => {
                    const rawDetails = (item.details ?? "").trim();
                    if (!rawDetails) {
                      return null;
                    }
                    const preview = rawDetails.split(/\n+/)[0]?.trim();
                    return preview ? <span className={styles.planDetails}>{preview}</span> : null;
                  })()}
                </span>
              </div>
              <span className={styles.listItemActions}>
                <button
                  type="button"
                  className={styles.listItemActionButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (kind === "plan") {
                      setActiveEditor({ type: "plan", plan: item as PlanItem, habit: null });
                    } else {
                      setActiveEditor({ type: "habit", plan: null, habit: item as HabitItem });
                    }
                  }}
                  aria-label={t("Edit plan {label}", { label: item.label })}
                  disabled={kind === "plan" ? !onSavePlan : false}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className={styles.listItemActionButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (kind === "plan") {
                      onDeletePlan(item as PlanItem);
                    } else {
                      onDeleteHabit(item as HabitItem);
                    }
                  }}
                  aria-label={t("Delete plan {label}", { label: item.label })}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  const tasksCard = (
    <article className={styles.dashboardCard}>
      <header className={styles.dashboardCardHeader}>
        <h2 className={styles.dashboardCardTitle}>{t("Events")}</h2>
      </header>
      <div className={styles.dashboardCardBody}>
        {activeEditor ? (
          <div style={{ marginBottom: "12px" }}>
            <PlanHabitInlineEditor
              type={activeEditor.type}
              onTypeChange={(nextType) => setActiveEditor({ type: nextType, plan: null, habit: null })}
              planToEdit={activeEditor.plan}
              habitToEdit={activeEditor.habit}
              onCancel={() => setActiveEditor(null)}
              onSuccess={handleEditorSuccess}
              onSubmitPlan={
                onSavePlan
                  ? async (planId, updates) => {
                      if (!planId) {
                        return;
                      }
                      await onSavePlan(planId, updates);
                    }
                  : undefined
              }
            />
          </div>
        ) : shouldShowEmptyState ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div className={styles.listEmptyMessage} style={{ marginTop: "auto", marginBottom: "auto" }}>
              <span>{t("No events captured yet.")}</span>
            </div>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => setActiveEditor({ type: "plan", plan: null, habit: null })}
            >
              {t("New event")}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              {plansContent}
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => setActiveEditor({ type: "plan", plan: null, habit: null })}
                style={{ marginTop: "auto" }}
              >
                {t("New event")}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );

  const activeProactivityTimes = useMemo(() => {
    return getProactivityTimes(proactivity);
  }, [proactivity]);

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
      return activeProactivityTimes
        .map((time) => time.trim())
        .filter((time) => time.length > 0)
        .map((time) => ({
          time,
          label: formatCustomTimeLabel(time),
          delivered: false, // GeneralView doesn't seem to track delivery deliveryKeys prop.
        }))
        .filter(({ label }) => label.trim().length > 0);
    }
    return [];
  }, [activeProactivityTimes]);


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
          className={styles.secondaryAction}
          onClick={handleOpenProactivityModal}
          ref={proactivityAnchorRef}
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

      <ProactivityInlineMenu
        isOpen={isProactivityMenuOpen}
        onClose={handleCloseProactivityModal}
        anchorRef={proactivityAnchorRef}
        activeProactivity={proactivity}
        activeProactivityTimes={activeProactivityTimes}
        onSelectProactivity={onSelectProactivity}
        onRemoveProactivity={onRemoveProactivity}
      />
    </>
  );
}
