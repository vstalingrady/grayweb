"""
Payment API routes for Midtrans and Dodo Payments.

This router handles payment charge creation and webhook notifications.
"""

import os
from urllib.parse import urlparse
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

# Import models
from backend.models import PaymentRequest, PaymentChargeResponse, MidtransNotification

# Import dependencies
from backend.database import database, payment_webhook_events, transactions, users, get_database
from backend.auth import get_current_user
from backend.time_utils import utcnow
from backend.compat_imports import row_get as _row_get
from backend.core.cors_utils import IS_PRODUCTION

router = APIRouter(tags=["payments"])


def _get_logger():
    """Get app logger."""
    from backend.logging_config import create_logger

    return create_logger("backend.api.payments")


def _get_cache_helpers():
    """Get cache invalidation helpers."""
    from backend.auth import invalidate_user_cache, invalidate_user_cache_redis

    return invalidate_user_cache, invalidate_user_cache_redis


_PLAN_PRICING_IDR: Dict[str, Dict[str, int]] = {
    "pathfinder": {"monthly": 77000, "annual": 777000},
    "voyager": {"monthly": 177000, "annual": 1777000},
    "pioneer": {"monthly": 377000, "annual": 3777000},
}

_PLAN_PRICING_USD: Dict[str, Dict[str, int]] = {
    "pathfinder": {"monthly": 700, "annual": 7700},
    "voyager": {"monthly": 1700, "annual": 17700},
    "pioneer": {"monthly": 3700, "annual": 37700},
}

_ADAPTIVE_CURRENCY_MARKER = "ADAPTIVE"


def _normalize_provider(provider: Optional[str]) -> str:
    if not provider:
        return "midtrans"
    p = provider.strip().lower()
    if p not in ("midtrans", "dodo"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported payment provider: {p}",
        )
    return p


def _get_plan_amount(
    plan_tier: str,
    billing_cycle: Optional[str],
    billing_currency: Optional[str] = None,
) -> Tuple[int, str, str]:
    tier = (plan_tier or "").strip().lower()
    cycle = _normalize_billing_cycle_value(billing_cycle)
    currency = (billing_currency or "").strip().upper()

    if tier not in _PLAN_PRICING_IDR:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    if currency and currency not in {"USD", "IDR"}:
        raise HTTPException(status_code=400, detail=f"Unsupported billing currency: {currency}")

    if currency == "USD":
        pricing = _PLAN_PRICING_USD
        currency = "USD"
    else:
        pricing = _PLAN_PRICING_IDR
        currency = "IDR"

    amount = pricing[tier][cycle]
    item_name = f"Gray {tier.capitalize()} Plan ({'Annual' if cycle == 'annual' else 'Monthly'})"
    return amount, item_name, currency


def _get_dodo_product_id(
    plan_tier: str,
    billing_cycle: Optional[str],
    billing_currency: Optional[str] = None,
) -> str:
    tier = (plan_tier or "").strip().upper()
    cycle = _normalize_billing_cycle_value(billing_cycle).upper()
    currency = (billing_currency or "").strip().upper()
    base_key = f"DODO_PRODUCT_{tier}_{cycle}"

    if currency:
        currency_key = f"{base_key}_{currency}"
        product_id = os.getenv(currency_key)
        if product_id:
            return product_id

    product_id = os.getenv(base_key)
    if not product_id:
        raise HTTPException(status_code=500, detail=f"Missing {base_key} environment variable")
    return product_id


