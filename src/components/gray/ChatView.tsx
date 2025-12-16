"use client";

import {
  Children,
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { ContextUsageSummary } from "@/components/gray/types";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import { apiService, type ConversationUsage, type GroundingMetadata } from "@/lib/api";
import { buildLocalTimeContextWithOverrides } from "@/lib/timeContext";
import AttachmentTray from "./AttachmentTray";
import { GrayChatComposer } from "./ChatComposer";
import { useChatStore } from "./ChatProvider";
import { GENERAL_CHAT_SESSION_ID } from "./chat/constants";
import {
  buildReminderConfirmationText,
  coerceReminderPayload,
  extractGrayRemindersFromText,
} from "./chat/reminderUtils";
import {
  type ChatMessage as ChatSessionMessage,
  type ChatRole,
  type GrayReminderCreatedPayload,
} from "./chat/types";
import {
  buildAssistantReply,
  buildGeneralConversationId,
  normalizeAssistantContent,
  normalizeConversationIdValue,
  resolveClientTimezone,
  shouldIncludeWorkspaceContext,
  shouldRequestAutoTitleForSession,
  stripGrayTitleMarkers,
} from "./chat/utils";
import { ChatMessagesList } from "./chat/view/ChatMessagesList";
import { MobileWelcomeScreen } from "./chat/view/MobileWelcomeScreen";
import { estimateTokenCount, formatDurationLabel } from "./chat/view/formatting";
import { MarkdownCodeBlock } from "./chat/view/markdown/MarkdownCodeBlock";
import { hasCodeBlockDescendant } from "./chat/view/markdown/utils";

type GrayChatViewProps = {
  sessionId: string | null;
  introContent?: ReactNode;
  onContextUsageChange?: (summary: ContextUsageSummary | null) => void;
  hideThinkingIndicator?: boolean;
};

export function GrayChatView({
  sessionId,
  introContent,
  onContextUsageChange,
  hideThinkingIndicator = false,
}: GrayChatViewProps) {
  const { t } = useI18n();
  const {
    sessions,
    ensureSession,
    appendMessage,
    updateMessage,
    deleteMessage,
    updateSession,
    workspaceContext,
    applyAutoTitle,
    hasAutoStreamTriggered,
    markAutoStreamTriggered,
    resetAutoStreamState,
    personalizedSystemPrompt,
    attachments,
    isAttachmentUploading,
    attachmentError,
    uploadAttachments,
    removeAttachment,
    clearAttachments,
    mapPayload,
    autoWebSearchEnabled,
    webSearchEnabled,
    loadConversationMessages,
    sendGeneralMessage,
    modelTier,
    selectedModelId,
    reasoningMode,
  } = useChatStore();
  // Use sessions state directly for reactivity.
  const session = useMemo(() => {
    if (!sessionId) return undefined;
    return sessions.find((s) => s.id === sessionId || s.conversationId === sessionId);
  }, [sessionId, sessions]);
  const sessionExists = Boolean(session);

  // Load messages if they are missing (e.g. for historical threads)
  useEffect(() => {
    if (sessionId && session?.conversationId && session.messages.length === 0) {
      void loadConversationMessages(sessionId);
    }
  }, [sessionId, session?.conversationId, session?.messages.length, loadConversationMessages]);

  const { user, waitForUser } = useUser();
  const [draft, setDraft] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const replyTimeout = useRef<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  // Track if the user is currently at the bottom of the chat to implement "sticky scrolling"
  const isAtBottomRef = useRef(true);
  const isLoadingHistoryRef = useRef<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [conversationUsage, setConversationUsage] = useState<ConversationUsage | null>(null);
  const isSubmittingRef = useRef(false);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  // Track the most recent conversation ID synchronously to avoid React state update delays
  // This ensures subsequent messages use the correct conversation ID even before state propagates
  const streamedConversationIdRef = useRef<string | null>(null);
  // Track when thinking content (inside <thinking> tags) actually starts
  const [isActivelyThinking, setIsActivelyThinking] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [reasoningSeconds, setReasoningSeconds] = useState<number | null>(null);

  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const handleAttachmentInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }
      uploadAttachments(files);
      event.target.value = "";
    },
    [uploadAttachments]
  );
  const openAttachmentPicker = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);
  const handleAttachmentPaste = useCallback(
    (files: File[]) => {
      if (!files || files.length === 0) {
        return;
      }
      uploadAttachments(files);
    },
    [uploadAttachments]
  );
  const activeSessionId = session?.id ?? null;
  const activeConversationId =
    session?.conversationId && session.conversationId !== GENERAL_CHAT_SESSION_ID
      ? session.conversationId
      : session?.scope === "general"
        ? buildGeneralConversationId(user?.id) ?? null
        : null;
  const buildAttachmentPayloads = useCallback(
    () => attachments.map((attachment) => ({ id: attachment.id })),
    [attachments]
  );
  const resolveChatUser = useCallback(async () => {
    if (user) {
      return user;
    }
    return waitForUser();
  }, [user, waitForUser]);

  // Sync the conversation ID ref when session changes
  useEffect(() => {
    const sessionConvId = session?.conversationId ?? null;
    // Only reset if we're switching to a different session or the state has a newer value
    if (sessionConvId) {
      streamedConversationIdRef.current = sessionConvId;
    }
  }, [session?.id, session?.conversationId]);

  const messages = useMemo(() => session?.messages ?? [], [session?.messages]);
  const sessionAutoStreamId = session?.id ?? null;
  const sessionConversationId = session?.conversationId ?? null;
  const sessionPendingAutoStream = Boolean(session?.pendingAutoStream);
  const isResponding = Boolean(session?.isResponding);
  const showIntro = Boolean(introContent) && (!session || messages.length === 0);
  const shouldShowAttachmentTray =
    session?.scope === "general" &&
    (attachments.length > 0 || isAttachmentUploading || Boolean(attachmentError));
  const attachmentTrayNode = shouldShowAttachmentTray ? (
    <AttachmentTray
      attachments={attachments}
      isUploading={isAttachmentUploading}
      error={attachmentError}
      onRemoveAttachment={removeAttachment}
    />
  ) : null;
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasHydrated || !session?.id || !scrollAnchorRef.current) {
      return;
    }
    // Scroll to bottom on initial load (after messages are loaded)
    scrollAnchorRef.current.scrollIntoView({ behavior: "auto" });
  }, [hasHydrated, session?.id, messages.length]);

  const streamingContentSignature = useMemo(() => {
    if (!activeStreamingMessageId) {
      return null;
    }
    const target = messages.find((message) => message.id === activeStreamingMessageId);
    if (!target) {
      return null;
    }
    const contentLength = target.content?.length ?? 0;
    return `${activeStreamingMessageId}:${contentLength}`;
  }, [activeStreamingMessageId, messages]);

  const handleScroll = useCallback(() => {
    const viewport = chatViewportRef.current;
    if (!viewport) return;
    const threshold = 300; // Same generous threshold
    const isNearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
    isAtBottomRef.current = isNearBottom;
  }, []);

  // Force scroll to bottom unconditionally (used when user sends a message)
  const scrollToBottom = useCallback((instant = false) => {
    if (!scrollAnchorRef.current) return;
    scrollAnchorRef.current.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
  }, []);

  // Auto-scroll on new messages - always scroll to show the new message
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Auto-scroll during active streaming if we were already at the bottom.
  // We use the ref-based check to ensure "sticky" behavior even if a large
  // chunk of content arrives that pushes the bottom further away than the threshold.
  useEffect(() => {
    if (streamingContentSignature && scrollAnchorRef.current && isAtBottomRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [streamingContentSignature]);

  useLayoutEffect(() => {
    const node = composerDockRef.current;
    if (!node || typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }
    const updateHeight = () => {
      setComposerHeight(node.offsetHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const chatViewStyle: CSSProperties | undefined =
    composerHeight > 0 ? ({ "--chat-composer-height": `${composerHeight}px` } as CSSProperties) : undefined;

  useEffect(() => {
    setActiveStreamingMessageId(null);
    // Reset submit state to prevent blocking after navigation
    isSubmittingRef.current = false;
  }, [session?.id]);

  useEffect(() => {
    // Safety: if the UI is no longer streaming, never keep the submit lock held.
    if (!session?.isResponding && !activeStreamingMessageId) {
      isSubmittingRef.current = false;
    }
  }, [activeStreamingMessageId, session?.id, session?.isResponding]);

  useEffect(() => {
    if (isHistoryLoading) {
      setActiveStreamingMessageId(null);
    }
  }, [isHistoryLoading]);

  useEffect(() => {
    if (!activeConversationId) {
      setConversationUsage(null);
      return;
    }

    let cancelled = false;
    setConversationUsage((previous) =>
      previous && previous.conversationId === activeConversationId ? previous : null
    );
    const loadUsage = async () => {
      try {
        const usage = await apiService.getConversationUsage(activeConversationId);
        if (!cancelled) {
          setConversationUsage(usage);
        }
      } catch (error) {
        if (!cancelled) {
          console.info("Conversation usage unavailable:", error);
          setConversationUsage(null);
        }
      }
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);
  useEffect(
    () => () => {
      if (replyTimeout.current !== null) {
        window.clearTimeout(replyTimeout.current);
        replyTimeout.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
      replyTimeout.current = null;
    }
  }, [session?.id]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
        copyResetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId || !activeConversationId) {
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = null;
      return;
    }

    if (isLoadingHistoryRef.current === `${activeSessionId}:${activeConversationId}`) {
      return;
    }

    // Skip loading if we already have messages AND they include assistant messages
    // (user messages will appear before backend sends the response)
    const hasAssistantMessages = session?.messages?.some((msg) => msg.role === "assistant");
    const isGeneralConversation =
      typeof activeConversationId === "string" && activeConversationId.startsWith("general:");
    if (hasAssistantMessages && !isGeneralConversation) {
      return;
    }

    let cancelled = false;
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = `${activeSessionId}:${activeConversationId}`;

    (async () => {
      try {
        const history = await apiService.getConversation(activeConversationId);
        if (cancelled) {
          return;
        }

        if (!Array.isArray(history) || history.length === 0) {
          updateSession(activeSessionId, {
            conversationId: activeConversationId ?? undefined,
            messages: [],
            updatedAt: Date.now(),
            isResponding: false,
          });
          return;
        }

        // Deduplicate consecutive identical backend messages so that if the same
        // user entry is stored twice, it only renders once in the UI.
        const dedupedHistory = history.filter((message, index, arr) => {
          if (index === 0) {
            return true;
          }
          const prev = arr[index - 1];
          // Check for exact duplicate content/role
          if (prev.role === message.role && (prev.text ?? "") === (message.text ?? "")) {
            return false;
          }
          return true;
        });

        const mappedHistory: ChatSessionMessage[] = dedupedHistory.map((message, index) => {
          const role: ChatRole = message.role === "model" ? "assistant" : "user";
          const rawText = message.text ?? "";
          const normalizedText = role === "assistant" ? stripGrayTitleMarkers(rawText) : rawText;
          const reminderExtraction =
            role === "assistant"
              ? extractGrayRemindersFromText(normalizedText)
              : { cleanText: normalizedText, reminders: [] };
          const normalizedMetadata =
            (message as { grounding_metadata?: GroundingMetadata | null }).grounding_metadata ??
            (message as { groundingMetadata?: GroundingMetadata | null }).groundingMetadata ??
            null;
          // Use the message's timestamp from the API if available, otherwise fall back to now
          const apiTimestamp = (message as { timestamp?: number }).timestamp;
          const createdAt =
            typeof apiTimestamp === "number" && Number.isFinite(apiTimestamp) && apiTimestamp > 0
              ? apiTimestamp
              : Date.now();
          return {
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${activeConversationId}-${index}-${Date.now()}`,
            role,
            content: reminderExtraction.cleanText,
            createdAt,
            reminders:
              role === "assistant" && reminderExtraction.reminders.length
                ? reminderExtraction.reminders
                : undefined,
            groundingMetadata: normalizedMetadata ?? undefined,
          };
        });

        updateSession(activeSessionId, {
          conversationId: activeConversationId ?? undefined,
          messages: mappedHistory,
          updatedAt: Date.now(),
          isResponding: false,
        });
      } catch (error) {
        console.error("Failed to load conversation history:", error);
        updateSession(activeSessionId, {
          conversationId: activeConversationId ?? undefined,
          messages: session?.messages ?? [],
          updatedAt: Date.now(),
          isResponding: false,
        });
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, activeSessionId, session, updateSession]);

  const streamAssistantReply = useCallback(
    async (
      targetSessionId: string,
      prompt: string,
      conversationId: string | null,
      existingAssistantId?: string | null
    ) => {
      updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
      // Reset thinking tracking state
      setIsActivelyThinking(false);
      setThinkingStartTime(null);
      setReasoningSeconds(null);

      // --- OPTIMISTIC UI UPDATE START ---
      // Creates the placeholder immediately so the spinner appears instantly,
      // without waiting for user resolution or other async checks.
      let assistantMessageId: string | null = existingAssistantId ?? null;
      let streamingMessageId: string | null = assistantMessageId ?? null;
      let previousVariants: string[] = [];
      let isRegeneration = false;

      // Check regeneration state
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

      // If regenerating, clear existing content immediately
      if (isRegeneration && existingAssistantId) {
        updateMessage(targetSessionId, existingAssistantId, {
          content: "",
          groundingMetadata: undefined,
        });
      }

      // If NOT regenerating, create the placeholder message now
      if (!assistantMessageId) {
        const placeholderAssistant = appendMessage(targetSessionId, "assistant", "");
        assistantMessageId = (placeholderAssistant as ChatSessionMessage | null)?.id ?? null;
        streamingMessageId = assistantMessageId;
      }

      // Set streaming ID immediately for UI feedback
      if (streamingMessageId) {
        setActiveStreamingMessageId(streamingMessageId);
      }

      // Show skeleton loader in sidebar while title is being generated
      const requestTitleHint = shouldRequestAutoTitleForSession(session);
      if (requestTitleHint) {
        updateSession(targetSessionId, { isGeneratingTitle: true });
      }
      // --- OPTIMISTIC UI UPDATE END ---

      const resolvedUser = await resolveChatUser();
      if (!resolvedUser) {
        const fallback = buildAssistantReply(prompt);
        // Update existing placeholder instead of appending new one
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
          // Should rarely happen given optimistic creation
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
      // Use the ref for the most up-to-date conversation ID (avoids React state delays)
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
            model: selectedModelId ?? modelTier, // Pass the selected model ID or tier
            reasoning_mode: reasoningMode,
            ...(modelTier === "lite" ? { maps_enabled: false, maps_widget: false } : mapPayload),
          },
          { signal: abortController.signal }
        )) {
          if (event.type === "token") {
            const delta = event.delta;
            const prevAccumulated = accumulated;
            accumulated = accumulated + delta;

            // Detect when thinking content starts (first <thinking> tag appears)
            const hasThinkingTag = accumulated.toLowerCase().includes("<thinking>");
            const hadThinkingTag = prevAccumulated.toLowerCase().includes("<thinking>");
            if (hasThinkingTag && !hadThinkingTag) {
              // Thinking just started
              setIsActivelyThinking(true);
              localThinkingStartTime = Date.now();
              setThinkingStartTime(localThinkingStartTime);
            }

            // Detect when thinking ends (</thinking> tag appears)
            const hasClosingTag = accumulated.toLowerCase().includes("</thinking>");
            const hadClosingTag = prevAccumulated.toLowerCase().includes("</thinking>");
            if (hasClosingTag && !hadClosingTag && localThinkingStartTime) {
              // Thinking just ended - calculate final duration
              const elapsed = (Date.now() - localThinkingStartTime) / 1000;
              setReasoningSeconds(elapsed);
              setIsActivelyThinking(false);
            }

            // We guaranteed assistantMessageId exists above
            if (assistantMessageId) {
              updateMessage(targetSessionId, assistantMessageId, { content: accumulated });
              updateSession(targetSessionId, { isResponding: true, pendingAutoStream: false });
            }
            continue;
          }

          if (event.type === "usage") {
            // Received precise usage stats from the backend.
            // Update local state immediately to reflect accurate token count.
            setConversationUsage((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                conversationTokens: event.usage.total_tokens,
                // We keep messageCount as is, or technically it should be +1 (the current response)
                // but usually the backend usage includes the current response if it's "total_tokens".
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
            // For general sessions we keep using the synthetic general conversation
            // identifier instead of adopting any backend UUID so that /g remains
            // a single stable thread.
            if (!isGeneralSession) {
              streamedConversationId = normalizeConversationIdValue(event.conversationId) ?? streamedConversationId;
              // Update ref immediately so next message uses correct ID (sync, not async state)
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
            // Process reminders: prefer structured SSE payloads, fallback to text extraction.
            let finalReminders: GrayReminderCreatedPayload[] | undefined;
            if (capturedReminders.length > 0) {
              finalReminders = capturedReminders
                .map((candidate) => coerceReminderPayload(candidate))
                .filter((r): r is GrayReminderCreatedPayload => Boolean(r));
            } else {
              const extracted = extractGrayRemindersFromText(normalizedResponse);
              if (extracted.reminders.length > 0) {
                finalReminders = extracted.reminders;
              }
            }

            let finalContent = normalizedResponse;
            if (finalReminders && finalReminders.length > 0 && !finalContent.trim()) {
              const confirmation = buildReminderConfirmationText(finalReminders);
              if (confirmation) {
                finalContent = confirmation;
              }
            }

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
              conversationId: shouldAttachToConversation ? streamedConversationId ?? undefined : session?.conversationId ?? undefined,
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

        // If stream ends without "end" event (e.g. simple close)
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
          conversationId: shouldAttachToConversation ? streamedConversationId ?? undefined : session?.conversationId ?? undefined,
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
            model: selectedModelId ?? modelTier, // Pass the selected model ID or tier
            reasoning_mode: reasoningMode,
            ...(modelTier === "lite" ? { maps_enabled: false, maps_widget: false } : mapPayload),
          });
          streamedConversationId = normalizeConversationIdValue(fallbackResponse.conversation_id) ?? streamedConversationId;
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
            // Should rarely happen if optimistic creation worked
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
            conversationId: shouldAttachToConversation ? streamedConversationId ?? undefined : session?.conversationId ?? undefined,
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
        // Always ensure isResponding is reset to prevent blocking future submissions
        updateSession(targetSessionId, { isResponding: false, pendingAutoStream: false });
      }
    },
    [
      appendMessage,
      resolveChatUser,
      updateMessage,
      updateSession,
      workspaceContext,
      personalizedSystemPrompt,
      applyAutoTitle,
      session,
    ]
  );

  useEffect(() => {
    if (!session) {
      if (sessionId) {
        resetAutoStreamState(sessionId);
      }
      return;
    }

    // If we are currently submitting a message (optimistic update), ignore auto-stream
    // to prevent race conditions where the effect sees the new message before
    // the submit handler has marked the session as responding.
    if (isSubmittingRef.current) {
      return;
    }

    if (!sessionAutoStreamId) {
      return;
    }

    // If this session was created as a shell for a /c/{conversationId} URL and has
    // no local messages yet, skip auto-streaming. History hydration (below) will
    // populate messages if the backend knows this conversation.
    if (sessionConversationId && messages.length === 0) {
      return;
    }

    // If this session is already streaming a reply, do not trigger another.
    if (session?.isResponding) {
      return;
    }

    // Wait for user to be available to avoid race conditions with resolveChatUser
    if (!user) {
      return;
    }

    // Only ever auto-respond to genuine user messages, never to assistant output.
    const hasPendingAutoStream = sessionPendingAutoStream;
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user") ?? null;
    const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;

    // Some flows (e.g., createThreadSession) seed an empty assistant message before
    // the actual stream starts. If navigation interrupts that stream we end up with
    // a blank assistant entry, so treat it as "awaiting" unless it has real content.
    const assistantHasContent = Boolean(lastAssistantMessage?.content?.trim());

    const isAwaitingAssistant =
      Boolean(lastUserMessage) &&
      (!lastAssistantMessage ||
        lastAssistantMessage.createdAt < (lastUserMessage?.createdAt ?? 0) ||
        !assistantHasContent);

    // If we have an assistant message that is just empty/loading, do not trigger a new one.
    // This prevents double-triggering while the first one is being created or streamed.
    if (lastAssistantMessage && !assistantHasContent) {
      return;
    }

    const hasAlreadyTriggeredForLastUser =
      lastUserMessage != null && hasAutoStreamTriggered(sessionAutoStreamId, lastUserMessage.id);

    // Only auto-respond when the session explicitly flagged a pending auto-stream.
    // This prevents re-sending old prompts on reload just because the last message
    // happens to be from the user.
    const shouldRespond = !hasAlreadyTriggeredForLastUser && hasPendingAutoStream;

    if (!shouldRespond) {
      return;
    }

    // At this point shouldRespond guarantees we had a last user message,
    // but narrow explicitly for TypeScript.
    const safeLastUserMessage = lastUserMessage;
    if (!safeLastUserMessage) {
      return;
    }

    // Mark that we've handled this specific user message so we don't re-trigger.
    // Mark that we've handled this specific user message so we don't re-trigger.
    markAutoStreamTriggered(sessionAutoStreamId, safeLastUserMessage.id);

    // Set isResponding: true immediately to prevent spinner disappearing during race condition
    // between clearing pendingAutoStream and streamAssistantReply setting isResponding.
    updateSession(sessionAutoStreamId, { pendingAutoStream: false, isResponding: true });

    const placeholderAssistantId = !assistantHasContent && lastAssistantMessage ? lastAssistantMessage.id : null;

    void streamAssistantReply(
      sessionAutoStreamId,
      lastUserMessage.content,
      sessionConversationId ?? null,
      placeholderAssistantId
    );
  }, [
    hasAutoStreamTriggered,
    markAutoStreamTriggered,
    messages,
    sessionId,
    session,
    resetAutoStreamState,
    sessionAutoStreamId,
    sessionConversationId,
    sessionPendingAutoStream,
    streamAssistantReply,
    updateSession,
    user,
  ]);

  // Adjust scroll when composer height changes to prevent it from covering messages
  useLayoutEffect(() => {
    const composer = composerDockRef.current;
    const viewport = chatViewportRef.current;
    if (!composer || !viewport) {
      return;
    }

    let lastHeight = composer.offsetHeight;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        const diff = newHeight - lastHeight;

        // If getting taller
        if (diff > 0) {
          // Check if we are near bottom (within 50px)
          const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 50;
          if (isNearBottom) {
            viewport.scrollTop += diff;
          }
        }
        lastHeight = newHeight;
      }
    });

    observer.observe(composer);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPrompt = draft.trim();
    // If a stream is in progress, allow a submit with content to interrupt + send in one step.
    // If there is no content, treat submit as "cancel".
    if (session?.isResponding || activeStreamingMessageId) {
      const controller = streamAbortControllerRef.current;
      if (controller) {
        controller.abort();
        streamAbortControllerRef.current = null;
      }
      if (session) {
        updateSession(session.id, { isResponding: false, pendingAutoStream: false });
      }
      setActiveStreamingMessageId(null);
      isSubmittingRef.current = false;

      if (!nextPrompt) {
        return;
      }
    }
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;

    let targetSession = session;
    if (!targetSession && sessionId) {
      const nowTs = Date.now();
      const normalizedSessionConversationId = normalizeConversationIdValue(sessionId);
      targetSession = ensureSession(sessionId, () => ({
        id: sessionId,
        title: t("New Chat"),
        titleMode: "auto",
        createdAt: nowTs,
        updatedAt: nowTs,
        messages: [],
        isResponding: false,
        scope: "thread",
        conversationId: normalizedSessionConversationId ?? undefined,
        pendingAutoStream: false,
      }));
    }
    if (!targetSession) {
      console.error("[handleSubmit] Failed to resolve targetSession", { sessionId, sessionExists: !!session });
      isSubmittingRef.current = false;
      return;
    }
    const content = nextPrompt;
    if (!content) {
      isSubmittingRef.current = false;
      return;
    }

    // General chat handles its own optimistic append to avoid duplicate user messages
    if (targetSession.scope === "general") {
      setDraft("");
      if (replyTimeout.current !== null) {
        window.clearTimeout(replyTimeout.current);
        replyTimeout.current = null;
      }
      void sendGeneralMessage(content).finally(() => {
        isSubmittingRef.current = false;
      });
      return;
    }

    // Generate a temp ID and mark it as already triggered BEFORE appending
    // This prevents the auto-stream effect from racing with our own streaming
    const tempUserMessageId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    markAutoStreamTriggered(targetSession.id, tempUserMessageId);

    const userMessage = appendMessage(
      targetSession.id,
      "user",
      content,
      tempUserMessageId,
      undefined,
      attachments.length > 0 ? [...attachments] : undefined
    );
    setDraft("");
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
    }

    if (userMessage) {
      void streamAssistantReply(targetSession.id, content, targetSession.conversationId ?? null).finally(() => {
        isSubmittingRef.current = false;
      });
      return;
    }

    appendMessage(targetSession.id, "assistant", buildAssistantReply(content));
    replyTimeout.current = null;
    isSubmittingRef.current = false;
  };

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
        const precedingUser = [...messages]
          .slice(0, targetIndex)
          .reverse()
          .find((message) => message.role === "user");
        if (precedingUser) {
          markAutoStreamTriggered(session.id, precedingUser.id);
        }
        updateSession(session.id, { pendingAutoStream: false, isResponding: false });
        return;
      }
      if (targetMessage.role === "user") {
        markAutoStreamTriggered(session.id, targetMessage.id);
        updateSession(session.id, { pendingAutoStream: false, isResponding: false });
        return;
      }
    },
    [
      activeStreamingMessageId,
      copiedMessageId,
      deleteMessage,
      markAutoStreamTriggered,
      messages,
      session,
      updateSession,
    ]
  );

  const handleEditMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (!session) {
        return;
      }
      updateMessage(session.id, messageId, { content: newContent });
    },
    [session, updateMessage]
  );

  const handleRetryUserMessage = useCallback(
    (messageId: string) => {
      if (!session) {
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

      // If there is an assistant response immediately following this message,
      // regenerate it. Otherwise, generate a new response.
      const nextMessage = messages[messageIndex + 1];
      const existingAssistantId = nextMessage?.role === "assistant" ? nextMessage.id : undefined;

      void streamAssistantReply(session.id, content, session.conversationId ?? null, existingAssistantId);
    },
    [messages, session, streamAssistantReply]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!session) {
        return;
      }

      // Prevent regeneration while already streaming a response
      if (session.isResponding || activeStreamingMessageId) {
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

      // Allow regenerating any assistant message, not just the latest
      let userIndex = assistantIndex - 1;
      while (userIndex >= 0 && messages[userIndex].role !== "user") {
        userIndex -= 1;
      }
      if (userIndex < 0) {
        console.warn("Unable to locate the originating user message for regeneration.");
        return;
      }

      const userMessage = messages[userIndex];

      setRegeneratingMessageId(assistantMessage.id);
      void (async () => {
        try {
          await streamAssistantReply(session.id, userMessage.content, session.conversationId ?? null, assistantMessage.id);
        } finally {
          setRegeneratingMessageId(null);
        }
      })();
    },
    [activeStreamingMessageId, messages, session, streamAssistantReply]
  );

  const handleCycleAssistantVariant = useCallback(
    (messageId: string, direction: "prev" | "next") => {
      if (!session) {
        return;
      }
      const target = session.messages.find((message) => message.id === messageId && message.role === "assistant");
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
    },
    [session, updateMessage]
  );

  // Respect the backend as the single source of truth for context limits.
  // If limit > 0, use it. If limit is 0/undefined, treat as "unlimited" and let
  // downstream consumers decide how to present that (e.g. "Unlimited context").
  const contextLimit = typeof conversationUsage?.limit === "number" && conversationUsage.limit > 0 ? conversationUsage.limit : 0;
  const fallbackConversationTokens = useMemo(() => {
    if (!session) {
      return 0;
    }
    return session.messages.reduce((total, message) => {
      const contentTokens = estimateTokenCount(message.content);
      return total + contentTokens;
    }, 0);
  }, [session]);

  const conversationContextStats = useMemo(() => {
    const limit = contextLimit;

    // Count messages participating in the current session context.
    // Always use the actual session message count as the source of truth
    const messageCount = session?.messages.length ?? 0;

    // Prefer backend-accurate token usage ONLY if it is fresh (message counts match).
    // Otherwise, use our local estimate so the user sees immediate feedback while typing/streaming.
    const backendMessageCount = conversationUsage?.messageCount ?? -1;
    const isBackendFresh = backendMessageCount === messageCount;

    const conversationTokens =
      isBackendFresh && typeof conversationUsage?.conversationTokens === "number" && conversationUsage.conversationTokens >= 0
        ? conversationUsage.conversationTokens
        : fallbackConversationTokens;

    // Workspace context: include the FULL workspace summary so the user sees its impact.
    const workspaceTokens = estimateTokenCount(workspaceContext);

    // If we have authoritative backend usage, use that as the total (it likely includes system prompt + context).
    // Otherwise, sum our estimates.
    const totalTokens =
      typeof conversationUsage?.conversationTokens === "number" && conversationUsage.conversationTokens >= 0
        ? conversationUsage.conversationTokens
        : conversationTokens + workspaceTokens;
    const percentUsed = limit > 0 ? Math.max(0, Math.min(100, (totalTokens / limit) * 100)) : 0;
    const tokensRemaining = limit > 0 ? Math.max(0, limit - totalTokens) : 0;

    return {
      provider: conversationUsage?.provider ?? "local",
      modelName: conversationUsage?.modelName ?? null,
      modelLabel: conversationUsage?.modelLabel ?? null,
      limit,
      modelLimit: conversationUsage?.modelLimit ?? null,
      messageCount,
      conversationTokens,
      workspaceTokens,
      totalTokens,
      percentUsed,
      tokensRemaining,
      contextWarning: conversationUsage?.contextWarning ?? null,
      suggestedModels: conversationUsage?.suggestedModels ?? null,
    };
  }, [contextLimit, conversationUsage, fallbackConversationTokens, session?.messages.length, workspaceContext]);

  const markdownComponents = useMemo<Components>(
    () => ({
      code: MarkdownCodeBlock,
      // Render <pre> as a fragment so our custom code renderer controls layout.
      // Use full props to avoid narrowing issues with react-markdown's types.
      pre: (props: React.HTMLAttributes<HTMLPreElement>) => <>{props.children}</>,
      // Avoid invalid HTML like <p><div>…</div></p> when a code block
      // appears where a paragraph would normally be rendered.
      p: ({ children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) => {
        const hasBlockCodeChild = Children.toArray(children).some((child) =>
          hasCodeBlockDescendant(child as ReactNode)
        );
        if (hasBlockCodeChild) {
          return <div {...rest}>{children}</div>;
        }
        return <p {...rest}>{children}</p>;
      },
      table: ({ children, node: _node, ...rest }: React.TableHTMLAttributes<HTMLTableElement> & { node?: Element }) => (
        <div className={styles.chatTableWrapper}>
          <table {...rest}>{children}</table>
        </div>
      ),
    }),
    []
  );

  const lastUsageSummaryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onContextUsageChange) {
      return;
    }
    if (!sessionExists) {
      if (lastUsageSummaryRef.current !== null) {
        lastUsageSummaryRef.current = null;
        onContextUsageChange(null);
      }
      return;
    }
    const summary: ContextUsageSummary = {
      conversationId: sessionConversationId,
      messageCount: conversationContextStats.messageCount,
      conversationTokens: conversationContextStats.conversationTokens,
      workspaceTokens: conversationContextStats.workspaceTokens,
      totalTokens: conversationContextStats.totalTokens,
      tokensRemaining: conversationContextStats.tokensRemaining,
      limit: conversationContextStats.limit,
      modelLimit: conversationContextStats.modelLimit,
      provider: conversationContextStats.provider,
      modelName: conversationContextStats.modelName,
      modelLabel: conversationContextStats.modelLabel,
    };
    const serialized = JSON.stringify(summary);
    if (serialized === lastUsageSummaryRef.current) {
      return;
    }
    lastUsageSummaryRef.current = serialized;
    onContextUsageChange(summary);
    return () => {
      if (lastUsageSummaryRef.current === serialized) {
        lastUsageSummaryRef.current = null;
        onContextUsageChange(null);
      }
    };
  }, [
    conversationContextStats.conversationTokens,
    conversationContextStats.limit,
    conversationContextStats.messageCount,
    conversationContextStats.modelLabel,
    conversationContextStats.modelName,
    conversationContextStats.provider,
    conversationContextStats.totalTokens,
    conversationContextStats.tokensRemaining,
    conversationContextStats.workspaceTokens,
    onContextUsageChange,
    sessionConversationId,
    sessionExists,
  ]);

  if (!hasHydrated) {
    return (
      <div className={styles.chatView} aria-live="polite" style={chatViewStyle}>
        <div className={styles.chatViewport}>
          <div className={styles.chatFade} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!session && !sessionId) {
    return (
      <div className={styles.chatViewEmpty}>
        <div>
          <h2>{t("We could not find that chat.")}</h2>
          <p>{t("Select another conversation from the sidebar or start a new one.")}</p>
        </div>
      </div>
    );
  }

  const trimmedDraft = draft.trim();
  const composerHasContent = Boolean(trimmedDraft);
  // Allow sending again while streaming so the second press can cancel the stream.
  const isStreaming = isResponding || Boolean(activeStreamingMessageId);
  const isSendDisabled = !composerHasContent && !isStreaming;

  // Check if the currently streaming message is actually present in the visible list.
  // If so, the list item itself will render the spinner/content, so we shouldn't
  // show the fallback "pending" indicator at the bottom.
  const isStreamingMessageInList = Boolean(activeStreamingMessageId && messages.some((m) => m.id === activeStreamingMessageId));

  const shouldShowPendingStreamIndicator =
    !hideThinkingIndicator && (isResponding || sessionPendingAutoStream) && !isStreamingMessageInList;

  return (
    <div className={styles.chatView} aria-live="polite" style={chatViewStyle}>
      <div className={styles.chatHeaderControls}></div>
      <div className={styles.chatViewport} ref={chatViewportRef} onScroll={handleScroll}>
        <div className={styles.chatFade} aria-hidden="true" />
        {/* Welcome screen - show on empty chats, but not on /g (general chat session) */}
        {messages.length === 0 && sessionId && sessionId !== GENERAL_CHAT_SESSION_ID && <MobileWelcomeScreen />}
        {showIntro ? (
          <div className={styles.chatIntro}>
            {introContent}
            <div ref={scrollAnchorRef} aria-hidden="true" />
          </div>
        ) : (
          <ChatMessagesList
            messages={messages}
            activeStreamingMessageId={activeStreamingMessageId}
            regeneratingMessageId={regeneratingMessageId}
            copiedMessageId={copiedMessageId}
            markdownComponents={markdownComponents}
            getResponseDurationLabel={getResponseDurationLabel}
            handleCopyMessage={handleCopyMessage}
            handleRegenerate={handleRegenerate}
            handleRetryUserMessage={handleRetryUserMessage}
            handleDeleteMessage={handleDeleteMessage}
            handleCycleAssistantVariant={handleCycleAssistantVariant}
            handleEditMessage={handleEditMessage}
            shouldShowPendingStreamIndicator={shouldShowPendingStreamIndicator}
            scrollAnchorRef={scrollAnchorRef}
            reasoningSeconds={reasoningSeconds}
            isResponding={session?.isResponding}
            isActivelyThinking={isActivelyThinking}
            thinkingStartTime={thinkingStartTime}
          />
        )}
      </div>
      <div className={styles.chatComposerDock} ref={composerDockRef}>
        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className={styles.chatAttachmentInput}
          onChange={handleAttachmentInputChange}
        />
        <GrayChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          isSubmitDisabled={isSendDisabled}
          isSubmitting={isResponding}
          onAddAttachment={openAttachmentPicker}
          attachmentTray={attachmentTrayNode}
          onPasteFiles={handleAttachmentPaste}
        />
      </div>
    </div>
  );
}
