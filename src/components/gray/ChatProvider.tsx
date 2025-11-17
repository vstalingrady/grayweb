"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import {
  apiService,
  type ChatStreamTiming,
  type ConversationSummary,
  type ContextCache,
  type ContextCacheBase,
  type GroundingMetadata,
  type MediaUpload,
  type Reminder,
  type User,
} from "@/lib/api";
import { buildLocalTimeContext } from "@/lib/timeContext";
import { formatReminderDateLabel, formatReminderSlotLabel } from "./reminderTimeUtils";

declare global {
  interface Window {
    endSearchTracking?: () => void;
  }
}

const endSearchTracking = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.endSearchTracking?.();
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  reminders?: GrayReminderCreatedPayload[];
  groundingMetadata?: GroundingMetadata;
  backendTimings?: ChatStreamTiming;
};

type ConversationHistoryEntryPayload = {
  role: "user" | "model";
  text: string;
};

const buildConversationHistoryPayload = (messages: ChatMessage[]) => {
  return messages
    .map<ConversationHistoryEntryPayload | null>((message) => {
      if (message.role === "user") {
        return {
          role: "user",
          text: message.content ?? "",
        };
      }
      if (message.role === "assistant") {
        return {
          role: "model",
          text: message.content ?? "",
        };
      }
      return null;
    })
    .filter((entry): entry is ConversationHistoryEntryPayload => entry !== null);
};

export type ChatSessionScope = "general" | "thread";
export type ChatTitleMode = "auto" | "manual";

export type ChatSession = {
  id: string;
  title: string;
  titleMode: ChatTitleMode;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  isResponding: boolean;
  scope: ChatSessionScope;
  conversationId?: string;
  pendingAutoStream?: boolean;
};

type ChatContextValue = {
  sessions: ChatSession[];
  createThreadSession: (
    initialMessage?: string,
    options?: {
      autoStream?: boolean;
    }
  ) => Promise<ChatSession>;
  sendGeneralMessage: (content: string) => Promise<string>;
  appendMessage: (
    sessionId: string,
    role: ChatRole,
    content: string,
    tempId?: string
  ) => ChatMessage | null;
  updateMessage: (
    sessionId: string,
    messageId: string,
    partial: Partial<ChatMessage>
  ) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  renameSession: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  getSession: (sessionId: string) => ChatSession | undefined;
  ensureSession: (sessionId: string, initializer: () => ChatSession) => ChatSession;
  generalSessionId: string | null;
  workspaceContext: string | null;
  setWorkspaceContext: (context: string | null) => void;
  applyAutoTitle: (sessionId: string, candidate?: string | null) => void;
  hasAutoStreamTriggered: (sessionId: string, messageId?: string | null) => boolean;
  markAutoStreamTriggered: (sessionId: string, messageId?: string | null) => void;
  resetAutoStreamState: (sessionId?: string | null) => void;
  personalizedSystemPrompt: string;
  attachments: MediaUpload[];
  isAttachmentUploading: boolean;
  attachmentError: string | null;
  uploadAttachments: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: number) => void;
  clearAttachments: () => void;
  mapsEnabled: boolean;
  mapsWidgetEnabled: boolean;
  mapsLatitude: string;
  mapsLongitude: string;
  setMapsEnabled: (value: boolean) => void;
  setMapsWidgetEnabled: (value: boolean) => void;
  setMapsLatitude: (value: string) => void;
  setMapsLongitude: (value: string) => void;
  mapPayload: Record<string, number | boolean | undefined>;
  pendingLocationRequestMessage: string | null;
  isRequestingLocation: boolean;
  requestLocationShare: () => void;
  skipLocationShare: () => void;
  contextCaches: ContextCache[];
  contextCacheLabel: string;
  contextCacheContent: string;
  selectedContextCacheId: number | null;
  contextCacheMessage: string | null;
  isContextCacheSaving: boolean;
  createContextCache: (conversationId?: string) => Promise<void>;
  selectContextCacheId: (cacheId: number | null) => void;
  setContextCacheLabel: (value: string) => void;
  setContextCacheContent: (value: string) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (value: boolean) => void;
  fileSearchStores: { name: string; display_name?: string }[];
  fileSearchDisplayName: string;
  setFileSearchDisplayName: (value: string) => void;
  fileSearchStatus: string | null;
  isCreatingFileSearchStore: boolean;
  handleCreateFileSearchStore: () => Promise<void>;
  selectedFileSearchStore: string;
  setSelectedFileSearchStore: (value: string) => void;
  fileSearchUploadFile: File | null;
  setFileSearchUploadFile: (value: File | null) => void;
  fileSearchUploadStatus: string | null;
  handleFileSearchUpload: () => Promise<void>;
  fileSearchChunking: { maxTokensPerChunk: string; maxOverlapTokens: string };
  setFileSearchChunking: (value: { maxTokensPerChunk: string; maxOverlapTokens: string }) => void;
  fileSearchImportName: string;
  setFileSearchImportName: (value: string) => void;
  fileSearchImportStatus: string | null;
  handleFileSearchImport: () => Promise<void>;
  fileSearchUploadInputRef: RefObject<HTMLInputElement | null>;
};

type SaveContextCacheOptions = {
  skipMessage?: boolean;
  skipReset?: boolean;
};

const ChatContext = createContext<ChatContextValue | null>(null);
const SESSION_STORAGE_KEY_BASE = "gray-chat-sessions-v1";
const emailToKeySegment = (email?: string | null) => {
  if (!email) {
    return null;
  }
  return email.trim().toLowerCase();
};
const buildSessionStorageKeyCandidates = (userId?: number | null, email?: string | null): string[] => {
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

const INITIAL_SESSIONS: ChatSession[] = [];
const PLACEHOLDER_SESSION_IDS = new Set([
  "session-subjective-attractiveness",
  "session-mobile-fade-effect",
  "session-chat-log-analysis",
]);
const PLACEHOLDER_TITLES = new Set([
  "Subjective Attractiveness",
  "Mobile-Friendly Fade Effect",
  "Chat Log Analysis Techniques",
]);
const FALLBACK_ASSISTANT_DELAY_MS = 150;
const GENERAL_SESSION_ID = "general-session";
export const GENERAL_CHAT_SESSION_ID = GENERAL_SESSION_ID;
const GENERAL_SESSION_TITLE = "General Chat";
export const SHARED_CHAT_PLACEHOLDER_TITLE = "Shared Chat";
const GENERAL_CONVERSATION_PREFIX = "general:";
export const buildGeneralConversationId = (userId?: number | null) => {
  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    return undefined;
  }
  return `${GENERAL_CONVERSATION_PREFIX}${userId}`;
};
const isGeneralConversationId = (value?: string | null): boolean =>
  typeof value === "string" && value.startsWith(GENERAL_CONVERSATION_PREFIX);
