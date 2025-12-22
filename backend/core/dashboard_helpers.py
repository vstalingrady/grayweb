"""Dashboard helper functions and serializers.

Extracted from main.py to handle dashboard-specific logic and data normalization.
"""
from __future__ import annotations

import json
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from backend.core.serializers import normalize_proactivity as _normalize_proactivity_settings
from backend.core.serializers import row_get as _row_get

# Lazy utilities
def _get_utcnow():
    from backend.time_utils import utcnow
    return utcnow

def _timestamp_ms_to_datetime(ms: Optional[int]) -> Optional[datetime]:
    """Convert a millisecond timestamp to a datetime object."""
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000.0)
    except (OSError, OverflowError, ValueError):
        return None

def serialize_dashboard_pulse_record(record: Any) -> Optional[Dict[str, Any]]:
    """Serialize a dashboard_pulses row to a dictionary."""
    if record is None:
        return None
    
    # Handle dict or Row object
    if not isinstance(record, dict):
        try:
            record = dict(record)
        except TypeError:
            return None

    def _parse_json(field_name: str) -> List[Any]:
        val = _row_get(record, field_name)
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return []
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            return [val]
        return []

    def _parse_json_dict(field_name: str) -> Dict[str, Any]:
        val = _row_get(record, field_name)
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return {}
        if isinstance(val, dict):
            return val
        return {}

    proactivity_raw = _parse_json_dict("proactivity")
    proactivity_payload = normalize_proactivity(proactivity_raw)

    return {
        "id": _row_get(record, "id"),
        "user_id": _row_get(record, "user_id"),
        "date_key": _row_get(record, "date_key"),
        "timestamp": _row_get(record, "timestamp"),
        "plans": _parse_json("plans"),
        "habits": _parse_json("habits"),
        "proactivity": proactivity_payload,
        "created_at": _row_get(record, "created_at"),
        "updated_at": _row_get(record, "updated_at"),
    }

async def load_dashboard_pulse_by_date(db: Any, user_id: int, date_key: str) -> Any:
    """Load a dashboard pulse by user and date."""
    from backend.database import dashboard_pulses
        
    query = dashboard_pulses.select().where(
        (dashboard_pulses.c.user_id == user_id) & (dashboard_pulses.c.date_key == date_key)
    )
    return await db.fetch_one(query)

async def load_previous_dashboard_pulse(db: Any, user_id: int, current_date_key: str) -> Any:
    """Load the most recent dashboard pulse before the given date."""
    from backend.database import dashboard_pulses

    query = (
        dashboard_pulses.select()
        .where(
            (dashboard_pulses.c.user_id == user_id) & (dashboard_pulses.c.date_key < current_date_key)
        )
        .order_by(dashboard_pulses.c.date_key.desc())
        .limit(1)
    )
    return await db.fetch_one(query)

def normalize_plan_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure plan items have required fields for JSON storage."""
    normalized = []
    for item in items:
        normalized.append({
            "id": _row_get(item, "id"),
            "label": str(_row_get(item, "label", "")),
            "completed": bool(_row_get(item, "completed", False)),
            "deadline": _row_get(item, "deadline"),
        })
    return normalized

def normalize_habit_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure habit items have required fields for JSON storage."""
    normalized = []
    for item in items:
        normalized.append({
            "id": _row_get(item, "id"),
            "label": str(_row_get(item, "label", "")),
            "streak": int(_row_get(item, "streak", 0)),
        })
    return normalized

def normalize_proactivity(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure proactivity settings have required fields for JSON storage."""
    return _normalize_proactivity_settings(data)

def carry_forward_dashboard_entries(
    previous: Dict[str, Any], current_plans: List[Dict[str, Any]], current_habits: List[Dict[str, Any]]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Merge uncompleted items from previous day into current lists."""
    # Logic to merge entries (carry forward uncompleted)
    merged_plans = list(current_plans)
    existing_plan_ids = {_row_get(p, "id") for p in merged_plans if _row_get(p, "id")}
    
    for prev_plan in (_row_get(previous, "plans") or []):
        if not _row_get(prev_plan, "completed") and _row_get(prev_plan, "id") not in existing_plan_ids:
            # Carry forward uncompleted plans
            merged_plans.append(prev_plan)
            
    # Habits are usually ongoing, so we might just keep the current list or update streaks
    return merged_plans, current_habits
