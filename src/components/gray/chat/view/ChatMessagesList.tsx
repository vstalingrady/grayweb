"use client";

import { memo, useCallback, useRef, useState, type RefObject } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { REMINDER_CODE_BLOCK_REGEX } from "../constants";
import { stripGrayTitleMarkers } from "../utils";
import type { ChatMessage as ChatSessionMessage } from "../types";
import { extractCurrentToolStatus, parseStructuredAssistantMessage } from "./assistantMessageParsing";
import { estimateTokenCount, formatBackendTimingLabel, formatMessageTimestamp } from "./formatting";
import { ChatMessageAttachments } from "./ChatMessageAttachments";
import { ChatMessageEditor } from "./ChatMessageEditor";
import { ChatMessageFooter } from "./ChatMessageFooter";
import { ChatMessageGroundingPanel } from "./ChatMessageGroundingPanel";
import { GrayStreamingSpinner } from "./GrayStreamingSpinner";
import { MARKDOWN_PLUGINS } from "./markdown/plugins";
import { normalizeAssistantMath } from "./markdown/mathNormalization";
import { ReminderCard } from "./ReminderCard";
import { ThinkingBlock } from "./ThinkingBlock";

export type ChatMessagesListProps = {
  messages: ChatSessionMessage[];
  activeStreamingMessageId: string | null;
  regeneratingMessageId: string | null;
  copiedMessageId: string | null;
  markdownComponents: Components;
  getResponseDurationLabel: (messageIndex: number) => string | null;
  handleCopyMessage: (messageId: string, text: string) => void;
  handleRegenerate: (messageId: string) => void;
  handleRetryUserMessage: (messageId: string) => void;
  handleDeleteMessage: (messageId: string) => void;
  handleCycleAssistantVariant: (messageId: string, direction: "prev" | "next") => void;
  handleEditMessage: (messageId: string, newContent: string) => void;
  shouldShowPendingStreamIndicator: boolean;
  scrollAnchorRef: RefObject<HTMLDivElement | null>;
  isWebSearchInFlight?: boolean;
  reasoningMode?: boolean;
  reasoningSeconds?: number | null;
  isResponding?: boolean;
  isActivelyThinking?: boolean;
  thinkingStartTime?: number | null;
  hasMoreHistory?: boolean;
  isLoadingHistory?: boolean;
  onLoadOlder?: () => void;
};

