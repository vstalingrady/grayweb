"""HMAC Request Signing middleware for API security.

This module provides request signing verification to prevent tampering.
Clients must include an X-Signature header with HMAC-SHA256 of the request body.
"""

import hashlib
import hmac
import os
import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

# Signing secret - should be shared with trusted clients
SIGNING_SECRET = os.getenv("API_SIGNING_SECRET", os.getenv("GRAY_APP_SECRET", ""))
SIGNATURE_HEADER = "X-Signature"
TIMESTAMP_HEADER = "X-Timestamp"
SIGNATURE_MAX_AGE = 300  # 5 minutes max age for signed requests

# Endpoints that require signing (empty = disabled, "*" = all)
SIGNED_ENDPOINTS: set[str] = set()  # Add paths like "/api/v1/sensitive" to enable


def compute_signature(body: bytes, timestamp: str, secret: str) -> str:
    """Compute HMAC-SHA256 signature of request body with timestamp."""
    message = f"{timestamp}.{body.decode('utf-8', errors='replace')}"
    return hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()


def verify_signature(body: bytes, signature: str, timestamp: str, secret: str) -> bool:
    """Verify HMAC signature matches expected value."""
    if not signature or not timestamp or not secret:
        return False
    
    expected = compute_signature(body, timestamp, secret)
    return hmac.compare_digest(signature, expected)


async def verify_request_signature(request: Request) -> bool:
    """
    Verify request signature if endpoint requires it.
    
    Returns True if signature is valid or endpoint doesn't require signing.
    Raises HTTPException if signature is invalid.
    """
    # Check if signing is enabled and this endpoint requires it
    if not SIGNING_SECRET:
        return True  # Signing not configured
    
    path = request.url.path
    if SIGNED_ENDPOINTS and path not in SIGNED_ENDPOINTS and "*" not in SIGNED_ENDPOINTS:
        return True  # This endpoint doesn't require signing
    
    signature = request.headers.get(SIGNATURE_HEADER)
    timestamp = request.headers.get(TIMESTAMP_HEADER)
    
    if not signature or not timestamp:
        logger.warning(f"Missing signature headers for {path}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing request signature"
        )
    
    # Check timestamp freshness
    try:
        request_time = int(timestamp)
        current_time = int(time.time())
        if abs(current_time - request_time) > SIGNATURE_MAX_AGE:
            logger.warning(f"Stale signature for {path}, age: {abs(current_time - request_time)}s")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Request signature expired"
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid timestamp format"
        )
    
    # Get request body
    body = await request.body()
    
    if not verify_signature(body, signature, timestamp, SIGNING_SECRET):
        logger.warning(f"Invalid signature for {path}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid request signature"
        )
    
    return True


# =============================================================================
# Client-side helper (for testing or internal services)
# =============================================================================

def sign_request(body: str, secret: Optional[str] = None) -> dict[str, str]:
    """
    Generate signature headers for a request.
    
    Returns dict with X-Signature and X-Timestamp headers.
    Use this for internal service-to-service calls.
    """
    secret = secret or SIGNING_SECRET
    timestamp = str(int(time.time()))
    signature = compute_signature(body.encode(), timestamp, secret)
    
    return {
        SIGNATURE_HEADER: signature,
        TIMESTAMP_HEADER: timestamp,
    }
