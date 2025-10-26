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
import { apiService, type ChatAttachment } from "@/lib/api";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  isResponding: boolean;
  conversationId?: string;
};

type ChatContextValue = {
  sessions: ChatSession[];
  createSession: (initialMessage: string) => Promise<ChatSession>;
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
  workspaceContext: string | null;
  setWorkspaceContext: (context: string | null) => void;
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

export const SYSTEM_PROMPT = [
  "You're Gray, the helpful teammate in the Alignment workspace. Sound like a thoughtful human colleague—relaxed, plain language, and natural contractions. Mirror the user's mood without going overboard and keep boundaries professional.",
  "Answer the user's question within the first couple of sentences. Use short paragraphs, and lean on compact bullet lists only when they clarify the point. Skip ceremonial intros, status updates, or dramatic lead-ins.",
  "If the user asks for more depth, expand with reasoning, examples, and concrete next steps. Otherwise stay concise without slipping into terse or clipped replies.",
  "Offer follow-up questions or suggestions only if they genuinely help the user keep momentum. Avoid canned phrases; acknowledge mistakes briefly, fix them, and move on.",
].join("\n\n");

export const buildAssistantReply = (_prompt: string) =>
  "I'm here and ready—feel free to share more details or ask another question.";

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
];
const MIN_CONTEXT_MESSAGE_LENGTH = 48;

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

const makeMessage = (role: ChatRole, content: string, attachments?: ChatAttachment[]): ChatMessage => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2),
  role,
  content,
  createdAt: Date.now(),
  attachments:
    attachments && attachments.length > 0
      ? attachments.map((attachment) => ({ ...attachment }))
      : undefined,
});

