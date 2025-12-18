from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from backend.time_utils import utcnow

from backend.database import (
    database,
    users,
    user_chat_threads,
    user_chat_messages,
    user_data,
)

from backend.core.cache import (
    CONVERSATION_HISTORY_CACHE,
    CONVERSATION_OWNER_CACHE,
    USER_CACHE,
    TTLCache,
)

logger = logging.getLogger("backend.conversation_store")

def configure_conversation_store(
    *,
    supabase_client: Any,
    supabase_admin_client: Any,
    supabase_key_source: Optional[str],
) -> None:
    """
    No-op configuration for conversation store.
    Supabase clients are no longer used for data storage.
    """
    pass


GENERAL_CONVERSATION_PREFIX = "general:"
_USER_DATA_CACHE = TTLCache(ttl_seconds=3600, max_size=1024)


def _conversation_store_available() -> bool:
    # SECURITY OVERHAUL (2025-12-06): Supabase is now auth-only.
    # All data operations go through local SQLite.
    return False


def _handle_conversation_store_error(context: str, error: Exception) -> None:
    details = getattr(error, "message", None) or str(error)
    logger.warning("%s: %s", context, details)


def _general_conversation_user_id(conversation_id: Optional[str]) -> Optional[int]:
    if (
        not conversation_id
        or not isinstance(conversation_id, str)
        or not conversation_id.startswith(GENERAL_CONVERSATION_PREFIX)
    ):
        return None
    try:
        return int(conversation_id.split(":", 1)[1])
    except (ValueError, IndexError):
        return None

async def get_cached_user(user_id: int):
    async def fetch():
        return await database.fetch_one(
            users.select().where(users.c.id == user_id)
        )

    return await USER_CACHE.get(f"user_{user_id}", fetch)


def cache_conversation_history(
    conversation_id: str,
    user_id: Optional[int],
    history: List[Dict[str, Any]],
) -> None:
    if user_id is not None:
        CONVERSATION_OWNER_CACHE.set(conversation_id, user_id)
    CONVERSATION_HISTORY_CACHE.set(conversation_id, history)


def append_to_conversation_cache(
    conversation_id: str,
    user_id: Optional[int],
    message: Dict[str, Any],
) -> None:
    cached_history = CONVERSATION_HISTORY_CACHE.get(conversation_id)
    if cached_history is None:
        return
    owner = CONVERSATION_OWNER_CACHE.get(conversation_id) or user_id
    if user_id is not None and owner is not None and str(owner) != str(user_id):
        return
    normalized = {
        "role": message.get("role"),
        "text": message.get("text") or "",
        "grounding_metadata": message.get("grounding_metadata")
        or message.get("groundingMetadata"),
        "attachments": message.get("attachments"),
        "reminders": message.get("reminders"),
    }
    # Preserve timestamp if available
    if message.get("timestamp"):
        normalized["timestamp"] = message.get("timestamp")
    new_history = cached_history + [normalized]
    if owner is not None:
        CONVERSATION_OWNER_CACHE.set(conversation_id, owner)
    CONVERSATION_HISTORY_CACHE.set(conversation_id, new_history)


def invalidate_conversation_cache(conversation_id: str) -> None:
    CONVERSATION_OWNER_CACHE.invalidate(conversation_id)
    CONVERSATION_HISTORY_CACHE.invalidate(conversation_id)


async def ensure_user_data_record(user_identifier: int) -> Optional[int]:
    """Return the user_data.id for the provided identifier, creating it if needed."""
    if user_identifier is None:
        return None

    cached = _USER_DATA_CACHE.get(user_identifier)
    if cached is not None:
        # Ensure the cached record still exists (e.g., after DB resets)
        existing_cached = await database.fetch_one(
            user_data.select().where(user_data.c.id == cached)
        )
        if existing_cached:
            return cached
        _USER_DATA_CACHE.invalidate(user_identifier)

    try:
        # Try to fetch existing record
        query = user_data.select().where(user_data.c.user_identifier == user_identifier)
        row = await database.fetch_one(query)

        if row:
            user_data_id = row["id"]
            _USER_DATA_CACHE.set(user_identifier, user_data_id)
            return user_data_id

        # Create new record
        insert_query = user_data.insert().values(
            user_identifier=user_identifier,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        user_data_id = await database.execute(insert_query)

        if user_data_id:
            _USER_DATA_CACHE.set(user_identifier, user_data_id)
            return user_data_id

    except Exception as error:  # pragma: no cover - defensive logging
        # Race condition: another request might have created the record between our check and insert.
        # On SQLite, the winning transaction might also still be committing/holding a write lock.
        # Retry a few times with a small backoff before surfacing the failure.
        import asyncio

        for delay_seconds in (0.0, 0.01, 0.02, 0.05):
            if delay_seconds:
                await asyncio.sleep(delay_seconds)
            try:
                row = await database.fetch_one(
                    user_data.select().where(user_data.c.user_identifier == user_identifier)
                )
            except Exception:
                row = None
            if row:
                user_data_id = row["id"]
                _USER_DATA_CACHE.set(user_identifier, user_data_id)
                return user_data_id

        logger.error(
            "Error ensuring user data record: %s",
            error,
            extra={"event_type": "user_data_ensure_failed"},
        )
        return None

    return None


def delete_supabase_user_records(user_id: int) -> None:
    """
    Legacy stub for deleting Supabase records.
    Supabase is now auth-only; data deletion is handled locally.
    """
    pass
