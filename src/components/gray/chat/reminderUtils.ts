import type {
    GrayReminderCreatedPayload,
    GrayReminderPayloadType,
    GrayReminderEntityType,
    GrayReminderStatus,
    GrayReminderSource,
} from "./types";
import {
    REMINDER_PRE_BLOCK_REGEX,
    EMPTY_CODE_FENCE_REGEX,
    REMINDER_CODE_BLOCK_REGEX,
} from "./constants";
import { formatReminderDateLabel, formatReminderSlotLabel } from "../reminderTimeUtils";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ReminderConfig = {
    start: number;
    end: number;
    reminder: GrayReminderCreatedPayload;
};

const REMINDER_STATUS_VALUES: GrayReminderStatus[] = ["created", "updated", "completed", "deleted"];
const REMINDER_TYPE_VALUES: GrayReminderPayloadType[] = ["gray.reminder", "gray.plan", "gray.habit"];
const REMINDER_SOURCE_VALUES: GrayReminderSource[] = ["mcp/plans-habits-server", "mcp"];

const normalizeReminderType = (value: unknown): GrayReminderPayloadType | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return REMINDER_TYPE_VALUES.find((type) => type === normalized) ?? null;
};

const normalizeReminderSource = (value: unknown): GrayReminderSource | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return REMINDER_SOURCE_VALUES.find((source) => source === normalized) ?? null;
};

const normalizeReminderStatus = (value: unknown): GrayReminderStatus | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return REMINDER_STATUS_VALUES.find((status) => status === normalized) ?? null;
};

const normalizeReminderEntity = (
    value: unknown,
    fallbackType?: GrayReminderPayloadType | null
): GrayReminderEntityType => {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (normalized.startsWith("habit")) {
        return "habit";
    }
    if (normalized.startsWith("plan")) {
        return "plan";
    }
    if (normalized.startsWith("reminder")) {
        return "reminder";
    }
    if (fallbackType === "gray.habit") {
        return "habit";
    }
    if (fallbackType === "gray.plan") {
        return "plan";
    }
    return "reminder";
};

const isFullReminderPayload = (candidate: Partial<GrayReminderCreatedPayload>): candidate is GrayReminderCreatedPayload => {
    const type = normalizeReminderType(candidate?.type);
    const status = normalizeReminderStatus(candidate?.status);
    const source = normalizeReminderSource(candidate?.source);
    if (!candidate || !type || !status || !source) {
        return false;
    }
    if (!(candidate.entity === "plan" || candidate.entity === "habit" || candidate.entity === "reminder")) {
        return false;
    }
    const data = candidate.data;
    return (
        data != null &&
        typeof data.id !== "undefined" &&
        typeof data.user_id === "number" &&
        typeof data.label === "string"
    );
};

const toNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const coerceLegacyReminderPayload = (candidate: Record<string, unknown>): GrayReminderCreatedPayload | null => {
    const label = typeof candidate.label === "string" ? candidate.label : null;
    const triggerTimeCandidate =
        typeof candidate.trigger_time === "string"
            ? candidate.trigger_time
            : typeof candidate.remind_at === "string"
                ? candidate.remind_at
                : null;
    const triggerTime = triggerTimeCandidate;
    if (!label && !triggerTime) {
        return null;
    }
    const normalizedType = normalizeReminderType(candidate.type) ?? "gray.reminder";
    const entity = normalizeReminderEntity(candidate.entity ?? candidate.type, normalizedType);
    const deliveryMode =
        typeof candidate.delivery_mode === "string" ? candidate.delivery_mode : entity;
    const reminderStatus = normalizeReminderStatus(candidate.status);
    const summary =
        typeof candidate.summary === "string"
            ? candidate.summary
            : typeof candidate.description === "string"
                ? candidate.description
                : null;
    const legacyId = (candidate.id ?? candidate.reminder_id) as string | number | undefined;
    const normalizedId =
        typeof legacyId === "string" || typeof legacyId === "number"
            ? legacyId
            : label ?? triggerTime ?? `legacy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const numericUserId = toNumber(candidate.user_id) ?? 0;

    const reminderRecord: Record<string, unknown> = {};
    if (legacyId !== undefined) {
        reminderRecord.id = legacyId;
    }
    if (reminderStatus) {
        reminderRecord.status = reminderStatus;
    }
    if (triggerTime) {
        reminderRecord.remind_at = triggerTime;
    }

    return {
        type: normalizedType,
        source: normalizeReminderSource(candidate.source) ?? "mcp/plans-habits-server",
        status: reminderStatus ?? "created",
        entity,
        delivery_mode: deliveryMode,
        data: {
            id: normalizedId,
            user_id: numericUserId,
            label: label ?? "Untitled reminder",
            time_iso: triggerTime,
            raw: candidate,
            delivery_mode: deliveryMode,
            summary,
            reminder_id: legacyId ?? null,
            reminder_status: reminderStatus ?? undefined,
            reminder: Object.keys(reminderRecord).length ? reminderRecord : null,
        },
    };
};

const coerceStructuredReminderPayload = (candidate: Record<string, unknown>): GrayReminderCreatedPayload | null => {
    if (isFullReminderPayload(candidate as Partial<GrayReminderCreatedPayload>)) {
        return candidate as GrayReminderCreatedPayload;
    }

    const type = normalizeReminderType(candidate.type);
    const status = normalizeReminderStatus(candidate.status) ?? "created";
    const data = candidate.data;
    if (!type || !data || typeof data !== "object" || Array.isArray(data)) {
        return null;
    }

    const label = typeof (data as Record<string, unknown>).label === "string"
        ? (data as Record<string, unknown>).label
        : null;
    const reminderId =
        (data as Record<string, unknown>).id ?? (data as Record<string, unknown>).reminder_id;
    const userId = toNumber((data as Record<string, unknown>).user_id);
    if (!label || typeof reminderId === "undefined" || typeof userId !== "number") {
        return null;
    }

    const entity = normalizeReminderEntity(
        candidate.entity ?? (data as Record<string, unknown>).entity ?? (data as Record<string, unknown>).entity_type,
        type
    );
    const deliveryMode =
        typeof candidate.delivery_mode === "string"
            ? candidate.delivery_mode
            : typeof (data as Record<string, unknown>).delivery_mode === "string"
                ? (data as Record<string, unknown>).delivery_mode as string
                : entity;
    const reminderStatus =
        typeof (data as Record<string, unknown>).reminder_status === "string"
            ? (data as Record<string, unknown>).reminder_status
            : status;
    const reminderRecord =
        typeof (data as Record<string, unknown>).reminder === "object" &&
            (data as Record<string, unknown>).reminder !== null
            ? (data as Record<string, unknown>).reminder as Record<string, unknown>
            : null;
    const timeIso =
        typeof (data as Record<string, unknown>).time_iso === "string"
            ? (data as Record<string, unknown>).time_iso
            : typeof (data as Record<string, unknown>).remind_at === "string"
                ? (data as Record<string, unknown>).remind_at
                : null;

    return {
        type,
        source: normalizeReminderSource(candidate.source) ?? "mcp/plans-habits-server",
        status,
        entity,
        delivery_mode: deliveryMode,
        data: {
            ...(data as Record<string, unknown>),
            id: reminderId as string | number,
            user_id: userId,
            label,
            time_iso: timeIso,
            delivery_mode: deliveryMode,
            reminder_id: (data as Record<string, unknown>).reminder_id ?? reminderId,
            reminder_status: reminderStatus,
            reminder: reminderRecord,
        },
    };
};

export const coerceReminderPayload = (candidate: unknown): GrayReminderCreatedPayload | null => {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        const structured = coerceStructuredReminderPayload(candidate as Record<string, unknown>);
        if (structured) {
            return structured;
        }
        return coerceLegacyReminderPayload(candidate as Record<string, unknown>);
    }
    return null;
};

export const buildReminderKey = (reminder: GrayReminderCreatedPayload): string => {
    const data = reminder.data ?? {};
    const primary = data.reminder_id ?? data.id;
    if (typeof primary === "string" || typeof primary === "number") {
        return String(primary);
    }
    const label = data.label ?? "";
    const timeIso = data.time_iso ?? "";
    return `${reminder.entity}:${label}:${timeIso}`.trim().toLowerCase();
};

export const formatReminderTimeLabel = (reminder: GrayReminderCreatedPayload): { timeLabel: string | null; slotLabel: string | null } => {
    const data = reminder.data ?? {};
    const reminderRecord = (data.reminder as Record<string, unknown> | null) ?? null;
    const remindAtIso =
        (reminderRecord && typeof reminderRecord.remind_at === "string" && reminderRecord.remind_at) ||
        (typeof data.time_iso === "string" ? data.time_iso : null);

    const rawRecord = (data.raw as Record<string, unknown> | null) ?? null;
    const slotValue = rawRecord && typeof rawRecord.schedule_slot === "string" ? rawRecord.schedule_slot : null;
    const slotDisplayLabel = formatReminderSlotLabel(remindAtIso, slotValue);
    const isoLabel = formatReminderDateLabel(remindAtIso);
    const timeLabel = slotDisplayLabel ?? isoLabel;
    return { timeLabel, slotLabel: slotValue };
};

export const buildReminderConfirmationText = (reminders: GrayReminderCreatedPayload[]): string | null => {
    if (!reminders.length) {
        return null;
    }
    const [first, ...rest] = reminders;
    const label = first.data?.label?.trim() || "that";
    const { timeLabel, slotLabel } = formatReminderTimeLabel(first);
    let clause: string;
    if (timeLabel) {
        clause = `I'll remind you to ${label} on ${timeLabel}.`;
    } else if (slotLabel) {
        clause = `I'll remind you to ${label} around ${slotLabel}.`;
    } else {
        clause = `I'll remind you to ${label}.`;
    }
    const clarifier = slotLabel && timeLabel && !timeLabel.toLowerCase().includes(slotLabel.toLowerCase())
        ? ` You mentioned ${slotLabel}; if that's the time you want, just tell me and I'll move it.`
        : timeLabel
            ? " If that timing's off, let me know and I'll adjust."
            : " Let me know if you'd like to pin a specific time.";
    let extra = "";
    if (rest.length === 1) {
        extra = " I've also logged one more reminder from the same request.";
    } else if (rest.length > 1) {
        extra = ` I've also logged ${rest.length} additional reminders from the same request.`;
    }
    return `Got it — ${clause}${clarifier}${extra}`.trim();
};

