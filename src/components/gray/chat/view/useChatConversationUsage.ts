import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ContextUsageSummary } from "@/components/gray/types";
import { apiService, type ConversationUsage } from "@/lib/api";
import type { ChatMessage } from "../types";
import { estimateTokenCount } from "./formatting";

type UseChatConversationUsageOptions = {
  activeConversationId: string | null;
  sessionConversationId: string | null;
  sessionExists: boolean;
  messages: ChatMessage[];
  workspaceContext: string | null;
  onContextUsageChange?: (summary: ContextUsageSummary | null) => void;
};

type UseChatConversationUsageResult = {
  conversationUsage: ConversationUsage | null;
  setConversationUsage: Dispatch<SetStateAction<ConversationUsage | null>>;
};

export const useChatConversationUsage = ({
  activeConversationId,
  sessionConversationId,
  sessionExists,
  messages,
  workspaceContext,
  onContextUsageChange,
}: UseChatConversationUsageOptions): UseChatConversationUsageResult => {
  const [storedConversationUsage, setStoredConversationUsage] = useState<ConversationUsage | null>(null);

  const conversationUsage =
    activeConversationId && storedConversationUsage?.conversationId === activeConversationId
      ? storedConversationUsage
      : null;

  const setConversationUsage = useCallback<Dispatch<SetStateAction<ConversationUsage | null>>>(
    (updater) => {
      setStoredConversationUsage((prev) => {
        if (!activeConversationId) {
          return prev;
        }
        if (prev && prev.conversationId !== activeConversationId) {
          return prev;
        }
        return typeof updater === "function"
          ? (updater as (value: ConversationUsage | null) => ConversationUsage | null)(prev)
          : updater;
      });
    },
    [activeConversationId]
  );

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    let cancelled = false;

    const loadUsage = async () => {
      try {
        const usage = await apiService.getConversationUsage(activeConversationId);
        if (!cancelled) {
          setStoredConversationUsage(usage);
        }
      } catch (error) {
        if (!cancelled) {
          console.info("Conversation usage unavailable:", error);
          setStoredConversationUsage(null);
        }
      }
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  const contextLimit =
    typeof conversationUsage?.limit === "number" && conversationUsage.limit > 0 ? conversationUsage.limit : 0;

  const fallbackConversationTokens = useMemo(() => {
    if (!messages.length) {
      return 0;
    }
    return messages.reduce((total, message) => total + estimateTokenCount(message.content), 0);
  }, [messages]);

  const conversationContextStats = useMemo(() => {
    const limit = contextLimit;
    const messageCount = messages.length;

    const backendMessageCount = conversationUsage?.messageCount ?? -1;
    const isBackendFresh = backendMessageCount === messageCount;

    const conversationTokens =
      isBackendFresh && typeof conversationUsage?.conversationTokens === "number" && conversationUsage.conversationTokens >= 0
        ? conversationUsage.conversationTokens
        : fallbackConversationTokens;

    const workspaceTokens = estimateTokenCount(workspaceContext);

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
  }, [contextLimit, conversationUsage, fallbackConversationTokens, messages.length, workspaceContext]);

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
    conversationContextStats.modelLimit,
    conversationContextStats.modelName,
    conversationContextStats.provider,
    conversationContextStats.totalTokens,
    conversationContextStats.tokensRemaining,
    conversationContextStats.workspaceTokens,
    onContextUsageChange,
    sessionConversationId,
    sessionExists,
  ]);

  return { conversationUsage, setConversationUsage };
};
