"""
Payment API routes for Midtrans and Dodo Payments.

This router handles payment charge creation and webhook notifications.
"""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

# Import models
from backend.models import PaymentRequest, PaymentChargeResponse, MidtransNotification

# Import dependencies
from backend.database import database, transactions, users, get_database
from backend.auth import get_current_user
from backend.time_utils import utcnow

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


def _normalize_provider(provider: Optional[str]) -> str:
    if not provider:
        return "midtrans"
    return provider.strip().lower()


def _get_plan_amount(
    plan_tier: str,
    billing_cycle: Optional[str],
    billing_currency: Optional[str] = None,
) -> Tuple[int, str, str]:
    tier = (plan_tier or "").strip().lower()
    cycle = "annual" if billing_cycle == "annual" else "monthly"
    currency = (billing_currency or "").strip().upper()

    if tier not in _PLAN_PRICING_IDR:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

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
    cycle = "ANNUAL" if billing_cycle == "annual" else "MONTHLY"
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
        return parts[2].lower(), parts[3].lower()
    return None, None


def _get_dodo_return_url(request: PaymentRequest) -> Optional[str]:
    if request.return_url:
        return request.return_url
    env_return = os.getenv("DODO_PAYMENTS_RETURN_URL")
    if env_return:
        return env_return
    site_url = os.getenv("NEXT_PUBLIC_SITE_URL") or os.getenv("SITE_URL")
    if site_url:
        return f"{site_url.rstrip('/')}/payment/finish"
    return None


def _get_dodo_allowed_payment_methods() -> List[str]:
    raw = os.getenv("DODO_ALLOWED_PAYMENT_METHOD_TYPES")
    if raw:
        return [item.strip() for item in raw.split(",") if item.strip()]
    return ["credit", "debit"]


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


