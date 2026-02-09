import { useCallback, useEffect, useRef, useState } from "react";
import { chatService } from "@/lib/api";
import type { ChatMessage, ChatSession } from "../types";
import { buildConversationHistoryPayload, normalizeConversationIdValue } from "../utils";
import { formatDurationLabel } from "./formatting";

type StreamAssistantReply = (
  sessionId: string,
  prompt: string,
  conversationId: string | null,
  existingAssistantId?: string | null
) => Promise<string>;

type UseChatMessageActionsOptions = {
  session?: ChatSession;
  messages: ChatMessage[];
  activeStreamingMessageId: string | null;
  setActiveStreamingMessageId: (messageId: string | null) => void;
  updateMessage: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  markAutoStreamTriggered: (sessionId: string, messageId?: string | null) => void;
  streamAssistantReply: StreamAssistantReply;
  loadConversationMessages: (
    sessionId: string,
    options?: {
      force?: boolean;
      touchUpdatedAt?: boolean;
      conversationIdOverride?: string | null;
      mode?: "replace" | "prepend";
      pageSize?: number;
      before?: number | null;
    }
  ) => Promise<void>;
};

type UseChatMessageActionsResult = {
  copiedMessageId: string | null;
  regeneratingMessageId: string | null;
  getResponseDurationLabel: (messageIndex: number) => string | null;
  handleCopyMessage: (messageId: string, text: string) => Promise<void>;
  handleDeleteMessage: (messageId: string) => void;
  handleEditMessage: (messageId: string, newContent: string) => void;
  handleRetryUserMessage: (messageId: string) => void;
  handleRegenerate: (messageId: string) => void;
  handleCycleAssistantVariant: (messageId: string, direction: "prev" | "next") => void;
  requestHistorySync: () => void;
};

