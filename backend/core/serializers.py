"""
Serialization and normalization utilities for backend data.

This module provides helpers for serializing database rows and normalizing
data structures for API responses.
"""
import json
from collections.abc import Mapping
from datetime import datetime, date, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ==============================================================================
# Row Access Helpers
# ==============================================================================


def row_get(row: Any, key: str, default: Any = None) -> Any:
    """Safely retrieve a column from SQLAlchemy Row objects, dictionaries, or Pydantic models."""
    if row is None:
        return default
    
    # 1. Try dictionary-like .get() if available
    getter = getattr(row, "get", None)
    if callable(getter):
        try:
            return getter(key, default)
        except Exception:
            pass

    # 2. Try _mapping (SQLAlchemy/Databases)
    mapping = getattr(row, "_mapping", None)
    if mapping is not None and hasattr(mapping, "get"):
        return mapping.get(key, default)

    # 3. Try indexing
    try:
        return row[key]
    except (KeyError, TypeError, IndexError):
        pass

    # 4. Try getattr
    return getattr(row, key, default)


def parse_json_field(value: Optional[str]) -> Optional[Dict[str, Any]]:
    """Parse a JSON string field, returning None on failure."""
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


# ==============================================================================
# Datetime Helpers
# ==============================================================================


def timestamp_ms_to_datetime(timestamp_ms: Optional[int]) -> Optional[datetime]:
    """Convert a millisecond timestamp to datetime."""
    if timestamp_ms is None:
        return None
    try:
        return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    except (ValueError, OSError):
        return None


def datetime_to_ms(value: Optional[datetime]) -> Optional[int]:
    """Convert a datetime to millisecond timestamp."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)
    return None


def parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 timestamp string."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def datetime_to_iso(value: Any) -> Optional[str]:
    """Convert a datetime to ISO string, handling None and strings."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, str):
        return value
    return None


# ==============================================================================
# Record Serializers
# ==============================================================================


def serialize_reminder_row(row: Any) -> Dict[str, Any]:
    """Serialize a reminder row to a dictionary with ISO formatted dates."""
    if not row:
        return {}
    
    # Handle both dict and Row/mapping
    if hasattr(row, "_mapping"):
        record = dict(row._mapping)
    elif isinstance(row, Mapping):
        record = dict(row)
    else:
        try:
            record = dict(row)
        except (TypeError, ValueError):
            return {}

    for key in ("remind_at", "created_at", "updated_at", "delivered_at"):
        value = row_get(row, key)
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            record[key] = value.isoformat()
    return record


def serialize_calendar_event(row: Any) -> Dict[str, Any]:
    """Serialize a calendar event row to a dictionary."""
    if not row:
        return {}
    
    # Handle both dict and Row/mapping
    if hasattr(row, "_mapping"):
        record = dict(row._mapping)
    elif isinstance(row, Mapping):
        record = dict(row)
    else:
        try:
            record = dict(row)
        except (TypeError, ValueError):
            return {}

    return {
        "id": row_get(row, "id"),
        "title": row_get(row, "title"),
        "start": datetime_to_iso(row_get(row, "start_time")),
        "end": datetime_to_iso(row_get(row, "end_time")),
        "description": row_get(row, "description"),
        "calendar_id": row_get(row, "calendar_id"),
        "color": row_get(row, "color"),
    }


def serialize_habit_record(record: Any) -> Dict[str, Any]:
    """Ensure habits always have string labels for response models."""
    if record is None:
        return {}
    if not isinstance(record, dict):
        try:
            record = dict(record)
        except Exception:
            return {}

    def _as_str(value: Any) -> str:
        return "" if value is None else str(value)

    return {
        "id": row_get(record, "id"),
        "user_id": row_get(record, "user_id"),
        "label": _as_str(row_get(record, "label")),
        "previous_label": _as_str(row_get(record, "previous_label")),
        "description": row_get(record, "description"),
        "created_at": row_get(record, "created_at"),
        "updated_at": row_get(record, "updated_at"),
    }


def serialize_dashboard_pulse_record(
    record: Any,
    normalize_plan_items_fn: Any,
    normalize_habit_items_fn: Any,
    normalize_proactivity_fn: Any,
) -> Optional[Dict[str, Any]]:
    """Serialize a dashboard pulse record."""
    if not record:
        return None
    plans = normalize_plan_items_fn(record["plans"])
    habits = normalize_habit_items_fn(record["habits"])
    proactivity = normalize_proactivity_fn(record["proactivity"])
    timestamp_ms = datetime_to_ms(record["timestamp"])
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "date_key": record["date_key"],
        "timestamp": timestamp_ms,
        "plans": plans,
        "habits": habits,
        "proactivity": proactivity,
        "created_at": record["created_at"],
        "updated_at": record["updated_at"],
    }


