"""
Dashboard pulse helper functions.

Extracted from main.py to improve modularity.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import databases

# Import serialization helpers
try:
    from backend.core.serializers import (
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
    )
    from backend.core.env_helpers import datetime_to_ms
except ImportError:
    from core.serializers import (  # type: ignore
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
    )
    from core.env_helpers import datetime_to_ms  # type: ignore


# ==============================================================================
# Serialization
# ==============================================================================


def serialize_dashboard_pulse_record(record: Any) -> Optional[Dict[str, Any]]:
    """Serialize a dashboard pulse database record to a dictionary."""
    if not record:
        return None
    plans = normalize_plan_items(record["plans"])
    habits = normalize_habit_items(record["habits"])
    proactivity = normalize_proactivity(record["proactivity"])
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


# ==============================================================================
# Dashboard Entry Carry-Forward
# ==============================================================================


def carry_forward_dashboard_entries(
    previous: Optional[Dict[str, Any]],
    plans: List[Dict[str, Any]],
    habits: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Carry forward incomplete plans and habits from previous day's dashboard."""
    if not previous:
        return plans, habits

    carry_plans = list(plans)
    carry_habits = list(habits)

    existing_plan_ids = {item["id"] for item in carry_plans}
    existing_plan_labels = {item["label"].lower() for item in carry_plans}

    for entry in previous.get("plans", []):
        if entry.get("completed"):
            continue
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        if identifier and identifier in existing_plan_ids:
            continue
        if label.lower() in existing_plan_labels:
            continue
        carry_plans.append(
            {
                "id": identifier or f"plan-{uuid4().hex[:8]}",
                "label": label,
                "completed": False,
            }
        )
        if identifier:
            existing_plan_ids.add(identifier)
        existing_plan_labels.add(label.lower())

    existing_habit_ids = {item["id"] for item in carry_habits}
    for entry in previous.get("habits", []):
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        if identifier and identifier in existing_habit_ids:
            continue
        carry_habits.append(
            {
                "id": identifier or f"habit-{uuid4().hex[:8]}",
                "label": label,
                "previous_label": str(entry.get("previous_label") or ""),
                "completed": False,
            }
        )
        if identifier:
            existing_habit_ids.add(identifier)

    return carry_plans, carry_habits


# ==============================================================================
# Database Loading
# ==============================================================================


async def load_dashboard_pulse_by_date(
    db: databases.Database,
    user_id: int,
    date_key: str,
    dashboard_pulses_table: Any,
) -> Optional[Any]:
    """Load a dashboard pulse for a specific date."""
    query = (
        dashboard_pulses_table.select()
        .where(
            (dashboard_pulses_table.c.user_id == user_id)
            & (dashboard_pulses_table.c.date_key == date_key)
        )
        .limit(1)
    )
    return await db.fetch_one(query)


async def load_previous_dashboard_pulse(
    db: databases.Database,
    user_id: int,
    date_key: str,
    dashboard_pulses_table: Any,
) -> Optional[Any]:
    """Load the most recent dashboard pulse before the given date."""
    query = (
        dashboard_pulses_table.select()
        .where(
            (dashboard_pulses_table.c.user_id == user_id)
            & (dashboard_pulses_table.c.date_key < date_key)
        )
        .order_by(dashboard_pulses_table.c.date_key.desc())
        .limit(1)
    )
    return await db.fetch_one(query)


# ==============================================================================
# Date Coercion
# ==============================================================================


def coerce_activity_day(value: Any) -> Optional[date]:
    """Coerce a value to a date object for activity tracking."""
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        try:
            parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.strptime(candidate.split(".")[0], "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                return None
        return parsed.date()
    return None


# Backwards compatibility aliases
_serialize_dashboard_pulse_record = serialize_dashboard_pulse_record
_carry_forward_dashboard_entries = carry_forward_dashboard_entries
_load_dashboard_pulse_by_date = load_dashboard_pulse_by_date
_load_previous_dashboard_pulse = load_previous_dashboard_pulse
_coerce_activity_day = coerce_activity_day
