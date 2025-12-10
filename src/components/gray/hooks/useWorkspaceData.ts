import { useState, useEffect, useCallback, useRef } from "react";
import { apiService, type Plan, type Habit, type Calendar, type Reminder } from "@/lib/api";
import { sanitizeEventColor, DEFAULT_EVENT_COLOR, REMINDER_RETENTION_WINDOW_MS } from "@/app/gray/constants";
import { type PlanItem, type HabitItem } from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";

// Custom event name for triggering reminder refresh from anywhere in the app
export const REMINDERS_REFRESH_EVENT = "gray:reminders-refresh";

const shouldIncludeCalendarReminder = (reminder: Reminder, nowMs: number): boolean => {
  if (reminder.status === "pending") {
    return true;
  }
  if (reminder.status !== "delivered") {
    return false;
  }
  const remindAt = Date.parse(reminder.remind_at);
  if (!Number.isFinite(remindAt)) {
    return false;
  }
  return remindAt >= nowMs - REMINDER_RETENTION_WINDOW_MS;
};

export function useWorkspaceData(userId: number | null, variant: "general" | "dashboard" | "chat") {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [reminderPlans, setReminderPlans] = useState<PlanItem[]>([]);
  const [calendarCalendars, setCalendarCalendars] = useState<CalendarInfo[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [streakCount, setStreakCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refreshPlansAndHabits = useCallback(async () => {
    if (!userId) return;

    try {
      const [planResponse, habitResponse] = await Promise.all([
        apiService.getUserPlans(userId),
        apiService.getUserHabits(userId),
      ]);

      const mappedPlans: PlanItem[] = Array.isArray(planResponse)
        ? planResponse.map((plan) => ({
          id: plan.id.toString(),
          label: plan.label,
          completed: Boolean(plan.completed),
          deadline: plan.deadline ?? null,
          scheduleSlot: plan.schedule_slot ?? null,
          details: plan.description ?? null,
        }))
        : [];

      const mappedHabits: HabitItem[] = Array.isArray(habitResponse)
        ? habitResponse.map((habit) => ({
          id: habit.id.toString(),
          label: habit.label,
          streakLabel: habit.streak_label,
          previousLabel: habit.previous_label,
          completed: false,
        }))
        : [];

      setPlans(mappedPlans);
      setHabits(mappedHabits);
    } catch (err) {
      console.error("Failed to refresh plans and habits:", err);
      setError(err);
    }
  }, [userId]);

  const refreshReminders = useCallback(async () => {
    if (!userId) return;

    try {
      const reminderResponse = await apiService.getUserReminders(userId, {
        limit: 50,
        includeArchived: true,
      });

      const nowMs = Date.now();
      const includedReminders: Reminder[] = Array.isArray(reminderResponse)
        ? reminderResponse.filter((reminder) => shouldIncludeCalendarReminder(reminder, nowMs))
        : [];

      setReminderPlans(
        includedReminders.map((reminder) => ({
          id: `reminder-${reminder.id}`,
          label: reminder.label,
          completed: reminder.status === "completed",
          deadline: reminder.remind_at ?? null,
          scheduleSlot: null,
          details: reminder.description ?? reminder.summary ?? null,
          reminderId: reminder.id,
          reminderStatus: reminder.status,
        }))
      );
    } catch (err) {
      console.error("Failed to refresh reminders:", err);
      setError(err);
    }
  }, [userId]);

  const refreshWorkspaceData = useCallback(async () => {
    await Promise.all([
      refreshPlansAndHabits(),
      refreshReminders(),
    ]);
  }, [refreshPlansAndHabits, refreshReminders]);

  // Listen for custom event to refresh reminders (dispatched by ChatProvider after reminder creation)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRemindersRefresh = () => {
      void refreshReminders();
    };

    window.addEventListener(REMINDERS_REFRESH_EVENT, handleRemindersRefresh);
    return () => {
      window.removeEventListener(REMINDERS_REFRESH_EVENT, handleRemindersRefresh);
    };
  }, [refreshReminders]);

  useEffect(() => {
    if (variant === "chat" || userId === null) {
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadWorkspaceData = async () => {
      try {
        const now = new Date();
        const startWindow = new Date(now);
        startWindow.setMonth(now.getMonth() - 3);
        const endWindow = new Date(now);
        endWindow.setMonth(now.getMonth() + 12);

        const results = await Promise.allSettled([
          apiService.getUserCalendars(userId),
          apiService.getUserCalendarEvents(userId, {
            startDate: startWindow.toISOString(),
            endDate: endWindow.toISOString(),
          }),
          apiService.getUserPlans(userId),
          apiService.getUserHabits(userId),
          apiService.getUserReminders(userId, {
            limit: 50,
            includeArchived: true,
          }),
          apiService.getUserStreak(userId),
        ]);

        if (!isMounted) {
          return;
        }

        const [
          calendarResult,
          eventResult,
          planResult,
          habitResult,
          reminderResult,
          streakResult,
        ] = results;

        const calendarResponse = calendarResult.status === 'fulfilled' ? calendarResult.value : [];
        if (calendarResult.status === 'rejected') console.error('Failed to load calendars:', calendarResult.reason);

        const eventResponse = eventResult.status === 'fulfilled' ? eventResult.value : [];
        if (eventResult.status === 'rejected') console.error('Failed to load events:', eventResult.reason);

        const planResponse = planResult.status === 'fulfilled' ? planResult.value : [];
        if (planResult.status === 'rejected') console.error('Failed to load plans:', planResult.reason);

        const habitResponse = habitResult.status === 'fulfilled' ? habitResult.value : [];
        if (habitResult.status === 'rejected') console.error('Failed to load habits:', habitResult.reason);

        const reminderResponse = reminderResult.status === 'fulfilled' ? reminderResult.value : [];
        if (reminderResult.status === 'rejected') console.error('Failed to load reminders:', reminderResult.reason);

        const streakResponse = streakResult.status === 'fulfilled' ? streakResult.value : null;
        if (streakResult.status === 'rejected') console.error('Failed to load streak:', streakResult.reason);



        const mappedCalendars: CalendarInfo[] = Array.isArray(calendarResponse)
          ? calendarResponse.map((calendar) => ({
            id: calendar.id.toString(),
            label: calendar.label,
            color: sanitizeEventColor(calendar.color),
            isVisible: Boolean(calendar.is_visible),
          }))
          : [];

        const calendarColorMap = new Map<string, string>(
          mappedCalendars.map((calendar) => [calendar.id, calendar.color])
        );

        const fallbackCalendarId = mappedCalendars[0]?.id ?? "default";
        const fallbackEventColor = sanitizeEventColor(
          calendarColorMap.get(fallbackCalendarId) ?? DEFAULT_EVENT_COLOR
        );

        const mappedEvents: CalendarEvent[] = Array.isArray(eventResponse)
          ? eventResponse.map((event) => {
            const associatedCalendarId = event.calendar_id
              ? event.calendar_id.toString()
              : fallbackCalendarId;
            return {
              id: event.id.toString(),
              calendarId: associatedCalendarId,
              title: event.title,
              start: new Date(event.start_time),
              end: new Date(event.end_time),
              color: sanitizeEventColor(
                calendarColorMap.get(associatedCalendarId) ?? fallbackEventColor
              ),
              entryType: "event",
              description: event.description ?? undefined,
            };
          })
          : [];

        const nowMs = Date.now();
        const includedReminders: Reminder[] = Array.isArray(reminderResponse)
          ? reminderResponse.filter((reminder) => shouldIncludeCalendarReminder(reminder, nowMs))
          : [];

        const reminderEvents: CalendarEvent[] = includedReminders.map<CalendarEvent>((reminder) => ({
          id: `reminder-${reminder.id}`,
          calendarId: "reminder",
          title: reminder.label,
          start: new Date(reminder.remind_at),
          end: new Date(reminder.remind_at),
          color: sanitizeEventColor(
            calendarColorMap.get(fallbackCalendarId) ?? fallbackEventColor
          ),
          entryType: "reminder",
          displayHint: "line",
          description: reminder.summary ?? reminder.description ?? undefined,
          reminderId: reminder.id,
          reminderStatus: reminder.status,
        }));

        const mappedPlans: PlanItem[] = Array.isArray(planResponse)
          ? planResponse.map((plan) => ({
            id: plan.id.toString(),
            label: plan.label,
            completed: Boolean(plan.completed),
            deadline: plan.deadline ?? null,
            scheduleSlot: plan.schedule_slot ?? null,
            details: plan.description ?? null,
          }))
          : [];

        const mappedHabits: HabitItem[] = Array.isArray(habitResponse)
          ? habitResponse.map((habit) => ({
            id: habit.id.toString(),
            label: habit.label,
            streakLabel: habit.streak_label,
            previousLabel: habit.previous_label,
            completed: false,
          }))
          : [];

        setCalendarCalendars(mappedCalendars);
        setCalendarEvents([...mappedEvents, ...reminderEvents]);
        setPlans(mappedPlans);
        setHabits(mappedHabits);
        setReminderPlans(
          includedReminders.map((reminder) => ({
            id: `reminder-${reminder.id}`,
            label: reminder.label,
            completed: reminder.status === "completed",
            deadline: reminder.remind_at ?? null,
            scheduleSlot: null,
            details: reminder.description ?? reminder.summary ?? null,
            reminderId: reminder.id,
            reminderStatus: reminder.status,
          }))
        );
        setStreakCount(streakResponse?.current_streak ?? 0);
      } catch (err) {
        console.error("Failed to load workspace data:", err);
        setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadWorkspaceData();

    return () => {
      isMounted = false;
    };
  }, [userId, variant]);

  return {
    plans,
    setPlans,
    habits,
    setHabits,
    reminderPlans,
    setReminderPlans,
    calendarCalendars,
    setCalendarCalendars,
    calendarEvents,
    setCalendarEvents,
    streakCount,
    loading,
    error,
    refreshPlansAndHabits,
    refreshReminders,
    refreshWorkspaceData
  };
}
