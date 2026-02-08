import { useCallback, useEffect, useRef, type MutableRefObject, type SetStateAction } from "react";
import { chatService, type GroundingMetadata, type MediaUpload } from "@/lib/api";
import type {
  ChatMessage,
  ChatRole,
  ChatSession,
  ChatSessionScope,
  ChatTitleMode,
} from "../types";
import {
  buildSessionStorageKeyCandidates,
  coerceConversationIdForRequest,
  isGenericSessionTitle as isGenericTitle,
  isTitleDerivedFromMessage,
  normalizeAssistantMessage,
  normalizeConversationIdValue,
  parseGrayTitleMarkers,
} from "../utils";
import { GENERAL_CHAT_SESSION_ID } from "../constants";
import {
  GENERAL_SESSION_TITLE,
  createEmptyGeneralSession,
  makeMessage,
  normalizeReasoningSecondsMap,
  normalizeSessionsList,
} from "./sessionStore";

type UseSessionActionsOptions = {
  sessionsRef: MutableRefObject<ChatSession[]>;
  setSessions: (updater: SetStateAction<ChatSession[]>) => void;
  persistSessions: (sessions: ChatSession[]) => void;
  generalConversationIdRef: MutableRefObject<string | undefined>;
  pendingHistorySyncRef: MutableRefObject<Set<string>>;
  pendingTitleSyncRef: MutableRefObject<Map<string, string>>;
  queueConversationTitleSync: (sessionId: string, title: string) => void;
  resetAutoStreamState: (sessionId?: string | null) => void;
  userId?: number;
  userEmail?: string;
};

type UseSessionActionsResult = {
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  applyAutoTitle: (
    sessionId: string,
    candidate?: string | null,
    options?: { sync?: boolean }
  ) => void;
  updateMessage: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  updateMessageThrottled: (
    sessionId: string,
    messageId: string,
    partial: Partial<ChatMessage>,
    throttleMs?: number
  ) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  pinSession: (sessionId: string, pinned: boolean) => Promise<void>;
  appendMessage: (
    sessionId: string,
    role: ChatRole,
    content: string,
    tempId?: string,
    metadata?: GroundingMetadata,
    attachments?: MediaUpload[]
  ) => ChatMessage;
  deleteSession: (sessionId: string) => void;
  clearAllConversations: () => void;
  ensureGeneralSession: () => ChatSession;
  getSession: (sessionId: string) => ChatSession | undefined;
  ensureSession: (sessionId: string, initializer: () => ChatSession) => ChatSession;
};

