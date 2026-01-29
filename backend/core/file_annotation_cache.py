"""In-memory cache for parsed file annotations."""
from __future__ import annotations

import os
import time
from collections import OrderedDict
from typing import Optional

_MAX_ITEMS = int(os.getenv("OPENROUTER_PDF_CACHE_MAX_ITEMS", "128"))
_TTL_SECONDS = int(os.getenv("OPENROUTER_PDF_CACHE_TTL_SECONDS", "3600"))
_MAX_CHARS = int(os.getenv("OPENROUTER_PDF_CACHE_MAX_CHARS", "20000"))

_CACHE: "OrderedDict[str, dict]" = OrderedDict()


def _now() -> float:
    return time.time()


def should_reuse_pdf_cache() -> bool:
    value = os.getenv("OPENROUTER_PDF_CACHE_REUSE", "true").strip().lower()
    return value not in {"0", "false", "no", "off"}


def _prune() -> None:
    if not _CACHE:
        return
    cutoff = _now() - max(_TTL_SECONDS, 0)
    stale_keys = [key for key, entry in _CACHE.items() if entry.get("ts", 0) < cutoff]
    for key in stale_keys:
        _CACHE.pop(key, None)
    while _MAX_ITEMS > 0 and len(_CACHE) > _MAX_ITEMS:
        _CACHE.popitem(last=False)


def _truncate(text: str) -> str:
    if _MAX_CHARS <= 0:
        return text
    if len(text) <= _MAX_CHARS:
        return text
    return text[:_MAX_CHARS]


def get_cached_pdf_text(cache_key: Optional[str]) -> Optional[str]:
    if not cache_key:
        return None
    _prune()
    entry = _CACHE.get(cache_key)
    if not entry:
        return None
    _CACHE.move_to_end(cache_key)
    return entry.get("text")


def store_cached_pdf_text(cache_key: Optional[str], text: Optional[str]) -> None:
    if not cache_key or not text:
        return
    trimmed = text.strip()
    if not trimmed:
        return
    _prune()
    _CACHE[cache_key] = {"text": _truncate(trimmed), "ts": _now()}
    _CACHE.move_to_end(cache_key)
