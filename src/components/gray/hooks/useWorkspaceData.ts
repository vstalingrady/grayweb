import { useState, useEffect, useCallback } from "react";
import {
  workspaceService,
  calendarService,
  type Calendar,
  type CalendarEvent as ApiCalendarEvent,
  type GoogleCalendarInfo,
  type GoogleCalendarEvent as ApiGoogleCalendarEvent,
} from "@/lib/api";
import { sanitizeEventColor, DEFAULT_EVENT_COLOR } from "@/app/gray/constants";
import { type PlanItem } from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo, CalendarEntryType } from "@/components/calendar/types";

// Custom event name for triggering workspace refresh from anywhere in the app
export const WORKSPACE_REFRESH_EVENT = "gray:workspace-refresh";

const GOOGLE_CALENDAR_PREFIX = "google:";
const GOOGLE_CALENDAR_COLOR_PALETTE = ["#4C6FFF", "#0AD5B0", "#F6A623", "#D075FF", "#E36D7D", "#CDD1D5"] as const;

const hashStringToIndex = (value: string, modulo: number): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % modulo;
  }
  return hash;
};

const resolveGoogleDate = (payload: ApiGoogleCalendarEvent["start"] | ApiGoogleCalendarEvent["end"] | null | undefined): Date | null => {
  if (!payload) {
    return null;
  }
  const raw = payload.dateTime ?? payload.date;
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export function useWorkspaceData(
  userId: number | null,
  variant: "general" | "dashboard" | "chat",
  hasCalendarAccess: boolean,
  loadCalendarDataOverride?: boolean
) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [calendarCalendars, setCalendarCalendars] = useState<CalendarInfo[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refreshPlansAndHabits = useCallback(async () => {
    if (!userId) return;

    try {
      const planResponse = await workspaceService.getPlans(userId);

      const mappedPlans: PlanItem[] = Array.isArray(planResponse)
        ? planResponse.map((plan) => ({
          id: plan.id.toString(),
          label: plan.label,
          completed: Boolean(plan.completed),
          createdAt: plan.created_at,
          updatedAt: plan.updated_at,
          deadline: plan.deadline ?? null,
          scheduleSlot: plan.schedule_slot ?? null,
          details: plan.description ?? null,
          reminderAt: plan.reminder_at ?? null,
          color: plan.color ?? null,
        }))
        : [];

      setPlans(mappedPlans);
    } catch (err) {
      console.error("Failed to refresh plans:", err);
      setError(err);
    }
  }, [userId]);

  const refreshWorkspaceData = useCallback(async () => {
    await refreshPlansAndHabits();
  }, [refreshPlansAndHabits]);

  // Listen for custom event to refresh workspace (dispatched after AI-created plans/reminders)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWorkspaceRefresh = () => {
      void refreshPlansAndHabits();
    };

    window.addEventListener(WORKSPACE_REFRESH_EVENT, handleWorkspaceRefresh);
    return () => {
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, handleWorkspaceRefresh);
    };
  }, [refreshPlansAndHabits]);

  useEffect(() => {
    if (userId === null) {
      return;
    }

    const shouldLoadCalendarData = hasCalendarAccess && (loadCalendarDataOverride ?? variant === "dashboard");
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
          shouldLoadCalendarData
            ? calendarService.getUserCalendars(userId)
            : Promise.resolve<Calendar[]>([]),
          shouldLoadCalendarData
            ? calendarService.getUserCalendarEvents(userId, {
              startDate: startWindow.toISOString(),
              endDate: endWindow.toISOString(),
            })
            : Promise.resolve<ApiCalendarEvent[]>([]),
          shouldLoadCalendarData
            ? calendarService.getGoogleCalendars(userId)
            : Promise.resolve<GoogleCalendarInfo[]>([]),
          workspaceService.getPlans(userId),
        ]);

        if (!isMounted) {
          return;
        }

        const [
          calendarResult,
          eventResult,
          googleCalendarsResult,
          planResult,
        ] = results;

        const calendarResponse = calendarResult.status === 'fulfilled' ? calendarResult.value : [];
        if (calendarResult.status === 'rejected') console.error('Failed to load calendars:', calendarResult.reason);

        const eventResponse = eventResult.status === 'fulfilled' ? eventResult.value : [];
        if (eventResult.status === 'rejected') console.error('Failed to load events:', eventResult.reason);

        const googleCalendarsResponse: GoogleCalendarInfo[] =
          googleCalendarsResult.status === "fulfilled" ? googleCalendarsResult.value : [];
        if (googleCalendarsResult.status === "rejected") {
          // Avoid noisy logs for the common "not connected yet" case.
          const status = (googleCalendarsResult.reason as { status?: number })?.status;
          if (status && status !== 404) {
            console.error("Failed to load Google calendars:", googleCalendarsResult.reason);
          }
        }

        const planResponse = planResult.status === 'fulfilled' ? planResult.value : [];
        if (planResult.status === 'rejected') console.error('Failed to load plans:', planResult.reason);



        const mappedCalendars: CalendarInfo[] = Array.isArray(calendarResponse)
          ? calendarResponse.map((calendar) => ({
            id: calendar.id.toString(),
            label: calendar.label,
            color: sanitizeEventColor(calendar.color),
            isVisible: Boolean(calendar.is_visible),
          }))
          : [];

        const mappedGoogleCalendars: CalendarInfo[] = Array.isArray(googleCalendarsResponse)
          ? googleCalendarsResponse.map((calendar) => {
            const prefixedId = `${GOOGLE_CALENDAR_PREFIX}${calendar.id}`;
            const colorIndex = hashStringToIndex(calendar.id, GOOGLE_CALENDAR_COLOR_PALETTE.length);
            return {
              id: prefixedId,
              label: calendar.summary || calendar.email || "Google Calendar",
              color: sanitizeEventColor(GOOGLE_CALENDAR_COLOR_PALETTE[colorIndex]),
              isVisible: true,
            };
          })
          : [];

        const calendarColorMap = new Map<string, string>(
          [...mappedCalendars, ...mappedGoogleCalendars].map((calendar) => [calendar.id, calendar.color])
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
              entryType: (event.entry_type || "event") as CalendarEntryType,
              isCompleted: event.is_completed,
              recurrence: event.recurrence,
              habitId: event.habit_id,
              reminderAt: event.reminder_at,
              description: event.description ?? undefined,
              reminderMinutesBefore:
                typeof event.reminder_minutes_before === "number" ? event.reminder_minutes_before : null,
            };
          })
          : [];

        const googleEventsResults = mappedGoogleCalendars.length > 0
          ? await Promise.allSettled(
            googleCalendarsResponse.map((calendar) =>
              calendarService.getGoogleCalendarEvents(userId, calendar.id, {
                timeMin: startWindow.toISOString(),
                timeMax: endWindow.toISOString(),
              })
            )
          )
          : [];

        const mappedGoogleEvents: CalendarEvent[] = googleEventsResults.flatMap((result, index) => {
          if (result.status !== "fulfilled") {
            const status = (result.reason as { status?: number })?.status;
            if (status && status !== 404) {
              console.error("Failed to load Google events:", result.reason);
            }
            return [];
          }

          const sourceCalendar = googleCalendarsResponse[index];
          const prefixedCalendarId = `${GOOGLE_CALENDAR_PREFIX}${sourceCalendar.id}`;
          const color = sanitizeEventColor(
            calendarColorMap.get(prefixedCalendarId) ?? fallbackEventColor
          );

          return (Array.isArray(result.value) ? result.value : [])
            .map((event): CalendarEvent | null => {
              const start = resolveGoogleDate(event.start);
              const end = resolveGoogleDate(event.end) ?? start;
              if (!start || !end) {
                return null;
              }

              return {
                id: `${prefixedCalendarId}:${event.id}`,
                calendarId: prefixedCalendarId,
                title: event.summary || "Untitled event",
                start,
                end,
                color,
                entryType: "event",
                description: event.description ?? undefined,
              };
            })
            .filter((event): event is CalendarEvent => Boolean(event));
        });

        const mappedPlans: PlanItem[] = Array.isArray(planResponse)
          ? planResponse.map((plan) => ({
            id: plan.id.toString(),
            label: plan.label,
            completed: Boolean(plan.completed),
            createdAt: plan.created_at,
            updatedAt: plan.updated_at,
            deadline: plan.deadline ?? null,
            scheduleSlot: plan.schedule_slot ?? null,
            details: plan.description ?? null,
            reminderAt: plan.reminder_at ?? null,
            color: plan.color ?? null,
          }))
          : [];

        setCalendarCalendars([...mappedCalendars, ...mappedGoogleCalendars]);
        setCalendarEvents([...mappedEvents, ...mappedGoogleEvents]);
        setPlans(mappedPlans);
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
  }, [userId, variant, hasCalendarAccess, loadCalendarDataOverride]);

  return {
    plans,
    setPlans,
    calendarCalendars,
    setCalendarCalendars,
    calendarEvents,
    setCalendarEvents,
    loading,
    error,
    refreshPlansAndHabits,
    refreshWorkspaceData
  };
}