const deriveTitle = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return "New Chat";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 45).trim()}…` : trimmed;
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

const defaultSessions = () => INITIAL_SESSIONS.map(cloneSession);

const loadStoredSessions = (): ChatSession[] => {
  if (typeof window === "undefined") {
    return defaultSessions();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSessions();
    }
    const parsed = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(parsed)) {
      return defaultSessions();
    }
    const sanitized = parsed.filter(
      (session) =>
        session &&
        !PLACEHOLDER_SESSION_IDS.has(session.id) &&
        !PLACEHOLDER_TITLES.has(session.title)
    );

    const normalized = sanitized.map((session) => ({
      ...cloneSession({
        ...session,
        messages: Array.isArray(session.messages)
          ? session.messages
          : [],
      }),
      isResponding: false,
    }));

    if (sanitized.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }

    return normalized;
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
  const { user } = useUser();
  const [sessions, setSessions] = useState<ChatSession[]>(defaultSessions);
  const [workspaceContextValue, setWorkspaceContextValue] = useState<string | null>(
    workspaceContext ?? null
  );
  const hasLoadedFromStorageRef = useRef(false);

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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
      if (prev.length > 0) {
        return prev;
      }
      return stored;
    });
  }, []);

  const appendMessage = useCallback(
    (sessionId: string, role: ChatRole, content: string, attachments?: ChatAttachment[]) => {
      let createdMessage: ChatMessage | null = null;
      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const message = makeMessage(role, content, attachments);
          createdMessage = message;
          return {
            ...session,
            messages: [...session.messages, message],
            updatedAt: message.createdAt,
            isResponding: role === "user",
            title:
              session.messages.length === 0 && role === "user"
                ? deriveTitle(content)
                : session.title,
          };
        });
        persistSessions(next);
        return next;
      });
      return createdMessage;
    },
    [persistSessions]
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
        if (didUpdate) {
          persistSessions(next);
        }
        return didUpdate ? next : prev;
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
        if (didUpdate) {
          persistSessions(next);
          return next;
        }
        return prev;
      });
    },
    [persistSessions]
  );

  const updateSession = useCallback(
    (sessionId: string, partial: Partial<ChatSession>) => {
      setSessions((prev) => {
        const next = prev.map((session) =>
          session.id === sessionId ? { ...session, ...partial } : session
        );
        persistSessions(next);
        return next;
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
      updateSession(sessionId, { title: trimmed });
    },
    [updateSession]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId);
        persistSessions(next);
        return next;
      });
    },
    [persistSessions]
  );

  const createSession = useCallback(
    async (initialMessage: string): Promise<ChatSession> => {
      const now = Date.now();
      const userMessage = makeMessage("user", initialMessage);
      const fallbackTitle = deriveTitle(initialMessage);
      const baseSession: ChatSession = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        title: fallbackTitle,
        createdAt: now,
        updatedAt: userMessage.createdAt,
        messages: [userMessage],
        isResponding: true,
      };

      setSessions((prev) => {
        const next = [baseSession, ...prev];
        persistSessions(next);
        return next;
      });

      const trimmedInitial = initialMessage.trim();
      if (trimmedInitial.length > 0) {
        apiService
          .generateChatTitle(trimmedInitial)
          .then((response) => {
            const suggestedTitle = response?.title?.trim();
            if (!suggestedTitle || suggestedTitle === fallbackTitle) {
              return;
            }
            setSessions((prev) => {
              let didUpdate = false;
              const next = prev.map((session) => {
                if (session.id !== baseSession.id) {
                  return session;
                }
                const currentTitle = session.title?.trim() ?? "";
                if (
                  currentTitle &&
                  currentTitle !== fallbackTitle &&
                  currentTitle !== "New Chat"
                ) {
                  return session;
                }
                if (currentTitle === suggestedTitle) {
                  return session;
                }
                didUpdate = true;
                return {
                  ...session,
                  title: suggestedTitle,
                };
              });
              if (didUpdate) {
                persistSessions(next);
                return next;
              }
              return prev;
            });
          })
          .catch((error) => {
            console.error("Failed to generate chat title:", error);
          });
      }

      if (!user) {
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            appendMessage(baseSession.id, "assistant", buildAssistantReply(initialMessage));
            updateSession(baseSession.id, { isResponding: false });
          }, FALLBACK_ASSISTANT_DELAY_MS);
        }
        return baseSession;
      }

      const useWorkspaceContext = shouldIncludeWorkspaceContext(
        initialMessage,
        workspaceContextValue
      );
      const contextPayload = useWorkspaceContext ? workspaceContextValue ?? undefined : undefined;

      (async () => {
        try {
          let assistantMessageId: string | null = null;
          let accumulated = "";
          let streamedConversationId: string | null = null;

          for await (const event of apiService.sendMessageStream({
            message: initialMessage,
            system_prompt: SYSTEM_PROMPT,
            user_id: user.id,
            context: contextPayload,
          })) {
            if (event.type === "token") {
              accumulated += event.delta;
              if (!assistantMessageId) {
                const assistantMessage = appendMessage(baseSession.id, "assistant", accumulated);
                assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
                updateSession(baseSession.id, { isResponding: true });
              } else if (assistantMessageId) {
                updateMessage(baseSession.id, assistantMessageId, { content: accumulated });
              }
              continue;
            }

            if (event.type === "end") {
              streamedConversationId = event.conversationId ?? streamedConversationId;
              const finalResponse = normalizeAssistantContent(event.response ?? accumulated, initialMessage);
              accumulated = finalResponse;
              if (!assistantMessageId) {
                const assistantMessage = appendMessage(baseSession.id, "assistant", finalResponse);
                assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
              } else if (assistantMessageId) {
                updateMessage(baseSession.id, assistantMessageId, { content: finalResponse });
              }
              updateSession(baseSession.id, {
                conversationId: streamedConversationId ?? undefined,
                isResponding: false,
              });
              return;
            }

            if (event.type === "error") {
              throw new Error(event.message);
            }
          }

          if (!assistantMessageId) {
            const normalized = normalizeAssistantContent(accumulated, initialMessage);
            const assistantMessage = appendMessage(baseSession.id, "assistant", normalized);
            assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
            accumulated = normalized;
          }

          updateSession(baseSession.id, {
            conversationId: streamedConversationId ?? undefined,
            isResponding: false,
          });
        } catch (error) {
          console.error("Failed to create AI chat session:", error);
          appendMessage(baseSession.id, "assistant", buildAssistantReply(initialMessage));
          updateSession(baseSession.id, { isResponding: false });
        }
      })();

      return baseSession;
    },
    [
      appendMessage,
      persistSessions,
      shouldIncludeWorkspaceContext,
      updateMessage,
      updateSession,
      user,
      workspaceContextValue,
    ]
  );

  const getSession = useCallback(
    (sessionId: string) => sessions.find((session) => session.id === sessionId),
    [sessions]
  );

  const value = useMemo(
    () => ({
      sessions,
      createSession,
      appendMessage,
      updateMessage,
      deleteMessage,
      updateSession,
      renameSession,
      deleteSession,
      getSession,
      workspaceContext: workspaceContextValue,
      setWorkspaceContext: setWorkspaceContextValue,
    }),
    [
      appendMessage,
      createSession,
      deleteSession,
      getSession,
      deleteMessage,
      updateMessage,
      renameSession,
      sessions,
      updateSession,
      workspaceContextValue,
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
