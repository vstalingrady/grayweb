import os
from typing import Optional, Tuple

from supabase import Client, create_client


def resolve_supabase_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve Supabase URL and key from environment variables with sensible fallbacks.

    Order for URL:
    - SUPABASE_URL
    - Derive from Postgres host (e.g., <ref>.supabase.co) if present

    Order for KEY:
    - SUPABASE_KEY
    - SUPABASE_SERVICE_ROLE_KEY
    - SUPABASE_SERVICE_KEY
    - SUPABASE_SECRET_KEY
    - SUPABASE_ANON_KEY

    Returns: (url, key, key_source_env_name)
    """
    url = (os.getenv("SUPABASE_URL") or "").strip() or None
    if not url:
        # Attempt to infer from pooled Postgres host: aws-1-<region>.pooler.supabase.com
        host = os.getenv("host") or os.getenv("PGHOST") or ""
        if "supabase" in host:
            parts = host.split(".")
            if parts:
                project_ref = parts[0]
                url = f"https://{project_ref}.supabase.co"

    candidate_keys = [
        "SUPABASE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_ANON_KEY",
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


def create_supabase_client() -> Optional[Client]:
    """Create a Supabase client from environment variables, or return None if unavailable."""
    url, key, _ = resolve_supabase_credentials()
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception:
        return None

