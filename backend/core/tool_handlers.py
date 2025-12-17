"""
Tool handler functions for AI-invoked operations.

This module contains handlers for calendar, habit, plan, and reminder tool calls
that are invoked by the AI during chat interactions.
"""
from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import databases
from fastapi import HTTPException

# Import from core modules
try:
    from backend.time_utils import utcnow
except ImportError:
    from time_utils import utcnow  # type: ignore

try:
    from backend.database import calendar_events, plans, habits, reminders
except ImportError:
    from database import calendar_events, plans, habits, reminders  # type: ignore

try:
    from backend.logging_config import create_logger
except ImportError:
    from logging_config import create_logger  # type: ignore

api_logger = create_logger("backend.api")

# Will be set by main.py to avoid circular imports
reminder_scheduler = None


def set_reminder_scheduler(scheduler: Any) -> None:
    """Set the reminder scheduler instance (called from main.py)."""
    global reminder_scheduler
    reminder_scheduler = scheduler


# ==============================================================================
# Date Parsing Utilities
# ==============================================================================


def parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO 8601 datetime string, handling 'Z' suffix."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def normalize_remind_at(remind_at: Optional[datetime]) -> Optional[datetime]:
    """Normalize remind_at to naive UTC datetime for storage."""
    if remind_at is None:
        return None
    if remind_at.tzinfo is None:
        return remind_at
    return remind_at.astimezone(timezone.utc).replace(tzinfo=None)


