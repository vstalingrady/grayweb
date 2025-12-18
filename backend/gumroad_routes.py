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

def get_gumroad_product_info() -> Dict[str, Dict[str, str]]:
    """
    Get product mapping dynamically to support environment variable changes and testing.
    """
    mapping = {}
    
    # Voyager
    v_m = os.getenv("GUMROAD_PRODUCT_ID_VOYAGER_MONTHLY")
    if v_m: mapping[v_m] = {"tier": "voyager", "billing_cycle": "monthly"}
    v_y = os.getenv("GUMROAD_PRODUCT_ID_VOYAGER_YEARLY")
    if v_y: mapping[v_y] = {"tier": "voyager", "billing_cycle": "annual"}
    
    # Pioneer
    p_m = os.getenv("GUMROAD_PRODUCT_ID_PIONEER_MONTHLY")
    if p_m: mapping[p_m] = {"tier": "pioneer", "billing_cycle": "monthly"}
    p_y = os.getenv("GUMROAD_PRODUCT_ID_PIONEER_YEARLY")
    if p_y: mapping[p_y] = {"tier": "pioneer", "billing_cycle": "annual"}
    
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

    product_id = data.get("product_id")
    info = get_gumroad_product_info().get(product_id)
    
    if not info:
        # Check if we can identify by product name as fallback
        product_name = (data.get("product_name") or "").lower()
        if "voyager" in product_name:
            tier = "voyager"
            billing_cycle = "annual" if "year" in product_name or "annual" in product_name else "monthly"
            info = {"tier": tier, "billing_cycle": billing_cycle}
        elif "pioneer" in product_name:
            tier = "pioneer"
            billing_cycle = "annual" if "year" in product_name or "annual" in product_name else "monthly"
            info = {"tier": tier, "billing_cycle": billing_cycle}

    if not info:
        logger.warning(f"Unknown Gumroad product: {product_id} ({data.get('product_name')})")
        return

    tier = info["tier"]
    billing_cycle = info["billing_cycle"]
    
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
    """
    user_id = current_user["id"]
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    
    license_key = user.get("gumroad_license_key")
    if not license_key:
        raise HTTPException(status_code=400, detail="No Gumroad license key found for this user")
    
    found_product_info = None
    product_mapping = get_gumroad_product_info()
    for product_id, info in product_mapping.items():
        if not product_id:
            continue
        res = await gumroad_client.verify_license(product_id, license_key)
        if res.get("success"):
            found_product_info = info
            # Extract subscription end date if available
            purchase = res.get("purchase", {})
            ended_at_str = purchase.get("subscription_ended_at") or purchase.get("subscription_cancelled_at") or purchase.get("subscription_failed_at")
            
            # If not explicitly ended, set a default based on cycle
            if not ended_at_str:
                days = 366 if info["billing_cycle"] == "annual" else 31
                expires_at = utcnow() + timedelta(days=days)
            else:
                # Parse Gumroad date (usually ISO)
                from datetime import datetime
                try:
                    expires_at = datetime.fromisoformat(ended_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
                except ValueError:
                    expires_at = utcnow() # Fallback
            
            # Update user
            update_query = (
                users.update()
                .where(users.c.id == user_id)
                .values(
                    plan_tier=info["tier"],
                    subscription_expires_at=expires_at,
                    gumroad_license_key=license_key
                )
            )
            await db.execute(update_query)
            break
            
    if not found_product_info:
        return {"success": False, "message": "License verification failed or product not recognized"}
        
    return {
        "success": True, 
        "message": f"License verified. Plan updated to {found_product_info['tier']}",
        "tier": found_product_info["tier"]
    }
