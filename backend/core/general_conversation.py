"""General conversation CRUD operations.

This module extracts general chat message handling from main.py to improve
modularity and reduce main.py's size.
"""
from __future__ import annotations

import json
import asyncio
from importlib import import_module
from importlib.util import find_spec
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from datetime import datetime, timezone

if TYPE_CHECKING:
    import databases

# Lazy imports to avoid circular dependencies
_database = None
_general_chat_messages = None
_user_data = None
_app_logger = None


def _get_database():
    """Lazily get database connection."""
    global _database, _general_chat_messages, _user_data
    if _database is None:
        from backend.database import database, general_chat_messages, user_data
        _database = database
        _general_chat_messages = general_chat_messages
        _user_data = user_data
    return _database, _general_chat_messages, _user_data


def _get_logger():
    """Lazily get app logger."""
    global _app_logger
    if _app_logger is None:
        from backend.logging_config import create_logger
        _app_logger = create_logger("backend.general_conversation")
    return _app_logger


def _get_utcnow():
    """Lazily get utcnow function."""
    from backend.time_utils import utcnow
    return utcnow


def _parse_json_field(value: Any) -> Any:
    """Parse a JSON field."""
    from backend.core.serializers import parse_json_field
    return parse_json_field(value)


def _parse_json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _datetime_to_ms(dt) -> int:
    """Convert datetime to milliseconds timestamp."""
    from backend.core.serializers import datetime_to_ms
    return datetime_to_ms(dt)


from backend.core.conversation_store import ensure_user_data_record
from backend.core.async_utils import create_logged_task


def _timestamp_ms_to_datetime(value: Optional[int]) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (ValueError, OSError, TypeError):
        return None


def _queue_general_cache_append(
    *,
    user_id: int,
    role: str,
    text: str,
    created_at: datetime,
    grounding_metadata: Optional[Any] = None,
    attachments: Optional[Any] = None,
    reminders: Optional[Any] = None,
) -> None:
    if find_spec("backend.chat_cache") is None:
        return
    append_cached_message = import_module("backend.chat_cache").append_cached_message
    conversation_id = f"general:{user_id}"
    timestamp_ms = int(created_at.replace(tzinfo=timezone.utc).timestamp() * 1000)
    payload: Dict[str, Any] = {
        "role": role,
        "text": text,
        "timestamp": timestamp_ms,
    }
    if grounding_metadata is not None:
        payload["grounding_metadata"] = grounding_metadata
    if attachments is not None:
        payload["attachments"] = attachments
    if reminders is not None:
        payload["reminders"] = reminders

    create_logged_task(
        append_cached_message(conversation_id, payload),
        logger=_get_logger(),
        name="chat_cache.append_general_conversation_message",
    )