def parse_remind_at(value: Any) -> Optional[datetime]:
    """Parse and normalize a remind_at value from various formats."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return normalize_remind_at(value)
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        try:
            parsed = parse_iso_datetime(trimmed)
        except Exception:
            return None
        return normalize_remind_at(parsed)
    return None


# ==============================================================================
# Reminder Payload Builder
# ==============================================================================


def build_reminder_payload(
    reminder: Dict[str, Any], user_id: int, status: str, entity: str = "plan"
) -> Dict[str, Any]:
    """Build a gray.reminder payload compatible with the frontend."""
    reminder_id = reminder.get("id")
    label = reminder.get("label", "Reminder")
    remind_at = reminder.get("remind_at") or reminder.get("deadline")
    
    time_iso = None
    if remind_at:
        if isinstance(remind_at, datetime):
            if remind_at.tzinfo is None:
                remind_at = remind_at.replace(tzinfo=timezone.utc)
            time_iso = remind_at.isoformat()
        elif isinstance(remind_at, str):
            time_iso = remind_at
    
    # Convert datetime objects in raw data to strings for JSON safety
    safe_raw = {}
    for k, v in reminder.items():
        if isinstance(v, (datetime, date)):
            safe_raw[k] = v.isoformat()
        else:
            safe_raw[k] = v

    return {
        "type": "gray.reminder",
        "source": "native/backend",
        "status": status,
        "entity": entity,
        "delivery_mode": reminder.get("delivery_mode", entity),
        "data": {
            "id": reminder_id,
            "user_id": user_id,
            "label": label,
            "time_iso": time_iso,
            "raw": safe_raw,
        },
    }


# ==============================================================================
# Calendar Event Tools
# ==============================================================================


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


# ==============================================================================
# Plan Tools
# ==============================================================================


async def list_plans_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """List plans for a user."""
    limit = args.get("limit")
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"plans": [dict(row) for row in rows]}


async def create_plan_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    upsert_entity_reminder_fn: Any,
) -> Dict[str, Any]:
    """Create a new plan."""
    label = args.get("label")
    if not label:
        return {"error": "label is required"}

    reminder_at = parse_remind_at(args.get("reminder_at"))

    base_values = {
        "user_id": user_id,
        "label": label,
        "completed": False,
        "deadline": args.get("deadline"),
        "schedule_slot": args.get("schedule_slot"),
        "description": args.get("description"),
        "color": args.get("color"),
    }

    now = utcnow()
    plan_id = await db.execute(
        plans.insert().values(**base_values, created_at=now, updated_at=now)
    )
    created = await db.fetch_one(plans.select().where(plans.c.id == plan_id))

    if created and reminder_at is not None:
        record = dict(created)
        color = record.get("color")
        metadata = {"color": color} if color else None
        await upsert_entity_reminder_fn(
            user_id=user_id,
            entity_type="plan",
            entity_id=int(plan_id),
            label=str(record.get("label") or label),
            description=record.get("description"),
            remind_at=reminder_at,
            metadata=metadata,
            color=color,
            db=db,
        )
    return build_reminder_payload(dict(created), user_id, "created", entity="plan")


async def update_plan_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    upsert_entity_reminder_fn: Any,
) -> Dict[str, Any]:
    """Update an existing plan."""
    plan_id = args.get("plan_id")
    if not plan_id:
        return {"error": "plan_id is required"}

    reminder_at_provided = "reminder_at" in args
    reminder_at = parse_remind_at(args.get("reminder_at")) if reminder_at_provided else None

    updates = {}
    if "label" in args:
        updates["label"] = args["label"]
    if "description" in args:
        updates["description"] = args["description"]
    if "completed" in args:
        updates["completed"] = args["completed"]
    if "deadline" in args:
        updates["deadline"] = args["deadline"]
    if "schedule_slot" in args:
        updates["schedule_slot"] = args["schedule_slot"]
    if "color" in args:
        updates["color"] = args["color"]

    if not updates and not reminder_at_provided:
        return {"status": "no_changes", "message": "No updates provided."}

    check_query = plans.select().where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Plan not found or access denied."}

    updates["updated_at"] = utcnow()
    if updates:
        query = plans.update().where(plans.c.id == plan_id).values(**updates)
        await db.execute(query)

    if reminder_at_provided:
        updated = await db.fetch_one(plans.select().where(plans.c.id == plan_id))
        record = dict(updated) if updated else dict(existing)
        color = record.get("color")
        metadata = {"color": color} if color else None
        await upsert_entity_reminder_fn(
            user_id=user_id,
            entity_type="plan",
            entity_id=int(plan_id),
            label=str(record.get("label") or ""),
            description=record.get("description"),
            remind_at=reminder_at,
            metadata=metadata,
            color=color,
            db=db,
        )
    return {"status": "success", "message": "Plan updated."}


async def delete_plan_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    delete_all_entity_reminders_fn: Any,
) -> Dict[str, Any]:
    """Delete a plan."""
    plan_id = args.get("plan_id")
    if not plan_id:
        return {"error": "plan_id is required"}

    check_query = plans.select().where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Plan not found or access denied."}

    await delete_all_entity_reminders_fn(
        user_id=user_id, entity_type="plan", entity_id=int(plan_id), db=db
    )
    query = plans.delete().where(plans.c.id == plan_id)
    await db.execute(query)
    return {"status": "success", "message": "Plan deleted."}


# ==============================================================================
# Habit Tools
# ==============================================================================


def serialize_habit_record(record: Any) -> Dict[str, Any]:
    """Ensure habits always have string labels for response models."""
    if record is None:
        return {}
    if not isinstance(record, dict):
        try:
            record = dict(record)
        except Exception:
            return {}

    def _as_str(value: Any) -> str:
        return "" if value is None else str(value)

    return {
        "id": record.get("id"),
        "user_id": record.get("user_id"),
        "label": _as_str(record.get("label")),
        "previous_label": _as_str(record.get("previous_label")),
        "description": record.get("description"),
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
    }


async def list_habits_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """List habits for a user."""
    limit = args.get("limit")
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"habits": [serialize_habit_record(row) for row in rows]}


async def create_habit_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    upsert_entity_reminder_fn: Any,
) -> Dict[str, Any]:
    """Create a new habit."""
    label = args.get("label")
    if not label:
        return {"error": "label is required"}

    reminder_at = parse_remind_at(args.get("reminder_at"))

    now = utcnow()
    base_values = {
        "user_id": user_id,
        "label": str(label),
        "description": args.get("description"),
        "previous_label": args.get("previous_label") or "",
    }

    habit_id = await db.execute(
        habits.insert().values(**base_values, created_at=now, updated_at=now)
    )
    created = await db.fetch_one(habits.select().where(habits.c.id == habit_id))

    if created and reminder_at is not None:
        record = dict(created)
        await upsert_entity_reminder_fn(
            user_id=user_id,
            entity_type="habit",
            entity_id=int(habit_id),
            label=str(record.get("label") or str(label)),
            description=record.get("description"),
            remind_at=reminder_at,
            metadata=None,
            color=None,
            db=db,
        )
    return build_reminder_payload(dict(created), user_id, "created", entity="habit")


async def update_habit_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    upsert_entity_reminder_fn: Any,
) -> Dict[str, Any]:
    """Update an existing habit."""
    habit_id = args.get("habit_id")
    if not habit_id:
        return {"error": "habit_id is required"}

    reminder_at_provided = "reminder_at" in args
    reminder_at = parse_remind_at(args.get("reminder_at")) if reminder_at_provided else None

    updates = {}
    if "label" in args:
        updates["label"] = args["label"]
    if "description" in args:
        updates["description"] = args["description"]

    if not updates and not reminder_at_provided:
        return {"status": "no_change", "message": "No updates provided."}

    now = utcnow()
    updates["updated_at"] = now
    existing = await db.fetch_one(
        habits.select().where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
    )
    if not existing:
        return {"error": "Habit not found or access denied."}

    if updates:
        await db.execute(
            habits.update()
            .where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
            .values(**updates)
        )

    if reminder_at_provided:
        updated = await db.fetch_one(habits.select().where(habits.c.id == habit_id))
        record = dict(updated) if updated else dict(existing)
        await upsert_entity_reminder_fn(
            user_id=user_id,
            entity_type="habit",
            entity_id=int(habit_id),
            label=str(record.get("label") or ""),
            description=record.get("description"),
            remind_at=reminder_at,
            metadata=None,
            color=None,
            db=db,
        )
    return {"status": "success", "message": f"Habit {habit_id} updated."}


async def delete_habit_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    delete_all_entity_reminders_fn: Any,
) -> Dict[str, Any]:
    """Delete a habit."""
    habit_id = args.get("habit_id")
    if not habit_id:
        return {"error": "habit_id is required"}

    await delete_all_entity_reminders_fn(
        user_id=user_id, entity_type="habit", entity_id=int(habit_id), db=db
    )
    await db.execute(
        habits.delete().where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
    )
    return {"status": "success", "message": f"Habit {habit_id} deleted."}


# ==============================================================================
# Reminder Tools
# ==============================================================================


def serialize_reminder_row(row: Any) -> Dict[str, Any]:
    """Serialize a reminder row to a dictionary with ISO formatted dates."""
    if not row:
        return {}
    result = dict(row)
    for key in ("remind_at", "created_at", "updated_at", "delivered_at"):
        if key in result and isinstance(result[key], datetime):
            result[key] = result[key].isoformat()
    return result


async def list_reminders_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """List reminders for a user."""
    status_filter = args.get("status")
    limit = args.get("limit")
    delivery_mode = args.get("delivery_mode")
    entity_type = args.get("entity_type")
    include_archived = bool(args.get("include_archived"))

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
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"reminders": [serialize_reminder_row(row) for row in rows]}


async def create_reminder_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Create a new reminder."""
    global reminder_scheduler
    
    label = args.get("label")
    remind_at_str = args.get("remind_at")
    description = args.get("description")

    if not label or not remind_at_str:
        raise HTTPException(status_code=400, detail="label and remind_at are required")

    try:
        remind_at_dt = parse_iso_datetime(str(remind_at_str))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid remind_at format, use ISO 8601.")

    now = utcnow()
    local_payload = {
        "user_id": user_id,
        "label": label,
        "description": description,
        "status": "pending",
        "delivery_mode": "reminder",
        "entity_type": "plan",
        "remind_at": remind_at_dt,
        "created_at": now,
        "updated_at": now,
    }
    query = reminders.insert().values(**local_payload)
    created_id = await db.execute(query)
    created = await db.fetch_one(reminders.select().where(reminders.c.id == created_id))

    try:
        if reminder_scheduler:
            await reminder_scheduler.refresh_job(
                user_id=user_id, reminder_id=int(created_id), remind_at=remind_at_dt
            )
    except Exception as exc:
        api_logger.warning(
            "Failed to schedule reminder job",
            extra={
                "event_type": "reminder_schedule_failed",
                "user_id": user_id,
                "reminder_id": created_id,
                "error": str(exc),
            },
        )
    return build_reminder_payload(dict(created), user_id, "created")


