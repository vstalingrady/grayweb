"use client";

import {
  Children,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { ContextUsageSummary } from "@/components/gray/types";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import AttachmentTray from "./AttachmentTray";
import { GrayChatComposer } from "./ChatComposer";
import { useChatStore } from "./ChatProvider";
import { useHasHydrated } from "./hooks/useHasHydrated";
import { GENERAL_CHAT_SESSION_ID } from "./chat/constants";
import {
  buildAssistantReply,
  buildGeneralConversationId,
  normalizeConversationIdValue,
} from "./chat/utils";
import { ChatMessagesList } from "./chat/view/ChatMessagesList";
import { MobileWelcomeScreen } from "./chat/view/MobileWelcomeScreen";
import { useChatMessageActions } from "./chat/view/useChatMessageActions";
import { MarkdownCodeBlock } from "./chat/view/markdown/MarkdownCodeBlock";
import { hasCodeBlockDescendant } from "./chat/view/markdown/utils";
import { useChatConversationUsage } from "./chat/view/useChatConversationUsage";
import { useChatViewScroll } from "./chat/view/useChatViewScroll";
import { useStreamAssistantReply } from "./chat/view/useStreamAssistantReply";

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
    if (!session?.conversationId || session.messages.length > 0) {
      return;
    }
    void loadConversationMessages(session.id);
  }, [loadConversationMessages, session?.conversationId, session?.id, session?.messages.length]);

  const { user, waitForUser } = useUser();
  const [draft, setDraft] = useState("");
  const hasHydrated = useHasHydrated();
  const replyTimeout = useRef<number | null>(null);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  // Track the most recent conversation ID synchronously to avoid React state update delays
  // This ensures subsequent messages use the correct conversation ID even before state propagates
  const streamedConversationIdRef = useRef<string | null>(null);
  // Track when thinking content (inside <thinking> tags) actually starts
  const [isActivelyThinking, setIsActivelyThinking] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [reasoningSeconds, setReasoningSeconds] = useState<number | null>(null);

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

  const { chatViewportRef, scrollAnchorRef, composerDockRef, chatViewStyle, handleScroll } = useChatViewScroll({
    hasHydrated,
    sessionKey: session?.id ?? null,
    messages,
    activeStreamingMessageId,
  });

  useEffect(() => {
    // Reset submit state to prevent blocking after navigation
    isSubmittingRef.current = false;
  }, [session?.id]);

  useEffect(() => {
    // Safety: if the UI is no longer streaming, never keep the submit lock held.
    if (!session?.isResponding && !activeStreamingMessageId) {
      isSubmittingRef.current = false;
    }
  }, [activeStreamingMessageId, session?.id, session?.isResponding]);

  const { setConversationUsage } = useChatConversationUsage({
    activeConversationId,
    sessionConversationId,
    sessionExists,
    messages,
    workspaceContext,
    onContextUsageChange,
  });
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

  const streamAssistantReply = useStreamAssistantReply({
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
  });

  const {
    copiedMessageId,
    regeneratingMessageId,
    getResponseDurationLabel,
    handleCopyMessage,
    handleDeleteMessage,
    handleEditMessage,
    handleRetryUserMessage,
    handleRegenerate,
    handleCycleAssistantVariant,
  } = useChatMessageActions({
    session,
    messages,
    activeStreamingMessageId,
    setActiveStreamingMessageId,
    updateMessage,
    deleteMessage,
    updateSession,
    markAutoStreamTriggered,
    streamAssistantReply,
  });

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
    let lastUserMessage = null as (typeof messages)[number] | null;
    let lastAssistantMessage = null as (typeof messages)[number] | null;
    for (let index = messages.length - 1; index >= 0 && (!lastUserMessage || !lastAssistantMessage); index -= 1) {
      const message = messages[index];
      if (!lastUserMessage && message.role === "user") {
        lastUserMessage = message;
      }
      if (!lastAssistantMessage && message.role === "assistant") {
        lastAssistantMessage = message;
      }
    }

    // Some flows (e.g., createThreadSession) seed an empty assistant message before
    // the actual stream starts. If navigation interrupts that stream we end up with
    // a blank assistant entry, so treat it as "awaiting" unless it has real content.
    const assistantHasContent = Boolean(lastAssistantMessage?.content?.trim());

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
    markAutoStreamTriggered(sessionAutoStreamId, safeLastUserMessage.id);

    // Set isResponding: true immediately to prevent spinner disappearing during race condition
    // between clearing pendingAutoStream and streamAssistantReply setting isResponding.
    updateSession(sessionAutoStreamId, { pendingAutoStream: false, isResponding: true });

    void streamAssistantReply(
      sessionAutoStreamId,
      safeLastUserMessage.content,
      sessionConversationId ?? null,
      null
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
      table: ({
        children,
        node,
        ...rest
      }: React.TableHTMLAttributes<HTMLTableElement> & { node?: Element }) => {
        void node;
        return (
          <div className={styles.chatTableWrapper}>
            <table {...rest}>{children}</table>
          </div>
        );
      },
    }),
    []
  );

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
