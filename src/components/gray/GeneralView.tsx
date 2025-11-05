import { useState } from "react";
import { CheckSquare, Square, Flame, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import { AddPlanHabitModal } from "./AddPlanHabitModal";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type HabitItem, type PlanItem } from "./types";

const PANEL_HEIGHT =
  "clamp(480px, calc(100vh - (220px + var(--gray-chat-bar-clearance, 160px))), 840px)";
const COMPACT_CALENDAR_HOUR_HEIGHT = 56;

const formatPlanMeta = (plan: { scheduleSlot?: string | null; deadline?: string | null }) => {
  const parts: string[] = [];
  if (plan.scheduleSlot) {
    const [startRaw, endRaw] = plan.scheduleSlot.split("-").map((value) => value?.trim() ?? "");
    const parseTime = (time: string) => {
      const [h, m] = time.split(":").map((value) => Number.parseInt(value, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) {
        return null;
      }
      const date = new Date();
      date.setHours(h, m, 0, 0);
      return date;
    };
    const startTime = parseTime(startRaw);
    const endTime = parseTime(endRaw);
    if (startTime && endTime) {
      parts.push(
        `Slot ${startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${endTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      );
    } else if (startTime) {
      parts.push(`Slot ${startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    } else {
      parts.push(`Slot ${plan.scheduleSlot}`);
    }
  }

  if (plan.deadline) {
    const deadlineDate = new Date(plan.deadline);
    if (!Number.isNaN(deadlineDate.getTime())) {
      parts.push(
        `Due ${deadlineDate.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })}`
      );
    } else {
      parts.push(`Due ${plan.deadline}`);
    }
  }

  return parts.join(" • ");
};

type PlanTab = "plans" | "habits";

type GrayGeneralViewProps = {
  greeting: string;
  plans: PlanItem[];
  habits: HabitItem[];
  activeTab: PlanTab;
  onChangeTab: (tab: PlanTab) => void;
  onTogglePlan: (id: string) => void;
  onToggleHabit: (id: string) => void;
  onEditPlan: (plan: PlanItem) => void;
  onDeletePlan: (plan: PlanItem) => void;
  currentDate: Date;
  calendars: CalendarInfo[];
  onCalendarsChange: (calendars: CalendarInfo[]) => void;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
  onEditHabit: (habit: HabitItem) => void;
  onDeleteHabit: (habit: HabitItem) => void;
  onRefreshData: () => Promise<void>;
};

export function GrayGeneralView({
  greeting,
  calendarEvents,
  plans,
  habits,
  activeTab,
  onChangeTab,
  onTogglePlan,
  onToggleHabit,
  onEditPlan,
  onDeletePlan,
  currentDate,
  calendars,
  onCalendarsChange,
  onCalendarEventsChange,
  onEditHabit,
  onDeleteHabit,
  onRefreshData,
}: GrayGeneralViewProps) {
  const [modalState, setModalState] = useState<{ isOpen: boolean; type: "plan" | "habit" | null }>({
    isOpen: false,
    type: null,
  });

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

  return (
    <>
      <h1 className={styles.greeting}>{greeting}</h1>

      <section className={styles.mainGrid}>
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
            events={calendarEvents}
            onCalendarsChange={onCalendarsChange}
            onEventsChange={onCalendarEventsChange}
            maxHeight={PANEL_HEIGHT}
            hourHeight={COMPACT_CALENDAR_HOUR_HEIGHT}
          />
        </div>

        <div className={`${styles.secondaryColumn} ${styles.secondaryColumnSlim}`}>
          <div
            className={`${styles.planPanel} ${styles.planPanelSlim}`}
            style={{ minHeight: PANEL_HEIGHT, height: PANEL_HEIGHT }}
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
                            {(plan.scheduleSlot || plan.deadline) && (
                              <span className={styles.planMeta}>{formatPlanMeta(plan)}</span>
                            )}
                          </span>
                        </button>
                        <span className={styles.listItemActions}>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onEditPlan(plan);
                            }}
                            aria-label={`Edit plan ${plan.label}`}
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
                            <span className={styles.habitMeta}>Prev: {habit.previousLabel}</span>
                          </span>
                        </button>
                        <span className={styles.habitStreak}>
                          <Flame size={12} aria-hidden="true" />
                          <span>{habit.streakLabel}</span>
                        </span>
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
    </>
  );
}
