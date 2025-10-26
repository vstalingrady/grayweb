import { CheckSquare, Square, Flame, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type HabitItem, type PlanItem } from "./types";

const PANEL_HEIGHT = "min(620px, calc(100vh - 220px))";
const COMPACT_CALENDAR_HOUR_HEIGHT = 56;

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
}: GrayGeneralViewProps) {
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
                          data-completed={plan.completed}
                          onClick={() => onTogglePlan(plan.id)}
                        >
                          <span>
                            {plan.completed ? (
                              <CheckSquare size={16} />
                            ) : (
                              <Square size={16} />
                            )}
                          </span>
                          <span className={styles.planLabel}>{plan.label}</span>
                        </button>
                        <div className={styles.listItemActions}>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={() => onEditPlan(plan)}
                            aria-label={`Edit plan ${plan.label}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={() => onDeletePlan(plan)}
                            aria-label={`Delete plan ${plan.label}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.secondaryAction}>
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
                          <span>
                            {habit.completed ? (
                              <CheckSquare size={16} />
                            ) : (
                              <Square size={16} />
                            )}
                          </span>
                          <span className={styles.habitLabel}>{habit.label}</span>
                        </button>
                        <div className={styles.habitListItemMeta}>
                          <Flame size={12} />
                          <span>{habit.streakLabel}</span>
                        </div>
                        <div className={styles.listItemActions}>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={() => onEditHabit(habit)}
                            aria-label={`Edit habit ${habit.label}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.listItemActionButton}
                            onClick={() => onDeleteHabit(habit)}
                            aria-label={`Delete habit ${habit.label}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.secondaryAction}>
                    Add habits
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
