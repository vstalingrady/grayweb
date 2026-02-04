const LIVE_KEYWORDS = [
  "news",
  "breaking news",
  "latest news",
  "recent news",
  "current events",
  "today's news",
  "stock price",
  "stock prices",
  "stock market",
  "crypto price",
  "bitcoin price",
  "btc price",
  "eth price",
  "exchange rate",
  "currency rate",
  "interest rate",
  "inflation rate",
  "weather",
  "forecast",
  "temperature today",
  "traffic",
  "flight status",
  "train status",
  "nba score",
  "nfl score",
  "soccer score",
  "game score",
  "release date",
  "new version",
  "new update",
  "patch notes",
];

const SOFT_RECENCY_PATTERNS = [
  /\btoday\b/i,
  /\bright now\b/i,
  /\bcurrently\b/i,
  /\bthis week\b/i,
  /\bthis month\b/i,
  /\bthis year\b/i,
];

const HARD_RECENCY_PATTERNS = [
  /\blatest\b/i,
  /\brecent\b/i,
  /\bup to date\b/i,
  /\bup-to-date\b/i,
];

const EXPLICIT_PATTERNS = [
  /\bsearch\b/i,
  /\bgoogle\b/i,
  /\bweb\s*search\b/i,
  /\blook\s*up\b/i,
  /\blookup\b/i,
  /\bfind\s+on\s+the\s+web\b/i,
];

const QUESTION_PREFIXES = [
  "what",
  "whats",
  "what's",
  "who",
  "whos",
  "who's",
  "when",
  "where",
  "why",
  "how",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "will",
  "would",
];

const PERSONAL_RECENCY_PATTERNS = [
  /\b(today|right now|currently|this week|this month|this year)\b\s+(i|i'm|im|we|we're|our|my|me)\b/i,
];

const isQuestionLike = (normalized: string): boolean =>
  normalized.includes("?") || QUESTION_PREFIXES.some((prefix) => normalized.startsWith(`${prefix} `));

export type WebSearchDecision = {
  enabled: boolean;
  mode: "on" | "auto" | "off";
};

export const shouldEnableWebSearch = (message: string): boolean => {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (EXPLICIT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (LIVE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  if (normalized.includes("what's happening") || normalized.includes("whats happening")) {
    return true;
  }

  if (normalized.includes("what happened")) {
    return true;
  }

  const hasSoftRecency = SOFT_RECENCY_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasHardRecency = HARD_RECENCY_PATTERNS.some((pattern) => pattern.test(normalized));

  if (PERSONAL_RECENCY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if ((hasSoftRecency || hasHardRecency) && isQuestionLike(normalized)) {
    return true;
  }

  if (hasHardRecency && wordCount >= 2) {
    return true;
  }

  if (wordCount <= 2 && !isQuestionLike(normalized)) {
    return false;
  }

  if (/\b(202[3-9]|203[0-9])\b/.test(normalized)) {
    if (["news", "update", "updates", "trending"].some((phrase) => normalized.includes(phrase))) {
      return true;
    }
  }

  return false;
};

export const resolveWebSearchDecision = ({
  message,
  autoEnabled,
  manualEnabled,
}: {
  message: string;
  autoEnabled: boolean;
  manualEnabled: boolean;
}): WebSearchDecision => {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return { enabled: false, mode: "off" };
  }

  if (manualEnabled) {
    return { enabled: true, mode: "on" };
  }

  if (!autoEnabled) {
    return { enabled: false, mode: "off" };
  }

  const shouldUse = shouldEnableWebSearch(trimmed);
  return { enabled: shouldUse, mode: shouldUse ? "auto" : "off" };
};
