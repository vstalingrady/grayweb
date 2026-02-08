"""
Dashboard API routes.

This router handles CRUD operations for dashboard pulses and summaries.
"""

import re
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

import databases
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Request, status

# Import models
from backend.models import (
    DashboardPulse, DashboardPulseCreate, DashboardPulseUpdate,
    DashboardSummary, DashboardProactivitySummary, ProactivityLog,
)

# Import dependencies
from backend.database import dashboard_pulses, proactivity_logs, get_database
from backend.auth import get_current_user, require_same_user
from backend.time_utils import utcnow

router = APIRouter(tags=["dashboard"])

# Constants
MAX_DASHBOARD_PULSE_HISTORY = 30


def _get_dashboard_helpers():
    """Lazy import dashboard helpers to avoid circular imports."""
    from backend.core.dashboard_helpers import (
        serialize_dashboard_pulse_record,
        load_dashboard_pulse_by_date,
        load_previous_dashboard_pulse,
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
        carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    )
    return (
        serialize_dashboard_pulse_record,
        load_dashboard_pulse_by_date,
        load_previous_dashboard_pulse,
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
        carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    )


@router.get("/users/{user_id}/dashboard/pulses", response_model=List[DashboardPulse])
async def list_dashboard_pulses(
    user_id: int,
    limit: int = MAX_DASHBOARD_PULSE_HISTORY,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    (
        _serialize_dashboard_pulse_record,
        _load_dashboard_pulse_by_date,
        _load_previous_dashboard_pulse,
        _normalize_plan_items,
        _normalize_habit_items,
        _normalize_proactivity,
        _carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    ) = _get_dashboard_helpers()
    
    safe_limit = max(1, min(limit, MAX_DASHBOARD_PULSE_HISTORY))
    records: List[Any] = []
    if not records:
        query = (
            dashboard_pulses.select()
            .where(dashboard_pulses.c.user_id == user_id)
            .order_by(dashboard_pulses.c.date_key.desc())
            .limit(safe_limit)
        )
        records = await db.fetch_all(query)
    pulses: List[DashboardPulse] = []
    for record in records:
        payload = _serialize_dashboard_pulse_record(record)
        if not payload:
            continue
        pulses.append(DashboardPulse(**payload))
    return pulses


@router.get("/users/{user_id}/dashboard/pulses/{date_key}", response_model=DashboardPulse)
async def get_dashboard_pulse(
    request: Request,
    user_id: int,
    date_key: str,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    (
        _serialize_dashboard_pulse_record,
        _load_dashboard_pulse_by_date,
        _load_previous_dashboard_pulse,
        _normalize_plan_items,
        _normalize_habit_items,
        _normalize_proactivity,
        _carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    ) = _get_dashboard_helpers()
    
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date key; expected YYYY-MM-DD")

    record = await _load_dashboard_pulse_by_date(db, user_id, date_key)
    payload = _serialize_dashboard_pulse_record(record)
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")
    return DashboardPulse(**payload)


@router.post("/users/{user_id}/dashboard/pulses", response_model=DashboardPulse, status_code=status.HTTP_201_CREATED)
async def create_dashboard_pulse(
    user_id: int,
    pulse: DashboardPulseCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    (
        _serialize_dashboard_pulse_record,
        _load_dashboard_pulse_by_date,
        _load_previous_dashboard_pulse,
        _normalize_plan_items,
        _normalize_habit_items,
        _normalize_proactivity,
        _carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    ) = _get_dashboard_helpers()
    
    timestamp_dt = _timestamp_ms_to_datetime(pulse.timestamp)
    plans_payload = _normalize_plan_items([item.dict() for item in pulse.plans])
    habits_payload = _normalize_habit_items([item.dict() for item in pulse.habits])
    proactivity_payload = _normalize_proactivity(pulse.proactivity.dict())

    if pulse.carry_forward:
        previous_record = await _load_previous_dashboard_pulse(db, user_id, pulse.date_key)
        previous_serialized = _serialize_dashboard_pulse_record(previous_record)
        plans_payload, habits_payload = _carry_forward_dashboard_entries(
            previous_serialized or {"plans": [], "habits": []},
            plans_payload,
            habits_payload,
        )

    now = utcnow()
    try:
        pulse_id = await db.execute(
            dashboard_pulses.insert().values(
                user_id=user_id,
                date_key=pulse.date_key,
                timestamp=timestamp_dt,
                plans=plans_payload,
                habits=habits_payload,
                proactivity=proactivity_payload,
                created_at=now,
                updated_at=now,
            )
        )
        record = await db.fetch_one(
            dashboard_pulses.select().where(dashboard_pulses.c.id == pulse_id)
        )
    except (sqlite3.IntegrityError, sqlalchemy.exc.IntegrityError):
        await db.execute(
            dashboard_pulses.update()
            .where(
                (dashboard_pulses.c.user_id == user_id)
                & (dashboard_pulses.c.date_key == pulse.date_key)
            )
            .values(
                timestamp=timestamp_dt,
                plans=plans_payload,
                habits=habits_payload,
                proactivity=proactivity_payload,
                updated_at=now,
            )
        )
        record = await db.fetch_one(
            dashboard_pulses.select().where(
                (dashboard_pulses.c.user_id == user_id)
                & (dashboard_pulses.c.date_key == pulse.date_key)
            )
        )

    payload = _serialize_dashboard_pulse_record(record)
    if not payload:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist dashboard pulse")
    return DashboardPulse(**payload)


@router.put("/users/{user_id}/dashboard/pulses/{pulse_id}", response_model=DashboardPulse)
async def update_dashboard_pulse(
    user_id: int,
    pulse_id: int,
    pulse_update: DashboardPulseUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    (
        _serialize_dashboard_pulse_record,
        _load_dashboard_pulse_by_date,
        _load_previous_dashboard_pulse,
        _normalize_plan_items,
        _normalize_habit_items,
        _normalize_proactivity,
        _carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    ) = _get_dashboard_helpers()
    
    update_data = pulse_update.dict(exclude_unset=True)
    existing = await db.fetch_one(
        dashboard_pulses.select().where(
            (dashboard_pulses.c.id == pulse_id) & (dashboard_pulses.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")

    if "timestamp" in update_data:
        normalized_timestamp = _timestamp_ms_to_datetime(update_data["timestamp"])
        if normalized_timestamp is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid timestamp; expected milliseconds since epoch",
            )
        update_data["timestamp"] = normalized_timestamp
    if "plans" in update_data:
        update_data["plans"] = _normalize_plan_items(update_data["plans"])
    if "habits" in update_data:
        update_data["habits"] = _normalize_habit_items(update_data["habits"])
    if "proactivity" in update_data:
        update_data["proactivity"] = _normalize_proactivity(update_data["proactivity"])
    update_data["updated_at"] = utcnow()
    await db.execute(
        dashboard_pulses.update()
        .where((dashboard_pulses.c.id == pulse_id) & (dashboard_pulses.c.user_id == user_id))
        .values(**update_data)
    )
    record = await db.fetch_one(
        dashboard_pulses.select().where(
            (dashboard_pulses.c.id == pulse_id) & (dashboard_pulses.c.user_id == user_id)
        )
    )
    payload = _serialize_dashboard_pulse_record(record)
    if not payload:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update dashboard pulse")
    return DashboardPulse(**payload)


@router.delete("/users/{user_id}/dashboard/pulses/{pulse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_pulse(
    user_id: int,
    pulse_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    existing = await db.fetch_one(
        dashboard_pulses.select().where(
            (dashboard_pulses.c.id == pulse_id) & (dashboard_pulses.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")

    await db.execute(
        dashboard_pulses.delete().where(dashboard_pulses.c.id == pulse_id)
    )
    return None


@router.get("/users/{user_id}/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    require_same_user(user_id, current_user)
    (
        _serialize_dashboard_pulse_record,
        _load_dashboard_pulse_by_date,
        _load_previous_dashboard_pulse,
        _normalize_plan_items,
        _normalize_habit_items,
        _normalize_proactivity,
        _carry_forward_dashboard_entries,
        _timestamp_ms_to_datetime,
    ) = _get_dashboard_helpers()
    
    pulse_records: List[Any] = []
    if not pulse_records:
        pulses_query = (
            dashboard_pulses.select()
            .where(dashboard_pulses.c.user_id == user_id)
            .order_by(dashboard_pulses.c.date_key.desc())
            .limit(MAX_DASHBOARD_PULSE_HISTORY)
        )
        pulse_records = await db.fetch_all(pulses_query)

    pulse_items: List[DashboardPulse] = []
    for record in pulse_records:
        payload = _serialize_dashboard_pulse_record(record)
        if not payload:
            continue
        pulse_items.append(DashboardPulse(**payload))

    today_key = utcnow().strftime("%Y-%m-%d")
    today_entry = next((pulse for pulse in pulse_items if pulse.date_key == today_key), None)
    recent_entries = pulse_items[:7]

    proactivity_records: List[Any] = []
    if not proactivity_records:
        proactivity_records = await db.fetch_all(
            proactivity_logs.select()
            .where(proactivity_logs.c.user_id == user_id)
            .order_by(proactivity_logs.c.activity_date.desc())
            .limit(10)
        )
    proactivity_logs_payload: List[ProactivityLog] = []
    for record in proactivity_records:
        proactivity_logs_payload.append(
            ProactivityLog(
                id=record["id"],
                user_id=record["user_id"],
                activity_date=record["activity_date"],
                tasks_completed=record["tasks_completed"],
                total_tasks=record["total_tasks"],
                score=record["score"],
                notes=record["notes"],
                created_at=record["created_at"],
                updated_at=record["updated_at"],
            )
        )

    return DashboardSummary(
        today=today_entry,
        recent=recent_entries,
        pulses=pulse_items,
        proactivity=DashboardProactivitySummary(logs=proactivity_logs_payload),
    )
