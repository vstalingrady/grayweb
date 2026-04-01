"""
Calendar and Calendar Events API routes.

This router handles CRUD operations for calendars and calendar events.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, status

# Import models
from backend.models import (
    Calendar, CalendarCreate, CalendarUpdate,
    CalendarEvent, CalendarEventCreate, CalendarEventUpdate,
)

# Import dependencies
from backend.database import calendars, calendar_events, habits, get_database
from backend.auth import get_current_user, require_same_user
from backend.time_utils import utcnow
try:
    from backend.compat_imports import row_get as _row_get
except ImportError:  # Fallback when compat bundle isn't available yet.
    from backend.core.serializers import row_get as _row_get

router = APIRouter(tags=["calendars"])


def _get_reminder_helpers():
    """Lazy import reminder helpers to avoid circular imports."""
    from backend.core.entity_reminders import (
        get_pending_entity_reminder_map,
        upsert_entity_reminder,
        delete_all_entity_reminders,
    )
    return (
        get_pending_entity_reminder_map,
        upsert_entity_reminder,
        delete_all_entity_reminders,
    )


def _resolve_event_reminder_at(
    start_time: Optional[datetime],
    reminder_at: Optional[datetime],
    reminder_minutes_before: Optional[int],
) -> Optional[datetime]:
    if reminder_minutes_before is not None:
        if reminder_minutes_before < 0:
            return None
        if not start_time:
            return None
        return start_time - timedelta(minutes=reminder_minutes_before)
    return reminder_at


def _as_utc_aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _serialize_calendar_event_record(
    record: Dict[str, Any],
    *,
    reminder_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    payload = dict(record)
    for field in ("start_time", "end_time", "created_at"):
        payload[field] = _as_utc_aware(payload.get(field))
    payload["reminder_at"] = _as_utc_aware(reminder_at if reminder_at is not None else payload.get("reminder_at"))
    return payload


def _require_calendar_access(current_user: Dict[str, Any]) -> None:
    return None


def _validate_event_time_range(start_time: datetime, end_time: datetime) -> None:
    normalized_start = (
        start_time.astimezone(timezone.utc)
        if start_time.tzinfo is not None
        else start_time.replace(tzinfo=timezone.utc)
    )
    normalized_end = (
        end_time.astimezone(timezone.utc)
        if end_time.tzinfo is not None
        else end_time.replace(tzinfo=timezone.utc)
    )
    if normalized_end < normalized_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be greater than or equal to start_time.",
        )


def _validate_reminder_minutes_before(reminder_minutes_before: Optional[int]) -> None:
    if reminder_minutes_before is not None and reminder_minutes_before < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reminder_minutes_before must be non-negative.",
        )


async def _ensure_calendar_owned_by_user(
    db: databases.Database,
    *,
    user_id: int,
    calendar_id: Optional[int],
) -> None:
    if calendar_id is None:
        return
    calendar_row = await db.fetch_one(
        calendars.select().where(
            (calendars.c.id == calendar_id) & (calendars.c.user_id == user_id)
        )
    )
    if not calendar_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="calendar_id must reference one of the user's calendars.",
        )


async def _ensure_habit_owned_by_user(
    db: databases.Database,
    *,
    user_id: int,
    habit_id: Optional[int],
) -> None:
    if habit_id is None:
        return
    habit_row = await db.fetch_one(
        habits.select().where(
            (habits.c.id == habit_id) & (habits.c.user_id == user_id)
        )
    )
    if not habit_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="habit_id must reference one of the user's habits.",
        )


# ==================== CALENDARS ====================

@router.get("/users/{user_id}/calendars", response_model=List[Calendar])
async def get_user_calendars(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    query = calendars.select().where(calendars.c.user_id == user_id).order_by(calendars.c.created_at.desc())
    return await db.fetch_all(query)


@router.post("/users/{user_id}/calendars", response_model=Calendar, status_code=status.HTTP_201_CREATED)
async def create_calendar(
    user_id: int,
    calendar: CalendarCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    now = utcnow()
    calendar_id = await db.execute(
        calendars.insert().values(
            user_id=user_id,
            label=calendar.label,
            color=calendar.color,
            is_visible=calendar.is_visible,
            created_at=now,
            updated_at=now,
        )
    )
    query = calendars.select().where(calendars.c.id == calendar_id)
    return await db.fetch_one(query)


@router.patch("/users/{user_id}/calendars/{calendar_id}", response_model=Calendar)
async def update_calendar(
    user_id: int,
    calendar_id: int,
    calendar_update: CalendarUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    existing = await db.fetch_one(
        calendars.select().where(
            (calendars.c.id == calendar_id) & (calendars.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Calendar not found")

    update_data = calendar_update.dict(exclude_unset=True)
    if not update_data:
        return existing

    update_data["updated_at"] = utcnow()

    await db.execute(
        calendars.update()
        .where((calendars.c.id == calendar_id) & (calendars.c.user_id == user_id))
        .values(**update_data)
    )
    query = calendars.select().where(calendars.c.id == calendar_id)
    return await db.fetch_one(query)


# ==================== CALENDAR EVENTS ====================

@router.get("/users/{user_id}/calendar-events", response_model=List[CalendarEvent])
async def get_user_calendar_events(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    
    query = calendar_events.select().where(calendar_events.c.user_id == user_id)
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.where(calendar_events.c.start_time >= start_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.where(calendar_events.c.end_time <= end_dt)
        except ValueError:
            pass

    query = query.order_by(calendar_events.c.start_time)
    rows = await db.fetch_all(query)
    now = utcnow()
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
    ) = _get_reminder_helpers()
    
    normalized = []
    event_ids = [int(row["id"]) for row in rows]
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="event",
        entity_ids=event_ids,
        db=db,
    )
    
    for row in rows:
        record = dict(row)
        if _row_get(record, "created_at") is None:
            record["created_at"] = now
        normalized.append(
            _serialize_calendar_event_record(
                record,
                reminder_at=reminder_map.get(int(record["id"])),
            )
        )
    return normalized


@router.post("/users/{user_id}/calendar-events", response_model=CalendarEvent, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    user_id: int,
    event: CalendarEventCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    _validate_event_time_range(event.start_time, event.end_time)
    _validate_reminder_minutes_before(event.reminder_minutes_before)
    await _ensure_calendar_owned_by_user(db, user_id=user_id, calendar_id=event.calendar_id)
    await _ensure_habit_owned_by_user(db, user_id=user_id, habit_id=event.habit_id)
    now = utcnow()
    resolved_reminder_at = _resolve_event_reminder_at(
        event.start_time,
        event.reminder_at,
        event.reminder_minutes_before,
    )
    event_id = await db.execute(
        calendar_events.insert().values(
            user_id=user_id,
            calendar_id=event.calendar_id,
            title=event.title,
            description=event.description,
            start_time=event.start_time,
            end_time=event.end_time,
            color=event.color,
            reminder_minutes_before=event.reminder_minutes_before,
            entry_type=event.entry_type,
            is_completed=event.is_completed,
            recurrence=event.recurrence,
            habit_id=event.habit_id,
            reminder_at=resolved_reminder_at,
            created_at=now,
        )
    )
    
    if resolved_reminder_at:
        (
            _,
            _upsert_entity_reminder,
            _,
        ) = _get_reminder_helpers()
        await _upsert_entity_reminder(
            user_id=user_id,
            entity_type="event",
            entity_id=int(event_id),
            label=event.title,
            description=event.description,
            remind_at=resolved_reminder_at,
            metadata=None,
            color=event.color,
            db=db,
        )

    query = calendar_events.select().where(calendar_events.c.id == event_id)
    result = await db.fetch_one(query)
    if result is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create event")
    return _serialize_calendar_event_record(dict(result), reminder_at=resolved_reminder_at)


@router.patch("/users/{user_id}/calendar-events/{event_id}", response_model=CalendarEvent)
async def update_calendar_event(
    user_id: int,
    event_id: int,
    event_update: CalendarEventUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    update_data = event_update.model_dump(exclude_unset=True)

    sqlite_update_data: Dict[str, Any] = {}
    if update_data:
        allowed_sqlite_keys = set(calendar_events.c.keys())
        sqlite_update_data = {
            key: value for key, value in update_data.items() if key in allowed_sqlite_keys
        }

    existing = await db.fetch_one(
        calendar_events.select().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    proposed_start_time = update_data.get("start_time", _row_get(existing, "start_time"))
    proposed_end_time = update_data.get("end_time", _row_get(existing, "end_time"))

    # If only start_time changes, preserve the original event duration by
    # shifting end_time by the same delta.
    existing_start_time = _row_get(existing, "start_time")
    existing_end_time = _row_get(existing, "end_time")
    if (
        "start_time" in update_data
        and "end_time" not in update_data
        and isinstance(proposed_start_time, datetime)
        and isinstance(existing_start_time, datetime)
        and isinstance(existing_end_time, datetime)
    ):
        normalized_existing_start = (
            existing_start_time.astimezone(timezone.utc)
            if existing_start_time.tzinfo is not None
            else existing_start_time.replace(tzinfo=timezone.utc)
        )
        normalized_existing_end = (
            existing_end_time.astimezone(timezone.utc)
            if existing_end_time.tzinfo is not None
            else existing_end_time.replace(tzinfo=timezone.utc)
        )
        normalized_proposed_start = (
            proposed_start_time.astimezone(timezone.utc)
            if proposed_start_time.tzinfo is not None
            else proposed_start_time.replace(tzinfo=timezone.utc)
        )
        duration = normalized_existing_end - normalized_existing_start
        proposed_end_time = normalized_proposed_start + duration
        update_data["end_time"] = proposed_end_time
        sqlite_update_data["end_time"] = proposed_end_time

    if isinstance(proposed_start_time, datetime) and isinstance(proposed_end_time, datetime):
        _validate_event_time_range(proposed_start_time, proposed_end_time)

    _validate_reminder_minutes_before(update_data.get("reminder_minutes_before"))
    if "calendar_id" in update_data:
        await _ensure_calendar_owned_by_user(
            db,
            user_id=user_id,
            calendar_id=update_data.get("calendar_id"),
        )
    if "habit_id" in update_data:
        await _ensure_habit_owned_by_user(
            db,
            user_id=user_id,
            habit_id=update_data.get("habit_id"),
        )

    if not sqlite_update_data and "reminder_at" not in update_data:
        return existing

    if sqlite_update_data:
        editable_keys = {
            "title",
            "description",
            "start_time",
            "end_time",
            "calendar_id",
            "color",
            "reminder_minutes_before",
            "entry_type",
            "is_completed",
            "recurrence",
            "habit_id",
            "reminder_at",
        }
        sqlite_update_data = {
            key: value for key, value in sqlite_update_data.items() if key in editable_keys
        }
        # If caller explicitly sets/clears reminder_at, treat it as authoritative.
        if "reminder_at" in update_data and "reminder_minutes_before" not in update_data:
            sqlite_update_data["reminder_minutes_before"] = None

        await db.execute(
            calendar_events.update()
            .where((calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id))
            .values(**sqlite_update_data)
        )
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _,
    ) = _get_reminder_helpers()

    should_resolve_reminder = any(
        key in update_data for key in ("reminder_at", "reminder_minutes_before", "start_time")
    )
    should_refresh_reminder_copy = any(
        key in update_data for key in ("title", "description", "color")
    )

    if should_resolve_reminder or should_refresh_reminder_copy:
        recent = await db.fetch_one(calendar_events.select().where(calendar_events.c.id == event_id))
        if recent is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
        rec_dict = dict(recent)

        pending_reminder_map = await _get_pending_entity_reminder_map(
            user_id=user_id,
            entity_type="event",
            entity_ids=[event_id],
            db=db,
        )
        resolved_reminder_at = pending_reminder_map.get(event_id)

        if should_resolve_reminder:
            # Resolve from the persisted row to avoid clearing existing absolute reminders
            # when only start_time changes.
            if "reminder_at" in update_data:
                resolved_reminder_at = rec_dict.get("reminder_at")
            else:
                resolved_reminder_at = _resolve_event_reminder_at(
                    rec_dict.get("start_time"),
                    rec_dict.get("reminder_at"),
                    rec_dict.get("reminder_minutes_before"),
                )
                await db.execute(
                    calendar_events.update()
                    .where((calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id))
                    .values(reminder_at=resolved_reminder_at)
                )

        # Keep reminder payload (label/description/color) in sync on event edits
        # whenever an active reminder exists or reminder timing changed.
        if resolved_reminder_at is not None or should_resolve_reminder:
            await _upsert_entity_reminder(
                user_id=user_id,
                entity_type="event",
                entity_id=event_id,
                label=rec_dict.get("title", ""),
                description=rec_dict.get("description"),
                remind_at=resolved_reminder_at,
                metadata=None,
                color=rec_dict.get("color"),
                db=db,
            )

    query = calendar_events.select().where(calendar_events.c.id == event_id)
    updated = await db.fetch_one(query)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    
    res_payload = dict(updated)
    rem_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="event",
        entity_ids=[event_id],
        db=db,
    )
    return _serialize_calendar_event_record(
        res_payload,
        reminder_at=rem_map.get(event_id),
    )


@router.delete("/users/{user_id}/calendar-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    user_id: int,
    event_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    _require_calendar_access(current_user)
    existing = await db.fetch_one(
        calendar_events.select().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    (
        _,
        _,
        _delete_all_entity_reminders,
    ) = _get_reminder_helpers()
    
    await _delete_all_entity_reminders(
        user_id=user_id,
        entity_type="event",
        entity_id=event_id,
        db=db,
    )

    await db.execute(
        calendar_events.delete().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    return None