export const useSessionActions = ({
  sessionsRef,
  setSessions,
  persistSessions,
  generalConversationIdRef,
  pendingHistorySyncRef,
  pendingTitleSyncRef,
  queueConversationTitleSync,
  resetAutoStreamState,
  userId,
  userEmail,
}: UseSessionActionsOptions): UseSessionActionsResult => {
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
    (
      sessionId: string,
      candidate?: string | null,
      options?: { sync?: boolean }
    ) => {
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
      if (options?.sync !== false) {
        queueConversationTitleSync(sessionId, rawTitle);
      }
    },
    [queueConversationTitleSync, sessionsRef, updateSession]
  );

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => {
      let assistantAutoTitle: string | null = null;
      setSessions((prev) => {
        let didUpdate = false;
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const messages = session.messages.map((message) => {
            if (message.id !== messageId) {
              return message;
            }
            didUpdate = true;
            let nextPartial = partial;
            if (typeof partial.content === "string" && message.role === "assistant") {
              const parsedContent = parseGrayTitleMarkers(partial.content);
              const normalized = normalizeAssistantMessage(message.role, parsedContent.cleanText);
              nextPartial = {
                ...partial,
                content: normalized.content,
              };
              const incomingReminders =
                Array.isArray(partial.reminders) && partial.reminders.length > 0
                  ? partial.reminders
                  : undefined;
              const parsedReminders =
                normalized.reminders && normalized.reminders.length > 0 ? normalized.reminders : undefined;
              const existingReminders =
                message.reminders && message.reminders.length > 0 ? message.reminders : undefined;
              if (incomingReminders || parsedReminders || existingReminders) {
                nextPartial.reminders = incomingReminders ?? parsedReminders ?? existingReminders;
              }

              if (parsedContent.title) {
                assistantAutoTitle = parsedContent.title;
              }
            }
            return { ...message, ...nextPartial };
          });
          if (!didUpdate) {
            return session;
          }
          return {
            ...session,
            messages,
          };
        });
        if (!didUpdate) {
          return prev;
        }
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      if (assistantAutoTitle) {
        applyAutoTitle(sessionId, assistantAutoTitle);
      }
    },
    [applyAutoTitle, persistSessions, setSessions]
  );

  const pendingUpdatesRef = useRef<Map<string, Partial<ChatMessage>>>(new Map());
  const throttledUpdateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const updateMessageThrottled = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>, throttleMs = 30) => {
      const key = `${sessionId}:${messageId}`;
      pendingUpdatesRef.current.set(key, partial);

      if (throttledUpdateTimeoutsRef.current.has(key)) {
        return;
      }

      const timeout = setTimeout(() => {
        throttledUpdateTimeoutsRef.current.delete(key);
        const latestPartial = pendingUpdatesRef.current.get(key);
        if (latestPartial) {
          updateMessage(sessionId, messageId, latestPartial);
          pendingUpdatesRef.current.delete(key);
        }
      }, throttleMs);

      throttledUpdateTimeoutsRef.current.set(key, timeout);
    },
    [updateMessage]
  );

  useEffect(() => {
    const timeouts = throttledUpdateTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const deleteMessage = useCallback(
    (sessionId: string, messageId: string) => {
      setSessions((prev) => {
        let didUpdate = false;
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const filtered = session.messages.filter((message) => message.id !== messageId);
          if (filtered.length === session.messages.length) {
            return session;
          }
          didUpdate = true;

          let normalizedConversationId = coerceConversationIdForRequest(session.conversationId);
          if (!normalizedConversationId && session.scope === "general") {
            normalizedConversationId = coerceConversationIdForRequest(generalConversationIdRef.current);
          }
          if (normalizedConversationId) {
            pendingHistorySyncRef.current.delete(session.id);
          } else if (session.scope === "thread") {
            pendingHistorySyncRef.current.add(session.id);
          }

          return {
            ...session,
            messages: filtered,
            updatedAt: Date.now(),
          };
        });
        if (!didUpdate) {
          return prev;
        }
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });
    },
    [generalConversationIdRef, persistSessions, pendingHistorySyncRef, setSessions]
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
          await chatService.updateConversation(conversationId, {
            metadata: { is_pinned: pinned },
          });
        } catch (err) {
          console.error("Failed to pin session:", err);
        }
      }
    },
    [sessionsRef, updateSession]
  );

  const appendMessage = useCallback(
    (
      sessionId: string,
      role: ChatRole,
      content: string,
      tempId?: string,
      metadata?: GroundingMetadata,
      attachments?: MediaUpload[]
    ) => {
      let assistantAutoTitle: string | null = null;
      let normalizedContent = content;
      if (role === "assistant") {
        const parsedContent = parseGrayTitleMarkers(content);
        normalizedContent = parsedContent.cleanText;
        assistantAutoTitle = parsedContent.title;
      }

      const createdMessage = makeMessage(role, normalizedContent, tempId, metadata, attachments);

      setSessions((prev) => {
        let didUpdate = false;

        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          didUpdate = true;

          return {
            ...session,
            messages: [...session.messages, createdMessage],
            updatedAt: createdMessage.createdAt,
            isResponding: role === "user",
            title: session.title,
          };
        });

        if (didUpdate) {
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        }

        const fallbackScope = sessionId === GENERAL_CHAT_SESSION_ID ? "general" : "thread";
        const fallbackSession: ChatSession =
          fallbackScope === "general"
            ? {
              ...createEmptyGeneralSession(createdMessage.createdAt, generalConversationIdRef.current),
              messages: [createdMessage],
              updatedAt: createdMessage.createdAt,
              isResponding: role === "user",
              pendingAutoStream: false,
            }
            : {
              id: sessionId,
              title: "New Chat",
              titleMode: "auto",
              createdAt: createdMessage.createdAt,
              updatedAt: createdMessage.createdAt,
              messages: [createdMessage],
              isResponding: role === "user",
              scope: "thread",
              conversationId: undefined,
              pendingAutoStream: false,
            };

        const ordered = normalizeSessionsList([fallbackSession, ...prev]);
        persistSessions(ordered);
        return ordered;
      });

      if (role === "assistant" && assistantAutoTitle) {
        applyAutoTitle(sessionId, assistantAutoTitle);
      }

      return createdMessage;
    },
    [applyAutoTitle, generalConversationIdRef, persistSessions, setSessions]
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
            await chatService.deleteConversation(normalizedConversationId);
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
        localReasoningByMessage: normalizeReasoningSecondsMap(raw.localReasoningByMessage),
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
    updateMessage,
    updateMessageThrottled,
    deleteMessage,
    renameSession,
    pinSession,
    appendMessage,
    deleteSession,
    clearAllConversations,
    ensureGeneralSession,
    getSession,
    ensureSession,
  };
};
