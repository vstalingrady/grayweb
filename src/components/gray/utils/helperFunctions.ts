import type { ChatSession, GrayReminderCreatedPayload } from "@/components/gray/chat/types";
import { GENERAL_CHAT_SESSION_ID } from "@/components/gray/chat/constants";
import type { CalendarEvent } from "@/components/calendar/types";
import type { Reminder, User } from "@/lib/api";
import { REMINDER_RETENTION_WINDOW_MS } from "@/app/gray/constants";
import { REMINDER_PLAN_ID_PREFIX } from "./constants";

export const buildGeneralChatSession = (): ChatSession => ({
    id: GENERAL_CHAT_SESSION_ID,
    title: "General Chat",
    titleMode: "auto",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    isResponding: false,
    scope: "general",
    conversationId: undefined,
    pendingAutoStream: false,
});

export const deriveReminderScheduleIso = (reminder: GrayReminderCreatedPayload): string | null => {
    const reminderRecord = (reminder.data.reminder as Record<string, unknown> | null | undefined) ?? null;
    if (reminderRecord && typeof reminderRecord["remind_at"] === "string") {
        return reminderRecord["remind_at"] as string;
    }
    if (typeof reminder.data.time_iso === "string" && reminder.data.time_iso.trim().length > 0) {
        return reminder.data.time_iso.trim();
    }
    return null;
};

export const buildReminderEventKey = (reminder: GrayReminderCreatedPayload): string => {
    const reminderRecord = (reminder.data.reminder as Record<string, unknown> | null | undefined) ?? null;
    const legacyId =
        typeof reminderRecord?.["reminder_id"] === "number"
            ? `${reminderRecord["reminder_id"]}`
            : typeof reminderRecord?.["reminder_id"] === "string"
                ? reminderRecord["reminder_id"]
                : typeof reminderRecord?.["id"] === "number"
                    ? `${reminderRecord["id"]}`
                    : typeof reminderRecord?.["id"] === "string"
                        ? reminderRecord["id"]
                        : undefined;

    const numericId = Number(legacyId);
    if (!Number.isNaN(numericId) && numericId > 0) {
        return `${numericId}`;
    }

    const primaryId = reminder.data.id ?? legacyId ?? reminder.data.label ?? "reminder";
    const scheduleIso = deriveReminderScheduleIso(reminder) ?? "unscheduled";
    const source = reminder.source ?? "assistant";
    return `${source}-${primaryId}-${scheduleIso}`;
};

export const buildCalendarEventFromReminder = (
    reminder: GrayReminderCreatedPayload,
    eventKey: string,
    calendarId: string,
    color: string
): CalendarEvent | null => {
    const scheduleIso = deriveReminderScheduleIso(reminder);
    if (!scheduleIso) {
        return null;
    }
    const start = new Date(scheduleIso);
    if (Number.isNaN(start.getTime())) {
        return null;
    }
    const end = new Date(start.getTime() + 60_000);
    const reminderRecord = (reminder.data.reminder as Record<string, unknown> | null | undefined) ?? null;
    const rawRecord = (reminder.data.raw as Record<string, unknown> | null | undefined) ?? null;

    // Check for color in metadata
    let effectiveColor = color;
    if (reminderRecord && typeof reminderRecord["metadata"] === "object" && reminderRecord["metadata"]) {
        const metadata = reminderRecord["metadata"] as Record<string, unknown>;
        if (typeof metadata["color"] === "string" && metadata["color"]) {
            effectiveColor = metadata["color"];
        }
    }

    const summaryCandidate =
        reminder.data.summary ??
        (reminderRecord && typeof reminderRecord["description"] === "string"
            ? reminderRecord["description"]
            : null) ??
        (rawRecord && typeof rawRecord["description"] === "string"
            ? rawRecord["description"]
            : null);
    const title = reminder.data.label?.trim() || "Reminder";
    const description = summaryCandidate ? String(summaryCandidate) : undefined;
    return {
        id: `reminder-${eventKey}`,
        calendarId,
        title,
        start,
        end,
        color: effectiveColor,
        entryType: "task",
        description,
        displayHint: "line",
    };
};

