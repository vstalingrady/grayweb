"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import {
  apiService,
  type GroundingMetadata,
  type MediaUpload,
} from "@/lib/api";
import { buildLocalTimeContextWithOverrides } from "@/lib/timeContext";

import {
  ChatRole,
  ChatMessage,
  ChatSession,
  ChatSessionScope,
  ChatTitleMode,
  ChatContextValue,
  GrayReminderCreatedPayload,
  ConversationHistoryEntryPayload,
} from "./chat/types";
import {
  buildGeneralConversationId,
  buildPersonalizedSystemPrompt,
  computeProfileHash,
  buildAssistantReply,
  buildAssistantErrorReply,
  normalizeAssistantContent,
  normalizeAssistantMessage,
  shouldIncludeWorkspaceContext,
  resolveClientTimezone,
  buildSessionStorageKeyCandidates,
  shouldRequestAutoTitleForSession,
  normalizeConversationIdValue,
  isGenericSessionTitle as isGenericTitle,
  parseGrayTitleMarkers,
  coerceConversationIdForRequest,
  buildConversationHistoryPayload,
  isTitleDerivedFromMessage,
} from "./chat/utils";
import { extractGrayRemindersFromText, buildReminderConfirmationText, coerceReminderPayload } from "./chat/reminderUtils";
import {
  GENERAL_CHAT_SESSION_ID,
  SELF_CONTEXT_PATTERNS,
  DUPLICATE_THREAD_WINDOW_MS,
} from "./chat/constants";
import { useDefaultSystemPrompt } from "./chat/provider/useDefaultSystemPrompt";
import { useAutoStreamState } from "./chat/provider/useAutoStreamState";
import { useAttachments } from "./chat/provider/useAttachments";
import { useConversationSync } from "./chat/provider/useConversationSync";
import { useConversationHistory } from "./chat/provider/useConversationHistory";
import { useMapsSettings } from "./chat/provider/useMapsSettings";
import { useModelPreferences } from "./chat/provider/useModelPreferences";
import { usePersistAiCreatedReminders } from "./chat/provider/usePersistAiCreatedReminders";
import { useQuestionnaire } from "./chat/provider/useQuestionnaire";
import { useRemoteConversations } from "./chat/provider/useRemoteConversations";
import { useReminderPolling } from "./chat/provider/useReminderPolling";
import { useRemindersEnabled } from "./chat/provider/useRemindersEnabled";
import { useSessionStorage } from "./chat/provider/useSessionStorage";
import {
  GENERAL_SESSION_TITLE,
  createEmptyGeneralSession,
  makeMessage,
  normalizeSessionsList,
} from "./chat/provider/sessionStore";

const WORKSPACE_CONTEXT_COOLDOWN_MS = 600000; // 10 minutes
const CONVERSATION_MEMORY_STORAGE_PREFIX = "gray_conversation_memory";

declare global {
  interface Window {
    endSearchTracking?: () => void;
  }
}

