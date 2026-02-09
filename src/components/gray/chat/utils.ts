import type {
    ChatMessage,
    ChatSession,
    ConversationHistoryEntryPayload,
    GrayReminderCreatedPayload,
} from "./types";
import type { User, Reminder } from "@/lib/api";
import {
    GREETING_PATTERN,
    SELF_CONTEXT_PATTERNS,
    WORKSPACE_CONTEXT_KEYWORDS,
    LOW_SIGNAL_TITLE_WORDS,
    GENERAL_SESSION_TITLE,
    GRAY_TITLE_HTML_CAPTURE_REGEX,
    GRAY_TITLE_HTML_STRIP_REGEX,
    GRAY_TITLE_LEGACY_CAPTURE_REGEX,
    GRAY_TITLE_LEGACY_STRIP_REGEX,
    GENERAL_CONVERSATION_PREFIX,
} from "./constants";
import { formatReminderDateLabel } from "../reminderTimeUtils";
import { extractGrayRemindersFromText } from "./reminderUtils";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONVERSATION_MEMORY_STORAGE_PREFIX = "gray_conversation_memory";

export const createClientUuid = (): string => {
    if (typeof crypto !== "undefined") {
        if ("randomUUID" in crypto && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        if ("getRandomValues" in crypto && typeof crypto.getRandomValues === "function") {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }
    }

    const randomHex = (length: number) =>
        Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const variantNibble = (8 + Math.floor(Math.random() * 4)).toString(16);
    return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${variantNibble}${randomHex(3)}-${randomHex(12)}`;
};

export const resolveConversationMemoryEnabled = (user: User | null | undefined): boolean => {
    if (typeof user?.conversation_memory_enabled === "boolean") {
        return user.conversation_memory_enabled;
    }
    if (typeof window === "undefined") {
        return true;
    }
    const storageKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
    try {
        return window.localStorage.getItem(storageKey) !== "0";
    } catch {
        return true;
    }
};

export const normalizeConversationIdValue = (value?: string | null): string | undefined => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    // Allow valid UUIDs
    if (UUID_PATTERN.test(trimmed)) {
        return trimmed;
    }
    // Allow general conversation IDs
    if (trimmed.startsWith(GENERAL_CONVERSATION_PREFIX)) {
        return trimmed;
    }
    return undefined;
};

// Session ID utilities
export const buildGeneralConversationId = (userId?: number | null) => {
    if (typeof userId !== "number" || !Number.isFinite(userId)) {
        return undefined;
    }
    return `${GENERAL_CONVERSATION_PREFIX}${userId}`;
};

export const isGeneralConversationId = (value?: string | null): boolean =>
    typeof value === "string" && value.startsWith(GENERAL_CONVERSATION_PREFIX);

export const coerceConversationIdForRequest = (value?: string | null): string | undefined => {
    const normalized = normalizeConversationIdValue(value);
    if (normalized) {
        return normalized;
    }
    return isGeneralConversationId(value) ? value ?? undefined : undefined;
};

// Timezone utilities
export const resolveClientTimezone = (): string => {
    if (typeof Intl === "undefined") {
        return "UTC";
    }
    try {
        const resolved = Intl.DateTimeFormat().resolvedOptions();
        return resolved.timeZone || "UTC";
    } catch {
        return "UTC";
    }
};

// Message utilities
export const buildAssistantReply = (prompt: string) => {
    void prompt;
    return "I encountered an unexpected issue and couldn't generate a response. Please try again.";
};

export const buildAssistantErrorReply = (cause: unknown) => {
    const base = "I couldn't reach the Gray backend to finish that request.";
    if (!cause) {
        return `${base} Make sure the API service is running (try \`npm run backend\`) and then retry.`;
    }
    if (cause instanceof Error && cause.message.trim()) {
        return `${base} Details: ${cause.message.trim()} — verify the service is up and try again.`;
    }
    if (typeof cause === "string" && cause.trim().length > 0) {
        return `${base} Details: ${cause.trim()}.`;
    }
    return `${base} Check that the API is reachable and try again.`;
};

const MCP_TOOL_BLOCK_REGEX = /<use_mcp_tool[\s\S]*?<\/use_mcp_tool>/gi;

export const stripMcpToolBlocks = (value: string | null | undefined): string => {
    return (value ?? "").replace(MCP_TOOL_BLOCK_REGEX, "");
};

export const normalizeAssistantContent = (candidate: string | null | undefined, prompt: string) => {
    const raw = stripMcpToolBlocks(candidate);
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : buildAssistantReply(prompt);
};

export const normalizeAssistantMessage = (
    role: string,
    content: string | null | undefined
): { content: string; reminders: GrayReminderCreatedPayload[] } => {
    // Only process assistant messages
    if (role !== "assistant" && role !== "model") {
        return { content: content ?? "", reminders: [] };
    }
    const result = extractGrayRemindersFromText(content ?? "");
    return { content: result.cleanText, reminders: result.reminders };
};

// Reminder utilities
const normalizeReminderLabel = (label?: string | null) => {
    if (!label) {
        return "that thing we planned";
    }
    const trimmed = label.trim();
    return trimmed.length > 0 ? trimmed : "that thing we planned";
};

const formatReminderScheduleLabel = (iso?: string | null) => {
    return formatReminderDateLabel(iso) ?? iso ?? "sometime soon";
};

export const buildReminderPingMessage = (reminder: Reminder): string => {
    const label = normalizeReminderLabel(reminder.label);
    const note = reminder.summary ?? reminder.description ?? null;

    // Use a cleaner, less "bot-like" format
    const parts = [`🔔 ${label}`];
    if (note) {
        parts.push(note);
    }
    return parts.join("\n\n");
};

export const buildReminderNotificationTitle = (reminder: Reminder) =>
    `Reminder: ${normalizeReminderLabel(reminder.label)}`;

export const buildReminderNotificationBody = (reminder: Reminder) => {
    const scheduleLabel = formatReminderScheduleLabel(reminder.remind_at);
    const note = reminder.summary ?? reminder.description ?? null;
    const segments: string[] = [];
    if (scheduleLabel) {
        segments.push(`Scheduled for ${scheduleLabel}`);
    }
    if (note) {
        segments.push(note);
    }
    return segments.length > 0 ? segments.join(" • ") : "Tap to view details.";
};

// Context detection
export const shouldIncludeWorkspaceContext = (message: string, context: string | null) => {
    if (!context) {
        return false;
    }
    const normalized = message.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    const punctuationTrimmed = normalized.replace(/[.!?]+$/g, "").trim();
    if (GREETING_PATTERN.test(punctuationTrimmed)) {
        return false;
    }

    if (SELF_CONTEXT_PATTERNS.some((pattern) => pattern.test(punctuationTrimmed))) {
        return true;
    }

    return WORKSPACE_CONTEXT_KEYWORDS.some((keyword) => punctuationTrimmed.includes(keyword));
};

export const formatConversationTitle = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "New Chat";
    }
    if (trimmed.length > 100) {
        return trimmed.slice(0, 100).trim();
    }
    return trimmed;
};

