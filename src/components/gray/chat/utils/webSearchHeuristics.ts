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
  "new files",
  "brand new files",
  "just dropped",
  "just released",
  "conspiracy",
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

const EXPLICIT_SEARCH_PATTERNS = [
  /^\s*(?:please\s+|pls\s+)?(?:search|google|web\s*search|look\s*up|lookup|find\s+on\s+the\s+web)\b/i,
  /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:search|google|web\s*search|look\s*up|lookup|find\s+on\s+the\s+web)\b/i,
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

const SMALL_TALK_PATTERNS = [
  /^\s*(?:hi|hello|hey|yo|sup)\b/i,
  /^\s*(?:thanks|thank you|thx)\b/i,
  /^\s*(?:how are you|how's it going|whats up|what's up)\b/i,
  /^\s*(?:good morning|good afternoon|good evening)\b/i,
];

const STABLE_KNOWLEDGE_PATTERNS = [
  /\b(?:solve|simplify|factor|differentiate|integrate|derive|calculate|compute)\b/i,
  /\b(?:algebra|geometry|calculus|equation|formula|theorem|derivative|integral)\b/i,
  /\b(?:sqrt|square\s*root)\b/i,
  /\b(?:what does .+ mean)\b/i,
  /\b(?:define|definition of)\b/i,
];

const VERIFICATION_PATTERNS = [
  /\b(?:is it true|is this true|is that true)\b/i,
  /\b(?:rumor|rumour|hoax|myth|debunk|fact[\s-]?check|verify|verification|credible evidence|conspiracy)\b/i,
  /\b(?:did|does|do|is|are|was|were|has|have|had)\b[\s\S]{0,140}\b(?:actually|really|true|real|legit|confirmed|evidence)\b/i,
];

const TREND_PATTERNS = [
  /\btrending\b/i,
  /\bviral\b/i,
  /\bmeme(?:s)?\b/i,
  /\bmascot\b/i,
  /\bcontrovers(?:y|ial)\b/i,
  /\bwhat(?:'s| is)\s+up\s+with\b/i,
];

const TEMPORAL_QUESTION_PATTERNS = [
  /\bwhat\s+happened\b/i,
  /\bwhat(?:'s| is)\s+going\s+on\b/i,
];

const MEMORY_META_PATTERNS = [
  /\b(?:did|have)\s+(?:i|we)\s+(?:already\s+)?(?:ask|asked|search(?:ed)?(?:\s+up)?|google(?:d)?|look(?:ed)?\s*up)\b/i,
  /\bwhat\s+did\s+(?:i|we)\s+(?:ask|search(?:ed)?(?:\s+up)?|google(?:d)?|look(?:ed)?\s*up)\b/i,
  /\bdid\s+i\s+ask\s+before\b/i,
  /\b(?:earlier|before|previously)\b[\s\S]{0,30}\b(?:this|our)\s+(?:chat|conversation|thread|session)\b/i,
  /\bin\s+(?:this|our)\s+(?:chat|conversation|thread|session)\b/i,
];

const PERSONAL_RECENCY_PATTERNS = [
  /\b(today|right now|currently|this week|this month|this year)\b\s+(i|i'm|im|we|we're|our|my|me)\b/i,
  /\b(i|i'm|im|we|we're|our|my|me)\b[\s\S]{0,30}\b(today|right now|currently|this week|this month|this year)\b/i,
];

const FOLLOW_UP_PATTERNS = [
  /\b(?:what|how)\s+about\b/i,
  /\b(?:and|also)\s+(?:him|her|them|that|this|it)\b/i,
  /\b(?:about|regarding)\s+(?:him|her|them|that|this|it)\b/i,
  /\b(?:same|related|more\s+on\s+that)\b/i,
];
const FOLLOW_UP_PRONOUN_PATTERN = /\b(him|her|them|that|this|it)\b/i;

const FOLLOW_UP_CONTEXT_KEYWORDS = [
  "news",
  "file",
  "files",
  "report",
  "reports",
  "document",
  "documents",
  "release",
  "update",
  "updates",
  "investigation",
  "case",
  "price",
  "weather",
  "score",
  "election",
  "policy",
  "court",
];

const isQuestionLike = (normalized: string): boolean =>
  normalized.includes("?") || QUESTION_PREFIXES.some((prefix) => normalized.startsWith(`${prefix} `));

const isSmallTalk = (trimmed: string, wordCount: number): boolean =>
  wordCount <= 8 && SMALL_TALK_PATTERNS.some((pattern) => pattern.test(trimmed));

const isAmbiguousFollowUp = (normalized: string): boolean =>
  FOLLOW_UP_PRONOUN_PATTERN.test(normalized) && FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized));

