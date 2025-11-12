"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { apiService, type ChatAttachment, type ConversationSummary, type Reminder, type User } from "@/lib/api";
import { buildLocalTimeContext } from "@/lib/timeContext";
import { formatReminderDateLabel, formatReminderSlotLabel } from "./reminderTimeUtils";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  reminders?: GrayReminderCreatedPayload[];
};

type ConversationHistoryEntryPayload = {
  role: "user" | "model";
  text: string;
  attachments?: ChatAttachment[];
};

const buildConversationHistoryPayload = (messages: ChatMessage[]) => {
  return messages
    .map<ConversationHistoryEntryPayload | null>((message) => {
      const attachments =
        message.attachments && message.attachments.length > 0
          ? message.attachments.map((attachment) => ({ ...attachment }))
          : undefined;

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
  sendGeneralMessage: (content: string, attachments?: ChatAttachment[]) => Promise<string>;
  appendMessage: (
    sessionId: string,
    role: ChatRole,
    content: string,
    attachments?: ChatAttachment[],
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
const DUPLICATE_THREAD_WINDOW_MS = 15000;
const REMOTE_SESSION_MERGE_WINDOW_MS = 5 * 60 * 1000;
export const buildPersonalizedSystemPrompt = (user?: User | null) => {
  const sections: string[] = [];

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
  if (typeof window === "undefined" || typeof Notification === "undefined") {
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
      renotify: true,
      requireInteraction: true,
    });
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

const isGenericSessionTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const trimmed = title.trim();
  return trimmed.length === 0 || trimmed.toLowerCase() === "new chat";
};

const GREETING_PATTERN =
  /^(?:hi|hey|hello|hiya|yo|sup|what'?s up|howdy|good (?:morning|afternoon|evening)|hola|h[ae]y there)\b[^\w]*$/i;
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
  const triggerTime = typeof candidate.trigger_time === "string" ? candidate.trigger_time : null;
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
    source: "legacy/gray.reminder",
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
      lines.every((line) => TOOL_FENCE_LINE_PATTERNS.some((pattern) => pattern.test(line)))
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
  const hasModernReminder = reminders.some((reminder) => reminder.source !== "legacy/gray.reminder");
  const filteredReminders = hasModernReminder
    ? reminders.filter((reminder) => reminder.source !== "legacy/gray.reminder")
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

const makeMessage = (role: ChatRole, content: string, attachments?: ChatAttachment[], tempId?: string): ChatMessage => {
  const id = tempId || (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));
  const normalized = normalizeAssistantMessage(role, content);
  return {
    id,
    role,
    content: normalized.content,
    createdAt: Date.now(),
    attachments:
      attachments && attachments.length > 0
        ? attachments.map((attachment) => ({ ...attachment }))
        : undefined,
    reminders: normalized.reminders,
  };
};

export const deriveTitleFromMessage = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return "New Chat";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 45).trim()}…` : trimmed;
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

const GENERIC_TITLE_TOKENS = new Set(["new chat", "new conversation", "new thread", "new session"]);

export const isGenericTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const normalized = title.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return GENERIC_TITLE_TOKENS.has(normalized);
};

const createEmptyGeneralSession = (timestamp?: number): ChatSession => {
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
    pendingAutoStream: false,
  };
};

const cloneSession = (session: ChatSession): ChatSession => ({
  ...session,
  titleMode: session.titleMode ?? (session.scope === "general" ? "manual" : "auto"),
  messages: session.messages.map((message) => ({
    ...message,
    attachments: message.attachments
      ? message.attachments.map((attachment) => ({ ...attachment }))
      : undefined,
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
  storageKeys: readonly string[]
): { key: string | null; sessions: ChatSession[] } => {
  if (typeof window === "undefined") {
    return { key: null, sessions: defaultSessions() };
  }

  for (const storageKey of storageKeys) {
    if (!storageKey) {
      continue;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw) as Array<Partial<ChatSession> & Record<string, unknown>>;
      if (!Array.isArray(parsed)) {
        continue;
      }
      const sanitized = parsed.filter(
        (session) =>
          session &&
          !PLACEHOLDER_SESSION_IDS.has((session.id as string) ?? "") &&
          !PLACEHOLDER_TITLES.has((session.title as string) ?? "")
      );

      const normalized: ChatSession[] = sanitized.map((session) => {
        const inferredScope =
          session.id === GENERAL_SESSION_ID || session.scope === "general" ? "general" : "thread";
        const scope: ChatSessionScope = inferredScope;
        const id =
          scope === "general"
            ? GENERAL_SESSION_ID
            : typeof session.id === "string" && session.id.trim().length > 0
              ? session.id
              : (typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2));
        const createdAt =
          typeof session.createdAt === "number" ? session.createdAt : Date.now();
        const updatedAt =
          typeof session.updatedAt === "number" ? session.updatedAt : createdAt;
        const title =
          scope === "general"
            ? GENERAL_SESSION_TITLE
            : typeof session.title === "string" && session.title.trim().length > 0
              ? session.title
              : "New Chat";

        const messageArray = Array.isArray(session.messages) ? session.messages : [];

        const mappedMessages = messageArray.map((message) => {
          const attachments = Array.isArray((message as ChatMessage)?.attachments)
            ? (message as ChatMessage).attachments?.map((attachment) => ({ ...attachment }))
            : undefined;
          const reminders = Array.isArray((message as ChatMessage)?.reminders)
            ? (message as ChatMessage).reminders?.map((reminder) => ({ ...reminder }))
            : undefined;
          return {
            id:
              typeof (message as ChatMessage)?.id === "string"
                ? (message as ChatMessage).id
                : typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2),
            role:
              (message as ChatMessage)?.role === "assistant" ||
              (message as { role?: string })?.role === "model"
                ? "assistant"
                : "user",
            content: (message as ChatMessage)?.content ?? "",
            createdAt:
              typeof (message as ChatMessage)?.createdAt === "number"
                ? (message as ChatMessage).createdAt
                : Date.now(),
            ...(attachments && { attachments }),
            ...(reminders && reminders.length > 0 ? { reminders } : {}),
          } satisfies ChatMessage;
        });

        const firstUserMessage = mappedMessages.find(
          (message) => message.role === "user" && message.content.trim().length > 0
        );
        const storedMode = (session as { titleMode?: ChatTitleMode }).titleMode;
        const derivedMatchesSeed =
          Boolean(firstUserMessage) &&
          deriveTitleFromMessage(firstUserMessage?.content ?? "").trim() === title.trim();
        const titleMode: ChatTitleMode =
          scope === "general"
            ? "manual"
            : storedMode === "manual"
              ? "manual"
              : storedMode === "auto"
                ? "auto"
                : derivedMatchesSeed || isGenericTitle(title)
                  ? "auto"
                  : "manual";

        return {
          id,
          title,
          titleMode,
          createdAt,
          updatedAt,
          messages: mappedMessages,
          isResponding: false,
          scope,
          conversationId: normalizeConversationIdValue(session.conversationId),
          pendingAutoStream:
            typeof (session as ChatSession)?.pendingAutoStream === "boolean"
              ? (session as ChatSession).pendingAutoStream
              : false,
        } satisfies ChatSession;
      });

      const hasGeneral = normalized.some((session) => session.scope === "general");
      if (!hasGeneral) {
        normalized.unshift(createEmptyGeneralSession());
      }

      if (sanitized.length !== parsed.length) {
        window.localStorage.setItem(storageKey, JSON.stringify(normalized));
      }

      return { key: storageKey, sessions: normalizeSessionsList(normalized) };
    } catch (error) {
      console.warn("Failed to read stored chat sessions:", error);
    }
  }

  return { key: null, sessions: defaultSessions() };
};

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const { user, waitForUser } = useUser();
  const personalizedSystemPrompt = useMemo(() => buildPersonalizedSystemPrompt(user), [user]);
  const [sessions, setSessions] = useState<ChatSession[]>(defaultSessions);
  const sessionsRef = useRef<ChatSession[]>(sessions);
  const pendingTitleSyncRef = useRef<Map<string, string>>(new Map());
  const pendingThreadSeedsRef = useRef<Map<string, { sessionId: string; createdAt: number }>>(
    new Map()
  );
  const debouncedUpdateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [workspaceContextValue, setWorkspaceContextValue] = useState<string | null>(
    workspaceContext ?? null
  );
  const hasLoadedFromStorageRef = useRef(false);
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

  useEffect(() => {
    if (workspaceContext !== undefined) {
      setWorkspaceContextValue(workspaceContext ?? null);
    }
  }, [workspaceContext]);

  const persistSessions = useCallback((next: ChatSession[]) => {
    if (typeof window === "undefined") {
      return;
    }
    if (!sessionStorageKey) {
      return;
    }
    try {
      const normalized = normalizeSessionsList(next);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(normalized));
    } catch (error) {
      console.warn("Failed to persist chat sessions:", error);
    }
  }, [sessionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    hasLoadedFromStorageRef.current = true;
    if (!sessionStorageKey) {
      previousSessionStorageKeyRef.current = null;
      setSessions(defaultSessions());
      return;
    }

    const { key: sourceKey, sessions: stored } = loadStoredSessions(sessionStorageKeyCandidates);
    if (sessionStorageKey && sourceKey && sourceKey !== sessionStorageKey) {
      persistSessions(stored);
    }
    setSessions((prev) => {
      if (previousSessionStorageKeyRef.current !== sessionStorageKey) {
        previousSessionStorageKeyRef.current = sessionStorageKey;
        return stored;
      }
      if (prev.length === 0) {
        return stored;
      }
      const merged = normalizeSessionsList([...prev, ...stored]);
      persistSessions(merged);
      return merged;
    });
  }, [persistSessions, sessionStorageKey, sessionStorageKeyCandidates]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

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
      try {
        await apiService.updateConversation(normalizedConversationId, {
          title: trimmed,
          ...(user?.id ? { user_id: user.id } : {}),
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
      const trimmed = candidate?.trim();
      if (!trimmed) {
        return;
      }
      const session = sessionsRef.current.find((entry) => entry.id === sessionId);
      if (
        !session ||
        session.scope === "general" ||
        session.titleMode === "manual" ||
        !isGenericSessionTitle(session.title)
      ) {
        return;
      }
      if (session.title?.trim() === trimmed) {
        return;
      }
      updateSession(sessionId, { title: trimmed, titleMode: "auto" });
      queueConversationTitleSync(sessionId, trimmed);
    },
    [queueConversationTitleSync, updateSession]
  );

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => {
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
              const normalized = normalizeAssistantMessage(message.role, partial.content);
              nextPartial = {
                ...partial,
                content: normalized.content,
                reminders: normalized.reminders,
              };
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
    },
    [persistSessions]
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
                const normalized = normalizeAssistantMessage(message.role, partial.content);
                nextPartial = {
                  ...partial,
                  content: normalized.content,
                  reminders: normalized.reminders,
                };
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
      }, delay);

      debouncedUpdateTimeoutsRef.current.set(key, timeout);
    },
    [persistSessions]  // Only depend on persistSessions
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

          const normalizedConversationId =
            normalizeConversationIdValue(session.conversationId ?? session.id) ??
            (session.scope === "general" && typeof user?.id === "number"
              ? `${GENERAL_SESSION_ID}-${user.id}`
              : undefined);
          const payload = buildConversationHistoryPayload(filtered);

          if (normalizedConversationId) {
            conversationIdForSync = normalizedConversationId;
            historyPayload = payload;
            pendingHistorySyncRef.current.delete(session.id);
          } else if (session.scope !== "general") {
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
        scheduleHistorySync(conversationIdForSync, historyPayload);
      }
    },
    [persistSessions, scheduleHistorySync, user?.id]
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
      updateSession(sessionId, { title: trimmed, titleMode: "manual" });
      queueConversationTitleSync(sessionId, trimmed);
    },
    [queueConversationTitleSync, updateSession]
  );

  const appendMessage = useCallback(
    (sessionId: string, role: ChatRole, content: string, attachments?: ChatAttachment[], tempId?: string) => {
      let createdMessage: ChatMessage | null = null;

      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          const message = makeMessage(role, content, attachments, tempId);
          createdMessage = message;

          return {
            ...session,
            messages: [...session.messages, message],
            updatedAt: message.createdAt,
            isResponding: role === "user",
            title: session.title,
          };
        });

        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      return createdMessage;
    },
    [persistSessions]
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
    const created = createEmptyGeneralSession();
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
          const remoteIsGeneric = isGenericTitle(normalizedTitle);
          const existingIndex = findExistingIndex(conversationId);
          const resolveTitle = (currentTitle: string) => {
            const trimmed = currentTitle.trim();
            const shouldFavorLocalTitle = remoteIsGeneric && trimmed.length > 0 && !isGenericTitle(currentTitle);
            return shouldFavorLocalTitle ? currentTitle : normalizedTitle;
          };

          if (typeof existingIndex === "number") {
            const current = next[existingIndex];
            const merged: ChatSession = {
              ...current,
              title: resolveTitle(current.title),
              createdAt: Math.min(current.createdAt, createdAt),
              updatedAt: Math.max(current.updatedAt, updatedAt),
              conversationId,
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
            const merged: ChatSession = {
              ...pending,
              title: resolveTitle(pending.title),
              createdAt: Math.min(pending.createdAt, createdAt),
              updatedAt: Math.max(pending.updatedAt, updatedAt),
              conversationId,
              pendingAutoStream: false,
            };
            next[pendingIndex] = merged;
            indexByConversationId.set(conversationId, pendingIndex);
            changed = true;
            return;
          }

          const newSession: ChatSession = {
            id: conversationId,
            title: normalizedTitle,
            titleMode: remoteIsGeneric ? "auto" : "manual",
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
      }
    };
    void loadRemoteConversations();
    return () => {
      cancelled = true;
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
        conversationId: undefined,
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

          // Fast-path streaming:
          // Immediately insert an empty assistant message so the user sees a reply start instantly.
          const initialAssistant = appendMessage(sessionId, "assistant", "");
          assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;
          if (assistantMessageId) {
            updateSession(sessionId, { isResponding: true, pendingAutoStream: false });
          }
          const streamingUserId = resolvedUser.id;

          let accumulated = "";
          let streamedConversationId: string | null =
            normalizeConversationIdValue(baseSession.conversationId) ?? null;

          const timeContext = buildLocalTimeContext();
          for await (const event of apiService.sendMessageStream({
            message: trimmedInitial,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            conversation_id: streamedConversationId ?? undefined,
            time_context: timeContext,
          })) {
            if (event.type === "token") {
              accumulated += event.delta;
              const content = accumulated;
              if (assistantMessageId) {
                // Use debounced version for streaming to reduce re-renders
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
              if (assistantMessageId) {
                updateMessage(sessionId, assistantMessageId, { content });
              }
              updateSession(sessionId, {
                conversationId: streamedConversationId ?? undefined,
                isResponding: false,
                pendingAutoStream: false,
              });
              if (event.title) {
                applyAutoTitle(sessionId, event.title);
              }
              return;
            }

            if (event.type === "error") {
              throw new Error(event.message);
            }
          }

          // If stream ended without explicit "end" event, finalize content.
          const finalFallback = normalizeAssistantContent(accumulated, trimmedInitial);
          if (assistantMessageId) {
            updateMessage(sessionId, assistantMessageId, { content: finalFallback });
          }
          updateSession(sessionId, {
            conversationId: streamedConversationId ?? undefined,
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
        }
      })();

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
    ]
  );

  const sendGeneralMessage = useCallback(
    async (content: string, attachments?: ChatAttachment[]): Promise<string> => {
      const trimmed = content.trim();
      const generalSession = ensureGeneralSession();
      const isGeneralScope = generalSession.scope === "general";
      let requestConversationId = isGeneralScope
        ? GENERAL_CHAT_SESSION_ID
        : normalizeConversationIdValue(generalSession.conversationId) ?? undefined;

      if (!trimmed && (!attachments || attachments.length === 0)) {
        return generalSession.id;
      }

      const attachmentPayload =
        attachments && attachments.length > 0 ? attachments.map((item) => ({ ...item })) : undefined;

      // Create a temp message ID to prevent duplicate auto-streaming
      const tempUserMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

      // Mark this message as already triggered for auto-streaming BEFORE appending
      // This prevents the auto-stream effect from racing with our own streaming
      markAutoStreamTriggered(generalSession.id, tempUserMessageId);

      // 1) Optimistically append user message immediately with the temp ID
      appendMessage(generalSession.id, "user", trimmed, attachmentPayload, tempUserMessageId);

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

      if (isGeneralScope) {
        requestConversationId = `${GENERAL_CHAT_SESSION_ID}-${resolvedUser.id}`;
        streamedConversationId = requestConversationId;
      }

      const useWorkspaceContext = shouldIncludeWorkspaceContext(
        trimmed,
        workspaceContextValue
      );
      const contextPayload = useWorkspaceContext ? workspaceContextValue ?? undefined : undefined;

      let accumulated = "";
      const streamingUserId = resolvedUser.id;

      try {
        const timeContext = buildLocalTimeContext();
        for await (const event of apiService.sendMessageStream({
          message: trimmed,
          system_prompt: personalizedSystemPrompt,
          user_id: streamingUserId,
          context: contextPayload,
          attachments: attachmentPayload,
          conversation_id: requestConversationId ?? undefined,
          time_context: timeContext,
        })) {
          if (event.type === "token") {
            accumulated += event.delta;
            const extraction = extractGrayRemindersFromText(accumulated);
            const content = extraction.cleanText;
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content });
            }
            continue;
          }

          if (event.type === "end") {
            if (!isGeneralScope) {
              streamedConversationId =
                normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
            }
            const finalResponse = normalizeAssistantContent(event.response ?? accumulated, trimmed);
            const content = finalResponse;

            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content });
            } else {
              const assistantMessage = appendMessage(generalSession.id, "assistant", content);
              assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
            }

            updateSession(generalSession.id, {
              conversationId: isGeneralScope
                ? GENERAL_CHAT_SESSION_ID
                : streamedConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
            });
            if (!isGeneralScope && event.title) {
              applyAutoTitle(generalSession.id, event.title);
            }
            return generalSession.id;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }

        // If stream ended without explicit "end" event, finalize content.
        const finalFallback = normalizeAssistantContent(accumulated, trimmed);
        if (assistantMessageId) {
          updateMessage(generalSession.id, assistantMessageId, { content: finalFallback });
        } else {
          const assistantMessage = appendMessage(generalSession.id, "assistant", finalFallback);
          assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
        }
        updateSession(generalSession.id, {
          conversationId: isGeneralScope ? GENERAL_CHAT_SESSION_ID : streamedConversationId ?? undefined,
          isResponding: false,
          pendingAutoStream: false,
        });
      } catch (error) {
        console.error("Failed to send general message:", error);
        const fallback = buildAssistantReply(trimmed);
        if (assistantMessageId) {
          updateMessage(generalSession.id, assistantMessageId, { content: fallback });
        } else {
          appendMessage(generalSession.id, "assistant", fallback);
        }
        updateSession(generalSession.id, {
          conversationId: isGeneralScope ? GENERAL_CHAT_SESSION_ID : streamedConversationId ?? undefined,
          isResponding: false,
          pendingAutoStream: false,
        });
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
    ]
  );

  const getSession = useCallback(
    (sessionId: string) => sessions.find((session) => session.id === sessionId),
    [sessions]
  );

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
              attachments: Array.isArray(message.attachments)
                ? message.attachments.map((attachment) => ({ ...attachment }))
                : undefined,
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

  useEffect(() => {
    const general = sessionsRef.current.find((session) => session.scope === "general");
    if (!general || general.messages.length > 0 || generalGreetingRef.current) {
      return;
    }
    generalGreetingRef.current = true;
    const preferredName =
      user?.personalization_nickname?.trim() ||
      user?.full_name?.split(" ")[0] ||
      "there";
    const greeting = [
      `Hey ${preferredName}, I’m Gray.`,
      "To get things rolling you can tell me what’s on deck today, ask for ideas, or just jot a reminder.",
      "If nothing’s urgent, I can still help you plan the next move."
    ].join(" ");
    appendMessage(general.id, "assistant", greeting);
  }, [appendMessage, sessions, user?.full_name, user?.personalization_nickname]);

  useEffect(() => {
    if (!user?.id || !generalSessionId) {
      reminderDeliveryCacheRef.current.clear();
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollDueReminders = async () => {
      if (cancelled || !user?.id || !generalSessionId) {
        return;
      }
      try {
        const reminders = await apiService.getUserReminders(user.id, { status: "pending", limit: 50 });
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
          timeoutId = setTimeout(pollDueReminders, 15_000);
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
