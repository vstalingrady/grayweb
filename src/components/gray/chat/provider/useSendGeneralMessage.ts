import { useCallback, useRef, type MutableRefObject } from "react";
import { chatService, type MediaUpload, type User } from "@/lib/api";
import {
  buildMemorySettingsStorageKey,
  extractMemorySettingsFromUser,
  loadMemorySettings,
  mergeMemorySettings,
} from "@/lib/memorySettings";
import { buildLocalTimeContextWithOverrides } from "@/lib/timeContext";
import type { ChatMessage, ChatSession, ChatRole } from "../types";
import {
  buildAssistantErrorReply,
  buildAssistantReply,
  buildGeneralConversationId,
  buildPersonalizedSystemPrompt,
  coerceConversationIdForRequest,
  createClientUuid,
  computeProfileHash,
  normalizeAssistantContent,
  stripMcpToolBlocks,
  resolveConversationMemoryEnabled,
  resolveClientTimezone,
  shouldRequestAutoTitleForSession,
} from "../utils";
import { resolveWebSearchDecision } from "../utils/webSearchHeuristics";
import { resolveAssistantReminders } from "../reminderUtils";
import { createStreamReasoningTracker } from "../streamingReasoning";
import { StreamTextAccumulator } from "../streamTextAccumulator";

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
  contextCacheId: number | null;
  shouldAttachWorkspaceContextForSession: (sessionId: string, message: string) => boolean;
  autoWebSearchEnabled: boolean;
  webSearchEnabled: boolean;
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
  contextCacheId,
  shouldAttachWorkspaceContextForSession,
  autoWebSearchEnabled,
  webSearchEnabled,
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
        createClientUuid();

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
      const recentUserMessages = generalSession.messages
        .filter(
          (entry): entry is ChatMessage =>
            entry.role === "user" && typeof entry.content === "string" && entry.content.trim().length > 0
        )
        .map((entry) => entry.content.trim())
        .slice(-8);
      const { enabled: shouldUseWebSearch, mode: webSearchMode } = resolveWebSearchDecision({
        message: trimmed,
        autoEnabled: autoWebSearchEnabled,
        manualEnabled: webSearchEnabled,
        recentUserMessages,
      });

      (async () => {
        const streamTextAccumulator = new StreamTextAccumulator();
        let accumulated = streamTextAccumulator.get();
        let capturedReminders: unknown[] = [];
        let capturedReasoningSeconds: number | null = null;
        const reasoningTracker = createStreamReasoningTracker(Date.now());
        const effectiveModel = modelTier === "pioneer" ? selectedModelId ?? modelTier : modelTier;
        const effectiveReasoningMode = modelTier !== "lite" && reasoningMode;
        const streamingUserId = resolvedUser.id;
        let shouldClearToolStatusOnNextToken = false;
        let latestSearchQuery: string | null = null;
        let latestSearchToolName: string | null = null;
        let completedSearchToolStatus:
          | {
              name: string;
              status: "end";
              query?: string;
            }
          | undefined;
        const isSearchToolName = (toolName: string): boolean => {
          const normalized = toolName.trim().toLowerCase();
          return normalized.includes("search") || normalized.includes("web");
        };

        try {
          const effectiveTimeZone = resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone();
          const timeContext = buildLocalTimeContextWithOverrides(undefined, {
            timeZone: effectiveTimeZone,
          });
          const localMemorySettings = loadMemorySettings(buildMemorySettingsStorageKey(resolvedUser.id));
          const accountMemorySettings = extractMemorySettingsFromUser(resolvedUser);
          const memorySettings = mergeMemorySettings(localMemorySettings, accountMemorySettings);

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

          const shouldGenerateTitle = shouldRequestAutoTitleForSession(generalSession);
          if (shouldGenerateTitle) {
            updateSession(generalSession.id, { isGeneratingTitle: true });
          }

          const conversationMemoryEnabled = resolveConversationMemoryEnabled(resolvedUser);

          for await (const event of chatService.sendMessageStream({
            message: trimmed,
            system_prompt: systemPromptForRequest,
            user_id: streamingUserId,
            context: contextPayload,
            conversation_id: requestConversationId ?? undefined,
            time_context: timeContext,
            timezone: effectiveTimeZone,
            conversation_memory_enabled: conversationMemoryEnabled,
            supermemory_auto_recall: memorySettings.autoRecall,
            supermemory_auto_capture: memorySettings.autoCapture,
            supermemory_capture_mode: memorySettings.captureMode,
            supermemory_max_recall_results: memorySettings.maxRecallResults,
            supermemory_profile_frequency: memorySettings.profileFrequency,
            context_cache_id: contextCacheId ?? undefined,
            attachments: attachmentPayloads,
            should_generate_title: shouldGenerateTitle,
            web_search_enabled: shouldUseWebSearch,
            web_search_mode: webSearchMode,
            web_search_engine: "google",
            web_search_max_results: 50,
            reasoning_mode: effectiveReasoningMode,
            reminders_enabled: remindersEnabled,
            model: effectiveModel,
          })) {
            if (event.type === "tool_status") {
              if (assistantMessageId) {
                const normalizedQuery =
                  typeof event.query === "string" && event.query.trim().length > 0 ? event.query.trim() : undefined;
                const isSearchTool = isSearchToolName(event.name);
                if (isSearchTool && normalizedQuery) {
                  latestSearchQuery = normalizedQuery;
                  latestSearchToolName = event.name;
                }
                if (event.status === "end") {
                  if (isSearchTool) {
                    const persistedQuery = latestSearchQuery ?? normalizedQuery;
                    completedSearchToolStatus = {
                      name: latestSearchToolName ?? event.name,
                      status: "end",
                      ...(persistedQuery ? { query: persistedQuery } : {}),
                    };
                    updateMessage(generalSession.id, assistantMessageId, { toolStatus: completedSearchToolStatus });
                    shouldClearToolStatusOnNextToken = false;
                  } else {
                    shouldClearToolStatusOnNextToken = true;
                  }
                } else {
                  updateMessage(generalSession.id, assistantMessageId, {
                    toolStatus: { name: event.name, status: event.status, query: normalizedQuery },
                  });
                  if (isSearchTool) {
                    completedSearchToolStatus = undefined;
                  }
                  shouldClearToolStatusOnNextToken = false;
                }
              }
              continue;
            }

            if (event.type === "token") {
              const delta = event.delta;
              if (assistantMessageId && shouldClearToolStatusOnNextToken) {
                updateMessage(generalSession.id, assistantMessageId, {
                  toolStatus: completedSearchToolStatus ?? undefined,
                });
                shouldClearToolStatusOnNextToken = false;
              }
              accumulated = streamTextAccumulator.append(delta);
              const transition = reasoningTracker.onAccumulatedText(accumulated, Date.now());
              if (assistantMessageId) {
                const updates: Partial<ChatMessage> = { content: stripMcpToolBlocks(accumulated) };
                if (transition.reasoningSeconds !== null && capturedReasoningSeconds === null) {
                  capturedReasoningSeconds = transition.reasoningSeconds;
                  updates.reasoningSeconds = transition.reasoningSeconds;
                }
                updateMessageThrottled(
                  generalSession.id,
                  assistantMessageId,
                  { ...updates, __streamingPatch: true } as Partial<ChatMessage>
                );
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
              const streamedText = streamTextAccumulator.get();
              const endResponseText = typeof event.response === "string" ? event.response : "";
              const responseSource = reasoningTracker.selectFinalResponseSource(streamedText, endResponseText);
              const finalResponse = normalizeAssistantContent(responseSource, trimmed);
              accumulated = streamTextAccumulator.set(finalResponse);
              const metadata = event.groundingMetadata ?? undefined;
              const timingUpdate = event.timing ? { backendTimings: event.timing } : undefined;

              const reminderResult = resolveAssistantReminders(finalResponse, capturedReminders);

              const finalMessageUpdates: Partial<ChatMessage> = {
                content: reminderResult.content,
                groundingMetadata: metadata,
                reminders: reminderResult.reminders,
                toolStatus: completedSearchToolStatus,
                ...(timingUpdate ?? {}),
              };

              const finalizedReasoningSeconds = reasoningTracker.finalizeReasoningFromResponse(
                responseSource,
                Date.now()
              );
              if (capturedReasoningSeconds === null && finalizedReasoningSeconds !== null) {
                capturedReasoningSeconds = finalizedReasoningSeconds;
              }

              if (capturedReasoningSeconds !== null) {
                finalMessageUpdates.reasoningSeconds = capturedReasoningSeconds;
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

          const finalFallback = normalizeAssistantContent(streamTextAccumulator.get(), trimmed);
          accumulated = streamTextAccumulator.set(finalFallback);
          if (capturedReasoningSeconds === null) {
            capturedReasoningSeconds = reasoningTracker.finalizeReasoningFromResponse(finalFallback, Date.now());
          }
          if (assistantMessageId) {
            const fallbackMessageUpdates: Partial<ChatMessage> = {
              content: finalFallback,
              toolStatus: completedSearchToolStatus,
            };
            if (capturedReasoningSeconds !== null) {
              fallbackMessageUpdates.reasoningSeconds = capturedReasoningSeconds;
            }
            updateMessage(generalSession.id, assistantMessageId, fallbackMessageUpdates);
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
            const errorMessageUpdates: Partial<ChatMessage> = {
              content: fallback,
              toolStatus: completedSearchToolStatus,
            };
            if (capturedReasoningSeconds !== null) {
              errorMessageUpdates.reasoningSeconds = capturedReasoningSeconds;
            }
            updateMessage(generalSession.id, assistantMessageId, errorMessageUpdates);
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
      contextCacheId,
      defaultSystemPrompt,
      ensureGeneralSession,
      generalConversationIdRef,
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
