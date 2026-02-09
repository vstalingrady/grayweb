import type { GroundingMetadata, MediaUpload } from "@/lib/api";
import { GENERAL_CHAT_SESSION_ID, GENERAL_SESSION_TITLE, REMOTE_SESSION_MERGE_WINDOW_MS } from "../constants";
import type { ChatMessage, ChatRole, ChatSession, GrayReminderCreatedPayload } from "../types";
import { normalizeConversationIdValue, stripGrayTitleMarkers } from "../utils";
import { coerceReminderPayload, extractGrayRemindersFromText } from "../reminderUtils";

export { GENERAL_SESSION_TITLE };

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
    historyCursor: null,
    historyHasMore: false,
  };
}

export const getHistoryCursorFromMessages = (messages: ChatMessage[]): number | null => {
  let cursor: number | null = null;
  for (const message of messages) {
    const timestamp = message.createdAt;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) {
      continue;
    }
    if (cursor === null || timestamp < cursor) {
      cursor = timestamp;
    }
  }
  return cursor;
};

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
  attachments?: MediaUpload[] | null;
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
    const rawAttachments = Array.isArray(message.attachments) ? message.attachments : [];
    const attachments = rawAttachments
      .map((attachment) => {
        if (!attachment || typeof attachment !== "object") {
          return null;
        }
        const id = Number((attachment as MediaUpload).id);
        if (!Number.isFinite(id) || id <= 0) {
          return null;
        }
        return attachment as MediaUpload;
      })
      .filter((attachment): attachment is MediaUpload => Boolean(attachment));

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
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  });
}

type MergeHistoryOptions = {
  force?: boolean;
  touchUpdatedAt?: boolean;
  mode?: "replace" | "prepend";
  hasMore?: boolean;
};

type ReasoningSecondsMap = Record<string, number>;

const areChatMessagesEquivalent = (left: ChatMessage[], right: ChatMessage[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftMessage = left[index];
    const rightMessage = right[index];
    if (!leftMessage || !rightMessage) {
      return false;
    }
    if (leftMessage.role !== rightMessage.role) {
      return false;
    }
    if ((leftMessage.content ?? "") !== (rightMessage.content ?? "")) {
      return false;
    }
    if (leftMessage.createdAt !== rightMessage.createdAt) {
      return false;
    }
  }
  return true;
};

export const buildMessageSignature = (message: Pick<ChatMessage, "role" | "createdAt" | "content">): string => {
  const timestamp =
    typeof message.createdAt === "number" && Number.isFinite(message.createdAt) && message.createdAt > 0
      ? message.createdAt
      : null;
  if (timestamp === null) {
    return JSON.stringify([message.role, message.content ?? "", "unknown"]);
  }
  return JSON.stringify([message.role, timestamp]);
};

const buildMessageContentSignature = (message: Pick<ChatMessage, "role" | "content">): string | null => {
  const normalizedContent = (message.content ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedContent) {
    return null;
  }
  return JSON.stringify([message.role, normalizedContent.slice(0, 512)]);
};

const pullFirstMessage = (map: Map<string, ChatMessage[]>, key: string): ChatMessage | null => {
  const queue = map.get(key);
  if (!queue || queue.length === 0) {
    return null;
  }
  const next = queue.shift() ?? null;
  if (queue.length === 0) {
    map.delete(key);
  }
  return next;
};

const buildLocalMessageLookup = (messages: ChatMessage[]) => {
  const bySignature = new Map<string, ChatMessage[]>();
  const byContent = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    const signature = buildMessageSignature(message);
    const signatureQueue = bySignature.get(signature);
    if (signatureQueue) {
      signatureQueue.push(message);
    } else {
      bySignature.set(signature, [message]);
    }

    const contentSignature = buildMessageContentSignature(message);
    if (!contentSignature) {
      continue;
    }
    const contentQueue = byContent.get(contentSignature);
    if (contentQueue) {
      contentQueue.push(message);
    } else {
      byContent.set(contentSignature, [message]);
    }
  }
  return { bySignature, byContent };
};

const reuseLocalMessageIds = (localMessages: ChatMessage[], mappedMessages: ChatMessage[]): ChatMessage[] => {
  if (localMessages.length === 0 || mappedMessages.length === 0) {
    return mappedMessages;
  }
  const lookup = buildLocalMessageLookup(localMessages);
  return mappedMessages.map((message) => {
    const signature = buildMessageSignature(message);
    const signatureMatch = pullFirstMessage(lookup.bySignature, signature);
    if (signatureMatch) {
      return {
        ...message,
        id: signatureMatch.id,
      };
    }
    const contentSignature = buildMessageContentSignature(message);
    if (!contentSignature) {
      return message;
    }
    const contentMatch = pullFirstMessage(lookup.byContent, contentSignature);
    if (!contentMatch) {
      return message;
    }
    return {
      ...message,
      id: contentMatch.id,
    };
  });
};

const MAX_REASONING_MAP_ENTRIES = 500;

const normalizeReasoningSecondsValue = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
};

