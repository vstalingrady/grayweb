import { CheckSquare, Square, Flame } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import {
  type CalendarDisplayEvent,
  type HabitItem,
  type PlanItem,
} from "./types";

type PlanTab = "plans" | "habits";

type GrayGeneralViewProps = {
  greeting: string;
  hours: number[];
  hourLabelFor: (hour: number) => string;
  calendarEvents: CalendarDisplayEvent[];
  calendarTrackHeight: number;
  calendarHourHeight: number;
  plans: PlanItem[];
  habits: HabitItem[];
  activeTab: PlanTab;
  onChangeTab: (tab: PlanTab) => void;
  onTogglePlan: (id: string) => void;
  currentDate: Date;
};

export function GrayGeneralView({
  greeting,
  hours,
  hourLabelFor,
  calendarEvents,
  calendarTrackHeight,
  calendarHourHeight,
  plans,
  habits,
  activeTab,
  onChangeTab,
  onTogglePlan,
  currentDate,
}: GrayGeneralViewProps) {
  return (
    <>
      <h1 className={styles.greeting}>{greeting}</h1>

      <section className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <GrayDashboardCalendar initialDate={currentDate} viewModeLocked="day" showSidebar={false} />
        </div>

        <div className={styles.secondaryColumn}>
          <div className={styles.planPanel}>
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
                    {plans.map((plan) => (
                      <li key={plan.id}>
                        <button
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
                          <span>{plan.label}</span>
                        </button>
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
                      <li key={habit.id}>
                        <div>
                          <span>{habit.label}</span>
                          <span>{habit.previousLabel}</span>
                        </div>
                        <div>
                          <Flame size={12} />
                          <span>{habit.streakLabel}</span>
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