async def update_reminder_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Update an existing reminder."""
    global reminder_scheduler
    
    reminder_id = args.get("reminder_id")
    if not reminder_id:
        raise HTTPException(status_code=400, detail="reminder_id is required")

    updates = {}
    if "label" in args:
        updates["label"] = args["label"]
    if "description" in args:
        updates["description"] = args["description"]
    if "status" in args:
        updates["status"] = args["status"]
    if "remind_at" in args:
        try:
            updates["remind_at"] = parse_iso_datetime(args["remind_at"])
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid remind_at format")

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    query = (
        reminders.update()
        .where(reminders.c.id == reminder_id)
        .where(reminders.c.user_id == user_id)
        .values(**updates)
    )
    await db.execute(query)
    updated = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id))
    if not updated:
        raise HTTPException(status_code=404, detail="Reminder not found")

    try:
        if reminder_scheduler:
            normalized_status = (dict(updated).get("status") or "").strip().lower()
            if normalized_status != "pending":
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=int(reminder_id))
            else:
                await reminder_scheduler.refresh_job(
                    user_id=user_id,
                    reminder_id=int(reminder_id),
                    remind_at=dict(updated).get("remind_at"),
                )
    except Exception as exc:
        api_logger.warning(
            "Failed to reschedule reminder job",
            extra={
                "event_type": "reminder_reschedule_failed",
                "user_id": user_id,
                "reminder_id": reminder_id,
                "error": str(exc),
            },
        )
    return build_reminder_payload(dict(updated), user_id, "updated")


async def delete_reminder_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Delete a reminder."""
    global reminder_scheduler
    
    reminder_id = args.get("reminder_id")
    if not reminder_id:
        raise HTTPException(status_code=400, detail="reminder_id is required")

    reminder = await db.fetch_one(
        reminders.select()
        .where(reminders.c.id == reminder_id)
        .where(reminders.c.user_id == user_id)
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    try:
        if reminder_scheduler:
            await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=int(reminder_id))
    except Exception:
        pass

    query = (
        reminders.delete()
        .where(reminders.c.id == reminder_id)
        .where(reminders.c.user_id == user_id)
    )
    await db.execute(query)
    return build_reminder_payload(dict(reminder), user_id, "deleted")


