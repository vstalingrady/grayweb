"""User streak helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from backend.core.env_helpers import _parse_utc_offset
from backend.time_utils import utcnow


def _resolve_timezone(label: Optional[str]) -> timezone:
    """Resolve a timezone label to tzinfo, falling back to UTC."""
    cleaned = (label or "").strip()
    if not cleaned:
        return timezone.utc
    try:
        return ZoneInfo(cleaned)
    except Exception:
        offset = _parse_utc_offset(cleaned)
        return offset or timezone.utc


def _ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _local_date_key(now_utc: datetime, tz_label: Optional[str]) -> str:
    tzinfo = _resolve_timezone(tz_label)
    local_dt = _ensure_aware_utc(now_utc).astimezone(tzinfo)
    return local_dt.date().isoformat()


def _parse_date_key(value: Optional[str]) -> Optional[datetime.date]:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def build_streak_context(streak_count: Optional[int], streak_last_date: Optional[str]) -> Optional[str]:
    """Build a short context line for the AI about user engagement streak."""
    if not streak_count or streak_count <= 0:
        return None
    last_label = streak_last_date or "unknown"
    return (
        "Engagement: current streak is "
        f"{streak_count} day(s). Last active date: {last_label}. "
        "Encourage the user to maintain the streak and return daily."
    )


def _format_local_date(value: Optional[datetime], tz_label: Optional[str]) -> Optional[str]:
    if not value:
        return None
    tzinfo = _resolve_timezone(tz_label)
    local_dt = _ensure_aware_utc(value).astimezone(tzinfo)
    return local_dt.date().isoformat()


def compute_inactivity_days(
    last_message_at: Optional[datetime],
    *,
    now_utc: Optional[datetime] = None,
    timezone_label: Optional[str] = None,
) -> Tuple[Optional[int], Optional[str]]:
    """Return (days_since_last_message, last_message_local_date)."""
    if not last_message_at:
        return None, None
    now = now_utc or utcnow()
    tzinfo = _resolve_timezone(timezone_label)
    now_local_date = _ensure_aware_utc(now).astimezone(tzinfo).date()
    last_local_date = _ensure_aware_utc(last_message_at).astimezone(tzinfo).date()
    return (now_local_date - last_local_date).days, last_local_date.isoformat()


def build_engagement_context(
    streak_count: Optional[int],
    streak_last_date: Optional[str],
    inactivity_days: Optional[int],
    last_message_date: Optional[str],
    ignored_pings: Optional[int],
) -> Optional[str]:
    parts = []
    if streak_count and streak_count > 0:
        last_label = streak_last_date or "unknown"
        parts.append(f"Current streak: {int(streak_count)} day(s). Last active date: {last_label}.")
    if inactivity_days is not None:
        if inactivity_days <= 0:
            parts.append("User is active today.")
        elif inactivity_days == 1:
            parts.append(f"Last message was 1 day ago (local date {last_message_date or 'unknown'}).")
        else:
            parts.append(
                f"Last message was {inactivity_days} days ago (local date {last_message_date or 'unknown'})."
            )
    if ignored_pings and ignored_pings > 0:
        parts.append(f"Ignored proactive check-ins: {int(ignored_pings)} in the last 30 days.")
    if not parts:
        return None
    parts.append("Be supportive and encouraging; avoid guilt or pressure.")
    return "Engagement notes: " + " ".join(parts)


def append_streak_context(time_context: Optional[str], streak_context: Optional[str]) -> Optional[str]:
    if not streak_context:
        return time_context
    if time_context and isinstance(time_context, str) and time_context.strip():
        return f"{time_context.strip()}\n\n{streak_context}"
    return streak_context


async def load_user_streak(db, user_id: int) -> Optional[Dict[str, Any]]:
    from backend.database import users

    record = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not record:
        return None
    row = dict(record)
    return {
        "streak_count": row.get("streak_count") or 0,
        "streak_last_date": row.get("streak_last_date"),
    }


async def load_last_user_message_at(db, user_id: int) -> Optional[datetime]:
    """Find most recent user-authored message across general + thread chats."""
    last_general: Optional[datetime] = None
    last_thread: Optional[datetime] = None

    try:
        general_row = await db.fetch_one(
            """
            SELECT created_at
            FROM general_chat_messages
            WHERE user_id = :user_id AND role = 'user'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            {"user_id": user_id},
        )
        if general_row:
            last_general = general_row["created_at"]
    except Exception:
        last_general = None

    try:
        thread_row = await db.fetch_one(
            """
            SELECT m.created_at
            FROM user_chat_messages m
            JOIN user_chat_threads t ON t.id = m.thread_id
            WHERE t.user_identifier = :user_id AND m.role = 'user'
            ORDER BY m.created_at DESC
            LIMIT 1
            """,
            {"user_id": user_id},
        )
        if thread_row:
            last_thread = thread_row["created_at"]
    except Exception:
        last_thread = None

    if last_general and last_thread:
        return max(last_general, last_thread)
    return last_general or last_thread


async def count_ignored_proactivity(
    db,
    user_id: int,
    *,
    now_utc: Optional[datetime] = None,
    window_days: int = 30,
    grace_hours: int = 6,
) -> int:
    """Count proactive notifications ignored (unread/uncompleted) in recent window."""
    now = now_utc or utcnow()
    window_start = now - timedelta(days=window_days)
    ignore_cutoff = now - timedelta(hours=grace_hours)
    try:
        result = await db.fetch_val(
            """
            SELECT COUNT(*)
            FROM proactive_notifications
            WHERE user_id = :user_id
              AND read_at IS NULL
              AND completed_at IS NULL
              AND sent_at <= :cutoff
              AND sent_at >= :window_start
            """,
            {"user_id": user_id, "cutoff": ignore_cutoff, "window_start": window_start},
        )
        return int(result or 0)
    except Exception:
        return 0


async def update_user_streak(
    db,
    user_id: int,
    *,
    timezone_label: Optional[str] = None,
    now_utc: Optional[datetime] = None,
) -> Optional[Dict[str, Any]]:
    """Update user's streak based on local date. Returns updated streak info."""
    from backend.database import users

    record = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not record:
        return None

    row = dict(record)
    current_count = int(row.get("streak_count") or 0)
    last_date_value = row.get("streak_last_date")
    tz_label = timezone_label or row.get("personalization_time_zone")

    now = now_utc or utcnow()
    today_key = _local_date_key(now, tz_label)

    if isinstance(last_date_value, datetime):
        last_date_str = last_date_value.date().isoformat()
    else:
        last_date_str = str(last_date_value) if last_date_value else None

    if last_date_str == today_key:
        return {
            "streak_count": current_count,
            "streak_last_date": last_date_str,
        }

    today_date = _parse_date_key(today_key)
    last_date = _parse_date_key(last_date_str)

    if last_date and today_date and last_date == (today_date - timedelta(days=1)):
        next_count = max(1, current_count + 1)
    else:
        next_count = 1

    await db.execute(
        users.update()
        .where(users.c.id == user_id)
        .values(
            streak_count=next_count,
            streak_last_date=today_key,
            updated_at=utcnow(),
        )
    )

    return {
        "streak_count": next_count,
        "streak_last_date": today_key,
    }