// Title utilities
export const deriveTitleFromMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
        return "New Chat";
    }
    return trimmed.length > 80 ? `${trimmed.slice(0, 77).trim()}…` : trimmed;
};

export const isTitleDerivedFromMessage = (title: string, messages: ChatMessage[]): boolean => {
    if (!title) return false;
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (!firstUserMsg || !firstUserMsg.content) return false;

    const cleanTitle = title.trim().toLowerCase().replace(/\u2026$/, ""); // Remove ellipsis
    const cleanMsg = firstUserMsg.content.trim().toLowerCase();

    if (!cleanMsg) return false;

    // Check if message starts with title (handling truncation)
    return cleanMsg.startsWith(cleanTitle);
};

export const shouldRequestAutoTitleForSession = (session?: ChatSession | null): boolean => {
    if (!session) return true; // Generate title for new sessions
    // Generate title if session has auto mode and a generic/placeholder title
    if (session.titleMode === "auto") {
        if (session.isGeneratingTitle) {
            return false;
        }
        // Request a generated title when we're still showing a placeholder title OR when
        // we fell back to a title derived from the first user message (so it can be replaced).
        return (
            isGenericSessionTitle(session.title) ||
            isTitleDerivedFromMessage(session.title ?? "", session.messages ?? [])
        );
    }
    return false;
};
const isLowInformationTitle = (value: string | null | undefined): boolean => {
    if (!value) {
        return true;
    }
    const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) {
        return true;
    }
    if (LOW_SIGNAL_TITLE_WORDS.has(normalized)) {
        return true;
    }
    if (normalized.length <= 3) {
        return true;
    }
    const tokens = normalized.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
    if (!tokens.length) {
        return true;
    }
    if (tokens.length <= 2 && tokens.every((token) => token.length <= 3)) {
        return true;
    }
    return false;
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

    // Check against generic tokens
    const GENERIC_TOKENS = [
        "new chat",
        "new conversation",
        "new thread",
        "new session",
        "conversation start",
        GENERAL_SESSION_TITLE.toLowerCase(),
    ];
    if (GENERIC_TOKENS.includes(normalized)) {
        return true;
    }
    if (GREETING_PATTERN.test(trimmed)) {
        return true;
    }
    return isLowInformationTitle(trimmed);
};

