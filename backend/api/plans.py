"""
Plans and Habits API routes.

This router handles all CRUD operations for user plans and habits.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, status

# Import models
from backend.models import (
    Plan, PlanCreate, PlanUpdate,
    Habit, HabitCreate, HabitUpdate,
)

# Import dependencies from main module
from backend.database import plans, habits, get_database
from backend.auth import get_current_user, require_same_user
from backend.time_utils import utcnow

router = APIRouter(tags=["plans", "habits"])


# Import reminder helpers - these are defined in main.py, will be moved later
# For now, we import them at call time to avoid circular imports
def _get_reminder_helpers():
    """Lazy import reminder helpers to avoid circular imports."""
    from backend.main import (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    )
    return (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    )


# ==================== PLANS ====================

@router.get("/users/{user_id}/plans", response_model=List[Plan])
async def get_user_plans(
    user_id: int,
    limit: Optional[int] = Query(None, gt=0),
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    payload = [dict(row) for row in rows]
    plan_ids = [int(item["id"]) for item in payload if item.get("id") is not None]
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="plan",
        entity_ids=plan_ids,
        db=db,
    )
    for item in payload:
        plan_id = item.get("id")
        if plan_id is None:
            continue
        item["reminder_at"] = reminder_map.get(int(plan_id))
    return payload


@router.post("/users/{user_id}/plans", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(
    user_id: int,
    plan: PlanCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    base_values = {
        "user_id": user_id,
        "label": plan.label,
        "completed": plan.completed,
        "deadline": plan.deadline,
        "schedule_slot": plan.schedule_slot,
        "description": plan.description,
        "color": plan.color,
    }

    now = utcnow()
    plan_id = await db.execute(
        plans.insert().values(
            **base_values,
            created_at=now,
            updated_at=now,
        )
    )
    query = plans.select().where(plans.c.id == plan_id)
    created = await db.fetch_one(query)

    if created and plan.reminder_at is not None:
        record = dict(created)
        color = record.get("color")
        metadata = {"color": color} if color else None
        await _upsert_entity_reminder(
            user_id=user_id,
            entity_type="plan",
            entity_id=int(plan_id),
            label=str(record.get("label") or plan.label),
            description=record.get("description"),
            remind_at=plan.reminder_at,
            metadata=metadata,
            color=color,
            db=db,
        )

    response_payload = dict(created) if created else {}
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="plan",
        entity_ids=[int(plan_id)],
        db=db,
    )
    response_payload["reminder_at"] = reminder_map.get(int(plan_id))
    return response_payload


@router.patch("/users/{user_id}/plans/{plan_id}", response_model=Plan)
async def update_plan(
    user_id: int,
    plan_id: int,
    plan_update: PlanUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    update_data = plan_update.dict(exclude_unset=True)
    reminder_at_provided = "reminder_at" in update_data
    reminder_at_value = update_data.pop("reminder_at", None)

    existing = await db.fetch_one(
        plans.select().where(
            (plans.c.id == plan_id) & (plans.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not update_data and not reminder_at_provided:
        return existing
    update_data["updated_at"] = utcnow()
    if update_data:
        await db.execute(
            plans.update()
            .where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
            .values(**update_data)
        )
    query = plans.select().where(plans.c.id == plan_id)
    updated = await db.fetch_one(query)

    if reminder_at_provided:
        record = dict(updated) if updated else dict(existing)
        color = record.get("color")
        metadata = {"color": color} if color else None
        await _upsert_entity_reminder(
            user_id=user_id,
            entity_type="plan",
            entity_id=plan_id,
            label=str(record.get("label") or ""),
            description=record.get("description"),
            remind_at=reminder_at_value,
            metadata=metadata,
            color=color,
            db=db,
        )

    response_payload = dict(updated) if updated else dict(existing)
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="plan",
        entity_ids=[int(plan_id)],
        db=db,
    )
    response_payload["reminder_at"] = reminder_map.get(int(plan_id))
    return response_payload


@router.delete("/users/{user_id}/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    user_id: int,
    plan_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    query = plans.select().where(
        (plans.c.id == plan_id) & (plans.c.user_id == user_id)
    )
    existing = await db.fetch_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")

    await _delete_all_entity_reminders(
        user_id=user_id,
        entity_type="plan",
        entity_id=plan_id,
        db=db,
    )
    delete_query = plans.delete().where(
        (plans.c.id == plan_id) & (plans.c.user_id == user_id)
    )
    await db.execute(delete_query)
    return None


# ==================== HABITS ====================

@router.get("/users/{user_id}/habits", response_model=List[Habit])
async def get_habits(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: Optional[int] = Query(None, gt=0),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    payload = [_serialize_habit_record(row) for row in rows]
    habit_ids = [int(item["id"]) for item in payload if item.get("id") is not None]
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="habit",
        entity_ids=habit_ids,
        db=db,
    )
    for item in payload:
        habit_id = item.get("id")
        if habit_id is None:
            continue
        item["reminder_at"] = reminder_map.get(int(habit_id))
    return payload


@router.post("/users/{user_id}/habits", response_model=Habit, status_code=status.HTTP_201_CREATED)
async def create_habit(
    user_id: int,
    habit: HabitCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    base_values = {
        "user_id": user_id,
        "label": habit.label,
        "previous_label": habit.previous_label,
        "description": habit.description,
    }

    now = utcnow()
    habit_id = await db.execute(
        habits.insert().values(
            **base_values,
            created_at=now,
            updated_at=now,
        )
    )
    query = habits.select().where(habits.c.id == habit_id)
    created = await db.fetch_one(query)

    if created and habit.reminder_at is not None:
        record = dict(created)
        await _upsert_entity_reminder(
            user_id=user_id,
            entity_type="habit",
            entity_id=int(habit_id),
            label=str(record.get("label") or habit.label),
            description=record.get("description"),
            remind_at=habit.reminder_at,
            metadata=None,
            color=None,
            db=db,
        )

    response_payload = _serialize_habit_record(created)
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="habit",
        entity_ids=[int(habit_id)],
        db=db,
    )
    response_payload["reminder_at"] = reminder_map.get(int(habit_id))
    return response_payload


@router.patch("/users/{user_id}/habits/{habit_id}", response_model=Habit)
async def update_habit(
    user_id: int,
    habit_id: int,
    habit_update: HabitUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    update_data = habit_update.dict(exclude_unset=True)
    reminder_at_provided = "reminder_at" in update_data
    reminder_at_value = update_data.pop("reminder_at", None)

    existing = await db.fetch_one(
        habits.select().where(
            (habits.c.id == habit_id) & (habits.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")
    if not update_data and not reminder_at_provided:
        return existing
    update_data["updated_at"] = utcnow()
    if update_data:
        await db.execute(
            habits.update()
            .where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
            .values(**update_data)
        )
    query = habits.select().where(habits.c.id == habit_id)
    updated = await db.fetch_one(query)

    if reminder_at_provided:
        record = dict(updated) if updated else dict(existing)
        await _upsert_entity_reminder(
            user_id=user_id,
            entity_type="habit",
            entity_id=habit_id,
            label=str(record.get("label") or ""),
            description=record.get("description"),
            remind_at=reminder_at_value,
            metadata=None,
            color=None,
            db=db,
        )

    response_payload = _serialize_habit_record(updated if updated else existing)
    reminder_map = await _get_pending_entity_reminder_map(
        user_id=user_id,
        entity_type="habit",
        entity_ids=[int(habit_id)],
        db=db,
    )
    response_payload["reminder_at"] = reminder_map.get(int(habit_id))
    return response_payload


@router.delete("/users/{user_id}/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    user_id: int,
    habit_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    (
        _get_pending_entity_reminder_map,
        _upsert_entity_reminder,
        _delete_all_entity_reminders,
        _serialize_habit_record,
    ) = _get_reminder_helpers()
    
    query = habits.select().where(
        (habits.c.id == habit_id) & (habits.c.user_id == user_id)
    )
    existing = await db.fetch_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")

    await _delete_all_entity_reminders(
        user_id=user_id,
        entity_type="habit",
        entity_id=habit_id,
        db=db,
    )
    delete_query = habits.delete().where(
        (habits.c.id == habit_id) & (habits.c.user_id == user_id)
    )
    await db.execute(delete_query)
    return None
