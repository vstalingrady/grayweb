"""Utility functions for AI tool handlers.

Centralized helpers for date parsing, normalization, and payload building.
"""
from datetime import datetime, date, timezone
from typing import Any, Dict, Optional

try:
    from backend.time_utils import utcnow
except ImportError:
    from time_utils import utcnow  # type: ignore

def parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO 8601 datetime string, handling 'Z' suffix."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def normalize_remind_at(remind_at: Optional[datetime]) -> Optional[datetime]:
    """Normalize remind_at to naive UTC datetime for storage."""
    if remind_at is None:
        return None
    if remind_at.tzinfo is None:
        return remind_at
    return remind_at.astimezone(timezone.utc).replace(tzinfo=None)

def parse_remind_at(value: Any) -> Optional[datetime]:
    """Parse and normalize a remind_at value from various formats."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return normalize_remind_at(value)
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        try:
            parsed = parse_iso_datetime(trimmed)
        except Exception:
            return None
        return normalize_remind_at(parsed)
    return None

def build_reminder_payload(
    reminder: Dict[str, Any], user_id: int, status: str, entity: str = "plan"
) -> Dict[str, Any]:
    """Build a gray.reminder payload compatible with the frontend."""
    reminder_id = reminder.get("id")
    label = reminder.get("label", "Reminder")
    remind_at = reminder.get("remind_at") or reminder.get("deadline")
    
    time_iso = None
    if remind_at:
        if isinstance(remind_at, datetime):
            if remind_at.tzinfo is None:
                remind_at = remind_at.replace(tzinfo=timezone.utc)
            time_iso = remind_at.isoformat()
        elif isinstance(remind_at, str):
            time_iso = remind_at
    
    # Convert datetime objects in raw data to strings for JSON safety
    safe_raw = {}
    for k, v in reminder.items():
        if isinstance(v, (datetime, date)):
            safe_raw[k] = v.isoformat()
        else:
            safe_raw[k] = v

    return {
        "type": "gray.reminder",
        "source": "native/backend",
        "status": status,
        "entity": entity,
        "delivery_mode": reminder.get("delivery_mode", entity),
        "data": {
            "id": reminder_id,
            "user_id": user_id,
            "label": label,
            "time_iso": time_iso,
            "raw": safe_raw,
        },
    }
