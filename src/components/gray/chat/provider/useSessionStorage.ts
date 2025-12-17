import { useCallback, useEffect, useRef, type SetStateAction } from "react";
import { buildSessionStorageKeyCandidates } from "../utils";
import type { ChatSession } from "../types";
import {
  dedupeSessionsByConversation,
  loadStoredSessions,
  normalizeSessionsList,
} from "./sessionStore";

type SetSessions = (updater: SetStateAction<ChatSession[]>) => void;

type UseSessionStorageOptions = {
  sessions: ChatSession[];
  userId: number | undefined;
  userEmail: string | undefined;
  generalConversationId: string | undefined;
  setSessions: SetSessions;
};

type UseSessionStorageResult = {
  persistSessions: (sessions: ChatSession[]) => void;
};

export const useSessionStorage = ({
  sessions,
  userId,
  userEmail,
  generalConversationId,
  setSessions,
}: UseSessionStorageOptions): UseSessionStorageResult => {
  const hasLoadedFromStorageRef = useRef(false);

  // Hydrate from local storage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    // Only load if we haven't already (though this component should only mount once per app life ideally)
    if (hasLoadedFromStorageRef.current) {
      return;
    }

    const { sessions: loadedSessions } = loadStoredSessions(
      buildSessionStorageKeyCandidates(userId, userEmail)
    );

    if (loadedSessions.length > 0) {
      setSessions((prev) => {
        // Merge loaded sessions with any that might have been initialized (e.g. general)
        // For simplicity, just use loaded ones but ensure General exists if needed.
        const merged = dedupeSessionsByConversation([...prev, ...loadedSessions]);
        return normalizeSessionsList(merged);
      });
    }
    hasLoadedFromStorageRef.current = true;
  }, [setSessions, userEmail, userId]);

  const persistSessions = useCallback(
    (next: ChatSession[]) => {
      if (typeof window === "undefined") {
        return;
      }
      const keys = buildSessionStorageKeyCandidates(userId, userEmail);
      const key = keys[0]; // Use the most specific key (ID + Email, or ID)
      if (!key) {
        return;
      }

      try {
        const serializable = next.map((session) => ({
          ...session,
          messages: session.messages.map((message) => {
            if (!message.attachments?.length) {
              return message;
            }
            return {
              ...message,
              attachments: message.attachments.map((attachment) => {
                // Strip blob URLs (previewUrl) before saving so we don't load expired ones later
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { previewUrl, ...rest } = attachment;
                return rest;
              }),
            };
          }),
        }));
        window.localStorage.setItem(key, JSON.stringify(serializable));
      } catch (error) {
        console.warn("Failed to persist sessions to localStorage:", error);
      }
    },
    [userEmail, userId]
  );

  useEffect(() => {
    setSessions((prev) => {
      let changed = false;
      const next = prev.map((session) => {
        if (session.scope !== "general") {
          return session;
        }
        const nextConversationId = generalConversationId ?? undefined;
        if (session.conversationId === nextConversationId) {
          return session;
        }
        changed = true;
        return { ...session, conversationId: nextConversationId };
      });
      if (!changed) {
        return prev;
      }
      const ordered = normalizeSessionsList(next);
      persistSessions(ordered);
      return ordered;
    });
  }, [generalConversationId, persistSessions, setSessions]);

  useEffect(() => {
    if (!hasLoadedFromStorageRef.current) {
      return;
    }
    persistSessions(sessions);
  }, [persistSessions, sessions]);

  return { persistSessions };
};

