"use client";

import { memo, useCallback, useMemo, useRef, useState, type RefObject } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import type { GroundingMetadata } from "@/lib/api";
import { useI18n } from "@/contexts/I18nContext";
import { REMINDER_CODE_BLOCK_REGEX } from "../constants";
import { stripGrayTitleMarkers } from "../utils";
import type { ChatMessage as ChatSessionMessage } from "../types";
import { extractCurrentToolStatus, parseStructuredAssistantMessage, resolveToolStatusInfo } from "./assistantMessageParsing";
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

type AssistantDisplayContent = {
  normalizedThinkingText: string | null;
  visibleAssistantText: string;
};

type InlineSourceLink = {
  href: string;
  label: string;
};

const extractGroundingChunks = (metadata?: GroundingMetadata | null) =>
  metadata?.grounding_chunks ??
  (metadata as { groundingChunks?: GroundingMetadata["grounding_chunks"] } | undefined)?.groundingChunks ??
  [];

const extractGroundingSupports = (metadata?: GroundingMetadata | null) =>
  metadata?.grounding_supports ??
  (metadata as { groundingSupports?: GroundingMetadata["grounding_supports"] } | undefined)?.groundingSupports ??
  [];

const extractGroundingSearchQueries = (metadata?: GroundingMetadata | null): string[] => {
  const rawQueries =
    metadata?.web_search_queries ??
    (metadata as { webSearchQueries?: string[] } | undefined)?.webSearchQueries ??
    [];
  return rawQueries
    .map((query) => (typeof query === "string" ? query.trim() : ""))
    .filter((query) => query.length > 0);
};

const deriveSourceLabel = (href: string): string => {
  try {
    return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "source";
  }
};

const buildInlineSourceLinks = (metadata?: GroundingMetadata | null): InlineSourceLink[] => {
  const chunks = extractGroundingChunks(metadata);
  if (!chunks?.length) {
    return [];
  }
  const links: InlineSourceLink[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const href = chunk?.web?.uri ?? chunk?.retrieved_context?.uri;
    if (typeof href !== "string" || !/^https?:\/\//i.test(href)) {
      continue;
    }
    if (seen.has(href)) {
      continue;
    }
    seen.add(href);
    links.push({ href, label: deriveSourceLabel(href) });
  }
  return links;
};

const injectInlineSourceLinks = (text: string, metadata?: GroundingMetadata): string => {
  const trimmed = text.trim();
  if (!trimmed || !metadata) {
    return text;
  }

  const links = buildInlineSourceLinks(metadata);
  if (links.length === 0) {
    return text;
  }

  const supports = extractGroundingSupports(metadata);
  const linkByChunkIndex = new Map<number, InlineSourceLink>();
  const chunks = extractGroundingChunks(metadata);
  chunks.forEach((chunk, index) => {
    const href = chunk?.web?.uri ?? chunk?.retrieved_context?.uri;
    if (typeof href !== "string" || !/^https?:\/\//i.test(href)) {
      return;
    }
    linkByChunkIndex.set(index, { href, label: deriveSourceLabel(href) });
  });

  const insertions: Array<{ index: number; link: InlineSourceLink }> = [];
  const seenInsertionKeys = new Set<string>();

  for (const support of supports) {
    const supportRecord = support as
      | (GroundingMetadata["grounding_supports"] extends Array<infer T> ? T : never)
      | { grounding_chunk_indices?: number[]; segment?: { end_index?: number }; end_index?: number }
      | undefined;
    const chunkIndices = supportRecord?.grounding_chunk_indices ?? [];
    const link = chunkIndices
      .map((index) => linkByChunkIndex.get(index))
      .find((candidate): candidate is InlineSourceLink => Boolean(candidate));
    if (!link) {
      continue;
    }
    const rawIndex = supportRecord?.segment?.end_index ?? supportRecord?.end_index;
    if (typeof rawIndex !== "number" || !Number.isFinite(rawIndex)) {
      continue;
    }
    const index = Math.max(0, Math.min(trimmed.length, Math.floor(rawIndex)));
    const dedupeKey = `${index}:${link.href}`;
    if (seenInsertionKeys.has(dedupeKey)) {
      continue;
    }
    seenInsertionKeys.add(dedupeKey);
    insertions.push({ index, link });
    if (insertions.length >= 10) {
      break;
    }
  }

  if (insertions.length > 0) {
    const sorted = [...insertions].sort((a, b) => b.index - a.index);
    let output = trimmed;
    for (const insertion of sorted) {
      if (output.includes(`](${insertion.link.href})`)) {
        continue;
      }
      const marker = ` [${insertion.link.label}](${insertion.link.href})`;
      output = `${output.slice(0, insertion.index)}${marker}${output.slice(insertion.index)}`;
    }
    return output;
  }

  // Fallback for providers that omit support offsets: attach sources at paragraph ends.
  const paragraphs = trimmed.split(/\n{2,}/);
  const maxInline = Math.min(links.length, paragraphs.length, 6);
  for (let index = 0; index < maxInline; index += 1) {
    const link = links[index];
    if (!paragraphs[index] || paragraphs[index].includes(`](${link.href})`)) {
      continue;
    }
    paragraphs[index] = `${paragraphs[index]} [${link.label}](${link.href})`;
  }
  return paragraphs.join("\n\n");
};

