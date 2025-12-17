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
  ChatSession,
  ChatContextValue,
} from "./chat/types";
import {
  buildGeneralConversationId,
  buildPersonalizedSystemPrompt,
} from "./chat/utils";
import {
  GENERAL_CHAT_SESSION_ID,
} from "./chat/constants";
import { useDefaultSystemPrompt } from "./chat/provider/useDefaultSystemPrompt";
import { useAutoStreamState } from "./chat/provider/useAutoStreamState";
import { useAttachments } from "./chat/provider/useAttachments";
import { useChatPreferences } from "./chat/provider/useChatPreferences";
import { useConversationSync } from "./chat/provider/useConversationSync";
import { useConversationHistory } from "./chat/provider/useConversationHistory";
import { useCreateThreadSession } from "./chat/provider/useCreateThreadSession";
import { useGeneralChatOnboarding } from "./chat/provider/useGeneralChatOnboarding";
import { useMapsSettings } from "./chat/provider/useMapsSettings";
import { usePersistAiCreatedReminders } from "./chat/provider/usePersistAiCreatedReminders";
import { useQuestionnaire } from "./chat/provider/useQuestionnaire";
import { useRemoteConversations } from "./chat/provider/useRemoteConversations";
import { useReminderPolling } from "./chat/provider/useReminderPolling";
import { useRemindersEnabled } from "./chat/provider/useRemindersEnabled";
import { useSessionActions } from "./chat/provider/useSessionActions";
import { useSessionStorage } from "./chat/provider/useSessionStorage";
import { useSendGeneralMessage } from "./chat/provider/useSendGeneralMessage";
import { useWorkspaceContextAttachment } from "./chat/provider/useWorkspaceContextAttachment";
import {
  createEmptyGeneralSession,
} from "./chat/provider/sessionStore";

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const { user, waitForUser, updateUser, refreshUser } = useUser();
  const { locale } = useI18n();
  const defaultSystemPrompt = useDefaultSystemPrompt(locale);
  const { markHasSeenGeneralChat } = useGeneralChatOnboarding({ user, updateUser });
  const {
    autoWebSearchEnabled,
    setAutoWebSearchEnabled,
    webSearchEnabled,
    toggleWebSearchEnabled,
    reasoningMode,
    setReasoningMode,
    modelTier,
    setModelTier,
    selectedModelId,
    setSelectedModelId,
    visibleModelIds,
    setVisibleModelIds,
  } = useChatPreferences({ user, updateUser });

  const personalizedSystemPrompt = useMemo(
    () => buildPersonalizedSystemPrompt(user, defaultSystemPrompt),
    [user, defaultSystemPrompt]
  );

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
  const {
    workspaceContext: workspaceContextValue,
    setWorkspaceContext: setWorkspaceContextState,
    shouldAttachWorkspaceContextForSession,
  } = useWorkspaceContextAttachment({ workspaceContext });
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

  const { remindersEnabled, toggleRemindersEnabled } = useRemindersEnabled(
    user?.id
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

  const createThreadSession = useCreateThreadSession({
    persistSessions,
    queueConversationTitleSync,
    setSessions,
  });

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
    setSelectedModelId,
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
