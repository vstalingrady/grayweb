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
import { apiService } from "@/lib/api";

import {
  ChatSession,
  ChatContextValue,
} from "./chat/types";
import {
  buildGeneralConversationId,
  buildPersonalizedSystemPrompt,
  shouldIncludeWorkspaceContext,
} from "./chat/utils";
import {
  GENERAL_CHAT_SESSION_ID,
  SELF_CONTEXT_PATTERNS,
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
import { useSessionActions } from "./chat/provider/useSessionActions";
import { useSessionStorage } from "./chat/provider/useSessionStorage";
import { useSendGeneralMessage } from "./chat/provider/useSendGeneralMessage";
import {
  createEmptyGeneralSession,
  makeMessage,
  normalizeSessionsList,
} from "./chat/provider/sessionStore";

const WORKSPACE_CONTEXT_COOLDOWN_MS = 600000; // 10 minutes

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
  const [autoWebSearchEnabledOverride, setAutoWebSearchEnabledOverride] = useState<boolean | undefined>(undefined);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [modelTier, setModelTier] = useState<"lite" | "pro" | "pioneer">("lite");
  const [selectedModelIdOverride, setSelectedModelIdOverride] = useState<string | null | undefined>(undefined);
  const [visibleModelIds, setVisibleModelIds] = useState<string[] | null>(null);

  const autoWebSearchEnabled =
    autoWebSearchEnabledOverride === undefined
      ? typeof user?.auto_web_search_enabled === "boolean"
        ? user.auto_web_search_enabled
        : false
      : autoWebSearchEnabledOverride;
  const selectedModelId =
    selectedModelIdOverride === undefined ? user?.preferred_model ?? null : selectedModelIdOverride;

  const handleSetSelectedModelId = useCallback(
    (id: string | null) => {
      setSelectedModelIdOverride(id);
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
  const [workspaceContextState, setWorkspaceContextState] = useState<string | null>(workspaceContext ?? null);
  const workspaceContextValue =
    workspaceContext !== undefined ? workspaceContext ?? null : workspaceContextState;
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

  // Track profile hash to only send full profile when it changes
  useModelPreferences({
    user,
    updateUser,
    modelTier,
    setModelTier,
    selectedModelId,
    setSelectedModelId: setSelectedModelIdOverride,
    reasoningMode,
    setReasoningMode,
    visibleModelIds,
    setVisibleModelIds,
  });

  const setAutoWebSearchEnabled = useCallback(
    (value: boolean) => {
      setAutoWebSearchEnabledOverride(value);
      if (!user) {
        return;
      }
      void updateUser({ auto_web_search_enabled: value })
        .then(() => {
          setAutoWebSearchEnabledOverride(undefined);
        })
        .catch((error) => {
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

  const {
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
  } = useSessionActions({
    sessionsRef,
    setSessions,
    persistSessions,
    generalConversationIdRef,
    pendingHistorySyncRef,
    pendingTitleSyncRef,
    queueConversationTitleSync,
    enqueueHistorySync,
    resetAutoStreamState,
    userId: user?.id,
    userEmail: user?.email,
  });

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
      setSessions,
      ensureGeneralSession,
    ]
  );

  const { questionnaireSession, startQuestionnaire, cancelQuestionnaire, handleQuestionnaireResponse } =
    useQuestionnaire({
      ensureGeneralSession,
      appendMessage,
      updateSession,
      updateUser,
    });

  const { sendGeneralMessage: sendGeneralMessageStream } = useSendGeneralMessage({
    ensureGeneralSession,
    appendMessage,
    updateMessage,
    updateMessageThrottled,
    updateSession,
    clearAttachments,
    attachmentsRef,
    resolveChatUser,
    workspaceContext: workspaceContextValue,
    shouldAttachWorkspaceContextForSession,
    autoWebSearchEnabled,
    webSearchEnabled,
    mapPayload,
    remindersEnabled,
    reasoningMode,
    modelTier,
    selectedModelId,
    defaultSystemPrompt,
    markHasSeenGeneralChat,
    refreshUser,
    markAutoStreamTriggered,
    generalConversationIdRef,
  });

  const sendGeneralMessage = useCallback(
    async (content: string): Promise<string> => {
      if (questionnaireSession) {
        await handleQuestionnaireResponse(content, questionnaireSession);
        return ensureGeneralSession().id;
      }
      return sendGeneralMessageStream(content);
    },
    [ensureGeneralSession, handleQuestionnaireResponse, questionnaireSession, sendGeneralMessageStream]
  );

  // Keep the ref in sync with the actual sendGeneralMessage function
  useEffect(() => {
    sendGeneralMessageRef.current = sendGeneralMessage;
  }, [sendGeneralMessage]);

  const generalSessionId = useMemo(() => {
    const general = sessions.find((session) => session.scope === "general");
    return general?.id ?? null;
  }, [sessions]);

  const { loadConversationMessages } = useConversationHistory({
    sessionsRef,
    setSessions,
    persistSessions,
    userId: user?.id,
  });

  useReminderPolling({ userId: user?.id, generalSessionId, appendMessage });

  const value: ChatContextValue = {
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
    setWorkspaceContext: setWorkspaceContextState,
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
  };

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