export const parseGrayTitleMarkers = (
    value: string | null | undefined
): { cleanText: string; title: string | null } => {
    const source = typeof value === "string" ? value : "";
    let title: string | null = null;

    const htmlMatch = source.match(GRAY_TITLE_HTML_CAPTURE_REGEX);
    if (htmlMatch && typeof htmlMatch[1] === "string") {
        const candidate = htmlMatch[1].trim();
        if (candidate) {
            title = candidate;
        }
    }

    if (!title) {
        const legacyMatch = source.match(GRAY_TITLE_LEGACY_CAPTURE_REGEX);
        if (legacyMatch && typeof legacyMatch[1] === "string") {
            const candidate = legacyMatch[1].trim();
            if (candidate) {
                title = candidate;
            }
        }
    }

    const cleanText = source
        .replace(GRAY_TITLE_HTML_STRIP_REGEX, "")
        .replace(GRAY_TITLE_LEGACY_STRIP_REGEX, "")
        .trim();

    return { cleanText, title };
};

export const stripGrayTitleMarkers = (value: string | null | undefined): string => {
    return parseGrayTitleMarkers(value).cleanText;
};

// Timestamp utilities
export const toTimestamp = (value?: string | number | Date | null): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return Date.now();
};

// Conversation history payload builder


export const buildConversationHistoryPayload = (messages: ChatMessage[]) => {
    const normalizeAttachments = (attachments?: ChatMessage["attachments"]) => {
        if (!attachments || attachments.length === 0) {
            return undefined;
        }
        const sanitized = attachments
            .map((attachment) => {
                if (!attachment || typeof attachment !== "object") {
                    return null;
                }
                const { previewUrl, ...rest } = attachment;
                return rest;
            })
            .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment));
        return sanitized.length > 0 ? sanitized : undefined;
    };

    return messages
        .map<ConversationHistoryEntryPayload | null>((message) => {
            const attachments = normalizeAttachments(message.attachments);
            if (message.role === "user") {
                return {
                    role: "user",
                    text: message.content ?? "",
                    attachments,
                };
            }
            if (message.role === "assistant") {
                return {
                    role: "model",
                    text: message.content ?? "",
                    attachments,
                };
            }
            return null;
        })
        .filter((entry): entry is ConversationHistoryEntryPayload => entry !== null);
};

/**
 * Compute a hash string from user profile fields.
 * Used to detect when profile data has changed and needs to be resent.
 */
