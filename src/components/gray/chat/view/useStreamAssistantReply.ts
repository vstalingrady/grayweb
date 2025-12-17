import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { apiService, type ConversationUsage, type User } from "@/lib/api";
import { buildLocalTimeContextWithOverrides } from "@/lib/timeContext";
import type { ChatMessage, ChatSession } from "../types";
import { resolveAssistantReminders } from "../reminderUtils";
import {
  buildAssistantReply,
  buildGeneralConversationId,
  normalizeAssistantContent,
  normalizeConversationIdValue,
  resolveClientTimezone,
  shouldIncludeWorkspaceContext,
  shouldRequestAutoTitleForSession,
} from "../utils";

type UseStreamAssistantReplyOptions = {
  session?: ChatSession;
  workspaceContext: string | null;
  personalizedSystemPrompt: string;
  autoWebSearchEnabled: boolean;
  webSearchEnabled: boolean;
  mapPayload: Record<string, number | boolean | undefined>;
  modelTier: "lite" | "pro" | "pioneer";
  selectedModelId: string | null;
  reasoningMode: boolean;
  buildAttachmentPayloads: () => Array<{ id: number }>;
  resolveChatUser: () => Promise<User | null>;
  appendMessage: (sessionId: string, role: "assistant" | "user", content: string) => ChatMessage | null;
  updateMessage: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  applyAutoTitle: (sessionId: string, candidate?: string | null) => void;
  clearAttachments: () => void;
  setActiveStreamingMessageId: Dispatch<SetStateAction<string | null>>;
  setConversationUsage: Dispatch<SetStateAction<ConversationUsage | null>>;
  setIsActivelyThinking: Dispatch<SetStateAction<boolean>>;
  setThinkingStartTime: Dispatch<SetStateAction<number | null>>;
  setReasoningSeconds: Dispatch<SetStateAction<number | null>>;
  streamAbortControllerRef: MutableRefObject<AbortController | null>;
  streamedConversationIdRef: MutableRefObject<string | null>;
};