const endSearchTracking = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.endSearchTracking?.();
};

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const { user, waitForUser, updateUser, refreshUser } = useUser();
  const { locale } = useI18n();
  const defaultSystemPrompt = useDefaultSystemPrompt(locale);
  const onboardingSeenRef = useRef(false);

  // Sync selected model from user profile on load
  useEffect(() => {
    if (user?.preferred_model) {
      setSelectedModelId(user.preferred_model);
    }
  }, [user]);

  const handleSetSelectedModelId = useCallback(
    (id: string | null) => {
      setSelectedModelId(id);
      if (user && id) {
        // Persist preference to backend
        void apiService.updateUser(user.id, { preferred_model: id }).catch((err) => {
          console.error("Failed to persist model preference:", err);
        });
      }
    },
    [user]
  );

  const personalizedSystemPrompt = useMemo(
    () => buildPersonalizedSystemPrompt(user, defaultSystemPrompt),
    [user, defaultSystemPrompt]
  );

  // Persist "has seen" state from user profile to local ref to prevent re-showing
  useEffect(() => {
    if (user?.has_seen_general_chat) {
      onboardingSeenRef.current = true;
    }
  }, [user?.has_seen_general_chat, user?.id, user]);

  const markHasSeenGeneralChat = useCallback(async () => {
    if (!user || onboardingSeenRef.current || user.has_seen_general_chat) {
      onboardingSeenRef.current = onboardingSeenRef.current || Boolean(user?.has_seen_general_chat);
      return;
    }

    onboardingSeenRef.current = true;
    try {
      await updateUser({ has_seen_general_chat: true });
    } catch (error) {
      console.error("Failed to mark general chat as seen:", error);
    }
  }, [updateUser, user]);

  const [sessionsState, setSessionsState] = useState<ChatSession[]>(() => [createEmptyGeneralSession()]);
  const sessionsRef = useRef<ChatSession[]>(sessionsState);
  const setSessions = useCallback(
    (updater: SetStateAction<ChatSession[]>) => {
      setSessionsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (value: ChatSession[]) => ChatSession[])(prev)
            : updater;
        sessionsRef.current = next;
        return next;
      });
    },
    []
  );
  const generalConversationId = useMemo(
    () => buildGeneralConversationId(user?.id),
    [user?.id]
  );
  const generalConversationIdRef = useRef<string | undefined>(generalConversationId);
  useEffect(() => {
    generalConversationIdRef.current = generalConversationId;
  }, [generalConversationId]);

  const sessions = sessionsState;
  const {
    pendingHistorySyncRef,
    pendingTitleSyncRef,
    queueConversationTitleSync,
    enqueueHistorySync,
  } = useConversationSync({ sessions, sessionsRef, userId: user?.id });
  const pendingThreadSeedsRef = useRef<Map<string, { sessionId: string; createdAt: number }>>(
    new Map()
  );
  const [workspaceContextValue, setWorkspaceContextValue] = useState<string | null>(
    workspaceContext ?? null
  );
  const workspaceContextUsageRef = useRef<Map<string, number>>(new Map());
  const {
    mapsEnabled,
    mapsWidgetEnabled,
    mapsLatitude,
    mapsLongitude,
    setMapsEnabled,
    setMapsWidgetEnabled,
    setMapsLatitude,
    setMapsLongitude,
    mapPayload,
    toggleMapsEnabled,
  } = useMapsSettings(user);

  const toggleWebSearchEnabled = useCallback(() => {
    setWebSearchEnabled((prev) => !prev);
  }, []);
  const { remindersEnabled, toggleRemindersEnabled } = useRemindersEnabled(
    user?.id
  );

  const [autoWebSearchEnabled, setAutoWebSearchEnabledState] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [modelTier, setModelTier] = useState<"lite" | "pro" | "pioneer">("lite");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [visibleModelIds, setVisibleModelIds] = useState<string[] | null>(null);
  // Track profile hash to only send full profile when it changes
  const lastSentProfileHashRef = useRef<string>("");
  // Track when reasoning mode starts to calculate reasoning duration
  const reasoningStartTimeRef = useRef<number | null>(null);
  useModelPreferences({
    user,
    updateUser,
    modelTier,
    setModelTier,
    selectedModelId,
    setSelectedModelId,
    reasoningMode,
    setReasoningMode,
    visibleModelIds,
    setVisibleModelIds,
  });

  const [questionnaireSession, setQuestionnaireSession] = useState<QuestionnaireSession | null>(null);

  // Persist automatic web search preference per user (falls back to session memory for anon users).
  useEffect(() => {
    if (typeof user?.auto_web_search_enabled === "boolean") {
      setAutoWebSearchEnabledState(user.auto_web_search_enabled);
    }
  }, [user?.auto_web_search_enabled]);

  const setAutoWebSearchEnabled = useCallback(
    (value: boolean) => {
      setAutoWebSearchEnabledState(value);
      if (!user) {
        return;
      }
      void updateUser({ auto_web_search_enabled: value }).catch((error) => {
        console.error("Failed to persist automatic web search preference:", error);
      });
    },
    [updateUser, user]
  );

  useEffect(() => {
    workspaceContextUsageRef.current.clear();
  }, [workspaceContextValue]);

  const shouldAttachWorkspaceContextForSession = useCallback(
    (sessionId: string, message: string) => {
      if (!workspaceContextValue) {
        return false;
      }
      const wantsContext = shouldIncludeWorkspaceContext(message, workspaceContextValue);
      if (!wantsContext) {
        return false;
      }
      const normalized = message.trim().toLowerCase();
      const forceContext = SELF_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized));
      const lastUsed = workspaceContextUsageRef.current.get(sessionId);
      const now = Date.now();
      if (!forceContext && typeof lastUsed === "number" && now - lastUsed < WORKSPACE_CONTEXT_COOLDOWN_MS) {
        return false;
      }
      workspaceContextUsageRef.current.set(sessionId, now);
      return true;
    },
    [workspaceContextValue]
  );

  const { markAutoStreamTriggered, hasAutoStreamTriggered, resetAutoStreamState } =
    useAutoStreamState();

  // DISABLED: This sync effect was causing data loss by overwriting backend
  // history with stale/incomplete local state on page reload. The backend
  // should be the authoritative source of truth. Message deletions should be
  // synced via explicit API calls from the delete handler, not via full
  // history overwrites on every session change.
  //
  // Original purpose: Sync local edits (including deletions) to backend.
  // Problem: Local state could be stale/incomplete, overwriting valid backend data.
  // Fix: Only sync on explicit user actions (delete, edit), not on session changes.
  const syncedHistoryRef = useRef<Set<string>>(new Set());
  const resolveChatUser = useCallback(async () => {
    if (user) {
      return user;
    }
    return waitForUser();
  }, [user, waitForUser]);

  const {
    selectedAttachments,
    attachmentsRef,
    isAttachmentUploading,
    attachmentError,
    uploadAttachments,
    removeAttachment,
    clearAttachments,
  } = useAttachments({ resolveChatUser });

  const schedulePendingSeedCleanup = useCallback((seed: string, sessionId: string) => {
    if (!seed) {
      return;
    }
    const existing = pendingThreadSeedsRef.current.get(seed);
    if (!existing || existing.sessionId !== sessionId) {
      pendingThreadSeedsRef.current.set(seed, { sessionId, createdAt: Date.now() });
    }
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      const pending = pendingThreadSeedsRef.current.get(seed);
      if (pending?.sessionId === sessionId) {
        pendingThreadSeedsRef.current.delete(seed);
      }
    }, DUPLICATE_THREAD_WINDOW_MS);
  }, []);

  useEffect(() => {
    if (workspaceContext !== undefined) {
      setWorkspaceContextValue(workspaceContext ?? null);
    }
  }, [workspaceContext]);

  const { persistSessions } = useSessionStorage({
    sessions,
    userId: user?.id,
    userEmail: user?.email,
    generalConversationId,
    setSessions,
  });

  const { remoteConversationsLoaded } = useRemoteConversations({
    userId: user?.id,
    setSessions,
    persistSessions,
  });

  const updateSession = useCallback(
    (sessionId: string, partial: Partial<ChatSession>) => {
      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const normalizedPartial: Partial<ChatSession> = { ...partial };
          if ("conversationId" in partial) {
            // Preserve special General conversation identifiers (`general:{userId}`)
            // while still normalizing regular thread UUIDs.
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
      // Only replace placeholder / generic titles so we don't fight manual titles
      // or backend-generated titles that are already set.
      // Use isGenericTitle (same check as shouldRequestAutoTitleForSession) to allow
      // replacing fallback titles derived from user messages.
      if (!isGenericTitle(session.title) && !isTitleDerivedFromMessage(session.title, session.messages)) {
        return;
      }
      if (session.title?.trim() === rawTitle) {
        return;
      }
      updateSession(sessionId, { title: rawTitle, titleMode: "auto", isGeneratingTitle: false });
      queueConversationTitleSync(sessionId, rawTitle);
    },
    [queueConversationTitleSync, updateSession]
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
              // Prefer explicit reminder payloads passed in the update, then any parsed from the content,
              // then fall back to previously stored reminders to avoid losing the card mid-stream.
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

  // Throttled version of updateMessage for streaming (ensures updates every ~30ms)
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

  // Cleanup timeouts on unmount
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
      // Prevent auto-stream from firing while we're deleting to avoid extra AI responses.

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

          // For general sessions, try session.conversationId first, then fall back to generalConversationIdRef
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
    [enqueueHistorySync, persistSessions, pendingHistorySyncRef, setSessions]
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
    [queueConversationTitleSync, updateSession]
  );

  const pinSession = useCallback(
    async (sessionId: string, pinned: boolean) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;

      // 1. Update local state
      const currentMeta = session.metadata || {};
      updateSession(sessionId, {
        metadata: { ...currentMeta, is_pinned: pinned },
        updatedAt: Date.now(),
      });

      // 2. Persist to backend if associated with a conversation ID
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
    [updateSession]
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

      // Create the message immediately instead of inside setState
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
    [applyAutoTitle, persistSessions, setSessions]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      // Skip general sessions
      if (target?.scope === "general") {
        return;
      }

      // For local sessions, do optimistic UI removal
      if (target) {
        // Clear any pending auto-stream for this session so deletion never triggers regeneration.
        resetAutoStreamState(sessionId);

        // Optimistically remove locally so it disappears from history & context immediately.
        setSessions((prev) => {
          const next = prev.filter((session) => session.id !== sessionId);
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
      }

      // Best-effort server-side delete so the conversation is removed from backend context too.
      // Use target.conversationId if available, otherwise fallback to sessionId for old chats.
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
    [persistSessions, resetAutoStreamState, setSessions]
  );

  const clearAllConversations = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const keys = buildSessionStorageKeyCandidates(user?.id, user?.email);
        keys.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // ignore storage failures
      }
    }

    resetAutoStreamState();
    pendingTitleSyncRef.current = new Map();
    pendingThreadSeedsRef.current = new Map();

    setSessions(() => {
      const emptyGeneral = createEmptyGeneralSession(undefined, generalConversationIdRef.current);
      const ordered = normalizeSessionsList([emptyGeneral]);
      persistSessions(ordered);
      return ordered;
    });
  }, [persistSessions, pendingTitleSyncRef, resetAutoStreamState, setSessions, user?.email, user?.id]);

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
  }, [persistSessions, setSessions]);

  // Ref to break forward reference to sendGeneralMessage (defined later)
  // This avoids a Temporal Dead Zone error in the bundled output.
  const sendGeneralMessageRef = useRef<(content: string) => Promise<string>>(() => Promise.resolve(""));

  const createThreadSession = useCallback(
    async (
      initialMessage?: string,
      options?: {
        autoStream?: boolean;
        fromGeneral?: boolean;
      }
    ): Promise<ChatSession> => {
      // If this invocation is coming from the General entrypoint, do not create
      // a new thread session. Reuse the General session instead so that messages
      // sent from "General" always belong to the General conversation.
      if (options?.fromGeneral) {
        // console.log("[ChatProvider] createThreadSession: fromGeneral=true, returning general session");
        const general = ensureGeneralSession();
        // If there's an initial message, send it via the general path so it
        // streams correctly and binds to the existing conversation_id.
        if ((initialMessage ?? "").trim().length > 0) {
          void sendGeneralMessageRef.current(initialMessage ?? "");
        }
        return general;
      }

      const now = Date.now();
      const trimmedInitial = (initialMessage ?? "").trim();
      const normalizedInitial = trimmedInitial.toLowerCase();
      const shouldAutoStream = options?.autoStream !== false;
      // Duplicate detection removed to ensure fresh sessions


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
        // Let ChatView handle turning on isResponding when it actually
        // starts the stream, so we don't double-stream the first reply.
        isResponding: false,
        scope: "thread",
        conversationId: sessionId,
        pendingAutoStream: willAutoStream,
        // Show skeleton while title generates in background
        isGeneratingTitle: willAutoStream,
      };

      // console.log("[ChatProvider] createThreadSession: Created new session", { sessionId, willAutoStream });

      if (normalizedInitial) {
        pendingThreadSeedsRef.current.set(normalizedInitial, { sessionId, createdAt: now });
        schedulePendingSeedCleanup(normalizedInitial, sessionId);
      }

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
    [
      persistSessions,
      queueConversationTitleSync,
      schedulePendingSeedCleanup,
      setSessions,
      ensureGeneralSession,
    ]
  );

  const startQuestionnaire = useCallback((mode: "quick" | "deep") => {
    void mode;
    // Premade questionnaire messaging has been retired; keep state reset.
    setQuestionnaireSession(null);
  }, []);

  const cancelQuestionnaire = useCallback(() => {
    setQuestionnaireSession(null);
  }, []);

  const handleQuestionnaireResponse = useCallback(
    async (content: string, session: QuestionnaireSession) => {
      const generalSession = ensureGeneralSession();
      const trimmed = content.trim();

      // 1. Append user message
      appendMessage(generalSession.id, "user", trimmed);
      updateSession(generalSession.id, { isResponding: true });

      // 2. Process response
      // For now, we just move to the next question in the quick list
      // In a real implementation, we would use the Python logic (evaluateSmartGoal, etc.)
      // and potentially call the LLM for "deep" mode.

      const nextSession = { ...session };
      let responseText = "";

      if (session.phase === "foundation") {
        const currentQ = session.quickQuestions[session.step];
        if (currentQ) {
          nextSession.foundationAnswers[currentQ.key] = trimmed;
          nextSession.step += 1;
        }

        const nextQ = session.quickQuestions[nextSession.step];
        if (nextQ) {
          responseText = nextQ.prompt;
          if (nextQ.clarification) {
            responseText += `\n\n_${nextQ.clarification}_`;
          }
        } else {
          // End of foundation
          nextSession.phase = "personalized"; // or 'complete'
          responseText = "Thanks! I've got the basics. I've updated your profile with this information.";

          // Synthesize and save profile
          const answers = nextSession.foundationAnswers;
          const aboutParts: string[] = [];
          if (answers.goals) aboutParts.push(`Goals: ${answers.goals}`);
          if (answers.wins) aboutParts.push(`Wins: ${answers.wins}`);
          if (answers.obstacles) aboutParts.push(`Obstacles: ${answers.obstacles}`);

          const updatePayload = {
            personalization_nickname: answers.name || null,
            personalization_occupation: answers.focus || null,
            personalization_about: aboutParts.length > 0 ? aboutParts.join('\n\n') : null,
            // NOTE: Do NOT save custom_instructions from onboarding - this should only be set
            // manually by the user in Settings. The AI should not auto-generate response guidelines.
            has_seen_general_chat: true, // Mark as seen so we don't trigger again
          };

          // Fire and forget update, or await if we want to be sure
          void updateUser(updatePayload).catch(err => console.error("Failed to save questionnaire profile:", err));

          setQuestionnaireSession(null); // End it for now
        }
      }

      if (responseText) {
        setTimeout(() => {
          appendMessage(generalSession.id, "assistant", responseText);
          updateSession(generalSession.id, { isResponding: false });
        }, 500);
      } else {
        updateSession(generalSession.id, { isResponding: false });
      }

      if (nextSession.phase !== "personalized") { // If not finished
        setQuestionnaireSession(nextSession);
      }
    },
    [appendMessage, ensureGeneralSession, updateSession, updateUser]
  );

  const sendGeneralMessage = useCallback(
    async (content: string): Promise<string> => {
      // Check if questionnaire is active
      if (questionnaireSession) {
        await handleQuestionnaireResponse(content, questionnaireSession);
        return ensureGeneralSession().id;
      }


      const trimmed = content.trim();
      const generalSession = ensureGeneralSession();

      if (!trimmed) {
        return generalSession.id;
      }
      const isGeneralScope = generalSession.scope === "general";
      const resolvedGeneralConversationId =
        coerceConversationIdForRequest(generalSession.conversationId) ??
        coerceConversationIdForRequest(generalConversationIdRef.current);
      let requestConversationId = resolvedGeneralConversationId;

      const attachmentPayloads = attachmentsRef.current.map((attachment) => ({
        id: attachment.id,
      }));

      // Create a temp message ID to prevent duplicate auto-streaming
      const tempUserMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

      // Mark this message as already triggered for auto-streaming BEFORE appending
      // This prevents the auto-stream effect from racing with our own streaming
      markAutoStreamTriggered(generalSession.id, tempUserMessageId);

      // 1) Optimistically append user message immediately with the temp ID
      appendMessage(
        generalSession.id,
        "user",
        trimmed,
        tempUserMessageId,
        undefined,
        attachmentsRef.current.length > 0 ? [...attachmentsRef.current] : undefined
      );
      clearAttachments();
      // 2) Immediately insert an empty assistant message so UI shows instant response start.
      let assistantMessageId: string | null = null;
      const initialAssistant = appendMessage(generalSession.id, "assistant", "");
      assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;

      updateSession(generalSession.id, {
        isResponding: true,
        updatedAt: Date.now(),
      });

      // 3) Wait for the authenticated user so the first streamed reply connects properly.
      const resolvedUser = await resolveChatUser();
      if (resolvedUser && !requestConversationId) {
        requestConversationId = buildGeneralConversationId(resolvedUser.id);
      }

      if (!resolvedUser) {
        const fallback = buildAssistantReply(trimmed);
        if (assistantMessageId) {
          updateMessage(generalSession.id, assistantMessageId, { content: fallback });
        } else {
          appendMessage(generalSession.id, "assistant", fallback);
        }
        updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
        return generalSession.id;
      }

      let streamedConversationId: string | null = requestConversationId ?? null;

      const includeWorkspaceContext = shouldAttachWorkspaceContextForSession(
        generalSession.id,
        trimmed
      );
      const contextPayload = includeWorkspaceContext ? workspaceContextValue ?? undefined : undefined;
      const shouldUseWebSearch = autoWebSearchEnabled || webSearchEnabled;

      const streamGeneralResponse = () => {
        (async () => {
          let accumulated = "";
          let capturedReminders: unknown[] = [];
          let didReceiveToken = false;
          const streamingUserId = resolvedUser.id;
          try {
            const effectiveTimeZone =
              resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone();
            const timeContext = buildLocalTimeContextWithOverrides(undefined, {
              timeZone: effectiveTimeZone,
            });
            // const autoMapPayload = buildAutoMapPayload(trimmed); // Removed

            // Only include full profile when it changes or on first message
            const currentProfileHash = computeProfileHash(resolvedUser);
            const isFirstMessage = generalSession.messages.length <= 1;
            const profileChanged = currentProfileHash !== lastSentProfileHashRef.current;
            const shouldIncludeFullProfile = isFirstMessage || profileChanged;

            const systemPromptForRequest = buildPersonalizedSystemPrompt(
              resolvedUser,
              defaultSystemPrompt,
              shouldIncludeFullProfile
            );

            // Update the ref so subsequent messages know the profile was sent
            if (shouldIncludeFullProfile) {
              lastSentProfileHashRef.current = currentProfileHash;
            }

            // Start tracking reasoning time if reasoning mode is enabled
            if (reasoningMode) {
              reasoningStartTimeRef.current = Date.now();
            }

            const shouldGenerateTitle = shouldRequestAutoTitleForSession(generalSession);
            if (shouldGenerateTitle) {
              updateSession(generalSession.id, { isGeneratingTitle: true });
            }

            const conversationMemoryEnabled = (() => {
              if (typeof resolvedUser.conversation_memory_enabled === "boolean") {
                return resolvedUser.conversation_memory_enabled;
              }
              if (typeof window === "undefined") {
                return true;
              }
              const storageKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${streamingUserId ?? "anon"}`;
              try {
                return window.localStorage.getItem(storageKey) !== "0";
              } catch {
                return true;
              }
            })();

            for await (const event of apiService.sendMessageStream({
              message: trimmed,
              system_prompt: systemPromptForRequest,
              user_id: streamingUserId,
              context: contextPayload,
              conversation_id: requestConversationId ?? undefined,
              time_context: timeContext,
              timezone: effectiveTimeZone,
              conversation_memory_enabled: conversationMemoryEnabled,
              attachments: attachmentPayloads,
              should_generate_title: shouldGenerateTitle,
              web_search_enabled: shouldUseWebSearch,
              ...mapPayload,
              reasoning_mode: reasoningMode,
              reminders_enabled: remindersEnabled,
              model: selectedModelId ?? modelTier,
            })) {
              if (event.type === "token") {
                const delta = event.delta;
                accumulated = accumulated && delta.startsWith(accumulated)
                  ? delta
                  : accumulated + delta;
                const extraction = extractGrayRemindersFromText(accumulated);
                if (assistantMessageId) {
                  const updates: Partial<ChatMessage> = { content: extraction.cleanText };
                  // Persist reasoning duration on first token update
                  if (!didReceiveToken && reasoningStartTimeRef.current) {
                    const elapsed = (Date.now() - reasoningStartTimeRef.current) / 1000;
                    // setReasoningSeconds(elapsed); // This line is likely for a local state, not directly in message update
                    reasoningStartTimeRef.current = null; // Clear it after first token
                    updates.reasoningSeconds = elapsed;
                    didReceiveToken = true;
                  }
                  updateMessageThrottled(generalSession.id, assistantMessageId, updates);
                }
                continue;
              }

              if (event.type === "reminders") {
                // Capture structured reminders sent via SSE
                if (Array.isArray(event.reminders) && event.reminders.length > 0) {
                  capturedReminders = event.reminders;
                }
                continue;
              }

              if (event.type === "end") {
                streamedConversationId =
                  coerceConversationIdForRequest(event.conversationId) ?? streamedConversationId;
                const finalResponse = normalizeAssistantContent(event.response ?? accumulated, trimmed);
                const content = finalResponse;
                const metadata = event.groundingMetadata ?? undefined;
                const timingUpdate = event.timing ? { backendTimings: event.timing } : undefined;

                // Process reminders: prefer SSE-sent reminders, fallback to text extraction
                let finalReminders: GrayReminderCreatedPayload[] | undefined;
                if (capturedReminders.length > 0) {
                  // Use structured reminders sent via SSE; coerce legacy shapes too.
                  finalReminders = capturedReminders
                    .map((r) => coerceReminderPayload(r))
                    .filter((r): r is GrayReminderCreatedPayload => Boolean(r));
                } else {
                  // Fallback: extract reminders from text (backward compatibility)
                  const extracted = extractGrayRemindersFromText(content);
                  if (extracted.reminders.length > 0) {
                    finalReminders = extracted.reminders;
                  }
                }

                // If we have reminders but no text, generate a friendly confirmation message
                let finalContent = content;
                if (finalReminders && finalReminders.length > 0 && !content.trim()) {
                  const confirmationText = buildReminderConfirmationText(finalReminders);
                  if (confirmationText) {
                    finalContent = confirmationText;
                  }
                }

                const finalMessageUpdates: Partial<ChatMessage> = {
                  content: finalContent,
                  groundingMetadata: metadata,
                  reminders: finalReminders,
                  ...(timingUpdate ?? {}),
                };

                // If reasoningSeconds was not set on first token (e.g., very fast response), set it now
                if (!didReceiveToken && reasoningStartTimeRef.current) {
                  const elapsed = (Date.now() - reasoningStartTimeRef.current) / 1000;
                  finalMessageUpdates.reasoningSeconds = elapsed;
                }

                if (assistantMessageId) {
                  updateMessage(generalSession.id, assistantMessageId, finalMessageUpdates);
                } else {
                  const assistantMessage = appendMessage(
                    generalSession.id,
                    "assistant",
                    content,
                    undefined,
                    metadata
                  );
                  assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
                  if (assistantMessageId && timingUpdate) {
                    updateMessage(generalSession.id, assistantMessageId, timingUpdate);
                  }
                }

                updateSession(generalSession.id, {
                  conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
                  isResponding: false,
                  pendingAutoStream: false,
                  isGeneratingTitle: false,
                });
                void markHasSeenGeneralChat();
                clearAttachments();
                if (!isGeneralScope && event.title) {
                  applyAutoTitle(generalSession.id, event.title);
                }
                return generalSession.id;
              }

              if (event.type === "error") {
                throw new Error(event.message);
              }
            }

            const finalFallback = normalizeAssistantContent(accumulated, trimmed);
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content: finalFallback });
            } else {
              const assistantMessage = appendMessage(generalSession.id, "assistant", finalFallback);
              assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
            }
            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
              isGeneratingTitle: false,
            });
          } catch (error) {
            console.error("Failed to send general message:", error);
            const fallback = buildAssistantErrorReply(error);
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content: fallback });
            } else {
              appendMessage(generalSession.id, "assistant", fallback);
            }
            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
              isGeneratingTitle: false,
            });
            clearAttachments();
          } finally {
            endSearchTracking();
            void markHasSeenGeneralChat();
            // Keep the local user profile in sync with any onboarding/profile tools
            // that may have run during this message (e.g., complete_onboarding).
            void refreshUser();
            // Safety net: ensure isResponding is always reset
            updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
          }
          clearAttachments();
        })();
      };

      streamGeneralResponse();
      return generalSession.id;
    },
    [
      appendMessage,
      attachmentsRef,
      ensureGeneralSession,
      updateMessage,
      updateMessageThrottled,
      updateSession,
      resolveChatUser,
      workspaceContextValue,
      applyAutoTitle,
      clearAttachments,
      mapPayload, // Replaced buildAutoMapPayload
      shouldAttachWorkspaceContextForSession,
      autoWebSearchEnabled,
      webSearchEnabled,
      reasoningMode, // Added
      remindersEnabled, // Added
      markHasSeenGeneralChat,
      refreshUser,
      markAutoStreamTriggered,
      modelTier,
      selectedModelId,
      defaultSystemPrompt,
      questionnaireSession,
      handleQuestionnaireResponse,
    ]
  );

  // Keep the ref in sync with the actual sendGeneralMessage function
  useEffect(() => {
    sendGeneralMessageRef.current = sendGeneralMessage;
  }, [sendGeneralMessage]);

  const getSession = useCallback((sessionId: string) => {
    return sessionsRef.current.find((session) => session.id === sessionId);
  }, []);

  const ensureSession = useCallback(
    (sessionId: string, initializer: () => ChatSession): ChatSession => {
      const existing = sessionsRef.current.find((session) => session.id === sessionId);
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const raw = initializer() ?? ({} as ChatSession);
      const normalizedScope: ChatSessionScope =
        raw.scope === "general" ? "general" : "thread";
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
    [persistSessions, setSessions]
  );

  const generalSessionId = useMemo(() => {
    const general = sessions.find((session) => session.scope === "general");
    return general?.id ?? null;
  }, [sessions]);

  const generalHistoryHydratedRef = useRef(false);
  const pathname = usePathname();

  const loadConversationMessages = useCallback(
    async (sessionId: string) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session || !session.conversationId) {
        return;
      }
      if (session.messages.length > 0) {
        return;
      }

      try {
        const history = await apiService.getConversation(session.conversationId);
        if (!Array.isArray(history) || history.length === 0) {
          return;
        }

        const now = Date.now();
        const mapped = mapApiMessagesToChatMessages(history, session.conversationId, now);

        if (!mapped.length) {
          return;
        }

        setSessions((prev) => {
          const index = prev.findIndex((s) => s.id === sessionId);
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
    [persistSessions, setSessions]
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

    if (!general || !user?.id || pathname !== "/g" || generalHistoryHydratedRef.current || generalHasMessages) {
      return;
    }

    let cancelled = false;

    const hydrateGeneralHistory = async () => {
      const generalConversationId = buildGeneralConversationId(user.id);
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

        // Mark as synced immediately to prevent the sync effect from pushing
        // this authoritative history back to the server, which can cause
        // message duplication if the backend's replace logic is non-atomic.
        syncedHistoryRef.current.add(generalConversationId);

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
  }, [pathname, persistSessions, setSessions, user?.id]);

  useReminderPolling({ userId: user?.id, generalSessionId, appendMessage });

  const value = useMemo(
    () => ({
      sessions,
      createThreadSession,
      sendGeneralMessage,
      appendMessage,
      updateMessage,
      deleteMessage,
      updateSession,
      renameSession,
      pinSession,
      applyAutoTitle,
      deleteSession,
      clearAllConversations,
      getSession,
      ensureSession,
      generalSessionId,
      workspaceContext: workspaceContextValue,
      setWorkspaceContext: setWorkspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
      markHasSeenGeneralChat,
      personalizedSystemPrompt,
      attachments: selectedAttachments,
      isAttachmentUploading,
      attachmentError,
      uploadAttachments,
      removeAttachment,
      clearAttachments,
      mapsEnabled,
      mapsWidgetEnabled,
      mapsLatitude,
      mapsLongitude,
      setMapsEnabled,
      setMapsWidgetEnabled,
      setMapsLatitude,
      setMapsLongitude,
      toggleMapsEnabled,
      toggleWebSearchEnabled,
      remindersEnabled,
      toggleRemindersEnabled,
      mapPayload,
      // Web Search
      autoWebSearchEnabled,
      setAutoWebSearchEnabled,
      webSearchEnabled,
      loadConversationMessages,
      reasoningMode,
      setReasoningMode,
      modelTier,
      setModelTier,
      selectedModelId,
      setSelectedModelId: handleSetSelectedModelId,
      visibleModelIds,
      setVisibleModelIds,
      questionnaireSession,
      startQuestionnaire,
      cancelQuestionnaire,
      remoteConversationsLoaded,
    }),
    [
      appendMessage,
      createThreadSession,
      clearAllConversations,
      deleteSession,
      generalSessionId,
      getSession,
      deleteMessage,
      sendGeneralMessage,
      updateMessage,
      renameSession,
      applyAutoTitle,
      ensureSession,
      sessions,
      updateSession,
      workspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
      markHasSeenGeneralChat,
      personalizedSystemPrompt,
      selectedAttachments,
      isAttachmentUploading,
      attachmentError,
      uploadAttachments,
      removeAttachment,
      clearAttachments,
      mapsEnabled,
      mapsWidgetEnabled,
      mapsLatitude,
      mapsLongitude,
      setMapsEnabled,
      setMapsWidgetEnabled,
      setMapsLatitude,
      setMapsLongitude,
      toggleMapsEnabled,
      toggleWebSearchEnabled,
      remindersEnabled,
      toggleRemindersEnabled,
      mapPayload,
      autoWebSearchEnabled,
      setAutoWebSearchEnabled,
      webSearchEnabled,
      loadConversationMessages,
      reasoningMode,
      setReasoningMode,
      modelTier,
      setModelTier,
      selectedModelId,
      handleSetSelectedModelId,
      visibleModelIds,
      setVisibleModelIds,
      questionnaireSession,
      startQuestionnaire,
      cancelQuestionnaire,
      remoteConversationsLoaded,
      pinSession,
    ]
  );

  useEffect(() => {
    if (!hasLoadedFromStorageRef.current) {
      return;
    }
    persistSessions(sessions);
  }, [persistSessions, sessions]);

  usePersistAiCreatedReminders({ sessions, userId: user?.id });

  return (
    <ChatContext.Provider value={value}>
      {children}

    </ChatContext.Provider>
  );
}

export const useChatStore = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatStore must be used within a ChatProvider");
  }
  return ctx;
};

export { GENERAL_CHAT_SESSION_ID };
