import { useCallback, type MutableRefObject, type SetStateAction } from "react";

import { apiService } from "@/lib/api";

import type { ChatSession, ChatSessionScope, ChatTitleMode } from "../types";
import {
  buildSessionStorageKeyCandidates,
  coerceConversationIdForRequest,
  isGenericSessionTitle as isGenericTitle,
  isTitleDerivedFromMessage,
  normalizeConversationIdValue,
} from "../utils";
import { GENERAL_SESSION_TITLE, createEmptyGeneralSession, normalizeSessionsList } from "./sessionStore";

type UseSessionLifecycleActionsOptions = {
  sessionsRef: MutableRefObject<ChatSession[]>;
  setSessions: (updater: SetStateAction<ChatSession[]>) => void;
  persistSessions: (sessions: ChatSession[]) => void;
  generalConversationIdRef: MutableRefObject<string | undefined>;
  pendingTitleSyncRef: MutableRefObject<Map<string, string>>;
  queueConversationTitleSync: (sessionId: string, title: string) => void;
  resetAutoStreamState: (sessionId?: string | null) => void;
  userId?: number;
  userEmail?: string;
};

type UseSessionLifecycleActionsResult = {
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  applyAutoTitle: (sessionId: string, candidate?: string | null) => void;
  renameSession: (sessionId: string, title: string) => void;
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>;
  deleteSession: (sessionId: string) => void;
  clearAllConversations: () => void;
  ensureGeneralSession: () => ChatSession;
  getSession: (sessionId: string) => ChatSession | undefined;
  ensureSession: (sessionId: string, initializer: () => ChatSession) => ChatSession;
};

