"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { apiService, ChatMessage as ApiChatMessage } from "@/lib/api";

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

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [sessions, setSessions] = useState<ChatSession[]>(() => INITIAL_SESSIONS);

  const appendMessage = useCallback(
    (sessionId: string, role: ChatRole, content: string) => {
      setSessions((prev) =>
        prev.map((session) => {
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
        })
      );
    },
    []
  );

  const createSession = useCallback(
    async (initialMessage: string): Promise<ChatSession> => {
      if (!user) {
        // Fallback to mock session if no user
        const now = Date.now();
        const message = makeMessage("user", initialMessage);
        const session: ChatSession = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
          title: deriveTitle(initialMessage),
          createdAt: now,
          updatedAt: message.createdAt,
          messages: [message],
          isResponding: true,
        };

        setSessions((prev) => [session, ...prev]);
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            appendMessage(session.id, "assistant", buildAssistantReply(initialMessage));
          }, 700);
        }
        return session;
      }

      try {
        // Create conversation first
        const conversation = await apiService.createConversation(deriveTitle(initialMessage), user.id);

        const now = Date.now();
        const message = makeMessage("user", initialMessage);
        const session: ChatSession = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
          title: deriveTitle(initialMessage),
          createdAt: now,
          updatedAt: message.createdAt,
          messages: [message],
          isResponding: true,
          conversationId: conversation.id,
        };

        setSessions((prev) => [session, ...prev]);

        // Send message to AI and get response
        const response = await apiService.sendMessage({
          message: initialMessage,
          conversation_id: conversation.id,
          user_id: user.id,
        });

        // Add AI response
        appendMessage(session.id, "assistant", response.response);

        return session;
      } catch (error) {
        console.error('Failed to create AI chat session:', error);

        // Fallback to mock session
        const now = Date.now();
        const message = makeMessage("user", initialMessage);
        const session: ChatSession = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
          title: deriveTitle(initialMessage),
          createdAt: now,
          updatedAt: message.createdAt,
          messages: [message],
          isResponding: true,
        };

        setSessions((prev) => [session, ...prev]);
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            appendMessage(session.id, "assistant", buildAssistantReply(initialMessage));
          }, 700);
        }
        return session;
      }
    },
    [appendMessage, user]
  );

  const updateSession = useCallback(
    (sessionId: string, partial: Partial<ChatSession>) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, ...partial } : session
        )
      );
    },
    []
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

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChatStore = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatStore must be used within a ChatProvider");
  }
  return ctx;
};
