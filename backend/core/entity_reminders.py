"""
Entity reminder management functions.

This module handles the relationship between entities (plans, habits) and their
associated reminders, including CRUD operations and scheduler integration.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
import databases

# Import from core modules
from backend.time_utils import utcnow

from backend.database import reminders

from backend.logging_config import create_logger

from backend.core.tool_utils import normalize_remind_at

api_logger = create_logger("backend.api")

# Will be set by main.py to avoid circular imports
reminder_scheduler = None


def set_reminder_scheduler(scheduler: Any) -> None:
    """Set the reminder scheduler instance (called from main.py)."""
    global reminder_scheduler
    reminder_scheduler = scheduler


async def get_pending_entity_reminder_map(
    *,
    user_id: int,
    entity_type: str,
    entity_ids: List[int],
    db: databases.Database,
) -> Dict[int, datetime]:
    """Get a map of entity_id -> remind_at for pending reminders."""
    if not entity_ids:
        return {}

    rows = await db.fetch_all(
        reminders.select()
        .where(
            (reminders.c.user_id == user_id)
            & (reminders.c.entity_type == entity_type)
            & (reminders.c.entity_id.in_(entity_ids))
            & (reminders.c.status == "pending")
        )
        .order_by(reminders.c.entity_id.asc(), reminders.c.created_at.desc(), reminders.c.id.desc())
    )

    reminder_map: Dict[int, datetime] = {}
    for row in rows:
        raw_entity_id = row.get("entity_id")
        if raw_entity_id is None:
            continue
        try:
            entity_id = int(raw_entity_id)
        except Exception:
            continue
        if entity_id in reminder_map:
            continue
        remind_at = row.get("remind_at")
        if isinstance(remind_at, datetime):
            reminder_map[entity_id] = remind_at
    return reminder_map


async def delete_pending_entity_reminders(
    *,
    user_id: int,
    entity_type: str,
    entity_id: int,
    db: databases.Database,
) -> None:
    """Delete all pending reminders for a specific entity."""
    global reminder_scheduler
    
    rows = await db.fetch_all(
        reminders.select().where(
            (reminders.c.user_id == user_id)
            & (reminders.c.entity_type == entity_type)
            & (reminders.c.entity_id == entity_id)
            & (reminders.c.status == "pending")
        )
    )
    if not rows:
        return

    for row in rows:
        reminder_id = int(row["id"])
        try:
            if reminder_scheduler:
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=reminder_id)
        except Exception:
            pass
        await db.execute(
            reminders.delete().where(
                (reminders.c.id == reminder_id) & (reminders.c.user_id == user_id)
            )
        )


async def delete_all_entity_reminders(
    *,
    user_id: int,
    entity_type: str,
    entity_id: int,
    db: databases.Database,
) -> None:
    """Delete all reminders (pending and delivered) for a specific entity."""
    global reminder_scheduler
    
    rows = await db.fetch_all(
        reminders.select().where(
            (reminders.c.user_id == user_id)
            & (reminders.c.entity_type == entity_type)
            & (reminders.c.entity_id == entity_id)
        )
    )
    if not rows:
        return

    for row in rows:
        reminder_id = int(row["id"])
        try:
            if reminder_scheduler:
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=reminder_id)
        except Exception:
            pass
        await db.execute(
            reminders.delete().where(
                (reminders.c.id == reminder_id) & (reminders.c.user_id == user_id)
            )
        )


async def upsert_entity_reminder(
    *,
    user_id: int,
    entity_type: str,
    entity_id: int,
    label: str,
    description: Optional[str],
    remind_at: Optional[datetime],
    metadata: Optional[Dict[str, Any]],
    color: Optional[str],
    db: databases.Database,
) -> Optional[int]:
    """Create or update a reminder for an entity (plan/habit)."""
    global reminder_scheduler
    
    normalized_remind_at = normalize_remind_at(remind_at)
    if normalized_remind_at is None:
        await delete_pending_entity_reminders(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            db=db,
        )
        return None

    existing_pending = await db.fetch_one(
        reminders.select()
        .where(
            (reminders.c.user_id == user_id)
            & (reminders.c.entity_type == entity_type)
            & (reminders.c.entity_id == entity_id)
            & (reminders.c.status == "pending")
        )
        .order_by(reminders.c.created_at.desc(), reminders.c.id.desc())
        .limit(1)
    )

    now = utcnow()
    base_values: Dict[str, Any] = {
        "label": label,
        "description": description,
        "summary": description,
        "remind_at": normalized_remind_at,
        "delivery_mode": entity_type,
        "metadata": metadata,
        "color": color,
        "updated_at": now,
    }

    if existing_pending:
        reminder_id = int(existing_pending["id"])
        await db.execute(
            reminders.update()
            .where((reminders.c.id == reminder_id) & (reminders.c.user_id == user_id))
            .values(**base_values)
        )
        try:
            if reminder_scheduler:
                await reminder_scheduler.refresh_job(
                    user_id=user_id,
                    reminder_id=reminder_id,
                    remind_at=normalized_remind_at,
                )
        except Exception as exc:
            api_logger.warning(
                "Failed to reschedule entity reminder",
                extra={
                    "event_type": "entity_reminder_reschedule_failed",
                    "user_id": user_id,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "reminder_id": reminder_id,
                    "error": str(exc),
                },
            )
        return reminder_id

    existing_delivered = await db.fetch_one(
        reminders.select()
        .where(
            (reminders.c.user_id == user_id)
            & (reminders.c.entity_type == entity_type)
            & (reminders.c.entity_id == entity_id)
            & (reminders.c.status == "delivered")
        )
        .order_by(reminders.c.created_at.desc(), reminders.c.id.desc())
        .limit(1)
    )

    # If the latest reminder already fired and the requested time is still in the past,
    # avoid re-creating a new pending reminder
    if existing_delivered and normalized_remind_at <= now:
        reminder_id = int(existing_delivered["id"])
        await db.execute(
            reminders.update()
            .where((reminders.c.id == reminder_id) & (reminders.c.user_id == user_id))
            .values(
                label=label,
                description=description,
                summary=description,
                metadata=metadata,
                color=color,
                updated_at=now,
            )
        )
        return reminder_id

    insert_values: Dict[str, Any] = {
        "user_id": user_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "status": "pending",
        "created_at": now,
        **base_values,
    }
    reminder_id = await db.execute(reminders.insert().values(**insert_values))
    try:
        if reminder_scheduler:
            await reminder_scheduler.refresh_job(
                user_id=user_id,
                reminder_id=int(reminder_id),
                remind_at=normalized_remind_at,
            )
    except Exception as exc:
        api_logger.warning(
            "Failed to schedule entity reminder",
            extra={
                "event_type": "entity_reminder_schedule_failed",
                "user_id": user_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "reminder_id": reminder_id,
                "error": str(exc),
            },
        )
    return int(reminder_id)
