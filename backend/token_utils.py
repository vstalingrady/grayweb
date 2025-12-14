from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, Iterable, List, Mapping, Optional


@lru_cache(maxsize=1)
def _tiktoken_encoding():
    try:
        import tiktoken  # type: ignore

        return tiktoken.get_encoding("cl100k_base")
    except Exception:
        return None


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    encoding = _tiktoken_encoding()
    if encoding is not None:
        try:
            return len(encoding.encode(text))
        except Exception:
            pass
    # Heuristic fallback: average English token ~= 3.8 chars (empirically closer than 4).
    return max(1, int(len(text) / 3.8))


def _entry_text(entry: Mapping[str, Any]) -> str:
    text = entry.get("text")
    if isinstance(text, str) and text:
        return text
    content = entry.get("content")
    if isinstance(content, str) and content:
        return content
    return ""


def trim_history_by_token_budget(
    history: Optional[List[Dict[str, Any]]],
    token_budget: Optional[int],
    *,
    min_messages: int = 1,
    tokens_per_message_overhead: int = 4,
) -> List[Dict[str, Any]]:
    """
    Return the most recent subset of `history` whose estimated token count fits within `token_budget`.

    Notes:
      - Uses tiktoken if available, otherwise a heuristic.
      - Counts tokens in `text`/`content` plus a small per-message overhead.
      - Always includes at least `min_messages` from the end when history is non-empty.
    """
    if not history:
        return []
    if token_budget is None or token_budget <= 0:
        return list(history)

    min_messages = max(0, int(min_messages))
    total = 0
    kept_reversed: List[Dict[str, Any]] = []

    for entry in reversed(history):
        entry_tokens = estimate_tokens(_entry_text(entry)) + tokens_per_message_overhead
        if kept_reversed and total + entry_tokens > token_budget and len(kept_reversed) >= min_messages:
            break
        kept_reversed.append(entry)
        total += entry_tokens

    kept_reversed.reverse()
    return kept_reversed

