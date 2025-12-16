import type { GroundingMetadata, MediaUpload } from "@/lib/api";
import { GENERAL_CHAT_SESSION_ID, REMOTE_SESSION_MERGE_WINDOW_MS } from "../constants";
import type { ChatMessage, ChatRole, ChatSession, GrayReminderCreatedPayload } from "../types";
import { normalizeConversationIdValue, stripGrayTitleMarkers } from "../utils";
import { coerceReminderPayload, extractGrayRemindersFromText } from "../reminderUtils";

export const GENERAL_SESSION_TITLE = "General Chat";

export function makeMessage(
  role: ChatRole,
  content: string,
  tempId?: string,
  metadata?: GroundingMetadata,
  attachments?: MediaUpload[]
): ChatMessage {
  const now = Date.now();
  return {
    id:
      tempId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `msg-${role}-${now}-${Math.random().toString(36).slice(2, 10)}`),
    role,
    content,
    createdAt: now,
    groundingMetadata: metadata ?? undefined,
    attachments: attachments ?? undefined,
  };
}

export function createEmptyGeneralSession(timestamp?: number, conversationId?: string | null): ChatSession {
  const now = timestamp ?? Date.now();
  return {
    id: GENERAL_CHAT_SESSION_ID,
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
}

const defaultSessions = () => [createEmptyGeneralSession()];

export function withGeneralFirst(sessions: ChatSession[]): ChatSession[] {
  const generalIndex = sessions.findIndex((session) => session.scope === "general");
  if (generalIndex <= 0) {
    return sessions;
  }
  const copy = [...sessions];
  const [general] = copy.splice(generalIndex, 1);
  copy.unshift(general);
  return copy;
}

export function dedupeSessionsByConversation(sessions: ChatSession[]): ChatSession[] {
  const map = new Map<string, ChatSession>();
  sessions.forEach((session) => {
    const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
    const key =
      session.scope === "general"
        ? GENERAL_CHAT_SESSION_ID
        : normalizedConversationId ?? `session:${session.id}`;

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
}

export function dedupeSessionsByTitleWindow(sessions: ChatSession[]): ChatSession[] {
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
    const withinWindow = Math.abs(session.updatedAt - existing.updatedAt) <= REMOTE_SESSION_MERGE_WINDOW_MS;
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
}

export function normalizeSessionsList(sessions: ChatSession[]): ChatSession[] {
  return withGeneralFirst(dedupeSessionsByTitleWindow(dedupeSessionsByConversation(sessions)));
}

export function loadStoredSessions(storageKeys: readonly string[]): { key: string | null; sessions: ChatSession[] } {
  if (typeof window === "undefined") {
    return { key: null, sessions: defaultSessions() };
  }

  for (const key of storageKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sessions = parsed.slice(0, 50) as ChatSession[];
        const validSessions = sessions.filter((session) => session && typeof session.id === "string" && Array.isArray(session.messages));
        if (validSessions.length > 0) {
          return { key, sessions: validSessions };
        }
      }
    } catch (error) {
      console.warn(`Failed to parse stored sessions for key "${key}":`, error);
    }
  }

  return { key: null, sessions: defaultSessions() };
}

type ApiConversationMessage = {
  role: string;
  text: string;
  timestamp?: number;
  grounding_metadata?: GroundingMetadata | null;
  groundingMetadata?: GroundingMetadata | null;
  reminders?: unknown[] | null;
};

export function mapApiMessagesToChatMessages(
  history: ApiConversationMessage[],
  conversationId: string,
  fallbackTimestamp: number = Date.now()
): ChatMessage[] {
  const dedupedHistory = history.filter((message, index, arr) => {
    if (index === 0) {
      return true;
    }
    const prev = arr[index - 1];
    return !(prev.role === message.role && (prev.text ?? "") === (message.text ?? ""));
  });

  return dedupedHistory.map((message, index) => {
    const role: ChatRole = message.role === "model" ? "assistant" : "user";
    const rawText = message.text ?? "";
    const normalizedText = role === "assistant" ? stripGrayTitleMarkers(rawText) : rawText;

    const apiReminders =
      Array.isArray(message.reminders) && message.reminders.length > 0
        ? message.reminders.map((reminder) => coerceReminderPayload(reminder)).filter((reminder): reminder is GrayReminderCreatedPayload => Boolean(reminder))
        : null;

    const reminderExtraction =
      role === "assistant" && !apiReminders
        ? extractGrayRemindersFromText(normalizedText)
        : { cleanText: normalizedText, reminders: [] };

    const normalizedMetadata = message.grounding_metadata ?? message.groundingMetadata ?? null;
    const messageTimestamp =
      typeof message.timestamp === "number" && Number.isFinite(message.timestamp) ? message.timestamp : fallbackTimestamp;

    return {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${conversationId}-${index}-${messageTimestamp}`,
      role,
      content: reminderExtraction.cleanText,
      createdAt: messageTimestamp,
      reminders:
        apiReminders ??
        (role === "assistant" && reminderExtraction.reminders.length ? reminderExtraction.reminders : undefined),
      groundingMetadata: normalizedMetadata ?? undefined,
    };
  });
}

