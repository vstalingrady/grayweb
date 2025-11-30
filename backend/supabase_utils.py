import os
from typing import Optional, Tuple

from supabase import Client, create_client


def resolve_supabase_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve Supabase URL and key from environment variables with sensible fallbacks.

    URL resolution order:
    - SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_URL (so backend automatically reuses frontend config)
    - SUPABASE_PROJECT_URL / SUPABASE_HOST (with https:// prefix)
    - Derive from Postgres host (e.g., <ref>.supabase.co) if present

    Key resolution order:
    - SUPABASE_KEY
    - SUPABASE_SERVICE_ROLE_KEY
    - SUPABASE_SERVICE_KEY
    - SUPABASE_SECRET_KEY
    - SUPABASE_ANON_KEY
    - NEXT_PUBLIC_SUPABASE_ANON_KEY (read-only fallback)

    Returns: (url, key, key_source_env_name)
    """

    def _normalize_url(value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            return ""
        if trimmed.startswith("http://") or trimmed.startswith("https://"):
            return trimmed.rstrip("/")
        return f"https://{trimmed.lstrip('/').rstrip('/')}"

    url_candidates = [
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_PROJECT_URL",
        "SUPABASE_HOST",
    ]

    url: Optional[str] = None
    for env_name in url_candidates:
        candidate = os.getenv(env_name, "").strip()
        if candidate and "your_supabase_url" not in candidate.lower():
            url = _normalize_url(candidate)
            if env_name != "SUPABASE_URL":
                os.environ["SUPABASE_URL"] = url
            break

    if not url:
        # Attempt to infer from pooled Postgres host: aws-1-<region>.pooler.supabase.com
        host = os.getenv("host") or os.getenv("PGHOST") or ""
        if "supabase" in host:
            parts = host.split(".")
            if parts:
                project_ref = parts[0]
                url = f"https://{project_ref}.supabase.co"
                os.environ["SUPABASE_URL"] = url

    candidate_keys = [
        "SUPABASE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
    key: Optional[str] = None
    key_source: Optional[str] = None
    for name in candidate_keys:
        value = (os.getenv(name) or "").strip()
        if value and "your_supabase_key_here" not in value.lower():
            key = value
            key_source = name
            # Normalize into SUPABASE_KEY for consistency in the process env
            if name != "SUPABASE_KEY":
                os.environ["SUPABASE_KEY"] = value
            break

    return url, key, key_source


def _resolve_supabase_service_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve credentials for privileged operations (e.g., account deletion).

    This intentionally prefers service-role style keys even when SUPABASE_KEY
    is set to an anon key, so destructive actions don't silently fail.
    """
    def _normalize_url(value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            return ""
        if trimmed.startswith("http://") or trimmed.startswith("https://"):
            return trimmed.rstrip("/")
        return f"https://{trimmed.lstrip('/').rstrip('/')}"

    url_candidates = [
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_PROJECT_URL",
        "SUPABASE_HOST",
    ]

    url: Optional[str] = None
    for env_name in url_candidates:
        candidate = os.getenv(env_name, "").strip()
        if candidate and "your_supabase_url" not in candidate.lower():
            url = _normalize_url(candidate)
            if env_name != "SUPABASE_URL":
                os.environ["SUPABASE_URL"] = url
            break

    service_key_candidates = [
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_KEY",  # Some setups overload SUPABASE_KEY with the service role
    ]

    key: Optional[str] = None
    key_source: Optional[str] = None
    for name in service_key_candidates:
        value = (os.getenv(name) or "").strip()
        if value and "your_supabase_key_here" not in value.lower():
            key = value
            key_source = name
            if name != "SUPABASE_KEY":
                os.environ["SUPABASE_KEY"] = value
            break

    return url, key, key_source


def create_supabase_client() -> Optional[Client]:
    """Create a Supabase client from environment variables, or return None if unavailable."""
    url, key, _ = resolve_supabase_credentials()
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception:
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
    except Exception:
        return None, key_source