const getAssistantDisplayContent = (rawContent: string): AssistantDisplayContent => {
  const assistantSections = parseStructuredAssistantMessage(rawContent);
  const rawThinkingText = assistantSections?.thinking ?? null;
  const aiText = assistantSections?.ai ?? rawContent;
  const hasRawThinkingText = typeof rawThinkingText === "string" && rawThinkingText.trim().length > 0;
  const hasAiText = aiText.trim().length > 0;
  const useThinkingAsAnswer = hasRawThinkingText && !hasAiText;
  const shouldSurfaceThinking = hasRawThinkingText && !useThinkingAsAnswer;
  const assistantTextCandidate = useThinkingAsAnswer ? rawThinkingText ?? "" : aiText;
  const sanitizedAssistantTextCandidate = stripGrayTitleMarkers(assistantTextCandidate);
  const assistantTextAfterRemovals = sanitizedAssistantTextCandidate.replace(REMINDER_CODE_BLOCK_REGEX, "").trim();

  return {
    normalizedThinkingText: normalizeAssistantMath(shouldSurfaceThinking ? rawThinkingText : null),
    visibleAssistantText: normalizeAssistantMath(assistantTextAfterRemovals) ?? "",
  };
};

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

    const nearestPreviousUserQueryByIndex = useMemo(() => {
      const nearest: Array<string | null> = new Array(messages.length).fill(null);
      let lastUserText: string | null = null;
      for (let index = 0; index < messages.length; index += 1) {
        nearest[index] = lastUserText;
        const candidate = messages[index];
        if (candidate.role !== "user") {
          continue;
        }
        const text = typeof candidate.content === "string" ? candidate.content.trim() : "";
        if (!text) {
          continue;
        }
        lastUserText = text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
      }
      return nearest;
    }, [messages]);

    const latestUserQuery = useMemo(() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const entry = messages[index];
        if (entry.role !== "user") {
          continue;
        }
        const text = typeof entry.content === "string" ? entry.content.trim() : "";
        if (!text) {
          continue;
        }
        return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
      }
      return null;
    }, [messages]);

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
	          const assistantDisplayContent = isAssistant ? getAssistantDisplayContent(rawContent) : null;
          const visibleAssistantTextRaw = isAssistant ? assistantDisplayContent?.visibleAssistantText ?? "" : rawContent;
          const visibleAssistantText = isAssistant
            ? injectInlineSourceLinks(visibleAssistantTextRaw, message.groundingMetadata)
            : visibleAssistantTextRaw;
          const normalizedThinkingText = isAssistant ? assistantDisplayContent?.normalizedThinkingText ?? null : null;
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
          const toolStatusFromStream = message.toolStatus?.name ? resolveToolStatusInfo(message.toolStatus.name, t) : null;
          const parsedToolStatus = extractCurrentToolStatus(rawContent, t);
          const toolStatusInfo = toolStatusFromStream ?? parsedToolStatus;
          const groundingSearchQueries = extractGroundingSearchQueries(message.groundingMetadata);
          const latestGroundingQuery =
            groundingSearchQueries.length > 0 ? groundingSearchQueries[groundingSearchQueries.length - 1] : null;
          const previousUserQuery = nearestPreviousUserQueryByIndex[messageIndex] ?? null;
          const hasGroundingSearchQuery = Boolean(latestGroundingQuery);
          const spinnerVariant =
            toolStatusInfo?.variant ?? (searchStatusLabel || hasGroundingSearchQuery ? "search" : "default");
          const spinnerSearchQuery =
            typeof message.toolStatus?.query === "string" && message.toolStatus.query.trim().length > 0
              ? message.toolStatus.query.trim()
              : latestGroundingQuery ?? previousUserQuery;
          const isCompletedSearchStatus = Boolean(
            !isStreamingAssistantMessage &&
              (message.toolStatus?.status === "end" || hasGroundingSearchQuery) &&
              spinnerVariant === "search" &&
              spinnerSearchQuery
          );
          const spinnerLabel = isCompletedSearchStatus ? t("Searched") : toolStatusInfo?.label ?? searchStatusLabel ?? null;
          const shouldShowCompletedSearchInline = isCompletedSearchStatus && !message.groundingMetadata;
          const shouldShowInlineToolStatus =
            (isStreamingAssistantMessage && Boolean(toolStatusInfo) && !isAwaitingStreamContent) ||
            shouldShowCompletedSearchInline;
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
                    {(isAwaitingStreamContent || shouldShowInlineToolStatus) && (
                      <GrayStreamingSpinner
                        toolLabel={spinnerLabel}
                        variant={spinnerVariant}
                        searchQuery={spinnerSearchQuery}
                        searchState={isCompletedSearchStatus ? "completed" : "active"}
                      />
                    )}

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
                    {hasTextContent &&
                      (isStreamingMessage ? (
                        <div className={`${styles.chatMarkdown} ${styles.chatMarkdownStreaming}`} aria-live="polite">
                          <ReactMarkdown
                            components={markdownComponents}
                            remarkPlugins={MARKDOWN_PLUGINS}
                            rehypePlugins={[[rehypeKatex, { strict: false }]]}
                          >
                            {visibleAssistantText}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className={styles.chatMarkdown}>
                          <ReactMarkdown
                            components={markdownComponents}
                            remarkPlugins={MARKDOWN_PLUGINS}
                            rehypePlugins={[[rehypeKatex, { strict: false }]]}
                          >
                            {visibleAssistantText}
                          </ReactMarkdown>
                        </div>
                      ))}
                    {isAssistant && message.groundingMetadata ? (
                      <ChatMessageGroundingPanel
                        metadata={message.groundingMetadata}
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
                const lastAssistantMessage =
                  messages.length > 0 && messages[messages.length - 1].role === "assistant"
                    ? messages[messages.length - 1]
                    : null;
                const fallbackToolStatus =
                  lastAssistantMessage?.toolStatus?.name
                    ? resolveToolStatusInfo(lastAssistantMessage.toolStatus.name, t)
                    : lastAssistantMessage
                      ? extractCurrentToolStatus(lastAssistantMessage.content, t)
                      : null;
                const effectiveLabel = fallbackToolStatus?.label ?? searchStatusLabel;
                const isSearchVariant = fallbackToolStatus?.variant === "search" || Boolean(searchStatusLabel && !fallbackToolStatus);
                const fallbackSearchQuery =
                  typeof lastAssistantMessage?.toolStatus?.query === "string" &&
                  lastAssistantMessage.toolStatus.query.trim().length > 0
                    ? lastAssistantMessage.toolStatus.query.trim()
                    : latestUserQuery;
                return (
                  <GrayStreamingSpinner
                    reasoningSeconds={reasoningSeconds}
                    toolLabel={effectiveLabel}
                    variant={isSearchVariant ? "search" : "default"}
                    searchQuery={fallbackSearchQuery}
                    searchState="active"
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
