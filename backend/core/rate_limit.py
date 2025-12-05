import os

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
except Exception:  # Fallback when slowapi isn't installed
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
