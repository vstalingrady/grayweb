from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
import logging
from typing import Dict, Any, Optional
import os
from datetime import datetime, timedelta

from backend.database import database, users, transactions, get_database
from backend.time_utils import utcnow
from backend.gumroad_client import gumroad_client
from backend.auth import get_current_user

logger = logging.getLogger("backend.gumroad_webhook")

router = APIRouter()

# Default option IDs for Gray tiered membership
DEFAULT_VOYAGER_OPTION_ID = "lZ9QZXSGeVuLLYzGSzk7Bw=="
DEFAULT_PIONEER_OPTION_ID = "1AKF6eGbTgVn1yq1m5YcXA=="

def get_gumroad_option_info() -> Dict[str, Dict[str, str]]:
    """
    Get option/tier mapping for tiered membership product.
    Maps option IDs to tier names. Billing cycle comes from 'recurrence' field in webhook.
    """
    mapping = {}
    
    # Voyager tier option ID
    voyager_option = os.getenv("GUMROAD_OPTION_ID_VOYAGER", DEFAULT_VOYAGER_OPTION_ID)
    if voyager_option:
        mapping[voyager_option] = {"tier": "voyager"}
    
    # Pioneer tier option ID  
    pioneer_option = os.getenv("GUMROAD_OPTION_ID_PIONEER", DEFAULT_PIONEER_OPTION_ID)
    if pioneer_option:
        mapping[pioneer_option] = {"tier": "pioneer"}
    
    return mapping

