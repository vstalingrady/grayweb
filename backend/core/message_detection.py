"""
Message detection utilities for determining tool/search requirements.

This module intentionally keeps policy simple:
- Structured reminder/calendar tools are available when reminders are enabled.
- Web search is model-driven in auto mode, with only explicit safety gates.
"""
import ipaddress
import re
from typing import Optional
from urllib.parse import urlparse

# ============================================================================
# Structured tool intent keywords
# ============================================================================

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

# ============================================================================
# Web-search intent/safety patterns
# ============================================================================

EXPLICIT_SEARCH_PATTERNS = (
    re.compile(
        r"^\s*(?:please\s+|pls\s+)?"
        r"(?:search|google|web\s*search|look\s*up|lookup|find\s+on\s+the\s+web)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:can|could|would|will)\s+you\s+(?:please\s+)?"
        r"(?:search|google|web\s*search|look\s*up|lookup|find\s+on\s+the\s+web)\b",
        re.IGNORECASE,
    ),
)

MEMORY_META_PATTERNS = (
    re.compile(
        r"\b(?:did|have)\s+(?:i|we)\s+(?:already\s+)?"
        r"(?:ask|asked|search(?:ed)?(?:\s+up)?|google(?:d)?|look(?:ed)?\s*up)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bwhat\s+did\s+(?:i|we)\s+"
        r"(?:ask|search(?:ed)?(?:\s+up)?|google(?:d)?|look(?:ed)?\s*up)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bdid\s+i\s+ask\s+before\b", re.IGNORECASE),
    re.compile(
        r"\b(?:earlier|before|previously)\b[\s\S]{0,30}\b"
        r"(?:this|our)\s+(?:chat|conversation|thread|session)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bin\s+(?:this|our)\s+(?:chat|conversation|thread|session)\b", re.IGNORECASE),
)

CROSS_CHAT_MEMORY_REQUEST_PATTERN = re.compile(
    r"\b(?:another|other|previous|earlier|last|different)\s+(?:chat|conversation|thread|session)s?\b"
    r"|\b(?:from\s+chat\s+to\s+chat|cross[-\s]?chat|across\s+chats?)\b"
    r"|\b(?:remember\s+(?:what|when)\s+i\s+asked)\b",
    re.IGNORECASE,
)

# Shared with chat API for follow-up search prompt anchoring.
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


# ============================================================================
# Detection helpers
# ============================================================================


def is_explicit_search_request(message: str) -> bool:
    trimmed = (message or "").strip()
    if not trimmed:
        return False
    return any(pattern.search(trimmed) for pattern in EXPLICIT_SEARCH_PATTERNS)


def is_memory_meta_query(message: str) -> bool:
    trimmed = (message or "").strip()
    if not trimmed:
        return False
    return any(pattern.search(trimmed) for pattern in MEMORY_META_PATTERNS)


def is_cross_chat_memory_request(message: str) -> bool:
    """Detect requests that ask about prior messages across chats/sessions."""
    trimmed = (message or "").strip()
    if not trimmed:
        return False
    return is_memory_meta_query(trimmed) or bool(CROSS_CHAT_MEMORY_REQUEST_PATTERN.search(trimmed))


def needs_structured_tools(message: str) -> bool:
    """Check if a message likely requires reminder/plan/calendar tools."""
    normalized = (message or "").lower()
    if not normalized:
        return False

    for kw in TOOL_TRIGGER_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    if _TIME_OF_DAY_RE.search(normalized) or _RELATIVE_TIME_RE.search(normalized):
        return True
    for kw in TIME_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    return False


def should_request_structured_reminders(message: str) -> bool:
    """Check if message specifically relates to reminder functionality."""
    normalized = (message or "").lower()
    if not normalized:
        return False

    for kw in REMINDER_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", normalized):
            return True
    return False


def should_expose_structured_tools(
    message: str,
    *,
    reminders_enabled: bool,
    is_onboarding_tool: bool = False,
) -> bool:
    """
    Codex-style policy: keep structured tools available when reminders are enabled,
    and let the model decide when to call them.
    """
    _ = message
    return bool(reminders_enabled) and not is_onboarding_tool


def should_use_web_search(message: str, model: Optional[str] = None) -> bool:
    """Legacy compatibility wrapper for simple explicit-search detection."""
    _ = model
    return should_enable_search(message)


def should_enable_search(message: str, conversation_history: Optional[list] = None) -> bool:
    """
    Simple compatibility signal.

    This is no longer a heavy heuristic classifier. It only returns True for
    explicit web-search requests and stays False for memory-meta prompts.
    """
    _ = conversation_history
    trimmed = (message or "").strip()
    if not trimmed:
        return False
    if is_memory_meta_query(trimmed):
        return False
    return is_explicit_search_request(trimmed)


def resolve_web_search_enabled(
    *,
    message: str,
    web_search_mode: Optional[str],
    client_hint: bool = False,
    conversation_history: Optional[list] = None,
) -> bool:
    """
    Resolve whether web search should be available to the model.

    - `on`: always enabled.
    - `off`: disabled unless the user explicitly asks to search.
    - `auto`: enabled by default (model decides when to call web search).
    - `None`: legacy payload behavior (`client_hint` or explicit search).

    Cross-chat memory prompts are blocked from implicit web search.
    """
    _ = conversation_history
    mode = (web_search_mode or "").strip().lower() if isinstance(web_search_mode, str) else None
    explicit_search = is_explicit_search_request(message)

    if mode == "on":
        return True
    if mode == "off":
        return explicit_search
    if is_cross_chat_memory_request(message) and not explicit_search:
        return False
    if mode == "auto":
        return True

    return bool(client_hint) or explicit_search


def extract_urls_from_message(message: str, max_urls: int = 20) -> list:
    """
    Extract URLs from a message for URL context processing.

    Returns up to max_urls URLs, filtered to exclude internal/localhost URLs.
    """
    if not message:
        return []

    url_pattern = re.compile(r"https?://[^\s<>\"{}|\\^`\[\]]+", re.IGNORECASE)
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
