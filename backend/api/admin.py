from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import databases
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Request

try:
    from backend.auth import get_current_user_optional, require_admin
    from backend.database import get_database, users, general_chat_messages
    from backend.time_utils import utcnow
    from backend.api.analytics import _is_localhost_request
except ImportError:
    from auth import get_current_user_optional, require_admin  # type: ignore
    from database import get_database, users, general_chat_messages  # type: ignore
    from time_utils import utcnow  # type: ignore
    from api.analytics import _is_localhost_request  # type: ignore

router = APIRouter(tags=["admin"])

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
