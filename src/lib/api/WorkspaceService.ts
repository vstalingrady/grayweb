import { apiFetch } from "./request";
import type {
    Plan,
    Habit,
    Reminder,
    ReminderStatus,
    ReminderCreatePayload,
    ReminderUpdatePayload,
    ProactivitySettings,
    ProactivityNotification
} from "./types";

export class WorkspaceService {
    // Plans
    async getPlans(userId: number, limit?: number): Promise<Plan[]> {
        const endpoint = limit ? `/users/${userId}/plans?limit=${limit}` : `/users/${userId}/plans`;
        return apiFetch<Plan[]>(endpoint);
    }

    async updatePlan(
        userId: number,
        planId: number,
        updateData: {
            label?: string;
            completed?: boolean;
            deadline?: string | null;
            scheduleSlot?: string | null;
            description?: string | null;
            reminderAt?: string | null;
            color?: string | null;
        }
    ): Promise<Plan> {
        const payload: Record<string, unknown> = {};
        if (typeof updateData.label === "string") {
            payload.label = updateData.label;
        }
        if (typeof updateData.completed === "boolean") {
            payload.completed = updateData.completed;
        }
        if ("deadline" in updateData) {
            payload.deadline = updateData.deadline ?? null;
        }
        if ("scheduleSlot" in updateData) {
            payload.schedule_slot = updateData.scheduleSlot ?? null;
        }
        if ("description" in updateData) {
            payload.description = updateData.description ?? null;
        }
        if ("reminderAt" in updateData) {
            payload.reminder_at = updateData.reminderAt ?? null;
        }
        if ("color" in updateData) {
            payload.color = updateData.color ?? null;
        }

        return apiFetch<Plan>(`/users/${userId}/plans/${planId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
    }

    async deletePlan(userId: number, planId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}/plans/${planId}`, {
            method: 'DELETE',
        });
    }

    async createPlan(
        userId: number,
        planData: {
            label: string;
            completed?: boolean;
            deadline?: string | null;
            scheduleSlot?: string | null;
            description?: string | null;
            reminderAt?: string | null;
            color?: string | null;
        }
    ): Promise<Plan> {
        const payload = {
            label: planData.label,
            completed: planData.completed ?? false,
            deadline: planData.deadline ?? null,
            schedule_slot: planData.scheduleSlot ?? null,
            description: planData.description ?? null,
            reminder_at: planData.reminderAt ?? null,
            color: planData.color ?? null,
        };

        return apiFetch<Plan>(`/users/${userId}/plans`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    // Habits
    async getUserHabits(userId: number): Promise<Habit[]> {
        return apiFetch<Habit[]>(`/users/${userId}/habits`);
    }

    async createHabit(
        userId: number,
        habitData: {
            label: string;
            previous_label?: string | null;
            description?: string | null;
            reminderAt?: string | null;
        }
    ): Promise<Habit> {
        const payload = {
            label: habitData.label,
            previous_label: habitData.previous_label ?? "No history yet",
            description: habitData.description ?? null,
            reminder_at: habitData.reminderAt ?? null,
        };

        return apiFetch<Habit>(`/users/${userId}/habits`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async updateHabit(
        userId: number,
        habitId: number,
        updateData: {
            label?: string;
            previous_label?: string | null;
            description?: string | null;
            reminderAt?: string | null;
        }
    ): Promise<Habit> {
        const payload: Record<string, unknown> = {};
        if (typeof updateData.label === "string") {
            payload.label = updateData.label;
        }
        if ("previous_label" in updateData) {
            payload.previous_label = updateData.previous_label ?? null;
        }
        if ("description" in updateData) {
            payload.description = updateData.description ?? null;
        }
        if ("reminderAt" in updateData) {
            payload.reminder_at = updateData.reminderAt ?? null;
        }

        return apiFetch<Habit>(`/users/${userId}/habits/${habitId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    }

    async deleteHabit(userId: number, habitId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}/habits/${habitId}`, {
            method: 'DELETE',
        });
    }

    // Reminders
    async getUserReminders(
        userId: number,
        options: {
            status?: ReminderStatus | string;
            limit?: number;
            deliveryMode?: string;
            entityType?: string;
            includeArchived?: boolean;
        } = {},
    ): Promise<Reminder[]> {
        const params = new URLSearchParams();
        if (options.status) {
            params.set('status_filter', options.status);
        }
        if (typeof options.limit === 'number') {
            params.set('limit', String(options.limit));
        }
        if (options.deliveryMode) {
            params.set('delivery_mode', options.deliveryMode);
        }
        if (options.entityType) {
            params.set('entity_type', options.entityType);
        }
        if (options.includeArchived) {
            params.set('include_archived', 'true');
        }
        const suffix = params.toString();
        const endpoint = suffix ? `/users/${userId}/reminders?${suffix}` : `/users/${userId}/reminders`;
        return apiFetch<Reminder[]>(endpoint);
    }

    async createReminder(userId: number, payload: ReminderCreatePayload): Promise<Reminder> {
        return apiFetch<Reminder>(`/users/${userId}/reminders`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async updateReminder(
        userId: number,
        reminderId: number,
        payload: ReminderUpdatePayload,
    ): Promise<Reminder> {
        return apiFetch<Reminder>(`/users/${userId}/reminders/${reminderId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    }

    async deleteReminder(userId: number, reminderId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}/reminders/${reminderId}`, {
            method: 'DELETE',
        });
    }

    async getProactivitySettings(userId: number): Promise<ProactivitySettings | null> {
        return apiFetch<ProactivitySettings | null>(`/users/${userId}/proactivity/settings`);
    }

    async updateProactivitySettings(
        userId: number,
        settings: ProactivitySettings
    ): Promise<ProactivitySettings> {
        return apiFetch<ProactivitySettings>(`/users/${userId}/proactivity/settings`, {
            method: 'PUT',
            body: JSON.stringify(settings),
        });
    }

    async getProactivityNotifications(
        userId: number,
        options?: { limit?: number; unreadOnly?: boolean }
    ): Promise<ProactivityNotification[]> {
        const params = new URLSearchParams();
        if (options?.limit) {
            params.set('limit', String(options.limit));
        }
        if (options?.unreadOnly) {
            params.set('unread_only', 'true');
        }
        const suffix = params.toString();
        const endpoint = suffix
            ? `/users/${userId}/proactivity/notifications?${suffix}`
            : `/users/${userId}/proactivity/notifications`;
        return apiFetch<ProactivityNotification[]>(endpoint);
    }

    async markProactivityNotificationRead(
        userId: number,
        notificationId: number
    ): Promise<ProactivityNotification> {
        return apiFetch<ProactivityNotification>(
            `/users/${userId}/proactivity/notifications/${notificationId}/read`,
            {
                method: 'POST',
            }
        );
    }

    async triggerProactivityForUser(userId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}/proactivity/evaluate`, {
            method: 'POST',
        });
    }
}

export const workspaceService = new WorkspaceService();
