"""Chat history caching for improved performance.

Caches recent conversation history in Redis to avoid repeated DB fetches.
"""

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Try to import Redis client
try:
    from redis_client import get_redis_client
    _redis = get_redis_client()
except ImportError:
    _redis = None


CHAT_CACHE_PREFIX = "chat:"
CHAT_CACHE_TTL = 60  # 1 minute - conversation updates frequently


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
        if data:
            messages = json.loads(data)
            logger.debug(f"[CHAT CACHE] Hit for conversation {conversation_id[:8]}...")
            return messages[:limit] if limit else messages
    except Exception as e:
        logger.debug(f"[CHAT CACHE] Error getting messages: {e}")
    
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
    
    try:
        key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
        # Only cache serializable data
        serializable = []
        for msg in messages:
            try:
                # Convert to dict if needed and ensure serializable
                if hasattr(msg, '_asdict'):
                    msg = dict(msg._asdict())
                elif hasattr(msg, '__dict__'):
                    msg = dict(msg)
                else:
                    msg = dict(msg)
                
                # Convert datetime to ISO string if present
                for k, v in msg.items():
                    if hasattr(v, 'isoformat'):
                        msg[k] = v.isoformat()
                
                serializable.append(msg)
            except Exception:
                continue
        
        await redis.setex(key, CHAT_CACHE_TTL, json.dumps(serializable))
        logger.debug(f"[CHAT CACHE] Cached {len(serializable)} messages for {conversation_id[:8]}...")
        return True
    except Exception as e:
        logger.debug(f"[CHAT CACHE] Error caching messages: {e}")
    
    return False


async def invalidate_conversation_cache(conversation_id: str) -> bool:
    """Invalidate cache when conversation is updated."""
    redis = await _get_redis()
    if not redis:
        return False
    
    try:
        key = f"{CHAT_CACHE_PREFIX}{conversation_id}:messages"
        await redis.delete(key)
        logger.debug(f"[CHAT CACHE] Invalidated cache for {conversation_id[:8]}...")
        return True
    except Exception as e:
        logger.debug(f"[CHAT CACHE] Error invalidating cache: {e}")
    
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
        if data:
            return json.loads(data)
    except Exception:
        pass
    
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
        # Ensure serializable
        serializable = {}
        for k, v in metadata.items():
            if hasattr(v, 'isoformat'):
                serializable[k] = v.isoformat()
            else:
                serializable[k] = v
        
        await redis.setex(key, ttl, json.dumps(serializable))
        return True
    except Exception:
        pass
    
    return False
