import { useCallback, useEffect, useRef, type MutableRefObject, type SetStateAction } from "react";
import { chatService } from "@/lib/api";
import type { ChatSession } from "../types";
import { buildGeneralConversationId, normalizeConversationIdValue } from "../utils";
import { mergeConversationHistoryIntoSession, normalizeSessionsList } from "./sessionStore";

type SetSessions = (updater: SetStateAction<ChatSession[]>) => void;

type UseConversationHistoryOptions = {
  sessionsRef: MutableRefObject<ChatSession[]>;
  setSessions: SetSessions;
  persistSessions: (sessions: ChatSession[]) => void;
  userId: number | undefined;
};

type UseConversationHistoryResult = {
  loadConversationMessages: (
    sessionId: string,
    options?: {
      force?: boolean;
      touchUpdatedAt?: boolean;
      conversationIdOverride?: string | null;
    }
  ) => Promise<void>;
};

export const useConversationHistory = ({
  sessionsRef,
  setSessions,
  persistSessions,
  userId,
}: UseConversationHistoryOptions): UseConversationHistoryResult => {
  const generalHistoryHydratedRef = useRef(false);
  const generalHistoryHydratingRef = useRef(false);
  const generalHistoryRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversationMessages = useCallback(
    async (
      sessionId: string,
      options?: {
        force?: boolean;
        touchUpdatedAt?: boolean;
        conversationIdOverride?: string | null;
      }
    ) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      if (!session) {
        return;
      }
      if (session.isResponding) {
        return;
      }
      const normalizedConversationId = normalizeConversationIdValue(
        options?.conversationIdOverride ?? session.conversationId
      );
      if (!normalizedConversationId) {
        return;
      }
      if (!options?.force && session.messages.length > 0) {
        return;
      }

      try {
        const history = await chatService.getConversation(normalizedConversationId);
        if (!Array.isArray(history) || history.length === 0) {
          return;
        }

        setSessions((prev) => {
          const index = prev.findIndex((candidate) => candidate.id === sessionId);
          if (index === -1) {
            return prev;
          }
          const current = prev[index];
          const updated = mergeConversationHistoryIntoSession(
            current,
            history,
            normalizedConversationId,
            {
              force: options?.force,
              touchUpdatedAt: options?.touchUpdatedAt,
            }
          );
          if (!updated) {
            return prev;
          }
          const next = [...prev];
          next[index] = updated;
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
      }
    },
    [persistSessions, sessionsRef, setSessions]
  );

  // Hydrate the General workspace (`/g`) from Supabase-backed history so that
  // existing `general_chat_messages` rows render as the canonical General chat.
  // On the dashboard and other routes, we also want to load the general chat
  // history to show the full conversation including past messages.
  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelayMs = 1500;

    const clearRetryTimer = () => {
      if (generalHistoryRetryTimerRef.current) {
        clearTimeout(generalHistoryRetryTimerRef.current);
        generalHistoryRetryTimerRef.current = null;
      }
    };

    const getGeneralSession = () =>
      sessionsRef.current.find((session) => session.scope === "general");

    const scheduleRetry = () => {
      if (cancelled || generalHistoryRetryTimerRef.current) {
        return;
      }
      retryCount += 1;
      if (retryCount > maxRetries) {
        return;
      }
      const delayMs = baseDelayMs * retryCount;
      generalHistoryRetryTimerRef.current = setTimeout(() => {
        generalHistoryRetryTimerRef.current = null;
        if (!cancelled) {
          void hydrateGeneralHistory();
        }
      }, delayMs);
    };

    const hydrateGeneralHistory = async () => {
      const general = getGeneralSession();

      // We now always try to hydrate if we haven't yet and we have a userId
      // This ensures that even if local storage has some messages (like a proactivity
      // message injected via SSE), we still load the full history from the backend.
      if (!general || !userId || generalHistoryHydratedRef.current) {
        return;
      }
      if (generalHistoryHydratingRef.current || general.isResponding) {
        return;
      }

      const generalConversationId = buildGeneralConversationId(userId);
      if (!generalConversationId) {
        return;
      }
      generalHistoryHydratingRef.current = true;
      try {
        await loadConversationMessages(general.id, {
          force: true,
          touchUpdatedAt: true,
          conversationIdOverride: generalConversationId,
        });
        generalHistoryHydratedRef.current = true;
        retryCount = 0;
        clearRetryTimer();
      } catch (error) {
        console.error("Failed to load general conversation history:", error);
        scheduleRetry();
        // Mark as hydrated even on error to prevent infinite retry loops
        generalHistoryHydratedRef.current = true;
      } finally {
        generalHistoryHydratingRef.current = false;
      }
    };

    void hydrateGeneralHistory();
    return () => {
      cancelled = true;
      clearRetryTimer();
    };
  }, [loadConversationMessages, sessionsRef, userId]);


  return { loadConversationMessages };
};