export const useStreamAssistantReply = ({
  session,
  workspaceContext,
  personalizedSystemPrompt,
  autoWebSearchEnabled,
  webSearchEnabled,
  mapPayload,
  modelTier,
  selectedModelId,
  reasoningMode,
  buildAttachmentPayloads,
  resolveChatUser,
  appendMessage,
  updateMessage,
  updateSession,
  applyAutoTitle,
  clearAttachments,
  setActiveStreamingMessageId,
  setConversationUsage,
  setIsActivelyThinking,
  setThinkingStartTime,
  setReasoningSeconds,
  streamAbortControllerRef,
  streamedConversationIdRef,
}: UseStreamAssistantReplyOptions) => {
  return useCallback(
    async (
      targetSessionId: string,
      prompt: string,
      conversationId: string | null,
      existingAssistantId?: string | null
    ) => {
      updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
      setIsActivelyThinking(false);
      setThinkingStartTime(null);
      setReasoningSeconds(null);

      let assistantMessageId: string | null = existingAssistantId ?? null;
      let streamingMessageId: string | null = assistantMessageId ?? null;
      let previousVariants: string[] = [];
      let isRegeneration = false;

      if (existingAssistantId && session && session.id === targetSessionId) {
        const existingAssistant = session.messages.find(
          (message) => message.id === existingAssistantId && message.role === "assistant"
        );
        if (existingAssistant) {
          const hasContent = Boolean(existingAssistant.content && existingAssistant.content.trim());
          if (hasContent) {
            isRegeneration = true;
          }
          if (Array.isArray(existingAssistant.variants) && existingAssistant.variants.length > 0) {
            previousVariants = [...existingAssistant.variants];
          } else if (hasContent) {
            previousVariants = [existingAssistant.content as string];
          }
        }
      }

      if (isRegeneration && existingAssistantId) {
        updateMessage(targetSessionId, existingAssistantId, {
          content: "",
          groundingMetadata: undefined,
        });
      }

      if (!assistantMessageId) {
        const placeholderAssistant = appendMessage(targetSessionId, "assistant", "");
        assistantMessageId = placeholderAssistant?.id ?? null;
        streamingMessageId = assistantMessageId;
      }

      if (streamingMessageId) {
        setActiveStreamingMessageId(streamingMessageId);
      }

      const requestTitleHint = shouldRequestAutoTitleForSession(session);
      if (requestTitleHint) {
        updateSession(targetSessionId, { isGeneratingTitle: true });
      }

      const resolvedUser = await resolveChatUser();
      if (!resolvedUser) {
        const fallback = buildAssistantReply(prompt);
        if (assistantMessageId) {
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = fallback ? [...baseVariants, fallback] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

          updateMessage(targetSessionId, assistantMessageId, {
            content: fallback,
            variants: nextVariants,
            activeVariantIndex: nextActiveIndex,
          });
        } else {
          appendMessage(targetSessionId, "assistant", fallback);
        }
        updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
        setActiveStreamingMessageId(null);
        return fallback;
      }

      const useWorkspaceContext = shouldIncludeWorkspaceContext(prompt, workspaceContext);
      const contextPayload = useWorkspaceContext ? workspaceContext ?? undefined : undefined;

      let accumulated = "";
      let capturedReminders: unknown[] = [];
      const isGeneralSession = session?.scope === "general";
      let streamedConversationId: string | null = isGeneralSession
        ? null
        : streamedConversationIdRef.current ?? normalizeConversationIdValue(conversationId) ?? null;
      if (!isGeneralSession && !streamedConversationId) {
        const normalizedFromSessionId = normalizeConversationIdValue(targetSessionId);
        if (normalizedFromSessionId) {
          streamedConversationId = normalizedFromSessionId;
        }
      }
      const streamingUserId = resolvedUser.id;
      const abortController = new AbortController();
      streamAbortControllerRef.current = abortController;
      const shouldUseWebSearch = autoWebSearchEnabled || webSearchEnabled;
      const shouldAttachToConversation = !isRegeneration;

      try {
        let localThinkingStartTime: number | null = null;
        const effectiveTimeZone = resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone();
        const timeContext = buildLocalTimeContextWithOverrides(undefined, {
          timeZone: effectiveTimeZone,
        });
        for await (const event of apiService.sendMessageStream(
          {
            message: prompt,
            conversation_id: shouldAttachToConversation
              ? isGeneralSession
                ? buildGeneralConversationId(streamingUserId)
                : streamedConversationId ?? undefined
              : undefined,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            time_context: timeContext,
            timezone: effectiveTimeZone,
            attachments: buildAttachmentPayloads(),
            should_generate_title: requestTitleHint,
            web_search_enabled: shouldUseWebSearch,
            model: selectedModelId ?? modelTier,
            reasoning_mode: reasoningMode,
            ...(modelTier === "lite" ? { maps_enabled: false, maps_widget: false } : mapPayload),
          },
          { signal: abortController.signal }
        )) {
          if (event.type === "token") {
            const delta = event.delta;
            const prevAccumulated = accumulated;
            accumulated = accumulated + delta;

            const hasThinkingTag = accumulated.toLowerCase().includes("<thinking>");
            const hadThinkingTag = prevAccumulated.toLowerCase().includes("<thinking>");
            if (hasThinkingTag && !hadThinkingTag) {
              setIsActivelyThinking(true);
              localThinkingStartTime = Date.now();
              setThinkingStartTime(localThinkingStartTime);
            }

            const hasClosingTag = accumulated.toLowerCase().includes("</thinking>");
            const hadClosingTag = prevAccumulated.toLowerCase().includes("</thinking>");
            if (hasClosingTag && !hadClosingTag && localThinkingStartTime) {
              const elapsed = (Date.now() - localThinkingStartTime) / 1000;
              setReasoningSeconds(elapsed);
              setIsActivelyThinking(false);
            }

            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, { content: accumulated });
              updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
            }
            continue;
          }

          if (event.type === "usage") {
            setConversationUsage((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                conversationTokens: event.usage.total_tokens,
              };
            });
            continue;
          }

          if (event.type === "reminders") {
            if (Array.isArray(event.reminders) && event.reminders.length > 0) {
              capturedReminders = event.reminders;
            }
            continue;
          }

          if (event.type === "end") {
            if (!isGeneralSession) {
              streamedConversationId = normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
              if (streamedConversationId) {
                streamedConversationIdRef.current = streamedConversationId;
              }
            }
            const normalizedResponse = normalizeAssistantContent(event.response ?? accumulated, prompt);
            accumulated = normalizedResponse;
            if (event.title) {
              applyAutoTitle(targetSessionId, event.title);
            }
            const metadata = event.groundingMetadata ?? undefined;
            const baseVariants = previousVariants.length > 0 ? previousVariants : [];
            const reminderResult = resolveAssistantReminders(normalizedResponse, capturedReminders);
            const finalContent = reminderResult.content;
            const finalReminders = reminderResult.reminders;

            const nextVariants = finalContent ? [...baseVariants, finalContent] : baseVariants;
            const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                content: finalContent,
                groundingMetadata: metadata,
                reminders: finalReminders,
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
              });
            }
            updateSession(targetSessionId, {
              conversationId: shouldAttachToConversation
                ? streamedConversationId ?? undefined
                : session?.conversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
              isGeneratingTitle: false,
            });
            clearAttachments();
            return finalContent;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }

        const normalized = normalizeAssistantContent(accumulated, prompt);
        accumulated = normalized;
        const baseVariants = previousVariants.length > 0 ? previousVariants : [];
        const nextVariants = normalized ? [...baseVariants, normalized] : baseVariants;
        const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

        if (assistantMessageId) {
          updateMessage(targetSessionId, assistantMessageId, {
            content: accumulated,
            variants: nextVariants,
            activeVariantIndex: nextActiveIndex,
          });
        }
        updateSession(targetSessionId, {
          conversationId: shouldAttachToConversation
            ? streamedConversationId ?? undefined
            : session?.conversationId ?? undefined,
          isResponding: false,
          pendingAutoStream: false,
          isGeneratingTitle: false,
        });
        clearAttachments();
        return accumulated;
      } catch (error) {
        console.warn("Failed to stream assistant reply:", error);
        try {
          const fallbackResponse = await apiService.sendMessage({
            message: prompt,
            conversation_id: shouldAttachToConversation
              ? isGeneralSession
                ? buildGeneralConversationId(streamingUserId)
                : streamedConversationId ?? undefined
              : undefined,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            time_context: buildLocalTimeContextWithOverrides(undefined, {
              timeZone: resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone(),
            }),
            timezone: resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone(),
            attachments: buildAttachmentPayloads(),
            web_search_enabled: shouldUseWebSearch,
            should_generate_title: requestTitleHint,
            model: selectedModelId ?? modelTier,
            reasoning_mode: reasoningMode,
            ...(modelTier === "lite" ? { maps_enabled: false, maps_widget: false } : mapPayload),
          });
          streamedConversationId =
            normalizeConversationIdValue(fallbackResponse.conversation_id) ?? streamedConversationId;
          const finalResponse = normalizeAssistantContent(fallbackResponse.response, prompt);
          const fallbackMetadata = fallbackResponse.groundingMetadata ?? undefined;
          if (fallbackResponse.title) {
            applyAutoTitle(targetSessionId, fallbackResponse.title);
          }
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = finalResponse ? [...baseVariants, finalResponse] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, {
              content: finalResponse,
              groundingMetadata: fallbackMetadata,
              variants: nextVariants,
              activeVariantIndex: nextActiveIndex,
              id: fallbackResponse.message_id ? String(fallbackResponse.message_id) : undefined,
            });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", finalResponse);
            assistantMessageId = assistantMessage?.id ?? null;
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
              });
            }
          }

          updateSession(targetSessionId, {
            conversationId: shouldAttachToConversation
              ? streamedConversationId ?? undefined
              : session?.conversationId ?? undefined,
            isResponding: false,
            pendingAutoStream: false,
          });
          clearAttachments();
          return finalResponse;
        } catch (fallbackError) {
          console.warn("Fallback chat request failed:", fallbackError);
          const fallback = buildAssistantReply(prompt);
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = fallback ? [...baseVariants, fallback] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, {
              content: fallback,
              variants: nextVariants,
              activeVariantIndex: nextActiveIndex,
            });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", fallback);
            assistantMessageId = assistantMessage?.id ?? null;
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
              });
            }
          }
          updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
          clearAttachments();
          return fallback;
        }
      } finally {
        if (streamAbortControllerRef.current === abortController) {
          streamAbortControllerRef.current = null;
        }
        if (streamingMessageId) {
          setActiveStreamingMessageId((previous) => (previous === streamingMessageId ? null : previous));
        }
        updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
      }
    },
    [
      autoWebSearchEnabled,
      appendMessage,
      applyAutoTitle,
      buildAttachmentPayloads,
      clearAttachments,
      mapPayload,
      modelTier,
      reasoningMode,
      resolveChatUser,
      selectedModelId,
      session,
      setActiveStreamingMessageId,
      setConversationUsage,
      setIsActivelyThinking,
      setReasoningSeconds,
      setThinkingStartTime,
      streamAbortControllerRef,
      streamedConversationIdRef,
      updateMessage,
      updateSession,
      webSearchEnabled,
      workspaceContext,
      personalizedSystemPrompt,
    ]
  );
};

