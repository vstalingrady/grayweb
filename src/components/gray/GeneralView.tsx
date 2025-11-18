import { useMemo, useState, useCallback } from "react";
import { CheckSquare, Square, Flame, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import { AddPlanHabitModal } from "./AddPlanHabitModal";
import type { CalendarEvent, CalendarInfo, PositionedEvent } from "@/components/calendar/types";
import { type HabitItem, type PlanItem, type PlanUpdates } from "./types";
import { mapPlansToCalendarEvents, PLAN_EVENT_ID_PREFIX } from "./planCalendarUtils";

const PANEL_HEIGHT =
  "clamp(360px, calc(100vh - (320px + var(--gray-chat-bar-clearance, 112px))), 660px)";
const COMPACT_CALENDAR_HOUR_HEIGHT = 56;

type PlanTab = "plans" | "habits";

type GrayGeneralViewProps = {
  greeting: string;
  dateLabel: string;
  plans: PlanItem[];
  habits: HabitItem[];
  activeTab: PlanTab;
  onChangeTab: (tab: PlanTab) => void;
  onTogglePlan: (id: string) => void;
  onToggleHabit: (id: string) => void;
  onSavePlan: (planId: string, updates: PlanUpdates) => Promise<void> | void;
  onDeletePlan: (plan: PlanItem) => void;
  currentDate: Date;
  calendars: CalendarInfo[];
  onCalendarsChange: (calendars: CalendarInfo[]) => void;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
  calendarSelectedDate?: Date;
  onCalendarSelectedDateChange?: (date: Date) => void;
  onEditHabit: (habit: HabitItem) => void;
  onDeleteHabit: (habit: HabitItem) => void;
  onRefreshData: () => Promise<void>;
  isCompactLayout?: boolean;
  showGreeting?: boolean;
  userId?: number | null;
  onReminderMove?: (reminderId: number, range: { start: Date; end: Date }) => Promise<void> | void;
};

export function GrayGeneralView({
  greeting,
  dateLabel,
  calendarEvents,
  plans,
  habits,
  activeTab,
  onChangeTab,
  onTogglePlan,
  onToggleHabit,
  onSavePlan,
  onDeletePlan,
  currentDate,
  calendars,
  onCalendarsChange,
  onCalendarEventsChange,
  calendarSelectedDate,
  onCalendarSelectedDateChange,
  onEditHabit,
  onDeleteHabit,
  onRefreshData,
  onReminderMove,
  isCompactLayout = false,
  showGreeting = true,
  userId,
}: GrayGeneralViewProps) {
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: "plan" | "habit" | null }>({
    isOpen: false,
    type: null,
  });
  const [planEditorTarget, setPlanEditorTarget] = useState<PlanItem | null>(null);
  const planCalendarEvents = useMemo(() => mapPlansToCalendarEvents(plans), [plans]);

  const resolvePlanFromEvent = useCallback(
    (eventId: string) => {
      if (!eventId.startsWith(PLAN_EVENT_ID_PREFIX)) {
        return null;
      }
      const planId = eventId.slice(PLAN_EVENT_ID_PREFIX.length);
      return plans.find((plan) => plan.id === planId) ?? null;
    },
    [plans]
  );

  const handleCalendarTaskToggle = useCallback(
    (event: CalendarEvent) => {
      if (!event.id.startsWith(PLAN_EVENT_ID_PREFIX)) {
        return;
      }
      onTogglePlan(event.id.slice(PLAN_EVENT_ID_PREFIX.length));
    },
    [onTogglePlan]
  );

  const handleCalendarEventMove = useCallback(
    (event: CalendarEvent, range: { start: Date; end: Date }) => {
      if (event.entryType === "reminder" && onReminderMove) {
        const segments = event.id.split("-");
        const reminderIdValue = Number(segments[segments.length - 1]);
        if (!Number.isNaN(reminderIdValue)) {
          void onReminderMove(reminderIdValue, range);
        }
        return;
      }

      if (!event.id.startsWith(PLAN_EVENT_ID_PREFIX)) {
        return;
      }

      const planId = event.id.slice(PLAN_EVENT_ID_PREFIX.length);
      const targetPlan = plans.find((plan) => plan.id === planId);
      if (!targetPlan) {
        return;
      }

      const formatTime = (value: Date) =>
        `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

      const scheduleSlot = `${formatTime(range.start)}-${formatTime(range.end)}`;

      void onSavePlan(planId, {
        label: targetPlan.label,
        details: targetPlan.details ?? null,
        deadline: targetPlan.deadline ?? null,
        scheduleSlot,
      });
    },
    [onSavePlan, onReminderMove, plans]
  );

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

  const mergedEvents = useMemo(() => [...calendarEvents, ...planCalendarEvents], [calendarEvents, planCalendarEvents]);

  const handleCalendarEventsChange = useCallback((nextEvents: CalendarEvent[]) => {
    // 1. Separate real events from plan events
    const nextCalendarEvents = nextEvents.filter((e) => !e.id.startsWith(PLAN_EVENT_ID_PREFIX));
    const nextPlanEvents = nextEvents.filter((e) => e.id.startsWith(PLAN_EVENT_ID_PREFIX));

    // 2. Propagate real events to parent
    onCalendarEventsChange(nextCalendarEvents);

    // 3. Detect and save changed plans
    nextPlanEvents.forEach((event) => {
      const planId = event.id.slice(PLAN_EVENT_ID_PREFIX.length);
      const originalPlan = plans.find((p) => p.id === planId);
      
      // If we can't find the plan, or if we can't save, skip
      if (!originalPlan || !onSavePlan) return;

      // Check if time changed
      // We need to compare against the *current* derived event for this plan
      const originalEvent = planCalendarEvents.find((e) => e.id === event.id);
      if (!originalEvent) return;

      if (
        originalEvent.start.getTime() === event.start.getTime() &&
        originalEvent.end.getTime() === event.end.getTime()
      ) {
        return;
      }

      const formatTime = (value: Date) =>
        `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

      const scheduleSlot = `${formatTime(event.start)}-${formatTime(event.end)}`;

      void onSavePlan(planId, {
        label: originalPlan.label,
        details: originalPlan.details ?? null,
        deadline: originalPlan.deadline ?? null,
        scheduleSlot,
      });
    });

    // 4. Detect and save changed reminders
    if (onReminderMove) {
      nextCalendarEvents
        .filter((e) => e.id.startsWith("reminder-"))
        .forEach((event) => {
          const originalEvent = calendarEvents.find((e) => e.id === event.id);
          if (!originalEvent) return;

          if (
            originalEvent.start.getTime() === event.start.getTime() &&
            originalEvent.end.getTime() === event.end.getTime()
          ) {
            return;
          }

          const reminderId = Number(event.id.replace("reminder-", ""));
          if (!Number.isNaN(reminderId)) {
            void onReminderMove(reminderId, { start: event.start, end: event.end });
          }
        });
    }
  }, [onCalendarEventsChange, onSavePlan, plans, planCalendarEvents, onReminderMove, calendarEvents]);

  return (
    <>
      {showGreeting ? (
        <div className={styles.greetingStack}>
          <h1 className={styles.greeting}>{greeting}</h1>
          <p className={styles.greetingDate}>{dateLabel}</p>
        </div>
      ) : null}

      <section
        className={styles.mainGrid}
        data-compact={isCompactLayout ? "true" : "false"}
      >
        {!isCompactLayout ? (
          <div className={`${styles.primaryColumn} ${styles.primaryColumnSlim}`}>
            <GrayDashboardCalendar
              initialDate={currentDate}
              viewModeLocked="day"
              showSidebar={false}
              showSurfaceLabel={false}
              showSurfaceHeading={false}
              compactSurface
              showHeaderControls={false}
              showHeaderDates={false}
              calendars={calendars}
              events={mergedEvents}
              onCalendarsChange={onCalendarsChange}
              onEventsChange={handleCalendarEventsChange}
              selectedDate={calendarSelectedDate}
              onSelectedDateChange={onCalendarSelectedDateChange}
              maxHeight={PANEL_HEIGHT}
              hourHeight={COMPACT_CALENDAR_HOUR_HEIGHT}
            />
          </div>
        ) : null}

        <div className={`${styles.secondaryColumn} ${styles.secondaryColumnSlim}`}>
          <div
            className={`${styles.planPanel} ${styles.planPanelSlim}`}
            style={
              isCompactLayout
                ? undefined
                : { minHeight: PANEL_HEIGHT, height: PANEL_HEIGHT }
            }
            data-match-calendar-height={isCompactLayout ? "false" : "true"}
          >
            <div className={styles.tabBar}>
              <button
                type="button"
                data-active={activeTab === "plans"}
                onClick={() => onChangeTab("plans")}
              >
                Plans
              </button>
              <button
                type="button"
                data-active={activeTab === "habits"}
                onClick={() => onChangeTab("habits")}
              >
                Habits
              </button>
            </div>
            <div className={styles.planBody}>
              {activeTab === "plans" ? (
                <>
                  <ul className={styles.planList}>
                    {(plans || []).map((plan) => (
                      <li key={plan.id} className={styles.planListItem}>
                        <button
                          className={styles.planItemButton}
                          type="button"
                          data-completed={plan.completed ? "true" : "false"}
                          onClick={() => onTogglePlan(plan.id)}
                        >
                          <span className={styles.planCheckbox} aria-hidden="true">
                            {plan.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>
                          <span className={styles.planLabelGroup}>
                            <span className={styles.planLabel}>{plan.label}</span>
                          </span>
                        </button>
                        <span className={styles.listItemActions}>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setPlanEditorTarget(plan);
                            }}
                            aria-label={`Edit plan ${plan.label}`}
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
                            aria-label={`Delete plan ${plan.label}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.secondaryAction} onClick={() => openModal("plan")}>
                    Add plans
                  </button>
                </>
              ) : (
                <>
                  <ul className={styles.habitList}>
                    {habits.map((habit) => (
                      <li key={habit.id} className={styles.habitListItem}>
                        <button
                          className={styles.planItemButton}
                          type="button"
                          data-completed={habit.completed ? "true" : "false"}
                          onClick={() => onToggleHabit(habit.id)}
                        >
                          <span className={styles.planCheckbox} aria-hidden="true">
                            {habit.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>
                          <span className={styles.habitContent}>
                            <span className={styles.habitLabel}>{habit.label}</span>
                          </span>
                        </button>
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
                              aria-label={`Edit habit ${habit.label}`}
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
                              aria-label={`Delete habit ${habit.label}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                          <span className={styles.habitStreak}>
                            <Flame size={12} aria-hidden="true" />
                            <span>{habit.streakLabel}</span>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.secondaryAction} onClick={() => openModal("habit")}>
                    Add habits
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

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
