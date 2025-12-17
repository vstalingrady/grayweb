"""
Cache utilities for the Gray backend.

Provides TTL-based caching for synchronous and asynchronous operations.
Extracted from main.py to reduce its size and improve modularity.
"""
import time
from typing import Any, Callable, Dict, Optional, Tuple


class AsyncTTLCache:
    """Async-compatible TTL cache with lazy expiration and max size eviction."""

    def __init__(self, ttl_seconds: int = 300, max_size: int = 256):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self.cache: Dict[str, Tuple[Any, float]] = {}

    async def get(self, key: str, fetch_func: Callable) -> Any:
        """Get value from cache or fetch it using the provided async function."""
        now = time.time()
        if key in self.cache:
            value, timestamp = self.cache[key]
            if now - timestamp < self.ttl_seconds:
                return value

        value = await fetch_func()
        # Evict oldest entry if at max size
        if len(self.cache) >= self.max_size:
            oldest = min(self.cache.items(), key=lambda item: item[1][1])[0]
            self.cache.pop(oldest, None)
        self.cache[key] = (value, now)
        return value

    def clear(self) -> None:
        """Clear all entries from the cache."""
        self.cache = {}

    def invalidate(self, key: str) -> None:
        """Remove a specific key from the cache."""
        if key in self.cache:
            del self.cache[key]



class TTLCache:
    """Simple TTL cache with max size eviction."""

    def __init__(self, ttl_seconds: int = 600, max_size: int = 256):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self.cache: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        now = time.time()
        entry = self.cache.get(key)
        if not entry:
            return None
        value, ts = entry
        if now - ts > self.ttl_seconds:
            self.cache.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        """Set a value in the cache, evicting oldest if at max size."""
        if len(self.cache) >= self.max_size:
            # Evict the oldest entry to keep memory bounded
            oldest = min(self.cache.items(), key=lambda item: item[1][1])[0]
            self.cache.pop(oldest, None)
        self.cache[key] = (value, time.time())

    def invalidate(self, key: str) -> None:
        """Remove a specific key from the cache."""
        self.cache.pop(key, None)

    def clear(self) -> None:
        """Clear all entries from the cache."""
        self.cache.clear()


# Pre-configured cache instances
USER_CACHE = AsyncTTLCache(ttl_seconds=300)
CONVERSATION_OWNER_CACHE = TTLCache(ttl_seconds=900, max_size=512)
CONVERSATION_HISTORY_CACHE = TTLCache(ttl_seconds=900, max_size=256)


# ==============================================================================
# Context Cache Database Operations
# ==============================================================================

# Lazy imports
_context_cache_table = None
_row_get_fn = None
_types_module = None


def _get_context_cache_table():
    """Get context_cache database table."""
    global _context_cache_table
    if _context_cache_table is None:
        try:
            from backend.database import context_cache
        except ImportError:
            from database import context_cache
        _context_cache_table = context_cache
    return _context_cache_table


def _get_row_get():
    """Get _row_get helper function."""
    global _row_get_fn
    if _row_get_fn is None:
        try:
            from backend.core.serializers import _row_get
        except ImportError:
            from core.serializers import _row_get
        _row_get_fn = _row_get
    return _row_get_fn


def _get_types():
    """Get google.genai types module."""
    global _types_module
    if _types_module is None:
        try:
            from google.genai import types
        except ImportError:
            types = None
        _types_module = types
    return _types_module


async def load_context_cache(cache_id: int, user_id: int, db) -> Optional[Dict[str, Any]]:
    """Load a context cache record from the database.
    
    Args:
        cache_id: The cache record ID
        user_id: The user's ID (ownership check)
        db: Database connection
        
    Returns:
        The cache record or None if not found
    """
    if cache_id is None:
        return None
    context_cache = _get_context_cache_table()
    record = await db.fetch_one(
        context_cache.select().where(
            (context_cache.c.id == cache_id)
            & (context_cache.c.user_id == user_id)
        )
    )
    return record


def context_cache_contents(record: Optional[Dict[str, Any]]) -> Optional[Any]:
    """Convert a context cache record to Gemini Content list.
    
    Args:
        record: The cache record from database
        
    Returns:
        List of types.Content with the cached content, or None
    """
    if not record:
        return None
    _row_get = _get_row_get()
    types = _get_types()
    if types is None:
        return None
    content_text = _row_get(record, "content")
    if not isinstance(content_text, str) or not content_text.strip():
        return None
    return [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=content_text)],
        )
    ]
