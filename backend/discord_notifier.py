from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger("backend.discord_notifier")


_PAYMENTS_WEBHOOK_ENV_VARS = ("DISCORD_PAYMENTS_WEBHOOK_URL", "DISCORD_WEBHOOK_URL")
_ALERTS_WEBHOOK_ENV_VARS = ("DISCORD_ALERTS_WEBHOOK_URL", "DISCORD_WEBHOOK_URL")


def get_discord_webhook_url() -> Optional[str]:
    for key in _PAYMENTS_WEBHOOK_ENV_VARS:
        value = (os.getenv(key) or "").strip()
        if value:
            return value
    return None


def get_discord_alerts_webhook_url() -> Optional[str]:
    for key in _ALERTS_WEBHOOK_ENV_VARS:
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


_ALERT_DEDUPE: Dict[str, float] = {}
_ALERT_RATE: Dict[int, int] = {}  # epoch minute -> count


def _alert_config() -> Tuple[int, float, int]:
    min_level_name = (os.getenv("DISCORD_ALERT_MIN_LEVEL") or "ERROR").strip().upper()
    min_level = getattr(logging, min_level_name, logging.ERROR)
    cooldown_seconds = float(os.getenv("DISCORD_ALERT_COOLDOWN_SECONDS") or "120")
    max_per_minute = int(os.getenv("DISCORD_ALERT_MAX_PER_MINUTE") or "12")
    return min_level, max(0.0, cooldown_seconds), max(1, max_per_minute)


def _alert_color(severity: str) -> int:
    normalized = (severity or "").strip().lower()
    if normalized in {"critical"}:
        return 0x992D22
    if normalized in {"error"}:
        return 0xE74C3C
    if normalized in {"warning", "warn"}:
        return 0xF1C40F
    return 0x3498DB


def build_alert_webhook_payload(
    *,
    title: str,
    message: str,
    severity: str = "warning",
    fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    embed_fields: list[Dict[str, Any]] = []
    if fields:
        for key, value in fields.items():
            if value is None:
                continue
            embed_fields.append({"name": str(key), "value": str(value), "inline": True})

    return {
        "content": None,
        "embeds": [
            {
                "title": title,
                "description": str(message or "").strip()[:1800] or None,
                "color": _alert_color(severity),
                "timestamp": _now_iso(),
                "fields": embed_fields[:25],
            }
        ],
    }


def should_send_alert(*, dedupe_key: str) -> bool:
    url = get_discord_alerts_webhook_url()
    if not url:
        return False

    _, cooldown_seconds, max_per_minute = _alert_config()
    now = time.time()

    last = _ALERT_DEDUPE.get(dedupe_key)
    if last is not None and cooldown_seconds and now - last < cooldown_seconds:
        return False

    minute_bucket = int(now // 60)
    count = _ALERT_RATE.get(minute_bucket, 0)
    if count >= max_per_minute:
        return False

    _ALERT_DEDUPE[dedupe_key] = now
    _ALERT_RATE[minute_bucket] = count + 1
    for bucket in list(_ALERT_RATE.keys()):
        if bucket < minute_bucket - 2:
            _ALERT_RATE.pop(bucket, None)
    return True


async def notify_alert(
    *,
    title: str,
    message: str,
    severity: str = "warning",
    fields: Optional[Dict[str, Any]] = None,
    dedupe_key: Optional[str] = None,
) -> None:
    url = get_discord_alerts_webhook_url()
    if not url:
        return

    safe_key = dedupe_key or f"{title}:{severity}:{(message or '')[:80]}"
    if not should_send_alert(dedupe_key=safe_key):
        return

    try:
        payload = build_alert_webhook_payload(
            title=title,
            message=message,
            severity=severity,
            fields=fields,
        )
        await _post_discord_webhook(url, payload)
    except Exception as exc:
        logger.warning("Discord alert notification failed", extra={"error": str(exc)})


def schedule_alert_if_possible(coro: "asyncio.Future[Any] | asyncio.coroutines.Coroutine[Any, Any, Any]") -> None:
    """
    Best-effort scheduling helper for calling `notify_alert` from sync code.
    No-op when no event loop is running.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = loop.create_task(coro)

    def _log_failure(done_task: "asyncio.Task[Any]") -> None:
        try:
            exc = done_task.exception()
        except Exception:
            return
        if exc:
            logger.warning("Discord alert task failed", extra={"error": str(exc)})

    task.add_done_callback(_log_failure)


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
