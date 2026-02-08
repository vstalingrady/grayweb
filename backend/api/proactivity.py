"""
Proactivity API routes.

This router handles proactivity logs, settings, streaming, and push subscriptions.
"""

import asyncio
import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

import databases
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

# Import models
from backend.models import (
    ProactivityLog,
    ProactivityLogCreate,
    ProactivityNotification,
    ProactivitySettings,
    ProactivitySettingsUpdate,
    DailyCheckIn,
)

# Import dependencies
from backend.database import (
    database, users, proactivity_logs, proactivity_settings, 
    proactivity_push_subscriptions, proactive_notifications, get_database
)
from backend.auth import get_current_user, require_same_user
from backend.time_utils import utcnow
from backend.core.async_utils import create_logged_task
from backend.core.env_helpers import proactivity_dispatch_source
from backend.logging_config import create_logger

api_logger = create_logger("backend.api.proactivity")

router = APIRouter(tags=["proactivity"])

PROACTIVITY_ID_BY_CADENCE = {
    "frequent": "proactivity-frequent",
    "daily": "proactivity-daily",
    "manual": "proactivity-manual",
    "custom": "proactivity-custom",
}


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


def _get_proactivity_services():
    """Lazy import proactivity services to avoid circular imports."""
    from backend.main import proactivity_engine, proactivity_realtime_broker
    return proactivity_engine, proactivity_realtime_broker


def _sse_event(event: str, data: Dict[str, Any]) -> str:
    """Format SSE event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _infer_proactivity_id(cadence: Optional[str]) -> Optional[str]:
    normalized = (cadence or "").strip().lower()
    return PROACTIVITY_ID_BY_CADENCE.get(normalized)


def _validate_task_counts_non_negative(tasks_completed: int, total_tasks: int) -> None:
    if tasks_completed < 0 or total_tasks < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tasks_completed and total_tasks must be non-negative.",
        )

def _serialize_notification_row(row: Any) -> Dict[str, Any]:
    record = dict(row)
    metadata = record.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            metadata = None
    if metadata is not None and not isinstance(metadata, dict):
        metadata = None
    record["metadata"] = metadata

    for key in ("due_at", "sent_at", "read_at", "completed_at", "created_at"):
        value = record.get(key)
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            record[key] = value.isoformat()
    return record


async def get_user_from_bearer_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
) -> Optional[Dict[str, Any]]:
    """Resolve authenticated user from Authorization header bearer token."""
    async def _resolve_user_from_token(raw_token: str) -> Optional[Dict[str, Any]]:
        from backend.auth import verify_supabase_token

        try:
            payload = await verify_supabase_token(raw_token)
            auth_user_id = str(payload.get("sub")).strip() if payload.get("sub") is not None else None
            email = payload.get("email")
            normalized_email = email.strip().lower() if isinstance(email, str) else None
            if not auth_user_id and not normalized_email:
                return None

            user_by_auth_user_id = None
            user_by_email = None
            if auth_user_id:
                user_by_auth_user_id = await database.fetch_one(
                    users.select().where(users.c.auth_user_id == auth_user_id)
                )
            if normalized_email:
                user_by_email = await database.fetch_one(
                    users.select().where(sqlalchemy.func.lower(users.c.email) == normalized_email)
                )

            if user_by_auth_user_id and user_by_email and int(user_by_auth_user_id["id"]) != int(user_by_email["id"]):
                api_logger.warning(
                    "Rejected proactivity token due to sub/email mapping mismatch",
                    extra={
                        "event_type": "auth_identity_mismatch_proactivity",
                        "token_sub": auth_user_id,
                        "email": normalized_email,
                        "sub_user_id": int(user_by_auth_user_id["id"]),
                        "email_user_id": int(user_by_email["id"]),
                    },
                )
                return None

            if user_by_auth_user_id:
                return dict(user_by_auth_user_id)

            if user_by_email:
                existing_auth_user_id = user_by_email["auth_user_id"]
                if auth_user_id and existing_auth_user_id and str(existing_auth_user_id) != auth_user_id:
                    api_logger.warning(
                        "Rejected proactivity token due to existing auth binding mismatch",
                        extra={
                            "event_type": "auth_identity_rebind_rejected_proactivity",
                            "email": normalized_email,
                            "token_sub": auth_user_id,
                            "existing_auth_user_id": str(existing_auth_user_id),
                        },
                    )
                    return None
                if auth_user_id and not existing_auth_user_id:
                    await database.execute(
                        users.update()
                        .where(users.c.id == user_by_email["id"])
                        .values(auth_user_id=auth_user_id, updated_at=utcnow())
                    )
                    refreshed = await database.fetch_one(users.select().where(users.c.id == user_by_email["id"]))
                    return dict(refreshed) if refreshed else None
                return dict(user_by_email)
            return None
        except Exception as exc:
            api_logger.debug(
                "Failed to resolve user from token",
                extra={"event_type": "auth_token_invalid", "error": str(exc)},
            )
            return None

    if credentials and credentials.credentials:
        resolved_user = await _resolve_user_from_token(credentials.credentials)
        if resolved_user:
            return resolved_user

    return None


@router.get("/users/{user_id}/proactivity", response_model=List[ProactivityLog])
async def get_user_proactivity(
    user_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get user's proactivity logs."""
    require_same_user(user_id, current_user)

    query = proactivity_logs.select().where(proactivity_logs.c.user_id == user_id).order_by(proactivity_logs.c.activity_date.desc())
    results = await db.fetch_all(query)

    formatted_results = []
    for result in results:
        formatted_results.append({
            "id": result.id,
            "user_id": result.user_id,
            "activity_date": result.activity_date,
            "tasks_completed": result.tasks_completed,
            "total_tasks": result.total_tasks,
            "score": result.score,
            "notes": result.notes,
            "created_at": result.created_at if result.created_at else utcnow(),
            "updated_at": result.updated_at if result.updated_at else utcnow()
        })

    return formatted_results


