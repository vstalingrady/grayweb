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
  const [composerHeight, setComposerHeight] = useState(0);
  const prevMessageCountRef = useRef(0);
  const prevSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const isSessionChange = prevSessionKeyRef.current !== sessionKey;
    const shouldScroll =
      prevSessionKeyRef.current !== sessionKey || prevMessageCountRef.current !== messages.length;
    if (!hasHydrated || !scrollAnchorRef.current) {
      prevMessageCountRef.current = messages.length;
      prevSessionKeyRef.current = sessionKey;
      return;
    }
    if (suppressAutoScroll) {
      prevMessageCountRef.current = messages.length;
      prevSessionKeyRef.current = sessionKey;
      return;
    }
    if (shouldScroll) {
      const allowAutoScroll = isSessionChange || (!userScrolledAwayRef.current && isAtBottomRef.current);
      if (allowAutoScroll) {
        // Keep the newest message visible when the user hasn't scrolled away.
        scrollAnchorRef.current.scrollIntoView({ behavior: "auto" });
      }
    }
    prevMessageCountRef.current = messages.length;
    prevSessionKeyRef.current = sessionKey;
  }, [hasHydrated, messages.length, sessionKey, suppressAutoScroll]);

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
    const isScrollingUp = currentScrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = currentScrollTop;
    isAtBottomRef.current = isNearBottom;
    if (isScrollingUp) {
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
      const viewport = chatViewportRef.current;
      const threshold = 120;
      const isNearBottom =
        !viewport || viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
      isAtBottomRef.current = isNearBottom;
      if (isNearBottom && !userScrolledAwayRef.current && scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: "instant" });
      }
    }
    prevStreamingIdRef.current = streamingTargetId;
  }, [streamingTargetId]);

  useEffect(() => {
    if (
      !streamingContentSignature ||
      !scrollAnchorRef.current ||
      !isAtBottomRef.current ||
      userScrolledAwayRef.current
    ) {
      return;
    }
    scrollAnchorRef.current.scrollIntoView({ behavior: "instant" });
  }, [streamingContentSignature]);

  useLayoutEffect(() => {
    const composer = composerDockRef.current;
    const viewport = chatViewportRef.current;
    if (!composer || !viewport || typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }

    let lastHeight = composer.offsetHeight;
    setComposerHeight(lastHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        const diff = newHeight - lastHeight;

        if (diff > 0) {
          const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 50;
          if (isNearBottom) {
            viewport.scrollTop += diff;
          }
        }

        lastHeight = newHeight;
        setComposerHeight((prev) => (prev === newHeight ? prev : newHeight));
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
  };
};