const DUPLICATE_THREAD_WINDOW_MS = 15000;
const REMOTE_SESSION_MERGE_WINDOW_MS = 5 * 60 * 1000;
const REMINDER_POLL_MIN_INTERVAL = 60_000;
const REMINDER_POLL_SHORT_INTERVAL = 15_000;
export const buildPersonalizedSystemPrompt = (user?: User | null, basePrompt?: string | null) => {
  const sections: string[] = [];

  const trimmedBasePrompt = basePrompt?.trim();
  if (trimmedBasePrompt) {
    sections.push(trimmedBasePrompt);
  }

  if (user) {
    const profileLines: string[] = [];

    // Only treat explicit personalization fields as stable identity.
    const nickname = user.personalization_nickname?.trim();
    const occupation = user.personalization_occupation?.trim();
    const about = user.personalization_about?.trim();
    const customInstructions = user.personalization_custom_instructions?.trim();

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

    if (customInstructions) {
      sections.push(
        [
          "CUSTOM INSTRUCTIONS FROM USER (SOURCE OF TRUTH)",
          customInstructions,
        ].join("\n")
      );
    }

    if (nickname) {
      sections.push(
        [
          `IDENTITY BOUNDARY`,
          `- Always address the user as "${nickname}".`,
          "- Ignore any other names or identity details mentioned in older messages, summaries, or external data.",
          "- Do NOT infer or invent identity attributes beyond what appears in the explicit personalization fields above.",
        ].join("\n")
      );
    } else {
      sections.push(
        [
          "IDENTITY BOUNDARY",
          "- Do NOT assume a real name or identity for the user.",
          "- Do NOT derive their identity from email, auth metadata, or prior conversations.",
          "- Only use details that appear in the explicit personalization fields above when present.",
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

export const buildAssistantReply = (prompt: string) => {
  void prompt;
  return "I'm here and ready—feel free to share more details or ask another question.";
};

const buildAssistantErrorReply = (cause: unknown) => {
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

const buildReminderPingMessage = (reminder: Reminder): string => {
  const label = normalizeReminderLabel(reminder.label);
  const scheduleLabel = formatReminderScheduleLabel(reminder.remind_at);
  const note = reminder.summary ?? reminder.description ?? null;
  const lines = [
    `✨ Reminder ready: ${label}.`,
    scheduleLabel ? `I'll nudge you at ${scheduleLabel}.` : "I'll ping you when the time comes.",
  ];
  if (note) {
    lines.push(`Note: ${note}`);
  }
  lines.push("Let me know if you want to shift this or turn it into a repeat habit.");
  return lines.join("\n");
};
const REMINDER_NOTIFICATION_ICON = "/grayaiwhite.svg";

const buildReminderNotificationTitle = (reminder: Reminder) =>
  `Reminder: ${normalizeReminderLabel(reminder.label)}`;

const buildReminderNotificationBody = (reminder: Reminder) => {
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

const sendReminderNotification = (reminder: Reminder) => {
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
    const notification = new Notification(buildReminderNotificationTitle(reminder), {
      body: buildReminderNotificationBody(reminder),
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

const GREETING_PATTERN =
  /^(?:hi|hey|hello|hiya|yo|sup|what'?s up|howdy|good (?:morning|afternoon|evening)|hola|h[ae]y there|hi there|hey there|gm|gn|good night)\b[^\w]*$/i;

const LOW_SIGNAL_TITLE_WORDS = new Set<string>([
  "hi",
  "hi there",
  "hey",
  "hey there",
  "hello",
  "hola",
  "yo",
  "sup",
  "gm",
  "gn",
  "good morning",
  "good afternoon",
  "good evening",
  "good night",
  "whats up",
  "what's up",
]);

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

const isGenericSessionTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const trimmed = title.trim();
  if (!trimmed) {
    return true;
  }
  const normalized = trimmed.toLowerCase();
  if (
    normalized === "new chat" ||
    normalized === "conversation start" ||
    normalized === GENERAL_SESSION_TITLE.toLowerCase()
  ) {
    return true;
  }
  if (GREETING_PATTERN.test(trimmed)) {
    return true;
  }
  return isLowInformationTitle(trimmed);
};

const WORKSPACE_CONTEXT_KEYWORDS = [
  "calendar",
  "schedule",
  "event",
  "meeting",
  "plan",
  "task",
  "todo",
  "habit",
  "routine",
  "goal",
  "project",
  "focus",
  "pulse",
  "streak",
  "history",
];
const MAP_TRIGGER_PATTERN =
  /\b(?:nearby|around|directions|route|map|maps|location|locations|address|restaurant|cafe|coffee|diner|bar|hotel|airport|station|train|bus|metro|tram|park|museum|landmark|beach|mall|district|city|town|village|neighborhood|venue|street|trip|plan)\b/i;
const MAP_TRIGGER_PHRASE =
  /\b(?:near me|near here|around here|close to|within (?:a )?(?:mile|km|block|minute|minutes)|walking distance|driving distance|in (?:the )?(?:area|neighborhood|city))\b/i;
const MIN_CONTEXT_MESSAGE_LENGTH = 48;

const toTimestamp = (value?: string | number | Date | null): number => {
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

  if (punctuationTrimmed.length >= MIN_CONTEXT_MESSAGE_LENGTH) {
    return true;
  }

  return WORKSPACE_CONTEXT_KEYWORDS.some((keyword) => punctuationTrimmed.includes(keyword));
};

const shouldAutoEnableMapsForMessage = (message: string) => {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return MAP_TRIGGER_PATTERN.test(normalized) || MAP_TRIGGER_PHRASE.test(normalized);
};

export const normalizeAssistantContent = (candidate: string | null | undefined, prompt: string) => {
  const trimmed = (candidate ?? "").trim();
  return trimmed.length > 0 ? trimmed : buildAssistantReply(prompt);
};

/**
 * Parsed representation of a Gray reminder confirmation block embedded
 * in assistant output. This is UI-facing, authoritative metadata.
 */
export type GrayReminderEntityType = "plan" | "habit";

export interface GrayReminderCreatedPayload {
  type: "gray.reminder";
  source: "mcp/plans-habits-server";
  status: "created" | "updated" | "completed" | "deleted";
  entity: GrayReminderEntityType;
  delivery_mode?: string | null;
  data: {
    id: number | string;
    user_id: number;
    label: string;
    time_iso?: string | null;
    raw: Record<string, unknown>;
    delivery_mode?: string | null;
    summary?: string | null;
    reminder_id?: number | string | null;
    reminder_status?: string | null;
    reminder?: Record<string, unknown> | null;
  };
}

/**
 * Extract all well-formed gray.reminder JSON objects from a blob of assistant text.
 * - Only returns objects that match the strict schema.
 * - Uses a lightweight brace parser instead of regex so nested objects don't break extraction.
 * - Strips those JSON blocks from the visible markdown content so UI can render
 *   a dedicated “real reminder created” chip instead of leaking raw JSON.
 */
const EMPTY_CODE_FENCE_REGEX = /```(?:[a-zA-Z0-9_-]+)?\s*```/g;
const REMINDER_PRE_BLOCK_REGEX = /(?:```[a-z0-9_-]*[^\S\r\n]*\n\s*)?gray[._]reminder\s*$/i;
const REMINDER_CODE_BLOCK_REGEX = /```[a-z0-9_-]*[^\S\r\n]*\n[\s\S]*?gray[._]reminder[\s\S]*?```/gi;
const REMINDER_GENERIC_FENCE_REGEX = /```[a-z0-9_-]*[\s\S]*?(gray[\s\S]{0,120}?reminder)[\s\S]*?```/gi;

type ParsedReminderBlock = {
  start: number;
  end: number;
  reminder: GrayReminderCreatedPayload;
};

const isFullReminderPayload = (candidate: Partial<GrayReminderCreatedPayload>): candidate is GrayReminderCreatedPayload => {
  return (
    candidate != null &&
    candidate.type === "gray.reminder" &&
    candidate.source === "mcp/plans-habits-server" &&
    (candidate.status === "created" ||
      candidate.status === "updated" ||
      candidate.status === "completed" ||
      candidate.status === "deleted") &&
    (candidate.entity === "plan" || candidate.entity === "habit") &&
    candidate.data != null &&
    typeof candidate.data.id !== "undefined" &&
    typeof candidate.data.user_id === "number" &&
    typeof candidate.data.label === "string"
  );
};

const GRAY_TITLE_HTML_CAPTURE_REGEX = /<graytitle\b[^>]*>([\s\S]*?)<\/graytitle>/i;
const GRAY_TITLE_HTML_STRIP_REGEX = /<graytitle\b[^>]*>[\s\S]*?<\/graytitle>/gi;
const GRAY_TITLE_LEGACY_CAPTURE_REGEX = /<<gray-title>>([\s\S]*?)<<gray-title-end>>/i;
const GRAY_TITLE_LEGACY_STRIP_REGEX = /<<gray-title>>[\s\S]*?<<gray-title-end>>/gi;

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
  const legacyType = typeof candidate.type === "string" ? candidate.type.toLowerCase() : "plan";
  const entity: GrayReminderEntityType = legacyType === "habit" ? "habit" : "plan";
  const deliveryMode = entity;
  const reminderStatus = typeof candidate.status === "string" ? candidate.status : null;
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
    type: "gray.reminder",
    source: "mcp/plans-habits-server",
    status: "created",
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
      reminder_status: reminderStatus,
      reminder: Object.keys(reminderRecord).length ? reminderRecord : null,
    },
  };
};

const coerceReminderPayload = (candidate: unknown): GrayReminderCreatedPayload | null => {
  if (isFullReminderPayload(candidate as Partial<GrayReminderCreatedPayload>)) {
    return candidate as GrayReminderCreatedPayload;
  }
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return coerceLegacyReminderPayload(candidate as Record<string, unknown>);
  }
  return null;
};

const buildReminderKey = (reminder: GrayReminderCreatedPayload): string => {
  const data = reminder.data ?? {};
  const primary = data.reminder_id ?? data.id;
  if (typeof primary === "string" || typeof primary === "number") {
    return String(primary);
  }
  const label = data.label ?? "";
  const timeIso = data.time_iso ?? "";
  return `${reminder.entity}:${label}:${timeIso}`.trim().toLowerCase();
};

const formatReminderTimeLabel = (reminder: GrayReminderCreatedPayload): { timeLabel: string | null; slotLabel: string | null } => {
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

const buildReminderConfirmationText = (reminders: GrayReminderCreatedPayload[]): string | null => {
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
    updated = updated.replace(/gray[._]reminder\s*$/i, "");
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

const TOOL_NOISE_LINE_PATTERNS = [
  /via MCP/i,
  /^Plan\s+'[^']+'\s+is\s+set\s+for/i,
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
    if (/gray[._]reminder/i.test(inner)) {
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

  const stripTailFromIndex = (index: number) => {
    updated = updated.slice(0, index).trimEnd();
  };

  const fenceStart = updated.lastIndexOf("```");
  if (fenceStart !== -1) {
    const fenceTail = updated.slice(fenceStart);
    if (!/```/.test(fenceTail.slice(3)) && /gray[._]reminder/i.test(fenceTail)) {
      stripTailFromIndex(fenceStart);
      return updated;
    }
  }

  const jsonMarker = updated.toLowerCase().lastIndexOf('"type":"gray.reminder"');
  if (jsonMarker !== -1) {
    const braceStart = updated.lastIndexOf("{", jsonMarker);
    const braceEnd = updated.indexOf("}", jsonMarker);
    if (braceStart !== -1 && braceEnd === -1) {
      stripTailFromIndex(braceStart);
    }
  }

  return updated;
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
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
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
    if (seenReminders.has(key)) {
      continue;
    }
    seenReminders.add(key);
    reminders.push(block.reminder);
  }
  const hasModernReminder = reminders.some((reminder) => reminder.source === "mcp/plans-habits-server");
  const filteredReminders = hasModernReminder
    ? reminders.filter((reminder) => reminder.source === "mcp/plans-habits-server")
    : reminders;
  let cleanText = "";
  let cursor = 0;
  for (const block of blocks) {
    cleanText += stripReminderPreamble(raw.slice(cursor, block.start));
    cursor = block.end;
  }
  cleanText += stripReminderPreamble(raw.slice(cursor));
  cleanText = stripIncompleteReminderArtifacts(cleanText);

  cleanText = cleanText
    .replace(EMPTY_CODE_FENCE_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/```(?:json)?[\s\S]*?"type"\s*:\s*"gray(?:\.|_)reminder"[\s\S]*?```/gi, "")
    .replace(REMINDER_CODE_BLOCK_REGEX, "")
    .replace(REMINDER_GENERIC_FENCE_REGEX, "")
    .replace(/```[a-zA-Z0-9_-]*\s*```/gi, "");

  cleanText = unwrapToolCallCodeFences(cleanText)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !TOOL_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line))
    )
    .join("\n")
    .trim();

  return { cleanText, reminders: filteredReminders };
};

const normalizeAssistantMessage = (
  role: ChatRole,
  content: string
): { content: string; reminders?: GrayReminderCreatedPayload[] } => {
  if (role !== "assistant") {
    return { content };
  }
  const { cleanText, reminders } = extractGrayRemindersFromText(content);
  let finalizedText = cleanText;
  if ((!finalizedText || !finalizedText.trim()) && reminders.length > 0) {
    finalizedText = buildReminderConfirmationText(reminders) ?? "";
  }
  return {
    content: finalizedText,
    reminders: reminders.length ? reminders : undefined,
  };
};

const makeMessage = (
  role: ChatRole,
  content: string,
  tempId?: string,
  metadata?: GroundingMetadata
): ChatMessage => {
  const id = tempId || (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));
  const normalized = normalizeAssistantMessage(role, content);
  return {
    id,
    role,
    content: normalized.content,
    createdAt: Date.now(),
    reminders: normalized.reminders,
    groundingMetadata: metadata,
  };
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

const SMALL_TITLE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
]);

export const deriveTitleFromMessage = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return "New Chat";
  }
  // Simple snippet of the first user message, no reformatting.
  return trimmed.length > 80 ? `${trimmed.slice(0, 77).trim()}…` : trimmed;
};

const isSessionTitleSeedDerived = (session?: ChatSession | null): boolean => {
  if (!session || session.scope !== "thread") {
    return false;
  }
  const normalizedTitle = session.title?.trim();
  if (!normalizedTitle) {
    return false;
  }
  const firstMeaningfulUserMessage = (session.messages ?? []).find(
    (message) => message.role === "user" && message.content.trim().length > 0
  );
  if (!firstMeaningfulUserMessage) {
    return false;
  }
  const derivedSeedTitle = deriveTitleFromMessage(firstMeaningfulUserMessage.content).trim();
  return derivedSeedTitle === normalizedTitle;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const normalizeConversationIdValue = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || !UUID_PATTERN.test(trimmed)) {
    return undefined;
  }
  return trimmed;
};

const coerceConversationIdForRequest = (value?: string | null): string | undefined => {
  const normalized = normalizeConversationIdValue(value);
  if (normalized) {
    return normalized;
  }
  return isGeneralConversationId(value) ? value ?? undefined : undefined;
};

const GENERIC_TITLE_TOKENS = new Set([
  "new chat",
  "new conversation",
  "new thread",
  "new session",
  "conversation start",
  SHARED_CHAT_PLACEHOLDER_TITLE.toLowerCase(),
]);

export const isGenericTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const trimmed = title.trim();
  if (!trimmed) {
    return true;
  }
  const normalized = trimmed.toLowerCase();
  if (GENERIC_TITLE_TOKENS.has(normalized)) {
    return true;
  }
  if (GREETING_PATTERN.test(trimmed)) {
    return true;
  }
  return isLowInformationTitle(trimmed);
};

export const shouldRequestAutoTitleForSession = (session?: ChatSession | null): boolean => {
  if (!session) return true; // Generate title for new sessions
  // Generate title if session has auto mode and a generic/placeholder title
  if (session.titleMode === "auto") {
    return isGenericTitle(session.title);
  }
  return false;
};

const createEmptyGeneralSession = (timestamp?: number, conversationId?: string | null): ChatSession => {
  const now = timestamp ?? Date.now();
  return {
    id: GENERAL_SESSION_ID,
    title: GENERAL_SESSION_TITLE,
    titleMode: "manual",
    createdAt: now,
    updatedAt: now,
    messages: [],
    isResponding: false,
    scope: "general",
    conversationId: conversationId ?? undefined,
    pendingAutoStream: false,
  };
};

const cloneSession = (session: ChatSession): ChatSession => ({
  ...session,
  titleMode: session.titleMode ?? (session.scope === "general" ? "manual" : "auto"),
  messages: session.messages.map((message) => ({
    ...message,
  })),
});

const defaultSessions = () => {
  if (!INITIAL_SESSIONS.length) {
    return [createEmptyGeneralSession()];
  }
  const cloned = INITIAL_SESSIONS.map(cloneSession);
  const hasGeneral = cloned.some((session) => session.scope === "general");
  return hasGeneral ? cloned : [createEmptyGeneralSession(), ...cloned];
};

const withGeneralFirst = (sessions: ChatSession[]): ChatSession[] => {
  const generalIndex = sessions.findIndex((session) => session.scope === "general");
  if (generalIndex <= 0) {
    return sessions;
  }
  const copy = [...sessions];
  const [general] = copy.splice(generalIndex, 1);
  copy.unshift(general);
  return copy;
};

const getSessionSeedFingerprint = (session: ChatSession): { fingerprint: string; createdAt: number } | null => {
  if (session.scope !== "thread" || session.messages.length === 0) {
    return null;
  }
  const firstUserMessage = session.messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0
  );
  if (!firstUserMessage) {
    return null;
  }
  const normalized = firstUserMessage.content.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const createdAt =
    typeof firstUserMessage.createdAt === "number" ? firstUserMessage.createdAt : session.createdAt;
  return {
    fingerprint: normalized,
    createdAt,
  };
};

const dedupeSessionsByConversation = (sessions: ChatSession[]): ChatSession[] => {
  const map = new Map<string, ChatSession>();
  const fingerprintEntries: Array<{ fingerprint: string; mapKey: string; createdAt: number }> = [];
  sessions.forEach((session) => {
    const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
    let key =
      session.scope === "general"
        ? GENERAL_SESSION_ID
        : normalizedConversationId ?? `session:${session.id}`;
    const fingerprint = getSessionSeedFingerprint(session);
    if (fingerprint) {
      const duplicateMatch = fingerprintEntries.find(
        (entry) =>
          entry.fingerprint === fingerprint.fingerprint &&
          Math.abs(entry.createdAt - fingerprint.createdAt) <= DUPLICATE_THREAD_WINDOW_MS
      );
      if (duplicateMatch) {
        key = duplicateMatch.mapKey;
      } else {
        fingerprintEntries.push({
          fingerprint: fingerprint.fingerprint,
          mapKey: key,
          createdAt: fingerprint.createdAt,
        });
      }
    }
    const existing = map.get(key);
    if (!existing) {
      map.set(key, session);
      return;
    }
    const existingScore = existing.messages.length;
    const currentScore = session.messages.length;
    const shouldReplace =
      currentScore > existingScore ||
      (currentScore === existingScore && session.updatedAt > existing.updatedAt);
    if (shouldReplace) {
      map.set(key, session);
    }
  });
  return Array.from(map.values());
};

const dedupeSessionsByTitleWindow = (sessions: ChatSession[]): ChatSession[] => {
  const titleMap = new Map<string, { index: number; session: ChatSession }>();
  const result: ChatSession[] = [];

  sessions.forEach((session) => {
    const normalizedTitle = session.title?.trim().toLowerCase() ?? "";
    if (!normalizedTitle) {
      result.push(session);
      return;
    }
    const existingEntry = titleMap.get(normalizedTitle);
    if (!existingEntry) {
      titleMap.set(normalizedTitle, { index: result.length, session });
      result.push(session);
      return;
    }
    const existing = existingEntry.session;
    const withinWindow =
      Math.abs(session.updatedAt - existing.updatedAt) <= REMOTE_SESSION_MERGE_WINDOW_MS;
    const isRemoteShell =
      withinWindow &&
      ((session.messages.length === 0 && existing.messages.length > 0) ||
        (existing.messages.length === 0 && session.messages.length > 0));
    if (isRemoteShell) {
      if (existing.messages.length === 0 && session.messages.length > 0) {
        result[existingEntry.index] = session;
        titleMap.set(normalizedTitle, { index: existingEntry.index, session });
      }
      return;
    }
    result.push(session);
  });

  return result;
};

const normalizeSessionsList = (sessions: ChatSession[]): ChatSession[] =>
  withGeneralFirst(dedupeSessionsByTitleWindow(dedupeSessionsByConversation(sessions)));

const loadStoredSessions = (
  _storageKeys: readonly string[]
): { key: string | null; sessions: ChatSession[] } => {
  // All chat session state is now ephemeral in memory and backed by the
  // database. We no longer hydrate from browser storage.
  return { key: null, sessions: defaultSessions() };
};

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const { user, waitForUser } = useUser();
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/system-prompt.txt", { signal: controller.signal });
        if (!response.ok) {
          return;
        }
        const text = await response.text();
        if (!isMounted) {
          return;
        }
        const trimmed = text.trim();
        setDefaultSystemPrompt(trimmed.length > 0 ? trimmed : null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to load system prompt:", error);
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const personalizedSystemPrompt = useMemo(
    () => buildPersonalizedSystemPrompt(user, defaultSystemPrompt),
    [user, defaultSystemPrompt]
  );
  const [sessionsState, setSessionsState] = useState<ChatSession[]>(defaultSessions);
  const sessionsRef = useRef<ChatSession[]>(sessionsState);
  const setSessions = useCallback(
    (updater: SetStateAction<ChatSession[]>) => {
      setSessionsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (value: ChatSession[]) => ChatSession[])(prev)
            : updater;
        sessionsRef.current = next;
        return next;
      });
    },
    []
  );
  const generalConversationId = useMemo(
    () => buildGeneralConversationId(user?.id),
    [user?.id]
  );
  const generalConversationIdRef = useRef<string | undefined>(generalConversationId);
  useEffect(() => {
    generalConversationIdRef.current = generalConversationId;
  }, [generalConversationId]);

  const sessions = sessionsState;
  const [remoteConversationsLoaded, setRemoteConversationsLoaded] = useState(false);
  const pendingTitleSyncRef = useRef<Map<string, string>>(new Map());
  const pendingThreadSeedsRef = useRef<Map<string, { sessionId: string; createdAt: number }>>(
    new Map()
  );
  const debouncedUpdateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [workspaceContextValue, setWorkspaceContextValue] = useState<string | null>(
    workspaceContext ?? null
  );
  const [selectedAttachments, setSelectedAttachments] = useState<MediaUpload[]>([]);
  const attachmentsRef = useRef<MediaUpload[]>(selectedAttachments);
  useEffect(() => {
    attachmentsRef.current = selectedAttachments;
  }, [selectedAttachments]);
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment?.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);
  const releaseAttachmentPreview = useCallback((attachment: MediaUpload) => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }, []);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [mapsEnabled, setMapsEnabled] = useState(false);
  const [mapsWidgetEnabled, setMapsWidgetEnabled] = useState(false);
  const [mapsLatitude, setMapsLatitude] = useState("");
  const [mapsLongitude, setMapsLongitude] = useState("");
  const [pendingLocationRequestMessage, setPendingLocationRequestMessage] = useState<string | null>(null);
  const [isHandlingLocationRequest, setIsHandlingLocationRequest] = useState(false);
  const pendingLocationRequestActionRef = useRef<(() => void) | null>(null);
  const mapPayload = useMemo(() => {
    const normalizedLatitude = mapsLatitude.trim();
    const normalizedLongitude = mapsLongitude.trim();
    const parsedLatitude = normalizedLatitude ? Number(normalizedLatitude) : undefined;
    const parsedLongitude = normalizedLongitude ? Number(normalizedLongitude) : undefined;
    const payload: {
      maps_enabled: boolean;
      maps_widget: boolean;
      maps_latitude?: number;
      maps_longitude?: number;
    } = {
      maps_enabled: mapsEnabled,
      maps_widget: mapsWidgetEnabled,
    };
    if (normalizedLatitude && !Number.isNaN(parsedLatitude ?? NaN)) {
      payload.maps_latitude = parsedLatitude;
    }
    if (normalizedLongitude && !Number.isNaN(parsedLongitude ?? NaN)) {
      payload.maps_longitude = parsedLongitude;
    }
    return payload;
  }, [mapsEnabled, mapsLatitude, mapsLongitude, mapsWidgetEnabled]);
  const hasLocationCoordinates = Boolean(
    mapPayload.maps_latitude != null && mapPayload.maps_longitude != null
  );
  const getGeolocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.navigator?.geolocation) {
        resolve(null);
        return;
      }
      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => resolve(null)
      );
    });
  };
  const runPendingLocationAction = () => {
    const action = pendingLocationRequestActionRef.current;
    pendingLocationRequestActionRef.current = null;
    setTimeout(() => {
      action?.();
    }, 0);
  };
  const handleLocationConsent = async (shareLocation: boolean) => {
    const action = pendingLocationRequestActionRef.current;
    if (!action) {
      setPendingLocationRequestMessage(null);
      return;
    }
    if (!shareLocation) {
      setPendingLocationRequestMessage(null);
      runPendingLocationAction();
      return;
    }
    setIsHandlingLocationRequest(true);
    try {
      const coords = await getGeolocation();
      if (coords) {
        setMapsLatitude(coords.latitude.toString());
        setMapsLongitude(coords.longitude.toString());
        setMapsEnabled(true);
        setMapsWidgetEnabled(true);
      }
      setPendingLocationRequestMessage(null);
      runPendingLocationAction();
    } finally {
      setIsHandlingLocationRequest(false);
    }
  };
  const promptForLocationConsent = (message: string, sendAction: () => void) => {
    if (
      !shouldAutoEnableMapsForMessage(message) ||
      mapsEnabled ||
      hasLocationCoordinates ||
      pendingLocationRequestMessage
    ) {
      void sendAction();
      return true;
    }
    pendingLocationRequestActionRef.current = sendAction;
    setPendingLocationRequestMessage(message);
    return false;
  };
  const requestLocationShare = () => {
    void handleLocationConsent(true);
  };
  const skipLocationShare = () => {
    void handleLocationConsent(false);
  };
  const buildAutoMapPayload = useCallback(
    (message: string) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return mapPayload;
      }
      if (mapPayload.maps_enabled) {
        return mapPayload;
      }
      return shouldAutoEnableMapsForMessage(trimmedMessage)
        ? {
            ...mapPayload,
            maps_enabled: true,
            maps_widget: mapPayload.maps_widget || true,
          }
        : mapPayload;
    },
    [mapPayload]
  );
  const [contextCaches, setContextCaches] = useState<ContextCache[]>([]);
  const [contextCacheLabel, setContextCacheLabel] = useState("");
  const [contextCacheContent, setContextCacheContent] = useState("");
  const [selectedContextCacheId, setSelectedContextCacheId] = useState<number | null>(null);
  const [contextCacheMessage, setContextCacheMessage] = useState<string | null>(null);
  const [isContextCacheSaving, setIsContextCacheSaving] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [fileSearchStores, setFileSearchStores] = useState<{ name: string; display_name?: string }[]>([]);
  const [fileSearchDisplayName, setFileSearchDisplayName] = useState("");
  const [fileSearchStatus, setFileSearchStatus] = useState<string | null>(null);
  const [isCreatingFileSearchStore, setIsCreatingFileSearchStore] = useState(false);
  const [selectedFileSearchStore, setSelectedFileSearchStore] = useState("");
  const [fileSearchUploadFile, setFileSearchUploadFile] = useState<File | null>(null);
  const [fileSearchUploadStatus, setFileSearchUploadStatus] = useState<string | null>(null);
  const [fileSearchChunking, setFileSearchChunking] = useState({
    maxTokensPerChunk: "",
    maxOverlapTokens: "",
  });
  const [fileSearchImportName, setFileSearchImportName] = useState("");
  const [fileSearchImportStatus, setFileSearchImportStatus] = useState<string | null>(null);
  const fileSearchUploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoCachedWorkspaceRef = useRef<string | null>(null);
  const autoCacheInFlightRef = useRef(false);

  // Web search preference is now kept in memory for the current session only.

  const saveContextCache = useCallback(
    async (
      payload: ContextCacheBase,
      options: SaveContextCacheOptions = {}
    ): Promise<ContextCache | null> => {
      if (!user?.id) {
        if (!options.skipMessage) {
          setContextCacheMessage("Sign in to cache context.");
        }
        return null;
      }
      const trimmedContent = payload.content.trim();
      if (!trimmedContent) {
        if (!options.skipMessage) {
          setContextCacheMessage("Add context content before saving.");
        }
        return null;
      }

      const normalizedPayload: ContextCacheBase = {
        content: trimmedContent,
      };
      const label = payload.label?.trim();
      if (label) {
        normalizedPayload.label = label;
      }
      if (payload.conversation_id) {
        normalizedPayload.conversation_id = payload.conversation_id;
      }

      setIsContextCacheSaving(true);
      if (!options.skipMessage) {
        setContextCacheMessage(null);
      }
      try {
        const created = await apiService.createContextCache(user.id, normalizedPayload);
        setContextCaches((prev) => [created, ...prev]);
        setSelectedContextCacheId(created.id);
        if (!options.skipMessage) {
          setContextCacheMessage("Context cached for reuse.");
        }
        if (!options.skipReset) {
          setContextCacheLabel("");
          setContextCacheContent("");
        }
        return created;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cache context.";
        if (!options.skipMessage) {
          setContextCacheMessage(message);
        }
        console.error("Failed to cache context:", error);
        return null;
      } finally {
        setIsContextCacheSaving(false);
      }
    },
    [user?.id]
  );

  const createContextCache = useCallback(
    async (conversationId?: string) => {
      const normalizedConversationId = normalizeConversationIdValue(conversationId ?? undefined);
      const payload: ContextCacheBase = {
        content: contextCacheContent,
      };
      if (contextCacheLabel.trim()) {
        payload.label = contextCacheLabel.trim();
      }
      if (normalizedConversationId) {
        payload.conversation_id = normalizedConversationId;
      }
      await saveContextCache(payload);
    },
    [contextCacheContent, contextCacheLabel, saveContextCache]
  );

  useEffect(() => {
    if (!user?.id) {
      lastAutoCachedWorkspaceRef.current = null;
      return;
    }
    const trimmedWorkspace = workspaceContextValue?.trim();
    if (!trimmedWorkspace) {
      lastAutoCachedWorkspaceRef.current = null;
      return;
    }
    if (lastAutoCachedWorkspaceRef.current === trimmedWorkspace) {
      return;
    }
    if (autoCacheInFlightRef.current) {
      return;
    }
    autoCacheInFlightRef.current = true;
    (async () => {
      try {
        const cached = await saveContextCache(
          { content: trimmedWorkspace, label: "Workspace context" },
          { skipMessage: true, skipReset: true }
        );
        if (cached) {
          lastAutoCachedWorkspaceRef.current = trimmedWorkspace;
        }
      } catch (error) {
        console.error("Failed to auto-cache workspace context:", error);
      } finally {
        autoCacheInFlightRef.current = false;
      }
    })();
  }, [saveContextCache, user?.id, workspaceContextValue]);

  const selectContextCacheId = useCallback((cacheId: number | null) => {
    setSelectedContextCacheId(cacheId);
  }, []);
  const fileSearchChunkingConfig = useMemo(() => {
    const maxTokens = Number(fileSearchChunking.maxTokensPerChunk);
    const maxOverlap = Number(fileSearchChunking.maxOverlapTokens);
    const whiteSpaceConfig: Record<string, number> = {};
    if (!Number.isNaN(maxTokens) && maxTokens > 0) {
      whiteSpaceConfig.max_tokens_per_chunk = maxTokens;
    }
    if (!Number.isNaN(maxOverlap) && maxOverlap >= 0) {
      whiteSpaceConfig.max_overlap_tokens = maxOverlap;
    }
    if (!Object.keys(whiteSpaceConfig).length) {
      return undefined;
    }
    return { white_space_config: whiteSpaceConfig };
  }, [fileSearchChunking.maxTokensPerChunk, fileSearchChunking.maxOverlapTokens]);

  const handleCreateFileSearchStore = useCallback(async () => {
    setIsCreatingFileSearchStore(true);
    setFileSearchStatus(null);
    try {
      const store = await apiService.createFileSearchStore(
        fileSearchDisplayName.trim() || undefined
      );
      setFileSearchStores((prev) => [store, ...prev]);
      setSelectedFileSearchStore(store.name);
      setFileSearchDisplayName("");
      setFileSearchStatus(
        `Created ${store.display_name ?? store.name}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create file store.";
      setFileSearchStatus(message);
    } finally {
      setIsCreatingFileSearchStore(false);
    }
  }, [fileSearchDisplayName]);

  const handleFileSearchUpload = useCallback(async () => {
    if (!selectedFileSearchStore || !fileSearchUploadFile) {
      setFileSearchUploadStatus("Select a store and file first.");
      return;
    }
    setFileSearchUploadStatus("Uploading...");
    try {
      await apiService.uploadToFileSearchStore({
        storeName: selectedFileSearchStore,
        file: fileSearchUploadFile,
        displayName: fileSearchUploadFile.name,
        chunkingConfig: fileSearchChunkingConfig,
      });
      setFileSearchUploadStatus("Upload queued.");
      setFileSearchUploadFile(null);
      if (fileSearchUploadInputRef.current) {
        fileSearchUploadInputRef.current.value = "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "File Search upload failed.";
      setFileSearchUploadStatus(message);
    }
  }, [fileSearchChunkingConfig, fileSearchUploadFile, selectedFileSearchStore]);

  const handleFileSearchImport = useCallback(async () => {
    if (!selectedFileSearchStore || !fileSearchImportName.trim()) {
      setFileSearchImportStatus("Select store and specify file name.");
      return;
    }
    setFileSearchImportStatus("Importing...");
    try {
      await apiService.importFileSearch({
        storeName: selectedFileSearchStore,
        fileName: fileSearchImportName.trim(),
        chunkingConfig: fileSearchChunkingConfig,
      });
      setFileSearchImportStatus("Import started.");
      setFileSearchImportName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "File Search import failed.";
      setFileSearchImportStatus(message);
    }
  }, [fileSearchChunkingConfig, fileSearchImportName, selectedFileSearchStore]);
  const hasLoadedFromStorageRef = useRef(true);
  const autoStreamTriggeredRef = useRef<Set<string>>(new Set());
  const pendingHistorySyncRef = useRef<Set<string>>(new Set());
  const sessionStorageKeyCandidates = useMemo(
    () => buildSessionStorageKeyCandidates(user?.id ?? null, user?.email ?? null),
    [user?.id, user?.email]
  );
  const sessionStorageKey = sessionStorageKeyCandidates[0] ?? null;
  const previousSessionStorageKeyRef = useRef<string | null>(null);
  const reminderDeliveryCacheRef = useRef<Set<number>>(new Set());
  const markAutoStreamTriggered = useCallback((sessionId: string, messageId?: string | null) => {
    if (!sessionId || !messageId) {
      return;
    }
    autoStreamTriggeredRef.current.add(`${sessionId}:${messageId}`);
  }, []);
  const hasAutoStreamTriggered = useCallback((sessionId: string, messageId?: string | null) => {
    if (!sessionId || !messageId) {
      return false;
    }
    return autoStreamTriggeredRef.current.has(`${sessionId}:${messageId}`);
  }, []);
  const resetAutoStreamState = useCallback((sessionId?: string | null) => {
    if (!sessionId) {
      autoStreamTriggeredRef.current.clear();
      return;
    }
    const prefix = `${sessionId}:`;
    const keysToDelete: string[] = [];
    autoStreamTriggeredRef.current.forEach((value) => {
      if (value.startsWith(prefix)) {
        keysToDelete.push(value);
      }
    });
    keysToDelete.forEach((key) => autoStreamTriggeredRef.current.delete(key));
  }, []);
  const scheduleHistorySync = useCallback(
    (conversationId: string, payload: ConversationHistoryEntryPayload[]) => {
      void (async () => {
        try {
          await apiService.overwriteConversationHistory(conversationId, payload);
        } catch (error) {
          console.warn("Failed to sync conversation history after deletion:", error);
        }
      })();
    },
    []
  );
  const historySyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const enqueueHistorySync = useCallback(
    (conversationId: string, payload: ConversationHistoryEntryPayload[]) => {
      const existing = historySyncTimersRef.current.get(conversationId);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        historySyncTimersRef.current.delete(conversationId);
        scheduleHistorySync(conversationId, payload);
      }, 250);
      historySyncTimersRef.current.set(conversationId, timer);
    },
    [scheduleHistorySync]
  );

  useEffect(() => {
    return () => {
      historySyncTimersRef.current.forEach((timer) => clearTimeout(timer));
      historySyncTimersRef.current.clear();
    };
  }, []);

  // Ensure existing conversations are synced to the backend at least once so that
  // any past local edits (including deletions that previously only affected
  // localStorage) are reflected in the remote history.
  const syncedHistoryRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const seen = syncedHistoryRef.current;
    sessions.forEach((session) => {
      const normalizedConversationId = normalizeConversationIdValue(session.conversationId ?? undefined);
      if (!normalizedConversationId || seen.has(normalizedConversationId)) {
        return;
      }
      if (!session.messages || session.messages.length === 0) {
        // Skip syncing empty shells (e.g. shared links before hydration) so we don't wipe remote history.
        return;
      }
      const payload = buildConversationHistoryPayload(session.messages);
      enqueueHistorySync(normalizedConversationId, payload);
      seen.add(normalizedConversationId);
    });
  }, [sessions, enqueueHistorySync]);
  const resolveChatUser = useCallback(async () => {
    if (user) {
      return user;
    }
    return waitForUser();
  }, [user, waitForUser]);

  const schedulePendingSeedCleanup = useCallback((seed: string, sessionId: string) => {
    if (!seed) {
      return;
    }
    const existing = pendingThreadSeedsRef.current.get(seed);
    if (!existing || existing.sessionId !== sessionId) {
      pendingThreadSeedsRef.current.set(seed, { sessionId, createdAt: Date.now() });
    }
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      const pending = pendingThreadSeedsRef.current.get(seed);
      if (pending?.sessionId === sessionId) {
        pendingThreadSeedsRef.current.delete(seed);
      }
    }, DUPLICATE_THREAD_WINDOW_MS);
  }, []);

  const uploadAttachments = useCallback(
    async (files: FileList | File[]) => {
      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) {
        return;
      }

      setAttachmentError(null);
      setIsAttachmentUploading(true);

      try {
        const resolvedUser = await resolveChatUser();
        if (!resolvedUser) {
          throw new Error("Unable to upload without an authenticated user.");
        }
        const uploads: MediaUpload[] = [];
        for (const file of selectedFiles) {
          if (!file) {
            continue;
          }
          const upload = await apiService.uploadMediaFile(resolvedUser.id, file);
          const previewUrl = file.type?.toLowerCase().startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined;
          uploads.push({ ...upload, previewUrl });
        }
        if (uploads.length > 0) {
          setSelectedAttachments((prev) => [...prev, ...uploads]);
        }
      } catch (error) {
        console.error("Failed to upload attachments:", error);
        if (error instanceof Error) {
          setAttachmentError(error.message);
        } else {
          setAttachmentError("Failed to upload attachment.");
        }
      } finally {
        setIsAttachmentUploading(false);
      }
    },
    [resolveChatUser]
  );

  const removeAttachment = useCallback(
    (id: number) => {
      setSelectedAttachments((prev) => {
        const next: MediaUpload[] = [];
        prev.forEach((attachment) => {
          if (attachment.id === id) {
            releaseAttachmentPreview(attachment);
            return;
          }
          next.push(attachment);
        });
        return next;
      });
    },
    [releaseAttachmentPreview]
  );

  const clearAttachments = useCallback(() => {
    setSelectedAttachments((prev) => {
      prev.forEach(releaseAttachmentPreview);
      return [];
    });
  }, [releaseAttachmentPreview]);

  useEffect(() => {
    if (workspaceContext !== undefined) {
      setWorkspaceContextValue(workspaceContext ?? null);
    }
  }, [workspaceContext]);

  const persistSessions = useCallback((_next: ChatSession[]) => {
    // Sessions are kept in React state only; persistence is handled by the
    // backend via conversations and conversation_messages.
  }, []);

  useEffect(() => {
    setSessions((prev) => {
      let changed = false;
      const next = prev.map((session) => {
        if (session.scope !== "general") {
          return session;
        }
        const nextConversationId = generalConversationId ?? undefined;
        if (session.conversationId === nextConversationId) {
          return session;
        }
        changed = true;
        return { ...session, conversationId: nextConversationId };
      });
      if (!changed) {
        return prev;
      }
      const ordered = normalizeSessionsList(next);
      persistSessions(ordered);
      return ordered;
    });
  }, [generalConversationId, persistSessions, setSessions]);

  useEffect(() => {
    if (!pendingHistorySyncRef.current.size) {
      return;
    }
    const pending = Array.from(pendingHistorySyncRef.current);
    pending.forEach((sessionId) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      if (!session) {
        pendingHistorySyncRef.current.delete(sessionId);
        return;
      }
      const normalizedConversationId = normalizeConversationIdValue(session.conversationId ?? undefined);
      if (!normalizedConversationId) {
        return;
      }
      pendingHistorySyncRef.current.delete(sessionId);
      const payload = buildConversationHistoryPayload(session.messages);
      scheduleHistorySync(normalizedConversationId, payload);
    });
  }, [sessions, scheduleHistorySync]);

  const syncConversationTitle = useCallback(
    async (sessionId: string, conversationId: string, title: string) => {
      const trimmed = title.trim();
      const normalizedConversationId = normalizeConversationIdValue(conversationId);
      if (!trimmed || !normalizedConversationId) {
        return;
      }
      if (!user?.id) {
        // Wait until we know the numeric user so the backend can create or update the row.
        return;
      }
      try {
        await apiService.updateConversation(normalizedConversationId, {
          title: trimmed,
          user_id: user.id,
        });
        pendingTitleSyncRef.current.delete(sessionId);
      } catch (error) {
        pendingTitleSyncRef.current.delete(sessionId);
        console.warn(
          "Skipping remote conversation title update (falling back to local title only):",
          error
        );
      }
    },
    [user?.id]
  );

  const queueConversationTitleSync = useCallback(
    (sessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        pendingTitleSyncRef.current.delete(sessionId);
        return;
      }
      pendingTitleSyncRef.current.set(sessionId, trimmed);
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      const normalizedConversationId = normalizeConversationIdValue(session?.conversationId);
      if (normalizedConversationId) {
        void syncConversationTitle(sessionId, normalizedConversationId, trimmed);
      }
    },
    [syncConversationTitle]
  );

  useEffect(() => {
    pendingTitleSyncRef.current.forEach((title, sessionId) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      const normalizedConversationId = normalizeConversationIdValue(session?.conversationId);
      if (normalizedConversationId) {
        void syncConversationTitle(sessionId, normalizedConversationId, title);
      }
    });
  }, [sessions, syncConversationTitle]);

  const updateSession = useCallback(
    (sessionId: string, partial: Partial<ChatSession>) => {
      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const normalizedPartial: Partial<ChatSession> = { ...partial };
          if ("conversationId" in partial) {
            normalizedPartial.conversationId = normalizeConversationIdValue(partial.conversationId);
          }
          return { ...session, ...normalizedPartial };
        });
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions]
  );

  const applyAutoTitle = useCallback(
    (sessionId: string, candidate?: string | null) => {
      const session = sessionsRef.current.find((entry) => entry.id === sessionId);
      if (!session || session.scope === "general" || session.titleMode === "manual") {
        return;
      }
      const rawTitle = (candidate ?? "").trim();
      if (!rawTitle) {
        return;
      }
      // Only replace placeholder / generic titles so we don't fight manual titles
      // or backend-generated titles that are already set.
      if (!isGenericSessionTitle(session.title)) {
        return;
      }
      if (session.title?.trim() === rawTitle) {
        return;
      }
      updateSession(sessionId, { title: rawTitle, titleMode: "auto" });
      queueConversationTitleSync(sessionId, rawTitle);
    },
    [queueConversationTitleSync, updateSession]
  );

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => {
      let assistantAutoTitle: string | null = null;
      setSessions((prev) => {
        let didUpdate = false;
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const messages = session.messages.map((message) => {
            if (message.id !== messageId) {
              return message;
            }
            didUpdate = true;
            let nextPartial = partial;
            if (typeof partial.content === "string" && message.role === "assistant") {
              const parsedContent = parseGrayTitleMarkers(partial.content);
              const normalized = normalizeAssistantMessage(message.role, parsedContent.cleanText);
              nextPartial = {
                ...partial,
                content: normalized.content,
                reminders: normalized.reminders,
              };
              if (parsedContent.title) {
                assistantAutoTitle = parsedContent.title;
              }
            }
            return { ...message, ...nextPartial };
          });
          if (!didUpdate) {
            return session;
          }
          return {
            ...session,
            messages,
          };
        });
        if (!didUpdate) {
          return prev;
        }
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      if (assistantAutoTitle) {
        applyAutoTitle(sessionId, assistantAutoTitle);
      }
    },
    [applyAutoTitle, persistSessions]
  );

  // Debounced version of updateMessage for streaming (reduces re-renders)
  const updateMessageDebounced = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>, delay = 100) => {
      const key = `${sessionId}:${messageId}`;

      // Clear existing timeout
      const existingTimeout = debouncedUpdateTimeoutsRef.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeout = setTimeout(() => {
        let assistantAutoTitle: string | null = null;
        debouncedUpdateTimeoutsRef.current.delete(key);
        // Use setSessions directly to avoid circular dependency
        setSessions((prev) => {
          let didUpdate = false;
          const next = prev.map((session) => {
            if (session.id !== sessionId) {
              return session;
            }
            const messages = session.messages.map((message) => {
              if (message.id !== messageId) {
                return message;
              }
              didUpdate = true;
              let nextPartial = partial;
              if (typeof partial.content === "string" && message.role === "assistant") {
                const parsedContent = parseGrayTitleMarkers(partial.content);
                const normalized = normalizeAssistantMessage(message.role, parsedContent.cleanText);
                nextPartial = {
                  ...partial,
                  content: normalized.content,
                  reminders: normalized.reminders,
                };
                if (parsedContent.title) {
                  assistantAutoTitle = parsedContent.title;
                }
              }
              return { ...message, ...nextPartial };
            });
            if (!didUpdate) {
              return session;
            }
            return {
              ...session,
              messages,
            };
          });
          if (!didUpdate) {
            return prev;
          }
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });

        if (assistantAutoTitle) {
          applyAutoTitle(sessionId, assistantAutoTitle);
        }
      }, delay);

      debouncedUpdateTimeoutsRef.current.set(key, timeout);
    },
    [applyAutoTitle, persistSessions]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      debouncedUpdateTimeoutsRef.current.clear();
    };
  }, []);

  const deleteMessage = useCallback(
    (sessionId: string, messageId: string) => {
      let historyPayload: ConversationHistoryEntryPayload[] | null = null;
      let conversationIdForSync: string | undefined;

      setSessions((prev) => {
        let didUpdate = false;
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const filtered = session.messages.filter((message) => message.id !== messageId);
          if (filtered.length === session.messages.length) {
            return session;
          }
          didUpdate = true;

          const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
          const payload = buildConversationHistoryPayload(filtered);

          if (normalizedConversationId) {
            conversationIdForSync = normalizedConversationId;
            historyPayload = payload;
            pendingHistorySyncRef.current.delete(session.id);
          } else if (session.scope === "thread") {
            pendingHistorySyncRef.current.add(session.id);
          }

          return {
            ...session,
            messages: filtered,
            updatedAt: Date.now(),
          };
        });
        if (!didUpdate) {
          return prev;
        }
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      if (conversationIdForSync && historyPayload) {
        enqueueHistorySync(conversationIdForSync, historyPayload);
      }
    },
    [enqueueHistorySync, persistSessions, user?.id]
  );

  const renameSession = useCallback(
    (sessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        return;
      }
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      if (target?.scope === "general") {
        return;
      }
      const normalized = trimmed.length > 100 ? trimmed.slice(0, 100).trim() : trimmed;
      updateSession(sessionId, {
        title: normalized,
        titleMode: "manual",
        updatedAt: Date.now(),
      });
      queueConversationTitleSync(sessionId, normalized);
    },
    [queueConversationTitleSync, updateSession]
  );

  const appendMessage = useCallback(
    (
      sessionId: string,
      role: ChatRole,
      content: string,
      tempId?: string,
      metadata?: GroundingMetadata
    ) => {
      let assistantAutoTitle: string | null = null;
      let normalizedContent = content;
      if (role === "assistant") {
        const parsedContent = parseGrayTitleMarkers(content);
        normalizedContent = parsedContent.cleanText;
        assistantAutoTitle = parsedContent.title;
      }

      // Create the message immediately instead of inside setState
      const createdMessage = makeMessage(role, normalizedContent, tempId, metadata);

      setSessions((prev) => {
        let didUpdate = false;

        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          didUpdate = true;

          return {
            ...session,
            messages: [...session.messages, createdMessage],
            updatedAt: createdMessage.createdAt,
            isResponding: role === "user",
            title: session.title,
          };
        });

        if (didUpdate) {
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        }

        const fallbackScope = sessionId === GENERAL_SESSION_ID ? "general" : "thread";
        const fallbackSession: ChatSession =
          fallbackScope === "general"
            ? {
                ...createEmptyGeneralSession(createdMessage.createdAt, generalConversationIdRef.current),
                messages: [createdMessage],
                updatedAt: createdMessage.createdAt,
                isResponding: role === "user",
                pendingAutoStream: false,
              }
            : {
                id: sessionId,
                title: "New Chat",
                titleMode: "auto",
                createdAt: createdMessage.createdAt,
                updatedAt: createdMessage.createdAt,
                messages: [createdMessage],
                isResponding: role === "user",
                scope: "thread",
                conversationId: undefined,
                pendingAutoStream: false,
              };

        const ordered = normalizeSessionsList([fallbackSession, ...prev]);
        persistSessions(ordered);
        return ordered;
      });

      if (role === "assistant" && assistantAutoTitle) {
        applyAutoTitle(sessionId, assistantAutoTitle);
      }

      return createdMessage;
    },
    [applyAutoTitle, persistSessions]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      if (!target || target.scope === "general") {
        return;
      }

      // Clear any pending auto-stream for this session so deletion never triggers regeneration.
      resetAutoStreamState(sessionId);

      // Optimistically remove locally so it disappears from history & context immediately.
      setSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId);
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      // Best-effort server-side delete so the conversation is removed from backend context too.
      const normalizedConversationId = normalizeConversationIdValue(target.conversationId ?? target.id);
      if (normalizedConversationId) {
        void (async () => {
          try {
            await apiService.deleteConversation(normalizedConversationId);
          } catch (error) {
            console.error("Failed to delete remote conversation; local session already removed:", error);
          }
        })();
      }
    },
    [persistSessions, resetAutoStreamState]
  );

  const ensureGeneralSession = useCallback((): ChatSession => {
    const existing = sessionsRef.current.find((session) => session.scope === "general");
    if (existing) {
      return existing;
    }
    const created = createEmptyGeneralSession(undefined, generalConversationIdRef.current);
    setSessions((prev) => {
      const next = normalizeSessionsList([created, ...prev]);
      persistSessions(next);
      return next;
    });
    return created;
  }, [persistSessions]);

