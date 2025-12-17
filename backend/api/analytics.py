"""
Analytics API routes.

This router handles developer analytics and metrics endpoints.
"""

import hmac
import ipaddress
import os
from datetime import timedelta
from typing import Any, Dict, Optional

import databases
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Request, status

try:
    from backend.database import (
        get_database,
        DATABASE_URL,
        users,
        user_data,
        general_chat_messages,
        reminders,
        plans,
        habits,
        calendars,
        calendar_events,
        dashboard_pulses,
        proactivity_settings,
        proactivity_logs,
        proactivity_push_subscriptions,
        proactive_notifications,
        context_cache,
        media_uploads,
        google_calendar_credentials,
    )
except ImportError:
    from database import (  # type: ignore
        get_database,
        DATABASE_URL,
        users,
        user_data,
        general_chat_messages,
        reminders,
        plans,
        habits,
        calendars,
        calendar_events,
        dashboard_pulses,
        proactivity_settings,
        proactivity_logs,
        proactivity_push_subscriptions,
        proactive_notifications,
        context_cache,
        media_uploads,
        google_calendar_credentials,
    )

try:
    from backend.core.cors_utils import IS_PRODUCTION
except ImportError:
    from core.cors_utils import IS_PRODUCTION  # type: ignore

try:
    from backend.time_utils import utcnow_aware
except ImportError:
    from time_utils import utcnow_aware  # type: ignore


router = APIRouter(tags=["analytics"])


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


