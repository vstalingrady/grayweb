import os
import importlib.util
import logging

logger = logging.getLogger("backend.rate_limit")

_NODE_ENV = os.getenv("NODE_ENV", "").strip().lower()
_ENVIRONMENT = os.getenv("ENVIRONMENT", "").strip().lower()
_IS_PRODUCTION = _NODE_ENV == "production" or _ENVIRONMENT == "production"

_SLOWAPI_AVAILABLE = importlib.util.find_spec("slowapi") is not None

if _SLOWAPI_AVAILABLE:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address
else:
    if _IS_PRODUCTION:
        raise RuntimeError("slowapi is required in production for rate limiting")

    logger.warning(
        "slowapi not installed; rate limiting is disabled",
        extra={"event_type": "fallback_activation", "fallback": "slowapi_missing"},
    )

    def get_remote_address(request) -> str:  # type: ignore[override]
        return "anonymous"

    class RateLimitExceeded(Exception):
        """Placeholder exception used when slowapi is unavailable."""

    def _rate_limit_exceeded_handler(request, exc):  # type: ignore[override]
        raise exc

    class Limiter:  # type: ignore[override]
        def __init__(self, *args, **kwargs) -> None:
            pass

        def __call__(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

        def limit(self, *args, **kwargs):
            def decorator(func):
                return func

            return decorator

DEFAULT_RATE_LIMIT = os.getenv("DEFAULT_RATE_LIMIT", "60/minute")

# Apply a sane default to all routes so un-decorated endpoints still have protection.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[DEFAULT_RATE_LIMIT],
)

__all__ = [
    "limiter",
    "DEFAULT_RATE_LIMIT",
    "RateLimitExceeded",
    "_rate_limit_exceeded_handler",
]
