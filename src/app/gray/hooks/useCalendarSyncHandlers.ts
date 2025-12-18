import { useCallback } from "react";
import { calendarService, workspaceService } from "@/lib/api";
import { type CalendarEvent, type CalendarInfo } from "@/components/calendar/types";
import { PLAN_EVENT_ID_PREFIX } from "@/components/gray/planCalendarUtils";
import { type PlanItem } from "@/components/gray/types";

// Helper to determine if an error is a network error
const isApiNetworkError = (error: unknown) => {
  return error instanceof Error && (
    error.message.includes("network") ||
    error.message.includes("fetch") ||
    error.message.includes("Failed to fetch")
  );
};

export const useCalendarSyncHandlers = (
  userId: number | null,
  plans: PlanItem[],
  events: CalendarEvent[],
  calendars: CalendarInfo[],
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>,
  setCalendars: React.Dispatch<React.SetStateAction<CalendarInfo[]>>
) => {
  const persistPlanFromCalendarMove = useCallback(
    async (planId: number, update: { label: string; deadline: string | null; scheduleSlot: string | null; description: string | null }) => {
      if (userId === null) return;
      try {
        await workspaceService.updatePlan(userId, planId, {
          label: update.label,
          deadline: update.deadline,
          scheduleSlot: update.scheduleSlot,
          description: update.description,
        });
      } catch (error) {
        console.error("Failed to sync plan move:", error);
      }
    },
    [userId]
  );

  const handleCalendarsChange = useCallback(
    async (nextCalendars: CalendarInfo[]) => {
      const previousCalendars = calendars;
      setCalendars(nextCalendars);

      if (typeof userId !== "number") {
        return;
      }

      nextCalendars.forEach((calendar) => {
        const prev = previousCalendars.find((c) => c.id === calendar.id);
        if (!prev) return;

        if (prev.isVisible === calendar.isVisible && prev.label === calendar.label && prev.color === calendar.color) {
          return;
        }

        const numericId = Number(calendar.id);
        if (Number.isNaN(numericId)) return;

        calendarService
          .updateCalendar(userId, numericId, {
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

      // 1. Sync Plans
      planEvents.forEach((event) => {
        const planIdStr = event.id.slice(PLAN_EVENT_ID_PREFIX.length);
        const planId = Number(planIdStr);
        if (Number.isNaN(planId)) return;

        const originalPlan = plans.find((p) => p.id === String(planId));
        if (!originalPlan) return;

        const newScheduleSlot = event.start.toTimeString().slice(0, 5);
        const nextDeadlineIso = event.start.toISOString().split("T")[0];

        const scheduleChanged = originalPlan.scheduleSlot !== newScheduleSlot;
        const deadlineChanged = originalPlan.deadline !== nextDeadlineIso;

        if (!scheduleChanged && !deadlineChanged) {
          return;
        }

        void persistPlanFromCalendarMove(planId, {
          label: originalPlan.label,
          description: originalPlan.details ?? null,
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

      // Revert helpers
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

      // 2. Identify changes
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
        if (!previousEvent) return false;

        return (
          previousEvent.title !== nextEvent.title ||
          previousEvent.start.getTime() !== nextEvent.start.getTime() ||
          previousEvent.end.getTime() !== nextEvent.end.getTime() ||
          previousEvent.description !== nextEvent.description ||
          previousEvent.calendarId !== nextEvent.calendarId ||
          previousEvent.color !== nextEvent.color ||
          previousEvent.reminderMinutesBefore !== nextEvent.reminderMinutesBefore ||
          previousEvent.reminderAt !== nextEvent.reminderAt ||
          previousEvent.entryType !== nextEvent.entryType ||
          previousEvent.isCompleted !== nextEvent.isCompleted ||
          previousEvent.recurrence !== nextEvent.recurrence
        );
      });

      // 3. Process Deletes
      for (const eventId of deletedEventIds) {
        const numericId = Number(eventId);
        if (Number.isNaN(numericId)) continue;
        try {
          await calendarService.deleteCalendarEvent(userId, numericId);
        } catch (error) {
          logCalendarSyncError("delete calendar event", error);
          revertDelete(eventId);
          return;
        }
      }

      // 4. Process Creates
      for (const event of newEvents) {
        const numericCalendarId = event.calendarId ? (event.calendarId === "default" ? null : Number(event.calendarId)) : null;
        if (numericCalendarId !== null && Number.isNaN(numericCalendarId)) continue;

        try {
          const createdEvent = await calendarService.createCalendarEvent(userId, {
            calendar_id: numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            color: event.color,
            reminder_minutes_before: event.reminderMinutesBefore ?? null,
            entry_type: event.entryType || "event",
            is_completed: event.isCompleted || false,
            recurrence: event.recurrence,
            habit_id: event.habitId,
            reminder_at: event.reminderAt || undefined,
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

      // 5. Process Updates
      for (const event of updatedEvents) {
        const numericId = Number(event.id);
        if (!Number.isNaN(numericId)) {
          const numericCalendarId = event.calendarId ? (event.calendarId === "default" ? null : Number(event.calendarId)) : null;
          if (numericCalendarId !== null && Number.isNaN(numericCalendarId)) continue;

          try {
            await calendarService.updateCalendarEvent(userId, numericId, {
              calendar_id: numericCalendarId,
              title: event.title,
              description: event.description,
              start_time: event.start.toISOString(),
              end_time: event.end.toISOString(),
              color: event.color,
              reminder_minutes_before: event.reminderMinutesBefore ?? null,
              entry_type: event.entryType || "event",
              is_completed: event.isCompleted || false,
              recurrence: event.recurrence,
              habit_id: event.habitId,
              reminder_at: event.reminderAt || undefined,
            });
          } catch (error) {
            logCalendarSyncError("update calendar event", error);
            revertUpdate(event.id);
            return;
          }
        } else if (event.id.startsWith("evt-")) {
          // Fallback for temporary IDs that actually represent changes
          const numericCalendarId = event.calendarId ? (event.calendarId === "default" ? null : Number(event.calendarId)) : null;
          if (numericCalendarId !== null && Number.isNaN(numericCalendarId)) continue;

          try {
            const createdEvent = await calendarService.createCalendarEvent(userId, {
              calendar_id: numericCalendarId,
              title: event.title,
              description: event.description,
              start_time: event.start.toISOString(),
              end_time: event.end.toISOString(),
              color: event.color,
              reminder_minutes_before: event.reminderMinutesBefore ?? null,
              entry_type: event.entryType || "event",
              is_completed: event.isCompleted || false,
              recurrence: event.recurrence,
              habit_id: event.habitId,
              reminder_at: event.reminderAt || undefined,
            });

            setEvents((previous) =>
              previous.map((existing) =>
                existing.id === event.id
                  ? { ...existing, id: createdEvent.id.toString() }
                  : existing
              )
            );
          } catch (error) {
            logCalendarSyncError("create calendar event (temp update)", error);
            revertCreate(event.id);
            return;
          }
        }
      }
    },
    [events, persistPlanFromCalendarMove, plans, setEvents, userId]
  );

  return { handleCalendarsChange, handleEventsChange };
};
