import os
import logging
from typing import Optional, Tuple

from supabase import Client, create_client

logger = logging.getLogger("backend.supabase_utils")


def _normalize_supabase_url(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return ""
    if trimmed.startswith("http://") or trimmed.startswith("https://"):
        return trimmed.rstrip("/")
    return f"https://{trimmed.lstrip('/').rstrip('/')}"


def _resolve_supabase_url() -> Optional[str]:
    """
    Resolve Supabase URL from environment variables.

    Priority:
    - SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_URL
    - SUPABASE_PROJECT_URL / SUPABASE_HOST
    """
    url_candidates = (
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_PROJECT_URL",
        "SUPABASE_HOST",
    )

    for env_name in url_candidates:
        candidate = (os.getenv(env_name) or "").strip()
        if not candidate or "your_supabase_url" in candidate.lower():
            continue
        url = _normalize_supabase_url(candidate)
        if env_name != "SUPABASE_URL":
            os.environ["SUPABASE_URL"] = url
        return url
    return None


def _resolve_supabase_key(candidate_keys: tuple[str, ...]) -> Tuple[Optional[str], Optional[str]]:
    for name in candidate_keys:
        value = (os.getenv(name) or "").strip()
        if not value or "your_supabase_key_here" in value.lower():
            continue
        if name != "SUPABASE_KEY":
            os.environ["SUPABASE_KEY"] = value
        return value, name
    return None, None


def resolve_supabase_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve Supabase URL and key from environment variables.

    Returns: (url, key, key_source_env_name)
    """
    url = _resolve_supabase_url()

    key_candidates = (
        "SUPABASE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
    key, key_source = _resolve_supabase_key(key_candidates)
    return url, key, key_source


def _resolve_supabase_service_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve credentials for privileged operations (e.g., account deletion).

    This intentionally prefers service-role style keys even when SUPABASE_KEY
    is set to an anon key, so destructive actions don't silently fail.
    """
    url = _resolve_supabase_url()

    service_key_candidates = (
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_KEY",  # Some setups overload SUPABASE_KEY with the service role
    )
    key, key_source = _resolve_supabase_key(service_key_candidates)
    return url, key, key_source


def create_supabase_client() -> Optional[Client]:
    """Create a Supabase client from environment variables, or return None if unavailable."""
    url, key, _ = resolve_supabase_credentials()
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception as exc:
        logger.warning(
            "Failed to create Supabase client",
            extra={"event_type": "fallback_activation", "fallback": "supabase_client_create_failed", "error": str(exc)},
        )
        return None


def create_supabase_service_client() -> Tuple[Optional[Client], Optional[str]]:
    """
    Create a Supabase client using a service-role key when available.

    Returns a tuple of (client, key_source) where key_source is the env var name used.
    """
    url, key, key_source = _resolve_supabase_service_credentials()
    if not url or not key:
        return None, None
    try:
        return create_client(url, key), key_source
    except Exception as exc:
        logger.warning(
            "Failed to create Supabase service client",
            extra={
                "event_type": "fallback_activation",
                "fallback": "supabase_service_client_create_failed",
                "key_source": key_source,
                "error": str(exc),
            },
        )
        return None, key_source
