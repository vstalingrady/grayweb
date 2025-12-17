"""Chat history caching for improved performance.

Caches recent conversation history in Redis to avoid repeated DB fetches.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from backend.redis_client import get_redis_client
except ImportError:  # pragma: no cover
    try:
        from redis_client import get_redis_client  # type: ignore
    except ImportError:  # pragma: no cover
        get_redis_client = None  # type: ignore[assignment]

if callable(get_redis_client):
    _redis = get_redis_client()
else:
    _redis = None


CHAT_CACHE_PREFIX = "chat:"
CHAT_CACHE_TTL = 60  # 1 minute - conversation updates frequently


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
        except Exception:
            return None
    asdict = getattr(message, "_asdict", None)
    if callable(asdict):
        try:
            return dict(asdict())
        except Exception:
            return None
    if hasattr(message, "__dict__"):
        try:
            return dict(vars(message))
        except Exception:
            return None
    try:
        return dict(message)
    except Exception:
        return None


async def _get_redis():
    """Get connected Redis client."""
    if not _redis or not _redis.available:
        return None
    if not _redis._client:
        await _redis.connect()
    return _redis._client


async def get_cached_messages(
    conversation_id: str,
    limit: int = 50
) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached messages for a conversation.
    
    Returns None if not cached (cache miss).
    """
    redis = await _get_redis()
    if not redis:
        return None
    
    try:
        key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
        data = await redis.get(key)
        if not data:
            return None
        messages = json.loads(data)
        if not isinstance(messages, list):
            return None
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
    redis = await _get_redis()
    if not redis:
        return False
    
    if not isinstance(messages, list):
        return False

    try:
        key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
        serializable: List[Dict[str, Any]] = []
        for message in messages:
            message_dict = _coerce_message_dict(message)
            if message_dict is None:
                continue
            serializable.append(message_dict)

        await redis.setex(key, CHAT_CACHE_TTL, json.dumps(serializable, default=_json_default))
        logger.debug(
            "[CHAT CACHE] Cached %s messages for %s...", len(serializable), conversation_id[:8]
        )
        return True
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error caching messages: %s", exc)
    
    return False


async def invalidate_conversation_cache(conversation_id: str) -> bool:
    """Invalidate cache when conversation is updated."""
    redis = await _get_redis()
    if not redis:
        return False
    
    try:
        keys = (
            f"{CHAT_CACHE_PREFIX}{conversation_id}:messages",
            f"{CHAT_CACHE_PREFIX}{conversation_id}:meta",
        )
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
    redis = await _get_redis()
    if not redis:
        return None
    
    try:
        key = f"{CHAT_CACHE_PREFIX}{conversation_id}:meta"
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
    redis = await _get_redis()
    if not redis:
        return False
    
    try:
        key = f"{CHAT_CACHE_PREFIX}{conversation_id}:meta"
        await redis.setex(key, ttl, json.dumps(dict(metadata), default=_json_default))
        return True
    except Exception as exc:
        logger.debug("[CHAT CACHE] Error caching metadata: %s", exc)
    
    return False
