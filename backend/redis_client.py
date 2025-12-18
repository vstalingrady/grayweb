"""Redis client for session caching and job queue support."""

from __future__ import annotations

import importlib
import importlib.util
import json
import os
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_REDIS_MODULE_NAME = "redis.asyncio"
_REDIS_AVAILABLE = False
if importlib.util.find_spec("redis") is not None:
    _REDIS_AVAILABLE = importlib.util.find_spec(_REDIS_MODULE_NAME) is not None


class RedisClient:
    """Async Redis client for caching sessions and general key-value storage."""

    def __init__(self, url: Optional[str] = None) -> None:
        self._url = url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._client: Optional[Any] = None

    @property
    def available(self) -> bool:
        return _REDIS_AVAILABLE

    def _redis(self):
        if not _REDIS_AVAILABLE:
            return None
        return importlib.import_module(_REDIS_MODULE_NAME)

    async def connect(self) -> bool:
        """Establish connection to Redis. Returns True if successful."""
        if not _REDIS_AVAILABLE:
            logger.warning(
                "Redis client requested but dependency is missing",
                extra={"event_type": "fallback_activation", "fallback": "redis_package_missing"},
            )
            return False

        try:
            redis_module = self._redis()
            if redis_module is None:
                return False
            self._client = redis_module.from_url(self._url, decode_responses=True)
            await self._client.ping()
            logger.info("Connected to Redis at %s", self._url.split("@")[-1])
            return True
        except Exception as e:
            logger.warning(
                "Failed to connect to Redis: %s",
                e,
                extra={
                    "event_type": "fallback_activation",
                    "fallback": "redis_connect_failed",
                    "service": "redis",
                    "url": self._url.split("@")[-1],
                },
            )
            self._client = None
            return False

    async def ensure_connected(self) -> bool:
        """Ensure a Redis connection is available (connects lazily)."""
        if not _REDIS_AVAILABLE:
            return False
        if self._client is not None:
            return True
        return await self.connect()

    async def get_connection(self) -> Optional[Any]:
        """Return the underlying redis client connection if connected."""
        if not await self.ensure_connected():
            return None
        return self._client

    async def ping(self) -> bool:
        """Ping Redis and return True if healthy."""
        client = await self.get_connection()
        if client is None:
            return False
        try:
            await client.ping()
            return True
        except Exception as e:
            logger.warning("Redis ping failed: %s", e)
            return False

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None

    async def get(self, key: str) -> Optional[str]:
        """Get a value by key."""
        if not self._client:
            return None
        try:
            return await self._client.get(key)
        except Exception as e:
            logger.error("Redis GET error: %s", e)
            return None

    async def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        """Set a value with optional TTL in seconds."""
        if not self._client:
            return False
        try:
            if ttl:
                await self._client.setex(key, ttl, value)
            else:
                await self._client.set(key, value)
            return True
        except Exception as e:
            logger.error("Redis SET error: %s", e)
            return False

    async def delete(self, key: str) -> bool:
        """Delete a key."""
        if not self._client:
            return False
        try:
            await self._client.delete(key)
            return True
        except Exception as e:
            logger.error("Redis DELETE error: %s", e)
            return False

    # Session-specific helpers
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data by ID."""
        data = await self.get(f"session:{session_id}")
        if data:
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return None
        return None

    async def set_session(self, session_id: str, data: dict, ttl: int = 86400) -> bool:
        """Store session data with TTL (default 24 hours)."""
        return await self.set(f"session:{session_id}", json.dumps(data), ttl)

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        return await self.delete(f"session:{session_id}")


# Singleton instance
_redis_client: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """Get or create the global Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client