export const ChatMessagesList = memo(
  ({
    messages,
    activeStreamingMessageId,
    regeneratingMessageId,
    copiedMessageId,
    markdownComponents,
    getResponseDurationLabel,
    handleCopyMessage,
    handleRegenerate,
    handleRetryUserMessage,
    handleDeleteMessage,
    handleCycleAssistantVariant,
    handleEditMessage,
    shouldShowPendingStreamIndicator,
    scrollAnchorRef,
    isWebSearchInFlight = false,
    reasoningMode = false,
    reasoningSeconds,
    isResponding,
    isActivelyThinking,
    thinkingStartTime,
    hasMoreHistory,
    isLoadingHistory = false,
    onLoadOlder,
  }: ChatMessagesListProps) => {
    const { t } = useI18n();
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    // Use ref instead of state to avoid re-rendering on every keystroke
    const editContentRef = useRef<string>("");
    const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    // Track which message has its action bar expanded (tap to reveal)
    const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
    const shouldShowSearchStatus = Boolean(isWebSearchInFlight && (isResponding || shouldShowPendingStreamIndicator));
    const searchStatusLabel = shouldShowSearchStatus ? t("Searching") : null;

    const startEditing = useCallback((messageId: string, currentContent: string) => {
      setEditingMessageId(messageId);
      editContentRef.current = currentContent;
    }, []);

    const cancelEditing = useCallback(() => {
      setEditingMessageId(null);
      editContentRef.current = "";
    }, []);

    const saveEditing = useCallback(
      (messageId: string) => {
        const content = editTextareaRef.current?.value || editContentRef.current;
        if (content.trim()) {
          handleEditMessage(messageId, content);
        }
        setEditingMessageId(null);
        editContentRef.current = "";
      },
      [handleEditMessage]
    );

    // Toggle message action bar visibility on tap/click
    const toggleMessageActions = useCallback((messageId: string) => {
      setExpandedMessageId((prev) => (prev === messageId ? null : messageId));
    }, []);

    const shouldAnchorMessages = !isLoadingHistory;

    return (
      <div className={styles.chatMessages} data-streaming={shouldShowPendingStreamIndicator ? "true" : undefined}>
        {(hasMoreHistory || isLoadingHistory) && (
          <button
            type="button"
            className={styles.chatHistoryLoadMore}
            onClick={onLoadOlder}
            disabled={isLoadingHistory || !onLoadOlder}
          >
            {isLoadingHistory ? t("Loading earlier messages...") : t("Load earlier messages")}
          </button>
        )}
        {shouldAnchorMessages && <div className={styles.chatMessagesSpacer} aria-hidden="true" />}
        {messages.map((message, messageIndex) => {
	          const isUser = message.role === "user";
	          const isAssistant = !isUser;
	          const rawContent = message.content ?? "";
	          const assistantSections = isAssistant ? parseStructuredAssistantMessage(rawContent) : null;
	          const rawThinkingText = isAssistant ? assistantSections?.thinking ?? null : null;
	          const aiText = isAssistant ? assistantSections?.ai ?? rawContent : rawContent;
          const hasRawThinkingText =
            typeof rawThinkingText === "string" && rawThinkingText.trim().length > 0;
          const shouldSurfaceThinking = hasRawThinkingText || Boolean(reasoningMode);
          const useThinkingAsAnswer =
            !shouldSurfaceThinking &&
            typeof rawThinkingText === "string" &&
            rawThinkingText.trim().length > 0 &&
            (!aiText || !aiText.trim());
	          const thinkingText = hasRawThinkingText ? rawThinkingText : null;
          const assistantTextCandidate = isAssistant
            ? useThinkingAsAnswer
              ? rawThinkingText ?? ""
              : aiText
            : rawContent;
          const sanitizedAssistantTextCandidate = stripGrayTitleMarkers(assistantTextCandidate);
          const assistantTextAfterRemovals = isAssistant
            ? sanitizedAssistantTextCandidate.replace(REMINDER_CODE_BLOCK_REGEX, "").trim()
            : sanitizedAssistantTextCandidate;
          const visibleAssistantText = isAssistant ? normalizeAssistantMath(assistantTextAfterRemovals) ?? "" : assistantTextAfterRemovals;
          const normalizedThinkingText = isAssistant ? normalizeAssistantMath(thinkingText) : thinkingText;
          const fullText = isAssistant ? visibleAssistantText : rawContent;
          const hasThinkingContent = typeof normalizedThinkingText === "string" && normalizedThinkingText.trim().length > 0;
	          const isStreamingMessage = isAssistant && message.id === activeStreamingMessageId;
	          const hasTextContent = Boolean(visibleAssistantText.trim());
	          const assistantReminders = isAssistant && Array.isArray(message.reminders) ? message.reminders : [];
	          const showAssistantMarkdown = isAssistant && hasTextContent;
	          const hasVisibleContent = hasThinkingContent || showAssistantMarkdown || assistantReminders.length > 0;
	          const isStreamingAssistantMessage = isAssistant && isStreamingMessage;
	          const isAwaitingStreamContent = isStreamingAssistantMessage && !hasVisibleContent;
	          const showStreamingIndicator = isStreamingAssistantMessage;
          const shouldHideEmptyAssistantMessage = isAssistant && !hasVisibleContent && !isAwaitingStreamContent;
          const messageTimestampIso =
            typeof message.createdAt === "number" && Number.isFinite(message.createdAt)
              ? new Date(message.createdAt).toISOString()
              : undefined;
          const timestampLabel = formatMessageTimestamp(message.createdAt, t);

          if (shouldHideEmptyAssistantMessage) {
            return null;
          }

          if (isUser && !rawContent.trim()) {
            return null;
          }

          const responseDurationLabel = isAssistant ? getResponseDurationLabel(messageIndex) : null;
          const tokenCount = isAssistant ? estimateTokenCount(rawContent) : null;
          const hasTokenEstimate = typeof tokenCount === "number" && Number.isFinite(tokenCount) && tokenCount > 0;
          const metadataTokenLabel = hasTokenEstimate ? t("{count} tokens", { count: tokenCount.toLocaleString() }) : "—";
          const metadataRows: { label: string; value: string }[] = [];
          metadataRows.push({ label: t("Tokens"), value: metadataTokenLabel });
          if (responseDurationLabel) {
            metadataRows.push({ label: t("Duration"), value: responseDurationLabel });
          }
	          const backendTimingLabel = formatBackendTimingLabel(message.backendTimings);
	          if (backendTimingLabel) {
	            metadataRows.push({ label: t("Backend"), value: backendTimingLabel });
	          }
	          const isRegenerating = regeneratingMessageId === message.id;
	          const messageBodyClassName = isUser ? `${styles.chatBubble} ${styles.chatBubbleUser}` : styles.chatAssistantBlock;

          return (
            <div
              key={message.id}
              className={styles.chatMessage}
              data-role={isUser ? "user" : "assistant"}
              data-streaming={isStreamingMessage ? "true" : undefined}
              data-actions-expanded={expandedMessageId === message.id ? "true" : undefined}
              onClick={() => {
                // Only toggle if not editing
                if (!editingMessageId) {
                  toggleMessageActions(message.id);
                }
              }}
            >
              {message.attachments && message.attachments.length > 0 ? (
                <ChatMessageAttachments attachments={message.attachments} t={t} />
              ) : null}
              <div className={messageBodyClassName}>
                {editingMessageId === message.id ? (
                  <ChatMessageEditor
                    defaultValue={rawContent}
                    textareaRef={editTextareaRef}
                    onCancel={cancelEditing}
                    onSave={() => saveEditing(message.id)}
                  />
                ) : (
                  <>
                    {isAwaitingStreamContent && (() => {
                      const toolStatus = extractCurrentToolStatus(rawContent, t);
                      const effectiveLabel = toolStatus ?? searchStatusLabel ?? null;
                      const isSearchVariant = Boolean(searchStatusLabel && (!toolStatus || toolStatus === searchStatusLabel));
                      return (
                        <GrayStreamingSpinner
                          toolLabel={effectiveLabel}
                          variant={isSearchVariant ? "search" : "default"}
                        />
                      );
                    })()}

                    {assistantReminders.length > 0 ? (
                      <div className={styles.reminderCardList}>
                        {assistantReminders.map((reminder, reminderIndex) => (
                          <ReminderCard
                            key={`${message.id}-reminder-${reminderIndex}-${reminder.data.reminder_id ?? reminder.data.id}`}
                            reminder={reminder}
                          />
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && hasThinkingContent && (
                      <ThinkingBlock
                        content={normalizedThinkingText ?? ""}
                        markdownComponents={markdownComponents}
                        reasoningSeconds={message.reasoningSeconds}
                        isActivelyThinking={isStreamingMessage && isActivelyThinking}
                        thinkingStartTime={isStreamingMessage ? thinkingStartTime : null}
                        isStreamingMessage={isStreamingMessage}
                      />
                    )}
                    {hasTextContent && (
                      <div className={styles.chatMarkdown}>
                        <ReactMarkdown
                          components={markdownComponents}
                          remarkPlugins={MARKDOWN_PLUGINS}
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        >
                          {visibleAssistantText}
                        </ReactMarkdown>
                      </div>
                    )}
                    {isAssistant && message.groundingMetadata ? (
                      <ChatMessageGroundingPanel
                        metadata={message.groundingMetadata}
                        messageId={message.id}
                        previousUserMessageLowercase={(() => {
                          for (let index = messageIndex - 1; index >= 0; index -= 1) {
                            const prior = messages[index];
                            if (prior && prior.role === "user" && typeof prior.content === "string") {
                              return prior.content.trim().toLowerCase();
                            }
                          }
                          return null;
                        })()}
                        t={t}
                      />
                    ) : null}
                  </>
                )}
              </div>
              {!showStreamingIndicator && editingMessageId !== message.id && (
                <ChatMessageFooter
                  message={message}
                  isAssistant={isAssistant}
                  rawContent={rawContent}
                  fullText={fullText}
                  timestampIso={messageTimestampIso}
                  timestampLabel={timestampLabel}
                  metadataRows={metadataRows}
                  copiedMessageId={copiedMessageId}
                  isRegenerating={isRegenerating}
                  isResponding={isResponding}
                  onCopyMessage={(text) => handleCopyMessage(message.id, text)}
                  onRegenerate={() => handleRegenerate(message.id)}
                  onEdit={() => startEditing(message.id, rawContent)}
                  onRetry={() => handleRetryUserMessage(message.id)}
                  onDelete={() => handleDeleteMessage(message.id)}
                  onCycleVariant={(direction) => handleCycleAssistantVariant(message.id, direction)}
                  t={t}
                />
              )}
            </div>
          );
        })}

        {shouldShowPendingStreamIndicator && (
          <div className={styles.chatMessage} data-role="assistant">
            <div className={styles.chatAssistantBlock}>
              {(() => {
                const fallbackToolStatus =
                  messages.length > 0 && messages[messages.length - 1].role === "assistant"
                    ? extractCurrentToolStatus(messages[messages.length - 1].content, t)
                    : null;
                const effectiveLabel = searchStatusLabel ?? fallbackToolStatus;
                const isSearchVariant = Boolean(searchStatusLabel && (!fallbackToolStatus || fallbackToolStatus === searchStatusLabel));
                return (
                  <GrayStreamingSpinner
                    reasoningSeconds={reasoningSeconds}
                    toolLabel={effectiveLabel}
                    variant={isSearchVariant ? "search" : "default"}
                  />
                );
              })()}
            </div>
          </div>
        )}

        <div ref={scrollAnchorRef} className={styles.chatScrollAnchor} />
      </div>
    );
  }
);

ChatMessagesList.displayName = "ChatMessagesList";
