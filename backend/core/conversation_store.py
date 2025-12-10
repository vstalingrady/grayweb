import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

try:  # Prefer package-relative imports when running as a package
    from backend.database import (
        database,
        users,
        user_chat_threads,
        user_chat_messages,
        user_data,
    )
except Exception:  # pragma: no cover - fallback for direct backend/ execution
    from database import (  # type: ignore
        database,
        users,
        user_chat_threads,
        user_chat_messages,
        user_data,
    )


logger = logging.getLogger("backend.conversation_store")


supabase = None
supabase_admin = None
SUPABASE_KEY_SOURCE: Optional[str] = None
SUPABASE_CONVERSATIONS_ENABLED: bool = False


def configure_conversation_store(
    *,
    supabase_client: Any,
    supabase_admin_client: Any,
    supabase_key_source: Optional[str],
) -> None:
    """
    Configure Supabase clients for the conversation store.

    This is called once from the main application after Supabase has been
    initialized. It intentionally avoids importing from backend.main to keep
    dependencies one-way.
    """
    global supabase, supabase_admin, SUPABASE_CONVERSATIONS_ENABLED, SUPABASE_KEY_SOURCE
    supabase = supabase_client
    supabase_admin = supabase_admin_client
    SUPABASE_KEY_SOURCE = supabase_key_source
    SUPABASE_CONVERSATIONS_ENABLED = supabase_client is not None


GENERAL_CONVERSATION_PREFIX = "general:"
_USER_DATA_CACHE: Dict[int, int] = {}
_SUPABASE_USER_DATA_CACHE: Dict[int, int] = {}


def _conversation_store_available() -> bool:
    # SECURITY OVERHAUL (2025-12-06): Supabase is now auth-only.
    # All data operations go through local SQLite.
    return False


def _disable_conversation_store(reason: str) -> None:
    global SUPABASE_CONVERSATIONS_ENABLED
    if SUPABASE_CONVERSATIONS_ENABLED:
        SUPABASE_CONVERSATIONS_ENABLED = False
        logger.warning("Conversation storage disabled: %s", reason)


def _handle_conversation_store_error(context: str, error: Exception) -> None:
    code = getattr(error, "code", None)
    message = getattr(error, "message", None)
    if isinstance(error, dict):
        code = error.get("code")
        message = error.get("message")
    details = message or str(error)
    logger.warning("%s: %s", context, details)
    normalized = (details or "").lower()
    if code == "PGRST205" or "could not find the table" in normalized:
        _disable_conversation_store(
            "Supabase user chat tables missing; suppressing further requests."
        )
    elif (
        "permission denied" in normalized
        or "insufficient privilege" in normalized
        or "not authorized" in normalized
    ):
        _disable_conversation_store(
            "Supabase conversation access denied; suppressing further requests."
        )


def _handle_supabase_table_error(context: str, error: Exception) -> None:
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


class AsyncTTLCache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, Tuple[Any, float]] = {}

    async def get(self, key: str, fetch_func):
        now = time.time()
        if key in self.cache:
            value, timestamp = self.cache[key]
            if now - timestamp < self.ttl_seconds:
                return value

        value = await fetch_func()
        self.cache[key] = (value, now)
        return value

    def clear(self) -> None:
        self.cache = {}

    def invalidate(self, key: str) -> None:
        if key in self.cache:
            del self.cache[key]


class TTLCache:
    def __init__(self, ttl_seconds: int = 600, max_size: int = 256):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self.cache: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str) -> Any:
        now = time.time()
        entry = self.cache.get(key)
        if not entry:
            return None
        value, ts = entry
        if now - ts > self.ttl_seconds:
            self.cache.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        if len(self.cache) >= self.max_size:
            # Evict the oldest entry to keep memory bounded
            oldest = min(self.cache.items(), key=lambda item: item[1][1])[0]
            self.cache.pop(oldest, None)
        self.cache[key] = (value, time.time())

    def invalidate(self, key: str) -> None:
        self.cache.pop(key, None)

    def clear(self) -> None:
        self.cache.clear()


