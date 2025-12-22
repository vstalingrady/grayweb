import os
from typing import Optional, Tuple

import httpx

from backend.core.cors_utils import IS_PRODUCTION
from backend.logging_config import create_logger

logger = create_logger("backend.turnstile")

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "").strip()


async def verify_turnstile_token(
    token: Optional[str],
    remote_ip: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    if not token:
        if IS_PRODUCTION:
            return False, "Missing captcha token."
        return True, None

    if not TURNSTILE_SECRET_KEY:
        if IS_PRODUCTION:
            return False, "Turnstile secret key is not configured."
        return True, None

    payload = {"secret": TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.post(TURNSTILE_VERIFY_URL, data=payload)
            response.raise_for_status()
            result = response.json()
    except Exception as exc:
        logger.warning("Turnstile verification failed", extra={"error": str(exc)})
        if IS_PRODUCTION:
            return False, "Turnstile verification failed. Please try again."
        return True, None

    if result.get("success"):
        return True, None

    logger.info(
        "Turnstile rejected token",
        extra={"error_codes": result.get("error-codes")},
    )
    return False, "Turnstile verification failed. Please try again."
