import { CheckSquare, Square, Flame, Trash2, ChevronDown, Clock } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { GrayDashboardCalendar } from "@/components/calendar/GrayDashboardCalendar";
import {
  type HabitItem,
  type PlanItem,
  type ProactivityItem,
} from "./types";

type GrayDashboardViewProps = {
  plans: PlanItem[];
  habits: HabitItem[];
  proactivity: ProactivityItem;
  dashboardDateLabel: string;
  onTogglePlan: (id: string) => void;
  activeTab: "pulse" | "calendar";
  onSelectTab: (tab: "pulse" | "calendar") => void;
  currentDate: Date;
};

export function GrayDashboardView({
  plans,
  habits,
  proactivity,
  dashboardDateLabel,
  onTogglePlan,
  activeTab,
  onSelectTab,
  currentDate,
}: GrayDashboardViewProps) {
  return (
    <>
      <div className={styles.dashboardHeaderRow}>
        <div className={styles.dashboardHeaderLeft}>
          <span className={styles.dashboardEyebrow}>Dashboard</span>
          <h1 className={styles.dashboardHeadline}>Operational focus</h1>
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
          <span className={styles.dashboardDate}>{dashboardDateLabel}</span>
        </div>
      </div>

      {activeTab === "pulse" ? (
        <section className={styles.dashboardGrid}>
          <article className={styles.dashboardCard}>
            <header className={styles.dashboardCardHeader}>
              <span>Plans</span>
            </header>
            <div className={styles.dashboardCardBody}>
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
            </div>
          </article>

          <article className={styles.dashboardCard}>
            <header className={styles.dashboardCardHeader}>
              <span>Habits</span>
            </header>
            <div className={styles.dashboardCardBody}>
              <ul className={`${styles.habitList} ${styles.dashboardHabitList}`}>
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
            </div>
          </article>

          <article
            className={`${styles.dashboardCard} ${styles.proactivityCard}`}
          >
            <header className={styles.dashboardCardHeader}>
              <span>Proactivity</span>
            </header>
            <div className={styles.dashboardCardBody}>
              <div className={styles.proactivityHeader}>
                <div>
                  <div className={styles.proactivityTitle}>
                    <CheckSquare size={16} />
                    <span>{proactivity.label}</span>
                  </div>
                  <p>{proactivity.description}</p>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Remove proactivity item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className={styles.proactivityControls}>
                <label>
                  <span>Cadence</span>
                  <div className={styles.dashboardSelect}>
                    <span>{proactivity.cadence}</span>
                    <ChevronDown size={14} />
                  </div>
                </label>
                <label>
                  <span>Time</span>
                  <div className={styles.dashboardSelect}>
                    <Clock size={14} />
                    <span>{proactivity.time}</span>
                  </div>
                </label>
              </div>
              <button type="button" className={styles.secondaryAction}>
                Add proactivity
              </button>
            </div>
          </article>
        </section>
      ) : (
        <GrayDashboardCalendar initialDate={currentDate} />
      )}
    </>
  );
}
