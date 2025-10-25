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

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: "session-subjective-attractiveness",
    title: "Subjective Attractiveness",
    createdAt: Date.UTC(2024, 6, 12),
    updatedAt: Date.UTC(2024, 6, 12),
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "How can I evaluate subjective attractiveness in user research?",
        createdAt: Date.UTC(2024, 6, 12),
      },
      {
        id: "msg-2",
        role: "assistant",
        content:
          "Subjective attractiveness is best captured through qualitative prompts and relative rankings rather than hard scoring. Try asking participants to describe which options they gravitate toward and why, then summarize recurring descriptors.",
        createdAt: Date.UTC(2024, 6, 12),
      },
    ],
    isResponding: false,
  },
  {
    id: "session-mobile-fade-effect",
    title: "Mobile-Friendly Fade Effect",
    createdAt: Date.UTC(2024, 6, 4),
    updatedAt: Date.UTC(2024, 6, 4),
    messages: [
      {
        id: "msg-3",
        role: "user",
        content: "Can you help me build a mobile fade effect without jank?",
        createdAt: Date.UTC(2024, 6, 4),
      },
      {
        id: "msg-4",
        role: "assistant",
        content:
          "Use an absolutely positioned gradient overlay that transitions its opacity while keeping the underlying content static. This avoids layout thrashing and keeps 60fps on mobile.",
        createdAt: Date.UTC(2024, 6, 4),
      },
    ],
    isResponding: false,
  },
  {
    id: "session-chat-log-analysis",
    title: "Chat Log Analysis Techniques",
    createdAt: Date.UTC(2024, 5, 21),
    updatedAt: Date.UTC(2024, 5, 21),
    messages: [
      {
        id: "msg-5",
        role: "user",
        content: "What approach should I use to summarize multi-agent chat logs?",
        createdAt: Date.UTC(2024, 5, 21),
      },
      {
        id: "msg-6",
        role: "assistant",
        content:
          "Cluster messages by topic with embeddings, then generate summaries per cluster. Feed those summaries into a final pass for the overall narrative.",
        createdAt: Date.UTC(2024, 5, 21),
      },
    ],
    isResponding: false,
  },
];

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
  `Here is a quick thought:\n\n${prompt}\n\nI can expand on any part—just let me know.`;

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
