from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

TIERS = ("scout", "pathfinder", "voyager", "pioneer")

TIER_ALIASES = {
    # Legacy / internal labels that should still receive paid-tier capabilities.
    "pro": "voyager",
    "premium": "pioneer",
    "operator": "pioneer",
    "admin": "pioneer",
    "depth": "pioneer",
}


def normalize_plan_tier(
    plan_tier: Optional[str],
    role: Optional[str] = None,
    subscription_expires_at: Optional[datetime] = None,
) -> str:
    """
    Normalize a user tier label to one of: scout, pathfinder, voyager, pioneer.
    
    Automatically downgrades users with expired subscriptions to scout tier.

    Some deployments historically used alternate labels (e.g. "pro", "admin").
    This keeps backend authorization and token limits consistent even when the
    stored `plan_tier` is missing or uses an alias.
    
    Args:
        plan_tier: The user's stored plan tier
        role: Optional role fallback for legacy users
        subscription_expires_at: When the subscription expires (None means no expiration)
    
    Returns:
        Normalized tier name (scout, pathfinder, voyager, or pioneer)
    """
    candidate = (plan_tier or "").strip().lower()
    if not candidate and role:
        candidate = role.strip().lower()

    if candidate in TIERS:
        normalized = candidate
    else:
        mapped = TIER_ALIASES.get(candidate)
        normalized = mapped if mapped else "scout"
    
    # Check if subscription has expired (only for paid tiers)
    if normalized in ("pathfinder", "voyager", "pioneer") and subscription_expires_at is not None:
        now = datetime.now(timezone.utc)
        # Make subscription_expires_at timezone-aware if it isn't already
        if subscription_expires_at.tzinfo is None:
            subscription_expires_at = subscription_expires_at.replace(tzinfo=timezone.utc)
        
        if now >= subscription_expires_at:
            logger.warning(
                f"Subscription expired for tier {normalized}, downgrading to scout. "
                f"Expired at: {subscription_expires_at.isoformat()}"
            )
            return "scout"
    
    return normalized


_BOOTSTRAP_PIONEER_EMAILS_ENV = "BOOTSTRAP_PIONEER_EMAILS"


def bootstrap_plan_tier(email: Optional[str], *, default: str = "scout") -> str:
    """
    Return the initial plan tier to assign to a newly provisioned user.

    This avoids hardcoding special-case emails in multiple places. To grant a
    specific user pioneer automatically, set `BOOTSTRAP_PIONEER_EMAILS` to a
    comma/space/semicolon separated list of emails.
    """
    normalized_default = normalize_plan_tier(default)
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        return normalized_default

    raw = os.getenv(_BOOTSTRAP_PIONEER_EMAILS_ENV, "")
    if not raw.strip():
        return normalized_default

    candidates = {
        entry.strip().lower()
        for entry in re.split(r"[,\s;]+", raw)
        if entry.strip()
    }
    if normalized_email in candidates:
        return "pioneer"
    return normalized_default
