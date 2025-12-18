import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { chatService } from "@/lib/api";
import type { ChatSession, ConversationHistoryEntryPayload } from "../types";
import { buildConversationHistoryPayload, normalizeConversationIdValue } from "../utils";

type UseConversationSyncOptions = {
  sessions: ChatSession[];
  sessionsRef: MutableRefObject<ChatSession[]>;
  userId?: number;
};

type UseConversationSyncResult = {
  pendingHistorySyncRef: MutableRefObject<Set<string>>;
  pendingTitleSyncRef: MutableRefObject<Map<string, string>>;
  queueConversationTitleSync: (sessionId: string, title: string) => void;
  enqueueHistorySync: (conversationId: string, payload: ConversationHistoryEntryPayload[]) => void;
};

export const useConversationSync = ({
  sessions,
  sessionsRef,
  userId,
}: UseConversationSyncOptions): UseConversationSyncResult => {
  const pendingHistorySyncRef = useRef<Set<string>>(new Set());
  const pendingTitleSyncRef = useRef<Map<string, string>>(new Map());
  const historySyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleHistorySync = useCallback(
    (conversationId: string, payload: ConversationHistoryEntryPayload[]) => {
      void (async () => {
        try {
          await chatService.overwriteConversationHistory(conversationId, payload);
        } catch (error) {
          console.warn("Failed to sync conversation history after deletion:", error);
        }
      })();
    },
    []
  );

  const enqueueHistorySync = useCallback(
    (conversationId: string, payload: ConversationHistoryEntryPayload[]) => {
      const existing = historySyncTimersRef.current.get(conversationId);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        historySyncTimersRef.current.delete(conversationId);
        scheduleHistorySync(conversationId, payload);
      }, 250);
      historySyncTimersRef.current.set(conversationId, timer);
    },
    [scheduleHistorySync]
  );

  useEffect(() => {
    const timers = historySyncTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!pendingHistorySyncRef.current.size) {
      return;
    }
    const pending = Array.from(pendingHistorySyncRef.current);
    pending.forEach((sessionId) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      if (!session) {
        pendingHistorySyncRef.current.delete(sessionId);
        return;
      }
      const normalizedConversationId = normalizeConversationIdValue(session.conversationId ?? undefined);
      if (!normalizedConversationId) {
        return;
      }
      pendingHistorySyncRef.current.delete(sessionId);
      const payload = buildConversationHistoryPayload(session.messages);
      scheduleHistorySync(normalizedConversationId, payload);
    });
  }, [sessions, scheduleHistorySync, sessionsRef]);

  const syncConversationTitle = useCallback(
    async (sessionId: string, conversationId: string, title: string) => {
      const trimmed = title.trim();
      const normalizedConversationId = normalizeConversationIdValue(conversationId);
      if (!trimmed || !normalizedConversationId) {
        return;
      }
      if (!userId) {
        // Wait until we know the numeric user so the backend can create or update the row.
        return;
      }
      try {
        await chatService.updateConversation(normalizedConversationId, {
          title: trimmed,
          user_id: userId,
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
    [userId]
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
    [sessionsRef, syncConversationTitle]
  );

  useEffect(() => {
    pendingTitleSyncRef.current.forEach((title, sessionId) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      const normalizedConversationId = normalizeConversationIdValue(session?.conversationId);
      if (normalizedConversationId) {
        void syncConversationTitle(sessionId, normalizedConversationId, title);
      }
    });
  }, [sessions, syncConversationTitle, sessionsRef]);

  return {
    pendingHistorySyncRef,
    pendingTitleSyncRef,
    queueConversationTitleSync,
    enqueueHistorySync,
  };
};
