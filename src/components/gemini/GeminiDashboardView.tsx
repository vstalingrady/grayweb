"use client";

import { Check, Sparkles, TrendingUp } from "lucide-react";
import styles from "@/app/gemini/GeminiPageClient.module.css";
import { getWeekDays, isSameDay } from "@/lib/gemini/date";

type GeminiDashboardViewProps = {
  activeDate: Date;
  onCreateMeeting: () => void;
};

const PLANS = [
  {
    id: "plan-1",
    title: "Restore proactive cadence for the builder cohort.",
    detail: "Pulse follow-up scheduled for Friday.",
    completed: false,
  },
  {
    id: "plan-2",
    title: "Draft mitigation follow-up checklist.",
    detail: "Review copy with ops today.",
    completed: false,
  },
  {
    id: "plan-3",
    title: "Lock launch checklist scope for the revamp.",
    detail: "All stakeholders signed off.",
    completed: true,
  },
  {
    id: "plan-4",
    title: "Draft async sync for builder cohort.",
    detail: "Slides ready for async review.",
    completed: false,
  },
];

const METRICS = [
  { id: "focus", label: "Focus score", value: "87", delta: "+6.1%" },
  { id: "streak", label: "Operator streak", value: "18d", delta: "Stable" },
  { id: "response", label: "Response time", value: "12m", delta: "—1.8m" },
];

export function GeminiDashboardView({ activeDate, onCreateMeeting }: GeminiDashboardViewProps) {
  const week = getWeekDays(activeDate);
  const today = new Date();

  return (
    <div className={styles.dashboardGrid}>
      <section className={styles.widget}>
        <header className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Week pulse</span>
          <button type="button" className={styles.widgetAction} onClick={onCreateMeeting}>
            <Sparkles size={14} />
            New briefing
          </button>
        </header>

        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          }}
        >
          {METRICS.map((metric) => (
            <div
              key={metric.id}
              style={{
                padding: "18px 16px",
                borderRadius: "16px",
                background: "rgba(18, 18, 22, 0.78)",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(185,188,206,0.58)" }}>
                {metric.label}
              </span>
              <strong style={{ fontSize: "1.8rem", fontWeight: 600 }}>{metric.value}</strong>
              <span style={{ color: "rgba(164, 210, 255, 0.78)", fontSize: "0.78rem" }}>
                {metric.delta}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.widget}>
        <header className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>This week</span>
          <span className={styles.widgetAction}>
            <TrendingUp size={14} />
            +18% engagement
          </span>
        </header>
        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {week.map((day) => {
            const isActive = isSameDay(day, activeDate);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onCreateMeeting()}
                style={{
                  borderRadius: "18px",
                  padding: "16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.05)",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(80, 110, 255, 0.36), rgba(114, 68, 255, 0.42))"
                    : "rgba(18,18,22,0.72)",
                  color: isActive ? "rgba(250,250,252,0.95)" : "inherit",
                  boxShadow: isActive ? "0 18px 36px rgba(83,110,255,0.3)" : "none",
                }}
              >
                <span style={{ fontSize: "0.68rem", letterSpacing: "0.2em", opacity: 0.6 }}>
                  {day.toLocaleDateString([], { weekday: "short" })}
                </span>
                <span
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 600,
                    color: isToday ? "rgba(184,198,255,0.9)" : undefined,
                  }}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.widget}>
        <header className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Plans & rituals</span>
          <span className={styles.widgetAction}>View all</span>
        </header>
        <div className={styles.plansList}>
          {PLANS.map((plan) => (
            <div key={plan.id} className={styles.planItem} data-complete={plan.completed ? "true" : "false"}>
              <span className={styles.planStatus}>
                {plan.completed ? <Check strokeWidth={2} /> : null}
              </span>
              <div className={styles.planContent}>
                <strong>{plan.title}</strong>
                <span>{plan.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