def _resolve_plan_from_product_id(product_id: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not product_id:
        return None, None
    for key, value in os.environ.items():
        if not key.startswith("DODO_PRODUCT_"):
            continue
        if value != product_id:
            continue
        parts = key.split("_")
        if len(parts) < 4:
            continue
        tier = parts[2].lower()
        cycle = parts[3].lower()
        if cycle == "monthly":
            return tier, "monthly"
        if cycle == "annual":
            return tier, "annual"
    return None, None


def _normalize_allowed_host(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if "://" in cleaned:
        parsed = urlparse(cleaned)
        host = parsed.hostname
    else:
        host = cleaned
    if not host:
        return None
    return host.lower().strip(".")


def _get_allowed_return_hosts() -> List[str]:
    hosts = set()
    for candidate in (
        os.getenv("DODO_PAYMENTS_RETURN_URL"),
        os.getenv("NEXT_PUBLIC_SITE_URL"),
        os.getenv("SITE_URL"),
    ):
        host = _normalize_allowed_host(candidate)
        if host:
            hosts.add(host)

    allowlist = os.getenv("DODO_RETURN_URL_ALLOWLIST")
    if allowlist:
        for entry in allowlist.split(","):
            host = _normalize_allowed_host(entry)
            if host:
                hosts.add(host)
    return sorted(hosts)


def _is_allowed_host(host: str, allowed_hosts: List[str]) -> bool:
    normalized = host.lower().strip(".")
    for allowed in allowed_hosts:
        if normalized == allowed or normalized.endswith(f".{allowed}"):
            return True
    return False


def _normalize_return_url(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    candidate = raw.strip()
    if not candidate:
        return None

    if candidate.startswith("/"):
        site_url = os.getenv("NEXT_PUBLIC_SITE_URL") or os.getenv("SITE_URL")
        if not site_url:
            return None
        candidate = f"{site_url.rstrip('/')}{candidate}"

    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    if IS_PRODUCTION and parsed.scheme != "https":
        return None

    allowed_hosts = _get_allowed_return_hosts()
    if not allowed_hosts or not _is_allowed_host(parsed.hostname, allowed_hosts):
        return None

    return parsed._replace(fragment="").geturl()


def _get_dodo_return_url(request: PaymentRequest) -> Optional[str]:
    if request.return_url:
        normalized = _normalize_return_url(request.return_url)
        if not normalized:
            raise HTTPException(status_code=400, detail="Invalid return_url")
        return normalized
    env_return = os.getenv("DODO_PAYMENTS_RETURN_URL")
    if env_return:
        normalized = _normalize_return_url(env_return)
        if normalized:
            return normalized
        return None
    site_url = os.getenv("NEXT_PUBLIC_SITE_URL") or os.getenv("SITE_URL")
    if site_url:
        return _normalize_return_url(f"{site_url.rstrip('/')}/payment/finish")
    return None


def _get_dodo_allowed_payment_methods() -> List[str]:
    raw = os.getenv("DODO_ALLOWED_PAYMENT_METHOD_TYPES")
    if raw:
        return [item.strip() for item in raw.split(",") if item.strip()]
    return ["credit", "debit"]


def _parse_amount(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _normalize_currency_code(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    if not normalized:
        return None
    return normalized


def _is_adaptive_currency_value(value: Any) -> bool:
    normalized = _normalize_currency_code(value)
    return normalized in {_ADAPTIVE_CURRENCY_MARKER, "AUTO"}


def _parse_amount_for_success_validation(
    raw_value: Any,
    *,
    provider: str,
    order_id: Optional[str],
    field_name: str,
    app_logger,
) -> Optional[int]:
    if raw_value is None:
        return None
    if isinstance(raw_value, str) and not raw_value.strip():
        return None

    parsed_amount = _parse_amount(raw_value)
    if parsed_amount is None:
        app_logger.error(
            "Invalid amount payload for success webhook",
            extra={
                "provider": provider,
                "order_id": order_id,
                "field_name": field_name,
                "raw_value": str(raw_value),
            },
        )
        raise HTTPException(status_code=409, detail="Invalid amount payload")
    return parsed_amount


def _get_dodo_session_value(session: Any, key: str) -> Optional[Any]:
    if isinstance(session, dict):
        return session.get(key)
    return getattr(session, key, None)


def _event_value(payload: Any, key: str, default: Any = None) -> Any:
    if isinstance(payload, dict):
        return payload.get(key, default)
    return getattr(payload, key, default)


def _extract_metadata(payload_data: Any) -> Dict[str, Any]:
    if not isinstance(payload_data, dict):
        return {}
    metadata = payload_data.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    for nested_key in ("object", "data", "payment", "subscription", "checkout", "checkout_session"):
        nested = payload_data.get(nested_key)
        if isinstance(nested, dict) and isinstance(nested.get("metadata"), dict):
            return nested["metadata"]
    return {}


def _generate_order_id(prefix: str, user_id: Any) -> str:
    return f"{prefix}-{user_id}-{uuid4().hex}"


def _normalize_billing_cycle_value(value: Optional[str]) -> str:
    from backend.subscription_utils import normalize_billing_cycle

    return normalize_billing_cycle(value)


def _parse_provider_timestamp(raw_value: Any) -> Optional[datetime]:
    if not raw_value:
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    if len(normalized) >= 5 and normalized[-5] in ("+", "-") and normalized[-3] != ":":
        normalized = f"{normalized[:-2]}:{normalized[-2:]}"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def _as_naive_utc_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return _parse_provider_timestamp(value)


def _midtrans_event_key(notification: MidtransNotification) -> str:
    transaction_id = (notification.transaction_id or "").strip()
    if transaction_id:
        return transaction_id
    return (
        f"{notification.order_id}:{notification.transaction_status}:"
        f"{notification.status_code}:{notification.gross_amount}:{notification.transaction_time}"
    )


def _dodo_event_key(
    *,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    event_type: Optional[str],
    order_id: Optional[str],
) -> str:
    header_id = (headers.get("webhook-id") or "").strip()
    if header_id:
        return header_id
    payload_id = _event_value(payload, "id")
    if payload_id:
        return str(payload_id)
    timestamp = (headers.get("webhook-timestamp") or "").strip()
    signature = (headers.get("webhook-signature") or "").strip()
    return f"{event_type or 'unknown'}:{order_id or ''}:{timestamp}:{signature[:48]}"


async def _reserve_payment_webhook_event(
    *,
    provider: str,
    event_key: str,
    order_id: Optional[str],
    event_type: Optional[str],
) -> bool:
    normalized_key = (event_key or "").strip()
    if not normalized_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed webhook event payload: missing event identifier.",
        )
    try:
        await database.execute(
            payment_webhook_events.insert().values(
                provider=provider,
                event_key=normalized_key,
                order_id=order_id,
                event_type=event_type,
                created_at=utcnow(),
            )
        )
        return True
    except Exception as exc:
        message = str(exc).lower()
        if "unique" in message or "duplicate" in message:
            # Retry-safe behavior for transient failures:
            # if this order is still unresolved/non-final, allow re-processing.
            if order_id:
                existing_transaction = await database.fetch_one(
                    transactions.select().where(transactions.c.order_id == order_id)
                )
                if existing_transaction is None:
                    _get_logger().warning(
                        "Allowing webhook retry because transaction is not yet visible",
                        extra={
                            "event_type": "payment_webhook_retry_allowed_missing_transaction",
                            "provider": provider,
                            "order_id": order_id,
                            "event_key": normalized_key,
                        },
                    )
                    return True

                status_value = str(existing_transaction["status"] or "").strip().lower()
                final_statuses = {
                    "success",
                    "failed",
                    "cancelled",
                    "expired",
                    "refunded",
                    "chargeback",
                }
                if status_value not in final_statuses:
                    _get_logger().warning(
                        "Allowing webhook retry for non-final transaction state",
                        extra={
                            "event_type": "payment_webhook_retry_allowed_non_final_transaction",
                            "provider": provider,
                            "order_id": order_id,
                            "status": status_value,
                            "event_key": normalized_key,
                        },
                    )
                    return True
            return False
        raise


async def _extend_user_subscription_atomic(
    *,
    user_id: int,
    plan_tier: str,
    billing_cycle: Optional[str],
    now: Optional[datetime] = None,
    max_retries: int = 5,
) -> Tuple[datetime, datetime]:
    from backend.subscription_utils import subscription_duration

    normalized_cycle = _normalize_billing_cycle_value(billing_cycle)
    extension_duration = subscription_duration(normalized_cycle)
    now_value = _as_naive_utc_datetime(now) or utcnow()
    normalized_plan = str(plan_tier or "").strip().lower() or "scout"

    for _ in range(max_retries):
        user_row = await database.fetch_one(users.select().where(users.c.id == user_id))
        if user_row is None:
            raise HTTPException(status_code=409, detail="Unknown user")

        existing_expires_snapshot = user_row["subscription_expires_at"]
        existing_expires_at = _as_naive_utc_datetime(existing_expires_snapshot)
        subscription_starts_at = (
            existing_expires_at if existing_expires_at and existing_expires_at > now_value else now_value
        )
        subscription_expires_at = subscription_starts_at + extension_duration

        claim_query = (
            users.update()
            .where(users.c.id == user_id)
            .values(
                plan_tier=normalized_plan,
                subscription_expires_at=subscription_expires_at,
                updated_at=utcnow(),
            )
        )
        if existing_expires_snapshot is None:
            claim_query = claim_query.where(users.c.subscription_expires_at.is_(None))
        else:
            claim_query = claim_query.where(users.c.subscription_expires_at == existing_expires_snapshot)

        claim = await database.fetch_one(claim_query.returning(users.c.subscription_expires_at))
        if claim is not None:
            updated_expires_at = _as_naive_utc_datetime(claim["subscription_expires_at"]) or subscription_expires_at
            updated_starts_at = updated_expires_at - extension_duration
            return updated_starts_at, updated_expires_at

    raise HTTPException(status_code=409, detail="Concurrent subscription update conflict")


async def _reconcile_user_plan_after_reversal(
    *,
    user_id: int,
    reversed_order_id: Optional[str],
    reason: str,
    invalidate_user_cache,
    invalidate_user_cache_redis,
    app_logger,
) -> None:
    from backend.tier_utils import normalize_plan_tier

    now = utcnow()
    existing_user_row = await database.fetch_one(users.select().where(users.c.id == user_id))
    active_success_tx = await database.fetch_one(
        transactions.select()
        .where(transactions.c.user_id == user_id)
        .where(transactions.c.status == "success")
        .where(transactions.c.subscription_ends_at.isnot(None))
        .where(transactions.c.subscription_ends_at > now)
        .where(transactions.c.order_id != reversed_order_id)
        .order_by(transactions.c.subscription_ends_at.desc())
    )

    preserve_non_expiring_pioneer = False
    if existing_user_row:
        current_expires_at = existing_user_row["subscription_expires_at"]
        current_plan_tier = normalize_plan_tier(
            existing_user_row["plan_tier"],
            subscription_expires_at=current_expires_at,
        )
        preserve_non_expiring_pioneer = (
            current_plan_tier == "pioneer"
            and current_expires_at is None
            and active_success_tx is None
        )

    if active_success_tx:
        next_plan = str(active_success_tx["plan_tier"] or "scout").strip().lower()
        next_expires_at = active_success_tx["subscription_ends_at"]
    elif preserve_non_expiring_pioneer:
        next_plan = str(existing_user_row["plan_tier"] or "pioneer").strip().lower()
        next_expires_at = None
    else:
        next_plan = "scout"
        next_expires_at = None

    await database.execute(
        users.update()
        .where(users.c.id == user_id)
        .values(
            plan_tier=next_plan,
            subscription_expires_at=next_expires_at,
            updated_at=utcnow(),
        )
    )

    try:
        user_row = await database.fetch_one(users.select().where(users.c.id == user_id))
        user_email = user_row["email"] if user_row else None
        if isinstance(user_email, str) and user_email.strip():
            normalized_email = user_email.strip().lower()
            invalidate_user_cache(normalized_email)
            await invalidate_user_cache_redis(normalized_email)
    except Exception as exc:
        app_logger.warning(
            "Failed to invalidate auth cache after subscription reversal",
            extra={"user_id": user_id, "error": str(exc), "reason": reason},
        )

    app_logger.info(
        "Applied subscription reversal reconciliation",
        extra={
            "user_id": user_id,
            "reason": reason,
            "reversed_order_id": reversed_order_id,
            "next_plan_tier": next_plan,
            "next_subscription_expires_at": next_expires_at.isoformat() if next_expires_at else None,
        },
    )


async def _create_midtrans_charge(request: PaymentRequest, user: Dict[str, Any]) -> PaymentChargeResponse:
    from backend.payment_utils import create_core_api_transaction

    app_logger = _get_logger()
    normalized_plan = (request.plan_tier or "").strip().lower()
    normalized_billing_cycle = _normalize_billing_cycle_value(request.billing_cycle)
    amount, item_name, _ = _get_plan_amount(normalized_plan, normalized_billing_cycle)
    item_details = [
        {
            "id": f"{normalized_plan}_{normalized_billing_cycle}",
            "price": amount,
            "quantity": 1,
            "name": item_name,
        }
    ]

    user_id = _row_get(user, "id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found")

    full_name = (_row_get(user, "full_name") or "").strip()
    first_name = full_name.split(" ")[0] if full_name else "User"
    last_name = " ".join(full_name.split(" ")[1:]) if " " in full_name else ""
    email = (_row_get(user, "email") or "").strip()
    customer_details = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
    }

    order_id = _generate_order_id("ORDER", user_id)

    bank_args = None
    token_id = None
    payment_type = request.payment_type or "gopay"

    if payment_type == "bank_transfer":
        if not request.bank:
            raise HTTPException(status_code=400, detail="Bank is required for bank_transfer")
        bank_args = {"bank": request.bank}
    elif payment_type == "permata":
        bank_args = {"bank": "permata"}
        payment_type = "bank_transfer"
    elif payment_type == "credit_card":
        if not request.token_id:
            raise HTTPException(status_code=400, detail="Token ID is required for credit_card")
        token_id = request.token_id
    elif payment_type in ["echannel", "gopay"]:
        pass
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported payment type: {payment_type}")

    try:
        query = transactions.insert().values(
            user_id=user_id,
            order_id=order_id,
            amount=amount,
            currency="IDR",
            status="pending",
            payment_type=payment_type,
            plan_tier=normalized_plan,
            billing_cycle=normalized_billing_cycle,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        await database.execute(query)
    except Exception as e:
        app_logger.error(f"Database error creating transaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to create transaction record")

    try:
        response = create_core_api_transaction(
            order_id=order_id,
            amount=amount,
            item_details=item_details,
            customer_details=customer_details,
            payment_type=payment_type,
            bank_transfer_args=bank_args,
            token_id=token_id,
        )
    except Exception as e:
        app_logger.error(f"Midtrans API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")

    actions = response.get("actions")
    qr_code_url = None
    deeplink_url = None
    redirect_url = response.get("redirect_url")

    if actions:
        for action in actions:
            if action["name"] == "generate-qr-code":
                qr_code_url = action["url"]
            elif action["name"] == "deeplink-redirect":
                deeplink_url = action["url"]

    return PaymentChargeResponse(
        order_id=order_id,
        status=response.get("transaction_status", "pending"),
        actions=actions,
        qr_code_url=qr_code_url,
        deeplink_url=deeplink_url,
        bill_key=response.get("bill_key"),
        biller_code=response.get("biller_code"),
        va_numbers=response.get("va_numbers"),
        redirect_url=redirect_url,
    )


async def _create_dodo_checkout(request: PaymentRequest, user: Dict[str, Any]) -> PaymentChargeResponse:
    from backend.dodo_payments import DodoPaymentsUnavailable, get_dodo_client

    app_logger = _get_logger()
    user_id = _row_get(user, "id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found")

    billing_currency = request.billing_currency.strip().upper() if request.billing_currency else None
    normalized_plan = (request.plan_tier or "").strip().lower()
    normalized_billing_cycle = _normalize_billing_cycle_value(request.billing_cycle)
    amount, _, _ = _get_plan_amount(normalized_plan, normalized_billing_cycle, billing_currency)
    product_id = _get_dodo_product_id(normalized_plan, normalized_billing_cycle, billing_currency)
    metadata_currency = billing_currency or "adaptive"
    stored_currency = billing_currency or _ADAPTIVE_CURRENCY_MARKER

    order_id = _generate_order_id("DODO", user_id)

    full_name = (_row_get(user, "full_name") or "").strip()
    email = (_row_get(user, "email") or "").strip()
    metadata = {
        "order_id": order_id,
        "user_id": str(user_id),
        "plan_tier": normalized_plan,
        "billing_cycle": normalized_billing_cycle,
        "currency": metadata_currency,
    }

    try:
        query = transactions.insert().values(
            user_id=user_id,
            order_id=order_id,
            amount=amount,
            currency=stored_currency,
            status="pending",
            payment_type="dodo_checkout",
            plan_tier=normalized_plan,
            billing_cycle=normalized_billing_cycle,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        await database.execute(query)
    except Exception as e:
        app_logger.error(f"Database error creating transaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to create transaction record")

    checkout_args: Dict[str, Any] = {
        "product_cart": [{"product_id": product_id, "quantity": 1}],
        "metadata": metadata,
        "allowed_payment_method_types": _get_dodo_allowed_payment_methods(),
        "feature_flags": {
            "allow_discount_code": False,
            "allow_customer_editing_name": True,
            "always_create_new_customer": True,
        },
    }
    if email:
        checkout_args["customer"] = {"email": email}
    return_url = _get_dodo_return_url(request)
    if return_url:
        checkout_args["return_url"] = return_url
    if billing_currency:
        checkout_args["billing_currency"] = billing_currency

    try:
        client = get_dodo_client()
    except DodoPaymentsUnavailable as exc:
        app_logger.error("Dodo payments unavailable", extra={"error": str(exc)})
        raise HTTPException(status_code=503, detail="Dodo payments are not configured")

    try:
        session = client.checkout_sessions.create(**checkout_args)
    except Exception as e:
        app_logger.error(f"Dodo Payments API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")

    checkout_url = _get_dodo_session_value(session, "checkout_url") or _get_dodo_session_value(session, "url")
    session_id = _get_dodo_session_value(session, "session_id") or _get_dodo_session_value(session, "id")

    if not checkout_url:
        raise HTTPException(status_code=502, detail="Checkout session missing checkout_url")

    try:
        await database.execute(
            transactions.update()
            .where(transactions.c.order_id == order_id)
            .values(snap_token=session_id, snap_redirect_url=checkout_url, updated_at=utcnow())
        )
    except Exception as e:
        app_logger.warning("Failed to store Dodo checkout metadata", extra={"error": str(e)})

    return PaymentChargeResponse(
        order_id=order_id,
        status="pending",
        checkout_url=checkout_url,
        session_id=session_id,
    )


@router.post("/api/payment/charge", response_model=PaymentChargeResponse)
@router.post("/payment/charge", response_model=PaymentChargeResponse, include_in_schema=False)
async def create_payment_charge(
    request: PaymentRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    provider = _normalize_provider(request.provider)
    if provider == "dodo":
        return await _create_dodo_checkout(request, user)
    if provider != "midtrans":
        raise HTTPException(status_code=400, detail="Unsupported payment provider")
    return await _create_midtrans_charge(request, user)


@router.post("/api/payment/notification")
@router.post("/payment/notification", include_in_schema=False)
async def handle_payment_notification(notification: MidtransNotification, background_tasks: BackgroundTasks):
    """Handle Midtrans HTTP Notification (Webhook)."""
    from backend.payment_utils import verify_notification_signature
    app_logger = _get_logger()
    invalidate_user_cache, invalidate_user_cache_redis = _get_cache_helpers()
    
    # Get audit logger
    from backend.audit_logger import get_audit_logger, AuditAction

    audit = get_audit_logger()
    
    # 1. Verify Signature
    is_valid = verify_notification_signature(
        order_id=notification.order_id,
        status_code=notification.status_code,
        gross_amount=notification.gross_amount,
        signature_key=notification.signature_key
    )

    if not is_valid:
        app_logger.warning(f"Invalid payment signature for order {notification.order_id}")
        if audit:
            await audit.log(
                AuditAction.SUSPICIOUS_ACTIVITY,
                details={"order_id": notification.order_id, "reason": "invalid_signature"},
                severity="warning"
            )
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_key = _midtrans_event_key(notification)
    event_reserved = await _reserve_payment_webhook_event(
        provider="midtrans",
        event_key=event_key,
        order_id=notification.order_id,
        event_type=notification.transaction_status,
    )
    if not event_reserved:
        app_logger.info(
            "Ignoring duplicate Midtrans webhook event",
            extra={"order_id": notification.order_id, "event_key": event_key},
        )
        return {"status": "ignored"}

    # 2. Update Transaction Status
    existing_transaction = await database.fetch_one(
        transactions.select().where(transactions.c.order_id == notification.order_id)
    )
    previous_status = existing_transaction["status"] if existing_transaction else None

    status_mapping = {
        "capture": "success",
        "settlement": "success", 
        "pending": "pending",
        "deny": "failed",
        "refund": "refunded",
        "partial_refund": "refunded",
        "chargeback": "chargeback",
        "partial_chargeback": "chargeback",
        "expire": "expired",
        "cancel": "cancelled"
    }
    if notification.transaction_status not in status_mapping:
        app_logger.warning(
            "Ignoring Midtrans webhook with unknown transaction_status",
            extra={
                "order_id": notification.order_id,
                "transaction_status": notification.transaction_status,
            },
        )
        return {"status": "ignored"}

    new_status = status_mapping[notification.transaction_status]
    if notification.transaction_status == "capture":
        fraud_status = (notification.fraud_status or "").strip().lower()
        if fraud_status == "challenge":
            new_status = "challenge"
        elif fraud_status == "deny":
            new_status = "failed"

    if (
        existing_transaction is not None
        and str(previous_status or "").strip().lower() == "success"
        and new_status not in {"refunded", "chargeback"}
    ):
        app_logger.warning(
            "Ignoring stale Midtrans webhook that would regress a successful transaction",
            extra={
                "order_id": notification.order_id,
                "previous_status": previous_status,
                "incoming_status": new_status,
                "transaction_status": notification.transaction_status,
            },
        )
        return {"status": "ignored"}

    try:
        amount_value = (
            _parse_amount_for_success_validation(
                notification.gross_amount,
                provider="midtrans",
                order_id=notification.order_id,
                field_name="gross_amount",
                app_logger=app_logger,
            )
            if new_status == "success"
            else _parse_amount(notification.gross_amount)
        )
        currency_value = (_normalize_currency_code(notification.currency) or "IDR")
        expected_amount = existing_transaction["amount"] if existing_transaction else None
        expected_currency = (
            (_normalize_currency_code(existing_transaction["currency"]) or currency_value)
            if existing_transaction
            else currency_value
        )

        if new_status == "success":
            if existing_transaction is None:
                app_logger.error(
                    "Midtrans success webhook has no matching local transaction",
                    extra={"order_id": notification.order_id},
                )
                raise HTTPException(status_code=409, detail="Unknown order_id")
            if (
                expected_amount is not None
                and amount_value is not None
                and int(expected_amount) != int(amount_value)
            ):
                app_logger.error(
                    "Midtrans amount mismatch",
                    extra={
                        "order_id": notification.order_id,
                        "expected_amount": expected_amount,
                        "received_amount": amount_value,
                    },
                )
                raise HTTPException(status_code=409, detail="Amount mismatch")
            if amount_value is None:
                app_logger.error(
                    "Midtrans success webhook missing gross_amount",
                    extra={"order_id": notification.order_id},
                )
                raise HTTPException(status_code=409, detail="Missing amount")
            if expected_currency and currency_value and expected_currency != currency_value:
                app_logger.error(
                    "Midtrans currency mismatch",
                    extra={
                        "order_id": notification.order_id,
                        "expected_currency": expected_currency,
                        "received_currency": currency_value,
                    },
                )
                raise HTTPException(status_code=409, detail="Currency mismatch")

        provider_paid_at = _parse_provider_timestamp(notification.transaction_time)
        paid_at = (
            provider_paid_at
            or (existing_transaction["paid_at"] if existing_transaction and existing_transaction["paid_at"] else None)
            or utcnow()
        )
        updated_amount = (
            amount_value
            if amount_value is not None
            else expected_amount if expected_amount is not None else 0
        )
        updated_currency = (
            currency_value
            if new_status == "success"
            else existing_transaction["currency"] if existing_transaction else currency_value
        )
        updated_paid_at = (
            paid_at
            if new_status == "success"
            else existing_transaction["paid_at"] if existing_transaction else None
        )
        query = transactions.update().where(
            transactions.c.order_id == notification.order_id
        ).values(
            status=new_status,
            amount=updated_amount,
            currency=updated_currency,
            paid_at=updated_paid_at,
            updated_at=utcnow(),
        )
        transitioned_to_success = False
        if new_status == "success":
            transition_claim = await database.fetch_one(
                query.where(transactions.c.status != "success").returning(transactions.c.id)
            )
            transitioned_to_success = transition_claim is not None
        else:
            await database.execute(query)

        should_provision_success = (
            new_status == "success"
            and transitioned_to_success
            and existing_transaction is not None
        )
        should_notify_success = should_provision_success

        # 3. Provision plan only on the first transition to success.
        if should_provision_success:
            trans_query = transactions.select().where(transactions.c.order_id == notification.order_id)
            transaction = await database.fetch_one(trans_query)
            
            if transaction:
                user_id = transaction["user_id"]
                plan_tier = transaction["plan_tier"]

                billing_val = transaction["billing_cycle"] if "billing_cycle" in transaction else None
                billing_cycle = _normalize_billing_cycle_value(billing_val)
                subscription_starts_at, subscription_expires_at = await _extend_user_subscription_atomic(
                    user_id=int(user_id),
                    plan_tier=str(plan_tier or "").strip().lower(),
                    billing_cycle=billing_cycle,
                    now=utcnow(),
                )

                await database.execute(
                    transactions.update()
                    .where(transactions.c.order_id == notification.order_id)
                    .values(
                        subscription_starts_at=subscription_starts_at,
                        subscription_ends_at=subscription_expires_at,
                        updated_at=utcnow(),
                    )
                )

                try:
                    updated_user = await database.fetch_one(users.select().where(users.c.id == user_id))
                    user_email = None
                    if updated_user:
                        try:
                            user_email = updated_user["email"]
                        except Exception:
                            user_email = None
                    if isinstance(user_email, str) and user_email.strip():
                        normalized_email = user_email.strip().lower()
                        invalidate_user_cache(normalized_email)
                        await invalidate_user_cache_redis(normalized_email)
                except Exception as exc:
                    app_logger.warning(
                        "Failed to invalidate auth cache after plan upgrade",
                        extra={"user_id": user_id, "error": str(exc)},
                    )
                
                app_logger.info(f"Upgraded user {user_id} to {plan_tier} ({billing_cycle}) via order {notification.order_id}, expires {subscription_expires_at}")
                
                if audit:
                    await audit.log(
                        AuditAction.PAYMENT_SUCCESS,
                        user_id=user_id,
                        details={
                            "order_id": notification.order_id,
                            "plan_tier": plan_tier,
                            "billing_cycle": billing_cycle,
                            "subscription_expires_at": subscription_expires_at.isoformat(),
                            "gross_amount": notification.gross_amount
                        },
                        severity="info"
                    )

                if should_notify_success:
                    from backend.discord_notifier import notify_payment_success
                    background_tasks.add_task(
                        notify_payment_success,
                        provider="midtrans",
                        status=notification.transaction_status,
                        order_id=notification.order_id,
                        amount=notification.gross_amount,
                        currency=notification.currency,
                        user_id=user_id,
                        plan_tier=plan_tier,
                        billing_cycle=billing_cycle,
                        extra={
                            "payment_type": notification.payment_type,
                            "transaction_id": notification.transaction_id,
                        },
                    )
        elif new_status in ("failed", "expired", "cancelled", "challenge", "refunded", "chargeback"):
            if audit:
                trans_query = transactions.select().where(transactions.c.order_id == notification.order_id)
                transaction = await database.fetch_one(trans_query)
                await audit.log(
                    AuditAction.PAYMENT_FAILED,
                    user_id=transaction["user_id"] if transaction else None,
                    details={
                        "order_id": notification.order_id,
                        "status": new_status,
                        "transaction_status": notification.transaction_status
                    },
                    severity="warning"
                )
            if (
                new_status in {"refunded", "chargeback"}
                and existing_transaction is not None
                and previous_status != new_status
            ):
                await _reconcile_user_plan_after_reversal(
                    user_id=int(existing_transaction["user_id"]),
                    reversed_order_id=notification.order_id,
                    reason=f"midtrans_{new_status}",
                    invalidate_user_cache=invalidate_user_cache,
                    invalidate_user_cache_redis=invalidate_user_cache_redis,
                    app_logger=app_logger,
                )
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Error processing payment notification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    return {"status": "ok"}


@router.post("/api/payment/dodo/webhook")
@router.post("/payment/dodo/webhook", include_in_schema=False)
async def handle_dodo_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Dodo Payments webhook events."""
    from backend.dodo_payments import DodoPaymentsUnavailable, get_dodo_client

    app_logger = _get_logger()
    invalidate_user_cache, invalidate_user_cache_redis = _get_cache_helpers()

    from backend.audit_logger import get_audit_logger, AuditAction

    audit = get_audit_logger()
    raw_body = await request.body()
    try:
        raw_payload = raw_body.decode("utf-8")
    except UnicodeDecodeError:
        raw_payload = raw_body.decode("utf-8", errors="replace")
    headers = {
        "webhook-id": request.headers.get("webhook-id", ""),
        "webhook-signature": request.headers.get("webhook-signature", ""),
        "webhook-timestamp": request.headers.get("webhook-timestamp", ""),
    }

    if not os.getenv("DODO_PAYMENTS_WEBHOOK_KEY"):
        app_logger.error("Dodo webhook key missing")
        raise HTTPException(status_code=503, detail="Dodo webhook verification is not configured")

    try:
        client = get_dodo_client()
    except DodoPaymentsUnavailable as exc:
        app_logger.error("Dodo payments unavailable", extra={"error": str(exc)})
        raise HTTPException(status_code=503, detail="Dodo payments are not configured")

    try:
        payload = client.webhooks.unwrap(raw_payload, headers=headers)
    except Exception as exc:
        app_logger.warning("Invalid Dodo webhook signature", extra={"error": str(exc)})
        raise HTTPException(status_code=401, detail="Invalid signature")

    if not isinstance(payload, dict):
        if hasattr(payload, "to_dict"):
            payload = payload.to_dict()
        elif hasattr(payload, "model_dump"):
            payload = payload.model_dump(by_alias=True)
        elif hasattr(payload, "dict"):
            payload = payload.dict()

    event_type = _event_value(payload, "type") or _event_value(payload, "event_type")
    data = _event_value(payload, "data") or {}
    if not isinstance(data, dict):
        if hasattr(data, "to_dict"):
            data = data.to_dict()
        elif hasattr(data, "model_dump"):
            data = data.model_dump(by_alias=True)
        elif hasattr(data, "dict"):
            data = data.dict()

    metadata = _extract_metadata(data)
    order_id = (
        metadata.get("order_id")
        or (data.get("order_id") if isinstance(data, dict) else None)
        or (data.get("reference_id") if isinstance(data, dict) else None)
        or (data.get("referenceId") if isinstance(data, dict) else None)
    )
    event_type_normalized = str(event_type or "").strip().lower()
    dodo_event_key = _dodo_event_key(
        headers=headers,
        payload=payload,
        event_type=event_type,
        order_id=order_id,
    )
    event_reserved = await _reserve_payment_webhook_event(
        provider="dodo",
        event_key=dodo_event_key,
        order_id=order_id,
        event_type=event_type_normalized or None,
    )
    if not event_reserved:
        app_logger.info(
            "Ignoring duplicate Dodo webhook event",
            extra={"order_id": order_id, "event_key": dodo_event_key, "event_type": event_type},
        )
        return {"status": "ignored"}

    user_id = metadata.get("user_id") or metadata.get("userId")
    plan_tier_raw = metadata.get("plan_tier") or metadata.get("planTier")
    plan_tier = (
        plan_tier_raw.strip().lower()
        if isinstance(plan_tier_raw, str)
        else plan_tier_raw
    )
    billing_cycle = _normalize_billing_cycle_value(
        metadata.get("billing_cycle") or metadata.get("billingCycle")
    )

    if not plan_tier and isinstance(data, dict):
        plan_from_product, cycle_from_product = _resolve_plan_from_product_id(data.get("product_id"))
        plan_tier = plan_from_product
        if cycle_from_product:
            billing_cycle = _normalize_billing_cycle_value(cycle_from_product)

    customer_email = None
    if isinstance(data, dict):
        customer = data.get("customer") or data.get("customer_details")
        if isinstance(customer, dict):
            customer_email = customer.get("email")

    if user_id is None and customer_email:
        try:
            user_record = await database.fetch_one(users.select().where(users.c.email == customer_email))
            if user_record:
                user_id = user_record["id"]
        except Exception as exc:
            app_logger.warning(
                "Failed to resolve user from Dodo webhook email",
                extra={"error": str(exc), "email": customer_email},
            )

    try:
        user_id_int = int(user_id) if user_id is not None else None
    except (TypeError, ValueError):
        user_id_int = None

    existing_transaction = None
    if order_id:
        existing_transaction = await database.fetch_one(
            transactions.select().where(transactions.c.order_id == order_id)
        )
        if existing_transaction:
            txn_user_id = int(existing_transaction["user_id"])
            if user_id_int is None:
                user_id_int = txn_user_id
            elif user_id_int != txn_user_id:
                app_logger.error(
                    "Dodo webhook user_id mismatch with local transaction",
                    extra={"order_id": order_id, "metadata_user_id": user_id_int, "transaction_user_id": txn_user_id},
                )
                raise HTTPException(status_code=409, detail="User mismatch")
            plan_tier = str(existing_transaction["plan_tier"]).strip().lower()
            txn_billing_cycle = existing_transaction["billing_cycle"]
            if txn_billing_cycle:
                billing_cycle = _normalize_billing_cycle_value(txn_billing_cycle)

    subscription_status = None
    if event_type in ("subscription.updated", "subscription.created") and isinstance(data, dict):
        subscription_status = (data.get("status") or "").strip().lower() or None

    subscription_success_states = {"paid", "succeeded", "success"}
    subscription_failure_states = {"failed", "canceled", "cancelled"}

    is_subscription_success = (
        event_type in ("subscription.updated", "subscription.created")
        and subscription_status in subscription_success_states
    )
    is_subscription_failure = (
        event_type in ("subscription.updated", "subscription.created")
        and subscription_status in subscription_failure_states
    )

    is_payment_success = event_type in ("payment.succeeded", "payment.success")
    is_payment_reversal = event_type_normalized in {
        "payment.refunded",
        "payment.partial_refunded",
        "payment.chargeback",
        "payment.dispute",
        "payment.disputed",
        "payment.reversed",
    } or ("refund" in event_type_normalized) or ("chargeback" in event_type_normalized)
    if is_payment_success or is_subscription_success:
        if not order_id or not existing_transaction:
            app_logger.error(
                "Dodo success webhook has no matching local transaction",
                extra={"event_type": event_type, "order_id": order_id},
            )
            raise HTTPException(status_code=409, detail="Unknown order_id")
        if user_id_int is None or not plan_tier:
            app_logger.error(
                "Dodo success webhook missing user or plan metadata",
                extra={"event_type": event_type, "order_id": order_id, "user_id": user_id_int, "plan_tier": plan_tier},
            )
            raise HTTPException(status_code=409, detail="Missing user or plan metadata")
        if str(plan_tier).strip().lower() not in _PLAN_PRICING_IDR:
            app_logger.error(
                "Dodo success webhook has invalid plan_tier",
                extra={"event_type": event_type, "order_id": order_id, "plan_tier": plan_tier},
            )
            raise HTTPException(status_code=409, detail="Invalid plan_tier")

        amount_field_name = "amount"
        raw_amount_value = None
        if isinstance(data, dict):
            for candidate_field in ("amount", "total_amount", "gross_amount"):
                candidate_value = data.get(candidate_field)
                if candidate_value is None:
                    continue
                if isinstance(candidate_value, str) and not candidate_value.strip():
                    continue
                raw_amount_value = candidate_value
                amount_field_name = candidate_field
                break
        amount_value = _parse_amount_for_success_validation(
            raw_amount_value,
            provider="dodo",
            order_id=order_id,
            field_name=amount_field_name,
            app_logger=app_logger,
        )
        stored_amount = existing_transaction["amount"]
        received_currency = _normalize_currency_code(
            data.get("currency") if isinstance(data, dict) else None
        )
        stored_currency = _normalize_currency_code(existing_transaction["currency"])
        adaptive_currency_checkout = (
            _is_adaptive_currency_value(stored_currency)
            or str(metadata.get("currency") or "").strip().lower() == "adaptive"
        )
        expected_amount = stored_amount
        expected_currency = stored_currency or received_currency or "USD"

        if adaptive_currency_checkout:
            if not received_currency:
                app_logger.error(
                    "Dodo adaptive currency webhook missing currency",
                    extra={"order_id": order_id, "event_type": event_type},
                )
                raise HTTPException(status_code=409, detail="Missing currency")
            try:
                adaptive_expected_amount, adaptive_expected_currency, _ = _get_plan_amount(
                    str(plan_tier),
                    billing_cycle,
                    received_currency,
                )
            except HTTPException:
                app_logger.error(
                    "Dodo adaptive currency webhook has unsupported currency",
                    extra={
                        "order_id": order_id,
                        "received_currency": received_currency,
                        "plan_tier": plan_tier,
                        "billing_cycle": billing_cycle,
                    },
                )
                raise HTTPException(status_code=409, detail="Unsupported currency")
            expected_amount = adaptive_expected_amount
            expected_currency = adaptive_expected_currency

        if expected_amount is not None and amount_value is not None and int(expected_amount) != int(amount_value):
            app_logger.error(
                "Dodo amount mismatch",
                extra={"order_id": order_id, "expected_amount": expected_amount, "received_amount": amount_value},
            )
            raise HTTPException(status_code=409, detail="Amount mismatch")

        if (
            expected_currency
            and received_currency
            and not adaptive_currency_checkout
            and expected_currency != received_currency
        ):
            app_logger.error(
                "Dodo currency mismatch",
                extra={
                    "order_id": order_id,
                    "expected_currency": expected_currency,
                    "received_currency": received_currency,
                },
            )
            raise HTTPException(status_code=409, detail="Currency mismatch")
        currency_for_storage = received_currency or expected_currency

        provider_paid_at = _parse_provider_timestamp(
            data.get("paid_at") if isinstance(data, dict) else None
        ) or _parse_provider_timestamp(
            data.get("updated_at") if isinstance(data, dict) else None
        ) or _parse_provider_timestamp(
            data.get("created_at") if isinstance(data, dict) else None
        )
        paid_at = provider_paid_at or existing_transaction["paid_at"] or utcnow()
        updated_amount = amount_value if amount_value is not None else stored_amount

        transition_claim = await database.fetch_one(
            transactions.update()
            .where(transactions.c.order_id == order_id)
            .where(transactions.c.status != "success")
            .values(
                status="success",
                amount=updated_amount,
                currency=currency_for_storage,
                paid_at=paid_at,
                updated_at=utcnow(),
            )
            .returning(transactions.c.id)
        )
        transitioned_to_success = transition_claim is not None
        should_provision_success = bool(transitioned_to_success and user_id_int is not None and plan_tier)
        # Only notify on payment success events to avoid duplicate Discord messages.
        should_notify_success = is_payment_success and should_provision_success

        if should_provision_success:
            subscription_starts_at, subscription_expires_at = await _extend_user_subscription_atomic(
                user_id=int(user_id_int),
                plan_tier=str(plan_tier or "").strip().lower(),
                billing_cycle=billing_cycle,
                now=utcnow(),
            )
            if order_id:
                await database.execute(
                    transactions.update()
                    .where(transactions.c.order_id == order_id)
                    .values(
                        subscription_starts_at=subscription_starts_at,
                        subscription_ends_at=subscription_expires_at,
                        updated_at=utcnow(),
                    )
                )

            try:
                updated_user = await database.fetch_one(users.select().where(users.c.id == user_id_int))
                user_email = updated_user["email"] if updated_user else None
                if isinstance(user_email, str) and user_email.strip():
                    normalized_email = user_email.strip().lower()
                    invalidate_user_cache(normalized_email)
                    await invalidate_user_cache_redis(normalized_email)
            except Exception as exc:
                app_logger.warning(
                    "Failed to invalidate auth cache after Dodo plan upgrade",
                    extra={"user_id": user_id_int, "error": str(exc)},
                )

            if audit:
                await audit.log(
                    AuditAction.PAYMENT_SUCCESS,
                    user_id=user_id_int,
                    details={
                        "order_id": order_id,
                        "plan_tier": plan_tier,
                        "billing_cycle": billing_cycle,
                        "subscription_expires_at": subscription_expires_at.isoformat(),
                    },
                    severity="info",
                )

        if should_notify_success:
            from backend.discord_notifier import notify_payment_success

            amount = data.get("amount") if isinstance(data, dict) else None
            currency = data.get("currency") if isinstance(data, dict) else None
            background_tasks.add_task(
                notify_payment_success,
                provider="dodo",
                status=event_type,
                order_id=order_id or "unknown",
                amount=str(amount) if amount is not None else None,
                currency=currency,
                user_id=user_id_int,
                plan_tier=plan_tier,
                billing_cycle=billing_cycle,
            )

    elif event_type in (
        "payment.failed",
        "payment.cancelled",
        "payment.canceled",
        "subscription.canceled",
        "subscription.cancelled",
    ) or is_subscription_failure or is_payment_reversal:
        if (
            existing_transaction is not None
            and str(existing_transaction["status"] or "").strip().lower() == "success"
            and not is_payment_reversal
        ):
            app_logger.warning(
                "Ignoring stale Dodo failure/cancel webhook for successful transaction",
                extra={
                    "order_id": order_id,
                    "event_type": event_type,
                    "subscription_status": subscription_status,
                },
            )
            return {"status": "ignored"}

        status_value = "failed" if event_type == "payment.failed" else "cancelled"
        if is_subscription_failure and subscription_status == "failed":
            status_value = "failed"
        if is_payment_reversal:
            status_value = "chargeback" if "chargeback" in event_type_normalized else "refunded"
        if order_id:
            transitioned_to_reversal = False
            if is_payment_reversal:
                reversal_claim = await database.fetch_one(
                    transactions.update()
                    .where(transactions.c.order_id == order_id)
                    .where(transactions.c.status != status_value)
                    .values(status=status_value, updated_at=utcnow())
                    .returning(transactions.c.id)
                )
                transitioned_to_reversal = reversal_claim is not None
            else:
                await database.execute(
                    transactions.update()
                    .where(transactions.c.order_id == order_id)
                    .values(status=status_value, updated_at=utcnow())
                )
            if is_payment_reversal and transitioned_to_reversal and existing_transaction:
                await _reconcile_user_plan_after_reversal(
                    user_id=int(existing_transaction["user_id"]),
                    reversed_order_id=order_id,
                    reason=f"dodo_{status_value}",
                    invalidate_user_cache=invalidate_user_cache,
                    invalidate_user_cache_redis=invalidate_user_cache_redis,
                    app_logger=app_logger,
                )

        if audit:
            await audit.log(
                AuditAction.PAYMENT_FAILED,
                user_id=user_id_int,
                details={
                    "order_id": order_id,
                    "status": status_value,
                    "event_type": event_type,
                    "subscription_id": data.get("subscription_id") if isinstance(data, dict) else None,
                },
                severity="warning",
            )
    elif event_type in ("subscription.updated", "subscription.created"):
        return {"status": "ignored"}

    return {"status": "ok"}
