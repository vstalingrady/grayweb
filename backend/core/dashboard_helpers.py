"""Dashboard helper functions and serializers.

Extracted from main.py to handle dashboard-specific logic and data normalization.
"""
from __future__ import annotations

import json
from datetime import datetime, date
from typing import Any, Dict, List, Optional

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
        val = record.get(field_name)
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
        val = record.get(field_name)
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return {}
        if isinstance(val, dict):
            return val
        return {}

    return {
        "id": record.get("id"),
        "user_id": record.get("user_id"),
        "date_key": record.get("date_key"),
        "timestamp": record.get("timestamp"),
        "plans": _parse_json("plans"),
        "habits": _parse_json("habits"),
        "proactivity": _parse_json_dict("proactivity"),
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
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
            "id": item.get("id"),
            "label": str(item.get("label", "")),
            "completed": bool(item.get("completed", False)),
            "deadline": item.get("deadline"),
        })
    return normalized

def normalize_habit_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure habit items have required fields for JSON storage."""
    normalized = []
    for item in items:
        normalized.append({
            "id": item.get("id"),
            "label": str(item.get("label", "")),
            "streak": int(item.get("streak", 0)),
        })
    return normalized

def normalize_proactivity(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure proactivity data has required fields for JSON storage."""
    return {
        "score": float(data.get("score", 0.0)),
        "summary": str(data.get("summary", "")),
        "notes": str(data.get("notes", "")),
    }

def carry_forward_dashboard_entries(
    previous: Dict[str, Any], current_plans: List[Dict[str, Any]], current_habits: List[Dict[str, Any]]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Merge uncompleted items from previous day into current lists."""
    # Logic to merge entries (carry forward uncompleted)
    merged_plans = list(current_plans)
    existing_plan_ids = {p.get("id") for p in merged_plans if p.get("id")}
    
    for prev_plan in previous.get("plans", []):
        if not prev_plan.get("completed") and prev_plan.get("id") not in existing_plan_ids:
            # Carry forward uncompleted plans
            merged_plans.append(prev_plan)
            
    # Habits are usually ongoing, so we might just keep the current list or update streaks
    return merged_plans, current_habits
