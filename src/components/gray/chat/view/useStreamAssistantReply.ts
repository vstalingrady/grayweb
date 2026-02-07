import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { chatService, type ConversationUsage, type User } from "@/lib/api";
import {
  buildMemorySettingsStorageKey,
  extractMemorySettingsFromUser,
  loadMemorySettings,
  mergeMemorySettings,
} from "@/lib/memorySettings";
import { buildLocalTimeContextWithOverrides } from "@/lib/timeContext";
import type { ChatMessage, ChatSession } from "../types";
import { resolveAssistantReminders } from "../reminderUtils";
import {
  buildAssistantReply,
  buildGeneralConversationId,
  normalizeAssistantContent,
  normalizeConversationIdValue,
  resolveConversationMemoryEnabled,
  resolveClientTimezone,
  shouldIncludeWorkspaceContext,
  deriveTitleFromMessage,
  shouldRequestAutoTitleForSession,
} from "../utils";
import { resolveWebSearchDecision } from "../utils/webSearchHeuristics";

type UseStreamAssistantReplyOptions = {
  session?: ChatSession;
  workspaceContext: string | null;
  contextCacheId: number | null;
  personalizedSystemPrompt: string;
  autoWebSearchEnabled: boolean;
  webSearchEnabled: boolean;
  modelTier: "lite" | "pro" | "pioneer";
  selectedModelId: string | null;
  reasoningMode: boolean;
  remindersEnabled: boolean;
  buildAttachmentPayloads: () => Array<{ id: number }>;
  resolveChatUser: () => Promise<User | null>;
  appendMessage: (sessionId: string, role: "assistant" | "user", content: string) => ChatMessage | null;
  updateMessage: (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => void;
  updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
  applyAutoTitle: (
    sessionId: string,
    candidate?: string | null,
    options?: { sync?: boolean }
  ) => void;
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
  contextCacheId,
  personalizedSystemPrompt,
  autoWebSearchEnabled,
  webSearchEnabled,
  modelTier,
  selectedModelId,
  reasoningMode,
  remindersEnabled,
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
      const fallbackTitle = requestTitleHint ? deriveTitleFromMessage(prompt) : null;
      const applyFallbackTitle = () => {
        if (fallbackTitle) {
          applyAutoTitle(targetSessionId, fallbackTitle);
        }
      };
      if (requestTitleHint) {
        updateSession(targetSessionId, { isGeneratingTitle: true });
      }

      const resolvedUser = await resolveChatUser();
      if (!resolvedUser) {
        applyFallbackTitle();
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
        updateSession(targetSessionId, {
          isResponding: false,
          pendingAutoStream: false,
          isGeneratingTitle: false,
        });
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
      const recentUserMessages =
        session?.messages
          .filter(
            (entry): entry is ChatMessage =>
              entry.role === "user" && typeof entry.content === "string" && entry.content.trim().length > 0
          )
          .map((entry) => entry.content.trim())
          .slice(-8) ?? [];
      const { enabled: shouldUseWebSearch, mode: webSearchMode } = resolveWebSearchDecision({
        message: prompt,
        autoEnabled: autoWebSearchEnabled,
        manualEnabled: webSearchEnabled,
        recentUserMessages,
      });
      const resolveConversationIdUpdate = (candidate?: string | null) => {
        if (!candidate) {
          return session?.conversationId ?? undefined;
        }
        if (!session?.conversationId) {
          return candidate;
        }
        if (session.conversationId === candidate) {
          return candidate;
        }
        if (session.conversationId === session.id) {
          return candidate;
        }
        return session.conversationId;
      };
      const effectiveTimeZone = resolvedUser.personalization_time_zone?.trim() || resolveClientTimezone();
      const timeContext = buildLocalTimeContextWithOverrides(undefined, {
        timeZone: effectiveTimeZone,
      });
      const localMemorySettings = loadMemorySettings(buildMemorySettingsStorageKey(resolvedUser.id));
      const accountMemorySettings = extractMemorySettingsFromUser(resolvedUser);
      const memorySettings = mergeMemorySettings(localMemorySettings, accountMemorySettings);
      const conversationMemoryEnabled = resolveConversationMemoryEnabled(resolvedUser);
      let completedSearchToolStatus:
        | {
            name: string;
            status: "end";
            query?: string;
          }
        | undefined;

      try {
        let localThinkingStartTime: number | null = null;
        let didSetReasoningSeconds = false;
        let shouldClearToolStatusOnNextToken = false;
        let latestSearchQuery: string | null = null;
        let latestSearchToolName: string | null = null;
        const isSearchToolName = (toolName: string): boolean => {
          const normalized = toolName.trim().toLowerCase();
          return normalized.includes("search") || normalized.includes("web");
        };
        const finalizeReasoningSeconds = (elapsed: number) => {
          if (didSetReasoningSeconds) {
            return;
          }
          didSetReasoningSeconds = true;
          setReasoningSeconds(elapsed);
          setIsActivelyThinking(false);
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, { reasoningSeconds: elapsed });
          }
        };
        for await (const event of chatService.sendMessageStream(
          {
            message: prompt,
            conversation_id: isGeneralSession
              ? buildGeneralConversationId(streamingUserId)
              : streamedConversationId ?? undefined,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            time_context: timeContext,
            timezone: effectiveTimeZone,
            conversation_memory_enabled: conversationMemoryEnabled,
            supermemory_auto_recall: memorySettings.autoRecall,
            supermemory_auto_capture: memorySettings.autoCapture,
            supermemory_capture_mode: memorySettings.captureMode,
            supermemory_max_recall_results: memorySettings.maxRecallResults,
            supermemory_profile_frequency: memorySettings.profileFrequency,
            context_cache_id: contextCacheId ?? undefined,
            attachments: buildAttachmentPayloads(),
            should_generate_title: requestTitleHint,
            web_search_enabled: shouldUseWebSearch,
            web_search_mode: webSearchMode,
            web_search_engine: "google",
            web_search_max_results: 50,
            model: selectedModelId ?? modelTier,
            reasoning_mode: reasoningMode,
            reminders_enabled: remindersEnabled,
          },
          { signal: abortController.signal }
        )) {
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
                  updateMessage(targetSessionId, assistantMessageId, {
                    toolStatus: completedSearchToolStatus,
                  });
                  shouldClearToolStatusOnNextToken = false;
                } else {
                  shouldClearToolStatusOnNextToken = true;
                }
              } else {
                if (isSearchTool) {
                  completedSearchToolStatus = undefined;
                }
                updateMessage(targetSessionId, assistantMessageId, {
                  toolStatus: { name: event.name, status: event.status, query: normalizedQuery },
                });
                shouldClearToolStatusOnNextToken = false;
              }
            }
            continue;
          }

          if (event.type === "token") {
            const delta = event.delta;
            if (assistantMessageId && shouldClearToolStatusOnNextToken) {
              updateMessage(targetSessionId, assistantMessageId, {
                toolStatus: completedSearchToolStatus ?? undefined,
              });
              shouldClearToolStatusOnNextToken = false;
            }
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
              finalizeReasoningSeconds(elapsed);
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
            if (localThinkingStartTime && !didSetReasoningSeconds) {
              const elapsed = (Date.now() - localThinkingStartTime) / 1000;
              finalizeReasoningSeconds(elapsed);
            }
            if (!isGeneralSession) {
              streamedConversationId = normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
              if (streamedConversationId) {
                const nextConversationId = resolveConversationIdUpdate(streamedConversationId);
                if (nextConversationId) {
                  streamedConversationIdRef.current = nextConversationId;
                }
              }
            }
            const normalizedResponse = normalizeAssistantContent(event.response ?? accumulated, prompt);
            accumulated = normalizedResponse;
            if (event.title) {
              applyAutoTitle(targetSessionId, event.title, { sync: false });
            } else {
              applyFallbackTitle();
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
                toolStatus: completedSearchToolStatus,
              });
            }
            const nextConversationId = resolveConversationIdUpdate(streamedConversationId);
            updateSession(targetSessionId, {
              ...(nextConversationId ? { conversationId: nextConversationId } : {}),
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
        applyFallbackTitle();
        const baseVariants = previousVariants.length > 0 ? previousVariants : [];
        const nextVariants = normalized ? [...baseVariants, normalized] : baseVariants;
        const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

        if (assistantMessageId) {
          updateMessage(targetSessionId, assistantMessageId, {
            content: accumulated,
            variants: nextVariants,
            activeVariantIndex: nextActiveIndex,
            toolStatus: completedSearchToolStatus,
          });
        }
        const nextConversationId = resolveConversationIdUpdate(streamedConversationId);
        updateSession(targetSessionId, {
          ...(nextConversationId ? { conversationId: nextConversationId } : {}),
          isResponding: false,
          pendingAutoStream: false,
          isGeneratingTitle: false,
        });
        clearAttachments();
        return accumulated;
      } catch (error) {
        if (abortController.signal.aborted) {
          applyFallbackTitle();
          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, { toolStatus: completedSearchToolStatus });
          }
          updateSession(targetSessionId, {
            isResponding: false,
            pendingAutoStream: false,
            isGeneratingTitle: false,
          });
          clearAttachments();
          return normalizeAssistantContent(accumulated, prompt);
        }
        console.warn("Failed to stream assistant reply:", error);
        try {
          const fallbackResponse = await chatService.sendMessage({
            message: prompt,
            conversation_id: isGeneralSession
              ? buildGeneralConversationId(streamingUserId)
              : streamedConversationId ?? undefined,
            system_prompt: personalizedSystemPrompt,
            user_id: streamingUserId,
            context: contextPayload,
            time_context: timeContext,
            timezone: effectiveTimeZone,
            conversation_memory_enabled: conversationMemoryEnabled,
            supermemory_auto_recall: memorySettings.autoRecall,
            supermemory_auto_capture: memorySettings.autoCapture,
            supermemory_capture_mode: memorySettings.captureMode,
            supermemory_max_recall_results: memorySettings.maxRecallResults,
            supermemory_profile_frequency: memorySettings.profileFrequency,
            context_cache_id: contextCacheId ?? undefined,
            attachments: buildAttachmentPayloads(),
            web_search_enabled: shouldUseWebSearch,
            web_search_mode: webSearchMode,
            web_search_engine: "google",
            web_search_max_results: 50,
            should_generate_title: requestTitleHint,
            model: selectedModelId ?? modelTier,
            reasoning_mode: reasoningMode,
            reminders_enabled: remindersEnabled,
          });
          streamedConversationId =
            normalizeConversationIdValue(fallbackResponse.conversation_id) ?? streamedConversationId;
          const finalResponse = normalizeAssistantContent(fallbackResponse.response, prompt);
          const fallbackMetadata = fallbackResponse.groundingMetadata ?? undefined;
          if (fallbackResponse.title) {
            applyAutoTitle(targetSessionId, fallbackResponse.title, { sync: false });
          } else {
            applyFallbackTitle();
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
              toolStatus: completedSearchToolStatus,
              id: fallbackResponse.message_id ? String(fallbackResponse.message_id) : undefined,
            });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", finalResponse);
            assistantMessageId = assistantMessage?.id ?? null;
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
                toolStatus: completedSearchToolStatus,
              });
            }
          }

          const nextConversationId = resolveConversationIdUpdate(streamedConversationId);
          updateSession(targetSessionId, {
            ...(nextConversationId ? { conversationId: nextConversationId } : {}),
            isResponding: false,
            pendingAutoStream: false,
            isGeneratingTitle: false,
          });
          clearAttachments();
          return finalResponse;
        } catch (fallbackError) {
          console.warn("Fallback chat request failed:", fallbackError);
          applyFallbackTitle();
          const fallback = buildAssistantReply(prompt);
          const baseVariants = previousVariants.length > 0 ? previousVariants : [];
          const nextVariants = fallback ? [...baseVariants, fallback] : baseVariants;
          const nextActiveIndex = nextVariants.length > 0 ? nextVariants.length - 1 : undefined;

          if (assistantMessageId) {
            updateMessage(targetSessionId, assistantMessageId, {
              content: fallback,
              variants: nextVariants,
              activeVariantIndex: nextActiveIndex,
              toolStatus: completedSearchToolStatus,
            });
          } else {
            const assistantMessage = appendMessage(targetSessionId, "assistant", fallback);
            assistantMessageId = assistantMessage?.id ?? null;
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, {
                variants: nextVariants,
                activeVariantIndex: nextActiveIndex,
                toolStatus: completedSearchToolStatus,
              });
            }
          }
          updateSession(targetSessionId, {
            isResponding: false,
            pendingAutoStream: false,
            isGeneratingTitle: false,
          });
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
        updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false, isGeneratingTitle: false });
      }
    },
    [
      autoWebSearchEnabled,
      appendMessage,
      applyAutoTitle,
      buildAttachmentPayloads,
      clearAttachments,
      modelTier,
      reasoningMode,
      remindersEnabled,
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
      contextCacheId,
      personalizedSystemPrompt,
    ]
  );
};
