from __future__ import annotations

from typing import Optional

TIERS = ("scout", "voyager", "pioneer")

TIER_ALIASES = {
    # Legacy / internal labels that should still receive paid-tier capabilities.
    "pro": "voyager",
    "premium": "pioneer",
    "operator": "pioneer",
    "admin": "pioneer",
    "depth": "pioneer",
}


def normalize_plan_tier(plan_tier: Optional[str], role: Optional[str] = None) -> str:
    """
    Normalize a user tier label to one of: scout, voyager, pioneer.

    Some deployments historically used alternate labels (e.g. "pro", "admin").
    This keeps backend authorization and token limits consistent even when the
    stored `plan_tier` is missing or uses an alias.
    """
    candidate = (plan_tier or "").strip().lower()
    if not candidate and role:
        candidate = role.strip().lower()

    if candidate in TIERS:
        return candidate

    mapped = TIER_ALIASES.get(candidate)
    if mapped:
        return mapped

    return "scout"

