// Chat session constants
export const SESSION_STORAGE_KEY_BASE = "gray-chat-sessions-v1";
export const GENERAL_SESSION_ID = "general-session";
export const GENERAL_CHAT_SESSION_ID = GENERAL_SESSION_ID;
export const GENERAL_SESSION_TITLE = "General Chat";
export const SHARED_CHAT_PLACEHOLDER_TITLE = "New Chat";
export const GENERAL_CONVERSATION_PREFIX = "general:";

// Timing constants
export const FALLBACK_ASSISTANT_DELAY_MS = 150;
export const DUPLICATE_THREAD_WINDOW_MS = 15000;
export const REMOTE_SESSION_MERGE_WINDOW_MS = 5 * 60 * 1000;
export const REMINDER_POLL_MIN_INTERVAL = 60_000;
export const REMINDER_POLL_SHORT_INTERVAL = 15_000;

// Placeholder session IDs
export const PLACEHOLDER_SESSION_IDS = new Set([
    "session-subjective-attractiveness",
    "session-mobile-fade-effect",
    "session-chat-log-analysis",
]);

export const PLACEHOLDER_TITLES = new Set([
    "Subjective Attractiveness",
    "Mobile-Friendly Fade Effect",
    "Chat Log Analysis Techniques",
]);

// Keywords and patterns
export const WORKSPACE_CONTEXT_KEYWORDS = [
    "calendar",
    "schedule",
    "event",
    "meeting",
    "plan",
    "task",
    "todo",
    "habit",
    "routine",
    "goal",
    "project",
    "focus",
    "pulse",
    "history",
    "reminder",
];

export const LOW_SIGNAL_TITLE_WORDS = new Set<string>([
    "hi",
    "hi there",
    "hey",
    "hey there",
    "hello",
    "hola",
    "yo",
    "sup",
    "gm",
    "gn",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "whats up",
    "what's up",
]);

// Regex patterns
export const GREETING_PATTERN =
    /^(?:hi|hey|hello|hiya|yo|sup|what'?s up|howdy|good (?:morning|afternoon|evening)|hola|h[ae]y there|hi there|hey there|gm|gn|good night)\b[^\w]*$/i;

export const SELF_CONTEXT_PATTERNS: RegExp[] = [
    /\bwhat do you know about me\b/i,
    /\bwhat do you remember about me\b/i,
    /\bwhat do you know about my day\b/i,
    /\bwhat do you know about today\b/i,
    /\bwhat do you know about my schedule\b/i,
    /\bwhat do you know about my calendar\b/i,
];

export const MAP_TRIGGER_PATTERN =
    /\b(?:nearby|around|directions|route|map|maps|location|locations|address|restaurant|cafe|diner|bar|hotel|airport|station|train|bus|metro|tram|park|museum|landmark|beach|mall|district|city|town|village|neighborhood|venue|street)\b/i;

export const MAP_TRIGGER_PHRASE =
    /\b(?:near me|near here|around here|close to|within (?:a )?(?:mile|km|block|minute|minutes)|walking distance|driving distance|in (?:the )?(?:area|neighborhood|city))\b/i;

// Reminder-related patterns
export const EMPTY_CODE_FENCE_REGEX = /```(?:[a-zA-Z0-9_-]+)?\s*```/g;
export const REMINDER_PRE_BLOCK_REGEX = /(?:```[a-z0-9_-]*[^\S\r\n]*\n\s*)?gray[._](?:reminder|plan|habit)\s*$/i;
export const REMINDER_CODE_BLOCK_REGEX = /```[a-z0-9_-]*[^\S\r\n]*\n[\s\S]*?gray[._](?:reminder|plan|habit)[\s\S]*?```/gi;
export const REMINDER_GENERIC_FENCE_REGEX = /```[a-z0-9_-]*[\s\S]*?(gray[\s\S]{0,120}?(?:reminder|plan|habit))[\s\S]*?```/gi;

// Title markers
export const GRAY_TITLE_HTML_CAPTURE_REGEX = /<graytitle\b[^>]*>([\s\S]*?)<\/graytitle>/i;
export const GRAY_TITLE_HTML_STRIP_REGEX = /<graytitle\b[^>]*>[\s\S]*?<\/graytitle>/gi;
export const GRAY_TITLE_LEGACY_CAPTURE_REGEX = /<<gray-title>>([\s\S]*?)<<gray-title-end>>/i;
export const GRAY_TITLE_LEGACY_STRIP_REGEX = /<<gray-title>>[\s\S]*?<<gray-title-end>>/gi;

// Reminder notification
export const REMINDER_NOTIFICATION_ICON = "/grayaiwhite.svg";
