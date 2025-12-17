"""Reminder action helpers.

Functions for enriching and persisting reminder-style actions from AI responses.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import databases

# Lazy imports
_tables = None
_utcnow_fn = None
_ensure_datetime_fn = None
_serialize_reminder_fn = None
_logger = None


def _get_tables():
    global _tables
    if _tables is None:
        try:
            from backend.database import plans, reminders
        except ImportError:
            from database import plans, reminders
        _tables = {"plans": plans, "reminders": reminders}
    return _tables


def _get_utcnow():
    global _utcnow_fn
    if _utcnow_fn is None:
        try:
            from backend.time_utils import utcnow
        except ImportError:
            from time_utils import utcnow
        _utcnow_fn = utcnow
    return _utcnow_fn


def _get_ensure_datetime():
    global _ensure_datetime_fn
    if _ensure_datetime_fn is None:
        try:
            from backend.core.env_helpers import _ensure_datetime_value
        except ImportError:
            from core.env_helpers import _ensure_datetime_value
        _ensure_datetime_fn = _ensure_datetime_value
    return _ensure_datetime_fn


def _get_serialize_reminder():
    global _serialize_reminder_fn
    if _serialize_reminder_fn is None:
        try:
            from backend.core.tool_handlers import serialize_reminder_row
        except ImportError:
            from core.tool_handlers import serialize_reminder_row
        _serialize_reminder_fn = serialize_reminder_row
    return _serialize_reminder_fn


def _get_logger():
    global _logger
    if _logger is None:
        try:
            from backend.logging_config import create_logger
        except ImportError:
            from logging_config import create_logger
        _logger = create_logger("backend.api")
    return _logger


async def maybe_enrich_actions_with_reminder_time(
    actions: List[Dict[str, Any]],
    message: str,
    time_context: str,
) -> None:
    """Enrich reminder actions with time_iso when model provides relative timing."""
    _ensure_datetime_value = _get_ensure_datetime()
    utcnow = _get_utcnow()
    
    base_time: datetime
    match = re.search(r"ISO timestamp:\s*([0-9T:\.\-:+Z]+)", time_context or "")
    if match:
        base_time = _ensure_datetime_value(match.group(1)) or utcnow()
    else:
        base_time = utcnow()

    normalized_message = (message or "").lower()
    relative_match = re.search(
        r"\bin\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b",
        normalized_message,
    )

    delta: Optional[timedelta] = None
    if relative_match:
        amount = int(relative_match.group(1))
        unit = relative_match.group(2)
        if unit.startswith("hour") or unit.startswith("hr"):
            delta = timedelta(hours=amount)
        else:
            delta = timedelta(minutes=amount)

    if not delta:
        return

    target_time = base_time + delta
    iso_value = target_time.replace(tzinfo=timezone.utc).isoformat()

    for action in actions:
        if not action.get("time_iso"):
            action["time_iso"] = iso_value
        if not action.get("description"):
            action["description"] = message.strip() or action.get("label") or "Reminder"


async def create_reminders_from_actions(
    db: "databases.Database",
    user_id: int,
    actions: List[Dict[str, Any]],
    reminder_scheduler: Any = None,
) -> List[Dict[str, Any]]:
    """Persist reminder actions into the database."""
    tables = _get_tables()
    plans = tables["plans"]
    reminders = tables["reminders"]
    utcnow = _get_utcnow()
    _ensure_datetime_value = _get_ensure_datetime()
    _serialize_reminder_row = _get_serialize_reminder()
    api_logger = _get_logger()
    
    results: List[Dict[str, Any]] = []
    now = utcnow()

    for action in actions:
        label = (action.get("label") or "Reminder").strip()
        entity = (action.get("entity") or "plan").strip().lower()
        time_iso = action.get("time_iso")
        remind_at = _ensure_datetime_value(time_iso)
        if remind_at is None:
            continue

        description = action.get("description")
        schedule_slot = action.get("schedule_slot")

        existing_reminder = await db.fetch_one(
            reminders.select()
            .where(
                (reminders.c.user_id == user_id)
                & (reminders.c.label == label)
                & (reminders.c.entity_type == entity)
            )
            .order_by(reminders.c.created_at.desc(), reminders.c.id.desc())
        )

        if existing_reminder:
            existing_record = dict(existing_reminder)
            reminder_id = existing_record["id"]
            plan_id = existing_record.get("entity_id")

            if plan_id is None:
                plan_id = await db.execute(
                    plans.insert().values(
                        user_id=user_id, label=label, completed=False,
                        deadline=time_iso, schedule_slot=schedule_slot,
                        description=description, created_at=now, updated_at=now,
                    )
                )

            await db.execute(
                reminders.update()
                .where((reminders.c.id == reminder_id) & (reminders.c.user_id == user_id))
                .values(remind_at=remind_at, description=description,
                        entity_type=entity, entity_id=plan_id, updated_at=now)
            )

            await db.execute(
                plans.update()
                .where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
                .values(deadline=time_iso, updated_at=now)
            )

            row = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id))
            try:
                if reminder_scheduler is not None:
                    await reminder_scheduler.refresh_job(
                        user_id=user_id, reminder_id=int(reminder_id), remind_at=remind_at)
            except Exception as exc:
                api_logger.warning("Failed to reschedule reminder job",
                    extra={"event_type": "reminder_schedule_failed", "user_id": user_id,
                           "reminder_id": reminder_id, "error": str(exc)})
            results.append({"operation": "rescheduled",
                            "reminder": _serialize_reminder_row(row) if row else None})
        else:
            plan_id = await db.execute(
                plans.insert().values(
                    user_id=user_id, label=label, completed=False,
                    deadline=time_iso, schedule_slot=schedule_slot,
                    description=description, created_at=now, updated_at=now,
                )
            )

            reminder_id = await db.execute(
                reminders.insert().values(
                    user_id=user_id, entity_type=entity, entity_id=plan_id,
                    delivery_mode="plan", label=label, description=description,
                    summary=description, remind_at=remind_at, status="pending",
                    metadata=None, created_at=now, updated_at=now, delivered_at=None,
                )
            )
            row = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id))
            try:
                if reminder_scheduler is not None:
                    await reminder_scheduler.refresh_job(
                        user_id=user_id, reminder_id=int(reminder_id), remind_at=remind_at)
            except Exception as exc:
                api_logger.warning("Failed to schedule reminder job",
                    extra={"event_type": "reminder_schedule_failed", "user_id": user_id,
                           "reminder_id": reminder_id, "error": str(exc)})
            results.append({"operation": "created",
                            "reminder": _serialize_reminder_row(row) if row else None})

    return results
