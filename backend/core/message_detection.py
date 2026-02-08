"""
Message detection utilities for determining tool/search requirements.

This module provides keyword matching and heuristics to determine whether
a user message requires tool execution, web search, or reminder functionality.
"""
import ipaddress
import re
from typing import Optional
from urllib.parse import urlparse

# ==============================================================================
# Keyword Sets
# ==============================================================================

REMINDER_KEYWORDS = frozenset({
    "reminder", "reminders", "remind", "reminds",
    "ping", "pings", "nudge", "nudges", "notify", "notification", "notifications",
    "timer", "timers", "alarm", "alarms", "alert", "alerts",
    "goal", "goals", "plan", "plans", "habit", "habits",
    "schedule", "schedules", "deadline", "deadlines", "due",
    "task", "tasks", "todo", "todos", "to-do", "to-dos",
})

EVENT_KEYWORDS = frozenset({
    "meeting", "appointment", "call", "checkin", "check-in", "check in",
    "sync", "standup", "doctor", "dentist", "gym", "workout", "project", "routine",
})

TIME_KEYWORDS = frozenset({
    "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
})

TOOL_TRIGGER_KEYWORDS = REMINDER_KEYWORDS | EVENT_KEYWORDS

# Explicit time expressions to avoid matching common words like "am" or "at".
_TIME_OF_DAY_RE = re.compile(
    r"\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)\b"
    r"|\b(?:[01]?\d|2[0-3]):[0-5]\d\b"
    r"|\b(?:noon|midnight)\b"
    r"|\b\d{1,2}\s*(?:o'clock|oclock)\b",
    re.IGNORECASE,
)

_RELATIVE_TIME_RE = re.compile(
    r"\b(?:in|after)\s+\d+\s+(?:minutes?|hours?)\b"
    r"|\b\d+\s+(?:minutes?|hours?)\s+from\s+now\b",
    re.IGNORECASE,
)

# Live/recency-oriented keywords for web search detection
LIVE_KEYWORDS = [
    "news", "breaking news", "latest news", "recent news", "current events", "today's news",
    "stock price", "stock prices", "stock market",
    "crypto price", "bitcoin price", "btc price", "eth price",
    "exchange rate", "currency rate", "interest rate", "inflation rate",
    "weather", "forecast", "temperature today",
    "traffic", "flight status", "train status",
    "nba score", "nfl score", "soccer score", "game score",
    "release date", "new version", "new update", "patch notes",
    "new files", "brand new files", "just dropped", "just released", "conspiracy",
]

SOFT_RECENCY_TOKENS = [
    "today",
    "right now",
    "currently",
    "this week",
    "this month",
    "this year",
]

HARD_RECENCY_TOKENS = [
    "latest",
    "recent",
    "up to date",
    "up-to-date",
]

QUESTION_PREFIXES = (
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
)

SMALL_TALK_PATTERNS = (
    re.compile(r"^\s*(?:hi|hello|hey|yo|sup)\b", re.IGNORECASE),
    re.compile(r"^\s*(?:thanks|thank you|thx)\b", re.IGNORECASE),
    re.compile(r"^\s*(?:how are you|how's it going|whats up|what's up)\b", re.IGNORECASE),
    re.compile(r"^\s*(?:good morning|good afternoon|good evening)\b", re.IGNORECASE),
)

STABLE_KNOWLEDGE_PATTERNS = (
    re.compile(r"\b(?:solve|simplify|factor|differentiate|integrate|derive|calculate|compute)\b", re.IGNORECASE),
    re.compile(r"\b(?:algebra|geometry|calculus|equation|formula|theorem|derivative|integral)\b", re.IGNORECASE),
    re.compile(r"\b(?:sqrt|square\s*root)\b", re.IGNORECASE),
    re.compile(r"\b(?:what does .+ mean)\b", re.IGNORECASE),
    re.compile(r"\b(?:define|definition of)\b", re.IGNORECASE),
)

