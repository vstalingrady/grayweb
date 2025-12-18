from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional, Tuple

from backend.time_utils import utcnow

BillingCycle = Literal["monthly", "annual"]


def normalize_billing_cycle(value: Optional[str]) -> BillingCycle:
    normalized = (value or "").strip().lower()
    if normalized in ("annual", "yearly", "year"):
        return "annual"
    return "monthly"


def _as_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def subscription_duration(cycle: BillingCycle) -> timedelta:
    if cycle == "annual":
        return timedelta(days=365)
    return timedelta(days=30)


def calculate_subscription_period(
    *,
    billing_cycle: Optional[str],
    existing_expires_at: Optional[datetime] = None,
    now: Optional[datetime] = None,
) -> Tuple[datetime, datetime]:
    """
    Compute the next subscription period (start, end).

    - Uses exact day lengths: 30 days (monthly), 365 days (annual).
    - Extends active subscriptions: if `existing_expires_at` is in the future,
      the new period starts at that expiry instead of "now".

    All values are treated as naive UTC to match current DB conventions.
    """
    cycle = normalize_billing_cycle(billing_cycle)
    now_value = _as_naive_utc(now) or utcnow()
    existing_value = _as_naive_utc(existing_expires_at)

    period_start = existing_value if existing_value and existing_value > now_value else now_value
    period_end = period_start + subscription_duration(cycle)
    return period_start, period_end
