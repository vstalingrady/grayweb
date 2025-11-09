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
import { apiService, type ChatAttachment, type ConversationSummary, type User } from "@/lib/api";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
};

export type ChatSessionScope = "general" | "thread";

export type ChatSession = {
  id: string;
  title: string;
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
    attachments?: ChatAttachment[]
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
  hasAutoStreamTriggered: (sessionId: string, messageId?: string | null) => boolean;
  markAutoStreamTriggered: (sessionId: string, messageId?: string | null) => void;
  resetAutoStreamState: (sessionId?: string | null) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);
const STORAGE_KEY = "gray-chat-sessions-v1";

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

export const SYSTEM_PROMPT = [
  "You are Gray — the Alignment companion built to cut through distraction and turn intent into momentum. Act with initiative, narrate your decisions, and always keep the user in command. Never invent context; if something is unclear, ask before assuming.",
  "Default to privacy and discretion. Explain why you're suggesting something, offer reversible options, and confirm before summarizing, scheduling, or committing to meaningful changes on the user's behalf.",
  "Answer the user's question directly, then deepen with evidence, counterpoints, or concrete next steps when it helps. Use structure as a feature: open with the headline insight, follow with tight paragraphs or short bullet runs, and close with a clear takeaway or application.",
  "Match the user's tone—steady, candid, optimistic without being saccharine. Admit mistakes once, correct course, and move on. When emotions run high, validate first and collaborate on the next move instead of pushing productivity defaults.",
].join("\n\n");

export const buildPersonalizedSystemPrompt = (basePrompt: string, user?: User | null) => {
  if (!user) {
    return basePrompt;
  }

  const sections = [basePrompt.trim()];
  const profileLines: string[] = [];

  const nickname = user.personalization_nickname?.trim();
  const occupation = user.personalization_occupation?.trim();
  const about = user.personalization_about?.trim();
  const fullName = user.full_name?.trim();

  if (nickname) {
    profileLines.push(`Nickname: ${nickname}`);
  } else if (fullName) {
    profileLines.push(`Name: ${fullName}`);
  }
  if (occupation) {
    profileLines.push(`Occupation: ${occupation}`);
  } else if (user.role) {
    profileLines.push(`Role: ${user.role}`);
  }
  if (about) {
    profileLines.push(`About: ${about}`);
  }

  if (profileLines.length > 0) {
    sections.push(["USER PROFILE", ...profileLines].join("\n"));
  }

  const instructions = user.personalization_custom_instructions?.trim();
  if (instructions) {
    sections.push(`CUSTOM INSTRUCTIONS FROM USER\n${instructions}`);
  }

  return sections.join("\n\n");
};

