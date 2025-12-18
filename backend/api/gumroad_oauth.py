from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
import logging
import secrets
import os
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from backend.database import database, users, get_database
from backend.time_utils import utcnow
from backend.gumroad_client import gumroad_client
from backend.auth import get_current_user

logger = logging.getLogger("backend.gumroad_oauth")

router = APIRouter()

# In-memory storage for OAuth state tokens (production should use Redis)
oauth_states: Dict[str, Dict[str, Any]] = {}

def get_redirect_uri() -> str:
    """Get the appropriate redirect URI based on environment"""
    env = os.getenv("ENVIRONMENT", "development")
    if env == "production":
        return "https://gray.alignment.id/api/auth/gumroad/callback"
    else:
        # Development - match what's in Gumroad settings
        return "http://127.0.0.1:3000/api/auth/gumroad/callback"

@router.get("/api/auth/gumroad/login")
async def gumroad_oauth_login(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Initiate Gumroad OAuth flow.
    Generates a state token and redirects to Gumroad authorization URL.
    """
    if not gumroad_client.client_id:
        raise HTTPException(status_code=500, detail="Gumroad OAuth not configured")
    
    # Generate secure state token
    state = secrets.token_urlsafe(32)
    
    # Store state with user_id for verification
    oauth_states[state] = {
        "user_id": current_user["id"],
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(minutes=10)
    }
    
    # Clean up expired states
    now = utcnow()
    expired = [s for s, data in oauth_states.items() if data["expires_at"] < now]
    for s in expired:
        del oauth_states[s]
    
    redirect_uri = get_redirect_uri()
    
    # Build Gumroad OAuth URL
    oauth_url = (
        f"https://gumroad.com/oauth/authorize"
        f"?client_id={gumroad_client.client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=view_sales"
        f"&state={state}"
    )
    
    logger.info(f"Redirecting user {current_user['id']} to Gumroad OAuth")
    return RedirectResponse(url=oauth_url, status_code=302)

@router.get("/api/auth/gumroad/callback")
async def gumroad_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Any = Depends(get_database)
):
    """
    Handle OAuth callback from Gumroad.
    Exchange authorization code for access token and update user.
    """
    # Handle error from Gumroad
    if error:
        logger.error(f"Gumroad OAuth error: {error}")
        return RedirectResponse(
            url=f"/gray/settings?gumroad_error={error}",
            status_code=302
        )
    
    # Validate required parameters
    if not code or not state:
        logger.error("Missing code or state in OAuth callback")
        return RedirectResponse(
            url="/gray/settings?gumroad_error=missing_params",
            status_code=302
        )
    
    # Verify state token
    state_data = oauth_states.get(state)
    if not state_data:
        logger.error(f"Invalid or expired OAuth state: {state}")
        return RedirectResponse(
            url="/gray/settings?gumroad_error=invalid_state",
            status_code=302
        )
    
    # Check expiration
    if state_data["expires_at"] < utcnow():
        del oauth_states[state]
        logger.error("OAuth state expired")
        return RedirectResponse(
            url="/gray/settings?gumroad_error=state_expired",
            status_code=302
        )
    
    user_id = state_data["user_id"]
    del oauth_states[state]  # Clean up used state
    
    try:
        # Exchange code for token
        redirect_uri = get_redirect_uri()
        token_response = await gumroad_client.exchange_authorization_code(code, redirect_uri)
        
        if not token_response.get("access_token"):
            logger.error(f"Failed to get access token: {token_response}")
            return RedirectResponse(
                url="/gray/settings?gumroad_error=token_exchange_failed",
                status_code=302
            )
        
        access_token = token_response["access_token"]
        refresh_token = token_response.get("refresh_token")
        
        # Get user info from Gumroad
        user_info = await gumroad_client.get_user_info(access_token)
        gumroad_user = user_info.get("user", {})
        gumroad_user_id = gumroad_user.get("user_id")
        gumroad_email = gumroad_user.get("email")
        
        # Get user's sales to verify purchases
        sales_response = await gumroad_client.get_user_sales(access_token)
        sales = sales_response.get("sales", [])
        
        # Find the most recent active subscription
        subscription_tier = None
        subscription_expires_at = None
        
        # Map of product IDs to tiers (from environment)
        product_mapping = {
            os.getenv("GUMROAD_PRODUCT_ID_VOYAGER_MONTHLY"): ("voyager", 31),
            os.getenv("GUMROAD_PRODUCT_ID_VOYAGER_YEARLY"): ("voyager", 366),
            os.getenv("GUMROAD_PRODUCT_ID_PIONEER_MONTHLY"): ("pioneer", 31),
            os.getenv("GUMROAD_PRODUCT_ID_PIONEER_YEARLY"): ("pioneer", 366),
        }
        
        for sale in sales:
            product_id = sale.get("product_id")
            if product_id in product_mapping:
                tier, days = product_mapping[product_id]
                
                # Check if subscription is active
                subscription_ended_at = sale.get("subscription_ended_at")
                subscription_cancelled_at = sale.get("subscription_cancelled_at")
                
                if not subscription_ended_at and not subscription_cancelled_at:
                    # Active subscription
                    subscription_tier = tier
                    subscription_expires_at = utcnow() + timedelta(days=days)
                    break
        
        # Update user record with Gumroad info
        update_values = {
            "gumroad_access_token": access_token,
            "gumroad_user_id": gumroad_user_id,
            "gumroad_email": gumroad_email,
        }
        
        if refresh_token:
            update_values["gumroad_refresh_token"] = refresh_token
        
        if subscription_tier:
            update_values["plan_tier"] = subscription_tier
            update_values["subscription_expires_at"] = subscription_expires_at
        
        query = users.update().where(users.c.id == user_id).values(**update_values)
        await db.execute(query)
        
        logger.info(f"Successfully linked Gumroad account for user {user_id}, tier: {subscription_tier}")
        
        return RedirectResponse(
            url="/gray/settings?gumroad_success=true",
            status_code=302
        )
        
    except Exception as e:
        logger.error(f"Error in Gumroad OAuth callback: {str(e)}", exc_info=True)
        return RedirectResponse(
            url="/gray/settings?gumroad_error=server_error",
            status_code=302
        )

@router.post("/api/auth/gumroad/disconnect")
async def gumroad_disconnect(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Any = Depends(get_database)
):
    """
    Disconnect Gumroad account from user.
    """
    user_id = current_user["id"]
    
    query = users.update().where(users.c.id == user_id).values(
        gumroad_access_token=None,
        gumroad_refresh_token=None,
        gumroad_user_id=None,
        gumroad_email=None
    )
    await db.execute(query)
    
    logger.info(f"Disconnected Gumroad account for user {user_id}")
    
    return {"success": True, "message": "Gumroad account disconnected"}