async def load_general_conversation_history(
    user_id: int,
    *,
    limit: Optional[int] = None,
    before: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Load general chat history from SQLite for given user."""
    database, general_chat_messages, _ = _get_database()
    logger = _get_logger()
    
    # Ensure user_id is definitely an int to prevent SQLAlchemy clause issues
    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        logger.error(f"Invalid user_id type: {type(user_id)}, value: {user_id}")
        return []
    
    try:
        effective_limit = limit if limit is not None else 100
        query = general_chat_messages.select().where(
            general_chat_messages.c.user_id == user_id_int
        )
        before_dt = _timestamp_ms_to_datetime(before)
        if before_dt is not None:
            query = query.where(general_chat_messages.c.created_at < before_dt)
        query = query.order_by(general_chat_messages.c.created_at.desc()).limit(effective_limit)
        rows = await database.fetch_all(query)
        
        local_history = []
        for row in reversed(rows):
            entry = {
                "role": row["role"],
                "text": row["content"],
            }
            
            # Use explicit None checks to avoid SQLAlchemy clause boolean issues
            grounding_val = row["grounding_metadata"]
            if grounding_val is not None:
                entry["grounding_metadata"] = _parse_json_field(grounding_val) if isinstance(grounding_val, str) else grounding_val
            
            created_val = row["created_at"]
            if created_val is not None:
                entry["timestamp"] = _datetime_to_ms(created_val)
            else:
                entry["timestamp"] = 0

            # Include reminders if present (use try/except since older DB may not have column)
            try:
                reminders_value = row["reminders"]
                if reminders_value is not None:
                    entry["reminders"] = _parse_json_field(reminders_value) if isinstance(reminders_value, str) else reminders_value
            except (KeyError, IndexError):
                pass  # Column doesn't exist or not accessible

            # Include attachments if present (optional column in older DBs)
            try:
                attachments_value = row["attachments"]
                if attachments_value is not None:
                    parsed_attachments = _parse_json_value(attachments_value)
                    if parsed_attachments:
                        entry["attachments"] = parsed_attachments
            except (KeyError, IndexError):
                pass  # Column doesn't exist or not accessible
            
            local_history.append(entry)
            
        return local_history
    except Exception as error:
        logger.error(
            "Failed to load general chat history from SQLite",
            extra={"event_type": "sqlite_history_load_error", "error": str(error)},
        )
        return []


async def insert_general_conversation_message(
    *,
    user_id: int,
    role: str,
    text: str,
    grounding_metadata: Optional[Any] = None,
    attachments: Optional[Any] = None,
    reminders: Optional[Any] = None,
) -> Optional[int]:
    """Insert a single message to general chat history."""
    database, general_chat_messages, _ = _get_database()
    logger = _get_logger()
    utcnow = _get_utcnow()
    
    logger.debug(
        f"Inserting general chat message for user {user_id}, role={role}, text_len={len(text)}",
        extra={"event_type": "general_message_insert_start", "user_id": user_id, "role": role}
    )
    user_data_id = await ensure_user_data_record(user_id)

    # Insert into SQLite
    try:
        effective_user_data_id = user_data_id if user_data_id is not None else user_id
        now = utcnow()
        values: Dict[str, Any] = {
            "user_id": user_id,
            "user_data_id": effective_user_data_id,
            "role": role,
            "content": text,
            "grounding_metadata": json.dumps(grounding_metadata)
            if grounding_metadata
            else None,
            "created_at": now,
        }
        if attachments is not None:
            values["attachments"] = json.dumps(attachments) if attachments else None
        if reminders is not None:
            values["reminders"] = json.dumps(reminders) if reminders else None

        try:
            result = await database.execute(general_chat_messages.insert().values(**values))
        except Exception as insert_error:
            # Retry without reminders for older DB schemas (pre-migration).
            if "reminders" in values:
                values.pop("reminders", None)
                result = await database.execute(
                    general_chat_messages.insert().values(**values)
                )
            else:
                raise insert_error
        logger.info(
            f"Successfully saved general chat message for user {user_id}, role={role}, id={result}",
            extra={"event_type": "general_message_insert_success", "user_id": user_id, "role": role, "message_id": result}
        )
        _queue_general_cache_append(
            user_id=user_id,
            role=role,
            text=text,
            created_at=now,
            grounding_metadata=grounding_metadata,
            attachments=attachments,
            reminders=reminders,
        )
        return result
    except Exception as error:
        logger.error(
            "Error saving general conversation message (SQLite)",
            extra={"event_type": "sqlite_message_insert_error", "error": str(error), "user_id": user_id},
        )
        return None


async def replace_general_conversation_history(user_id: int, history: List[Dict[str, Any]]) -> None:
    """Replace general chat history atomically with safeguards against data loss.
    
    SAFETY: This function now:
    1. Rejects empty payloads to prevent accidental data wipe
    2. Uses a transaction so if insert fails, the delete is rolled back
    """
    database, general_chat_messages, _ = _get_database()
    logger = _get_logger()
    utcnow = _get_utcnow()
    
    # SAFEGUARD 1: Reject empty payloads to prevent accidental data loss
    if not history:
        logger.warning(
            f"Refusing to replace general history with empty payload for user {user_id}",
            extra={"event_type": "general_history_replace_rejected_empty", "user_id": user_id}
        )
        return
    
    logger.info(f"Replacing general history for user {user_id}", extra={"event_type": "general_history_replace_start", "history_length": len(history)})
    user_data_id = await ensure_user_data_record(user_id)

    # SAFEGUARD 2: Use transaction for atomicity - if insert fails, delete is rolled back
    try:
        async with database.transaction():
            # Delete existing (will be rolled back if insert fails)
            await database.execute(
                general_chat_messages.delete().where(general_chat_messages.c.user_id == user_id)
            )
            
            # Insert new messages
            effective_user_data_id = user_data_id if user_data_id is not None else user_id
            values_list = []
            for entry in history:
                values_list.append({
                    "user_id": user_id,
                    "user_data_id": effective_user_data_id,
                    "role": entry.get("role"),
                    "content": entry.get("text") or "",
                    "grounding_metadata": json.dumps(entry.get("grounding_metadata")) if entry.get("grounding_metadata") else None,
                    "attachments": json.dumps(entry.get("attachments")) if entry.get("attachments") else None,
                    "reminders": json.dumps(entry.get("reminders")) if entry.get("reminders") else None,
                    "created_at": utcnow(),
                })

            if values_list:
                # SQLite has a 999-parameter limit; chunk to avoid "too many SQL variables"
                query = general_chat_messages.insert()
                chunk_size = 120  # 120 * 8 columns = 960 params (< 999)
                for i in range(0, len(values_list), chunk_size):
                    chunk = values_list[i:i + chunk_size]
                    await database.execute_many(query, chunk)
                    
        logger.info(
            f"Successfully replaced general history for user {user_id}",
            extra={"event_type": "general_history_replace_success", "message_count": len(history)}
        )
    except Exception as error:
        # Transaction will auto-rollback on exception, preserving original data
        logger.error(
            "Error replacing general conversation history (SQLite) - transaction rolled back, data preserved",
            exc_info=error,
            extra={
                "event_type": "sqlite_history_replace_error",
                "error": str(error),
                "history_length": len(history) if history else 0,
            },
        )
        raise  # Re-raise so caller knows the operation failed

    # Invalidate Redis cache for General conversation (best-effort)
    if find_spec("backend.chat_cache") is not None:
        invalidate_conversation_cache = import_module("backend.chat_cache").invalidate_conversation_cache
        general_conv_id = f"general:{user_id}"
        create_logged_task(
            invalidate_conversation_cache(general_conv_id),
            logger=logger,
            name="chat_cache.invalidate_general_conversation_cache",
        )


async def delete_general_conversation_history(
    user_id: int, db: "databases.Database | None" = None
) -> None:
    """Delete all general chat messages for a user."""
    database, general_chat_messages, _ = _get_database()
    logger = _get_logger()
    
    try:
        query = general_chat_messages.delete().where(general_chat_messages.c.user_id == user_id)
        await (db or database).execute(query)
    except Exception as error:
        logger.error(
            "Error deleting general conversation history (SQLite)",
            extra={"event_type": "sqlite_history_delete_error", "error": str(error)},
        )