@router.get("/dev/analytics/summary")
async def dev_analytics_summary(
    request: Request,
    db: databases.Database = Depends(get_database),
):
    """Development analytics summary endpoint."""
    token = (os.getenv("DEV_ANALYTICS_TOKEN") or "").strip()
    provided = (request.headers.get("x-dev-analytics-token") or "").strip()
    token_ok = bool(token) and hmac.compare_digest(token, provided)

    is_localhost = _is_localhost_request(request)
    if IS_PRODUCTION and not is_localhost and not token_ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not is_localhost and not token_ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    try:
        from backend.database import user_chat_threads, user_chat_messages, transactions
    except Exception:
        from database import user_chat_threads, user_chat_messages, transactions  # type: ignore

    tables: Dict[str, sqlalchemy.Table] = {
        "users": users,
        "user_data": user_data,
        "user_chat_threads": user_chat_threads,
        "user_chat_messages": user_chat_messages,
        "general_chat_messages": general_chat_messages,
        "reminders": reminders,
        "plans": plans,
        "habits": habits,
        "calendars": calendars,
        "calendar_events": calendar_events,
        "dashboard_pulses": dashboard_pulses,
        "transactions": transactions,
        "proactivity_settings": proactivity_settings,
        "proactivity_logs": proactivity_logs,
        "proactivity_push_subscriptions": proactivity_push_subscriptions,
        "proactive_notifications": proactive_notifications,
        "context_cache": context_cache,
        "media_uploads": media_uploads,
        "google_calendar_credentials": google_calendar_credentials,
    }

    counts: Dict[str, Optional[int]] = {}
    for name, table in tables.items():
        try:
            counts[name] = int(
                await db.fetch_val(sqlalchemy.select(sqlalchemy.func.count()).select_from(table))
            )
        except Exception:
            counts[name] = None

    sqlite_path: Optional[str] = None
    sqlite_size_bytes: Optional[int] = None
    if isinstance(DATABASE_URL, str) and DATABASE_URL.startswith("sqlite:///"):
        sqlite_path = DATABASE_URL.replace("sqlite:///", "", 1)
        try:
            sqlite_size_bytes = os.path.getsize(sqlite_path)
        except OSError:
            sqlite_size_bytes = None

    # ========== USER GROWTH METRICS ==========
    user_growth: Dict[str, Any] = {}
    try:
        total_users = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
        )
        user_growth["total_users"] = int(total_users) if total_users else 0
    except Exception:
        user_growth["total_users"] = 0

    # Plan tier distribution
    try:
        plan_distribution: Dict[str, int] = {"scout": 0, "voyager": 0, "pioneer": 0, "none": 0}
        rows = await db.fetch_all(
            sqlalchemy.select(users.c.plan_tier, sqlalchemy.func.count().label("cnt"))
            .group_by(users.c.plan_tier)
        )
        for row in rows:
            tier = (row["plan_tier"] or "").lower().strip()
            if tier in plan_distribution:
                plan_distribution[tier] = int(row["cnt"])
            else:
                plan_distribution["none"] += int(row["cnt"])
        user_growth["plan_distribution"] = plan_distribution
    except Exception:
        user_growth["plan_distribution"] = {"scout": 0, "voyager": 0, "pioneer": 0, "none": 0}

    # New signups in last 7 days and 30 days
    try:
        now = utcnow_aware()
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        
        new_7d = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
            .where(users.c.created_at >= seven_days_ago)
        )
        new_30d = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
            .where(users.c.created_at >= thirty_days_ago)
        )
        user_growth["new_7d"] = int(new_7d) if new_7d else 0
        user_growth["new_30d"] = int(new_30d) if new_30d else 0
    except Exception:
        user_growth["new_7d"] = 0
        user_growth["new_30d"] = 0

    # ========== ENGAGEMENT METRICS ==========
    engagement: Dict[str, Any] = {}
    try:
        now = utcnow_aware()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)

        # DAU from general_chat_messages
        dau_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(general_chat_messages.c.created_at >= today_start)
        )
        # DAU from user_chat_messages (thread-based)
        dau_threads = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(user_chat_threads.c.user_identifier)))
            .select_from(
                user_chat_messages.join(user_chat_threads, user_chat_messages.c.thread_id == user_chat_threads.c.id)
            )
            .where(user_chat_messages.c.created_at >= today_start)
        )
        engagement["dau"] = max(int(dau_general or 0), int(dau_threads or 0))

        # WAU
        wau_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(general_chat_messages.c.created_at >= week_start)
        )
        engagement["wau"] = int(wau_general or 0)

        # MAU
        mau_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(general_chat_messages.c.created_at >= month_start)
        )
        engagement["mau"] = int(mau_general or 0)

        # Total messages
        total_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(general_chat_messages)
        )
        total_threads = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(user_chat_messages)
        )
        engagement["total_general_messages"] = int(total_general or 0)
        engagement["total_thread_messages"] = int(total_threads or 0)

        # Average messages per user
        active_users = engagement["mau"] if engagement["mau"] > 0 else 1
        engagement["avg_messages_per_user"] = round(
            (engagement["total_general_messages"] + engagement["total_thread_messages"]) / active_users, 1
        )
    except Exception:
        engagement = {
            "dau": 0, "wau": 0, "mau": 0,
            "total_general_messages": 0, "total_thread_messages": 0,
            "avg_messages_per_user": 0.0
        }

    # ========== FEATURE ADOPTION METRICS ==========
    feature_adoption: Dict[str, Any] = {}
    try:
        # Users with plans
        users_with_plans = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(plans.c.user_id)))
        )
        feature_adoption["users_with_plans"] = int(users_with_plans or 0)

        # Users with habits
        users_with_habits = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(habits.c.user_id)))
        )
        feature_adoption["users_with_habits"] = int(users_with_habits or 0)

        # Active reminders (pending status)
        active_reminders = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(reminders)
            .where(reminders.c.status == "pending")
        )
        feature_adoption["active_reminders"] = int(active_reminders or 0)

        # Calendar events
        calendar_event_count = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(calendar_events)
        )
        feature_adoption["calendar_events"] = int(calendar_event_count or 0)

        # Push subscriptions
        push_subs = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(proactivity_push_subscriptions)
        )
        feature_adoption["push_subscriptions"] = int(push_subs or 0)
    except Exception:
        feature_adoption = {
            "users_with_plans": 0, "users_with_habits": 0,
            "active_reminders": 0, "calendar_events": 0, "push_subscriptions": 0
        }

    # ========== RETENTION METRICS ==========
    retention: Dict[str, Any] = {}
    try:
        today_str = utcnow_aware().strftime("%Y-%m-%d")
        active_today = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(sqlalchemy.func.date(general_chat_messages.c.created_at) == today_str)
        )
        retention["active_today"] = int(active_today or 0)
    except Exception:
        retention = {"active_today": 0}

    # ========== REVENUE METRICS ==========
    revenue: Dict[str, Any] = {}
    try:
        # Transactions by status
        by_status: Dict[str, int] = {}
        status_rows = await db.fetch_all(
            sqlalchemy.select(transactions.c.status, sqlalchemy.func.count().label("cnt"))
            .group_by(transactions.c.status)
        )
        for row in status_rows:
            by_status[row["status"] or "unknown"] = int(row["cnt"])
        revenue["by_status"] = by_status

        # Revenue by plan (settlement only)
        by_plan: Dict[str, float] = {}
        plan_rows = await db.fetch_all(
            sqlalchemy.select(transactions.c.plan_tier, sqlalchemy.func.sum(transactions.c.amount).label("total"))
            .where(transactions.c.status == "settlement")
            .group_by(transactions.c.plan_tier)
        )
        for row in plan_rows:
            by_plan[row["plan_tier"] or "unknown"] = float(row["total"] or 0)
        revenue["by_plan"] = by_plan

        # Conversion rate
        total_transactions = sum(by_status.values())
        settled = by_status.get("settlement", 0)
        revenue["conversion_rate"] = round(settled / total_transactions, 3) if total_transactions > 0 else 0.0
    except Exception:
        revenue = {"by_status": {}, "by_plan": {}, "conversion_rate": 0.0}

    return {
        "generated_at": utcnow_aware().isoformat(),
        "database_url": DATABASE_URL,
        "sqlite_path": sqlite_path,
        "sqlite_size_bytes": sqlite_size_bytes,
        "counts": counts,
        "user_growth": user_growth,
        "engagement": engagement,
        "feature_adoption": feature_adoption,
        "retention": retention,
        "revenue": revenue,
    }
