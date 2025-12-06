"""Redis-backed rate limiting for API endpoints.

Provides per-user and per-IP rate limiting using Redis sliding window.
"""

import time
import logging
from typing import Optional, Tuple
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

# Try to import Redis client
try:
    from redis_client import get_redis_client
    _redis = get_redis_client()
except ImportError:
    _redis = None


class RateLimiter:
    """Redis-backed sliding window rate limiter."""
    
    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        burst_limit: int = 10,  # Max requests in 1 second
    ):
        self.rpm = requests_per_minute
        self.rph = requests_per_hour
        self.burst = burst_limit
    
    async def _get_redis(self):
        """Get connected Redis client."""
        if not _redis or not _redis.available:
            return None
        if not _redis._client:
            await _redis.connect()
        return _redis._client
    
    async def check_rate_limit(
        self,
        identifier: str,
        endpoint: str = "default"
    ) -> Tuple[bool, dict]:
        """
        Check if request is within rate limits.
        
        Args:
            identifier: User ID or IP address
            endpoint: Endpoint name for separate limits
            
        Returns:
            Tuple of (allowed: bool, info: dict with remaining/reset)
        """
        redis = await self._get_redis()
        if not redis:
            # No Redis = no rate limiting (fail open)
            return True, {"remaining": -1, "reset": 0}
        
        now = time.time()
        minute_key = f"rl:{identifier}:{endpoint}:min"
        hour_key = f"rl:{identifier}:{endpoint}:hour"
        burst_key = f"rl:{identifier}:{endpoint}:burst"
        
        try:
            pipe = redis.pipeline()
            
            # Burst limit (1 second window)
            pipe.incr(burst_key)
            pipe.expire(burst_key, 1)
            
            # Per-minute limit
            pipe.incr(minute_key)
            pipe.expire(minute_key, 60)
            
            # Per-hour limit
            pipe.incr(hour_key)
            pipe.expire(hour_key, 3600)
            
            results = await pipe.execute()
            
            burst_count = results[0]
            minute_count = results[2]
            hour_count = results[4]
            
            # Check limits
            if burst_count > self.burst:
                logger.warning(f"Burst rate limit exceeded for {identifier}")
                return False, {
                    "remaining": 0,
                    "reset": 1,
                    "limit": "burst",
                    "retry_after": 1
                }
            
            if minute_count > self.rpm:
                logger.warning(f"Minute rate limit exceeded for {identifier}")
                return False, {
                    "remaining": 0,
                    "reset": 60 - (int(now) % 60),
                    "limit": "minute",
                    "retry_after": 60 - (int(now) % 60)
                }
            
            if hour_count > self.rph:
                logger.warning(f"Hour rate limit exceeded for {identifier}")
                return False, {
                    "remaining": 0,
                    "reset": 3600 - (int(now) % 3600),
                    "limit": "hour",
                    "retry_after": 3600 - (int(now) % 3600)
                }
            
            return True, {
                "remaining": min(self.rpm - minute_count, self.rph - hour_count),
                "reset": 60 - (int(now) % 60),
            }
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True, {"remaining": -1, "reset": 0}  # Fail open
    
    async def is_blocked(self, identifier: str) -> bool:
        """Check if identifier is temporarily blocked."""
        redis = await self._get_redis()
        if not redis:
            return False
        
        try:
            blocked = await redis.get(f"blocked:{identifier}")
            return blocked is not None
        except Exception:
            return False
    
    async def block(self, identifier: str, duration: int = 300):
        """Block an identifier for a duration (seconds)."""
        redis = await self._get_redis()
        if not redis:
            return
        
        try:
            await redis.setex(f"blocked:{identifier}", duration, "1")
            logger.warning(f"Blocked {identifier} for {duration}s")
        except Exception as e:
            logger.error(f"Failed to block {identifier}: {e}")


# Default rate limiter instance
_default_limiter = RateLimiter()


async def check_rate_limit(request: Request, user_id: Optional[int] = None) -> dict:
    """
    FastAPI dependency for rate limiting.
    
    Use with: rate_info = Depends(check_rate_limit)
    """
    # Use user_id if authenticated, otherwise use IP
    if user_id:
        identifier = f"user:{user_id}"
    else:
        # Get real IP from X-Forwarded-For or fall back to client host
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            identifier = f"ip:{forwarded.split(',')[0].strip()}"
        else:
            identifier = f"ip:{request.client.host if request.client else 'unknown'}"
    
    # Check if blocked
    if await _default_limiter.is_blocked(identifier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. You have been temporarily blocked.",
            headers={"Retry-After": "300"}
        )
    
    allowed, info = await _default_limiter.check_rate_limit(identifier)
    
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {info.get('retry_after', 60)} seconds.",
            headers={"Retry-After": str(info.get("retry_after", 60))}
        )
    
    return info


def get_rate_limiter() -> RateLimiter:
    """Get the default rate limiter instance."""
    return _default_limiter
