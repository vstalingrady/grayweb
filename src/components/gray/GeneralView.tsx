import { CheckSquare, Square, Flame } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import { type HabitItem, type PlanItem } from "./types";

type PlanTab = "plans" | "habits";

type GrayGeneralViewProps = {
  greeting: string;
  plans: PlanItem[];
  habits: HabitItem[];
  activeTab: PlanTab;
  onChangeTab: (tab: PlanTab) => void;
  onTogglePlan: (id: string) => void;
  currentDate: Date;
  calendars: CalendarInfo[];
  onCalendarsChange: (calendars: CalendarInfo[]) => void;
  calendarEvents: CalendarEvent[];
  onCalendarEventsChange: (events: CalendarEvent[]) => void;
};

export function GrayGeneralView({
  greeting,
  calendarEvents,
  plans,
  habits,
  activeTab,
  onChangeTab,
  onTogglePlan,
  currentDate,
  calendars,
  onCalendarsChange,
  onCalendarEventsChange,
}: GrayGeneralViewProps) {
  return (
    <>
      <h1 className={styles.greeting}>{greeting}</h1>

      <section className={styles.mainGrid}>
        <div className={styles.primaryColumn}>
          <GrayDashboardCalendar
            initialDate={currentDate}
            viewModeLocked="day"
            showSidebar={false}
            calendars={calendars}
            events={calendarEvents}
            onCalendarsChange={onCalendarsChange}
            onEventsChange={onCalendarEventsChange}
          />
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
                          <span className={styles.planLabel}>{plan.label}</span>
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
                          <span className={styles.habitLabel}>{habit.label}</span>
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
