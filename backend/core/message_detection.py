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
]

RECENCY_TOKENS = [
    "today", "right now", "currently",
    "this week", "this month", "this year",
    "latest", "recent", "up to date", "up-to-date",
]


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

    # Generic recency cues ("today", "right now", "this week", etc.).
    if any(token in normalized for token in RECENCY_TOKENS):
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

    # Queries about what happened in an ongoing situation often need current info.
    if "what happened" in normalized:
        return True

    # Simple year-based heuristic: questions that mention a near-future or
    # current year along with "news" or "update" are likely live.
    if re.search(r"\b(202[3-9]|203[0-9])\b", normalized) and any(
        phrase in normalized for phrase in ("news", "update", "updates", "trending")
    ):
        return True

    return False


def should_enable_search(message: str) -> bool:
    """Check if message implies a need for web search.
    
    Uses word boundary matching for specific keywords to avoid over-triggering.
    """
    normalized = (message or "").lower()
    if not normalized:
        return False

    # Explicit request cues; keep conservative because enabling search can incur cost.
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

    # Live/recency-oriented queries.
    return should_use_web_search(message, model=None)


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