def serialize_proactivity_notification(record: Any) -> Optional[Dict[str, Any]]:
    """Serialize a proactivity notification record."""
    if not record:
        return None
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "type": record["type"],
        "title": record["title"],
        "message": record["message"],
        "metadata": row_get(record, "metadata"),
        "due_at": row_get(record, "due_at"),
        "sent_at": record["sent_at"],
        "read_at": row_get(record, "read_at"),
        "completed_at": row_get(record, "completed_at"),
        "created_at": record["created_at"],
    }


def serialize_context_cache(record: Any) -> Optional[Dict[str, Any]]:
    """Serialize a context cache record."""
    if not record:
        return None
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "conversation_id": row_get(record, "conversation_id"),
        "label": row_get(record, "label"),
        "content": row_get(record, "content") or "",
        "created_at": record["created_at"],
    }


# ==============================================================================
# Normalization Functions
# ==============================================================================


def normalize_plan_items(raw: Any) -> List[Dict[str, Any]]:
    """Normalize and deduplicate plan items."""
    normalized: List[Dict[str, Any]] = []
    if not isinstance(raw, list):
        return normalized

    seen_ids: set = set()
    seen_labels: set = set()

    for entry in raw:
        if not isinstance(entry, dict):
            continue
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        dedupe_key = label.lower()
        if identifier:
            if identifier in seen_ids:
                continue
            seen_ids.add(identifier)
        elif dedupe_key in seen_labels:
            continue
        else:
            identifier = f"plan-{uuid4().hex[:8]}"
        seen_labels.add(dedupe_key)
        normalized.append({
            "id": identifier,
            "label": label,
            "completed": bool(entry.get("completed")),
        })
    return normalized


def normalize_habit_items(raw: Any) -> List[Dict[str, Any]]:
    """Normalize and deduplicate habit items."""
    normalized: List[Dict[str, Any]] = []
    if not isinstance(raw, list):
        return normalized

    seen_ids: set = set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        if identifier:
            if identifier in seen_ids:
                continue
            seen_ids.add(identifier)
        else:
            identifier = f"habit-{uuid4().hex[:8]}"
        normalized.append({
            "id": identifier,
            "label": label,
            "previous_label": str(entry.get("previous_label") or ""),
            "completed": bool(entry.get("completed")),
        })
    return normalized


# Default dashboard proactivity settings
DEFAULT_DASHBOARD_PROACTIVITY = {
    "id": "proactivity-default",
    "label": "Check-ins",
    "description": "Daily sync nudges for squad channels.",
    "cadence": "Daily",
    "time": "09:00 AM",
    "times": ["09:00 AM"],
    "channels": [],
    "timezone": None,
    "message_length": "medium",
}


def normalize_proactivity(raw: Any) -> Dict[str, Any]:
    """Normalize proactivity settings with defaults."""
    if not isinstance(raw, dict):
        raw = {}

    identifier = str(raw.get("id") or DEFAULT_DASHBOARD_PROACTIVITY["id"]).strip()
    label = str(raw.get("label") or DEFAULT_DASHBOARD_PROACTIVITY["label"]).strip()
    description = raw.get("description")
    cadence = str(raw.get("cadence") or DEFAULT_DASHBOARD_PROACTIVITY["cadence"]).strip()
    time_label = str(raw.get("time") or DEFAULT_DASHBOARD_PROACTIVITY["time"]).strip()
    times_raw = raw.get("times")
    channels_raw = raw.get("channels")
    timezone_raw = raw.get("timezone")
    message_length = str(raw.get("message_length") or DEFAULT_DASHBOARD_PROACTIVITY["message_length"]).strip().lower()
    if message_length not in {"short", "medium", "long"}:
        message_length = DEFAULT_DASHBOARD_PROACTIVITY["message_length"]

    times: List[str] = []
    if isinstance(times_raw, list):
        times = [str(entry).strip() for entry in times_raw if str(entry).strip()]
    if not times:
        times = [time_label or DEFAULT_DASHBOARD_PROACTIVITY["time"]]

    channels: List[str] = []
    if isinstance(channels_raw, list):
        channels = [str(entry).strip() for entry in channels_raw if str(entry).strip()]

    timezone = str(timezone_raw).strip() if isinstance(timezone_raw, str) and timezone_raw.strip() else None

    normalized_time = time_label or times[0] or DEFAULT_DASHBOARD_PROACTIVITY["time"]

    return {
        "id": identifier or DEFAULT_DASHBOARD_PROACTIVITY["id"],
        "label": label or DEFAULT_DASHBOARD_PROACTIVITY["label"],
        "description": (description or DEFAULT_DASHBOARD_PROACTIVITY.get("description")) or "",
        "cadence": cadence or DEFAULT_DASHBOARD_PROACTIVITY["cadence"],
        "time": normalized_time,
        "times": times,
        "channels": channels,
        "timezone": timezone,
        "message_length": message_length,
    }