export const buildAssistantReply = (prompt: string) => {
  void prompt;
  return "I'm here and ready—feel free to share more details or ask another question.";
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

const makeMessage = (role: ChatRole, content: string, attachments?: ChatAttachment[], tempId?: string): ChatMessage => {
  const id = tempId || (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));
  return {
    id,
    role,
    content,
    createdAt: Date.now(),
    attachments:
      attachments && attachments.length > 0
        ? attachments.map((attachment) => ({ ...attachment }))
        : undefined,
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

const isGenericTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const normalized = title.trim();
  return normalized.length === 0 || normalized.toLowerCase() === "new chat";
};

const createEmptyGeneralSession = (timestamp?: number): ChatSession => {
  const now = timestamp ?? Date.now();
  return {
    id: GENERAL_SESSION_ID,
    title: GENERAL_SESSION_TITLE,
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

const loadStoredSessions = (): ChatSession[] => {
  if (typeof window === "undefined") {
    return defaultSessions();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSessions();
    }
    const parsed = JSON.parse(raw) as Array<Partial<ChatSession> & Record<string, unknown>>;
    if (!Array.isArray(parsed)) {
      return defaultSessions();
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

      return {
        id,
        title,
        createdAt,
        updatedAt,
        messages: messageArray.map((message) => {
          const attachments = Array.isArray((message as ChatMessage)?.attachments)
            ? (message as ChatMessage).attachments?.map((attachment) => ({ ...attachment }))
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
          };
        }),
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalizeSessionsList(normalized);
  } catch (error) {
    console.warn("Failed to read stored chat sessions:", error);
    return defaultSessions();
  }
};

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const { user, waitForUser } = useUser();
  const personalizedSystemPrompt = useMemo(
    () => buildPersonalizedSystemPrompt(SYSTEM_PROMPT, user),
    [user]
  );
  const [sessions, setSessions] = useState<ChatSession[]>(defaultSessions);
  const sessionsRef = useRef<ChatSession[]>(sessions);
  const pendingTitleSyncRef = useRef<Map<string, string>>(new Map());
  const historyAutoTitleRef = useRef<Set<string>>(new Set());
  const aiTitleRequestRef = useRef<Set<string>>(new Set());
  const pendingThreadSeedsRef = useRef<Map<string, { sessionId: string; createdAt: number }>>(
    new Map()
  );
  const [workspaceContextValue, setWorkspaceContextValue] = useState<string | null>(
    workspaceContext ?? null
  );
  const hasLoadedFromStorageRef = useRef(false);
  const autoStreamTriggeredRef = useRef<Set<string>>(new Set());
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
    try {
      const normalized = normalizeSessionsList(next);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.warn("Failed to persist chat sessions:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    hasLoadedFromStorageRef.current = true;
    const stored = loadStoredSessions();
    setSessions((prev) => {
      if (prev.length === 0) {
        return stored;
      }
      const merged = normalizeSessionsList([...prev, ...stored]);
      persistSessions(merged);
      return merged;
    });
  }, [persistSessions]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

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
            return { ...message, ...partial };
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

  const deleteMessage = useCallback(
    (sessionId: string, messageId: string) => {
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
    },
    [persistSessions]
  );

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
      updateSession(sessionId, { title: trimmed });
      queueConversationTitleSync(sessionId, trimmed);
    },
    [queueConversationTitleSync, updateSession]
  );

  const requestGeneratedTitle = useCallback(
    (sessionId: string, seed: string) => {
      const trimmedSeed = seed.trim();
      if (!trimmedSeed || aiTitleRequestRef.current.has(sessionId)) {
        return;
      }
      const target = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      if (!target || target.scope === "general" || !isGenericTitle(target.title)) {
        return;
      }
      aiTitleRequestRef.current.add(sessionId);
      const fallbackTitle = deriveTitleFromMessage(trimmedSeed);
      apiService
        .generateChatTitle(trimmedSeed)
        .then((response) => {
          const suggestion = response?.title?.trim();
          if (!suggestion) {
            return;
          }
          const current = sessionsRef.current.find((candidate) => candidate.id === sessionId);
          if (!current || current.scope === "general") {
            return;
          }
          if (!isGenericTitle(current.title)) {
            return;
          }
          if (current.title?.trim() === suggestion) {
            return;
          }
          renameSession(sessionId, suggestion);
        })
        .catch((error) => {
          console.error("Failed to generate chat title:", error);
          if (fallbackTitle && fallbackTitle.toLowerCase() !== "new chat") {
            const current = sessionsRef.current.find((candidate) => candidate.id === sessionId);
            if (current && current.scope !== "general" && isGenericTitle(current.title)) {
              renameSession(sessionId, fallbackTitle);
            }
          }
        })
        .finally(() => {
          aiTitleRequestRef.current.delete(sessionId);
        });
    },
    [renameSession]
  );

  const appendMessage = useCallback(
    (sessionId: string, role: ChatRole, content: string, attachments?: ChatAttachment[], tempId?: string) => {
      let createdMessage: ChatMessage | null = null;
      const titleSeedRequests: Array<{ sessionId: string; seed: string }> = [];

      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          const message = makeMessage(role, content, attachments, tempId);
          createdMessage = message;

          const isThread = session.scope !== "general";
          const isUserMessage = role === "user";
          const hasNoMessagesYet = session.messages.length === 0;
          const isGenericTitle =
            !session.title ||
            session.title.trim().length === 0 ||
            session.title.trim().toLowerCase() === "new chat";

          const shouldRequestTitle =
            isThread && isUserMessage && (hasNoMessagesYet || isGenericTitle);

          if (shouldRequestTitle && content.trim().length > 0) {
            titleSeedRequests.push({ sessionId: session.id, seed: content });
          }

          return {
            ...session,
            messages: [...session.messages, message],
            updatedAt: message.createdAt,
            isResponding: isUserMessage,
            title: session.title,
          };
        });

        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      titleSeedRequests.forEach(({ sessionId: targetSessionId, seed }) => {
        requestGeneratedTitle(targetSessionId, seed);
      });

      return createdMessage;
    },
    [persistSessions, requestGeneratedTitle]
  );

  useEffect(() => {
    const MAX_AUTO_TITLE_BATCH = 3;
    const pending = sessions.filter((session) => {
      if (session.scope !== "thread") {
        return false;
      }
      const normalizedTitle = session.title?.trim().toLowerCase() ?? "";
      if (normalizedTitle && normalizedTitle !== "new chat") {
        return false;
      }
      return !historyAutoTitleRef.current.has(session.id);
    });

    const findLocalSeed = (session: ChatSession): string | null => {
      const message = session.messages.find(
        (entry) => entry.role === "user" && typeof entry.content === "string" && entry.content.trim().length > 0
      );
      return message?.content.trim() ?? null;
    };

    pending.slice(0, MAX_AUTO_TITLE_BATCH).forEach((session) => {
      historyAutoTitleRef.current.add(session.id);
      (async () => {
        try {
          const localSeed = findLocalSeed(session);
          if (localSeed) {
            requestGeneratedTitle(session.id, localSeed);
            return;
          }

          const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
          if (!normalizedConversationId) {
            return;
          }
          const history = await apiService.getConversation(normalizedConversationId);
          if (!Array.isArray(history) || history.length === 0) {
            return;
          }
          const firstUserMessage = history.find(
            (message) =>
              message.role === "user" && typeof message.text === "string" && message.text.trim().length > 0
          );
          const seed = firstUserMessage?.text?.trim();
          if (!seed) {
            return;
          }
          requestGeneratedTitle(session.id, seed);
        } catch (error) {
          console.error("Failed to derive conversation title from history:", error);
        } finally {
          historyAutoTitleRef.current.delete(session.id);
        }
      })();
    });
  }, [requestGeneratedTitle, sessions]);

  const deleteSession = useCallback(
    (sessionId: string) => {
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      if (target?.scope === "general") {
        return;
      }
      setSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId);
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions]
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
          const existingIndex = findExistingIndex(conversationId);
          const resolveTitle = (currentTitle: string) => {
            const trimmed = currentTitle.trim();
            const shouldFavorLocalTitle =
              normalizedTitle === "New Chat" && trimmed.length > 0 && trimmed.toLowerCase() !== "new chat";
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
      }
    ): Promise<ChatSession> => {
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

      if (trimmedInitial) {
        requestGeneratedTitle(sessionId, trimmedInitial);
      }

      if (!trimmedInitial) {
        return baseSession;
      }

      if (!shouldAutoStream) {
        return baseSession;
      }

      const resolvedUser = await resolveChatUser();

      if (!resolvedUser) {
        if (trimmedInitial && typeof window !== "undefined") {
          window.setTimeout(() => {
            appendMessage(sessionId, "assistant", buildAssistantReply(trimmedInitial));
            updateSession(sessionId, { isResponding: false, pendingAutoStream: false });
          }, FALLBACK_ASSISTANT_DELAY_MS);
        }
        return baseSession;
      }

      // Fast-path streaming:
      // Immediately insert an empty assistant message so the user sees a reply start instantly.
      let assistantMessageId: string | null = null;
      const initialAssistant = appendMessage(sessionId, "assistant", "");
      assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;
      if (assistantMessageId) {
        updateSession(sessionId, { isResponding: true, pendingAutoStream: false });
      }
      const streamingUserId = resolvedUser.id;

      const useWorkspaceContext = shouldIncludeWorkspaceContext(
        trimmedInitial,
        workspaceContextValue
      );
      const contextPayload = useWorkspaceContext ? workspaceContextValue ?? undefined : undefined;

      (async () => {
        try {
          let accumulated = "";
          let streamedConversationId: string | null =
            normalizeConversationIdValue(baseSession.conversationId) ?? null;

          for await (const event of apiService.sendMessageStream({
            message: trimmedInitial,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            conversation_id: streamedConversationId ?? undefined,
          })) {
            if (event.type === "token") {
              accumulated += event.delta;
              const content = accumulated;
              if (assistantMessageId) {
                updateMessage(sessionId, assistantMessageId, { content });
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
      updateSession,
      resolveChatUser,
      workspaceContextValue,
      queueConversationTitleSync,
      requestGeneratedTitle,
      schedulePendingSeedCleanup,
      personalizedSystemPrompt,
      markAutoStreamTriggered,
    ]
  );

  const sendGeneralMessage = useCallback(
    async (content: string, attachments?: ChatAttachment[]): Promise<string> => {
      const trimmed = content.trim();
      const generalSession = ensureGeneralSession();

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

      const useWorkspaceContext = shouldIncludeWorkspaceContext(
        trimmed,
        workspaceContextValue
      );
      const contextPayload = useWorkspaceContext ? workspaceContextValue ?? undefined : undefined;

      let accumulated = "";
      let streamedConversationId: string | null =
        normalizeConversationIdValue(generalSession.conversationId) ?? null;
      const streamingUserId = resolvedUser.id;

      try {
        for await (const event of apiService.sendMessageStream({
          message: trimmed,
          system_prompt: personalizedSystemPrompt,
          user_id: streamingUserId,
          context: contextPayload,
          attachments: attachmentPayload,
          conversation_id: streamedConversationId ?? undefined,
        })) {
          if (event.type === "token") {
            accumulated += event.delta;
            const content = accumulated;
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content });
            }
            continue;
          }

          if (event.type === "end") {
            streamedConversationId =
              normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
            const finalResponse = normalizeAssistantContent(event.response ?? accumulated, trimmed);
            const content = finalResponse;

            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content });
            } else {
              const assistantMessage = appendMessage(generalSession.id, "assistant", content);
              assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
            }

            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
            });
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
          conversationId: streamedConversationId ?? undefined,
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
        updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
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
      deleteSession,
      getSession,
      ensureSession,
      generalSessionId,
      workspaceContext: workspaceContextValue,
      setWorkspaceContext: setWorkspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
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
      ensureSession,
      sessions,
      updateSession,
      workspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
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
