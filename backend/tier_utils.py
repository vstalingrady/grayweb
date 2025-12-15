from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

TIERS = ("scout", "voyager", "pioneer")

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
    Normalize a user tier label to one of: scout, voyager, pioneer.
    
    Automatically downgrades users with expired subscriptions to scout tier.

    Some deployments historically used alternate labels (e.g. "pro", "admin").
    This keeps backend authorization and token limits consistent even when the
    stored `plan_tier` is missing or uses an alias.
    
    Args:
        plan_tier: The user's stored plan tier
        role: Optional role fallback for legacy users
        subscription_expires_at: When the subscription expires (None means no expiration)
    
    Returns:
        Normalized tier name (scout, voyager, or pioneer)
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
    if normalized in ("voyager", "pioneer") and subscription_expires_at is not None:
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

