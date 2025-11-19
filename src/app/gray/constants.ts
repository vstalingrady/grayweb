export const DEFAULT_EVENT_COLOR = "#4f63ff";
export const REMINDER_RETENTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const sanitizeEventColor = (value?: string | null): string => {
  if (!value) {
    return DEFAULT_EVENT_COLOR;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_EVENT_COLOR;
  }
  if (trimmed.toLowerCase().includes("gradient") || trimmed.toLowerCase().startsWith("url(")) {
    return DEFAULT_EVENT_COLOR;
  }
  return trimmed;
};
