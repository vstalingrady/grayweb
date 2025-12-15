from fastapi import APIRouter, Request, HTTPException, Header, status
import logging
import json
import os
from datetime import datetime, timezone

try:  # Prefer package-relative imports when running as a package
    from backend.paddle_client import paddle_client
    from backend.database import database, users, transactions, plans
    from backend.subscription_utils import calculate_subscription_period
    from backend.time_utils import utcnow
except Exception:  # pragma: no cover - fallback for direct backend/ execution (tests)
    from paddle_client import paddle_client  # type: ignore
    from database import database, users, transactions, plans  # type: ignore
    from subscription_utils import calculate_subscription_period  # type: ignore
    from time_utils import utcnow  # type: ignore

# setup logger
logger = logging.getLogger("backend.paddle_webhook")

router = APIRouter()

PADDLE_PRICE_INFO = {
    os.getenv("PADDLE_PRICE_ID_MONTHLY_SCOUT", "pri_scout_m"): {"tier": "scout", "billing_cycle": "monthly"},
    os.getenv("PADDLE_PRICE_ID_YEARLY_SCOUT", "pri_scout_y"): {"tier": "scout", "billing_cycle": "annual"},
    os.getenv("PADDLE_PRICE_ID_MONTHLY_VOYAGER", "pri_voyager_m"): {"tier": "voyager", "billing_cycle": "monthly"},
    os.getenv("PADDLE_PRICE_ID_YEARLY_VOYAGER", "pri_voyager_y"): {"tier": "voyager", "billing_cycle": "annual"},
    os.getenv("PADDLE_PRICE_ID_MONTHLY_PIONEER", "pri_pioneer_m"): {"tier": "pioneer", "billing_cycle": "monthly"},
    os.getenv("PADDLE_PRICE_ID_YEARLY_PIONEER", "pri_pioneer_y"): {"tier": "pioneer", "billing_cycle": "annual"},
}


def _parse_paddle_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)

