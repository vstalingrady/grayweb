import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";

import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";

import type { ChatContextValue, ChatSession } from "../types";
import {
  buildGeneralConversationId,
  buildPersonalizedSystemPrompt,
} from "../utils";
import { useAttachments } from "./useAttachments";
import { useAutoStreamState } from "./useAutoStreamState";
import { useChatPreferences } from "./useChatPreferences";
import { useConversationHistory } from "./useConversationHistory";
import { useConversationSync } from "./useConversationSync";
import { useCreateThreadSession } from "./useCreateThreadSession";
import { useDefaultSystemPrompt } from "./useDefaultSystemPrompt";
import { useGeneralChatOnboarding } from "./useGeneralChatOnboarding";
import { useMapsSettings } from "./useMapsSettings";
import { usePersistAiCreatedReminders } from "./usePersistAiCreatedReminders";
import { useQuestionnaire } from "./useQuestionnaire";
import { useRemoteConversations } from "./useRemoteConversations";
import { useReminderPolling } from "./useReminderPolling";
import { useRemindersEnabled } from "./useRemindersEnabled";
import { useSendGeneralMessage } from "./useSendGeneralMessage";
import { useSessionActions } from "./useSessionActions";
import { useSessionStorage } from "./useSessionStorage";
import { useWorkspaceContextAttachment } from "./useWorkspaceContextAttachment";
import { createEmptyGeneralSession } from "./sessionStore";

const CONTEXT_CACHE_STORAGE_PREFIX = "gray_context_cache_id";

export const useChatProviderValue = (workspaceContext?: string): ChatContextValue => {
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

  const [sessionsState, setSessionsState] = useState<ChatSession[]>(() => [
    createEmptyGeneralSession(),
  ]);
  const sessionsRef = useRef<ChatSession[]>(sessionsState);
  const setSessions = useCallback((updater: SetStateAction<ChatSession[]>) => {
    setSessionsState((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (value: ChatSession[]) => ChatSession[])(prev)
          : updater;
      sessionsRef.current = next;
      return next;
    });
  }, []);

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
  const contextCacheStorageKey = `${CONTEXT_CACHE_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
  const [contextCacheIdState, setContextCacheIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const stored = window.localStorage.getItem(contextCacheStorageKey);
      const parsed = stored ? Number(stored) : null;
      return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  });
  const setContextCacheId = useCallback(
    (next: number | null) => {
      setContextCacheIdState(next);
      if (typeof window === "undefined") {
        return;
      }
      try {
        if (typeof next === "number" && Number.isFinite(next) && next > 0) {
          window.localStorage.setItem(contextCacheStorageKey, String(next));
        } else {
          window.localStorage.removeItem(contextCacheStorageKey);
        }
      } catch {
        // ignore storage failures
      }
    },
    [contextCacheStorageKey]
  );
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(contextCacheStorageKey);
      const parsed = stored ? Number(stored) : null;
      const nextValue = typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Necessary to sync state when storage key changes (e.g. user ID change)
      setContextCacheIdState(nextValue);
    } catch {
      setContextCacheIdState(null);
    }
  }, [contextCacheStorageKey]);
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

  const { remindersEnabled, toggleRemindersEnabled } = useRemindersEnabled(user?.id);

  const { markAutoStreamTriggered, hasAutoStreamTriggered, resetAutoStreamState } = useAutoStreamState();

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

  const {
    questionnaireSession,
    startQuestionnaire,
    cancelQuestionnaire,
    handleQuestionnaireResponse,
  } = useQuestionnaire({
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
    contextCacheId: contextCacheIdState,
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
    [
      ensureGeneralSession,
      handleQuestionnaireResponse,
      questionnaireSession,
      sendGeneralMessageStream,
    ]
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
  usePersistAiCreatedReminders({ sessions, userId: user?.id });

  return {
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
    contextCacheId: contextCacheIdState,
    setContextCacheId,
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
};
