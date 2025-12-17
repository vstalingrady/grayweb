import { useCallback, useRef, type MutableRefObject } from "react";
import { apiService, type MediaUpload, type User } from "@/lib/api";
import { buildLocalTimeContextWithOverrides } from "@/lib/timeContext";
import type { ChatMessage, ChatSession, ChatRole } from "../types";
import {
  buildAssistantErrorReply,
  buildAssistantReply,
  buildGeneralConversationId,
  buildPersonalizedSystemPrompt,
  coerceConversationIdForRequest,
  computeProfileHash,
  normalizeAssistantContent,
  resolveConversationMemoryEnabled,
  resolveClientTimezone,
  shouldRequestAutoTitleForSession,
} from "../utils";
import { extractGrayRemindersFromText, resolveAssistantReminders } from "../reminderUtils";

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

type UseSendGeneralMessageOptions = {
  ensureGeneralSession: () => ChatSession;
  appendMessage: (
    sessionId: string,
    role: ChatRole,
    content: string,
    tempId?: string,
    metadata?: ChatMessage["groundingMetadata"],
    attachments?: MediaUpload[]
  ) => ChatMessage | null;
  updateMessage: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  updateMessageThrottled: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  clearAttachments: () => void;
  attachmentsRef: MutableRefObject<MediaUpload[]>;
  resolveChatUser: () => Promise<User | null>;
  workspaceContext: string | null;
  shouldAttachWorkspaceContextForSession: (sessionId: string, message: string) => boolean;
  autoWebSearchEnabled: boolean;
  webSearchEnabled: boolean;
  mapPayload: Record<string, number | boolean | undefined>;
  remindersEnabled: boolean;
  reasoningMode: boolean;
  modelTier: "lite" | "pro" | "pioneer";
  selectedModelId: string | null;
  defaultSystemPrompt: string | null;
  markHasSeenGeneralChat: () => Promise<void>;
  refreshUser: () => void | Promise<void>;
  markAutoStreamTriggered: (sessionId: string, messageId?: string | null) => void;
  generalConversationIdRef: MutableRefObject<string | undefined>;
};

type UseSendGeneralMessageResult = {
  sendGeneralMessage: (content: string) => Promise<string>;
};

