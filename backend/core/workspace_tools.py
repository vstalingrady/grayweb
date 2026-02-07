"""
Workspace tool handlers for plans and reminders.

Extracted from main.py to improve modularity.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

import databases
from fastapi import HTTPException

# Import database tables
from backend.database import plans, reminders

# Import shared utilities
from backend.core.serializers import (
    serialize_reminder_row as _serialize_reminder_row,
    row_get as _row_get,
)
from backend.core.tool_utils import (
    build_reminder_payload as _build_reminder_payload,
    parse_remind_at as _parse_remind_at,
    parse_iso_datetime as _parse_iso_datetime,
)
from backend.core.entity_reminders import (
    upsert_entity_reminder as _upsert_entity_reminder,
    delete_all_entity_reminders as _delete_all_entity_reminders,
)

from backend.time_utils import utcnow
from backend.logging_config import create_logger

api_logger = create_logger("backend.api")
HABITS_DISABLED_DETAIL = "Habits feature has been removed. This tool is no longer available."

# Reference to reminder scheduler - set by main.py
reminder_scheduler = None

def set_reminder_scheduler(scheduler) -> None:
    """Set the reminder scheduler reference for job management."""
    global reminder_scheduler
    reminder_scheduler = scheduler


# --- Plan Tools ---

async def list_plans_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    limit = args.get("limit")
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"plans": [dict(row) for row in rows]}


async def create_plan_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    label = args.get("label")
    if not label:
        return {"error": "label is required"}

    reminder_at = _parse_remind_at(args.get("reminder_at"))
    
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
    plan_id = await db.execute(plans.insert().values(**base_values, created_at=now, updated_at=now))
    created = await db.fetch_one(plans.select().where(plans.c.id == plan_id))

    if created and reminder_at is not None:
        record = dict(created)
        color = _row_get(record, "color")
        metadata = {"color": color} if color else None
        await _upsert_entity_reminder(
            user_id=user_id, entity_type="plan", entity_id=int(plan_id),
            label=str(_row_get(record, "label") or label), description=_row_get(record, "description"),
            remind_at=reminder_at, metadata=metadata, color=color, db=db,
        )
    return _build_reminder_payload(dict(created), user_id, "created", entity="plan")


async def update_plan_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    plan_id = args.get("plan_id")
    if not plan_id:
        return {"error": "plan_id is required"}

    reminder_at_provided = "reminder_at" in args
    reminder_at = _parse_remind_at(args.get("reminder_at")) if reminder_at_provided else None
        
    updates = {}
    for key in ["label", "description", "completed", "deadline", "schedule_slot", "color"]:
        if key in args:
            updates[key] = args[key]
        
    if not updates and not reminder_at_provided:
        return {"status": "no_changes", "message": "No updates provided."}
        
    check_query = plans.select().where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Plan not found or access denied."}

    updates["updated_at"] = utcnow()
    await db.execute(plans.update().where(plans.c.id == plan_id).values(**updates))

    if reminder_at_provided:
        updated = await db.fetch_one(plans.select().where(plans.c.id == plan_id))
        record = dict(updated) if updated else dict(existing)
        color = _row_get(record, "color")
        metadata = {"color": color} if color else None
        await _upsert_entity_reminder(
            user_id=user_id, entity_type="plan", entity_id=int(plan_id),
            label=str(_row_get(record, "label") or ""), description=_row_get(record, "description"),
            remind_at=reminder_at, metadata=metadata, color=color, db=db,
        )
    return {"status": "success", "message": "Plan updated."}


async def delete_plan_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    plan_id = args.get("plan_id")
    if not plan_id:
        return {"error": "plan_id is required"}
        
    check_query = plans.select().where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Plan not found or access denied."}

    await _delete_all_entity_reminders(user_id=user_id, entity_type="plan", entity_id=int(plan_id), db=db)
    await db.execute(plans.delete().where(plans.c.id == plan_id))
    return {"status": "success", "message": "Plan deleted."}


# --- Habit Tools ---

async def list_habits_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    raise HTTPException(status_code=410, detail=HABITS_DISABLED_DETAIL)


async def create_habit_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    raise HTTPException(status_code=410, detail=HABITS_DISABLED_DETAIL)


async def update_habit_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    raise HTTPException(status_code=410, detail=HABITS_DISABLED_DETAIL)


async def delete_habit_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    raise HTTPException(status_code=410, detail=HABITS_DISABLED_DETAIL)


# --- Reminder Tools ---

async def list_reminders_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
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
    return {"reminders": [_serialize_reminder_row(row) for row in rows]}


async def create_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    label = args.get("label")
    remind_at_str = args.get("remind_at")
    description = args.get("description")
    
    if not label or not remind_at_str:
        raise HTTPException(status_code=400, detail="label and remind_at are required")
    
    try:
        remind_at_dt = datetime.fromisoformat(str(remind_at_str).replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid remind_at format, use ISO 8601.")
    
    now = utcnow()
    local_payload = {
        "user_id": user_id, "label": label, "description": description,
        "status": "pending", "delivery_mode": "reminder", "entity_type": "plan",
        "remind_at": remind_at_dt, "created_at": now, "updated_at": now,
    }
    created_id = await db.execute(reminders.insert().values(**local_payload))
    created = await db.fetch_one(reminders.select().where(reminders.c.id == created_id))
    
    try:
        global reminder_scheduler
        if reminder_scheduler:
            await reminder_scheduler.refresh_job(user_id=user_id, reminder_id=int(created_id), remind_at=remind_at_dt)
    except Exception as exc:
        api_logger.warning("Failed to schedule reminder job", extra={"user_id": user_id, "reminder_id": created_id, "error": str(exc)})
    return _build_reminder_payload(dict(created), user_id, "created")


async def update_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    reminder_id = args.get("reminder_id")
    if not reminder_id:
        raise HTTPException(status_code=400, detail="reminder_id is required")
    
    updates = {}
    for key in ["label", "description", "status"]:
        if key in args:
            updates[key] = args[key]
    if "remind_at" in args:
        try:
            updates["remind_at"] = datetime.fromisoformat(args["remind_at"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid remind_at format")
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.execute(reminders.update().where(reminders.c.id == reminder_id).where(reminders.c.user_id == user_id).values(**updates))
    updated = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id))
    if not updated:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    try:
        global reminder_scheduler
        if reminder_scheduler:
            status = (dict(updated).get("status") or "").strip().lower()
            if status != "pending":
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=int(reminder_id))
            else:
                await reminder_scheduler.refresh_job(user_id=user_id, reminder_id=int(reminder_id), remind_at=dict(updated).get("remind_at"))
    except Exception as exc:
        api_logger.warning("Failed to reschedule reminder job", extra={"user_id": user_id, "reminder_id": reminder_id, "error": str(exc)})
    return _build_reminder_payload(dict(updated), user_id, "updated")


async def delete_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    reminder_id = args.get("reminder_id")
    if not reminder_id:
        raise HTTPException(status_code=400, detail="reminder_id is required")
    
    reminder = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id).where(reminders.c.user_id == user_id))
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    try:
        global reminder_scheduler
        if reminder_scheduler:
            await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=int(reminder_id))
    except Exception as exc:
        api_logger.warning(
            "Failed to cancel reminder job during deletion",
            extra={"user_id": user_id, "reminder_id": reminder_id, "error": str(exc)}
        )
    
    await db.execute(reminders.delete().where(reminders.c.id == reminder_id).where(reminders.c.user_id == user_id))
    return _build_reminder_payload(dict(reminder), user_id, "deleted")


async def delete_latest_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    """Delete the most recent reminder, optionally filtering by label/time/status."""
    label_substring = (args.get("label_substring") or "").strip()
    remind_before = args.get("remind_before")
    remind_after = args.get("remind_after")
    status_filter = (args.get("status") or "").strip()
    delete_all = args.get("delete_all", False)

    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

    query = reminders.select().where(reminders.c.user_id == user_id)
    if label_substring:
        query = query.where(reminders.c.label.ilike(f"%{label_substring}%"))
    if (before_dt := _parse_dt(remind_before)):
        query = query.where(reminders.c.remind_at <= before_dt)
    if (after_dt := _parse_dt(remind_after)):
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
        rid, rlabel, rtime = record["id"], _row_get(record, "label"), _row_get(record, "remind_at")
        try:
            global reminder_scheduler
            if reminder_scheduler:
                await reminder_scheduler.cancel_job(user_id=user_id, reminder_id=int(rid))
        except Exception as exc:
            api_logger.warning(
                "Failed to cancel reminder job during batch deletion",
                extra={"user_id": user_id, "reminder_id": rid, "error": str(exc)}
            )
        await db.execute(reminders.delete().where((reminders.c.id == rid) & (reminders.c.user_id == user_id)))
        parts = [f"Deleted reminder {rid}"]
        if rlabel:
            parts.append(f'"{rlabel}"')
        if isinstance(rtime, datetime):
            parts.append(f"at {rtime.isoformat()}")
        deleted_messages.append(" ".join(parts))

    if delete_all:
        return {"status": "success", "message": f"Deleted {len(records)} reminder(s)", "details": deleted_messages}
    return {"status": "success", "message": deleted_messages[0]}


# --- Workspace State Tool ---

async def get_workspace_state_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    plan_limit = args.get("plan_limit")
    reminder_limit = args.get("reminder_limit")
    include_archived = bool(args.get("include_archived_reminders"))

    plans_payload = await list_plans_tool(user_id, {"limit": plan_limit}, db)
    reminders_payload = await list_reminders_tool(user_id, {"limit": reminder_limit, "include_archived": include_archived}, db)

    plans_list = plans_payload.get("plans") or []
    reminders_list = reminders_payload.get("reminders") or []
    pending = [r for r in reminders_list if str(r.get("status", "")).lower() == "pending"]

    return {
        "summary": f"{len(plans_list)} plans | {len(reminders_list)} reminders ({len(pending)} pending)",
        "plans": plans_list,
        "reminders": reminders_list,
    }