export const normalizeReasoningSecondsMap = (value: unknown): ReasoningSecondsMap | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return undefined;
  }
  const normalized: ReasoningSecondsMap = {};
  let count = 0;
  for (const [key, rawValue] of entries) {
    if (!key || key.trim().length === 0) {
      continue;
    }
    const seconds = normalizeReasoningSecondsValue(rawValue);
    if (seconds === null) {
      continue;
    }
    normalized[key] = seconds;
    count += 1;
    if (count >= MAX_REASONING_MAP_ENTRIES) {
      break;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const buildReasoningSecondsMapFromMessages = (messages: ChatMessage[]): ReasoningSecondsMap | undefined => {
  const map: ReasoningSecondsMap = {};
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    const seconds = normalizeReasoningSecondsValue(message.reasoningSeconds);
    if (seconds === null) {
      continue;
    }
    map[buildMessageSignature(message)] = seconds;
    const contentSignature = buildMessageContentSignature(message);
    if (contentSignature) {
      map[contentSignature] = seconds;
    }
  }
  return normalizeReasoningSecondsMap(map);
};

const areReasoningSecondsMapsEqual = (
  left: ReasoningSecondsMap | undefined,
  right: ReasoningSecondsMap | undefined
): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    if (!(key in right)) {
      return false;
    }
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
};

const applyReasoningSecondsMap = (
  messages: ChatMessage[],
  reasoningMap: ReasoningSecondsMap | undefined
): ChatMessage[] => {
  if (!reasoningMap) {
    return messages;
  }
  let changed = false;
  const mapped = messages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }
    if (typeof message.reasoningSeconds === "number" && Number.isFinite(message.reasoningSeconds) && message.reasoningSeconds > 0) {
      return message;
    }
    const signature = buildMessageSignature(message);
    const contentSignature = buildMessageContentSignature(message);
    const persistedSeconds = normalizeReasoningSecondsValue(
      reasoningMap[signature] ?? (contentSignature ? reasoningMap[contentSignature] : undefined)
    );
    if (persistedSeconds === null) {
      return message;
    }
    changed = true;
    return {
      ...message,
      reasoningSeconds: persistedSeconds,
    };
  });
  return changed ? mapped : messages;
};

export function mergeConversationHistoryIntoSession(
  session: ChatSession,
  history: ApiConversationMessage[],
  conversationId: string,
  options?: MergeHistoryOptions
): ChatSession | null {
  if (!Array.isArray(history)) {
    return null;
  }
  const localMessages = session.messages ?? [];
  const existingReasoningMap = normalizeReasoningSecondsMap(session.localReasoningByMessage);
  const mappedFromHistory =
    history.length > 0
      ? applyReasoningSecondsMap(mapApiMessagesToChatMessages(history, conversationId, Date.now()), existingReasoningMap)
      : [];
  const mapped = reuseLocalMessageIds(localMessages, mappedFromHistory);
  const mode = options?.mode ?? "replace";
  let nextMessages = localMessages;
  let didChangeMessages = false;

  if (mode === "prepend") {
    if (mapped.length > 0) {
      const existing = new Set(localMessages.map(buildMessageSignature));
      const uniqueOlder = mapped.filter((message) => !existing.has(buildMessageSignature(message)));
      if (uniqueOlder.length > 0) {
        nextMessages = [...uniqueOlder, ...localMessages];
        didChangeMessages = true;
      }
    }
  } else {
    const force = Boolean(options?.force);
    const shouldReplace =
      mapped.length > 0 &&
      (localMessages.length === 0 ||
        mapped.length > localMessages.length ||
        (force && mapped.length >= localMessages.length));
    if (shouldReplace && mapped.length > 0 && !areChatMessagesEquivalent(localMessages, mapped)) {
      nextMessages = mapped;
      didChangeMessages = true;
    }
  }

  const computedCursor = getHistoryCursorFromMessages(nextMessages);
  const nextHistoryCursor = computedCursor ?? session.historyCursor ?? null;
  const nextHistoryHasMore = options?.hasMore ?? session.historyHasMore;
  const mappedReasoningMap = buildReasoningSecondsMapFromMessages(nextMessages);
  const nextReasoningMap =
    mappedReasoningMap
      ? normalizeReasoningSecondsMap({
          ...(existingReasoningMap ?? {}),
          ...mappedReasoningMap,
        })
      : existingReasoningMap;
  const reasoningMapChanged = !areReasoningSecondsMapsEqual(existingReasoningMap, nextReasoningMap);

  const shouldTouchUpdatedAt = Boolean(options?.touchUpdatedAt);
  const shouldUpdate =
    didChangeMessages ||
    session.conversationId !== conversationId ||
    session.historyCursor !== nextHistoryCursor ||
    session.historyHasMore !== nextHistoryHasMore ||
    reasoningMapChanged ||
    shouldTouchUpdatedAt;

  if (!shouldUpdate) {
    return null;
  }

  const nextSession: ChatSession = {
    ...session,
    conversationId,
    messages: nextMessages,
    localReasoningByMessage: nextReasoningMap,
    historyCursor: nextHistoryCursor,
    historyHasMore: nextHistoryHasMore,
    isResponding: didChangeMessages ? false : session.isResponding,
  };
  if (shouldTouchUpdatedAt) {
    nextSession.updatedAt = Date.now();
  }

  return nextSession;
}