const mergeRemoteConversations = useCallback(
  (conversations: ConversationSummary[]) => {
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return;
    }

    const shouldAdoptRemoteTitle = (currentTitle: string | null | undefined, remoteTitle: string) => {
      if (!remoteTitle || !remoteTitle.trim()) {
        return false;
      }
      const normalizedRemote = remoteTitle.trim();
      const normalizedCurrent = (currentTitle ?? "").trim();
      if (!normalizedCurrent) {
        return true;
      }
      if (normalizedCurrent.toLowerCase() === normalizedRemote.toLowerCase()) {
        return false;
      }
      if (normalizedCurrent.toLowerCase() === SHARED_CHAT_PLACEHOLDER_TITLE.toLowerCase()) {
        return true;
      }
      return isGenericTitle(normalizedCurrent);
    };
      setSessions((prev) => {
        let changed = false;
        const next = [...prev];
        const indexById = new Map(next.map((session, index) => [session.id, index]));
        const indexByConversationId = new Map(
          next
            .map((session, index) => [normalizeConversationIdValue(session.conversationId), index] as const)
            .filter(([conversationId]) => typeof conversationId === "string")
        );

        const findExistingIndex = (conversationId: string): number | undefined => {
          if (indexById.has(conversationId)) {
            return indexById.get(conversationId);
          }
          if (indexByConversationId.has(conversationId)) {
            return indexByConversationId.get(conversationId);
          }
          return undefined;
        };

        const findPendingSessionMatch = (targetTimestamp: number): number | undefined => {
          let bestIndex: number | undefined;
          let smallestDiff = REMOTE_SESSION_MERGE_WINDOW_MS + 1;
          next.forEach((session, index) => {
            if (session.scope !== "thread" || session.conversationId) {
              return;
            }
            if (!session.messages.length) {
              return;
            }
            const first = session.messages[0];
            if (!first || first.role !== "user" || !first.content.trim()) {
              return;
            }
            const diff = Math.abs(session.createdAt - targetTimestamp);
            if (diff > REMOTE_SESSION_MERGE_WINDOW_MS || diff >= smallestDiff) {
              return;
            }
            smallestDiff = diff;
            bestIndex = index;
          });
          return bestIndex;
        };

        conversations.forEach((record) => {
          const conversationId = normalizeConversationIdValue(record.id);
          if (!conversationId) {
            return;
          }
          const normalizedTitle =
            record.title?.trim() && record.title.trim().length > 0 ? record.title.trim() : "New Chat";
          const createdAt = toTimestamp(record.created_at);
          const updatedAt = toTimestamp(record.updated_at ?? record.created_at);
          const existingIndex = findExistingIndex(conversationId);

          if (typeof existingIndex === "number") {
            const current = next[existingIndex];
            const adoptRemoteTitle = shouldAdoptRemoteTitle(current.title, normalizedTitle);
            const merged: ChatSession = {
              ...current,
              createdAt: Math.min(current.createdAt, createdAt),
              updatedAt: Math.max(current.updatedAt, updatedAt),
              conversationId,
              ...(adoptRemoteTitle
                ? {
                    title: normalizedTitle,
                    titleMode: isGenericTitle(normalizedTitle) ? "auto" : "manual",
                  }
                : {}),
            };
            if (
              merged.title !== current.title ||
              merged.updatedAt !== current.updatedAt ||
              merged.conversationId !== current.conversationId ||
              merged.createdAt !== current.createdAt
            ) {
              next[existingIndex] = merged;
              changed = true;
            }
            return;
          }

          const pendingIndex = findPendingSessionMatch(createdAt);
          if (typeof pendingIndex === "number") {
            const pending = next[pendingIndex];
            const adoptRemoteTitle = shouldAdoptRemoteTitle(pending.title, normalizedTitle);
            const merged: ChatSession = {
              ...pending,
              createdAt: Math.min(pending.createdAt, createdAt),
              updatedAt: Math.max(pending.updatedAt, updatedAt),
              conversationId,
              pendingAutoStream: false,
              ...(adoptRemoteTitle
                ? {
                    title: normalizedTitle,
                    titleMode: isGenericTitle(normalizedTitle) ? "auto" : "manual",
                  }
                : {}),
            };
            next[pendingIndex] = merged;
            indexByConversationId.set(conversationId, pendingIndex);
            changed = true;
            return;
          }

          const newSession: ChatSession = {
            id: conversationId,
            title: normalizedTitle,
            titleMode: isGenericTitle(normalizedTitle) ? "auto" : "manual",
            createdAt,
            updatedAt,
            messages: [],
            isResponding: false,
            scope: "thread",
            conversationId,
            pendingAutoStream: false,
          };
          next.push(newSession);
          indexById.set(conversationId, next.length - 1);
          indexByConversationId.set(conversationId, next.length - 1);
          changed = true;
        });

        if (!changed) {
          return prev;
        }

        const deduped: ChatSession[] = [];
        const seenConversationIds = new Map<string, number>();

        next.forEach((session) => {
          const conversationId = normalizeConversationIdValue(session.conversationId);
          if (!conversationId) {
            deduped.push(session);
            return;
          }
          const existingIndex = seenConversationIds.get(conversationId);
          if (typeof existingIndex === "number") {
            const existing = deduped[existingIndex];
            const currentScore = session.messages.length;
            const existingScore = existing.messages.length;
            const shouldReplace =
              currentScore > existingScore ||
              (currentScore === existingScore && session.updatedAt > existing.updatedAt);
            if (shouldReplace) {
              deduped[existingIndex] = session;
            }
            changed = true;
            return;
          }
          seenConversationIds.set(conversationId, deduped.length);
          deduped.push(session);
        });

        const ordered = normalizeSessionsList(deduped);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions]
  );

  useEffect(() => {
    setRemoteConversationsLoaded(false);
    if (!user?.id) {
      return;
    }
    let cancelled = false;
    const loadRemoteConversations = async () => {
      try {
        const records = await apiService.listUserConversations(user.id, 200);
        if (cancelled || !records) {
          return;
        }
        mergeRemoteConversations(records);
      } catch (error) {
        console.error("Failed to load remote conversations:", error);
      } finally {
        if (!cancelled) {
          setRemoteConversationsLoaded(true);
        }
      }
    };
    void loadRemoteConversations();
    return () => {
      cancelled = true;
      setRemoteConversationsLoaded(false);
    };
  }, [user?.id, mergeRemoteConversations]);

  const createThreadSession = useCallback(
    async (
      initialMessage?: string,
      options?: {
        autoStream?: boolean;
        /**
         * When called from the General workspace (e.g. primary input box),
         * we should NOT fork a new thread. Instead, route this through the
         * canonical General session so "General" stays a single stable thread.
         */
        fromGeneral?: boolean;
      }
    ): Promise<ChatSession> => {
      // If this invocation is coming from the General entrypoint, do not create
      // a new thread session. Reuse the General session instead so that messages
      // sent from "General" always belong to the General conversation.
      if (options?.fromGeneral) {
        const general = ensureGeneralSession();
        // If there's an initial message, send it via the general path so it
        // streams correctly and binds to the existing conversation_id.
        if ((initialMessage ?? "").trim().length > 0) {
          void sendGeneralMessage(initialMessage ?? "");
        }
        return general;
      }
      const now = Date.now();
      const trimmedInitial = (initialMessage ?? "").trim();
      const normalizedInitial = trimmedInitial.toLowerCase();
      const shouldAutoStream = options?.autoStream !== false;
      let duplicateCandidate: ChatSession | null = null;
      if (trimmedInitial.length > 0) {
        const pendingSeed = pendingThreadSeedsRef.current.get(normalizedInitial);
        if (pendingSeed && now - pendingSeed.createdAt <= DUPLICATE_THREAD_WINDOW_MS) {
          duplicateCandidate =
            sessionsRef.current.find((session) => session.id === pendingSeed.sessionId) ?? null;
        }
        if (!duplicateCandidate) {
          duplicateCandidate =
            sessionsRef.current.find((session) => {
              if (session.scope !== "thread") {
                return false;
              }
              const [firstMessage] = session.messages;
              if (!firstMessage || firstMessage.role !== "user") {
                return false;
              }
              if (firstMessage.content.trim().toLowerCase() !== normalizedInitial) {
                return false;
              }
              const ageMs = now - session.createdAt;
              if (!Number.isFinite(ageMs) || ageMs > DUPLICATE_THREAD_WINDOW_MS) {
                return false;
              }
              return session.isResponding || session.pendingAutoStream;
            }) ?? null;
        }
      }
      if (duplicateCandidate) {
        if (normalizedInitial) {
          pendingThreadSeedsRef.current.set(normalizedInitial, {
            sessionId: duplicateCandidate.id,
            createdAt: now,
          });
          schedulePendingSeedCleanup(normalizedInitial, duplicateCandidate.id);
        }
        if (!shouldAutoStream && duplicateCandidate.pendingAutoStream) {
          updateSession(duplicateCandidate.id, { pendingAutoStream: false });
        }
        return duplicateCandidate;
      }
      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const fallbackTitle = "New Chat";

      const baseSession: ChatSession = {
        id: sessionId,
        title: fallbackTitle,
        titleMode: "auto",
        createdAt: now,
        updatedAt: now,
        messages: [],
        isResponding: false,
        scope: "thread",
        conversationId: sessionId,
        pendingAutoStream: false,
      };

      if (normalizedInitial) {
        pendingThreadSeedsRef.current.set(normalizedInitial, { sessionId, createdAt: now });
        schedulePendingSeedCleanup(normalizedInitial, sessionId);
      }

      if (trimmedInitial) {
        const userMessage = makeMessage("user", trimmedInitial);
        // Mark this message as already triggered for auto-streaming
        markAutoStreamTriggered(sessionId, userMessage.id);
        baseSession.messages = [userMessage];
        baseSession.updatedAt = userMessage.createdAt;
      }

      setSessions((prev) => {
        const general = prev.find((session) => session.scope === "general");
        const others = prev.filter((session) => !(general && session.id === general.id));
        const next = general ? [general, baseSession, ...others] : [baseSession, ...others];
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      queueConversationTitleSync(sessionId, fallbackTitle);

      if (!trimmedInitial) {
        return baseSession;
      }

      if (!shouldAutoStream) {
        return baseSession;
      }

      const resolvedUserPromise = resolveChatUser();

      const useWorkspaceContext = shouldIncludeWorkspaceContext(
        trimmedInitial,
        workspaceContextValue
      );
      const contextPayload = useWorkspaceContext ? workspaceContextValue ?? undefined : undefined;

      const streamThreadResponse = () => {
        (async () => {
          let assistantMessageId: string | null = null;
          try {
            const resolvedUser = await resolvedUserPromise;

            if (!resolvedUser) {
              if (trimmedInitial && typeof window !== "undefined") {
                window.setTimeout(() => {
                  appendMessage(sessionId, "assistant", buildAssistantReply(trimmedInitial));
                  updateSession(sessionId, { isResponding: false, pendingAutoStream: false });
                }, FALLBACK_ASSISTANT_DELAY_MS);
              }
              return;
            }

            const initialAssistant = appendMessage(sessionId, "assistant", "");
            assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;
            if (assistantMessageId) {
              updateSession(sessionId, { isResponding: true, pendingAutoStream: false });
            }
            const streamingUserId = resolvedUser.id;

      let accumulated = "";
      let streamedConversationId: string | null =
        normalizeConversationIdValue(baseSession.conversationId) ?? sessionId;

            const timeContext = buildLocalTimeContext();
            const attachmentPayloads = attachmentsRef.current.map((attachment) => ({
              id: attachment.id,
            }));
            const autoMapPayload = buildAutoMapPayload(trimmedInitial);
            for await (const event of apiService.sendMessageStream({
              message: trimmedInitial,
              system_prompt: personalizedSystemPrompt,
              user_id: streamingUserId,
              context: contextPayload,
              conversation_id: streamedConversationId ?? sessionId,
              time_context: timeContext,
              attachments: attachmentPayloads,
              context_cache_id: selectedContextCacheId ?? undefined,
              should_generate_title: shouldRequestAutoTitleForSession(baseSession),
              ...autoMapPayload,
              web_search_enabled: webSearchEnabled,
            })) {
              if (event.type === "token") {
                const delta = event.delta;
                accumulated = accumulated && delta.startsWith(accumulated)
                  ? delta
                  : accumulated + delta;
                const content = accumulated;
                if (assistantMessageId) {
                  updateMessageDebounced(sessionId, assistantMessageId, { content }, 100);
                }
                continue;
              }

              if (event.type === "end") {
                streamedConversationId =
                  normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
                const finalResponse = normalizeAssistantContent(
                  event.response ?? accumulated,
                  trimmedInitial
                );
                const content = finalResponse;
                if (event.title) {
                  applyAutoTitle(sessionId, event.title);
                }
                const timingUpdate = event.timing ? { backendTimings: event.timing } : undefined;
                if (assistantMessageId) {
                  updateMessage(sessionId, assistantMessageId, {
                    content,
                    ...(timingUpdate ?? {}),
                  });
                }
                updateSession(sessionId, {
                  conversationId: streamedConversationId ?? sessionId,
                  isResponding: false,
                  pendingAutoStream: false,
                });
                return;
              }

              if (event.type === "error") {
                throw new Error(event.message);
              }
            }

            const finalFallback = normalizeAssistantContent(accumulated, trimmedInitial);
            if (assistantMessageId) {
              updateMessage(sessionId, assistantMessageId, { content: finalFallback });
            }
            updateSession(sessionId, {
              conversationId: streamedConversationId ?? sessionId,
              isResponding: false,
              pendingAutoStream: false,
            });
          } catch (error) {
            console.error("Failed to create AI chat session:", error);
            const fallback = buildAssistantReply(trimmedInitial);
            if (assistantMessageId) {
              updateMessage(sessionId, assistantMessageId, { content: fallback });
            } else {
              appendMessage(sessionId, "assistant", fallback);
            }
            updateSession(sessionId, { isResponding: false, pendingAutoStream: false });
            clearAttachments();
          }
        })().finally(() => {
          endSearchTracking();
        });
      };

      if (!promptForLocationConsent(trimmedInitial, streamThreadResponse)) {
        return baseSession;
      }

      return baseSession;
    },
    [
      appendMessage,
      persistSessions,
      updateMessage,
      updateMessageDebounced,
      updateSession,
      resolveChatUser,
      workspaceContextValue,
      queueConversationTitleSync,
      applyAutoTitle,
      schedulePendingSeedCleanup,
      personalizedSystemPrompt,
      markAutoStreamTriggered,
      buildAutoMapPayload,
      promptForLocationConsent,
      webSearchEnabled,
    ]
  );

  const sendGeneralMessage = useCallback(
    async (content: string): Promise<string> => {
      const trimmed = content.trim();
      const generalSession = ensureGeneralSession();
      const isGeneralScope = generalSession.scope === "general";
      const resolvedGeneralConversationId =
        coerceConversationIdForRequest(generalSession.conversationId) ??
        coerceConversationIdForRequest(generalConversationIdRef.current);
      let requestConversationId = resolvedGeneralConversationId;

      if (!trimmed) {
        return generalSession.id;
      }

      const attachmentPayloads = attachmentsRef.current.map((attachment) => ({
        id: attachment.id,
      }));

      // Create a temp message ID to prevent duplicate auto-streaming
      const tempUserMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

      // Mark this message as already triggered for auto-streaming BEFORE appending
      // This prevents the auto-stream effect from racing with our own streaming
      markAutoStreamTriggered(generalSession.id, tempUserMessageId);

      // 1) Optimistically append user message immediately with the temp ID
      appendMessage(generalSession.id, "user", trimmed, tempUserMessageId);

      // 2) Immediately insert an empty assistant message so UI shows instant response start.
      let assistantMessageId: string | null = null;
      const initialAssistant = appendMessage(generalSession.id, "assistant", "");
      assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;

      updateSession(generalSession.id, {
        isResponding: true,
        updatedAt: Date.now(),
      });

      // 3) Wait for the authenticated user so the first streamed reply connects properly.
      const resolvedUser = await resolveChatUser();
      if (resolvedUser && !requestConversationId) {
        requestConversationId = buildGeneralConversationId(resolvedUser.id);
      }

      if (!resolvedUser) {
        const fallback = buildAssistantReply(trimmed);
        if (assistantMessageId) {
          updateMessage(generalSession.id, assistantMessageId, { content: fallback });
        } else {
          appendMessage(generalSession.id, "assistant", fallback);
        }
        updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
        return generalSession.id;
      }

      let streamedConversationId: string | null = requestConversationId ?? null;

      const useWorkspaceContext = shouldIncludeWorkspaceContext(
        trimmed,
        workspaceContextValue
      );
      const contextPayload = useWorkspaceContext ? workspaceContextValue ?? undefined : undefined;

      const streamGeneralResponse = () => {
        (async () => {
          let accumulated = "";
          const streamingUserId = resolvedUser.id;
          try {
            const timeContext = buildLocalTimeContext();
            const autoMapPayload = buildAutoMapPayload(trimmed);
            for await (const event of apiService.sendMessageStream({
              message: trimmed,
              system_prompt: personalizedSystemPrompt,
              user_id: streamingUserId,
              context: contextPayload,
              conversation_id: requestConversationId ?? undefined,
              time_context: timeContext,
              attachments: attachmentPayloads,
              context_cache_id: selectedContextCacheId ?? undefined,
              should_generate_title: shouldRequestAutoTitleForSession(generalSession),
              ...autoMapPayload,
              web_search_enabled: webSearchEnabled,
            })) {
              if (event.type === "token") {
                const delta = event.delta;
                accumulated = accumulated && delta.startsWith(accumulated)
                  ? delta
                  : accumulated + delta;
                const extraction = extractGrayRemindersFromText(accumulated);
                const content = extraction.cleanText;
                if (assistantMessageId) {
                  updateMessage(generalSession.id, assistantMessageId, { content });
                }
                continue;
              }

              if (event.type === "end") {
                streamedConversationId =
                  coerceConversationIdForRequest(event.conversationId) ?? streamedConversationId;
                const finalResponse = normalizeAssistantContent(event.response ?? accumulated, trimmed);
                const content = finalResponse;
                const metadata = event.groundingMetadata ?? undefined;
                const timingUpdate = event.timing ? { backendTimings: event.timing } : undefined;

                if (assistantMessageId) {
                  updateMessage(generalSession.id, assistantMessageId, {
                    content,
                    groundingMetadata: metadata,
                    ...(timingUpdate ?? {}),
                  });
                } else {
                  const assistantMessage = appendMessage(
                    generalSession.id,
                    "assistant",
                    content,
                    undefined,
                    metadata
                  );
                  assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
                  if (assistantMessageId && timingUpdate) {
                    updateMessage(generalSession.id, assistantMessageId, timingUpdate);
                  }
                }

                updateSession(generalSession.id, {
                  conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
                  isResponding: false,
                  pendingAutoStream: false,
                });
                clearAttachments();
                if (!isGeneralScope && event.title) {
                  applyAutoTitle(generalSession.id, event.title);
                }
                return generalSession.id;
              }

              if (event.type === "error") {
                throw new Error(event.message);
              }
            }

            const finalFallback = normalizeAssistantContent(accumulated, trimmed);
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content: finalFallback });
            } else {
              const assistantMessage = appendMessage(generalSession.id, "assistant", finalFallback);
              assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
            }
            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
            });
          } catch (error) {
            console.error("Failed to send general message:", error);
            const fallback = buildAssistantErrorReply(error);
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content: fallback });
            } else {
              appendMessage(generalSession.id, "assistant", fallback);
            }
            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
            });
            clearAttachments();
          } finally {
            endSearchTracking();
          }
          clearAttachments();
        })();
      };

      if (!promptForLocationConsent(trimmed, streamGeneralResponse)) {
        return generalSession.id;
      }

      return generalSession.id;
    },
    [
      appendMessage,
      ensureGeneralSession,
      updateMessage,
      updateSession,
      resolveChatUser,
      workspaceContextValue,
      personalizedSystemPrompt,
      markAutoStreamTriggered,
      applyAutoTitle,
      clearAttachments,
      buildAutoMapPayload,
      promptForLocationConsent,
      selectedContextCacheId,
      webSearchEnabled,
    ]
  );

  const getSession = useCallback((sessionId: string) => {
    return sessionsRef.current.find((session) => session.id === sessionId);
  }, []);

  const ensureSession = useCallback(
    (sessionId: string, initializer: () => ChatSession): ChatSession => {
      const existing = sessionsRef.current.find((session) => session.id === sessionId);
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const raw = initializer() ?? ({} as ChatSession);
      const normalizedScope: ChatSessionScope =
        raw.scope === "general" ? "general" : "thread";
      const normalized: ChatSession = {
        id: sessionId,
        title:
          normalizedScope === "general"
            ? GENERAL_SESSION_TITLE
            : typeof raw.title === "string" && raw.title.trim().length > 0
              ? raw.title.trim()
              : "New Chat",
        titleMode:
          normalizedScope === "general"
            ? "manual"
            : (raw.titleMode as ChatTitleMode) === "manual"
              ? "manual"
              : "auto",
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
        messages: Array.isArray(raw.messages)
          ? raw.messages.map((message) => ({
              ...message,
            }))
          : [],
        isResponding: Boolean(raw.isResponding),
        scope: normalizedScope,
        conversationId: normalizeConversationIdValue(raw.conversationId),
        pendingAutoStream: Boolean(raw.pendingAutoStream),
      };

      setSessions((prev) => {
        const alreadyExists = prev.some((session) => session.id === sessionId);
        if (alreadyExists) {
          return prev;
        }
        const general = prev.find((session) => session.scope === "general");
        const others = prev.filter((session) => !(general && session.id === general.id));
        const next = general ? [general, normalized, ...others] : [normalized, ...others];
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      return normalized;
    },
    [persistSessions]
  );

  const generalSessionId = useMemo(() => {
    const general = sessions.find((session) => session.scope === "general");
    return general?.id ?? null;
  }, [sessions]);

  const generalGreetingRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    const general = sessionsRef.current.find((session) => session.scope === "general");
    const generalHasMessages = Boolean(general?.messages && general.messages.length > 0);
    if (
      !general ||
      generalHasMessages ||
      generalGreetingRef.current ||
      !user?.id ||
      pathname !== "/g" ||
      !remoteConversationsLoaded
    ) {
      return;
    }
    generalGreetingRef.current = true;

    let cancelled = false;
    const fallbackGreeting = () => {
      const preferredName =
        user?.personalization_nickname?.trim() ||
        user?.full_name?.split(" ")[0] ||
        "there";
      return [
        `Hey ${preferredName}, I’m Gray.`,
        "To get things rolling you can tell me what’s on deck today, ask for ideas, or just jot a reminder.",
        "If nothing’s urgent, I can still help you plan the next move."
      ].join(" ");
    };

    const deliverStarterMessage = async () => {
      const fallback = fallbackGreeting();
      try {
        const timeContext = buildLocalTimeContext();
        const response = await apiService.requestChatStarter({
          user_id: user.id,
          name: user.full_name,
          nickname: user.personalization_nickname,
          occupation: user.personalization_occupation,
          about: user.personalization_about,
          custom_instructions: user.personalization_custom_instructions,
          workspace_context: workspaceContextValue ?? null,
          system_prompt: personalizedSystemPrompt || null,
          time_context: timeContext,
        });
        if (cancelled) {
          return;
        }
        const starter = response?.message?.trim() || fallback;
        appendMessage(general.id, "assistant", starter);
      } catch (error) {
        console.error("Failed to generate chat starter", error);
        if (!cancelled) {
          appendMessage(general.id, "assistant", fallback);
        }
      }
    };

    void deliverStarterMessage();
    return () => {
      cancelled = true;
    };
  }, [
    appendMessage,
    personalizedSystemPrompt,
    pathname,
    remoteConversationsLoaded,
    sessions,
    user?.full_name,
    user?.id,
    user?.personalization_about,
    user?.personalization_custom_instructions,
    user?.personalization_nickname,
    user?.personalization_occupation,
    workspaceContextValue,
  ]);

  useEffect(() => {
    if (!user?.id || !generalSessionId) {
      reminderDeliveryCacheRef.current.clear();
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const computeNextReminderPollDelay = (candidates: Reminder[]): number => {
      if (!candidates.length) {
        return REMINDER_POLL_MIN_INTERVAL;
      }
      const now = Date.now();
      const delays = candidates
        .map((reminder) => {
          const remindAt = new Date(reminder.remind_at).getTime();
          if (!Number.isFinite(remindAt)) {
            return null;
          }
          return remindAt - now;
        })
        .filter((candidate): candidate is number => candidate !== null);
      if (!delays.length) {
        return REMINDER_POLL_MIN_INTERVAL;
      }
      const soonest = Math.min(...delays);
      if (soonest <= 0) {
        return REMINDER_POLL_SHORT_INTERVAL;
      }
      return Math.min(soonest, REMINDER_POLL_MIN_INTERVAL);
    };

    const pollDueReminders = async () => {
      if (cancelled || !user?.id || !generalSessionId) {
        return;
      }
      let fetchedReminders: Reminder[] = [];
      try {
        const reminders = await apiService.getUserReminders(user.id, { status: "pending", limit: 50 });
        fetchedReminders = reminders;
        const now = Date.now();
        for (const reminder of reminders) {
          if (!reminder.id) {
            continue;
          }
          const remindAt = new Date(reminder.remind_at).getTime();
          if (!Number.isFinite(remindAt) || remindAt > now) {
            continue;
          }
          if (reminderDeliveryCacheRef.current.has(reminder.id)) {
            continue;
          }
          reminderDeliveryCacheRef.current.add(reminder.id);
          appendMessage(generalSessionId, "assistant", buildReminderPingMessage(reminder));
          sendReminderNotification(reminder);
          try {
            await apiService.updateReminder(user.id, reminder.id, { status: "delivered" });
          } catch (updateError) {
            console.error("Failed to update reminder status:", updateError);
          }
        }
      } catch (error) {
        console.error("Failed to poll reminders:", error);
      } finally {
        if (!cancelled) {
          const nextDelay = computeNextReminderPollDelay(fetchedReminders);
          timeoutId = setTimeout(pollDueReminders, nextDelay);
        }
      }
    };

    pollDueReminders();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [appendMessage, generalSessionId, user?.id]);

  const value = useMemo(
    () => ({
      sessions,
      createThreadSession,
      sendGeneralMessage,
      appendMessage,
      updateMessage,
      deleteMessage,
      updateSession,
      renameSession,
      applyAutoTitle,
      deleteSession,
      getSession,
      ensureSession,
      generalSessionId,
      workspaceContext: workspaceContextValue,
      setWorkspaceContext: setWorkspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
      personalizedSystemPrompt,
      attachments: selectedAttachments,
      isAttachmentUploading,
      attachmentError,
      uploadAttachments,
      removeAttachment,
      clearAttachments,
      mapsEnabled,
      mapsWidgetEnabled,
      mapsLatitude,
      mapsLongitude,
      setMapsEnabled,
      setMapsWidgetEnabled,
      setMapsLatitude,
      setMapsLongitude,
      mapPayload,
      pendingLocationRequestMessage,
      isRequestingLocation: isHandlingLocationRequest,
      requestLocationShare,
      skipLocationShare,
      contextCaches,
      contextCacheLabel,
      contextCacheContent,
      selectedContextCacheId,
      contextCacheMessage,
      isContextCacheSaving,
      createContextCache,
      selectContextCacheId,
      setContextCacheLabel,
      setContextCacheContent,
      webSearchEnabled,
      setWebSearchEnabled,
      fileSearchStores,
      fileSearchDisplayName,
      setFileSearchDisplayName,
      fileSearchStatus,
      isCreatingFileSearchStore,
      handleCreateFileSearchStore,
      selectedFileSearchStore,
      setSelectedFileSearchStore,
      fileSearchUploadFile,
      setFileSearchUploadFile,
      fileSearchUploadStatus,
      handleFileSearchUpload,
      fileSearchChunking,
      setFileSearchChunking,
      fileSearchImportName,
      setFileSearchImportName,
      fileSearchImportStatus,
      handleFileSearchImport,
      fileSearchUploadInputRef,
    }),
    [
      appendMessage,
      createThreadSession,
      deleteSession,
      generalSessionId,
      getSession,
      deleteMessage,
      sendGeneralMessage,
      updateMessage,
      renameSession,
      applyAutoTitle,
      ensureSession,
      sessions,
      updateSession,
      workspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
      personalizedSystemPrompt,
      selectedAttachments,
      isAttachmentUploading,
      attachmentError,
      uploadAttachments,
      removeAttachment,
      clearAttachments,
      mapsEnabled,
      mapsWidgetEnabled,
      mapsLatitude,
      mapsLongitude,
      setMapsEnabled,
      setMapsWidgetEnabled,
      setMapsLatitude,
      setMapsLongitude,
      mapPayload,
      pendingLocationRequestMessage,
      isHandlingLocationRequest,
      requestLocationShare,
      skipLocationShare,
      contextCaches,
      contextCacheLabel,
      contextCacheContent,
      selectedContextCacheId,
      contextCacheMessage,
      isContextCacheSaving,
      createContextCache,
      selectContextCacheId,
      setContextCacheLabel,
      setContextCacheContent,
      webSearchEnabled,
      setWebSearchEnabled,
      fileSearchStores,
      fileSearchDisplayName,
      setFileSearchDisplayName,
      fileSearchStatus,
      isCreatingFileSearchStore,
      handleCreateFileSearchStore,
      selectedFileSearchStore,
      setSelectedFileSearchStore,
      fileSearchUploadFile,
      setFileSearchUploadFile,
      fileSearchUploadStatus,
      handleFileSearchUpload,
      fileSearchChunking,
      setFileSearchChunking,
      fileSearchImportName,
      setFileSearchImportName,
      fileSearchImportStatus,
      handleFileSearchImport,
      fileSearchUploadInputRef,
    ]
  );

  useEffect(() => {
    if (!hasLoadedFromStorageRef.current) {
      return;
    }
    persistSessions(sessions);
  }, [persistSessions, sessions]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChatStore = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatStore must be used within a ChatProvider");
  }
  return ctx;
};