@router.post("/api/webhooks/gumroad")
async def gumroad_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle Gumroad Ping (Webhook) notifications.
    Gumroad sends x-www-form-urlencoded data.
    """
    try:
        form_data = await request.form()
        data = dict(form_data)
        
        logger.info(f"Received Gumroad Ping: {data.get('sale_id')} for product {data.get('product_name')}")

        await handle_gumroad_sale(data, db=database)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error processing Gumroad webhook: {str(e)}", exc_info=True)
        # Return 500 so Gumroad retries if it's a transient issue
        raise HTTPException(status_code=500, detail="Internal server error")

async def handle_gumroad_sale(data: Dict[str, Any], db: Any = None):
    """
    Process a Gumroad sale and update user subscription.
    """
    if db is None:
        db = database

    # Gumroad sends custom fields as individual parameters if they are simple.
    # If the custom field name is 'user_id', it arrives as 'custom_fields[user_id]'.
    user_id_str = data.get("custom_fields[user_id]") or data.get("user_id")
    
    user_id: Optional[int] = None
    if user_id_str:
        try:
            user_id = int(user_id_str)
        except ValueError:
            logger.warning(f"Invalid user_id in Gumroad sale: {user_id_str}")

    if not user_id:
        # Fallback to email search
        email = data.get("email")
        if email:
            user = await db.fetch_one(users.select().where(users.c.email == email))
            if user:
                user_id = user["id"]
                logger.info(f"Identified user {user_id} by email {email} for Gumroad sale")
    
    if not user_id:
        logger.warning(f"Could not identify user for Gumroad sale {data.get('sale_id')}")
        return

    # For tiered memberships, we need to identify the tier from the variant/option
    # Gumroad sends 'variants' field which contains the tier info
    variants = data.get("variants") or ""
    product_name = (data.get("product_name") or "").lower()
    
    # Try to identify tier from variants field or product name
    tier = None
    if "voyager" in variants.lower() or "voyager" in product_name:
        tier = "voyager"
    elif "pioneer" in variants.lower() or "pioneer" in product_name:
        tier = "pioneer"
    
    # Fallback: try option ID lookup (if we can get it from custom fields or URL params)
    if not tier:
        option_mapping = get_gumroad_option_info()
        # Check if any option ID is in the data
        for option_id, option_info in option_mapping.items():
            if option_id in str(data):
                tier = option_info["tier"]
                break
    
    if not tier:
        logger.warning(f"Could not identify tier for Gumroad sale {data.get('sale_id')} - variants: {variants}, product: {product_name}")
        # Default to voyager if we can't identify
        tier = "voyager"
        logger.info(f"Defaulting to tier: {tier}")

    # Get billing cycle from 'recurrence' field (monthly, yearly, etc.)
    recurrence = (data.get("recurrence") or "monthly").lower()
    billing_cycle = "annual" if recurrence in ["yearly", "annual"] else "monthly"
    
    # Extract IDs
    subscription_id = data.get("subscription_id")
    license_key = data.get("license_key")
    
    # Calculate expiry based on billing cycle
    days = 366 if billing_cycle == "annual" else 31
    expires_at = utcnow() + timedelta(days=days)

    # Update user record
    query = (
        users.update()
        .where(users.c.id == user_id)
        .values(
            plan_tier=tier,
            subscription_expires_at=expires_at,
            gumroad_subscription_id=subscription_id,
            gumroad_license_key=license_key
        )
    )
    await db.execute(query)
    
    # Record transaction
    sale_id = data.get("sale_id") or data.get("order_number")
    price_cents = 0
    try:
        price_cents = int(data.get("price", 0))
    except ValueError:
        pass
    
    txn_values = {
        "user_id": user_id,
        "order_id": str(sale_id),
        "gumroad_sale_id": str(sale_id),
        "amount": price_cents,
        "status": "settlement",
        "payment_type": "gumroad",
        "plan_tier": tier,
        "billing_cycle": billing_cycle,
        "created_at": utcnow()
    }
    
    # Check if transaction already exists (Gumroad might retry)
    existing_txn = await db.fetch_one(
        transactions.select().where(transactions.c.gumroad_sale_id == str(sale_id))
    )
    if not existing_txn:
        await db.execute(transactions.insert().values(txn_values))
    
    logger.info(f"Successfully processed Gumroad sale for user {user_id}, tier {tier}")

@router.post("/api/payment/gumroad/verify")
async def verify_gumroad_license_manual(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Manually trigger license verification for Gumroad.
    For tiered membership products, we use the product permalink and extract tier from response.
    """
    user_id = current_user["id"]
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    
    license_key = user.get("gumroad_license_key")
    if not license_key:
        raise HTTPException(status_code=400, detail="No Gumroad license key found for this user")
    
    # Use the product permalink for verification
    product_permalink = os.getenv("GUMROAD_PRODUCT_PERMALINK", "gray")
    
    res = await gumroad_client.verify_license(product_permalink, license_key)
    
    if not res.get("success"):
        return {"success": False, "message": "License verification failed"}
    
    purchase = res.get("purchase", {})
    
    # Extract tier from variants field
    variants = (purchase.get("variants") or "").lower()
    product_name = (purchase.get("product_name") or "").lower()
    
    tier = "voyager"  # default
    if "pioneer" in variants or "pioneer" in product_name:
        tier = "pioneer"
    elif "voyager" in variants or "voyager" in product_name:
        tier = "voyager"
    
    # Get billing cycle from recurrence
    recurrence = (purchase.get("recurrence") or "monthly").lower()
    billing_cycle = "annual" if recurrence in ["yearly", "annual"] else "monthly"
    
    # Check if subscription is still active
    ended_at_str = purchase.get("subscription_ended_at") or purchase.get("subscription_cancelled_at") or purchase.get("subscription_failed_at")
    
    if ended_at_str:
        # Subscription has ended
        from datetime import datetime
        try:
            expires_at = datetime.fromisoformat(ended_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            expires_at = utcnow()
    else:
        # Active subscription - set expiry based on billing cycle
        days = 366 if billing_cycle == "annual" else 31
        expires_at = utcnow() + timedelta(days=days)
    
    # Update user
    update_query = (
        users.update()
        .where(users.c.id == user_id)
        .values(
            plan_tier=tier,
            subscription_expires_at=expires_at,
            gumroad_license_key=license_key
        )
    )
    await db.execute(update_query)
    
    logger.info(f"License verified for user {user_id}: tier={tier}, billing_cycle={billing_cycle}")
        
    return {
        "success": True, 
        "message": f"License verified. Plan updated to {tier}",
        "tier": tier
    }