export const useSessionLifecycleActions = ({
  sessionsRef,
  setSessions,
  persistSessions,
  generalConversationIdRef,
  pendingTitleSyncRef,
  queueConversationTitleSync,
  resetAutoStreamState,
  userId,
  userEmail,
}: UseSessionLifecycleActionsOptions): UseSessionLifecycleActionsResult => {
  const updateSession = useCallback(
    (sessionId: string, partial: Partial<ChatSession>) => {
      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const normalizedPartial: Partial<ChatSession> = { ...partial };
          if ("conversationId" in partial) {
            normalizedPartial.conversationId =
              coerceConversationIdForRequest(partial.conversationId) ?? undefined;
          }
          return { ...session, ...normalizedPartial };
        });
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions, setSessions]
  );

  const applyAutoTitle = useCallback(
    (sessionId: string, candidate?: string | null) => {
      const session = sessionsRef.current.find((entry) => entry.id === sessionId);
      if (!session || session.scope === "general" || session.titleMode === "manual") {
        return;
      }
      const rawTitle = (candidate ?? "").trim();
      if (!rawTitle) {
        return;
      }
      if (!isGenericTitle(session.title) && !isTitleDerivedFromMessage(session.title, session.messages)) {
        return;
      }
      if (session.title?.trim() === rawTitle) {
        return;
      }
      updateSession(sessionId, { title: rawTitle, titleMode: "auto", isGeneratingTitle: false });
      queueConversationTitleSync(sessionId, rawTitle);
    },
    [queueConversationTitleSync, sessionsRef, updateSession]
  );

  const renameSession = useCallback(
    (sessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        return;
      }
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      if (target?.scope === "general") {
        return;
      }
      const normalized = trimmed.length > 100 ? trimmed.slice(0, 100).trim() : trimmed;
      updateSession(sessionId, {
        title: normalized,
        titleMode: "manual",
        updatedAt: Date.now(),
      });
      queueConversationTitleSync(sessionId, normalized);
    },
    [queueConversationTitleSync, sessionsRef, updateSession]
  );

  const pinSession = useCallback(
    async (sessionId: string, pinned: boolean) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;

      const currentMeta = session.metadata || {};
      updateSession(sessionId, {
        metadata: { ...currentMeta, is_pinned: pinned },
        updatedAt: Date.now(),
      });

      const conversationId = normalizeConversationIdValue(session.conversationId);
      if (conversationId) {
        try {
          await apiService.updateConversation(conversationId, {
            metadata: { is_pinned: pinned },
          });
        } catch (err) {
          console.error("Failed to pin session:", err);
        }
      }
    },
    [sessionsRef, updateSession]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      if (target?.scope === "general") {
        return;
      }

      if (target) {
        resetAutoStreamState(sessionId);

        setSessions((prev) => {
          const next = prev.filter((session) => session.id !== sessionId);
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
      }

      const normalizedConversationId = normalizeConversationIdValue(target?.conversationId ?? sessionId);
      if (normalizedConversationId) {
        void (async () => {
          try {
            await apiService.deleteConversation(normalizedConversationId);
          } catch (error) {
            console.error("Failed to delete remote conversation:", error);
          }
        })();
      }
    },
    [persistSessions, resetAutoStreamState, sessionsRef, setSessions]
  );

  const clearAllConversations = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const keys = buildSessionStorageKeyCandidates(userId, userEmail);
        keys.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // ignore storage failures
      }
    }

    resetAutoStreamState();
    pendingTitleSyncRef.current = new Map();

    setSessions(() => {
      const emptyGeneral = createEmptyGeneralSession(undefined, generalConversationIdRef.current);
      const ordered = normalizeSessionsList([emptyGeneral]);
      persistSessions(ordered);
      return ordered;
    });
  }, [
    generalConversationIdRef,
    pendingTitleSyncRef,
    persistSessions,
    resetAutoStreamState,
    setSessions,
    userEmail,
    userId,
  ]);

  const ensureGeneralSession = useCallback((): ChatSession => {
    const existing = sessionsRef.current.find((session) => session.scope === "general");
    if (existing) {
      return existing;
    }
    const created = createEmptyGeneralSession(undefined, generalConversationIdRef.current);
    setSessions((prev) => {
      const next = normalizeSessionsList([created, ...prev]);
      persistSessions(next);
      return next;
    });
    return created;
  }, [generalConversationIdRef, persistSessions, sessionsRef, setSessions]);

  const getSession = useCallback(
    (sessionId: string) => {
      return sessionsRef.current.find((session) => session.id === sessionId);
    },
    [sessionsRef]
  );

  const ensureSession = useCallback(
    (sessionId: string, initializer: () => ChatSession): ChatSession => {
      const existing = sessionsRef.current.find((session) => session.id === sessionId);
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const raw = initializer() ?? ({} as ChatSession);
      const normalizedScope: ChatSessionScope = raw.scope === "general" ? "general" : "thread";
      const normalized: ChatSession = {
        id: sessionId,
        title:
          normalizedScope === "general"
            ? GENERAL_SESSION_TITLE
            : typeof raw.title === "string" && raw.title.trim().length > 0
              ? raw.title.trim()
              : "New Chat",
        titleMode:
          normalizedScope === "general"
            ? "manual"
            : (raw.titleMode as ChatTitleMode) === "manual"
              ? "manual"
              : "auto",
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
        messages: Array.isArray(raw.messages)
          ? raw.messages.map((message) => ({
            ...message,
          }))
          : [],
        isResponding: Boolean(raw.isResponding),
        scope: normalizedScope,
        conversationId: normalizeConversationIdValue(raw.conversationId),
        pendingAutoStream: Boolean(raw.pendingAutoStream),
      };

      setSessions((prev) => {
        const alreadyExists = prev.some((session) => session.id === sessionId);
        if (alreadyExists) {
          return prev;
        }
        const general = prev.find((session) => session.scope === "general");
        const others = prev.filter((session) => !(general && session.id === general.id));
        const next = general ? [general, normalized, ...others] : [normalized, ...others];
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      return normalized;
    },
    [persistSessions, sessionsRef, setSessions]
  );

  return {
    updateSession,
    applyAutoTitle,
    renameSession,
    pinSession,
    deleteSession,
    clearAllConversations,
    ensureGeneralSession,
    getSession,
    ensureSession,
  };
};