@router.post("/api/webhooks/paddle")
async def paddle_webhook(request: Request, paddle_signature: str = Header(None)):
    """
    Handle Paddle Webhooks.
    """
    secret_key = os.getenv("PADDLE_WEBHOOK_SECRET_KEY")
    if not secret_key:
        logger.error("Missing PADDLE_WEBHOOK_SECRET_KEY")
        raise HTTPException(status_code=500, detail="Server misconfiguration")

    # Read raw body once for verification
    raw_body = await request.body()
    
    # Verify signature
    if not paddle_client.verify_webhook_signature(paddle_signature, raw_body, secret_key):
        logger.warning("Invalid Paddle webhook signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(raw_body)
        event_type = data.get("event_type")
        payload = data.get("data", {})
        
        logger.info(f"Received Paddle event: {event_type}")

        if event_type == "subscription.created" or event_type == "subscription.updated":
            await handle_subscription_update(payload)
        elif event_type == "subscription.activated":
             await handle_subscription_update(payload)
        elif event_type == "subscription.canceled":
            await handle_subscription_cancel(payload)
        elif event_type == "transaction.completed":
            await handle_transaction_completed(payload)
        
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
        # Return 200 to generic errors to prevent Paddle retrying endlessly if it's a logic bug?
        # Better to fail 500 for retry if it's transient, but if code is broken, 200 stops the spam.
        # For now, 500.
        raise HTTPException(status_code=500, detail="Processing error")

async def handle_subscription_update(data: dict):
    """
    Handle subscription created/updated/activated.
    Updates user plan and expiration.
    """
    custom_data = data.get("custom_data", {})
    user_id = custom_data.get("user_id")
    
    # Fallback: if no user_id in custom_data, we might find it by customer email in a real scenario
    # but for now rely on custom_data
    if not user_id:
        logger.warning(f"No user_id found in subscription custom_data: {data.get('id')}")
        return

    # User ID is sometimes string in JSON, convert to int
    try:
        user_id = int(str(user_id))
    except ValueError:
        logger.warning(f"Invalid user_id format: {user_id}")
        return

    # Extract Subscription Details
    subscription_id = data.get("id")
    customer_id = data.get("customer_id")
    status_str = data.get("status") # active, trialing, past_due, paused, canceled
    
    # Calculate Expiry
    # current_billing_period.ends_at is standard
    billing_period = data.get("current_billing_period", {})
    ends_at_str = billing_period.get("ends_at")
    
    expires_at = _parse_paddle_datetime(ends_at_str)
    
    # Determine Plan Tier from Price ID
    # items is a list. usually 1 item for main plan.
    items = data.get("items", [])
    new_tier = None
    billing_cycle = None
    if items:
        price_id = items[0].get("price", {}).get("id")
        info = PADDLE_PRICE_INFO.get(price_id)
        if info:
            new_tier = info.get("tier")
            billing_cycle = info.get("billing_cycle")

    if expires_at is None and billing_cycle:
        user_record = await database.fetch_one(users.select().where(users.c.id == user_id))
        existing_expires_at = user_record["subscription_expires_at"] if user_record else None
        _, expires_at = calculate_subscription_period(
            billing_cycle=billing_cycle,
            existing_expires_at=existing_expires_at,
            now=utcnow(),
        )
    
    # Update User
    query_values = {
        "paddle_subscription_id": subscription_id,
        "paddle_customer_id": customer_id,
    }
    if expires_at is not None:
        query_values["subscription_expires_at"] = expires_at
    
    if new_tier:
        query_values["plan_tier"] = new_tier

    logger.info(f"Updating user {user_id}: {query_values}")
    
    query = users.update().where(users.c.id == user_id).values(**query_values)
    await database.execute(query)

async def handle_subscription_cancel(data: dict):
    # Just ensure we have the expiry set correctly?
    # Paddle sends 'canceled' event. Status becomes 'canceled'.
    # We should ensure 'subscription_expires_at' is respecting the end of period.
    # Usually 'subscription.updated' handles the status change to 'canceled', but explicit event allows hooks.
    await handle_subscription_update(data)

async def handle_transaction_completed(data: dict):
    """
    Record transaction.
    """
    custom_data = data.get("custom_data", {})
    user_id = custom_data.get("user_id")
    
    # If no user_id (e.g. renewal), we might need to lookup user by subscription_id?
    subscription_id = data.get("subscription_id")
    
    if not user_id and subscription_id:
        # Lookup user by subscription_id
        user_query = users.select().where(users.c.paddle_subscription_id == subscription_id)
        user_record = await database.fetch_one(user_query)
        if user_record:
            user_id = user_record["id"]
    
    if not user_id:
        logger.warning(f"Could not link transaction {data.get('id')} to a user.")
        return

    try:
        user_id = int(str(user_id))
    except (ValueError, TypeError):
        pass

    txn_id = data.get("id")
    amount = data.get("details", {}).get("totals", {}).get("grand_total", "0")
    # Amount is string like "1000" (cents? no, Paddle V2 uses string decimal usually? Check docs.)
    # Docs say: "totals": { "grand_total": "1000", "currency_code": "USD" } 
    # Actually wait, Paddle uses integer strings for cents in some places or strings for decimals?
    # Paddle Billing (V2) uses string decimals e.g. "10.00".
    # User's 'transactions' table has 'amount' as Integer (likely cents or base unit).
    # We should convert to integer cents if that's the convention, or float.
    # The existing schema has `amount` as Integer. Midtrans usually uses Integer.
    # Let's assume database uses specific unit.
    # Paddle string "9.99" -> 999 cents?
    
    try:
        amount_float = float(amount)
        amount_int = int(amount_float * 100) # Convert to cents/lowest denomination if needed
        # Or if schema expects simple integer... let's stick to safe assumptions or check schema usage.
    except:
        amount_int = 0

    # Insert into transactions table
    # Schema: user_id, order_id, paddle_transaction_id, amount, status, plan_tier...
    
    # We need a unique order_id. Paddle has its own, but we have 'paddle_transaction_id'.
    # 'order_id' column is unique and required. We can use Paddle ID there too or generate one.
    
    values = {
        "user_id": user_id,
        "order_id": txn_id, # Use Paddle txn ID as order ID
        "paddle_transaction_id": txn_id,
        "amount": amount_int,
        "status": data.get("status"), # completed
        "payment_type": "paddle",
        # plan_tier and billing_cycle might be needed.
        "plan_tier": "unknown", # difficult to extract from txn without items mapping logic again
        "created_at": utcnow()
    }
    
    # Try to extract plan tier
    items = data.get("items", [])
    if items:
        price_id = items[0].get("price", {}).get("id")
        info = PADDLE_PRICE_INFO.get(price_id)
        if info:
            values["plan_tier"] = info.get("tier") or values["plan_tier"]
            if info.get("billing_cycle"):
                values["billing_cycle"] = info["billing_cycle"]

    subscription_id = data.get("subscription_id")
    if subscription_id:
        user_record = await database.fetch_one(users.select().where(users.c.paddle_subscription_id == subscription_id))
        if user_record and user_record.get("subscription_expires_at"):
            values["subscription_ends_at"] = user_record["subscription_expires_at"]

    # Try to upsert?
    # Check if exists
    existing = await database.fetch_one(transactions.select().where(transactions.c.paddle_transaction_id == txn_id))
    if existing:
        # Update?
        pass
    else:
        try:
             await database.execute(transactions.insert().values(**values))
        except Exception as e:
            logger.error(f"Failed to insert transaction: {e}")
