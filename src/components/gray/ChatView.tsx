"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  RefreshCw,
  Volume2,
  Copy,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Paperclip,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import styles from "@/app/gray/GrayPageClient.module.css";
import { SYSTEM_PROMPT, useChatStore, buildAssistantReply } from "./ChatProvider";
import { useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";

type GrayChatViewProps = {
  sessionId: string | null;
};

const MAX_COMPOSER_HEIGHT = 160;

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now();
  const delta = now - timestamp;
  const minutes = Math.floor(delta / (60 * 1000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
};

export function GrayChatView({ sessionId }: GrayChatViewProps) {
  const { getSession, appendMessage, updateSession } = useChatStore();
  const session = sessionId ? getSession(sessionId) : undefined;
  const { user } = useUser();
  const [draft, setDraft] = useState("");
  const replyTimeout = useRef<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const isLoadingHistoryRef = useRef<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const activeSessionId = session?.id ?? null;
  const activeConversationId = session?.conversationId ?? null;

  const messages = useMemo(
    () => session?.messages ?? [],
    [session?.messages]
  );
  const resizeComposer = useCallback((target?: HTMLTextAreaElement | null) => {
    const element = target ?? composerRef.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    const nextHeight = Math.min(element.scrollHeight, MAX_COMPOSER_HEIGHT);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    if (!scrollAnchorRef.current) {
      return;
    }
    scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, session?.isResponding]);

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
    resizeComposer();
  }, [resizeComposer, draft]);

  useEffect(() => {
    resizeComposer();
  }, [messages.length, resizeComposer]);

  useEffect(() => {
    if (!activeSessionId || !activeConversationId) {
      setIsHistoryLoading(false);
      isLoadingHistoryRef.current = null;
      return;
    }

    if (isLoadingHistoryRef.current === activeConversationId) {
      return;
    }

    let cancelled = false;
    setIsHistoryLoading(true);
    isLoadingHistoryRef.current = activeConversationId;

    (async () => {
      try {
        const history = await apiService.getConversation(activeConversationId);
        if (cancelled) {
          return;
        }
        if (!history.length) {
          return;
        }

        const mappedHistory = history.map((message, index) => ({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${activeConversationId}-${index}-${Date.now()}`,
          role: message.role === "model" ? "assistant" : "user",
          content: message.text,
          createdAt: Date.now(),
        }));

        updateSession(activeSessionId, {
          messages: mappedHistory,
          updatedAt: Date.now(),
          isResponding: false,
        });
      } catch (error) {
        console.error("Failed to load conversation history:", error);
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, activeSessionId, updateSession]);

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    resizeComposer(event.currentTarget);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !session) {
      return;
    }

    appendMessage(session.id, "user", content);
    setDraft("");
    resizeComposer();
    if (replyTimeout.current !== null) {
      window.clearTimeout(replyTimeout.current);
    }

    if (user) {
      const conversationId = session.conversationId;
      (async () => {
        try {
          const response = await apiService.sendMessage({
            message: content,
            conversation_id: conversationId,
            system_prompt: SYSTEM_PROMPT,
            user_id: user.id,
          });
          updateSession(session.id, { conversationId: response.conversation_id });
          appendMessage(session.id, "assistant", response.response);
        } catch (error) {
          console.error("Failed to send message:", error);
          updateSession(session.id, { isResponding: false });
        }
      })();
      return;
    }

    replyTimeout.current = window.setTimeout(() => {
      appendMessage(session.id, "assistant", buildAssistantReply(content));
      replyTimeout.current = null;
    }, 700);
  };

  const firstAssistantIndex = useMemo(
    () => messages.findIndex((message) => message.role === "assistant"),
    [messages]
  );

  if (!session) {
    return (
      <div className={styles.chatViewEmpty}>
        <div>
          <h2>We could not find that chat.</h2>
          <p>Select another conversation from the sidebar or start a new one.</p>
        </div>
      </div>
    );
  }

  const isResponding = session.isResponding;

  return (
    <div className={styles.chatView} aria-live="polite">
      <div className={styles.chatViewport}>
        <div className={styles.chatFade} aria-hidden="true" />
        <div className={styles.chatMessages}>
          {isHistoryLoading && (
            <div className={styles.chatMessage} data-role="assistant">
              <div className={styles.chatBubble}>
                <div className={styles.chatTyping}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isAssistant = !isUser;
            const isPrimaryAssistant = isAssistant && index === firstAssistantIndex;
            const quickReplies = isPrimaryAssistant
              ? ["Share a fun fact about AI", "Discuss latest xAI updates"]
              : [];
            return (
              <div
                key={message.id}
                className={styles.chatMessage}
                data-role={isUser ? "user" : "assistant"}
              >
                <div className={styles.chatBubble}>
                  <div className={styles.chatMarkdown}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
                {isAssistant && (
                  <div className={styles.chatMessageFooter}>
                    <div className={styles.chatActionRow}>
                      <button type="button" aria-label="Regenerate response">
                        <RefreshCw size={15} />
                      </button>
                      <button type="button" aria-label="Listen to response">
                        <Volume2 size={15} />
                      </button>
                      <button type="button" aria-label="Copy response">
                        <Copy size={15} />
                      </button>
                      <button type="button" aria-label="Share response">
                        <Share2 size={15} />
                      </button>
                      <button type="button" aria-label="Thumbs up">
                        <ThumbsUp size={15} />
                      </button>
                      <button type="button" aria-label="Thumbs down">
                        <ThumbsDown size={15} />
                      </button>
                      <span aria-hidden="true">1.6s</span>
                    </div>
                    {quickReplies.length > 0 && (
                      <div className={styles.chatQuickReplies}>
                        {quickReplies.map((reply) => (
                          <button key={reply} type="button">
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {isResponding && (
            <div className={styles.chatMessage} data-role="assistant">
              <div className={styles.chatBubble}>
                <div className={styles.chatTyping}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      <form className={styles.chatComposer} onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={handleDraftChange}
          placeholder="Message Gray"
          className={styles.chatComposerInput}
          rows={1}
          ref={composerRef}
        />
        <div className={styles.chatComposerActions}>
          <button type="button" className={styles.chatComposerSecondary} aria-label="Open attachments">
            <Paperclip size={16} />
          </button>
          <button
            type="submit"
            aria-label="Send message"
            className={styles.chatComposerSend}
            disabled={isResponding || !draft.trim()}
          >
            {isResponding ? (
              <Loader2 size={18} className={styles.chatSpinner} />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </div>
      </form>
      <p className={styles.chatDisclaimer}>Gray can make mistakes. Check important info.</p>
    </div>
  );
}
