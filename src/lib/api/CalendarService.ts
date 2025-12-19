import { apiFetch } from "./request";
import type {
    Calendar,
    CalendarEvent,
    GoogleAuthResponse,
    GoogleCalendarInfo,
    GoogleCalendarEvent
} from "./types";

export class CalendarService {
    async getUserCalendarEvents(userId: number, options?: { startDate?: string; endDate?: string }): Promise<CalendarEvent[]> {
        const params = new URLSearchParams();
        if (options?.startDate) {
            params.set("start_date", options.startDate);
        }
        if (options?.endDate) {
            params.set("end_date", options.endDate);
        }
        const suffix = params.toString();
        const endpoint = suffix ? `/users/${userId}/calendar-events?${suffix}` : `/users/${userId}/calendar-events`;
        return apiFetch<CalendarEvent[]>(endpoint);
    }

    async getUserCalendars(userId: number): Promise<Calendar[]> {
        return apiFetch<Calendar[]>(`/users/${userId}/calendars`);
    }

    async updateCalendar(userId: number, calendarId: number, updateData: Partial<Pick<Calendar, 'label' | 'color' | 'is_visible'>>): Promise<Calendar> {
        return apiFetch<Calendar>(`/users/${userId}/calendars/${calendarId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData),
        });
    }

    async getCalendarEvents(userId: number, calendarId?: number): Promise<CalendarEvent[]> {
        const query = calendarId ? `?calendar_id=${calendarId}` : '';
        return apiFetch<CalendarEvent[]>(`/users/${userId}/calendar-events${query}`);
    }

    async createCalendarEvent(userId: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
        return apiFetch<CalendarEvent>(`/users/${userId}/calendar-events`, {
            method: 'POST',
            body: JSON.stringify(event),
        });
    }

    async updateCalendarEvent(userId: number, eventId: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
        return apiFetch<CalendarEvent>(`/users/${userId}/calendar-events/${eventId}`, {
            method: 'PATCH',
            body: JSON.stringify(event),
        });
    }

    async deleteCalendarEvent(userId: number, eventId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}/calendar-events/${eventId}`, {
            method: 'DELETE',
        });
    }

    async requestGoogleCalendarAuth(userId: number, options?: { redirectUri?: string }): Promise<GoogleAuthResponse> {
        const payload: Record<string, unknown> = { user_id: userId };
        if (options?.redirectUri) {
            payload.redirect_uri = options.redirectUri;
        }

        return apiFetch<GoogleAuthResponse>(`/users/${userId}/google-calendar/auth`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async getGoogleCalendars(userId: number): Promise<GoogleCalendarInfo[]> {
        return apiFetch<GoogleCalendarInfo[]>(`/users/${userId}/google-calendars`);
    }

    async getGoogleCalendarEvents(
        userId: number,
        calendarId: string,
        options?: { timeMin?: string; timeMax?: string }
    ): Promise<GoogleCalendarEvent[]> {
        const params = new URLSearchParams();
        if (options?.timeMin) {
            params.set('time_min', options.timeMin);
        }
        if (options?.timeMax) {
            params.set('time_max', options.timeMax);
        }
        const suffix = params.toString();
        const encodedCalendarId = encodeURIComponent(calendarId);
        const endpoint = suffix
            ? `/users/${userId}/google-calendars/${encodedCalendarId}/events?${suffix}`
            : `/users/${userId}/google-calendars/${encodedCalendarId}/events`;
        return apiFetch<GoogleCalendarEvent[]>(endpoint);
    }
}

export const calendarService = new CalendarService();
