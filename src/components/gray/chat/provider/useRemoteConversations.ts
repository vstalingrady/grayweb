import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { apiService, type ConversationSummary } from "@/lib/api";
import { REMOTE_SESSION_MERGE_WINDOW_MS, SHARED_CHAT_PLACEHOLDER_TITLE } from "../constants";
import type { ChatSession } from "../types";
import { isGeneralConversationId, isGenericSessionTitle, normalizeConversationIdValue, toTimestamp } from "../utils";
import { normalizeSessionsList } from "./sessionStore";

type SetSessions = (updater: SetStateAction<ChatSession[]>) => void;

type UseRemoteConversationsOptions = {
  userId?: number;
  setSessions: SetSessions;
  persistSessions: (sessions: ChatSession[]) => void;
};

type UseRemoteConversationsResult = {
  remoteConversationsLoaded: boolean;
  setRemoteConversationsLoaded: (value: boolean) => void;
};

export const useRemoteConversations = ({
  userId,
  setSessions,
  persistSessions,
}: UseRemoteConversationsOptions): UseRemoteConversationsResult => {
  const [remoteConversationsLoaded, setRemoteConversationsLoaded] = useState(false);

  const mergeRemoteConversations = useCallback(
    (conversations: ConversationSummary[]) => {
      if (!Array.isArray(conversations) || conversations.length === 0) {
        return;
      }

      const shouldAdoptRemoteTitle = (currentTitle: string | null | undefined, remoteTitle: string) => {
        if (!remoteTitle || !remoteTitle.trim()) {
          return false;
        }
        const normalizedRemote = remoteTitle.trim();
        const normalizedCurrent = (currentTitle ?? "").trim();
        if (!normalizedCurrent) {
          return true;
        }
        if (normalizedCurrent.toLowerCase() === normalizedRemote.toLowerCase()) {
          return false;
        }
        if (normalizedCurrent.toLowerCase() === SHARED_CHAT_PLACEHOLDER_TITLE.toLowerCase()) {
          return true;
        }
        return isGenericSessionTitle(normalizedCurrent);
      };
      setSessions((prev) => {
        let changed = false;
        const next = [...prev];
        const indexById = new Map(next.map((session, index) => [session.id, index]));
        const indexByConversationId = new Map(
          next
            .map((session, index) => [normalizeConversationIdValue(session.conversationId), index] as const)
            .filter(([conversationId]) => typeof conversationId === "string")
        );

        const findExistingIndex = (conversationId: string): number | undefined => {
          if (indexById.has(conversationId)) {
            return indexById.get(conversationId);
          }
          if (indexByConversationId.has(conversationId)) {
            return indexByConversationId.get(conversationId);
          }
          return undefined;
        };

        const findPendingSessionMatch = (targetTimestamp: number): number | undefined => {
          let bestIndex: number | undefined;
          let smallestDiff = REMOTE_SESSION_MERGE_WINDOW_MS + 1;
          next.forEach((session, index) => {
            if (session.scope !== "thread" || session.conversationId) {
              return;
            }
            if (!session.messages.length) {
              return;
            }
            const first = session.messages[0];
            if (!first || first.role !== "user" || !first.content.trim()) {
              return;
            }
            const diff = Math.abs(session.createdAt - targetTimestamp);
            if (diff > REMOTE_SESSION_MERGE_WINDOW_MS || diff >= smallestDiff) {
              return;
            }
            smallestDiff = diff;
            bestIndex = index;
          });
          return bestIndex;
        };

        conversations.forEach((record) => {
          const conversationId = normalizeConversationIdValue(record.id);
          if (!conversationId) {
            return;
          }
          // Skip general conversations - they should not appear as separate threads in the sidebar
          if (isGeneralConversationId(conversationId)) {
            return;
          }
          const normalizedTitle =
            record.title?.trim() && record.title.trim().length > 0 ? record.title.trim() : "New Chat";
          const createdAt = toTimestamp(record.created_at);
          const updatedAt = toTimestamp(record.updated_at ?? record.created_at);
          const existingIndex = findExistingIndex(conversationId);

          if (typeof existingIndex === "number") {
            const current = next[existingIndex];
            const adoptRemoteTitle = shouldAdoptRemoteTitle(current.title, normalizedTitle);
            const merged: ChatSession = {
              ...current,
              createdAt: Math.min(current.createdAt, createdAt),
              updatedAt: Math.max(current.updatedAt, updatedAt),
              conversationId,
              ...(adoptRemoteTitle
                ? {
                  title: normalizedTitle,
                  titleMode: isGenericSessionTitle(normalizedTitle) ? "auto" : "manual",
                }
                : {}),
            };
            if (
              merged.title !== current.title ||
              merged.updatedAt !== current.updatedAt ||
              merged.conversationId !== current.conversationId ||
              merged.createdAt !== current.createdAt
            ) {
              next[existingIndex] = merged;
              changed = true;
            }
            return;
          }

          const pendingIndex = findPendingSessionMatch(createdAt);
          if (typeof pendingIndex === "number") {
            const pending = next[pendingIndex];
            const adoptRemoteTitle = shouldAdoptRemoteTitle(pending.title, normalizedTitle);
            const merged: ChatSession = {
              ...pending,
              createdAt: Math.min(pending.createdAt, createdAt),
              updatedAt: Math.max(pending.updatedAt, updatedAt),
              conversationId,
              pendingAutoStream: false,
              ...(adoptRemoteTitle
                ? {
                  title: normalizedTitle,
                  titleMode: isGenericSessionTitle(normalizedTitle) ? "auto" : "manual",
                }
                : {}),
            };
            next[pendingIndex] = merged;
            indexByConversationId.set(conversationId, pendingIndex);
            changed = true;
            return;
          }

          const newSession: ChatSession = {
            id: conversationId,
            title: normalizedTitle,
            titleMode: isGenericSessionTitle(normalizedTitle) ? "auto" : "manual",
            createdAt,
            updatedAt,
            messages: [],
            isResponding: false,
            scope: "thread",
            conversationId,
            pendingAutoStream: false,
          };
          next.push(newSession);
          indexById.set(conversationId, next.length - 1);
          indexByConversationId.set(conversationId, next.length - 1);
          changed = true;
        });

        if (!changed) {
          return prev;
        }

        const deduped: ChatSession[] = [];
        const seenConversationIds = new Map<string, number>();

        next.forEach((session) => {
          const conversationId = normalizeConversationIdValue(session.conversationId);
          if (!conversationId) {
            deduped.push(session);
            return;
          }
          const existingIndex = seenConversationIds.get(conversationId);
          if (typeof existingIndex === "number") {
            const existing = deduped[existingIndex];
            const currentScore = session.messages.length;
            const existingScore = existing.messages.length;
            const shouldReplace =
              currentScore > existingScore ||
              (currentScore === existingScore && session.updatedAt > existing.updatedAt);
            if (shouldReplace) {
              deduped[existingIndex] = session;
            }
            changed = true;
            return;
          }
          seenConversationIds.set(conversationId, deduped.length);
          deduped.push(session);
        });

        const ordered = normalizeSessionsList(deduped);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions, setSessions]
  );

  useEffect(() => {
    setRemoteConversationsLoaded(false);
    if (!userId) {
      setRemoteConversationsLoaded(true);
      return;
    }
    let cancelled = false;
    const loadRemoteConversations = async () => {
      try {
        const records = await apiService.listUserConversations(userId, 200);
        if (cancelled || !records) {
          return;
        }
        mergeRemoteConversations(records);
      } catch (error) {
        console.error("Failed to load remote conversations:", error);
      } finally {
        if (!cancelled) {
          setRemoteConversationsLoaded(true);
        }
      }
    };
    void loadRemoteConversations();
    return () => {
      cancelled = true;
      setRemoteConversationsLoaded(false);
    };
  }, [mergeRemoteConversations, userId]);

  return { remoteConversationsLoaded, setRemoteConversationsLoaded };
};