async def _create_midtrans_charge(request: PaymentRequest, user: Dict[str, Any]) -> PaymentChargeResponse:
    from backend.payment_utils import create_core_api_transaction

    app_logger = _get_logger()
    amount, item_name, _ = _get_plan_amount(request.plan_tier, request.billing_cycle)
    item_details = [
        {
            "id": f"{request.plan_tier}_{request.billing_cycle}",
            "price": amount,
            "quantity": 1,
            "name": item_name,
        }
    ]

    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found")

    full_name = (user.get("full_name") or "").strip()
    first_name = full_name.split(" ")[0] if full_name else "User"
    last_name = " ".join(full_name.split(" ")[1:]) if " " in full_name else ""
    email = (user.get("email") or "").strip()
    customer_details = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
    }

    order_id = f"ORDER-{user_id}-{int(datetime.now().timestamp())}"

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
            status="pending",
            payment_type=payment_type,
            plan_tier=request.plan_tier,
            billing_cycle=request.billing_cycle,
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
    from backend.dodo_payments import get_dodo_client

    app_logger = _get_logger()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found")

    billing_currency = request.billing_currency.strip().upper() if request.billing_currency else None
    normalized_plan = (request.plan_tier or "").strip().lower()
    amount, _, currency = _get_plan_amount(normalized_plan, request.billing_cycle, billing_currency)
    product_id = _get_dodo_product_id(normalized_plan, request.billing_cycle, billing_currency)
    metadata_currency = billing_currency or "adaptive"

    order_id = f"DODO-{user_id}-{int(datetime.now().timestamp())}"

    full_name = (user.get("full_name") or "").strip()
    email = (user.get("email") or "").strip()
    metadata = {
        "order_id": order_id,
        "user_id": str(user_id),
        "plan_tier": normalized_plan,
        "billing_cycle": request.billing_cycle or "monthly",
        "currency": metadata_currency,
    }

    try:
        query = transactions.insert().values(
            user_id=user_id,
            order_id=order_id,
            amount=amount,
            status="pending",
            payment_type="dodo_checkout",
            plan_tier=normalized_plan,
            billing_cycle=request.billing_cycle,
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
    }
    if email:
        checkout_args["customer"] = {"email": email, "name": full_name or "User"}
    return_url = _get_dodo_return_url(request)
    if return_url:
        checkout_args["return_url"] = return_url
    if billing_currency:
        checkout_args["billing_currency"] = billing_currency

    try:
        client = get_dodo_client()
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
        "expire": "expired",
        "cancel": "cancelled"
    }
    
    new_status = status_mapping.get(notification.transaction_status, "pending")
    
    if notification.transaction_status == "capture" and notification.fraud_status == "challenge":
        new_status = "challenge"

    should_notify_success = new_status == "success" and previous_status != "success"

    try:
        query = transactions.update().where(
            transactions.c.order_id == notification.order_id
        ).values(
            status=new_status,
            updated_at=utcnow()
        )
        await database.execute(query)
        
        # 3. Provision Plan if Success
        if new_status == "success":
            trans_query = transactions.select().where(transactions.c.order_id == notification.order_id)
            transaction = await database.fetch_one(trans_query)
            
            if transaction:
                user_id = transaction["user_id"]
                plan_tier = transaction["plan_tier"]
                
                from backend.subscription_utils import calculate_subscription_period

                now = utcnow()
                user_record = await database.fetch_one(users.select().where(users.c.id == user_id))
                existing_expires_at = user_record["subscription_expires_at"] if user_record else None
                
                billing_val = transaction["billing_cycle"] if "billing_cycle" in transaction else None
                billing_cycle = billing_val or "monthly"
                
                subscription_starts_at, subscription_expires_at = calculate_subscription_period(
                    billing_cycle=billing_cycle,
                    existing_expires_at=existing_expires_at,
                    now=now,
                )
                
                user_update = users.update().where(users.c.id == user_id).values(
                    plan_tier=plan_tier,
                    subscription_expires_at=subscription_expires_at,
                    updated_at=utcnow()
                )
                await database.execute(user_update)

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
            elif should_notify_success:
                from backend.discord_notifier import notify_payment_success
                background_tasks.add_task(
                    notify_payment_success,
                    provider="midtrans",
                    status=notification.transaction_status,
                    order_id=notification.order_id,
                    amount=notification.gross_amount,
                    currency=notification.currency,
                    extra={
                        "payment_type": notification.payment_type,
                        "transaction_id": notification.transaction_id,
                        "note": "No matching local transaction row",
                    },
                )
        elif new_status in ("failed", "deny", "expired", "cancelled"):
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
        
    except Exception as e:
        app_logger.error(f"Error processing payment notification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    return {"status": "ok"}


@router.post("/api/payment/dodo/webhook")
@router.post("/payment/dodo/webhook", include_in_schema=False)
async def handle_dodo_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Dodo Payments webhook events."""
    from backend.dodo_payments import get_dodo_client

    app_logger = _get_logger()
    invalidate_user_cache, invalidate_user_cache_redis = _get_cache_helpers()

    from backend.audit_logger import get_audit_logger, AuditAction

    audit = get_audit_logger()
    raw_body = await request.body()
    headers = {
        "webhook-id": request.headers.get("webhook-id", ""),
        "webhook-signature": request.headers.get("webhook-signature", ""),
        "webhook-timestamp": request.headers.get("webhook-timestamp", ""),
    }

    try:
        client = get_dodo_client()
        payload = client.webhooks.unwrap(raw_body, headers=headers)
    except Exception as exc:
        app_logger.warning("Invalid Dodo webhook signature", extra={"error": str(exc)})
        raise HTTPException(status_code=401, detail="Invalid signature")

    event_type = _event_value(payload, "type") or _event_value(payload, "event_type")
    data = _event_value(payload, "data") or {}

    metadata = _extract_metadata(data)
    order_id = (
        metadata.get("order_id")
        or (data.get("order_id") if isinstance(data, dict) else None)
        or (data.get("reference_id") if isinstance(data, dict) else None)
        or (data.get("referenceId") if isinstance(data, dict) else None)
    )

    user_id = metadata.get("user_id") or metadata.get("userId")
    plan_tier = metadata.get("plan_tier") or metadata.get("planTier")
    billing_cycle = metadata.get("billing_cycle") or metadata.get("billingCycle")

    if not plan_tier and isinstance(data, dict):
        plan_from_product, cycle_from_product = _resolve_plan_from_product_id(data.get("product_id"))
        plan_tier = plan_from_product
        billing_cycle = billing_cycle or cycle_from_product

    if not billing_cycle:
        billing_cycle = "monthly"

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
    previous_status = None
    if order_id:
        existing_transaction = await database.fetch_one(
            transactions.select().where(transactions.c.order_id == order_id)
        )
        previous_status = existing_transaction["status"] if existing_transaction else None

    if event_type in ("payment.succeeded", "payment.success"):
        new_status = "success"
        should_notify_success = previous_status != "success"

        if order_id:
            await database.execute(
                transactions.update()
                .where(transactions.c.order_id == order_id)
                .values(status=new_status, updated_at=utcnow())
            )

        if user_id_int and plan_tier and previous_status != "success":
            from backend.subscription_utils import calculate_subscription_period

            user_record = await database.fetch_one(users.select().where(users.c.id == user_id_int))
            existing_expires_at = user_record["subscription_expires_at"] if user_record else None

            subscription_starts_at, subscription_expires_at = calculate_subscription_period(
                billing_cycle=billing_cycle,
                existing_expires_at=existing_expires_at,
                now=utcnow(),
            )

            await database.execute(
                users.update()
                .where(users.c.id == user_id_int)
                .values(
                    plan_tier=plan_tier,
                    subscription_expires_at=subscription_expires_at,
                    updated_at=utcnow(),
                )
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

    elif event_type in ("payment.failed", "payment.cancelled", "payment.canceled"):
        status_value = "failed" if event_type == "payment.failed" else "cancelled"
        if order_id:
            await database.execute(
                transactions.update()
                .where(transactions.c.order_id == order_id)
                .values(status=status_value, updated_at=utcnow())
            )

        if audit:
            await audit.log(
                AuditAction.PAYMENT_FAILED,
                user_id=user_id_int,
                details={"order_id": order_id, "status": status_value, "event_type": event_type},
                severity="warning",
            )

    return {"status": "ok"}