export const computeProfileHash = (user?: User | null): string => {
    if (!user) return "";
    const parts = [
        user.personalization_nickname || "",
        user.personalization_occupation || "",
        user.personalization_about || "",
        user.personalization_custom_instructions || "",
    ];
    return parts.join("|");
};

/**
 * Build a personalized system prompt with user profile data.
 * @param user - User object with personalization fields
 * @param basePrompt - Base system prompt to include
 * @param includeProfile - If true, includes full USER PROFILE section. If false, only includes
 *                         IDENTITY BOUNDARY for nickname addressing. Set to false on subsequent
 *                         messages when profile hasn't changed to reduce payload size.
 */
export const buildPersonalizedSystemPrompt = (
    user?: User | null,
    basePrompt?: string | null,
    includeProfile: boolean = true
) => {
    const sections: string[] = [];

    const trimmedBasePrompt = basePrompt?.trim();
    if (trimmedBasePrompt) {
        sections.push(trimmedBasePrompt);
    }

    if (user) {
        const nickname = user.personalization_nickname?.trim();
        const occupation = user.personalization_occupation?.trim();
        const about = user.personalization_about?.trim();
        const customInstructions = user.personalization_custom_instructions?.trim();

        // Only include full profile on first message or when profile changes
        if (includeProfile) {
            const profileLines: string[] = [];

            if (nickname) {
                profileLines.push(`Preferred name: ${nickname}`);
            }

            if (occupation) {
                profileLines.push(`Occupation: ${occupation}`);
            }

            if (about) {
                profileLines.push(`About: ${about}`);
            }

            if (profileLines.length > 0) {
                sections.push(["USER PROFILE (ONLY FROM EXPLICIT PERSONALIZATION FIELDS)", ...profileLines].join("\n"));
            }
        }

        if (customInstructions) {
            sections.push(
                [
                    "CUSTOM INSTRUCTIONS FROM USER (SOURCE OF TRUTH)",
                    customInstructions,
                ].join("\n")
            );
        }

        // Always include identity boundary so AI knows the nickname
        if (nickname) {
            sections.push(
                [
                    `IDENTITY BOUNDARY`,
                    `- Address the user as "${nickname}".`,
                    "- Ignore any other names from metadata or past conversations.",
                ].join("\n")
            );
        } else {
            sections.push(
                [
                    "IDENTITY BOUNDARY",
                    "- Do NOT assume a name for the user.",
                    "- Do NOT use the user's email or username to address them.",
                    "- If you don't know their name, just say 'hey' or 'there'.",
                ].join("\n")
            );
        }
    } else {
        sections.push(
            [
                "IDENTITY BOUNDARY",
                "- No personalization data is set.",
                "- Do NOT infer a name or identity for the user from technical metadata (email, auth provider, etc).",
            ].join("\n")
        );
    }

    return sections.join("\n\n");
};

// Storage key utilities
const emailToKeySegment = (email?: string | null) => {
    if (!email) {
        return null;
    }
    return email.trim().toLowerCase();
};

export const buildSessionStorageKeyCandidates = (userId?: number | null, email?: string | null): string[] => {
    const SESSION_STORAGE_KEY_BASE = "gray-chat-sessions-v1";
    const keys: string[] = [];
    const emailSegment = emailToKeySegment(email);
    const hasUserId = typeof userId === "number" && Number.isFinite(userId);

    if (hasUserId && emailSegment) {
        keys.push(`${SESSION_STORAGE_KEY_BASE}:id:${userId}:email:${emailSegment}`);
    } else if (hasUserId) {
        keys.push(`${SESSION_STORAGE_KEY_BASE}:id:${userId}`);
    }

    if (emailSegment) {
        keys.push(`${SESSION_STORAGE_KEY_BASE}:email:${emailSegment}`);
    }

    if (!keys.length && hasUserId) {
        keys.push(`${SESSION_STORAGE_KEY_BASE}:id:${userId}`);
    }

    return [...new Set(keys)];
};
