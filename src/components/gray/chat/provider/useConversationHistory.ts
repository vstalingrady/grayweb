import { useCallback, useEffect, useRef, type MutableRefObject, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { chatService } from "@/lib/api";
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
        const history = await chatService.getConversation(normalizedConversationId);
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
  // On the dashboard and other routes, we also want to load the general chat
  // history to show the full conversation including past messages.
  useEffect(() => {
    const general = sessionsRef.current.find((session) => session.scope === "general");

    // We now always try to hydrate if we haven't yet and we have a userId
    // This ensures that even if local storage has some messages (like a proactivity
    // message injected via SSE), we still load the full history from the backend.
    if (!general || !userId || generalHistoryHydratedRef.current) {
      return;
    }

    let cancelled = false;

    const hydrateGeneralHistory = async () => {
      const generalConversationId = buildGeneralConversationId(userId);
      if (!generalConversationId) {
        return;
      }
      try {
        const history = await chatService.getConversation(generalConversationId);
        if (cancelled || !Array.isArray(history) || history.length === 0) {
          // Still mark as hydrated to prevent repeated empty fetches
          generalHistoryHydratedRef.current = true;
          return;
        }

        const now = Date.now();
        const mapped = mapApiMessagesToChatMessages(history, generalConversationId, now);

        if (!mapped.length) {
          generalHistoryHydratedRef.current = true;
          return;
        }

        setSessions((prev) => {
          const index = prev.findIndex((session) => session.scope === "general");
          if (index === -1) {
            return prev;
          }
          const current = prev[index];

          // Always replace with server data since the backend is the source of truth.
          // This fixes the issue where only proactivity messages showed after refresh
          // because local storage had fewer messages than the database.
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
        // Mark as hydrated even on error to prevent infinite retry loops
        generalHistoryHydratedRef.current = true;
      }
    };

    void hydrateGeneralHistory();
    return () => {
      cancelled = true;
    };
  }, [persistSessions, setSessions, sessionsRef, userId]);


  return { loadConversationMessages };
};
