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

const RECENCY_TOKENS = [
  "today",
  "right now",
  "currently",
  "this week",
  "this month",
  "this year",
  "latest",
  "recent",
  "up to date",
  "up-to-date",
];

const EXPLICIT_PATTERNS = [
  /\bsearch\b/i,
  /\bgoogle\b/i,
  /\bweb\s*search\b/i,
  /\blook\s*up\b/i,
  /\blookup\b/i,
  /\bfind\s+on\s+the\s+web\b/i,
];

export const shouldEnableWebSearch = (message: string): boolean => {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();

  if (EXPLICIT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (LIVE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  if (RECENCY_TOKENS.some((token) => normalized.includes(token))) {
    return true;
  }

  if (normalized.includes("what's happening") || normalized.includes("whats happening")) {
    return true;
  }

  if (normalized.includes("what happened")) {
    return true;
  }

  if (/\b(202[3-9]|203[0-9])\b/.test(normalized)) {
    if (["news", "update", "updates", "trending"].some((phrase) => normalized.includes(phrase))) {
      return true;
    }
  }

  return false;
};
