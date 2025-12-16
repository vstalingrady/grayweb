"""
Cache utilities for the Gray backend.

Provides TTL-based caching for synchronous and asynchronous operations.
Extracted from main.py to reduce its size and improve modularity.
"""
import time
from typing import Any, Callable, Dict, Optional, Tuple


class AsyncTTLCache:
    """Async-compatible TTL cache with lazy expiration."""

    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, Tuple[Any, float]] = {}

    async def get(self, key: str, fetch_func: Callable) -> Any:
        """Get value from cache or fetch it using the provided async function."""
        now = time.time()
        if key in self.cache:
            value, timestamp = self.cache[key]
            if now - timestamp < self.ttl_seconds:
                return value

        value = await fetch_func()
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
