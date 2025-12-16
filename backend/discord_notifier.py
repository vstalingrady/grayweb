from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("backend.discord_notifier")


_WEBHOOK_ENV_VARS = ("DISCORD_PAYMENTS_WEBHOOK_URL", "DISCORD_WEBHOOK_URL")


def get_discord_webhook_url() -> Optional[str]:
    for key in _WEBHOOK_ENV_VARS:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_payment_webhook_payload(
    *,
    provider: str,
    status: str,
    order_id: str,
    amount: Optional[str] = None,
    currency: Optional[str] = None,
    user_id: Optional[int] = None,
    plan_tier: Optional[str] = None,
    billing_cycle: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    title = f"Payment received ({provider})"
    fields: list[Dict[str, Any]] = [
        {"name": "Status", "value": str(status), "inline": True},
        {"name": "Order ID", "value": str(order_id), "inline": True},
    ]

    if user_id is not None:
        fields.append({"name": "User ID", "value": str(user_id), "inline": True})
    if amount is not None:
        fields.append({"name": "Amount", "value": str(amount), "inline": True})
    if currency is not None:
        fields.append({"name": "Currency", "value": str(currency), "inline": True})
    if plan_tier is not None:
        fields.append({"name": "Plan", "value": str(plan_tier), "inline": True})
    if billing_cycle is not None:
        fields.append({"name": "Billing", "value": str(billing_cycle), "inline": True})

    if extra:
        for key, value in extra.items():
            if value is None:
                continue
            fields.append({"name": str(key), "value": str(value), "inline": True})

    return {
        "content": None,
        "embeds": [
            {
                "title": title,
                "color": 0x2ECC71,  # green
                "timestamp": _now_iso(),
                "fields": fields,
            }
        ],
    }


async def _post_discord_webhook(url: str, payload: Dict[str, Any]) -> None:
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
        response = await client.post(url, json=payload)
        if response.status_code >= 400:
            logger.warning(
                "Discord webhook request failed",
                extra={"status_code": response.status_code, "body": response.text[:500]},
            )


async def notify_payment_success(
    *,
    provider: str,
    status: str,
    order_id: str,
    amount: Optional[str] = None,
    currency: Optional[str] = None,
    user_id: Optional[int] = None,
    plan_tier: Optional[str] = None,
    billing_cycle: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    url = get_discord_webhook_url()
    if not url:
        return

    try:
        payload = build_payment_webhook_payload(
            provider=provider,
            status=status,
            order_id=order_id,
            amount=amount,
            currency=currency,
            user_id=user_id,
            plan_tier=plan_tier,
            billing_cycle=billing_cycle,
            extra=extra,
        )
        await _post_discord_webhook(url, payload)
    except Exception as exc:
        logger.warning("Discord webhook notification failed", extra={"error": str(exc)})
