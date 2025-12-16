"""
Payment API routes for Midtrans.

This router handles payment charge creation and Midtrans webhook notifications.
"""

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

# Import models
from backend.models import PaymentRequest, PaymentChargeResponse, MidtransNotification

# Import dependencies
from backend.database import database, transactions, users, get_database
from backend.auth import get_current_user
from backend.time_utils import utcnow

router = APIRouter(tags=["payments"])


def _get_midtrans_helpers():
    """Lazy import Midtrans helpers."""
    try:
        from backend.midtrans import create_core_api_transaction, verify_notification_signature
    except ImportError:
        from midtrans import create_core_api_transaction, verify_notification_signature  # type: ignore
    return create_core_api_transaction, verify_notification_signature


def _get_logger():
    """Get app logger."""
    try:
        from backend.main import app_logger
    except ImportError:
        import logging
        app_logger = logging.getLogger(__name__)
    return app_logger


def _get_cache_helpers():
    """Get cache invalidation helpers."""
    try:
        from backend.main import invalidate_user_cache, invalidate_user_cache_redis
    except ImportError:
        async def invalidate_user_cache_redis(auth_id: str) -> None:
            pass
        def invalidate_user_cache(auth_id: str) -> None:
            pass
    return invalidate_user_cache, invalidate_user_cache_redis


@router.post("/api/payment/charge", response_model=PaymentChargeResponse)
@router.post("/payment/charge", response_model=PaymentChargeResponse, include_in_schema=False)
async def create_payment_charge(
    request: PaymentRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a transaction with Midtrans Core API."""
    create_core_api_transaction, _ = _get_midtrans_helpers()
    app_logger = _get_logger()
    
    # 1. Determine Amount & Item Details
    is_annual = request.billing_cycle == "annual"
    if request.plan_tier == "voyager":
        amount = 1000  # TESTING: Original: 1777000 if is_annual else 177000
        item_name = f"Gray Voyager Plan ({'Annual' if is_annual else 'Monthly'})"
    elif request.plan_tier == "pioneer":
        amount = 1000  # TESTING: Original: 3777000 if is_annual else 377000
        item_name = f"Gray Pioneer Plan ({'Annual' if is_annual else 'Monthly'})"
    else:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    item_details = [{
        "id": f"{request.plan_tier}_{request.billing_cycle}",
        "price": amount,
        "quantity": 1,
        "name": item_name
    }]

    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found")

    # 2. Customer Details
    full_name = (user.get("full_name") or "").strip()
    first_name = full_name.split(" ")[0] if full_name else "User"
    last_name = " ".join(full_name.split(" ")[1:]) if " " in full_name else ""
    email = (user.get("email") or "").strip()
    customer_details = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
    }

    # 3. Generate Order ID
    order_id = f"ORDER-{user_id}-{int(datetime.now().timestamp())}"

    # 4. Payment Type Args
    bank_args = None
    token_id = None
    
    if request.payment_type == "bank_transfer":
        if not request.bank:
            raise HTTPException(status_code=400, detail="Bank is required for bank_transfer")
        bank_args = {"bank": request.bank}
    elif request.payment_type == "permata":
        bank_args = {"bank": "permata"}
        request.payment_type = "bank_transfer"
    elif request.payment_type == "credit_card":
        if not request.token_id:
            raise HTTPException(status_code=400, detail="Token ID is required for credit_card")
        token_id = request.token_id
    elif request.payment_type in ["echannel", "gopay"]:
        pass
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported payment type: {request.payment_type}")

    # 5. Create Transaction in Database
    try:
        query = transactions.insert().values(
            user_id=user_id,
            order_id=order_id,
            amount=amount,
            status="pending",
            payment_type=request.payment_type,
            plan_tier=request.plan_tier,
            billing_cycle=request.billing_cycle,
            created_at=utcnow(),
            updated_at=utcnow()
        )
        await database.execute(query)
    except Exception as e:
        app_logger.error(f"Database error creating transaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to create transaction record")

    # 6. Call Midtrans Core API
    try:
        response = create_core_api_transaction(
            order_id=order_id,
            amount=amount,
            item_details=item_details,
            customer_details=customer_details,
            payment_type=request.payment_type,
            bank_transfer_args=bank_args,
            token_id=token_id
        )
    except Exception as e:
        app_logger.error(f"Midtrans API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")

    # 7. Parse Response
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
        redirect_url=redirect_url
    )


@router.post("/api/payment/notification")
@router.post("/payment/notification", include_in_schema=False)
async def handle_payment_notification(notification: MidtransNotification, background_tasks: BackgroundTasks):
    """Handle Midtrans HTTP Notification (Webhook)."""
    _, verify_notification_signature = _get_midtrans_helpers()
    app_logger = _get_logger()
    invalidate_user_cache, invalidate_user_cache_redis = _get_cache_helpers()
    
    # Get audit logger
    try:
        from audit_logger import get_audit_logger, AuditAction
        audit = get_audit_logger()
    except ImportError:
        audit = None
    
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
                    auth_user_id_value = None
                    if updated_user:
                        try:
                            auth_user_id_value = updated_user["auth_user_id"]
                        except Exception:
                            auth_user_id_value = None
                    if auth_user_id_value:
                        auth_user_id = str(auth_user_id_value)
                        invalidate_user_cache(auth_user_id)
                        await invalidate_user_cache_redis(auth_user_id)
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
                    try:
                        from backend.discord_notifier import notify_payment_success
                    except Exception:
                        from discord_notifier import notify_payment_success  # type: ignore
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
                try:
                    from backend.discord_notifier import notify_payment_success
                except Exception:
                    from discord_notifier import notify_payment_success  # type: ignore
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