async def delete_latest_reminder_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Delete the most recent reminder, optionally filtering by label/time."""
    global reminder_scheduler
    
    label_substring = (args.get("label_substring") or "").strip()
    remind_before = args.get("remind_before")
    remind_after = args.get("remind_after")
    status_filter = (args.get("status") or "").strip()
    delete_all = args.get("delete_all", False)

    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return parse_iso_datetime(value)
        except (ValueError, TypeError):
            return None

    before_dt = _parse_dt(remind_before)
    after_dt = _parse_dt(remind_after)

    query = reminders.select().where(reminders.c.user_id == user_id)

    if label_substring:
        query = query.where(reminders.c.label.ilike(f"%{label_substring}%"))
    if before_dt:
        query = query.where(reminders.c.remind_at <= before_dt)
    if after_dt:
        query = query.where(reminders.c.remind_at >= after_dt)
    if status_filter:
        query = query.where(reminders.c.status == status_filter)
    else:
        query = query.where(reminders.c.status.in_(["pending", "delivered"]))

    query = query.order_by(reminders.c.created_at.desc(), reminders.c.id.desc())
    if not delete_all:
        query = query.limit(1)

    records = await db.fetch_all(query)
    if not records:
        raise HTTPException(status_code=404, detail="No matching reminder found to delete.")

    deleted_messages = []
    for record in records:
        rid = record["id"]
        reminder_label = record.get("label")
        reminder_time = record.get("remind_at")

        try:
            if reminder_scheduler:
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=int(rid))
        except Exception:
            pass

        await db.execute(
            reminders.delete().where((reminders.c.id == rid) & (reminders.c.user_id == user_id))
        )

        summary_parts = [f"Deleted reminder {rid}"]
        if reminder_label:
            summary_parts.append(f'"{reminder_label}"')
        if isinstance(reminder_time, datetime):
            summary_parts.append(f"at {reminder_time.isoformat()}")
        deleted_messages.append(" ".join(summary_parts))

    if delete_all:
        return {"status": "success", "message": f"Deleted {len(records)} reminder(s)", "details": deleted_messages}
    return {"status": "success", "message": deleted_messages[0]}


# ==============================================================================
# Workspace State Tool
# ==============================================================================


async def get_workspace_state_tool(
    user_id: int, args: Dict[str, Any], db: databases.Database
) -> Dict[str, Any]:
    """Get combined workspace state including plans, habits, and reminders."""
    plan_limit = args.get("plan_limit")
    habit_limit = args.get("habit_limit")
    reminder_limit = args.get("reminder_limit")
    include_archived_reminders = bool(args.get("include_archived_reminders"))

    plans_payload = await list_plans_tool(user_id, {"limit": plan_limit}, db)
    habits_payload = await list_habits_tool(user_id, {"limit": habit_limit}, db)
    reminders_payload = await list_reminders_tool(
        user_id, {"limit": reminder_limit, "include_archived": include_archived_reminders}, db
    )

    plans_list = plans_payload.get("plans") or []
    habits_list = habits_payload.get("habits") or []
    reminders_list = reminders_payload.get("reminders") or []
    pending_reminders = [
        r for r in reminders_list if str(r.get("status", "")).lower() == "pending"
    ]

    summary_parts = [
        f"{len(plans_list)} plans",
        f"{len(habits_list)} habits",
        f"{len(reminders_list)} reminders ({len(pending_reminders)} pending)",
    ]

    return {
        "summary": " | ".join(summary_parts),
        "plans": plans_list,
        "habits": habits_list,
        "reminders": reminders_list,
    }


# ==============================================================================
# Maps Tool Builder
# ==============================================================================


def build_maps_tool_and_config(
    maps_enabled: bool,
    maps_latitude: Optional[float],
    maps_longitude: Optional[float],
    maps_widget: bool,
) -> Tuple[List[Any], Optional[Any]]:
    """Build Google Maps tool and config for Gemini.
    
    Args:
        maps_enabled: Whether maps functionality is enabled
        maps_latitude: User's latitude coordinate
        maps_longitude: User's longitude coordinate
        maps_widget: Whether to enable the widget
        
    Returns:
        Tuple of (tools_list, tool_config) for Gemini API
    """
    if not maps_enabled:
        return [], None

    try:
        from google.genai import types
    except ImportError:
        return [], None

    tool = types.Tool(
        google_maps=types.GoogleMaps(enable_widget=maps_widget)
    )

    retrieval_config = None
    if maps_latitude is not None and maps_longitude is not None:
        retrieval_config = types.RetrievalConfig(
            lat_lng=types.LatLng(latitude=maps_latitude, longitude=maps_longitude)
        )

    tool_config = types.ToolConfig(
        retrieval_config=retrieval_config,
        function_calling_config=types.FunctionCallingConfig(
            mode=types.FunctionCallingConfigMode.NONE
        ),
    )

    return [tool], tool_config
