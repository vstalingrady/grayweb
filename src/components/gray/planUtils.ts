import { type PlanItem } from "./types";

const PLAN_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function formatPlanTimeLabel(plan: PlanItem) {
  if (plan.scheduleSlot) {
    const [start, end] = plan.scheduleSlot.split("-");
    if (start && end) {
      return `${start} – ${end}`;
    }
    return plan.scheduleSlot;
  }

  if (plan.deadline) {
    const parsed = new Date(plan.deadline);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, PLAN_TIME_OPTIONS);
    }
  }

  return "Time not set";
}
