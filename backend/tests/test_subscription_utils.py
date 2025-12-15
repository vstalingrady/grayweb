from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.subscription_utils import calculate_subscription_period, normalize_billing_cycle


def test_normalize_billing_cycle():
    assert normalize_billing_cycle("monthly") == "monthly"
    assert normalize_billing_cycle("annual") == "annual"
    assert normalize_billing_cycle("yearly") == "annual"
    assert normalize_billing_cycle("year") == "annual"
    assert normalize_billing_cycle(None) == "monthly"


def test_monthly_period_uses_30_days():
    now = datetime(2025, 1, 1, 12, 0, 0)
    starts_at, ends_at = calculate_subscription_period(billing_cycle="monthly", now=now)
    assert starts_at == now
    assert ends_at == now + timedelta(days=30)


def test_annual_period_uses_365_days():
    now = datetime(2025, 1, 1, 12, 0, 0)
    starts_at, ends_at = calculate_subscription_period(billing_cycle="annual", now=now)
    assert starts_at == now
    assert ends_at == now + timedelta(days=365)


def test_extends_active_subscription_from_existing_expiry():
    now = datetime(2025, 1, 1, 12, 0, 0)
    existing_expires_at = now + timedelta(days=10)
    starts_at, ends_at = calculate_subscription_period(
        billing_cycle="monthly",
        existing_expires_at=existing_expires_at,
        now=now,
    )
    assert starts_at == existing_expires_at
    assert ends_at == existing_expires_at + timedelta(days=30)


def test_does_not_extend_if_existing_is_expired():
    now = datetime(2025, 1, 1, 12, 0, 0)
    existing_expires_at = now - timedelta(seconds=1)
    starts_at, ends_at = calculate_subscription_period(
        billing_cycle="monthly",
        existing_expires_at=existing_expires_at,
        now=now,
    )
    assert starts_at == now
    assert ends_at == now + timedelta(days=30)


def test_accepts_timezone_aware_datetimes():
    now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    existing_expires_at = datetime(2025, 1, 10, 12, 0, 0, tzinfo=timezone.utc)
    starts_at, ends_at = calculate_subscription_period(
        billing_cycle="monthly",
        existing_expires_at=existing_expires_at,
        now=now,
    )
    assert starts_at.tzinfo is None
    assert ends_at.tzinfo is None
    assert starts_at == datetime(2025, 1, 10, 12, 0, 0)
    assert ends_at == datetime(2025, 2, 9, 12, 0, 0)

