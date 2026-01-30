from datetime import datetime, timedelta, timezone
import ipaddress
from typing import Any, Dict, Optional

import databases
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Request

from backend.auth import get_current_user_optional, require_admin
from backend.database import get_database, users, general_chat_messages
from backend.core.cors_utils import IS_PRODUCTION
from backend.time_utils import utcnow

router = APIRouter(tags=["admin"])

def _is_localhost_request(request: Request) -> bool:
    """
    Best-effort helper for gating local-only endpoints.

    Security: In production, always return False. Loopback detection is unreliable
    behind reverse proxies (where the backend may see 127.0.0.1 for all traffic),
    and forwarded headers / Host are client-controlled unless explicitly validated.
    """
    if IS_PRODUCTION:
        return False

    def _parse_ip(value: str) -> Optional[ipaddress.IPv4Address | ipaddress.IPv6Address]:
        try:
            return ipaddress.ip_address(value)
        except ValueError:
            return None

    client_host = request.client.host if request.client else ""

    if client_host in {"127.0.0.1", "::1", "localhost"}:
        return True

    client_ip = _parse_ip(client_host)
    return bool(client_ip and client_ip.is_loopback)

def _count_error_entries(since: datetime) -> Dict[str, Any]:
    """Placeholder for error counting - not yet implemented."""
    return {"count": 0, "note": "Error counting not implemented"}


def _collect_latency_stats(since: datetime) -> Dict[str, Any]:
    """Placeholder for latency stats - not yet implemented."""
    return {"note": "Latency stats not implemented"}


@router.get("/admin/metrics")
async def get_admin_metrics(
    request: Request,
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Lightweight metrics for local admin use."""
    is_localhost = _is_localhost_request(request)

    # In production, localhost bypass is disabled (see _is_localhost_request).
    if current_user:
        require_admin(current_user)
    elif not is_localhost:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    now = utcnow()
    start_of_today = datetime.combine(now.date(), datetime.min.time())

    total_users = await db.fetch_val(
        sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
    )
    messages_today = await db.fetch_val(
        sqlalchemy.select(sqlalchemy.func.count())
        .select_from(general_chat_messages)
        .where(general_chat_messages.c.created_at >= start_of_today)
    )

    error_stats = _count_error_entries(since=start_of_today)
    latency_stats = _collect_latency_stats(since=now - timedelta(days=1))

    return {
        "generated_at": now.replace(tzinfo=timezone.utc).isoformat(),
        "totals": {"users": int(total_users or 0)},
        "messages": {"today": int(messages_today or 0)},
        "errors": error_stats,
        "latency": latency_stats,
        "manual_checks": {
            "stability_mobile_keyboard": "Confirm the mobile keyboard does not cover the chat input.",
            "onboarding_speed": "Verify signup finishes in under 60 seconds.",
        },
    }
