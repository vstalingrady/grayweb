"""Chat history caching for improved performance.

Caches recent conversation history in Redis to avoid repeated DB fetches.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

from backend.redis_client import get_redis_client

_redis = get_redis_client()


CHAT_CACHE_PREFIX = "chat:"


def _env_positive_int(name: str, default: int) -> int:
    raw = (os.getenv(name, "") or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


CHAT_CACHE_TTL = _env_positive_int("CHAT_CACHE_TTL_SECONDS", 300)
CHAT_CACHE_LOCAL_MAX_SIZE = _env_positive_int("CHAT_CACHE_LOCAL_MAX_SIZE", 1024)


_LOCAL_CACHE: Dict[str, Tuple[Any, float]] = {}


def _local_get(key: str) -> Optional[Any]:
    entry = _LOCAL_CACHE.get(key)
    if not entry:
        return None
    value, expires_at = entry
    if time.time() >= expires_at:
        _LOCAL_CACHE.pop(key, None)
        return None
    return value


def _local_set(key: str, value: Any, ttl_seconds: int) -> None:
    if len(_LOCAL_CACHE) >= CHAT_CACHE_LOCAL_MAX_SIZE:
        oldest_key = min(_LOCAL_CACHE.items(), key=lambda item: item[1][1])[0]
        _LOCAL_CACHE.pop(oldest_key, None)
    _LOCAL_CACHE[key] = (value, time.time() + max(int(ttl_seconds), 1))


def _local_delete(*keys: str) -> None:
    for key in keys:
        _LOCAL_CACHE.pop(key, None)


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _coerce_message_dict(message: Any) -> Optional[Dict[str, Any]]:
    if message is None:
        return None
    if isinstance(message, dict):
        return dict(message)
    mapping = getattr(message, "_mapping", None)
    if mapping is not None:
        try:
            return dict(mapping)
        except (TypeError, ValueError):
            return None
    asdict = getattr(message, "_asdict", None)
    if callable(asdict):
        try:
            return dict(asdict())
        except (TypeError, ValueError):
            return None
    if hasattr(message, "__dict__"):
        try:
            return dict(vars(message))
        except TypeError:
            return None
    try:
        return dict(message)
    except (TypeError, ValueError):
        return None


def _normalize_cached_message(message: Any) -> Optional[Dict[str, Any]]:
    message_dict = _coerce_message_dict(message)
    if message_dict is None:
        return None

    role = message_dict.get("role")
    text = message_dict.get("text") or ""
    if role is None:
        return None

    normalized: Dict[str, Any] = {
        "role": role,
        "text": text,
    }

    grounding_metadata = message_dict.get("grounding_metadata")
    if grounding_metadata is None:
        grounding_metadata = message_dict.get("groundingMetadata")
    if grounding_metadata is not None:
        normalized["grounding_metadata"] = grounding_metadata

    if message_dict.get("attachments") is not None:
        normalized["attachments"] = message_dict.get("attachments")
    if message_dict.get("reminders") is not None:
        normalized["reminders"] = message_dict.get("reminders")
    if message_dict.get("timestamp") is not None:
        normalized["timestamp"] = message_dict.get("timestamp")

    return normalized


async def _get_redis_connection():
    """Get connected Redis client connection."""
    if not _redis.available:
        return None
    return await _redis.get_connection()


async def get_cached_messages(
    conversation_id: str,
    limit: int = 50
) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached messages for a conversation.
    
    Returns None if not cached (cache miss).
    """
    redis = await _get_redis_connection()
    key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
    if not redis:
        cached_local = _local_get(key)
        if not isinstance(cached_local, list):
            return None
        # Sliding TTL for local fallback as well.
        _local_set(key, cached_local, CHAT_CACHE_TTL)
        selected = cached_local[:limit] if limit else cached_local
        return [dict(message) if isinstance(message, dict) else message for message in selected]
    
    try:
        data = await redis.get(key)
        if not data:
            return None
        messages = json.loads(data)
        if not isinstance(messages, list):
            return None
        # Sliding TTL: keep actively-read conversations warm.
        try:
            await redis.expire(key, CHAT_CACHE_TTL)
        except Exception:
            pass
        logger.debug("[CHAT CACHE] Hit for conversation %s...", conversation_id[:8])
        return messages[:limit] if limit else messages
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error getting messages: %s", exc)
    
    return None


