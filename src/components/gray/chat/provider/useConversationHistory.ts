import { useCallback, useEffect, useRef, type MutableRefObject, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { apiService } from "@/lib/api";
import type { ChatSession } from "../types";
import { buildGeneralConversationId, normalizeConversationIdValue } from "../utils";
import { mapApiMessagesToChatMessages, normalizeSessionsList } from "./sessionStore";

type SetSessions = (updater: SetStateAction<ChatSession[]>) => void;

type UseConversationHistoryOptions = {
  sessionsRef: MutableRefObject<ChatSession[]>;
  setSessions: SetSessions;
  persistSessions: (sessions: ChatSession[]) => void;
  userId: number | undefined;
};

type UseConversationHistoryResult = {
  loadConversationMessages: (sessionId: string) => Promise<void>;
};

export const useConversationHistory = ({
  sessionsRef,
  setSessions,
  persistSessions,
  userId,
}: UseConversationHistoryOptions): UseConversationHistoryResult => {
  const pathname = usePathname();
  const generalHistoryHydratedRef = useRef(false);

  const loadConversationMessages = useCallback(
    async (sessionId: string) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      if (!session || !session.conversationId) {
        return;
      }
      const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
      if (!normalizedConversationId) {
        return;
      }
      if (session.messages.length > 0) {
        return;
      }

      try {
        const history = await apiService.getConversation(normalizedConversationId);
        if (!Array.isArray(history) || history.length === 0) {
          return;
        }

        const now = Date.now();
        const mapped = mapApiMessagesToChatMessages(history, normalizedConversationId, now);

        if (!mapped.length) {
          return;
        }

        setSessions((prev) => {
          const index = prev.findIndex((candidate) => candidate.id === sessionId);
          if (index === -1) {
            return prev;
          }
          const current = prev[index];
          // Double check to avoid race conditions
          if (current.messages && current.messages.length > 0) {
            return prev;
          }
          const updated: ChatSession = {
            ...current,
            messages: mapped,
            // We don't update updatedAt here to avoid jumping it to the top of the list
            isResponding: false,
          };
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
  useEffect(() => {
    const general = sessionsRef.current.find((session) => session.scope === "general");
    const generalHasMessages = Boolean(general?.messages && general.messages.length > 0);

    // Reset hydration flag if we're on /g but the session has no messages
    // This handles page refreshes where the session state is lost
    if (pathname === "/g" && !generalHasMessages) {
      generalHistoryHydratedRef.current = false;
    }

    if (!general || !userId || pathname !== "/g" || generalHistoryHydratedRef.current || generalHasMessages) {
      return;
    }

    let cancelled = false;

    const hydrateGeneralHistory = async () => {
      const generalConversationId = buildGeneralConversationId(userId);
      if (!generalConversationId) {
        return;
      }
      try {
        const history = await apiService.getConversation(generalConversationId);
        if (cancelled || !Array.isArray(history) || history.length === 0) {
          return;
        }

        const now = Date.now();
        const mapped = mapApiMessagesToChatMessages(history, generalConversationId, now);

        if (!mapped.length) {
          return;
        }

        setSessions((prev) => {
          const index = prev.findIndex((session) => session.scope === "general");
          if (index === -1) {
            return prev;
          }
          const current = prev[index];
          if (current.messages && current.messages.length > 0) {
            return prev;
          }
          const updated: ChatSession = {
            ...current,
            conversationId: generalConversationId,
            messages: mapped,
            updatedAt: now,
            isResponding: false,
          };
          const next = [...prev];
          next[index] = updated;
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
        generalHistoryHydratedRef.current = true;
      } catch (error) {
        console.error("Failed to load general conversation history:", error);
      }
    };

    void hydrateGeneralHistory();
    return () => {
      cancelled = true;
    };
  }, [pathname, persistSessions, setSessions, sessionsRef, userId]);

  return { loadConversationMessages };
};
