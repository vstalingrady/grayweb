"""Calendar management tools for AI-invoked operations.

Extracted from tool_handlers.py to improve modularity.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import databases

from backend.time_utils import utcnow
from backend.database import calendar_events
from backend.logging_config import create_logger
from backend.core.tool_utils import parse_iso_datetime

api_logger = create_logger("backend.api")

async def list_calendar_events(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """List calendar events for a user within a date range."""
    start_str = args.get("start_date")
    end_str = args.get("end_date")
    calendar_id = args.get("calendar_id")

    if start_str:
        try:
            start_date = parse_iso_datetime(start_str)
        except ValueError:
            return {"error": "Invalid start_date format. Use ISO 8601."}
    else:
        start_date = utcnow()

    if end_str:
        try:
            end_date = parse_iso_datetime(end_str)
        except ValueError:
            return {"error": "Invalid end_date format. Use ISO 8601."}
    else:
        end_date = start_date + timedelta(days=7)

    query = calendar_events.select().where(
        (calendar_events.c.user_id == user_id)
        & (calendar_events.c.start_time >= start_date)
        & (calendar_events.c.start_time <= end_date)
    )

    if calendar_id:
        query = query.where(calendar_events.c.calendar_id == calendar_id)

    query = query.order_by(calendar_events.c.start_time.asc())
    rows = await db.fetch_all(query)

    events = []
    for row in rows:
        events.append({
            "id": row["id"],
            "title": row["title"],
            "start": row["start_time"].isoformat() if row["start_time"] else None,
            "end": row["end_time"].isoformat() if row["end_time"] else None,
            "description": row["description"],
            "calendar_id": row["calendar_id"],
        })

    return {"events": events}

async def create_calendar_event(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Create a new calendar event."""
    title = args.get("title")
    start_str = args.get("start_time")
    end_str = args.get("end_time")
    description = args.get("description")
    calendar_id = args.get("calendar_id")
    color = args.get("color")

    if not title or not start_str or not end_str:
        return {"error": "Missing required fields: title, start_time, end_time"}

    try:
        start_time = parse_iso_datetime(start_str)
        end_time = parse_iso_datetime(end_str)
    except ValueError:
        return {"error": "Invalid date format. Use ISO 8601."}

    query = calendar_events.insert().values(
        user_id=user_id,
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        calendar_id=calendar_id,
        color=color,
        created_at=utcnow(),
    )
    event_id = await db.execute(query)
    return {"status": "success", "event_id": event_id, "message": f"Event '{title}' created."}

async def update_calendar_event(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Update an existing calendar event."""
    event_id = args.get("event_id")
    if not event_id:
        return {"error": "event_id is required"}

    updates = {}
    if "title" in args:
        updates["title"] = args["title"]
    if "description" in args:
        updates["description"] = args["description"]
    if "start_time" in args:
        try:
            updates["start_time"] = parse_iso_datetime(args["start_time"])
        except ValueError:
            return {"error": "Invalid start_time format."}
    if "end_time" in args:
        try:
            updates["end_time"] = parse_iso_datetime(args["end_time"])
        except ValueError:
            return {"error": "Invalid end_time format."}
    if "calendar_id" in args:
        updates["calendar_id"] = args["calendar_id"]
    if "color" in args:
        updates["color"] = args["color"]

    if not updates:
        return {"status": "no_changes", "message": "No updates provided."}

    # Verify ownership
    check_query = calendar_events.select().where(
        (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
    )
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Event not found or access denied."}

    query = calendar_events.update().where(calendar_events.c.id == event_id).values(**updates)
    await db.execute(query)
    return {"status": "success", "message": "Event updated."}

async def delete_calendar_event(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Delete a calendar event."""
    event_id = args.get("event_id")
    if not event_id:
        return {"error": "event_id is required"}

    # Verify ownership
    check_query = calendar_events.select().where(
        (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
    )
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Event not found or access denied."}

    query = calendar_events.delete().where(calendar_events.c.id == event_id)
    await db.execute(query)
    return {"status": "success", "message": "Event deleted."}
