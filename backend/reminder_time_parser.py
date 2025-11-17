from __future__ import annotations

import re
from typing import Optional

# Ported from grayai/services/reminder_time_parser.py

ABSOLUTE_TIME_PATTERN = (
    r"(?:\b(?:at|@|jam|pukul|pk)\s*)?(\d{1,2})(?::(\d{2}))?\s"
    r"*(am|pm|a\.m\.|p\.m\.|pagi|siang|sore|malam|mlm|petang)?\b"
)

_REMIND_TOKENS = (
    "remind",
    "reminder",
    "ping",
    "nudge",
    "alert",
    "notify",
    "ingat",
    "ingatkan",
    "ingetin",
)
_CONTEXT_TOKENS = (
    "it's currently",
    "its currently",
    "it's now",
    "its now",
    "currently",
    "right now",
    "sekarang",
)
_PLANNING_TOKENS = (
    "till",
    "until",
    "by",
    "before",
    "finish",
    "start",
    "mulai",
    "selesai",
    "hingga",
    "sampai",
)
_WINDOW = 48


def choose_absolute_time_match(text: str) -> Optional[re.Match[str]]:
    """Pick the most likely absolute time reference inside ``text``."""

    lowered = (text or "").lower()
    matches = list(re.finditer(ABSOLUTE_TIME_PATTERN, lowered))
    if not matches:
        return None

    best_match: Optional[re.Match[str]] = None
    best_score: Optional[int] = None

    for match in matches:
        start_idx = match.start()
        end_idx = match.end()
        prefix = lowered[max(0, start_idx - _WINDOW) : start_idx]
        suffix = lowered[end_idx : end_idx + _WINDOW]

        has_remind_prefix = any(token in prefix for token in _REMIND_TOKENS)
        has_remind_suffix = any(token in suffix for token in _REMIND_TOKENS)

        score = 0
        if has_remind_prefix:
            score += 3
            if "remind me" in prefix or "ingatkan saya" in prefix:
                score += 1
        if has_remind_suffix:
            score += 2
            if "remind me" in suffix or "ingatkan saya" in suffix:
                score += 1

        if not has_remind_prefix and not has_remind_suffix:
            if any(token in prefix for token in _PLANNING_TOKENS):
                score -= 1
            if any(token in prefix for token in _CONTEXT_TOKENS):
                score -= 2

        if best_score is None or score > best_score or (
            score == best_score and best_match is not None and match.start() < best_match.start()
        ):
            best_match = match
            best_score = score

    return best_match
