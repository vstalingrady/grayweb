"""Onboarding completion handler.

This module extracts the _complete_onboarding function from main.py.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import databases

# Lazy imports to avoid circular dependencies
_database_module = None
_logger = None


def _get_database():
    """Lazily get database module components."""
    global _database_module
    if _database_module is None:
        from backend.database import users, proactivity_settings
        _database_module = {"users": users, "proactivity_settings": proactivity_settings}
    return _database_module


def _get_logger():
    """Lazily get API logger."""
    global _logger
    if _logger is None:
        from backend.logging_config import create_logger
        _logger = create_logger("backend.onboarding")
    return _logger


def _get_utcnow():
    """Lazily get utcnow function."""
    from backend.time_utils import utcnow
    return utcnow


def _row_get(row, key):
    """Safe accessor for database rows."""
    from backend.core.serializers import row_get
    return row_get(row, key)


def _payload_log_summary(payload):
    """Get log summary for payload."""
    from backend.core.log_utils import payload_log_summary
    return payload_log_summary(payload)


def _get_user_cache():
    """Get user cache for invalidation."""
    from backend.core.cache import USER_CACHE
    return USER_CACHE


def _get_auth_invalidation():
    """Get auth cache invalidation functions."""
    from backend.auth import invalidate_user_cache, invalidate_user_cache_redis
    return invalidate_user_cache, invalidate_user_cache_redis


async def complete_onboarding(
    user_id: int,
    args: Dict[str, Any],
    db: "databases.Database",
    *,
    user_timezone: Optional[str] = None,
    proactivity_scheduler=None,  # Passed in from main.py to avoid circular import
) -> Dict[str, Any]:
    """Process onboarding completion from AI tool call.
    
    Saves user profile information (nickname, occupation, about) and
    optionally configures proactivity settings based on user preferences.
    
    Args:
        user_id: The user's database ID
        args: Tool arguments containing profile fields
        db: Database connection
        user_timezone: Optional timezone string
        proactivity_scheduler: Optional scheduler manager for refreshing jobs
        
    Returns:
        Dict with status and optional missing fields
    """
    db_module = _get_database()
    users = db_module["users"]
    proactivity_settings = db_module["proactivity_settings"]
    logger = _get_logger()
    utcnow = _get_utcnow()
    USER_CACHE = _get_user_cache()
    invalidate_user_cache, invalidate_user_cache_redis = _get_auth_invalidation()
    
    # Some providers wrap tool arguments (e.g. {"tool": "...", "arguments": {...}})
    # or use a "params" key. Normalize to the innermost argument dict.
    if isinstance(args, dict):
        nested = args.get("arguments") or args.get("params")
        if isinstance(nested, dict):
            args = nested

    def clean(value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    nickname = clean(args.get("nickname") or args.get("name"))
    occupation = clean(args.get("occupation"))
    # Accept multiple synonyms for the user's self-description
    about = clean(args.get("about") or args.get("about_you") or args.get("blurb"))

    # Optional: initialize proactivity settings from onboarding responses.
    def normalize_cadence(raw: Optional[str]) -> Optional[str]:
        if not raw:
            return None
        text = raw.strip().lower()
        if not text:
            return None
        if "frequent" in text or "3x" in text or "3 times" in text:
            return "frequent"
        if "daily" in text or "every day" in text or "weekly" in text or "once a week" in text:
            return "daily"
        if "manual" in text or "off" in text or "never" in text:
            return "manual"
        return "custom"

    raw_cadence = clean(args.get("proactivity_cadence") or args.get("cadence"))
    cadence = normalize_cadence(raw_cadence)

    # If the tool was invoked with no meaningful fields, ignore it
    if not any([nickname, occupation, about, cadence]):
        logger.warning(
            "complete_onboarding called without any usable fields; ignoring",
            extra={"event_type": "onboarding_tool_ignored", "user_id": user_id},
        )
        return {"status": "ignored", "message": "Onboarding tool called without any usable profile/proactivity details."}

    existing = await db.fetch_one(users.select().where(users.c.id == user_id))
    existing_nickname = clean(_row_get(existing, "personalization_nickname"))
    existing_occupation = clean(_row_get(existing, "personalization_occupation"))
    existing_about = clean(_row_get(existing, "personalization_about"))

    effective_nickname = nickname or existing_nickname
    effective_occupation = occupation or existing_occupation
    effective_about = about or existing_about

    updates: Dict[str, Any] = {"updated_at": utcnow()}
    updates["has_seen_general_chat"] = True
    
    # Calculate if onboarding is fully complete (all personalization fields present)
    def _is_present(value: Optional[str]) -> bool:
        return bool((value or "").strip())

    onboarding_complete = all(
        _is_present(value) for value in (effective_nickname, effective_occupation, effective_about)
    )
    if onboarding_complete:
        updates["onboarding_completed"] = True

    if nickname is not None:
        updates["personalization_nickname"] = nickname
    if occupation is not None:
        updates["personalization_occupation"] = occupation
    if about is not None:
        updates["personalization_about"] = about

    await db.execute(users.update().where(users.c.id == user_id).values(**updates))

    # Invalidate cache so the new onboarding status is picked up immediately by all workers
    await USER_CACHE.invalidate_global(f"user_{user_id}")
    
    # Also invalidate auth cache
    try:
        updated_user = await db.fetch_one(users.select().where(users.c.id == user_id))
        user_email = updated_user["email"] if updated_user else None
        if isinstance(user_email, str) and user_email.strip():
            normalized_email = user_email.strip().lower()
            invalidate_user_cache(normalized_email)
            await invalidate_user_cache_redis(normalized_email)
    except Exception as exc:
        logger.warning(f"Failed to invalidate auth cache for user {user_id}: {exc}")

    if cadence:
        time_value = clean(
            args.get("proactivity_time")
            or args.get("proactivity_time_of_day")
            or args.get("checkin_time")
        )
        timezone = clean(args.get("proactivity_timezone")) or clean(user_timezone)

        if cadence != "manual" and not time_value:
            time_value = "09:00"

        settings_payload: Dict[str, Any] = {
            "id": "proactivity-1",
            "label": "Check-ins",
            "description": "Onboarding check-ins",
            "cadence": cadence,
        }
        
        if cadence == "frequent":
            settings_payload["times"] = ["09:00", "15:00", "18:00"]
        elif cadence == "daily":
            settings_payload["time"] = time_value or "09:00"
        elif time_value:
            settings_payload["time"] = time_value
            
        if timezone:
            settings_payload["timezone"] = timezone

        now = utcnow()
        try:
            existing_settings = await db.fetch_one(
                proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
            )
            if existing_settings:
                await db.execute(
                    proactivity_settings.update()
                    .where(proactivity_settings.c.user_id == user_id)
                    .values(payload=settings_payload, updated_at=now)
                )
            else:
                await db.execute(
                    proactivity_settings.insert().values(
                        user_id=user_id,
                        payload=settings_payload,
                        created_at=now,
                        updated_at=now,
                    )
                )
        except Exception as db_error:
            logger.error(
                f"Database error saving proactivity settings from onboarding: {db_error}",
                exc_info=True,
                extra={
                    "event_type": "proactivity_settings_onboarding_db_error",
                    "user_id": user_id,
                    "error": str(db_error),
                    **_payload_log_summary(settings_payload),
                },
            )
        else:
            if proactivity_scheduler:
                try:
                    await proactivity_scheduler.refresh_jobs(user_id)
                except Exception as scheduler_error:
                    logger.warning(
                        f"Failed to refresh proactivity scheduler jobs after onboarding: {scheduler_error}",
                        extra={
                            "event_type": "proactivity_scheduler_onboarding_refresh_error",
                            "user_id": user_id,
                            "error": str(scheduler_error),
                        },
                    )

    if onboarding_complete:
        return {"status": "success"}

    missing: List[str] = []
    if not _is_present(effective_nickname):
        missing.append("nickname")
    if not _is_present(effective_occupation):
        missing.append("occupation")
    if not _is_present(effective_about):
        missing.append("about")
    return {"status": "partial", "missing": missing}