export const useChatMessageActions = ({
  session,
  messages,
  activeStreamingMessageId,
  setActiveStreamingMessageId,
  updateMessage,
  deleteMessage,
  updateSession,
  markAutoStreamTriggered,
  streamAssistantReply,
  loadConversationMessages,
}: UseChatMessageActionsOptions): UseChatMessageActionsResult => {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const regenerateInFlightRef = useRef(false);
  const retryInFlightRef = useRef(false);
  const pendingHistorySyncRef = useRef(false);
  const historySyncTimerRef = useRef<number | null>(null);
  const historyHydrationRef = useRef(false);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
      if (historySyncTimerRef.current !== null) {
        window.clearTimeout(historySyncTimerRef.current);
        historySyncTimerRef.current = null;
      }
    };
  }, []);

  const requestHistorySync = useCallback(() => {
    pendingHistorySyncRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingHistorySyncRef.current) {
      return;
    }
    if (!session) {
      return;
    }
    if (session.isResponding || activeStreamingMessageId) {
      return;
    }

    const conversationId = normalizeConversationIdValue(session.conversationId);
    if (!conversationId) {
      return;
    }

    if (session.historyHasMore) {
      const cursorCandidate =
        typeof session.historyCursor === "number" && Number.isFinite(session.historyCursor) && session.historyCursor > 0
          ? session.historyCursor
          : typeof messages[0]?.createdAt === "number" && Number.isFinite(messages[0].createdAt) && messages[0].createdAt > 0
            ? messages[0].createdAt
            : null;
      if (!cursorCandidate) {
        pendingHistorySyncRef.current = false;
        return;
      }
      if (historySyncTimerRef.current !== null) {
        window.clearTimeout(historySyncTimerRef.current);
        historySyncTimerRef.current = null;
      }
      if (historyHydrationRef.current) {
        return;
      }
      historyHydrationRef.current = true;
      void loadConversationMessages(session.id, { mode: "prepend", before: cursorCandidate })
        .catch((error) => {
          pendingHistorySyncRef.current = false;
          console.warn("Failed to hydrate full history before sync:", error);
        })
        .finally(() => {
          historyHydrationRef.current = false;
        });
      return;
    }

    if (historySyncTimerRef.current !== null) {
      window.clearTimeout(historySyncTimerRef.current);
    }

    historySyncTimerRef.current = window.setTimeout(() => {
      historySyncTimerRef.current = null;
      if (!pendingHistorySyncRef.current) {
        return;
      }
      pendingHistorySyncRef.current = false;

      const payload = buildConversationHistoryPayload(messages);
      // Pass allowTruncate: true since this sync is triggered by explicit user action
      void chatService.overwriteConversationHistory(conversationId, payload, { allowTruncate: true }).catch((error) => {
        console.warn("Failed to sync conversation history:", error);
      });
    }, 250);
  }, [activeStreamingMessageId, loadConversationMessages, messages, session]);

  const getResponseDurationLabel = useCallback(
    (messageIndex: number) => {
      const message = messages[messageIndex];
      if (!message || message.role !== "assistant") {
        return null;
      }
      for (let index = messageIndex - 1; index >= 0; index -= 1) {
        const candidate = messages[index];
        if (candidate.role === "assistant") {
          continue;
        }
        if (candidate.role === "user") {
          const diffMs = Math.max(0, message.createdAt - candidate.createdAt);
          if (!Number.isFinite(diffMs)) {
            return null;
          }
          return formatDurationLabel(diffMs);
        }
      }
      return null;
    },
    [messages]
  );

  const handleCopyMessage = useCallback(async (messageId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      console.warn("Clipboard API is not available in this environment.");
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopiedMessageId(messageId);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId(null);
        copyResetTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error("Failed to copy response:", error);
    }
  }, []);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }
      const targetIndex = messages.findIndex((message) => message.id === messageId);
      const targetMessage = targetIndex >= 0 ? messages[targetIndex] : null;
      if (activeStreamingMessageId === messageId) {
        setActiveStreamingMessageId(null);
      }
      if (copiedMessageId === messageId) {
        setCopiedMessageId(null);
      }
      deleteMessage(session.id, messageId);
      if (!targetMessage) {
        return;
      }
      if (targetMessage.role === "assistant") {
        for (let index = targetIndex - 1; index >= 0; index -= 1) {
          const message = messages[index];
          if (message.role === "user") {
            markAutoStreamTriggered(session.id, message.id);
            break;
          }
        }
        updateSession(session.id, { pendingAutoStream: false, isResponding: false });
        requestHistorySync();
        return;
      }
      if (targetMessage.role === "user") {
        markAutoStreamTriggered(session.id, targetMessage.id);
        updateSession(session.id, { pendingAutoStream: false, isResponding: false });
      }
      requestHistorySync();
    },
    [
      activeStreamingMessageId,
      copiedMessageId,
      deleteMessage,
      markAutoStreamTriggered,
      messages,
      requestHistorySync,
      session,
      setActiveStreamingMessageId,
      updateSession,
    ]
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!session) {
        return;
      }
      updateMessage(session.id, messageId, { content: newContent });
      requestHistorySync();
    },
    [requestHistorySync, session, updateMessage]
  );

  const handleRetryUserMessage = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }
      if (session.isResponding || activeStreamingMessageId || retryInFlightRef.current) {
        return;
      }
      const messageIndex = messages.findIndex((message) => message.id === messageId);
      if (messageIndex === -1) {
        return;
      }
      const target = messages[messageIndex];
      if (target.role !== "user") {
        return;
      }
      const content = target.content ?? "";
      if (!content.trim()) {
        return;
      }

      const nextMessage = messages[messageIndex + 1];
      const existingAssistantId = nextMessage?.role === "assistant" ? nextMessage.id : undefined;

      requestHistorySync();
      retryInFlightRef.current = true;
      void streamAssistantReply(session.id, content, session.conversationId ?? null, existingAssistantId).finally(() => {
        retryInFlightRef.current = false;
      });
    },
    [activeStreamingMessageId, messages, requestHistorySync, session, streamAssistantReply]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }

      if (session.isResponding || activeStreamingMessageId || regenerateInFlightRef.current) {
        return;
      }

      const assistantIndex = messages.findIndex((message) => message.id === messageId);
      if (assistantIndex === -1) {
        return;
      }

      const assistantMessage = messages[assistantIndex];
      if (assistantMessage.role !== "assistant") {
        return;
      }

      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex -= 1;
      }
      if (userIndex < 0) {
        console.warn("Unable to locate the originating user message for regeneration.");
        return;
      }

      const userMessage = messages[userIndex];

      regenerateInFlightRef.current = true;
      setRegeneratingMessageId(assistantMessage.id);
      void (async () => {
        try {
          await streamAssistantReply(session.id, userMessage.content, session.conversationId ?? null, assistantMessage.id);
        } finally {
          regenerateInFlightRef.current = false;
          setRegeneratingMessageId(null);
          requestHistorySync();
        }
      })();
    },
    [activeStreamingMessageId, messages, requestHistorySync, session, streamAssistantReply]
  );

  const handleCycleAssistantVariant = useCallback(
    (messageId: string, direction: "prev" | "next") => {
      if (!session) {
        return;
      }
      const target = messages.find((message) => message.id === messageId && message.role === "assistant");
      if (!target || !Array.isArray(target.variants) || target.variants.length <= 1) {
        return;
      }
      const total = target.variants.length;
      const currentIndex =
        typeof target.activeVariantIndex === "number" && target.activeVariantIndex >= 0
          ? target.activeVariantIndex
          : total - 1;
      const delta = direction === "prev" ? -1 : 1;
      let nextIndex = currentIndex + delta;
      if (nextIndex < 0) {
        nextIndex = total - 1;
      } else if (nextIndex >= total) {
        nextIndex = 0;
      }
      const nextContent = target.variants[nextIndex] ?? target.content;
      updateMessage(session.id, messageId, {
        content: nextContent,
        activeVariantIndex: nextIndex,
      });
      requestHistorySync();
    },
    [messages, requestHistorySync, session, updateMessage]
  );

  return {
    copiedMessageId,
    regeneratingMessageId,
    getResponseDurationLabel,
    handleCopyMessage,
    handleDeleteMessage,
    handleEditMessage,
    handleRetryUserMessage,
    handleRegenerate,
    handleCycleAssistantVariant,
    requestHistorySync,
  };
};
