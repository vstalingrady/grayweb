import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ChatMessage } from "../types";

type UseChatViewScrollOptions = {
  hasHydrated: boolean;
  sessionKey: string | null;
  messages: ChatMessage[];
  activeStreamingMessageId: string | null;
};

type UseChatViewScrollResult = {
  chatViewportRef: React.RefObject<HTMLDivElement>;
  scrollAnchorRef: React.RefObject<HTMLDivElement>;
  composerDockRef: React.RefObject<HTMLDivElement>;
  chatViewStyle: CSSProperties | undefined;
  handleScroll: () => void;
};

export const useChatViewScroll = ({
  hasHydrated,
  sessionKey,
  messages,
  activeStreamingMessageId,
}: UseChatViewScrollOptions): UseChatViewScrollResult => {
  const chatViewportRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const [composerHeight, setComposerHeight] = useState(0);

  useEffect(() => {
    if (!hasHydrated || !scrollAnchorRef.current) {
      return;
    }
    // Always keep the newest message visible.
    scrollAnchorRef.current.scrollIntoView({ behavior: "auto" });
  }, [hasHydrated, messages.length, sessionKey]);

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
    if (!viewport) {
      return;
    }
    const threshold = 300;
    const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
    isAtBottomRef.current = isNearBottom;
  }, []);

  useEffect(() => {
    if (!streamingContentSignature || !scrollAnchorRef.current || !isAtBottomRef.current) {
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

