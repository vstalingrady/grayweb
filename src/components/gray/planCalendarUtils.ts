import { CalendarEvent } from "@/components/calendar/types";
import { PlanItem } from "./types";

export const PLAN_EVENT_ID_PREFIX = "plan-event-";
const PLAN_EVENT_COLOR = "#6f8bff";
const PLAN_EVENT_DURATION_MINUTES = 45;

type SlotTimeParts = {
  hours: number;
  minutes: number;
};

const parseTimeString = (value: string | null | undefined): SlotTimeParts | null => {
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
};

const buildDateWithTime = (base: Date, time: SlotTimeParts | null) => {
  const next = new Date(base);
  if (!time) {
    return next;
  }
  next.setHours(time.hours, time.minutes, 0, 0);
  return next;
};

const parseScheduleSlot = (slot: string | null | undefined) => {
  if (!slot) {
    return null;
  }
  const match = slot.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    start: parseTimeString(match[1]),
    end: parseTimeString(match[2]),
  };
};

export const mapPlansToCalendarEvents = (plans: PlanItem[]): CalendarEvent[] => {
  if (!plans || plans.length === 0) {
    return [];
  }
  return plans
    .filter((plan) => plan.deadline && !plan.completed)
    .map((plan) => {
      const deadline = plan.deadline ? new Date(plan.deadline) : null;
      if (!deadline || Number.isNaN(deadline.getTime())) {
        return null;
      }
      const slot = parseScheduleSlot(plan.scheduleSlot);
      const startTime = slot?.start ? buildDateWithTime(deadline, slot.start) : new Date(deadline);
      const endTime = slot?.end ? buildDateWithTime(deadline, slot.end) : null;
      const shouldDisplayAsLine = !slot?.end;
      const effectiveStart = startTime;
      const effectiveEnd =
        endTime && endTime.getTime() > startTime.getTime()
          ? endTime
          : new Date(
              startTime.getTime() + (shouldDisplayAsLine ? 1 : PLAN_EVENT_DURATION_MINUTES) * 60000
            );

      return {
        id: `${PLAN_EVENT_ID_PREFIX}${plan.id}`,
        calendarId: "plan",
        title: plan.label,
        start: effectiveStart,
        end: effectiveEnd,
        color: PLAN_EVENT_COLOR,
        entryType: "task",
        description: plan.details ?? plan.scheduleSlot ?? undefined,
        displayHint: shouldDisplayAsLine ? "line" : undefined,
      };
    })
    .filter((event): event is CalendarEvent => !!event);
};
