"""
CORS configuration utilities.

Extracted from main.py to reduce its size and improve modularity.
"""
import os
from typing import Iterable, List, Optional, Set

# Environment flags
NODE_ENV = os.getenv("NODE_ENV", "").strip().lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", "").strip().lower()
IS_PRODUCTION = NODE_ENV == "production" or ENVIRONMENT == "production"

# Default development ports for local origins
DEFAULT_DEV_ORIGIN_PORTS = (3000, 5173)

# Regex pattern for local network origins
LOCAL_NETWORK_ORIGIN_PATTERN = (
    r"^https?://(?:(?:localhost|(?:[a-z0-9-]+\.)+localhost|127\.0\.0\.1)"
    r"|(?:10(?:\.\d{1,3}){3})"
    r"|(?:192\.168(?:\.\d{1,3}){2})"
    r"|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}))(?::\d+)?$"
)


def split_env_list(value: Optional[str]) -> List[str]:
    """Split a comma-separated environment variable value into a list."""
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def origin_variants(origin: str) -> List[str]:
    """Generate HTTP and HTTPS variants of an origin."""
    cleaned = origin.strip().rstrip("/")
    if not cleaned:
        return []

    variants = {cleaned}
    if cleaned.startswith("http://"):
        variants.add(cleaned.replace("http://", "https://", 1))
    elif cleaned.startswith("https://"):
        variants.add(cleaned.replace("https://", "http://", 1))
    return list(variants)


def local_network_origins(ports: Iterable[int]) -> Set[str]:
    """Generate local network origins for development.
    
    Security: Currently returns empty set to avoid allowing
    other devices on the local network.
    """
    return set()


def local_network_origin_regex() -> Optional[str]:
    """Return regex for local network origins.
    
    Security: Returns None to avoid wildcard local network matching.
    """
    return None


def build_allowed_origins() -> List[str]:
    """Build the list of allowed CORS origins based on environment."""
    explicit = split_env_list(os.getenv("CORS_ALLOW_ORIGINS"))
    if explicit:
        return explicit

    default_origins = {
        "http://localhost:3000",
        "https://localhost:3000",
        "http://gray.localhost:3000",
        "https://gray.localhost:3000",
        "http://127.0.0.1:3000",
        "https://127.0.0.1:3000",
        "http://localhost:5173",
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173",
    }

    # In production, do not include default localhost origins unless explicitly allowed
    if IS_PRODUCTION:
        default_origins = set()

    candidate_env_vars = [
        os.getenv("NEXT_PUBLIC_SITE_URL"),
        os.getenv("SITE_URL"),
        os.getenv("NEXT_PUBLIC_AUTH_REDIRECT"),
        os.getenv("FRONTEND_URL"),
    ]

    for candidate in candidate_env_vars:
        for variant in origin_variants(candidate or ""):
            default_origins.add(variant)

    if not IS_PRODUCTION:
        for origin in local_network_origins(DEFAULT_DEV_ORIGIN_PORTS):
            default_origins.add(origin)

    return sorted(default_origins)


# Backwards compatibility aliases (with underscore prefix for internal use)
_split_env_list = split_env_list
_origin_variants = origin_variants
_local_network_origins = local_network_origins
_local_network_origin_regex = local_network_origin_regex
_build_allowed_origins = build_allowed_origins
