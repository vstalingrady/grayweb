from __future__ import annotations

import os
import re
from datetime import timedelta
from typing import Any, Dict, Optional, Tuple

import databases
import sqlalchemy

from backend.database import affiliates, affiliate_referrals, affiliate_commissions
from backend.time_utils import utcnow
from backend.compat_imports import row_get as _row_get

AFFILIATE_COOKIE_NAME = "gray-affiliate"
AFFILIATE_DEFAULT_DISCOUNT_RATE = float(os.getenv("AFFILIATE_DEFAULT_DISCOUNT_RATE", "0.10"))
AFFILIATE_COMMISSION_WINDOW_DAYS = int(os.getenv("AFFILIATE_COMMISSION_WINDOW_DAYS", "180"))

_AFFILIATE_CODE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{1,63}$")


def normalize_affiliate_code(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    code = raw.strip().lower()
    if not code:
        return None
    if not _AFFILIATE_CODE_PATTERN.match(code):
        return None
    return code


def extract_affiliate_code(request) -> Optional[str]:
    if not request:
        return None
    try:
        raw = request.cookies.get(AFFILIATE_COOKIE_NAME)
    except Exception:
        raw = None
    return normalize_affiliate_code(raw)


def _normalize_email(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    normalized = raw.strip().lower()
    return normalized or None


async def assign_affiliate_owner_if_needed(
    db: databases.Database,
    user: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    user_id = _row_get(user, "id")
    email = _normalize_email(_row_get(user, "email"))
    if not user_id or not email:
        return None

    affiliate = await db.fetch_one(
        affiliates.select()
        .where(affiliates.c.owner_user_id.is_(None))
        .where(sqlalchemy.func.lower(affiliates.c.owner_email) == email)
    )
    if not affiliate:
        return None

    await db.execute(
        affiliates.update()
        .where(affiliates.c.id == affiliate["id"])
        .values(owner_user_id=user_id, updated_at=utcnow())
    )
    return dict(affiliate)


async def attach_affiliate_referral(
    db: databases.Database,
    user: Dict[str, Any],
    request,
) -> Optional[int]:
    user_id = _row_get(user, "id")
    if not user_id:
        return None

    code = extract_affiliate_code(request)
    if not code:
        return None

    affiliate = await db.fetch_one(
        affiliates.select().where(affiliates.c.code == code).where(affiliates.c.is_active.is_(True))
    )
    if not affiliate:
        return None

    user_email = _normalize_email(_row_get(user, "email"))
    owner_email = _normalize_email(_row_get(affiliate, "owner_email"))
    if user_email and owner_email and user_email == owner_email:
        return None

    existing = await db.fetch_one(
        affiliate_referrals.select().where(affiliate_referrals.c.referred_user_id == user_id)
    )
    if existing:
        return None

    now = utcnow()
    await db.execute(
        affiliate_referrals.insert().values(
            affiliate_id=affiliate["id"],
            referred_user_id=user_id,
            referred_email=user_email,
            attributed_at=now,
            created_at=now,
            updated_at=now,
        )
    )
    return affiliate["id"]


async def resolve_affiliate_discount(
    db: databases.Database,
    *,
    user_id: int,
    billing_cycle: Optional[str],
) -> Tuple[float, Optional[int], Optional[int]]:
    if not user_id:
        return 0.0, None, None

    cycle = (billing_cycle or "monthly").strip().lower()
    if cycle != "monthly":
        return 0.0, None, None

    referral = await db.fetch_one(
        affiliate_referrals.select().where(affiliate_referrals.c.referred_user_id == user_id)
    )
    if not referral or referral["conversion_at"] is not None:
        return 0.0, None, None

    affiliate = await db.fetch_one(
        affiliates.select().where(affiliates.c.id == referral["affiliate_id"]) 
        .where(affiliates.c.is_active.is_(True))
    )
    if not affiliate:
        return 0.0, None, None

    discount_rate = affiliate["discount_rate"]
    if discount_rate is None:
        discount_rate = AFFILIATE_DEFAULT_DISCOUNT_RATE

    if discount_rate <= 0:
        return 0.0, affiliate["id"], referral["id"]

    return float(discount_rate), affiliate["id"], referral["id"]


def apply_discount(amount: int, rate: float) -> int:
    if amount <= 0:
        return 0
    if rate <= 0:
        return amount
    return max(0, int(round(amount * (1 - rate))))


async def record_affiliate_commission(
    db: databases.Database,
    *,
    user_id: int,
    transaction_id: Optional[int],
    order_id: str,
    amount: int,
    currency: Optional[str],
    paid_at,
) -> Optional[int]:
    if not user_id or not order_id:
        return None

    referral = await db.fetch_one(
        affiliate_referrals.select().where(affiliate_referrals.c.referred_user_id == user_id)
    )
    if not referral:
        return None

    affiliate = await db.fetch_one(
        affiliates.select().where(affiliates.c.id == referral["affiliate_id"]) 
        .where(affiliates.c.is_active.is_(True))
    )
    if not affiliate:
        return None

    conversion_at = referral["conversion_at"]
    if conversion_at is None:
        conversion_at = paid_at
        await db.execute(
            affiliate_referrals.update()
            .where(affiliate_referrals.c.id == referral["id"])
            .values(conversion_at=conversion_at, conversion_order_id=order_id, updated_at=utcnow())
        )

    if conversion_at is None:
        return None

    window_end = conversion_at + timedelta(days=AFFILIATE_COMMISSION_WINDOW_DAYS)
    if paid_at and paid_at > window_end:
        return None

    existing = await db.fetch_one(
        affiliate_commissions.select().where(affiliate_commissions.c.order_id == order_id)
    )
    if existing:
        return None

    commission_rate = affiliate["commission_rate"] or 0.0
    commission_amount = max(0, int(round(amount * commission_rate)))

    await db.execute(
        affiliate_commissions.insert().values(
            affiliate_id=affiliate["id"],
            referral_id=referral["id"],
            transaction_id=transaction_id,
            order_id=order_id,
            amount=amount,
            currency=currency,
            commission_rate=float(commission_rate),
            commission_amount=commission_amount,
            created_at=utcnow(),
        )
    )
    return affiliate["id"]


async def resolve_affiliate_for_user(
    db: databases.Database,
    *,
    user: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    user_id = _row_get(user, "id")
    if user_id:
        affiliate = await db.fetch_one(
            affiliates.select().where(affiliates.c.owner_user_id == user_id)
        )
        if affiliate:
            return dict(affiliate)

    email = _normalize_email(_row_get(user, "email"))
    if not email:
        return None

    affiliate = await db.fetch_one(
        affiliates.select().where(sqlalchemy.func.lower(affiliates.c.owner_email) == email)
    )
    if affiliate and not affiliate["owner_user_id"]:
        await db.execute(
            affiliates.update()
            .where(affiliates.c.id == affiliate["id"])
            .values(owner_user_id=user_id, updated_at=utcnow())
        )
    return dict(affiliate) if affiliate else None
