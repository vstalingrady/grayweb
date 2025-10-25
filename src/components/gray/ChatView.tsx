"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Loader2, UserRound } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from "@/app/gray/GrayPageClient.module.css";
import { useChatStore, buildAssistantReply } from "./ChatProvider";
import { useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";

type GrayChatViewProps = {
  sessionId: string | null;
};

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
  const isLoadingHistoryRef = useRef<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const activeSessionId = session?.id ?? null;
  const activeConversationId = session?.conversationId ?? null;

  const messages = session?.messages ?? [];
  const subtitle = session
    ? `Updated ${formatRelativeTime(session.updatedAt)}`
    : "Chat not found";

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !session) {
      return;
    }

    appendMessage(session.id, "user", content);
    setDraft("");
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
    <div className={styles.chatView}>
      <div className={styles.chatViewport}>
        <div className={styles.chatIntro}>
          <div className={styles.chatIntroAvatar} aria-hidden="true">
            <Bot size={24} />
          </div>
          <div>
            <h2>{session.title || "New Chat"}</h2>
            <p>{subtitle}</p>
          </div>
        </div>

        <div className={styles.chatMessages}>
          {isHistoryLoading && (
            <div className={`${styles.chatMessage} ${styles.chatMessageAssistant}`}>
              <div className={styles.chatMessageAvatar} aria-hidden="true">
                <Bot size={18} />
              </div>
              <div className={styles.chatBubble}>
                <div className={styles.chatTyping}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`${styles.chatMessage} ${
                  isUser ? styles.chatMessageUser : styles.chatMessageAssistant
                }`}
              >
                <div className={styles.chatMessageAvatar} aria-hidden="true">
                  {isUser ? <UserRound size={18} /> : <Bot size={18} />}
                </div>
                <div className={styles.chatBubble}>
                  {isUser ? (
                    // User messages - plain text
                    message.content.split("\n").map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))
                  ) : (
                    // AI assistant messages - markdown rendering
                    <div className="prose prose-invert prose-p:text-gray-300 prose-li:text-gray-300 prose-headings:text-gray-100 prose-strong:text-gray-100 prose-code:text-sm prose-code:bg-black/50 prose-code:rounded prose-code:px-1.5 prose-code:py-1 prose-pre:bg-black/50 prose-pre:p-4 rounded-xl max-w-full">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isResponding && (
            <div className={`${styles.chatMessage} ${styles.chatMessageAssistant}`}>
              <div className={styles.chatMessageAvatar} aria-hidden="true">
                <Bot size={18} />
              </div>
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
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message Gray"
          className={styles.chatComposerInput}
          rows={1}
        />
        <div className={styles.chatComposerActions}>
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
