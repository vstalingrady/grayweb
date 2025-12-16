import type { ChatMessage } from "../types";

export const formatDurationLabel = (durationMs?: number): string | null => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }
  const seconds = durationMs / 1000;
  if (seconds < 0.1) {
    const ms = Math.max(1, Math.round(durationMs));
    return `${ms}ms`;
  }
  if (seconds >= 10) {
    return `${Math.round(seconds)}s`;
  }
  return `${seconds.toFixed(1)}s`;
};

export const formatBackendTimingLabel = (timing?: ChatMessage["backendTimings"]): string | null => {
  if (!timing) {
    return null;
  }
  const totalLabel = formatDurationLabel(timing.totalMs);
  if (!totalLabel) {
    return null;
  }
  return totalLabel;
};

export const formatMessageTimestamp = (
  timestamp: number | undefined,
  t: (message: string, vars?: Record<string, string | number>) => string
): string => {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const timeLabel = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date >= startOfToday) {
    return timeLabel;
  }
  if (date >= startOfYesterday) {
    return `${t("Yesterday")} · ${timeLabel}`;
  }
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${dateLabel}, ${timeLabel}`;
};

const AVERAGE_CHARS_PER_TOKEN = 4;

export const estimateTokenCount = (content: string | null | undefined): number => {
  if (!content) {
    return 0;
  }
  const normalized = content.trim();
  if (!normalized) {
    return 0;
  }
  const lengthBased = Math.ceil(normalized.length / AVERAGE_CHARS_PER_TOKEN);
  const wordBased = normalized.split(/\s+/g).filter(Boolean).length;
  return Math.max(lengthBased, wordBased);
};