export const shouldIncludeCalendarReminder = (reminder: Reminder, nowMs: number): boolean => {
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

export const isGenericSessionTitle = (title: string | null | undefined): boolean => {
    if (!title) {
        return true;
    }
    const trimmed = title.trim();
    if (!trimmed) {
        return true;
    }
    const normalized = trimmed.toLowerCase();
    return normalized === "new chat" || normalized === "conversation start";
};

export type PlanCarrierUser = User & { plan_tier?: string | null };

const PREMIUM_PLAN_TIER_TOKENS = new Set(["depth", "pro", "premium", "operator", "admin"]);

export type NormalizedPlanTier = "scout" | "voyager" | "pioneer";

export const normalizePlanTier = (candidate?: PlanCarrierUser | null): NormalizedPlanTier => {
    if (!candidate) {
        return "scout";
    }
    const rawTier = (candidate.plan_tier ?? candidate.role ?? "scout").trim().toLowerCase();
    if (rawTier === "voyager") {
        return "voyager";
    }
    if (rawTier === "pioneer") {
        return "pioneer";
    }
    if (rawTier === "scout") {
        return "scout";
    }
    if (PREMIUM_PLAN_TIER_TOKENS.has(rawTier)) {
        return "pioneer";
    }
    return "scout";
};

export const derivePlanTierLabel = (candidate?: PlanCarrierUser | null): string => {
    if (!candidate) {
        return "Scout";
    }
    const rawTier = (candidate.plan_tier ?? candidate.role ?? "").trim();
    if (!rawTier) {
        return "Scout";
    }
    const normalized = rawTier.toLowerCase();
    if (normalized === "voyager") {
        return "Voyager";
    }
    if (normalized === "pioneer") {
        return "Pioneer";
    }
    if (normalized === "scout") {
        return "Scout";
    }
    if (PREMIUM_PLAN_TIER_TOKENS.has(normalized)) {
        return "Depth";
    }
    return "Pioneer";
};

export const getSessionSeedFingerprint = (session: ChatSession): string | null => {
    if (!session || session.scope !== "thread" || !Array.isArray(session.messages)) {
        return null;
    }
    const seedMessage = session.messages.find(
        (message) => message.role === "user" && message.content.trim().length > 0
    );
    if (!seedMessage) {
        return null;
    }
    return seedMessage.content.trim().toLowerCase();
};

export const getReadableSessionTitle = (session: ChatSession): string => {
    const title = session.title?.trim();
    if (title && title.length > 0) {
        return title;
    }
    return "New Chat";
};

export const parseReminderPlanId = (planId: string): number | null => {
    if (!planId.startsWith(REMINDER_PLAN_ID_PREFIX)) {
        return null;
    }
    const candidate = planId.slice(REMINDER_PLAN_ID_PREFIX.length);
    if (!candidate) {
        return null;
    }
    const parsed = Number(candidate);
    return Number.isNaN(parsed) ? null : parsed;
};

export const extractReminderId = (eventId: string): number | null => {
    if (!eventId.startsWith("reminder-")) return null;
    const parts = eventId.split("-");
    // Expected: reminder-{source}-{id}-{iso}
    // We assume source doesn't contain hyphens usually, but if it does, we might be in trouble.
    // However, based on buildReminderEventKey, source is usually 'assistant'.
    // Let's try to parse the 3rd part (index 2).
    if (parts.length >= 3) {
        const candidate = Number(parts[2]);
        if (!Number.isNaN(candidate)) {
            return candidate;
        }
    }
    // Fallback: try regex
    const match = eventId.match(/^reminder-[^-]+-(\d+)-/);
    if (match) {
        return Number(match[1]);
    }
    return null;
};

export const deriveInitials = (fullName: string | null | undefined) => {
    if (!fullName) {
        return "";
    }

    const parts = fullName
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean);

    if (!parts.length) {
        return "";
    }

    if (parts.length === 1) {
        const [first] = parts;
        return first.slice(0, Math.min(first.length, 2)).toUpperCase();
    }

    const firstInitial = parts[0][0] ?? "";
    const lastInitial = parts[parts.length - 1][0] ?? "";
    return `${firstInitial}${lastInitial}`.toUpperCase();
};

export const greetingForDate = (date: Date) => {
    const hour = date.getHours();
    if (hour < 12) {
        return "morning";
    }
    if (hour < 18) {
        return "afternoon";
    }
    return "evening";
};
