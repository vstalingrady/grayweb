"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
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
  appendMessage: (sessionId: string, role: ChatRole, content: string) => void;
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  getSession: (sessionId: string) => ChatSession | undefined;
};

const ChatContext = createContext<ChatContextValue | null>(null);
const STORAGE_KEY = "gray-chat-sessions-v1";

const INITIAL_SESSIONS: ChatSession[] = [];

export const SYSTEM_PROMPT =
  "You are Gray the proactive companion by Alignment built to cut through distractions and turn intent to momentum.";

const makeMessage = (role: ChatRole, content: string): ChatMessage => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2),
  role,
  content,
  createdAt: Date.now(),
});

const deriveTitle = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) {
    return "New Chat";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 45).trim()}…` : trimmed;
};

export const buildAssistantReply = (prompt: string) =>
  `${SYSTEM_PROMPT}\n\nHere is a quick follow-up:\n\n${prompt}\n\nI can expand on any part—just let me know.`;

const cloneSession = (session: ChatSession): ChatSession => ({
  ...session,
  messages: session.messages.map((message) => ({ ...message })),
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
    return parsed.map((session) => ({
      ...cloneSession({
        ...session,
        messages: Array.isArray(session.messages)
          ? session.messages
          : [],
      }),
      isResponding: false,
    }));
  } catch (error) {
    console.warn("Failed to read stored chat sessions:", error);
    return defaultSessions();
  }
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [sessions, setSessions] = useState<ChatSession[]>(loadStoredSessions);

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

  const appendMessage = useCallback(
    (sessionId: string, role: ChatRole, content: string) => {
      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const message = makeMessage(role, content);
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

  const createSession = useCallback(
    async (initialMessage: string): Promise<ChatSession> => {
      const now = Date.now();
      const userMessage = makeMessage("user", initialMessage);
      const baseSession: ChatSession = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        title: deriveTitle(initialMessage),
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

      if (!user) {
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            appendMessage(baseSession.id, "assistant", buildAssistantReply(initialMessage));
            updateSession(baseSession.id, { isResponding: false });
          }, 700);
        }
        return baseSession;
      }

      (async () => {
        try {
          const response = await apiService.sendMessage({
            message: initialMessage,
            system_prompt: SYSTEM_PROMPT,
            user_id: user.id,
          });

          updateSession(baseSession.id, {
            conversationId: response.conversation_id,
          });
          appendMessage(baseSession.id, "assistant", response.response);
        } catch (error) {
          console.error("Failed to create AI chat session:", error);
          appendMessage(baseSession.id, "assistant", buildAssistantReply(initialMessage));
        } finally {
          updateSession(baseSession.id, { isResponding: false });
        }
      })();

      return baseSession;
    },
    [appendMessage, persistSessions, updateSession, user]
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
      updateSession,
      getSession,
    }),
    [appendMessage, createSession, getSession, sessions, updateSession]
  );

  useEffect(() => {
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
