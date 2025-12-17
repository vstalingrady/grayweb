"""
Users API routes.

This router handles all CRUD operations for user accounts.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import databases
import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request, status

from backend.models import User, UserCreate, UserUpdate
from backend.database import (
    database,
    users,
    plans,
    habits,
    reminders,
    calendars,
    calendar_events,
    dashboard_pulses,
    context_cache,
    media_uploads,
    proactivity_logs,
    proactivity_settings,
    proactive_notifications,
    google_calendar_credentials,
    proactivity_push_subscriptions,
    get_database,
)

from backend.auth import (
    get_current_user,
    require_same_user,
    invalidate_user_cache,
    invalidate_user_cache_redis,
)
from backend.time_utils import utcnow
from backend.usage_tracker import UsageTracker
from backend.logging_config import create_logger
try:
    from backend.tier_utils import bootstrap_plan_tier
except ImportError:  # pragma: no cover
    from tier_utils import bootstrap_plan_tier  # type: ignore

try:
    from backend.core.rate_limit import limiter
except ImportError:
    from core.rate_limit import limiter  # type: ignore


def generate_initials(full_name: str) -> str:
    """Generate initials from full name."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1:
        return parts[0][:2].upper()
    return "U"

router = APIRouter(tags=["users"])

api_logger = create_logger("backend.api.users")


def _get_user_helpers():
    """Lazy import user helpers to avoid circular imports."""
    from backend.main import (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        chat_sessions,
    )
    from backend.core.conversation_store import delete_supabase_user_records
    return (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        delete_supabase_user_records,
        chat_sessions,
    )



