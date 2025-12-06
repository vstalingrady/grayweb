"""Caching headers middleware for static API responses.

Adds Cache-Control headers to appropriate endpoints to reduce server load.
"""

from fastapi import Request, Response
from typing import Set, Dict
import re


# Endpoints that can be cached (patterns)
CACHEABLE_PATTERNS: Dict[str, int] = {
    # Pattern: max-age in seconds
    r"/health$": 10,  # Health check - cache briefly
    r"/health/live$": 5,
    r"/api/models$": 300,  # Model list - 5 minutes
    r"/api/plans$": 300,  # Plan list - 5 minutes
    r"/api/user/\d+/usage$": 30,  # Usage stats - 30 seconds
}

# Endpoints that should never be cached
NO_CACHE_PATTERNS: Set[str] = {
    r"/api/chat",
    r"/api/auth",
    r"/api/payment",
    r"/api/conversation",
}


def should_cache(path: str) -> tuple[bool, int]:
    """Determine if path should be cached and for how long."""
    # Check no-cache patterns first
    for pattern in NO_CACHE_PATTERNS:
        if re.search(pattern, path):
            return False, 0
    
    # Check cacheable patterns
    for pattern, max_age in CACHEABLE_PATTERNS.items():
        if re.search(pattern, path):
            return True, max_age
    
    return False, 0


def add_cache_headers(response: Response, max_age: int, private: bool = True):
    """Add appropriate caching headers to response."""
    if max_age > 0:
        cache_type = "private" if private else "public"
        response.headers["Cache-Control"] = f"{cache_type}, max-age={max_age}"
    else:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"


async def caching_middleware(request: Request, call_next):
    """Middleware to add caching headers based on endpoint."""
    response = await call_next(request)
    
    # Only cache successful GET requests
    if request.method != "GET" or response.status_code >= 400:
        add_cache_headers(response, 0)
        return response
    
    should, max_age = should_cache(request.url.path)
    add_cache_headers(response, max_age, private=True)
    
    return response