const stripReminderPreamble = (segment: string): string => {
    if (!segment) {
        return segment;
    }
    let updated = segment.replace(REMINDER_PRE_BLOCK_REGEX, "");
    if (updated === segment) {
        updated = updated.replace(/gray[._](?:reminder|plan|habit)\s*$/i, "");
    }
    updated = updated.replace(/```[a-z0-9_-]*[^\S\r\n]*$/i, "");
    return updated;
};

const TOOL_FENCE_LINE_PATTERNS = [
    /via MCP/i,
    /^Plan\s+'[^']+'\s+is\s+set\s+for/i,
    /^I've stored/i,
    /^Vstalin Grady,/i,
    /^SYSTEM ACTION:/i,
];

const unwrapToolCallCodeFences = (segment: string): string => {
    if (!segment || !segment.includes("```")) {
        return segment;
    }
    const fencePattern = /```[a-z0-9_-]*[^\S\r\n]*\n([\s\S]*?)```/gi;
    return segment.replace(fencePattern, (match, body) => {
        const inner = (body ?? "").trim();
        if (!inner) {
            return "";
        }
        if (/gray[._](?:reminder|plan|habit)/i.test(inner)) {
            return "";
        }
        const lines = inner
            .split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
        if (
            lines.length > 0 &&
            lines.every((line: string) => TOOL_FENCE_LINE_PATTERNS.some((pattern) => pattern.test(line)))
        ) {
            return `${lines.join("\n")}\n`;
        }
        return match;
    });
};

const stripIncompleteReminderArtifacts = (segment: string): string => {
    if (!segment) {
        return segment;
    }
    let updated = segment;

    // 1. Aggressively remove any code block that contains gray reminder payload markers
    const fencePattern = /```(?:json)?\s*[\s\S]*?gray[._](?:reminder|plan|habit)[\s\S]*?```/gi;
    updated = updated.replace(fencePattern, "");

    // 2. Remove any JSON code block that contains reminder-like fields
    const jsonCodeBlockPattern = /```(?:json)?\s*\{[\s\S]*?\}\s*```/gi;
    updated = updated.replace(jsonCodeBlockPattern, (match) => {
        if (/(?:reminder_id|text|time|status|remind_at|label)/i.test(match)) {
            return "";
        }
        return match;
    });

    // 3. Remove any raw JSON structure containing gray reminder tool payloads
    const rawJsonPattern = /\{[^{}]*gray[._](?:reminder|plan|habit)[^{}]*\}/gi;
    updated = updated.replace(rawJsonPattern, "");

    // 4. Remove leaked text tool-call blocks for reminder/plan/habit tools
    const toolJsonPattern =
        /```(?:json)?\s*\{[\s\S]*?"tool"\s*:\s*"(?:create|update|delete)_(?:reminder|plan|habit)[\s\S]*?```/gi;
    updated = updated.replace(toolJsonPattern, "");

    // 5. Clean up extra blank lines
    updated = updated.replace(/\n{3,}/g, "\n\n");

    return updated.trim();
};