@router.post("/users/", response_model=User, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_user(
    request: Request,
    user: UserCreate,
    db: databases.Database = Depends(get_database)
):
    """Create a new user account."""
    (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        delete_supabase_user_records,
        _chat_sessions,
    ) = _get_user_helpers()
    
    initials = generate_initials(user.full_name)
    now = utcnow()
    
    # Ignore any incoming `user.plan_tier`; clients should not be able to self-assign tiers.
    assigned_plan_tier = bootstrap_plan_tier(user.email)

    query = users.insert().values(
        email=user.email.lower(),
        full_name=user.full_name,
        profile_picture_url=user.profile_picture_url,
        role=user.role,
        plan_tier=assigned_plan_tier,
        initials=initials,
        workspace_background_id=user.workspace_background_id,
        auth_user_id=user.auth_user_id,
        created_at=now,
        updated_at=now
    )
    user_id = await db.execute(query)

    return _serialize_user_row({
        **user.dict(),
        "id": user_id,
        "initials": initials,
        "created_at": now,
        "updated_at": now
    })


@router.get("/users/email/{email}", response_model=User)
async def get_user_by_email(
    email: str,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get a user by their email address."""
    (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        delete_supabase_user_records,
        _chat_sessions,
    ) = _get_user_helpers()
    
    normalized_email = email.lower()
    current_email = str(current_user.get("email") or "").lower()
    
    # Users can only access their own data by email (admins can access any)
    if current_user.get("role") != "admin" and current_email != normalized_email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    query = users.select().where(sqlalchemy.func.lower(users.c.email) == normalized_email)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user_row(user)


@router.get("/users/{user_id}", response_model=User)
async def get_user(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    """Get a user by ID."""
    (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        delete_supabase_user_records,
        _chat_sessions,
    ) = _get_user_helpers()
    
    # Verify user can only access their own data
    # Force authenticated ID
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Enrich with usage status
    tracker = UsageTracker(db)
    usage_status = await tracker.get_usage_status(user_id)
    
    # Convert Row to dict to allow modification
    user_dict = _serialize_user_row(user)
    user_dict["usage_status"] = usage_status
    
    return user_dict


@router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    """Update a user's profile information."""
    (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        delete_supabase_user_records,
        _chat_sessions,
    ) = _get_user_helpers()
    
    # Verify user can only update their own data
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    # Get current user
    query = users.select().where(users.c.id == user_id)
    current_user_record = await db.fetch_one(query)
    if not current_user_record:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    update_data = user_update.dict(exclude_unset=True)
    if "full_name" in update_data:
        update_data["initials"] = generate_initials(update_data["full_name"])

    if "visible_model_ids" in update_data:
        raw_visible_model_ids = update_data.get("visible_model_ids")
        if raw_visible_model_ids is None:
            update_data["visible_model_ids"] = None
        elif isinstance(raw_visible_model_ids, list):
            sanitized: List[str] = []
            seen: Set[str] = set()
            for value in raw_visible_model_ids:
                if not isinstance(value, str):
                    continue
                candidate = value.strip()
                if not candidate or len(candidate) > 128:
                    continue
                if candidate in seen:
                    continue
                seen.add(candidate)
                sanitized.append(candidate)
                if len(sanitized) >= 500:
                    break
            update_data["visible_model_ids"] = sanitized
        else:
            update_data.pop("visible_model_ids", None)

    # Normalize settings/preferences fields
    if "theme_mode" in update_data:
        raw_theme_mode = update_data.get("theme_mode")
        if raw_theme_mode is None:
            update_data["theme_mode"] = None
        elif isinstance(raw_theme_mode, str):
            normalized = raw_theme_mode.strip().lower()
            if normalized in {"light", "dark", "system"}:
                update_data["theme_mode"] = normalized
            else:
                update_data.pop("theme_mode", None)
        else:
            update_data.pop("theme_mode", None)

    if "ui_locale" in update_data:
        raw_ui_locale = update_data.get("ui_locale")
        if raw_ui_locale is None:
            update_data["ui_locale"] = None
        elif isinstance(raw_ui_locale, str):
            normalized = raw_ui_locale.strip().lower()
            if not normalized:
                update_data["ui_locale"] = None
            elif normalized in {"en", "id"}:
                update_data["ui_locale"] = normalized
            else:
                update_data.pop("ui_locale", None)
        else:
            update_data.pop("ui_locale", None)

    if "preferred_response_language" in update_data:
        raw_response_language = update_data.get("preferred_response_language")
        if raw_response_language is None:
            update_data["preferred_response_language"] = None
        elif isinstance(raw_response_language, str):
            normalized = raw_response_language.strip().lower()
            if not normalized:
                update_data["preferred_response_language"] = None
            elif normalized in {"auto", "en", "id"}:
                update_data["preferred_response_language"] = normalized
            else:
                update_data.pop("preferred_response_language", None)
        else:
            update_data.pop("preferred_response_language", None)

    if "notification_preferences" in update_data:
        raw_notification_prefs = update_data.get("notification_preferences")
        if raw_notification_prefs is None:
            update_data["notification_preferences"] = None
        elif isinstance(raw_notification_prefs, dict):
            defaults: Dict[str, bool] = {
                "device": False,
                "tasks": True,
                "proactivity": True,
                "calendarEvents": True,
            }
            sanitized_prefs = dict(defaults)
            for key in defaults.keys():
                value = raw_notification_prefs.get(key)
                if isinstance(value, bool):
                    sanitized_prefs[key] = value
            update_data["notification_preferences"] = sanitized_prefs
        else:
            update_data.pop("notification_preferences", None)

    for flag_field in ("conversation_memory_enabled", "auto_web_search_enabled"):
        if flag_field not in update_data:
            continue
        raw_value = update_data.get(flag_field)
        if raw_value is None:
            continue
        if not isinstance(raw_value, bool):
            update_data.pop(flag_field, None)

    # Normalize optional text fields
    for field_name, max_length in (
        ("personalization_system_prompt_override", 8000),
        ("personalization_location", 160),
        ("personalization_time_zone", 64),
    ):
        if field_name not in update_data:
            continue
        value = update_data.get(field_name)
        if value is None:
            continue
        if not isinstance(value, str):
            update_data.pop(field_name, None)
            continue
        normalized = value.strip()
        if not normalized:
            update_data[field_name] = None
            continue
        update_data[field_name] = normalized[:max_length]

    # Keep proactivity settings in sync when the user updates their time zone.
    if "personalization_time_zone" in update_data:
        try:
            record = await db.fetch_one(
                proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
            )
            if record:
                payload = _row_get(record, "payload")
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except Exception:
                        payload = None
                if isinstance(payload, dict):
                    next_tz = update_data.get("personalization_time_zone")
                    if next_tz:
                        payload["timezone"] = next_tz
                    else:
                        payload.pop("timezone", None)
                    await db.execute(
                        proactivity_settings.update()
                        .where(proactivity_settings.c.user_id == user_id)
                        .values(payload=payload, updated_at=utcnow())
                    )
        except Exception as exc:  # pragma: no cover - best effort sync
            api_logger.debug(
                "Failed to sync personalization_time_zone into proactivity settings",
                extra={"event_type": "user_timezone_sync_failed", "user_id": user_id, "error": str(exc)},
            )

    update_data["updated_at"] = utcnow()

    query = users.update().where(users.c.id == user_id).values(**update_data)
    await db.execute(query)

    # Invalidate cache
    USER_CACHE.invalidate(f"user_{user_id}")
    if current_user_record:
        auth_user_id = current_user_record["auth_user_id"] if "auth_user_id" in current_user_record else None
        if auth_user_id:
            auth_user_id_str = str(auth_user_id)
            invalidate_user_cache(auth_user_id_str)
            await invalidate_user_cache_redis(auth_user_id_str)

    # Return updated user
    query = users.select().where(users.c.id == user_id)
    updated = await db.fetch_one(query)
    return _serialize_user_row(updated)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    user_id: int,
    response: Response,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    """Delete a user account and all associated data."""
    (
        _serialize_user_row,
        _row_get,
        supabase,
        supabase_admin,
        SUPABASE_KEY_SOURCE,
        USER_CACHE,
        delete_supabase_user_records,
        chat_sessions,
    ) = _get_user_helpers()
    
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    existing = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    user_email = existing["email"]
    auth_user_id = existing["auth_user_id"] if "auth_user_id" in existing else None
    
    api_logger.info(
        f"Processing account deletion for user {user_id} ({user_email})",
        extra={"user_id": user_id, "email": user_email, "event_type": "account_deletion_start"}
    )

    delete_supabase_user_records(user_id)

    # Delete from Supabase Auth using a service-role client when available
    admin_client = supabase_admin or supabase
    service_sources = {"SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"}
    anon_sources = {"SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"}

    if admin_client and (supabase_admin is not None or SUPABASE_KEY_SOURCE in service_sources):
        try:
            if auth_user_id:
                # Convert UUID to string if needed
                auth_user_id_str = str(auth_user_id) if auth_user_id else None
                admin_client.auth.admin.delete_user(auth_user_id_str)
                api_logger.info(
                    f"Deleted Supabase Auth user {auth_user_id_str}",
                    extra={"user_id": user_id, "auth_user_id": auth_user_id_str}
                )
            else:
                # Fallback to email search only if auth_id is missing (legacy users)
                api_logger.warning(
                    f"auth_user_id missing for user {user_id}, attempting fallback search by email",
                    extra={"user_id": user_id}
                )
                auth_users_response = admin_client.auth.admin.list_users()
                auth_users = getattr(auth_users_response, "users", []) or []
                
                found_id = None
                for auth_user in auth_users:
                    if hasattr(auth_user, "email") and auth_user.email == user_email:
                        found_id = auth_user.id
                        break
                
                if found_id:
                    admin_client.auth.admin.delete_user(found_id)
                    api_logger.info(
                        f"Deleted Supabase Auth user {found_id} (via fallback)",
                        extra={"user_id": user_id, "auth_user_id": found_id}
                    )
                else:
                    api_logger.warning(
                        f"Could not find Supabase Auth user for email {user_email}",
                        extra={"user_id": user_id}
                    )
        except Exception as e:
            api_logger.error(
                f"Failed to delete Supabase Auth user: {e}",
                extra={"user_id": user_id, "error": str(e)}
            )

    elif admin_client and SUPABASE_KEY_SOURCE in anon_sources:
        api_logger.warning(
            "Supabase service-role key missing; skipped Supabase Auth deletion",
            extra={"user_id": user_id, "event_type": "account_deletion_skipped_auth"},
        )

    # Delete from all related tables
    deletion_tables = [
        chat_sessions,
        calendar_events,
        calendars,
        plans,
        habits,
        reminders,
        dashboard_pulses,
        context_cache,
        media_uploads,
        proactivity_logs,
        proactivity_settings,
        proactive_notifications,
        google_calendar_credentials,
        proactivity_push_subscriptions,
    ]

    for table in deletion_tables:
        await db.execute(table.delete().where(table.c.user_id == user_id))

    # Delete from raw SQL tables
    try:
        await db.execute("DELETE FROM general_chat_messages WHERE user_id = :user_id", {"user_id": user_id})
    except Exception:
        # Table might not exist or other error, ignore
        pass

    await db.execute(users.delete().where(users.c.id == user_id))
    
    # Clear session cookies to prevent auth loop
    response.delete_cookie("sb-access-token", path="/", domain=None)
    response.delete_cookie("sb-refresh-token", path="/", domain=None)
    
    api_logger.info(
        f"User account {user_id} deleted successfully",
        extra={"user_id": user_id, "event_type": "account_deletion_complete"}
    )