async def cache_messages(
    conversation_id: str,
    messages: List[Dict[str, Any]]
) -> bool:
    """
    Cache messages for a conversation.
    
    Returns True if cached successfully.
    """
    redis = await _get_redis_connection()

    if not isinstance(messages, list):
        return False

    key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
    serializable: List[Dict[str, Any]] = []
    for message in messages:
        message_dict = _normalize_cached_message(message)
        if message_dict is None:
            continue
        serializable.append(message_dict)

    if not redis:
        _local_set(key, serializable, CHAT_CACHE_TTL)
        return True

    try:
        await redis.setex(key, CHAT_CACHE_TTL, json.dumps(serializable, default=_json_default))
        logger.debug(
            "[CHAT CACHE] Cached %s messages for %s...", len(serializable), conversation_id[:8]
        )
        return True
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error caching messages: %s", exc)
    
    return False


async def append_cached_message(
    conversation_id: str,
    message: Dict[str, Any],
) -> bool:
    """
    Append a single message to an already-cached conversation history.

    Returns False when the cache key is missing (cold cache) so callers can
    continue without treating it as an error.
    """
    redis = await _get_redis_connection()

    normalized = _normalize_cached_message(message)
    if normalized is None:
        return False

    key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
    if not redis:
        existing_local = _local_get(key)
        if not isinstance(existing_local, list):
            return False
        existing_local.append(normalized)
        _local_set(key, existing_local, CHAT_CACHE_TTL)
        return True

    try:
        data = await redis.get(key)
        if not data:
            return False
        existing = json.loads(data)
        if not isinstance(existing, list):
            return False
        existing.append(normalized)
        await redis.setex(key, CHAT_CACHE_TTL, json.dumps(existing, default=_json_default))
        logger.debug("[CHAT CACHE] Appended message for %s...", conversation_id[:8])
        return True
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error appending message: %s", exc)
        return False


async def invalidate_conversation_cache(conversation_id: str) -> bool:
    """Invalidate cache when conversation is updated."""
    redis = await _get_redis_connection()
    keys = (
        f"{CHAT_CACHE_PREFIX}{conversation_id}:messages",
        f"{CHAT_CACHE_PREFIX}{conversation_id}:meta",
    )
    if not redis:
        _local_delete(*keys)
        return True

    try:
        await redis.delete(*keys)
        logger.debug("[CHAT CACHE] Invalidated cache for %s...", conversation_id[:8])
        return True
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error invalidating cache: %s", exc)
    
    return False


async def get_cached_conversation_metadata(
    conversation_id: str
) -> Optional[Dict[str, Any]]:
    """Get cached conversation metadata (title, created_at, etc.)."""
    redis = await _get_redis_connection()
    key = f"{CHAT_CACHE_PREFIX}{conversation_id}:meta"
    if not redis:
        parsed = _local_get(key)
        return dict(parsed) if isinstance(parsed, dict) else None

    try:
        data = await redis.get(key)
        if not data:
            return None
        parsed = json.loads(data)
        return parsed if isinstance(parsed, dict) else None
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error getting metadata: %s", exc)
    
    return None


async def cache_conversation_metadata(
    conversation_id: str,
    metadata: Dict[str, Any],
    ttl: int = 300  # 5 minutes for metadata
) -> bool:
    """Cache conversation metadata."""
    redis = await _get_redis_connection()
    key = f"{CHAT_CACHE_PREFIX}{conversation_id}:meta"
    payload = dict(metadata)
    if not redis:
        _local_set(key, payload, ttl)
        return True

    try:
        await redis.setex(key, ttl, json.dumps(payload, default=_json_default))
        return True
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error caching metadata: %s", exc)
    
    return False
