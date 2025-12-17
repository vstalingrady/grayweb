import { useCallback, useRef } from "react";

type AutoStreamState = {
  markAutoStreamTriggered: (sessionId: string, messageId?: string | null) => void;
  hasAutoStreamTriggered: (sessionId: string, messageId?: string | null) => boolean;
  resetAutoStreamState: (sessionId?: string | null) => void;
};

export const useAutoStreamState = (): AutoStreamState => {
  const autoStreamTriggeredRef = useRef<Set<string>>(new Set());

  const markAutoStreamTriggered = useCallback((sessionId: string, messageId?: string | null) => {
    if (!sessionId || !messageId) {
      return;
    }
    autoStreamTriggeredRef.current.add(`${sessionId}:${messageId}`);
  }, []);

  const hasAutoStreamTriggered = useCallback((sessionId: string, messageId?: string | null) => {
    if (!sessionId || !messageId) {
      return false;
    }
    return autoStreamTriggeredRef.current.has(`${sessionId}:${messageId}`);
  }, []);

  const resetAutoStreamState = useCallback((sessionId?: string | null) => {
    if (!sessionId) {
      autoStreamTriggeredRef.current.clear();
      return;
    }
    const prefix = `${sessionId}:`;
    const keysToDelete: string[] = [];
    autoStreamTriggeredRef.current.forEach((value) => {
      if (value.startsWith(prefix)) {
        keysToDelete.push(value);
      }
    });
    keysToDelete.forEach((key) => autoStreamTriggeredRef.current.delete(key));
  }, []);

  return { markAutoStreamTriggered, hasAutoStreamTriggered, resetAutoStreamState };
};

