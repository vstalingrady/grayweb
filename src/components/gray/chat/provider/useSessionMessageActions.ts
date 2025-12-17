import { useCallback, useEffect, useRef, type MutableRefObject, type SetStateAction } from "react";

import type { GroundingMetadata, MediaUpload } from "@/lib/api";

import type { ChatMessage, ChatRole, ChatSession, ConversationHistoryEntryPayload } from "../types";
import {
  buildConversationHistoryPayload,
  coerceConversationIdForRequest,
  normalizeAssistantMessage,
  parseGrayTitleMarkers,
} from "../utils";
import { GENERAL_CHAT_SESSION_ID } from "../constants";
import { createEmptyGeneralSession, makeMessage, normalizeSessionsList } from "./sessionStore";

type UseSessionMessageActionsOptions = {
  setSessions: (updater: SetStateAction<ChatSession[]>) => void;
  persistSessions: (sessions: ChatSession[]) => void;
  generalConversationIdRef: MutableRefObject<string | undefined>;
  pendingHistorySyncRef: MutableRefObject<Set<string>>;
  enqueueHistorySync: (conversationId: string, payload: ConversationHistoryEntryPayload[]) => void;
  applyAutoTitle: (sessionId: string, candidate?: string | null) => void;
};

type UseSessionMessageActionsResult = {
  updateMessage: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  updateMessageThrottled: (
    sessionId: string,
    messageId: string,
    partial: Partial<ChatMessage>,
    throttleMs?: number
  ) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  appendMessage: (
    sessionId: string,
    role: ChatRole,
    content: string,
    tempId?: string,
    metadata?: GroundingMetadata,
    attachments?: MediaUpload[]
  ) => ChatMessage;
};

export const useSessionMessageActions = ({
  setSessions,
  persistSessions,
  generalConversationIdRef,
  pendingHistorySyncRef,
  enqueueHistorySync,
  applyAutoTitle,
}: UseSessionMessageActionsOptions): UseSessionMessageActionsResult => {
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
  const throttledUpdateTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
      let historyPayload: ConversationHistoryEntryPayload[] | null = null;
      let conversationIdForSync: string | undefined;

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
          const payload = buildConversationHistoryPayload(filtered);

          if (normalizedConversationId) {
            conversationIdForSync = normalizedConversationId;
            historyPayload = payload;
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

      if (conversationIdForSync && historyPayload) {
        enqueueHistorySync(conversationIdForSync, historyPayload);
      }
    },
    [
      enqueueHistorySync,
      generalConversationIdRef,
      persistSessions,
      pendingHistorySyncRef,
      setSessions,
    ]
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

  return {
    updateMessage,
    updateMessageThrottled,
    deleteMessage,
    appendMessage,
  };
};