USER_CACHE = AsyncTTLCache(ttl_seconds=300)
CONVERSATION_OWNER_CACHE = TTLCache(ttl_seconds=900, max_size=512)
CONVERSATION_HISTORY_CACHE = TTLCache(ttl_seconds=900, max_size=256)


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
    if user_id is not None and owner is not None and owner != user_id:
        return
    normalized = {
        "role": message.get("role"),
        "text": message.get("text") or "",
        "grounding_metadata": message.get("grounding_metadata")
        or message.get("groundingMetadata"),
        "attachments": message.get("attachments"),
    }
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
        _USER_DATA_CACHE.pop(user_identifier, None)

    try:
        # Try to fetch existing record
        query = user_data.select().where(user_data.c.user_identifier == user_identifier)
        row = await database.fetch_one(query)

        if row:
            user_data_id = row["id"]
            _USER_DATA_CACHE[user_identifier] = user_data_id
            return user_data_id

        # Create new record
        insert_query = user_data.insert().values(
            user_identifier=user_identifier,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        user_data_id = await database.execute(insert_query)

        if user_data_id:
            _USER_DATA_CACHE[user_identifier] = user_data_id
            return user_data_id

    except Exception as error:  # pragma: no cover - defensive logging
        logger.error(
            "Error ensuring user data record: %s",
            error,
            extra={"event_type": "user_data_ensure_failed"},
        )
        return None

    return None


async def _resolve_supabase_user_data_id(user_id: int) -> Optional[int]:
    """Return the Supabase user_data.id for the given user, creating it if missing."""
    if not _conversation_store_available() or not supabase:
        return None

    supabase_user_data_id: Optional[int] = None
    try:
        supabase_lookup = (
            supabase.table("user_data")
            .select("id")
            .eq("user_identifier", user_id)
            .limit(1)
            .execute()
        )
        supabase_match = getattr(supabase_lookup, "data", None) or []
        if supabase_match and supabase_match[0].get("id") is not None:
            supabase_user_data_id = supabase_match[0]["id"]
        else:
            supabase.table("user_data").upsert({"user_identifier": user_id}).execute()
            fetch_after_upsert = (
                supabase.table("user_data")
                .select("id")
                .eq("user_identifier", user_id)
                .limit(1)
                .execute()
            )
            supabase_data = getattr(fetch_after_upsert, "data", None) or []
            if supabase_data and supabase_data[0].get("id") is not None:
                supabase_user_data_id = supabase_data[0]["id"]

        return supabase_user_data_id
    except Exception as error:
        _handle_conversation_store_error("Error ensuring user_data in Supabase", error)
        return None


async def require_supabase_user_data_id(user_id: int) -> int:
    """Resolve the Supabase user_data.id or raise if it's unavailable."""
    supabase_user_data_id = await _resolve_supabase_user_data_id(user_id)
    if supabase_user_data_id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User metadata storage is not available.",
        )
    return supabase_user_data_id