VERIFICATION_PATTERNS = (
    re.compile(r"\b(?:is it true|is this true|is that true)\b", re.IGNORECASE),
    re.compile(r"\b(?:rumor|rumour|hoax|myth|debunk|fact[\s-]?check|verify|verification|credible evidence|conspiracy)\b", re.IGNORECASE),
    re.compile(
        r"\b(?:did|does|do|is|are|was|were|has|have|had)\b[\s\S]{0,140}\b(?:actually|really|true|real|legit|confirmed|evidence)\b",
        re.IGNORECASE,
    ),
)

TREND_PATTERNS = (
    re.compile(r"\btrending\b", re.IGNORECASE),
    re.compile(r"\bviral\b", re.IGNORECASE),
    re.compile(r"\bmeme(?:s)?\b", re.IGNORECASE),
    re.compile(r"\bmascot\b", re.IGNORECASE),
    re.compile(r"\bcontrovers(?:y|ial)\b", re.IGNORECASE),
    re.compile(r"\bwhat(?:'s| is)\s+up\s+with\b", re.IGNORECASE),
)

TEMPORAL_QUESTION_PATTERNS = (
    re.compile(r"\bwhat\s+happened\b", re.IGNORECASE),
    re.compile(r"\bwhy\s+is\b", re.IGNORECASE),
    re.compile(r"\bwhat(?:'s| is)\s+going\s+on\b", re.IGNORECASE),
)

PERSONAL_RECENCY_PATTERNS = (
    re.compile(
        r"\b(today|right now|currently|this week|this month|this year)\b\s+"
        r"(i|i'm|im|we|we're|our|my|me)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(i|i'm|im|we|we're|our|my|me)\b[\s\S]{0,30}\b"
        r"(today|right now|currently|this week|this month|this year)\b",
        re.IGNORECASE,
    ),
)

