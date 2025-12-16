"""
Calendar and Calendar Events API routes.

This router handles CRUD operations for calendars and calendar events.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, status

# Import models
from backend.models import (
    Calendar, CalendarCreate, CalendarUpdate,
    CalendarEvent, CalendarEventCreate, CalendarEventUpdate,
)

# Import dependencies
from backend.database import calendars, calendar_events, get_database
from backend.auth import get_current_user, require_same_user
from backend.time_utils import utcnow

router = APIRouter(tags=["calendars"])


# ==================== CALENDARS ====================

@router.get("/users/{user_id}/calendars", response_model=List[Calendar])
async def get_user_calendars(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
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
    normalized = []
    for row in rows:
        record = dict(row)
        if record.get("created_at") is None:
            record["created_at"] = now
        normalized.append(record)
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
    now = utcnow()
    event_id = await db.execute(
        calendar_events.insert().values(
            user_id=user_id,
            calendar_id=event.calendar_id,
            title=event.title,
            description=event.description,
            start_time=event.start_time,
            end_time=event.end_time,
            color=event.color,
            created_at=now,
        )
    )
    query = calendar_events.select().where(calendar_events.c.id == event_id)
    return await db.fetch_one(query)


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
    update_data = event_update.dict(exclude_unset=True)

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

    if not sqlite_update_data:
        return existing

    await db.execute(
        calendar_events.update()
        .where((calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id))
        .values(**sqlite_update_data)
    )
    query = calendar_events.select().where(calendar_events.c.id == event_id)
    updated = await db.fetch_one(query)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    return updated


@router.delete("/users/{user_id}/calendar-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    user_id: int,
    event_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    existing = await db.fetch_one(
        calendar_events.select().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    await db.execute(
        calendar_events.delete().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    return None