async def ensure_supabase_thread_exists(
    conversation_id: str,
    user_id: int,
    *,
    title: Optional[str] = None,
) -> bool:
    """Ensure a Supabase conversation thread exists for the given ID."""
    if not _conversation_store_available() or not supabase:
        return False
    from uuid import UUID

    try:
        # Validate UUID without raising on bad input
        UUID(str(conversation_id))
    except Exception:
        return False

    try:
        existing = (
            supabase.table("user_chat_threads")
            .select("id")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        rows = getattr(existing, "data", None) or []
        if rows:
            return True
    except Exception as error:
        _handle_conversation_store_error(
            "Error checking Supabase conversation thread", error
        )
        return False

    try:
        supabase_user_data_id = await require_supabase_user_data_id(user_id)
        now_iso = datetime.utcnow().isoformat() + "Z"
        seed_title = title or "Recovered Conversation"
        supabase.table("user_chat_threads").insert(
            {
                "id": conversation_id,
                "user_identifier": user_id,
                "user_data_id": supabase_user_data_id,
                "title": seed_title,
                "context_snapshot": [],
                "metadata": {},
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        ).execute()
        return True
    except Exception as error:
        _handle_conversation_store_error(
            "Error creating missing conversation thread", error
        )
        return False


async def get_or_create_conversation(
    conversation_id: Optional[str],
    user_id: int,
    *,
    title: Optional[str] = None,
) -> str:
    """Get existing conversation or create a new one in Supabase-backed storage."""
    from uuid import UUID, uuid4

    valid_id: Optional[str] = None
    if conversation_id:
        if str(conversation_id).startswith("general:"):
             valid_id = str(conversation_id)
        else:
            try:
                UUID(str(conversation_id))
                valid_id = str(conversation_id)
            except Exception:
                valid_id = None

    if valid_id:
        cached_owner = CONVERSATION_OWNER_CACHE.get(valid_id)
        if cached_owner == user_id:
            return valid_id
        try:
            query = user_chat_threads.select().where(
                (user_chat_threads.c.id == valid_id)
                & (user_chat_threads.c.user_identifier == user_id)
            )
            row = await database.fetch_one(query)
            if row:
                CONVERSATION_OWNER_CACHE.set(valid_id, user_id)
                return valid_id
        except Exception as error:
            _handle_conversation_store_error("Error checking conversation", error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Conversation storage is not available.",
            )

    try:
        user_data_id = await ensure_user_data_record(user_id)
        if user_data_id is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="User metadata storage is not available.",
            )

        new_id = valid_id if valid_id else str(uuid4())
        now = datetime.utcnow()
        insert_query = user_chat_threads.insert().values(
            id=new_id,
            title=title or "New Conversation",
            user_identifier=user_id,
            user_data_id=user_data_id,
            context_snapshot=[],
            metadata={},
            created_at=now,
            updated_at=now,
            last_message_at=now,
        )
        await database.execute(insert_query)
        CONVERSATION_OWNER_CACHE.set(new_id, user_id)
        return new_id
    except Exception as error:
        _handle_conversation_store_error("Error creating conversation", error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation storage is not available.",
        )


async def save_conversation_message(
    conversation_id: str,
    message: Dict[str, Any],
    *,
    user_id: Optional[int] = None,
) -> None:
    """Persist a single message for a conversation."""
    # Normalize the payload we write to storage so that rows are tidy and
    # consistent.
    raw_role = message.get("role")
    if not raw_role:
        return
    role = "model" if raw_role == "assistant" else raw_role
    if role not in {"user", "model"}:
        return
    text = message.get("text") or ""
    grounding_metadata = message.get("grounding_metadata") or message.get(
        "groundingMetadata"
    )

    general_user_id = _general_conversation_user_id(conversation_id)
    if general_user_id is not None:
        # General conversation messages are handled elsewhere (in main) and
        # should not be written into user_chat_messages.
        return

    try:
        insert_query = user_chat_messages.insert().values(
            thread_id=conversation_id,
            role=role,
            text=text,
            grounding_metadata=grounding_metadata,
            attachments=message.get("attachments"),
            created_at=datetime.utcnow(),
        )
        await database.execute(insert_query)

        update_query = (
            user_chat_threads.update()
            .where(user_chat_threads.c.id == conversation_id)
            .values(
                last_message_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
        await database.execute(update_query)

        append_to_conversation_cache(
            conversation_id,
            user_id,
            {
                "role": role,
                "text": text,
                "grounding_metadata": grounding_metadata,
                "attachments": message.get("attachments"),
            },
        )
    except Exception as error:  # pragma: no cover - defensive logging
        _handle_conversation_store_error("Error saving message", error)
        logger.error(
            "Failed to save message to thread %s: %s", conversation_id, error
        )


def delete_supabase_user_records(user_id: int) -> None:
    """
    Delete all Supabase records associated with a user.

    This is used during account deletion and centralizes the mapping of
    tables → user foreign-key columns for Supabase.
    """
    admin_client = supabase_admin or supabase
    if not admin_client:
        logger.info(
            "Supabase not configured, skipping remote deletion", extra={"user_id": user_id}
        )
        return

    anon_sources = {"SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"}
    if supabase_admin is None and SUPABASE_KEY_SOURCE in anon_sources:
        logger.warning(
            "Supabase service-role key missing; skipping Supabase data deletion",
            extra={
                "user_id": user_id,
                "event_type": "account_deletion_skipped_supabase",
            },
        )
        return

    logger.info(
        "Starting Supabase data deletion for user %d", user_id, extra={"user_id": user_id}
    )

    try:
        threads_result = (
            admin_client.table("user_chat_threads")
            .select("id")
            .eq("user_identifier", user_id)
            .execute()
        )
        thread_rows = threads_result.data or []
        thread_ids = [row["id"] for row in thread_rows]

        if thread_ids:
            logger.info(
                "Deleting chat messages for %d threads",
                len(thread_ids),
                extra={"user_id": user_id, "thread_count": len(thread_ids)},
            )
            admin_client.table("user_chat_messages").delete().in_(  # type: ignore[attr-defined]
                "thread_id", thread_ids
            ).execute()
    except Exception as error:
        _handle_supabase_table_error(
            f"Warning: Failed to delete user_chat_messages for user {user_id}", error
        )

    delete_targets: List[Tuple[str, str]] = [
        ("general_chat_messages", "user_id"),
        ("chat_sessions", "user_id"),
        ("user_chat_threads", "user_identifier"),
        ("user_data", "user_identifier"),
        ("plans", "user_id"),
        ("habits", "user_id"),
        ("reminders", "user_id"),
        ("calendars", "user_id"),
        ("calendar_events", "user_id"),
        ("dashboard_pulses", "user_id"),
        ("user_streaks", "user_id"),
        ("context_cache", "user_id"),
        ("file_search_stores", "user_id"),
        ("media_uploads", "user_id"),
        ("proactivity_logs", "user_id"),
        ("proactivity_settings", "user_id"),
        ("proactive_notifications", "user_id"),
        ("google_calendar_credentials", "user_id"),
        ("proactivity_push_subscriptions", "user_id"),
    ]

    for table_name, column in delete_targets:
        try:
            admin_client.table(table_name).delete().eq(column, user_id).execute()
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to delete Supabase data for user {user_id} in {table_name}",
                error,
            )

    logger.info(
        "Completed Supabase data deletion for user %d", user_id, extra={"user_id": user_id}
    )