NAME_LIKE_PATTERN = re.compile(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b")

FOLLOW_UP_PATTERNS = (
    re.compile(r"\b(?:what|how)\s+about\b", re.IGNORECASE),
    re.compile(r"\b(?:and|also)\s+(?:him|her|them|that|this|it)\b", re.IGNORECASE),
    re.compile(r"\b(?:about|regarding)\s+(?:him|her|them|that|this|it)\b", re.IGNORECASE),
    re.compile(r"\b(?:same|related|more\s+on\s+that)\b", re.IGNORECASE),
)
FOLLOW_UP_PRONOUN_PATTERN = re.compile(r"\b(him|her|them|that|this|it)\b", re.IGNORECASE)

FOLLOW_UP_CONTEXT_KEYWORDS = (
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
)

SLANG_GUARD_TERMS = {
    "wtf", "idk", "omg", "lol", "lmfao", "rofl", "ngl", "tbh", "brb", "gtg",
    "what is wtf", "what does wtf mean",
}

def _is_small_talk(trimmed: str, word_count: int) -> bool:
    return word_count <= 8 and any(pattern.search(trimmed) for pattern in SMALL_TALK_PATTERNS)


def _is_slang_guard(normalized: str) -> bool:
    return normalized in SLANG_GUARD_TERMS


def _is_question_like(normalized: str) -> bool:
    return "?" in normalized or any(normalized.startswith(f"{prefix} ") for prefix in QUESTION_PREFIXES)


def _is_ambiguous_follow_up(normalized: str) -> bool:
    return bool(
        FOLLOW_UP_PRONOUN_PATTERN.search(normalized)
        and any(pattern.search(normalized) for pattern in FOLLOW_UP_PATTERNS)
    )


def _compute_search_need_score(
    *,
    trimmed: str,
    normalized: str,
    has_soft_recency: bool,
    has_hard_recency: bool,
    question_like: bool,
) -> int:
    score = 0

    if has_hard_recency:
        score += 2
    if has_soft_recency:
        score += 1
    if question_like:
        score += 1
    if any(pattern.search(normalized) for pattern in TREND_PATTERNS):
        score += 2
    if any(pattern.search(normalized) for pattern in TEMPORAL_QUESTION_PATTERNS):
        score += 2
    if re.search(r"\b(202[3-9]|203[0-9])\b", normalized):
        score += 1
    if (
        NAME_LIKE_PATTERN.search(trimmed)
        and (
            has_soft_recency
            or has_hard_recency
            or any(pattern.search(normalized) for pattern in TREND_PATTERNS)
            or any(pattern.search(normalized) for pattern in TEMPORAL_QUESTION_PATTERNS)
        )
    ):
        score += 1

    return score


def _extract_recent_user_messages(conversation_history: Optional[list]) -> list[str]:
    if not conversation_history:
        return []
    messages: list[str] = []
    for entry in conversation_history[-8:]:
        if not isinstance(entry, dict):
            continue
        role = (entry.get("role") or "").strip().lower()
        if role != "user":
            continue
        text = (entry.get("text") or "").strip()
        if text:
            messages.append(text)
    return messages


def _should_enable_search_base(message: str) -> bool:
    trimmed = (message or "").strip()
    if not trimmed:
        return False
    normalized = trimmed.lower()
    words = normalized.split()
    word_count = len(words)

    explicit_patterns = [
        r"\bsearch\b",
        r"\bgoogle\b",
        r"\bweb\s*search\b",
        r"\blook\s*up\b",
        r"\blookup\b",
        r"\bfind\s+on\s+the\s+web\b",
    ]
    if any(re.search(pattern, normalized) for pattern in explicit_patterns):
        return True

    if should_use_web_search(message, model=None):
        return True

    if _is_small_talk(trimmed, word_count):
        return False

    if _is_slang_guard(normalized):
        return False

    if any(pattern.search(normalized) for pattern in STABLE_KNOWLEDGE_PATTERNS):
        return False

    if any(pattern.search(normalized) for pattern in VERIFICATION_PATTERNS):
        return True

    # Don't auto-search ambiguous follow-ups without conversation anchor.
    # The contextual pass in should_enable_search handles these.
    if _is_ambiguous_follow_up(normalized):
        return False

    return False


# ==============================================================================
# Detection Functions
# ==============================================================================


def needs_structured_tools(message: str) -> bool:
    """Check if message likely requires tool execution (reminders, calendar, etc).
    
    Uses word boundary matching to avoid false positives like 'at' matching 'cat'.
    """
    normalized = (message or "").lower()
    if not normalized:
        return False
    
    for kw in TOOL_TRIGGER_KEYWORDS:
        if re.search(rf'\b{re.escape(kw)}\b', normalized):
            return True
    if _TIME_OF_DAY_RE.search(normalized) or _RELATIVE_TIME_RE.search(normalized):
        return True
    for kw in TIME_KEYWORDS:
        if re.search(rf'\b{re.escape(kw)}\b', normalized):
            return True
    return False


def should_request_structured_reminders(message: str) -> bool:
    """Check if message specifically relates to reminder functionality.
    
    Uses word boundary matching to avoid false positives.
    """
    normalized = (message or "").lower()
    if not normalized:
        return False
    
    for kw in REMINDER_KEYWORDS:
        if re.search(rf'\b{re.escape(kw)}\b', normalized):
            return True
    return False


def should_use_web_search(message: str, model: Optional[str] = None) -> bool:
    """
    Use lightweight local heuristics to decide whether this message likely
    needs up-to-date information from the public web.

    Uses local keyword matching for fast classification without network calls.
    """
    trimmed = (message or "").strip()
    if not trimmed:
        return False

    normalized = trimmed.lower()

    # Obvious "live data" phrases – news, markets, prices, weather, etc.
    if any(keyword in normalized for keyword in LIVE_KEYWORDS):
        return True

    # Questions explicitly about something "happening" now.
    if "what's happening" in normalized or "whats happening" in normalized:
        return True

    # Explicit slang guard: Messages that are just slang terms (or simple "what is X")
    # should be handled by the LLM's internal knowledge to avoid robotic "According to..." headers.
    _SLANG_GUARD_TERMS = {
        "wtf", "idk", "omg", "lol", "lmfao", "rofl", "ngl", "tbh", "brb", "gtg",
        "what is wtf", "what does wtf mean",
    }
    if normalized in _SLANG_GUARD_TERMS:
        return False

    if any(pattern.search(normalized) for pattern in PERSONAL_RECENCY_PATTERNS):
        return False

    word_count = len(normalized.split())
    if _is_small_talk(trimmed, word_count):
        return False

    if any(pattern.search(normalized) for pattern in STABLE_KNOWLEDGE_PATTERNS):
        return False

    if any(pattern.search(normalized) for pattern in VERIFICATION_PATTERNS):
        return True

    if _is_ambiguous_follow_up(normalized):
        return False

    has_soft_recency = any(token in normalized for token in SOFT_RECENCY_TOKENS)
    has_hard_recency = any(token in normalized for token in HARD_RECENCY_TOKENS)
    search_score = _compute_search_need_score(
        trimmed=trimmed,
        normalized=normalized,
        has_soft_recency=has_soft_recency,
        has_hard_recency=has_hard_recency,
        question_like=_is_question_like(normalized),
    )
    if search_score >= 3:
        return True

    # Simple year-based heuristic: questions that mention a near-future or
    # current year along with "news" or "update" are likely live.
    if re.search(r"\b(202[3-9]|203[0-9])\b", normalized) and any(
        phrase in normalized for phrase in ("news", "update", "updates", "trending")
    ):
        return True

    return False


def should_enable_search(message: str, conversation_history: Optional[list] = None) -> bool:
    """Check if message implies a need for web search.
    
    Uses explicit and heuristic signals. In auto mode we intentionally err on the
    side of enabling search for factual questions, while keeping small-talk local.
    """
    if _should_enable_search_base(message):
        return True

    trimmed = (message or "").strip()
    if not trimmed:
        return False
    normalized = trimmed.lower()
    words = normalized.split()
    word_count = len(words)
    if _is_small_talk(trimmed, word_count) or _is_slang_guard(normalized):
        return False

    # Follow-up prompts ("what about him", "how about that") should inherit context
    # from recent user turns when those turns were likely search-worthy.
    if any(pattern.search(normalized) for pattern in FOLLOW_UP_PATTERNS):
        recent_user_messages = _extract_recent_user_messages(conversation_history)
        for prior in reversed(recent_user_messages):
            prior_trimmed = prior.strip()
            if not prior_trimmed:
                continue
            prior_normalized = prior_trimmed.lower()
            if prior_normalized == normalized:
                continue
            prior_word_count = len(prior_normalized.split())
            if _is_small_talk(prior_trimmed, prior_word_count) or _is_slang_guard(prior_normalized):
                continue
            if _should_enable_search_base(prior_trimmed):
                return True
            if any(keyword in prior_normalized for keyword in FOLLOW_UP_CONTEXT_KEYWORDS):
                return True
            if _is_question_like(prior_normalized) and prior_word_count >= 4:
                return True
            break

    return False


def extract_urls_from_message(message: str, max_urls: int = 20) -> list:
    """
    Extract URLs from a message for URL context processing.
    
    Returns up to max_urls URLs, filtered to exclude internal/localhost URLs.
    """
    if not message:
        return []
    
    # Simple URL pattern
    url_pattern = re.compile(
        r'https?://[^\s<>"{}|\\^`\[\]]+',
        re.IGNORECASE
    )
    
    urls = url_pattern.findall(message)
    
    def _is_private_hostname(hostname: str) -> bool:
        if not hostname:
            return True
        normalized = hostname.strip().lower().strip(".")
        if not normalized:
            return True
        if normalized in {"localhost"} or normalized.endswith((".localhost", ".local", ".internal")):
            return True
        normalized = normalized.split("%", 1)[0]
        try:
            ip = ipaddress.ip_address(normalized)
        except ValueError:
            return False
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        )

    # Filter out localhost/internal URLs
    filtered = []
    for url in urls:
        try:
            parsed = urlparse(url)
        except Exception:
            continue
        hostname = parsed.hostname or ""
        if _is_private_hostname(hostname):
            continue
        filtered.append(url)
        if len(filtered) >= max_urls:
            break
    
    return filtered
