import { useCallback, type SetStateAction } from "react";
import type { ChatSession } from "../types";
import { makeMessage, normalizeSessionsList } from "./sessionStore";

type UseCreateThreadSessionOptions = {
  persistSessions: (sessions: ChatSession[]) => void;
  queueConversationTitleSync: (sessionId: string, fallbackTitle: string) => void;
  setSessions: (updater: SetStateAction<ChatSession[]>) => void;
};

export const useCreateThreadSession = ({
  persistSessions,
  queueConversationTitleSync,
  setSessions,
}: UseCreateThreadSessionOptions) => {
  return useCallback(
    async (
      initialMessage?: string,
      options?: {
        autoStream?: boolean;
      }
    ): Promise<ChatSession> => {
      const now = Date.now();
      const trimmedInitial = (initialMessage ?? "").trim();
      const shouldAutoStream = options?.autoStream !== false;

      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const fallbackTitle = "New Chat";
      const willAutoStream = shouldAutoStream && trimmedInitial.length > 0;

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
        pendingAutoStream: willAutoStream,
        isGeneratingTitle: willAutoStream,
      };

      if (trimmedInitial) {
        const userMessage = makeMessage("user", trimmedInitial);
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

      return baseSession;
    },
    [persistSessions, queueConversationTitleSync, setSessions]
  );
};