@router.post("/users/{user_id}/proactivity", response_model=ProactivityLog, status_code=status.HTTP_201_CREATED)
async def create_proactivity_log(
    user_id: int,
    proactivity: ProactivityLogCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Create a new proactivity log entry."""
    require_same_user(user_id, current_user)
    _validate_task_counts_non_negative(proactivity.tasks_completed, proactivity.total_tasks)
    score = min(100, (proactivity.tasks_completed / max(proactivity.total_tasks, 1)) * 100) if proactivity.total_tasks > 0 else 0
    query = proactivity_logs.insert().values(
        user_id=user_id,
        activity_date=utcnow(),
        tasks_completed=proactivity.tasks_completed,
        total_tasks=proactivity.total_tasks,
        score=score,
        notes=proactivity.notes
    )
    log_id = await db.execute(query)
    result = await db.fetch_one(proactivity_logs.select().where(proactivity_logs.c.id == log_id))
    return {
        "id": result.id,
        "user_id": result.user_id,
        "activity_date": result.activity_date,
        "tasks_completed": result.tasks_completed,
        "total_tasks": result.total_tasks,
        "score": result.score,
        "notes": result.notes,
        "created_at": result.created_at,
        "updated_at": result.updated_at,
    }


@router.get("/users/{user_id}/proactivity/stream")
async def stream_user_proactivity(
    user_id: int,
    token: Optional[str] = Query(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_user_from_bearer_token),
):
    """SSE endpoint for real-time proactivity updates."""
    proactivity_engine, proactivity_realtime_broker = _get_proactivity_services()

    if token is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query-token auth is not supported for this endpoint. Use Authorization: Bearer <token>.",
        )
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    require_same_user(user_id, current_user)
    user_id = int(current_user["id"])
    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")

    queue = await proactivity_realtime_broker.register(user_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            yield _sse_event("ready", {"user_id": user_id})
            if proactivity_dispatch_source() == "realtime":
                create_logged_task(
                    proactivity_engine.dispatch_user_if_due(user_id, source="realtime"),
                    logger=api_logger,
                    name="proactivity.dispatch_user_if_due",
                )

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=25)
                except asyncio.TimeoutError:
                    yield _sse_event("ping", {"user_id": user_id})
                    continue

                if not isinstance(payload, dict):
                    continue
                event_name = payload.get("event") or "message"
                yield _sse_event(event_name, payload)
        finally:
            await proactivity_realtime_broker.unregister(user_id, queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@router.get("/users/{user_id}/proactivity/status")
async def get_proactivity_status(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get current proactivity configuration and status."""
    proactivity_engine, _ = _get_proactivity_services()
    user_id = int(current_user["id"])
    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")
    
    return await proactivity_engine.get_user_status(user_id)


@router.get("/users/{user_id}/proactivity/deliveries")
async def list_proactivity_deliveries(
    user_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return recent proactivity deliveries for a user."""
    require_same_user(user_id, current_user)
    now = utcnow()
    since = now - timedelta(days=1)

    query = """
        SELECT sent_at
        FROM proactive_notifications
        WHERE user_id = :user_id
          AND type = :type
          AND sent_at >= :since
        ORDER BY sent_at ASC
    """
    rows = await db.fetch_all(query, {"user_id": user_id, "type": "check_in", "since": since})
    sent_at_values = []
    for row in rows:
        value = row["sent_at"]
        if isinstance(value, datetime):
            sent_at_values.append(value.isoformat())
        elif isinstance(value, str):
            sent_at_values.append(value)
    return {"sent_at": sent_at_values}


@router.post("/users/{user_id}/proactivity/subscription", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_proactivity_push_subscription(
    user_id: int,
    subscription: Dict[str, Any],
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Upsert push notification subscription."""
    require_same_user(user_id, current_user)
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth_key = keys.get("auth")

    if not endpoint or not p256dh or not auth_key:
        raise HTTPException(status_code=400, detail="Invalid subscription payload")

    query_existing = proactivity_push_subscriptions.select().where(
        proactivity_push_subscriptions.c.endpoint == endpoint
    )
    existing = await db.fetch_one(query_existing)

    if existing:
        existing_user_id = int(existing["user_id"])
        if existing_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Subscription endpoint is already registered to another user",
            )
        update_query = (
            proactivity_push_subscriptions.update()
            .where(proactivity_push_subscriptions.c.id == existing["id"])
            .values(
                p256dh=p256dh,
                auth=auth_key,
                updated_at=utcnow(),
            )
        )
        await db.execute(update_query)
    else:
        insert_query = proactivity_push_subscriptions.insert().values(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth_key,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        await db.execute(insert_query)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/users/{user_id}/proactivity/daily-checkin", response_model=ProactivityLog)
async def daily_proactivity_checkin(
    user_id: int,
    checkin: DailyCheckIn,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Daily proactivity check-in - creates or updates today's log."""
    require_same_user(user_id, current_user)
    _validate_task_counts_non_negative(checkin.tasks_completed, checkin.total_tasks)
    now = utcnow()
    activity_date = datetime.combine(now.date(), datetime.min.time())
    score = min(100, (checkin.tasks_completed / max(checkin.total_tasks, 1)) * 100) if checkin.total_tasks > 0 else 0

    try:
        await db.execute(
            proactivity_logs.insert().values(
                user_id=user_id,
                activity_date=activity_date,
                tasks_completed=checkin.tasks_completed,
                total_tasks=checkin.total_tasks,
                score=score,
                notes=checkin.notes,
                created_at=now,
                updated_at=now,
            )
        )
    except (sqlite3.IntegrityError, sqlalchemy.exc.IntegrityError):
        await db.execute(
            proactivity_logs.update()
            .where(
                (proactivity_logs.c.user_id == user_id)
                & (proactivity_logs.c.activity_date == activity_date)
            )
            .values(
                tasks_completed=checkin.tasks_completed,
                total_tasks=checkin.total_tasks,
                score=score,
                notes=checkin.notes,
                updated_at=now,
            )
        )

    result = await db.fetch_one(
        proactivity_logs.select().where(
            (proactivity_logs.c.user_id == user_id)
            & (proactivity_logs.c.activity_date == activity_date)
        )
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist daily check-in.",
        )

    return {
        "id": result.id,
        "user_id": result.user_id,
        "activity_date": result.activity_date,
        "tasks_completed": result.tasks_completed,
        "total_tasks": result.total_tasks,
        "score": result.score,
        "notes": result.notes,
        "created_at": result.created_at if result.created_at else utcnow(),
        "updated_at": result.updated_at if result.updated_at else utcnow()
    }


@router.get("/users/{user_id}/proactivity/settings", response_model=Optional[ProactivitySettings])
async def get_proactivity_settings(
    user_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get proactivity settings for a user."""
    proactivity_engine, _ = _get_proactivity_services()
    user_id = int(current_user["id"])
    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")

    record = await db.fetch_one(
        proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
    )
    if not record:
        return None

    payload = proactivity_engine._deserialize_payload(record.payload) or {}
    cadence = payload.get("cadence")
    payload_id = payload.get("id")
    if payload_id in (None, "proactivity-1"):
        payload_id = _infer_proactivity_id(cadence)

    return ProactivitySettings(
        id=payload_id,
        label=payload.get("label"),
        description=payload.get("description"),
        cadence=cadence,
        time=payload.get("time"),
        times=payload.get("times"),
        channels=payload.get("channels"),
        timezone=payload.get("timezone"),
        message_length=payload.get("message_length"),
    )

@router.get("/users/{user_id}/proactivity/notifications", response_model=List[ProactivityNotification])
async def list_proactivity_notifications(
    user_id: int,
    limit: Optional[int] = Query(None, ge=1),
    unread_only: bool = Query(False),
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)

    query = proactive_notifications.select().where(proactive_notifications.c.user_id == user_id)
    if unread_only:
        query = query.where(proactive_notifications.c.read_at.is_(None))
    query = query.order_by(proactive_notifications.c.sent_at.desc())
    if limit is not None:
        query = query.limit(limit)

    rows = await db.fetch_all(query)
    return [_serialize_notification_row(row) for row in rows]

@router.post(
    "/users/{user_id}/proactivity/notifications/{notification_id}/read",
    response_model=ProactivityNotification,
)
async def mark_proactivity_notification_read(
    user_id: int,
    notification_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)

    existing = await db.fetch_one(
        proactive_notifications.select().where(
            proactive_notifications.c.id == notification_id,
            proactive_notifications.c.user_id == user_id,
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not existing["read_at"]:
        await db.execute(
            proactive_notifications.update()
            .where(proactive_notifications.c.id == notification_id)
            .values(read_at=utcnow())
        )
        updated = await db.fetch_one(
            proactive_notifications.select().where(proactive_notifications.c.id == notification_id)
        )
        if updated:
            return _serialize_notification_row(updated)

    return _serialize_notification_row(existing)


@router.put("/users/{user_id}/proactivity/settings", response_model=ProactivitySettings)
async def update_proactivity_settings(
    user_id: int,
    settings_update: ProactivitySettingsUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update proactivity settings for a user."""
    proactivity_engine, proactivity_scheduler = _get_proactivity_services()
    from backend.main import proactivity_scheduler as ps
    proactivity_scheduler = ps
    dispatch_source = proactivity_dispatch_source()
    
    user_id = int(current_user["id"])

    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")
    if dispatch_source == "apscheduler" and not proactivity_scheduler:
        raise HTTPException(status_code=503, detail="Proactivity scheduler not initialized")

    existing_record = await db.fetch_one(
        proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
    )
    current_payload = proactivity_engine._deserialize_payload(existing_record.payload) if existing_record else {}

    updated_payload = current_payload.copy()
    if settings_update.id is not None:
        updated_payload["id"] = settings_update.id
    if settings_update.label is not None:
        updated_payload["label"] = settings_update.label
    if settings_update.description is not None:
        updated_payload["description"] = settings_update.description
    if settings_update.cadence is not None:
        updated_payload["cadence"] = settings_update.cadence
    if settings_update.time is not None:
        updated_payload["time"] = settings_update.time
    if settings_update.times is not None:
        updated_payload["times"] = settings_update.times
    if settings_update.channels is not None:
        updated_payload["channels"] = settings_update.channels
    if settings_update.timezone is not None:
        updated_payload["timezone"] = settings_update.timezone
    if settings_update.message_length is not None:
        updated_payload["message_length"] = settings_update.message_length

    if updated_payload.get("cadence", "").lower() == "daily" and updated_payload.get("time") and not updated_payload.get("times"):
        updated_payload["times"] = [updated_payload["time"]]
    elif updated_payload.get("cadence", "").lower() == "frequent" and updated_payload.get("times"):
        updated_payload["time"] = updated_payload["times"][0] if updated_payload["times"] else None
    if updated_payload.get("id") in (None, "", "proactivity-1"):
        inferred_id = _infer_proactivity_id(updated_payload.get("cadence"))
        if inferred_id:
            updated_payload["id"] = inferred_id
    
    now = utcnow()
    if existing_record:
        update_query = (
            proactivity_settings.update()
            .where(proactivity_settings.c.user_id == user_id)
            .values(payload=updated_payload, updated_at=now)
        )
        await db.execute(update_query)
    else:
        insert_query = proactivity_settings.insert().values(
            user_id=user_id,
            payload=updated_payload,
            created_at=now,
            updated_at=now
        )
        await db.execute(insert_query)

    if proactivity_scheduler:
        await proactivity_scheduler.refresh_jobs(user_id)

    cadence = updated_payload.get("cadence")
    return ProactivitySettings(
        id=updated_payload.get("id"),
        label=updated_payload.get("label"),
        description=updated_payload.get("description"),
        cadence=cadence,
        time=updated_payload.get("time"),
        times=updated_payload.get("times"),
        channels=updated_payload.get("channels"),
        timezone=updated_payload.get("timezone"),
        message_length=updated_payload.get("message_length"),
    )


async def _upsert_push_subscription(
    db: databases.Database,
    user_id: int,
    subscription: PushSubscriptionCreate,
) -> Dict[str, str]:
    """Helper to upsert push subscription."""
    existing = await db.fetch_one(
        proactivity_push_subscriptions.select().where(
            proactivity_push_subscriptions.c.endpoint == subscription.endpoint
        )
    )

    now = utcnow()
    if existing:
        existing_user_id = int(existing["user_id"])
        if existing_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Subscription endpoint is already registered to another user",
            )
        await db.execute(
            proactivity_push_subscriptions.update()
            .where(
                (proactivity_push_subscriptions.c.id == existing["id"])
                & (proactivity_push_subscriptions.c.user_id == user_id)
            )
            .values(
                p256dh=subscription.p256dh,
                auth=subscription.auth,
                updated_at=now,
            )
        )
        return {"status": "updated"}

    try:
        await db.execute(
            proactivity_push_subscriptions.insert().values(
                user_id=user_id,
                endpoint=subscription.endpoint,
                p256dh=subscription.p256dh,
                auth=subscription.auth,
                created_at=now,
                updated_at=now,
            )
        )
        return {"status": "created"}
    except (sqlite3.IntegrityError, sqlalchemy.exc.IntegrityError) as exc:
        message = str(exc).lower()
        if "unique" not in message and "duplicate" not in message:
            raise

        conflict_row = await db.fetch_one(
            proactivity_push_subscriptions.select().where(
                proactivity_push_subscriptions.c.endpoint == subscription.endpoint
            )
        )
        if not conflict_row:
            raise
        conflict_user_id = int(conflict_row["user_id"])
        if conflict_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Subscription endpoint is already registered to another user",
            )
        await db.execute(
            proactivity_push_subscriptions.update()
            .where(
                (proactivity_push_subscriptions.c.id == conflict_row["id"])
                & (proactivity_push_subscriptions.c.user_id == user_id)
            )
            .values(
                p256dh=subscription.p256dh,
                auth=subscription.auth,
                updated_at=now,
            )
        )
        return {"status": "updated"}


@router.post("/users/{user_id}/push/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push_notifications(
    request: Request,
    user_id: int,
    subscription: PushSubscriptionCreate,
    token: Optional[str] = Query(None),
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_user_from_bearer_token),
):
    """Register a Web Push subscription for the user."""
    if token is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query-token auth is not supported for this endpoint. Use Authorization: Bearer <token>.",
        )
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    require_same_user(user_id, current_user)
    return await _upsert_push_subscription(db=db, user_id=user_id, subscription=subscription)
