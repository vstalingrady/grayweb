"""
Reminder enrichment and creation helpers.

Extracted from main.py to improve modularity.
"""

import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import databases

# Use centralized time helper
try:
    from backend.time_utils import utcnow
except Exception:
    from time_utils import utcnow  # type: ignore

try:
    from backend.core.env_helpers import ensure_datetime_value
except ImportError:
    from core.env_helpers import ensure_datetime_value  # type: ignore

try:
    from backend.core.serializers import serialize_reminder_row
except ImportError:
    from core.serializers import serialize_reminder_row  # type: ignore

try:
    from backend.logging_config import create_logger
except ImportError:
    from logging_config import create_logger  # type: ignore

try:
    from backend.database import reminders, plans
except ImportError:
    from database import reminders, plans  # type: ignore

api_logger = create_logger("backend.api")


async def maybe_enrich_actions_with_reminder_time(
    actions: List[Dict[str, Any]],
    message: str,
    time_context: str,
) -> None:
    """
    Best-effort enrichment for reminder actions when the model only provides
    relative timing (e.g. "in 30 minutes").

    Mutates the ``actions`` list in-place, setting ``time_iso`` and ``description``
    when they are missing.
    """
    # Derive a "now" anchor from the provided time_context, falling back to UTC now.
    base_time: datetime
    match = re.search(r"ISO timestamp:\s*([0-9T:\.\-:+Z]+)", time_context or "")
    if match:
        base_time = ensure_datetime_value(match.group(1)) or utcnow()
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
        # If we cannot confidently parse a relative offset, leave actions unchanged.
        return

    target_time = base_time + delta
    iso_value = target_time.replace(tzinfo=timezone.utc).isoformat()

    for action in actions:
        # Only fill in missing times; do not overwrite explicit model outputs.
        if not action.get("time_iso"):
            action["time_iso"] = iso_value
        if not action.get("description"):
            action["description"] = message.strip() or action.get("label") or "Reminder"


async def create_reminders_from_actions(
    db: databases.Database,
    user_id: int,
    actions: List[Dict[str, Any]],
    reminder_scheduler: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Persist reminder-style actions into the local database.

    For each action:
      - Create a plan row (if one does not already exist).
      - Create a corresponding reminder row, or reschedule the latest one
        that matches the same label/entity for this user.

    Returns a list of operation payloads shaped as:
      { "operation": "created" | "rescheduled", "reminder": { ...row... } }
    """
    results: List[Dict[str, Any]] = []
    now = utcnow()

    for action in actions:
        label = (action.get("label") or "Reminder").strip()
        entity = (action.get("entity") or "plan").strip().lower()
        time_iso = action.get("time_iso")
        remind_at = ensure_datetime_value(time_iso)
        if remind_at is None:
            # If no time is available, skip this action rather than creating a broken reminder.
            continue

        description = action.get("description")
        schedule_slot = action.get("schedule_slot")

        # Find the most recent existing reminder for this user/label/entity.
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
            # `databases` returns a Record, which supports dict-style access but
            # not `.get()`. Normalize once for safe optional lookups.
            existing_record = dict(existing_reminder)
            reminder_id = existing_record["id"]
            plan_id = existing_record.get("entity_id")

            # Ensure there is an associated plan row so the dashboard can reflect the reminder.
            if plan_id is None:
                plan_id = await db.execute(
                    plans.insert().values(
                        user_id=user_id,
                        label=label,
                        completed=False,
                        deadline=time_iso,
                        schedule_slot=schedule_slot,
                        description=description,
                        created_at=now,
                        updated_at=now,
                    )
                )

            # Reschedule existing reminder and update its linkage to the plan.
            await db.execute(
                reminders.update()
                .where(
                    (reminders.c.id == reminder_id)
                    & (reminders.c.user_id == user_id)
                )
                .values(
                    remind_at=remind_at,
                    description=description,
                    entity_type=entity,
                    entity_id=plan_id,
                    updated_at=now,
                )
            )

            # Keep the plan's deadline aligned with the new reminder time.
            await db.execute(
                plans.update()
                .where(
                    (plans.c.id == plan_id)
                    & (plans.c.user_id == user_id)
                )
                .values(
                    deadline=time_iso,
                    updated_at=now,
                )
            )

            row = await db.fetch_one(
                reminders.select().where(reminders.c.id == reminder_id)
            )
            try:
                if reminder_scheduler is not None:
                    await reminder_scheduler.refresh_job(
                        user_id=user_id,
                        reminder_id=int(reminder_id),
                        remind_at=remind_at,
                    )
            except Exception as exc:  # pragma: no cover
                api_logger.warning(
                    "Failed to reschedule reminder job",
                    extra={
                        "event_type": "reminder_schedule_failed",
                        "user_id": user_id,
                        "reminder_id": reminder_id,
                        "error": str(exc),
                    },
                )
            results.append(
                {
                    "operation": "rescheduled",
                    "reminder": serialize_reminder_row(row) if row is not None else None,
                }
            )
        else:
            # Create a new plan row for this reminder.
            plan_id = await db.execute(
                plans.insert().values(
                    user_id=user_id,
                    label=label,
                    completed=False,
                    deadline=time_iso,
                    schedule_slot=schedule_slot,
                    description=description,
                    created_at=now,
                    updated_at=now,
                )
            )

            # Create the corresponding reminder row.
            reminder_id = await db.execute(
                reminders.insert().values(
                    user_id=user_id,
                    entity_type=entity,
                    entity_id=plan_id,
                    delivery_mode="plan",
                    label=label,
                    description=description,
                    summary=description,
                    remind_at=remind_at,
                    status="pending",
                    metadata=None,
                    created_at=now,
                    updated_at=now,
                    delivered_at=None,
                )
            )
            row = await db.fetch_one(
                reminders.select().where(reminders.c.id == reminder_id)
            )
            try:
                if reminder_scheduler is not None:
                    await reminder_scheduler.refresh_job(
                        user_id=user_id,
                        reminder_id=int(reminder_id),
                        remind_at=remind_at,
                    )
            except Exception as exc:  # pragma: no cover
                api_logger.warning(
                    "Failed to schedule reminder job",
                    extra={
                        "event_type": "reminder_schedule_failed",
                        "user_id": user_id,
                        "reminder_id": reminder_id,
                        "error": str(exc),
                    },
                )
            results.append(
                {
                    "operation": "created",
                    "reminder": serialize_reminder_row(row) if row is not None else None,
                }
            )

    return results
