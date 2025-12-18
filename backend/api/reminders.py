"""
Reminders API routes.

This router handles CRUD operations for reminders.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, status

# Import models
from backend.models import ReminderCreate, ReminderUpdate

# Import dependencies
from backend.database import reminders, get_database
from backend.auth import get_current_user, require_same_user
from backend.time_utils import utcnow

router = APIRouter(tags=["reminders"])


def _serialize_reminder_row(row: Any) -> Dict[str, Any]:
    """Serialize a reminder row to a dictionary with ISO formatted dates."""
    record = dict(row)
    for key in ("remind_at", "created_at", "updated_at", "delivered_at"):
        value = record.get(key)
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            record[key] = value.isoformat()
    return record


def _get_reminder_scheduler():
    """Lazy import reminder scheduler to avoid circular imports."""
    import backend.main as main_module

    return getattr(main_module, "reminder_scheduler", None)


def _get_api_logger():
    """Get a configured API logger."""
    from backend.logging_config import create_logger

    return create_logger("backend.api.reminders")


@router.get("/users/{user_id}/reminders", response_model=List[Dict[str, Any]])
async def list_user_reminders(
    user_id: int,
    limit: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = None,
    delivery_mode: Optional[str] = None,
    entity_type: Optional[str] = None,
    include_archived: bool = Query(False),
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    api_logger = _get_api_logger()
    
    try:
        query = reminders.select().where(reminders.c.user_id == user_id)

        if status_filter:
            query = query.where(reminders.c.status == status_filter)
        elif not include_archived:
            query = query.where(reminders.c.status.in_(["pending", "delivered"]))

        if delivery_mode:
            query = query.where(reminders.c.delivery_mode == delivery_mode)

        if entity_type:
            query = query.where(reminders.c.entity_type == entity_type)

        query = query.order_by(reminders.c.remind_at.asc())

        if limit is not None:
            query = query.limit(limit)

        rows = await db.fetch_all(query)
        return [_serialize_reminder_row(row) for row in rows]
    except Exception as e:
        api_logger.error(f"Failed to fetch reminders from local database: {e}", exc_info=True, extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail="Failed to fetch reminders from local database.")


@router.post(
    "/users/{user_id}/reminders",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
async def create_user_reminder(
    user_id: int,
    payload: ReminderCreate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    api_logger = _get_api_logger()
    now = utcnow()
    
    sqlite_values = {
        "user_id": user_id,
        "label": payload.label,
        "description": payload.description,
        "summary": payload.summary,
        "remind_at": payload.remind_at,
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "delivery_mode": payload.delivery_mode,
        "metadata": payload.metadata,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    reminder_id = await db.execute(reminders.insert().values(sqlite_values))
    row = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create reminder")
    
    try:
        reminder_scheduler = _get_reminder_scheduler()
        if reminder_scheduler:
            await reminder_scheduler.refresh_job(user_id=user_id, reminder_id=int(reminder_id), remind_at=payload.remind_at)
    except Exception as exc:
        api_logger.warning(
            "Failed to schedule reminder",
            extra={"event_type": "reminder_schedule_failed", "user_id": user_id, "reminder_id": reminder_id, "error": str(exc)},
        )
    return _serialize_reminder_row(row)


@router.patch("/users/{user_id}/reminders/{reminder_id}", response_model=Dict[str, Any])
async def update_user_reminder(
    user_id: int,
    reminder_id: int,
    payload: ReminderUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    api_logger = _get_api_logger()
    
    update_values: Dict[str, Any] = {}
    if payload.label is not None:
        update_values["label"] = payload.label
    if payload.description is not None:
        update_values["description"] = payload.description
    if payload.summary is not None:
        update_values["summary"] = payload.summary
    if payload.remind_at is not None:
        update_values["remind_at"] = payload.remind_at
    if payload.status is not None:
        update_values["status"] = payload.status
    if payload.delivery_mode is not None:
        update_values["delivery_mode"] = payload.delivery_mode
    if payload.metadata is not None:
        update_values["metadata"] = payload.metadata

    existing = await db.fetch_one(
        reminders.select().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    if not update_values:
        return _serialize_reminder_row(existing)

    update_values["updated_at"] = utcnow()

    await db.execute(
        reminders.update()
        .where(reminders.c.id == reminder_id, reminders.c.user_id == user_id)
        .values(**update_values)
    )
    row = await db.fetch_one(
        reminders.select().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found after update")
    
    try:
        reminder_scheduler = _get_reminder_scheduler()
        if reminder_scheduler:
            normalized_status = (update_values.get("status") or existing.get("status") or "").strip().lower()
            if normalized_status != "pending":
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=reminder_id)
            else:
                remind_at_value = update_values.get("remind_at") or existing.get("remind_at")
                if isinstance(remind_at_value, str):
                    try:
                        remind_at_value = datetime.fromisoformat(remind_at_value.replace("Z", "+00:00"))
                    except Exception:
                        remind_at_value = None
                await reminder_scheduler.refresh_job(user_id=user_id, reminder_id=reminder_id, remind_at=remind_at_value)
    except Exception as exc:
        api_logger.warning(
            "Failed to reschedule reminder",
            extra={"event_type": "reminder_reschedule_failed", "user_id": user_id, "reminder_id": reminder_id, "error": str(exc)},
        )
    return _serialize_reminder_row(row)


@router.delete(
    "/users/{user_id}/reminders/{reminder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user_reminder(
    user_id: int,
    reminder_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    api_logger = _get_api_logger()
    api_logger.info(f"DELETE reminder request: user_id={user_id}, reminder_id={reminder_id}")
    
    existing = await db.fetch_one(
        reminders.select().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    try:
        reminder_scheduler = _get_reminder_scheduler()
        if reminder_scheduler:
            await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=reminder_id)
    except Exception:
        pass

    await db.execute(
        reminders.delete().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
