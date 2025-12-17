import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import { apiService, isApiNetworkError } from "@/lib/api";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import type { PlanItem, PlanUpdates } from "@/components/gray/types";
import { PLAN_EVENT_ID_PREFIX } from "@/components/gray/planCalendarUtils";

type CalendarSyncHandlersOptions = {
  userId: number | null;
  plans: PlanItem[];
  setPlans: Dispatch<SetStateAction<PlanItem[]>>;
  calendars: CalendarInfo[];
  setCalendars: Dispatch<SetStateAction<CalendarInfo[]>>;
  events: CalendarEvent[];
  setEvents: Dispatch<SetStateAction<CalendarEvent[]>>;
};

export const useCalendarSyncHandlers = ({
  userId,
  plans,
  setPlans,
  calendars,
  setCalendars,
  events,
  setEvents,
}: CalendarSyncHandlersOptions) => {
  const persistPlanFromCalendarMove = useCallback(
    async (planId: string, updates: PlanUpdates) => {
      if (typeof userId !== "number") {
        return;
      }

      const numericPlanId = Number(planId);
      if (Number.isNaN(numericPlanId)) {
        return;
      }

      const previousPlans = plans;
      const updatedPlans = previousPlans.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              label: updates.label,
              deadline: updates.deadline ?? null,
              scheduleSlot: updates.scheduleSlot ?? null,
              details: updates.details ?? null,
            }
          : plan
      );

      setPlans(updatedPlans);

      try {
        await apiService.updatePlan(userId, numericPlanId, {
          label: updates.label,
          description: updates.details ?? null,
          deadline: updates.deadline ?? null,
          scheduleSlot: updates.scheduleSlot ?? null,
        });
      } catch (error) {
        console.error("Failed to update plan from calendar move:", error);
        setPlans(previousPlans);
      }
    },
    [plans, setPlans, userId]
  );

  const handleCalendarsChange = useCallback(
    (nextCalendars: CalendarInfo[]) => {
      const previousCalendars = new Map(calendars.map((calendar) => [calendar.id, calendar]));
      setCalendars(nextCalendars);

      if (typeof userId !== "number") {
        return;
      }

      nextCalendars.forEach((calendar) => {
        const previous = previousCalendars.get(calendar.id);
        const hasChanged =
          !previous ||
          previous.label !== calendar.label ||
          previous.color !== calendar.color ||
          previous.isVisible !== calendar.isVisible;

        if (!hasChanged) {
          return;
        }

        const calendarId = Number(calendar.id);
        if (Number.isNaN(calendarId)) {
          return;
        }

        apiService
          .updateCalendar(userId, calendarId, {
            label: calendar.label,
            color: calendar.color,
            is_visible: calendar.isVisible,
          })
          .catch((error) => {
            console.error("Failed to update calendar:", error);
          });
      });
    },
    [calendars, setCalendars, userId]
  );

  const handleEventsChange = useCallback(
    async (allEvents: CalendarEvent[]) => {
      const planEvents = allEvents.filter((event) => event.id.startsWith(PLAN_EVENT_ID_PREFIX));
      const standardEvents = allEvents.filter((event) => !event.id.startsWith(PLAN_EVENT_ID_PREFIX));

      planEvents.forEach((event) => {
        const planId = event.id.slice(PLAN_EVENT_ID_PREFIX.length);
        const originalPlan = plans.find((plan) => plan.id === planId);
        if (!originalPlan) {
          return;
        }

        const formatTime = (value: Date) =>
          `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
        const newScheduleSlot = `${formatTime(event.start)}-${formatTime(event.end)}`;

        const existingDeadlineIso = originalPlan.deadline ?? null;
        let nextDeadlineIso = existingDeadlineIso;

        if (existingDeadlineIso) {
          const existingDeadline = new Date(existingDeadlineIso);
          if (!Number.isNaN(existingDeadline.getTime())) {
            const sameDateKey = (value: Date) =>
              `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
            const originalDateKey = sameDateKey(existingDeadline);
            const nextDateKey = sameDateKey(event.start);

            if (originalDateKey !== nextDateKey) {
              const updatedDeadline = new Date(existingDeadline);
              updatedDeadline.setFullYear(
                event.start.getFullYear(),
                event.start.getMonth(),
                event.start.getDate()
              );
              nextDeadlineIso = updatedDeadline.toISOString();
            }
          }
        }

        const scheduleChanged = originalPlan.scheduleSlot !== newScheduleSlot;
        const deadlineChanged = nextDeadlineIso !== existingDeadlineIso;

        if (!scheduleChanged && !deadlineChanged) {
          return;
        }

        void persistPlanFromCalendarMove(planId, {
          label: originalPlan.label,
          details: originalPlan.details ?? null,
          deadline: nextDeadlineIso,
          scheduleSlot: newScheduleSlot,
        });
      });

      const previousEvents = events;
      const previousStandardEvents = previousEvents.filter(
        (event) => !event.id.startsWith(PLAN_EVENT_ID_PREFIX)
      );
      const nextStandardEvents = standardEvents;

      const nextStateEvents = [...nextStandardEvents, ...planEvents];
      setEvents(nextStateEvents);

      if (typeof userId !== "number") {
        return;
      }

      const revertUpdate = (failedId: string) => {
        const original = previousEvents.find((event) => event.id === failedId);
        if (original) {
          setEvents((current) => current.map((event) => (event.id === failedId ? original : event)));
        }
      };

      const revertDelete = (failedId: string) => {
        const original = previousEvents.find((event) => event.id === failedId);
        if (original) {
          setEvents((current) => [...current, original]);
        }
      };

      const revertCreate = (tempId: string) => {
        setEvents((current) => current.filter((event) => event.id !== tempId));
      };

      const logCalendarSyncError = (action: string, error: unknown) => {
        if (isApiNetworkError(error)) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[Calendar sync offline] ${action}`, { message });
          return;
        }
        console.error(`Failed to ${action}:`, error);
      };

      const deletedEventIds = previousStandardEvents
        .filter(
          (previousEvent) =>
            !nextStandardEvents.some((nextEvent) => nextEvent.id === previousEvent.id)
        )
        .map((event) => event.id);

      const newEvents = nextStandardEvents.filter(
        (nextEvent) =>
          !previousStandardEvents.some((previousEvent) => previousEvent.id === nextEvent.id)
      );

      const updatedEvents = nextStandardEvents.filter((nextEvent) => {
        const previousEvent = previousStandardEvents.find((event) => event.id === nextEvent.id);
        if (!previousEvent) {
          return false;
        }
        return (
          previousEvent.title !== nextEvent.title ||
          previousEvent.start.getTime() !== nextEvent.start.getTime() ||
          previousEvent.end.getTime() !== nextEvent.end.getTime() ||
          previousEvent.description !== nextEvent.description ||
          previousEvent.calendarId !== nextEvent.calendarId ||
          previousEvent.color !== nextEvent.color ||
          previousEvent.reminderMinutesBefore !== nextEvent.reminderMinutesBefore
        );
      });

      for (const eventId of deletedEventIds) {
        const numericId = Number(eventId);
        if (Number.isNaN(numericId)) {
          continue;
        }

        try {
          await apiService.deleteCalendarEvent(userId, numericId);
        } catch (error) {
          logCalendarSyncError("delete calendar event", error);
          revertDelete(eventId);
          return;
        }
      }

      for (const event of newEvents) {
        const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
        if (Number.isNaN(numericCalendarId) && event.calendarId !== "default") {
          continue;
        }

        try {
          const createdEvent = await apiService.createCalendarEvent(userId, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            color: event.color,
            reminder_minutes_before: event.reminderMinutesBefore ?? null,
          });

          setEvents((previous) =>
            previous.map((existing) =>
              existing.id === event.id
                ? { ...existing, id: createdEvent.id.toString() }
                : existing
            )
          );
        } catch (error) {
          logCalendarSyncError("create calendar event", error);
          revertCreate(event.id);
          return;
        }
      }

      for (const event of updatedEvents) {
        if (event.id.startsWith("evt-")) {
          const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
          if (Number.isNaN(numericCalendarId) && event.calendarId !== "default") {
            continue;
          }

          try {
            const createdEvent = await apiService.createCalendarEvent(userId, {
              calendar_id: event.calendarId === "default" ? null : numericCalendarId,
              title: event.title,
              description: event.description,
              start_time: event.start.toISOString(),
              end_time: event.end.toISOString(),
              color: event.color,
              reminder_minutes_before: event.reminderMinutesBefore ?? null,
            });

            setEvents((previous) =>
              previous.map((existing) =>
                existing.id === event.id
                  ? { ...existing, id: createdEvent.id.toString() }
                  : existing
              )
            );
          } catch (error) {
            logCalendarSyncError("create calendar event from temporary", error);
          }

          continue;
        }

        const numericEventId = Number(event.id);
        const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
        const shouldSkip =
          Number.isNaN(numericEventId) ||
          (Number.isNaN(numericCalendarId) && event.calendarId !== "default");

        if (shouldSkip) {
          continue;
        }

        try {
          await apiService.updateCalendarEvent(userId, numericEventId, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            color: event.color,
            reminder_minutes_before: event.reminderMinutesBefore ?? null,
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes("Not Found")) {
            continue;
          }

          logCalendarSyncError("update calendar event", error);
          revertUpdate(event.id);
          return;
        }
      }
    },
    [events, persistPlanFromCalendarMove, plans, setEvents, userId]
  );

  return { handleCalendarsChange, handleEventsChange };
};