export const useSendGeneralMessage = ({
  ensureGeneralSession,
  appendMessage,
  updateMessage,
  updateMessageThrottled,
  updateSession,
  clearAttachments,
  attachmentsRef,
  resolveChatUser,
  workspaceContext,
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
}: UseSendGeneralMessageOptions): UseSendGeneralMessageResult => {
  const lastSentProfileHashRef = useRef<string>("");
  const reasoningStartTimeRef = useRef<number | null>(null);

  const sendGeneralMessage = useCallback(
    async (content: string): Promise<string> => {
      const trimmed = content.trim();
      const generalSession = ensureGeneralSession();

      if (!trimmed) {
        return generalSession.id;
      }

      const resolvedGeneralConversationId =
        coerceConversationIdForRequest(generalSession.conversationId) ??
        coerceConversationIdForRequest(generalConversationIdRef.current);
      let requestConversationId = resolvedGeneralConversationId;

      const attachmentPayloads = attachmentsRef.current.map((attachment) => ({
        id: attachment.id,
      }));

      const tempUserMessageId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);

      markAutoStreamTriggered(generalSession.id, tempUserMessageId);

      appendMessage(
        generalSession.id,
        "user",
        trimmed,
        tempUserMessageId,
        undefined,
        attachmentsRef.current.length > 0 ? [...attachmentsRef.current] : undefined
      );
      clearAttachments();

      let assistantMessageId: string | null = null;
      const initialAssistant = appendMessage(generalSession.id, "assistant", "");
      assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;

      updateSession(generalSession.id, {
        isResponding: true,
        updatedAt: Date.now(),
      });

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
      const includeWorkspaceContext = shouldAttachWorkspaceContextForSession(generalSession.id, trimmed);
      const contextPayload = includeWorkspaceContext ? workspaceContext ?? undefined : undefined;
      const shouldUseWebSearch = autoWebSearchEnabled || webSearchEnabled;

      (async () => {
        let accumulated = "";
        let capturedReminders: unknown[] = [];
        let didReceiveToken = false;
        const streamingUserId = resolvedUser.id;

        try {
          const effectiveTimeZone = resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone();
          const timeContext = buildLocalTimeContextWithOverrides(undefined, {
            timeZone: effectiveTimeZone,
          });

          const currentProfileHash = computeProfileHash(resolvedUser);
          const isFirstMessage = generalSession.messages.length <= 1;
          const profileChanged = currentProfileHash !== lastSentProfileHashRef.current;
          const shouldIncludeFullProfile = isFirstMessage || profileChanged;

          const systemPromptForRequest = buildPersonalizedSystemPrompt(
            resolvedUser,
            defaultSystemPrompt,
            shouldIncludeFullProfile
          );

          if (shouldIncludeFullProfile) {
            lastSentProfileHashRef.current = currentProfileHash;
          }

          if (reasoningMode) {
            reasoningStartTimeRef.current = Date.now();
          }

          const shouldGenerateTitle = shouldRequestAutoTitleForSession(generalSession);
          if (shouldGenerateTitle) {
            updateSession(generalSession.id, { isGeneratingTitle: true });
          }

          const conversationMemoryEnabled = resolveConversationMemoryEnabled(resolvedUser);

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
              accumulated = accumulated && delta.startsWith(accumulated) ? delta : accumulated + delta;
              const extraction = extractGrayRemindersFromText(accumulated);
              if (assistantMessageId) {
                const updates: Partial<ChatMessage> = { content: extraction.cleanText };
                if (!didReceiveToken && reasoningStartTimeRef.current) {
                  const elapsed = (Date.now() - reasoningStartTimeRef.current) / 1000;
                  reasoningStartTimeRef.current = null;
                  updates.reasoningSeconds = elapsed;
                  didReceiveToken = true;
                }
                updateMessageThrottled(generalSession.id, assistantMessageId, updates);
              }
              continue;
            }

            if (event.type === "reminders") {
              if (Array.isArray(event.reminders) && event.reminders.length > 0) {
                capturedReminders = event.reminders;
              }
              continue;
            }

            if (event.type === "end") {
              streamedConversationId =
                coerceConversationIdForRequest(event.conversationId) ?? streamedConversationId;
              const finalResponse = normalizeAssistantContent(event.response ?? accumulated, trimmed);
              const metadata = event.groundingMetadata ?? undefined;
              const timingUpdate = event.timing ? { backendTimings: event.timing } : undefined;

              const reminderResult = resolveAssistantReminders(finalResponse, capturedReminders);

              const finalMessageUpdates: Partial<ChatMessage> = {
                content: reminderResult.content,
                groundingMetadata: metadata,
                reminders: reminderResult.reminders,
                ...(timingUpdate ?? {}),
              };

              if (!didReceiveToken && reasoningStartTimeRef.current) {
                const elapsed = (Date.now() - reasoningStartTimeRef.current) / 1000;
                finalMessageUpdates.reasoningSeconds = elapsed;
              }

              if (assistantMessageId) {
                updateMessage(generalSession.id, assistantMessageId, finalMessageUpdates);
              } else {
                const assistantMessage = appendMessage(generalSession.id, "assistant", finalResponse, undefined, metadata);
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
              return;
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
        } finally {
          endSearchTracking();
          void markHasSeenGeneralChat();
          void refreshUser();
          updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
          clearAttachments();
        }
      })();

      return generalSession.id;
    },
    [
      appendMessage,
      attachmentsRef,
      autoWebSearchEnabled,
      clearAttachments,
      defaultSystemPrompt,
      ensureGeneralSession,
      generalConversationIdRef,
      mapPayload,
      markAutoStreamTriggered,
      markHasSeenGeneralChat,
      modelTier,
      reasoningMode,
      remindersEnabled,
      resolveChatUser,
      refreshUser,
      selectedModelId,
      shouldAttachWorkspaceContextForSession,
      updateMessage,
      updateMessageThrottled,
      updateSession,
      webSearchEnabled,
      workspaceContext,
    ]
  );

  return { sendGeneralMessage };
};