const parseReminderBlocks = (raw: string): ParsedReminderBlock[] => {
    const matches: ParsedReminderBlock[] = [];
    let depth = 0;
    let startIndex = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < raw.length; i += 1) {
        const char = raw[i];

        if (inString) {
            if (escapeNext) {
                escapeNext = false;
            } else if (char === "\\") {
                escapeNext = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === "{") {
            if (depth === 0) {
                startIndex = i;
            }
            depth += 1;
            continue;
        }

        if (char === "}") {
            if (depth === 0) {
                continue;
            }
            depth -= 1;
            if (depth === 0 && startIndex !== -1) {
                const blockText = raw.slice(startIndex, i + 1);
                try {
                    const parsed = JSON.parse(blockText) as Partial<GrayReminderCreatedPayload>;
                    const payload = coerceReminderPayload(parsed);
                    if (payload) {
                        matches.push({
                            start: startIndex,
                            end: i + 1,
                            reminder: payload,
                        });
                    }
                } catch {
                    // Ignore blocks that aren't valid JSON.
                } finally {
                    startIndex = -1;
                }
            }
        }
    }

    return matches;
};

export const extractGrayRemindersFromText = (
    raw: string
): { cleanText: string; reminders: GrayReminderCreatedPayload[] } => {
    if (!raw || typeof raw !== "string") {
        return { cleanText: raw ?? "", reminders: [] };
    }

    const sanitizedDisplay = stripIncompleteReminderArtifacts(raw);
    const blocks = parseReminderBlocks(raw);
    if (!blocks.length) {
        return { cleanText: sanitizedDisplay, reminders: [] };
    }

    const seenReminders = new Set<string>();
    const reminders: GrayReminderCreatedPayload[] = [];
    for (const block of blocks) {
        const key = buildReminderKey(block.reminder);
        if (!seenReminders.has(key)) {
            seenReminders.add(key);
            reminders.push(block.reminder);
        }
    }

    if (!reminders.length) {
        return { cleanText: sanitizedDisplay, reminders: [] };
    }

    blocks.sort((a, b) => b.start - a.start);
    let cleanText = raw;
    for (const block of blocks) {
        const key = buildReminderKey(block.reminder);
        if (seenReminders.has(key)) {
            const before = cleanText.slice(0, block.start);
            const after = cleanText.slice(block.end);
            cleanText = before + after;
        }
    }

    cleanText = cleanText.replace(EMPTY_CODE_FENCE_REGEX, "");
    cleanText = cleanText.replace(REMINDER_CODE_BLOCK_REGEX, "");
    cleanText = stripReminderPreamble(cleanText);
    cleanText = unwrapToolCallCodeFences(cleanText);
    cleanText = stripIncompleteReminderArtifacts(cleanText);
    cleanText = cleanText.trim();

    return { cleanText, reminders };
};

export const sendReminderNotification = (reminder: any, REMINDER_NOTIFICATION_ICON: string) => {
    if (
        typeof window === "undefined" ||
        typeof Notification === "undefined" ||
        (typeof window !== "undefined" && !window.isSecureContext)
    ) {
        return;
    }
    if (!reminder.id) {
        return;
    }
    if (Notification.permission !== "granted") {
        return;
    }
    try {
        const notification = new Notification(`Reminder: ${reminder.label || "Reminder"}`, {
            body: reminder.summary || reminder.description || "Tap to view details.",
            icon: REMINDER_NOTIFICATION_ICON,
            badge: REMINDER_NOTIFICATION_ICON,
            tag: `gray-reminder-${reminder.id}`,
            requireInteraction: true,
        } as any);
        notification.addEventListener("click", () => {
            if (typeof window !== "undefined" && window.focus) {
                window.focus();
            }
            notification.close();
        });
    } catch (error) {
        console.error("Failed to show reminder notification:", error);
    }
};
