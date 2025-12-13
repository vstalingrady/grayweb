import type { ContextUsageSummary } from "@/components/gray/types";

export const DEFAULT_CONTEXT_VISUALIZATION_LIMIT = 1_048_576;

const normalizePositiveNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
};

export const getContextUsageVisualizationLimit = (usage?: ContextUsageSummary | null): number => {
  const hardLimit = normalizePositiveNumber(usage?.limit);
  const modelLimit = normalizePositiveNumber(usage?.modelLimit);
  return hardLimit || modelLimit || DEFAULT_CONTEXT_VISUALIZATION_LIMIT;
};

export const getContextUsageUsedTokens = (usage?: ContextUsageSummary | null): number => {
  if (!usage) {
    return 0;
  }
  const totalTokens = typeof usage.totalTokens === "number" && usage.totalTokens >= 0 ? usage.totalTokens : 0;
  const conversationTokens =
    typeof usage.conversationTokens === "number" && usage.conversationTokens >= 0 ? usage.conversationTokens : 0;
  return totalTokens || conversationTokens;
};

export const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

