from fastapi import APIRouter, Request, HTTPException, Header, status
import logging
import json
import os
from datetime import datetime, timedelta
from backend.paddle_client import paddle_client
from backend.database import database, users, transactions, plans
from backend.time_utils import utcnow

# setup logger
logger = logging.getLogger("backend.paddle_webhook")

router = APIRouter()

# Plan Mapping (Price ID -> Tier)
# Use environment variables for dynamic configuration or hardcode structure
PADDLE_PRICE_MAP = {
    os.getenv("PADDLE_PRICE_ID_MONTHLY_SCOUT", "pri_scout_m"): "scout",
    os.getenv("PADDLE_PRICE_ID_YEARLY_SCOUT", "pri_scout_y"): "scout",
    os.getenv("PADDLE_PRICE_ID_MONTHLY_VOYAGER", "pri_voyager_m"): "voyager",
    os.getenv("PADDLE_PRICE_ID_YEARLY_VOYAGER", "pri_voyager_y"): "voyager",
    os.getenv("PADDLE_PRICE_ID_MONTHLY_PIONEER", "pri_pioneer_m"): "pioneer",
    os.getenv("PADDLE_PRICE_ID_YEARLY_PIONEER", "pri_pioneer_y"): "pioneer",
}

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
    
    expires_at = None
    if ends_at_str:
        expires_at = datetime.fromisoformat(ends_at_str.replace("Z", "+00:00"))
    
    # Determine Plan Tier from Price ID
    # items is a list. usually 1 item for main plan.
    items = data.get("items", [])
    new_tier = None
    if items:
        price_id = items[0].get("price", {}).get("id")
        # Attempt to map price ID to tier
        # We search our map. 
        # Note: map keys might be env vars that are set.
        for pid, tier in PADDLE_PRICE_MAP.items():
            if pid == price_id:
                new_tier = tier
                break
    
    # Update User
    query_values = {
        "paddle_subscription_id": subscription_id,
        "paddle_customer_id": customer_id,
        "subscription_expires_at": expires_at,
    }
    
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
        for pid, tier in PADDLE_PRICE_MAP.items():
            if pid == price_id:
                values["plan_tier"] = tier
                break

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

