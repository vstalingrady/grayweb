import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { ChatMessage } from "../types";

type UseChatViewScrollOptions = {
  hasHydrated: boolean;
  sessionKey: string | null;
  messages: ChatMessage[];
  activeStreamingMessageId: string | null;
  isResponding?: boolean;
  suppressAutoScroll?: boolean;
};

type UseChatViewScrollResult = {
  chatViewportRef: RefObject<HTMLDivElement | null>;
  scrollAnchorRef: RefObject<HTMLDivElement | null>;
  composerDockRef: RefObject<HTMLDivElement | null>;
  chatViewStyle: CSSProperties | undefined;
  handleScroll: () => void;
  forceScrollToBottom: () => void;
};

export const useChatViewScroll = ({
  hasHydrated,
  sessionKey,
  messages,
  activeStreamingMessageId,
  isResponding = false,
  suppressAutoScroll = false,
}: UseChatViewScrollOptions): UseChatViewScrollResult => {
  const chatViewportRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollResetTimeoutRef = useRef<number | null>(null);
  const userScrollIntentRef = useRef(false);
  const userScrollIntentResetTimeoutRef = useRef<number | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const prevMessageCountRef = useRef(0);
  const prevSessionKeyRef = useRef<string | null>(null);
  const prevTailMessageIdRef = useRef<string | null>(null);
  const initialScrollDoneRef = useRef(false);
  const initialSyncTimersRef = useRef<number[]>([]);

  const clearInitialSyncTimers = useCallback(() => {
    if (typeof window === "undefined") {
      initialSyncTimersRef.current = [];
      return;
    }
    for (const timeoutId of initialSyncTimersRef.current) {
      window.clearTimeout(timeoutId);
    }
    initialSyncTimersRef.current = [];
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = chatViewportRef.current;
    if (typeof window !== "undefined") {
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollResetTimeoutRef.current !== null) {
        window.clearTimeout(programmaticScrollResetTimeoutRef.current);
      }
      programmaticScrollResetTimeoutRef.current = window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        programmaticScrollResetTimeoutRef.current = null;
      }, 140);
    }
    if (viewport) {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = maxScroll;
      isAtBottomRef.current = true;
      return;
    }
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "auto" });
      isAtBottomRef.current = true;
    }
  }, []);

  const forceScrollToBottom = useCallback(() => {
    userScrolledAwayRef.current = false;
    isAtBottomRef.current = true;
    scrollToBottom();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        userScrolledAwayRef.current = false;
        isAtBottomRef.current = true;
        scrollToBottom();
      });
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (prevSessionKeyRef.current === sessionKey) {
      return;
    }
    userScrolledAwayRef.current = false;
    isAtBottomRef.current = true;
    lastScrollTopRef.current = 0;
    initialScrollDoneRef.current = false;
    clearInitialSyncTimers();
  }, [clearInitialSyncTimers, sessionKey]);

  useEffect(() => {
    const isSessionChange = prevSessionKeyRef.current !== sessionKey;
    const currentTailMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const didAppendAtTail =
      messages.length > prevMessageCountRef.current &&
      prevTailMessageIdRef.current !== (currentTailMessage?.id ?? null);
    const shouldForceScrollForUserSend = !isSessionChange && didAppendAtTail && currentTailMessage?.role === "user";
    const shouldScroll =
      prevSessionKeyRef.current !== sessionKey || prevMessageCountRef.current !== messages.length;
    if (!hasHydrated || !scrollAnchorRef.current) {
      prevMessageCountRef.current = messages.length;
      prevSessionKeyRef.current = sessionKey;
      prevTailMessageIdRef.current = currentTailMessage?.id ?? null;
      return;
    }
    if (suppressAutoScroll && !isSessionChange) {
      prevMessageCountRef.current = messages.length;
      prevSessionKeyRef.current = sessionKey;
      prevTailMessageIdRef.current = currentTailMessage?.id ?? null;
      return;
    }
    if (shouldScroll) {
      if (shouldForceScrollForUserSend) {
        userScrolledAwayRef.current = false;
        isAtBottomRef.current = true;
        scrollToBottom();
      } else if (isSessionChange && !initialScrollDoneRef.current) {
        userScrolledAwayRef.current = false;
        scrollToBottom();
        clearInitialSyncTimers();
        if (typeof window !== "undefined") {
          const stabilizationDelays = [0, 16, 32, 64, 120, 220, 360, 520];
          stabilizationDelays.forEach((delay, index) => {
            const timeoutId = window.setTimeout(() => {
              if (userScrolledAwayRef.current) {
                return;
              }
              scrollToBottom();
              if (index === stabilizationDelays.length - 1) {
                initialScrollDoneRef.current = true;
              }
            }, delay);
            initialSyncTimersRef.current.push(timeoutId);
          });
        } else {
          initialScrollDoneRef.current = true;
        }
      } else {
        const allowAutoScroll = !userScrolledAwayRef.current && isAtBottomRef.current;
        if (allowAutoScroll) {
          scrollToBottom();
        }
      }
    }
    prevMessageCountRef.current = messages.length;
    prevSessionKeyRef.current = sessionKey;
    prevTailMessageIdRef.current = currentTailMessage?.id ?? null;
  }, [clearInitialSyncTimers, hasHydrated, messages, scrollToBottom, sessionKey, suppressAutoScroll]);

  useEffect(() => () => clearInitialSyncTimers(), [clearInitialSyncTimers]);

  useEffect(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }
      if (programmaticScrollResetTimeoutRef.current !== null) {
        window.clearTimeout(programmaticScrollResetTimeoutRef.current);
        programmaticScrollResetTimeoutRef.current = null;
      }
      if (userScrollIntentResetTimeoutRef.current !== null) {
        window.clearTimeout(userScrollIntentResetTimeoutRef.current);
        userScrollIntentResetTimeoutRef.current = null;
      }
      isProgrammaticScrollRef.current = false;
      userScrollIntentRef.current = false;
    },
    []
  );

  const streamingTargetId = useMemo(() => {
    if (activeStreamingMessageId) {
      return activeStreamingMessageId;
    }
    if (!isResponding) {
      return null;
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [activeStreamingMessageId, isResponding, messages]);

  const streamingContentSignature = useMemo(() => {
    if (!streamingTargetId) {
      return null;
    }
    const target = messages.find((message) => message.id === streamingTargetId);
    if (!target) {
      return null;
    }
    const contentLength = target.content?.length ?? 0;
    return `${streamingTargetId}:${contentLength}`;
  }, [messages, streamingTargetId]);

  const handleScroll = useCallback(() => {
    const viewport = chatViewportRef.current;
    if (!viewport) {
      return;
    }
    const threshold = 120;
    const currentScrollTop = viewport.scrollTop;
    const isNearBottom = viewport.scrollHeight - currentScrollTop - viewport.clientHeight <= threshold;
    lastScrollTopRef.current = currentScrollTop;
    isAtBottomRef.current = isNearBottom;
    if (isProgrammaticScrollRef.current) {
      if (isNearBottom) {
        userScrolledAwayRef.current = false;
      }
      return;
    }
    if (!isNearBottom && userScrollIntentRef.current) {
      userScrolledAwayRef.current = true;
      return;
    }
    if (isNearBottom) {
      userScrolledAwayRef.current = false;
    }
  }, []);

  // When streaming begins (activeStreamingMessageId becomes non-null), auto-scroll to bottom
  // This ensures users see the AI response even if they weren't at the bottom
  const prevStreamingIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Detect when streaming just started
    if (streamingTargetId && !prevStreamingIdRef.current) {
      if (!userScrolledAwayRef.current) {
        isAtBottomRef.current = true;
        scrollToBottom();
      }
    }
    prevStreamingIdRef.current = streamingTargetId;
  }, [scrollToBottom, streamingTargetId]);

  useEffect(() => {
    if (
      !streamingContentSignature ||
      userScrolledAwayRef.current
    ) {
      return;
    }
    scrollToBottom();
  }, [scrollToBottom, streamingContentSignature]);

  useEffect(() => {
    if (!hasHydrated || suppressAutoScroll) {
      return;
    }
    const viewport = chatViewportRef.current;
    const anchor = scrollAnchorRef.current;
    if (!viewport || !anchor || typeof ResizeObserver === "undefined") {
      return;
    }

    const observedNode = anchor.parentElement ?? viewport;
    const observer = new ResizeObserver(() => {
      if (userScrolledAwayRef.current) {
        return;
      }
      if (streamingTargetId) {
        scrollToBottom();
        return;
      }
      const nearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 160;
      if (!nearBottom && initialScrollDoneRef.current) {
        return;
      }
      scrollToBottom();
    });

    observer.observe(observedNode);
    return () => observer.disconnect();
  }, [hasHydrated, scrollToBottom, sessionKey, suppressAutoScroll, streamingTargetId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const viewport = chatViewportRef.current;
    if (!viewport) {
      return;
    }

    const markUserScrollIntent = () => {
      userScrollIntentRef.current = true;
      const nearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 120;
      if (!nearBottom) {
        userScrolledAwayRef.current = true;
      }
      if (userScrollIntentResetTimeoutRef.current !== null) {
        window.clearTimeout(userScrollIntentResetTimeoutRef.current);
      }
      userScrollIntentResetTimeoutRef.current = window.setTimeout(() => {
        userScrollIntentRef.current = false;
        userScrollIntentResetTimeoutRef.current = null;
      }, 280);
    };

    viewport.addEventListener("wheel", markUserScrollIntent, { passive: true });
    viewport.addEventListener("touchstart", markUserScrollIntent, { passive: true });
    viewport.addEventListener("touchmove", markUserScrollIntent, { passive: true });
    viewport.addEventListener("pointerdown", markUserScrollIntent, { passive: true });

    return () => {
      viewport.removeEventListener("wheel", markUserScrollIntent);
      viewport.removeEventListener("touchstart", markUserScrollIntent);
      viewport.removeEventListener("touchmove", markUserScrollIntent);
      viewport.removeEventListener("pointerdown", markUserScrollIntent);
      if (userScrollIntentResetTimeoutRef.current !== null) {
        window.clearTimeout(userScrollIntentResetTimeoutRef.current);
        userScrollIntentResetTimeoutRef.current = null;
      }
      userScrollIntentRef.current = false;
    };
  }, [hasHydrated, sessionKey]);

  useLayoutEffect(() => {
    const composer = composerDockRef.current;
    const viewport = chatViewportRef.current;
    if (!composer || !viewport || typeof window === "undefined") {
      return;
    }

    let lastHeight = composer.offsetHeight;
    setComposerHeight(lastHeight);

    const applyHeight = (nextHeight: number) => {
      if (!Number.isFinite(nextHeight)) {
        return;
      }
      const diff = nextHeight - lastHeight;
      if (diff > 0) {
        const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 50;
        if (isNearBottom) {
          viewport.scrollTop += diff;
        }
      }
      lastHeight = nextHeight;
      setComposerHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => {
        applyHeight(composer.offsetHeight);
      };
      window.addEventListener("resize", handleResize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", handleResize);
      }
      return () => {
        window.removeEventListener("resize", handleResize);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener("resize", handleResize);
        }
      };
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        applyHeight(newHeight);
      }
    });

    observer.observe(composer);
    return () => observer.disconnect();
  }, []);

  const chatViewStyle: CSSProperties | undefined =
    composerHeight > 0 ? ({ "--chat-composer-height": `${composerHeight}px` } as CSSProperties) : undefined;

  return {
    chatViewportRef,
    scrollAnchorRef,
    composerDockRef,
    chatViewStyle,
    handleScroll,
    forceScrollToBottom,
  };
};