const isMemoryMetaQuery = (normalized: string): boolean =>
  MEMORY_META_PATTERNS.some((pattern) => pattern.test(normalized));

export type WebSearchDecision = {
  enabled: boolean;
  mode: "on" | "auto" | "off";
};

const isExplicitSearchRequest = (message: string): boolean => {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return false;
  }
  return EXPLICIT_SEARCH_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const shouldEnableWebSearch = (message: string, recentUserMessages?: string[]): boolean => {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const slangGuardTerms = new Set([
    "wtf",
    "idk",
    "omg",
    "lol",
    "lmfao",
    "rofl",
    "ngl",
    "tbh",
    "brb",
    "gtg",
    "what is wtf",
    "what does wtf mean",
  ]);

  if (isExplicitSearchRequest(trimmed)) {
    return true;
  }

  if (isMemoryMetaQuery(normalized)) {
    return false;
  }

  if (LIVE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  if ((normalized.includes("what's happening") || normalized.includes("whats happening")) && wordCount > 3) {
    return true;
  }

  const hasSoftRecency = SOFT_RECENCY_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasHardRecency = HARD_RECENCY_PATTERNS.some((pattern) => pattern.test(normalized));

  if (PERSONAL_RECENCY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if (isSmallTalk(trimmed, wordCount)) {
    return false;
  }

  if (slangGuardTerms.has(normalized)) {
    return false;
  }

  if (STABLE_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if (VERIFICATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (isAmbiguousFollowUp(normalized)) {
    return false;
  }

  if (wordCount <= 2 && !isQuestionLike(normalized)) {
    return false;
  }

  const questionLike = isQuestionLike(normalized);
  const hasTrendIntent = TREND_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasTemporalIntent = TEMPORAL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
  if ((hasSoftRecency || hasHardRecency) && questionLike) {
    return true;
  }
  if (hasTemporalIntent && questionLike) {
    return true;
  }
  if (hasTrendIntent && questionLike) {
    return true;
  }
  if (questionLike && /\b(202[3-9]|203[0-9])\b/.test(normalized)) {
    return true;
  }

  if (FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized)) && Array.isArray(recentUserMessages)) {
    for (let index = recentUserMessages.length - 1; index >= 0; index -= 1) {
      const prior = (recentUserMessages[index] || "").trim();
      if (!prior) {
        continue;
      }
      const priorNormalized = prior.toLowerCase();
      const priorWordCount = priorNormalized.split(/\s+/).filter(Boolean).length;
      if (priorNormalized === normalized) {
        continue;
      }
      if (isSmallTalk(prior, priorWordCount) || slangGuardTerms.has(priorNormalized)) {
        continue;
      }
      if (shouldEnableWebSearch(prior)) {
        return true;
      }
      if (FOLLOW_UP_CONTEXT_KEYWORDS.some((keyword) => priorNormalized.includes(keyword))) {
        return true;
      }
      if (
        isQuestionLike(priorNormalized) &&
        priorWordCount >= 4 &&
        (HARD_RECENCY_PATTERNS.some((pattern) => pattern.test(priorNormalized)) ||
          LIVE_KEYWORDS.some((keyword) => priorNormalized.includes(keyword)))
      ) {
        return true;
      }
      break;
    }
  }

  return false;
};

export const resolveWebSearchDecision = ({
  message,
  autoEnabled,
  manualEnabled,
  recentUserMessages,
}: {
  message: string;
  autoEnabled: boolean;
  manualEnabled: boolean;
  recentUserMessages?: string[];
}): WebSearchDecision => {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return { enabled: false, mode: "off" };
  }

  // Explicit user search requests should run even if auto-search is off.
  if (isExplicitSearchRequest(trimmed)) {
    return { enabled: true, mode: "on" };
  }

  if (manualEnabled) {
    return { enabled: true, mode: "on" };
  }

  if (!autoEnabled) {
    return { enabled: false, mode: "off" };
  }

  const shouldUse = shouldEnableWebSearch(trimmed, recentUserMessages);
  return { enabled: shouldUse, mode: "auto" };
};
