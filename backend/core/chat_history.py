from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from backend.time_utils import utcnow, utcnow_aware
except Exception:  # pragma: no cover
    from time_utils import utcnow, utcnow_aware  # type: ignore

from fastapi import HTTPException, status

logger = logging.getLogger("backend.chat_history")

try:
    from backend.database import database, user_chat_messages, user_chat_threads
except Exception:  # pragma: no cover - fallback when running backend/ directly
    from database import database, user_chat_messages, user_chat_threads  # type: ignore

try:
    from backend.core.conversation_store import (
        CONVERSATION_HISTORY_CACHE,
        CONVERSATION_OWNER_CACHE,
        _handle_conversation_store_error,
        ensure_user_data_record,
        cache_conversation_history,
    )
except Exception:  # pragma: no cover - fallback when running backend/ directly
    from core.conversation_store import (  # type: ignore
        CONVERSATION_HISTORY_CACHE,
        CONVERSATION_OWNER_CACHE,
        _handle_conversation_store_error,
        ensure_user_data_record,
        cache_conversation_history,
    )


def _is_valid_uuid(val: Optional[Any]) -> bool:
    """Safe UUID validator used for conversation IDs."""
    from uuid import UUID

    if not isinstance(val, str) or not val:
        return False
    try:
        uuid_obj = UUID(val)
        return str(uuid_obj) == val
    except (ValueError, TypeError, AttributeError):
        return False


def normalize_conversation_history(
    history: Optional[List[Dict[str, Any]]]
) -> List[Dict[str, Any]]:
    """Normalize a loosely-typed conversation history into user/model turns."""
    if not history:
        return []

    normalized: List[Dict[str, Any]] = []
    last_role: Optional[str] = None
    last_text: Optional[str] = None

    for entry in history:
        raw_role = entry.get("role")
        if not raw_role:
            continue

        role = "model" if raw_role == "assistant" else raw_role
        if role not in {"user", "model"}:
            continue

        text = entry.get("text") or ""

        # Deduplicate consecutive identical messages so that if the same user
        # message is accidentally persisted twice, it only influences context once.
        if last_role == role and last_text == text:
            continue

        normalized.append({"role": role, "text": text})
        last_role = role
        last_text = text

    return normalized


async def load_thread_history(conversation_id: str, user_id: int) -> List[Dict[str, Any]]:
    """
    Load a non-general conversation's messages from local SQLite storage,
    enforcing ownership and using the shared conversation caches.
    """
    if not _is_valid_uuid(conversation_id):
        return []

    cached_owner = CONVERSATION_OWNER_CACHE.get(conversation_id)
    if cached_owner == user_id:
        cached_history = CONVERSATION_HISTORY_CACHE.get(conversation_id)
        if cached_history is not None:
            return [dict(message) for message in cached_history]

    # Verify ownership in local SQLite
    try:
        query = user_chat_threads.select().where(
            (user_chat_threads.c.id == conversation_id)
            & (user_chat_threads.c.user_identifier == user_id)
        )
        row = await database.fetch_one(query)
        if not row:
            return []
        CONVERSATION_OWNER_CACHE.set(conversation_id, user_id)
    except Exception as error:
        logger.warning("Failed to verify thread ownership: %s", error)
        return []

    # Load messages from local SQLite
    try:
        query = (
            user_chat_messages.select()
            .where(user_chat_messages.c.thread_id == conversation_id)
            .order_by(user_chat_messages.c.created_at.asc())
        )
        rows = await database.fetch_all(query)

        messages: List[Dict[str, Any]] = []
        for row in rows:
            entry = {
                "role": row["role"],
                "text": row["text"],
                "grounding_metadata": row["grounding_metadata"],
                "attachments": row["attachments"],
            }
            # Include timestamp so frontend displays the actual message time
            # We default to 0 (epoch) if missing so the frontend doesn't fall back to "now"
            timestamp_ms = 0
            if row["created_at"]:
                created_at = row["created_at"]
                try:
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(
                            created_at.replace("Z", "+00:00")
                        )
                    if isinstance(created_at, datetime):
                        if created_at.tzinfo is None:
                            created_at = created_at.replace(tzinfo=timezone.utc)
                        else:
                            created_at = created_at.astimezone(timezone.utc)
                        timestamp_ms = int(created_at.timestamp() * 1000)
                except Exception:
                    # If parsing fails, ensure we still send a stable (though wrong) time
                    # using 0 means it will show as "Dec 31, 1969" or similar, which is better
                    # for debugging than "Just now" on every reload.
                    timestamp_ms = 0
            
            entry["timestamp"] = timestamp_ms if timestamp_ms > 0 else 0
            messages.append(entry)
        cache_conversation_history(conversation_id, user_id, messages)
        return messages
    except Exception as error:
        _handle_conversation_store_error(
            "Warning: User chat messages table not found or inaccessible", error
        )
        return []


async def overwrite_thread_history(
    conversation_id: str,
    normalized_history: List[Dict[str, Any]],
    user_id: int,
) -> Dict[str, Any]:
    """
    Overwrite the history for a single thread conversation (non-general).
    Uses local SQLite storage so message deletions persist across cache expiry
    and page reloads.
    """
    if _is_valid_uuid(conversation_id):
        try:
            # Delete existing messages for this thread
            delete_query = user_chat_messages.delete().where(
                user_chat_messages.c.thread_id == conversation_id
            )
            await database.execute(delete_query)

            # Insert the new history
            if normalized_history:
                now = utcnow()
                values_list = []
                for entry in normalized_history:
                    values_list.append({
                        "thread_id": conversation_id,
                        "role": entry.get("role"),
                        "text": entry.get("text") or "",
                        "grounding_metadata": entry.get("grounding_metadata"),
                        "attachments": entry.get("attachments"),
                        "created_at": now,
                    })

                if values_list:
                    # SQLite has a 999-parameter limit; chunk to avoid overflow
                    insert_query = user_chat_messages.insert()
                    chunk_size = 150  # 150 * 6 columns = 900 params (< 999)
                    for i in range(0, len(values_list), chunk_size):
                        chunk = values_list[i:i + chunk_size]
                        await database.execute_many(insert_query, chunk)

            # Update thread timestamps
            update_query = user_chat_threads.update().where(
                user_chat_threads.c.id == conversation_id
            ).values(updated_at=utcnow(), last_message_at=utcnow())
            await database.execute(update_query)
        except Exception as error:
            _handle_conversation_store_error(
                "Error overwriting conversation history in local SQLite", error
            )

    # 3. Invalidate Redis cache so deleted messages don't reappear
    try:
        from backend.chat_cache import invalidate_conversation_cache
    except ImportError:  # pragma: no cover
        from chat_cache import invalidate_conversation_cache  # type: ignore
    try:
        import asyncio
        asyncio.create_task(invalidate_conversation_cache(conversation_id))
    except ImportError:
        pass  # Redis cache module not available

    # 4. Update in-memory cache
    cache_conversation_history(conversation_id, user_id, normalized_history)
    return {"id": conversation_id, "message_count": len(normalized_history)}


def normalize_conversation_title(payload: Any) -> Optional[str]:
    title = getattr(payload, "title", None)
    if title is None:
        return None
    normalized = str(title).strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation title cannot be empty",
        )
    return normalized


async def apply_conversation_update(
    conversation_id: str,
    payload: Any,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Update conversation metadata (title / ownership) in local SQLite.
    """
    normalized_title = normalize_conversation_title(payload)
    metadata_update = getattr(payload, "metadata", None)
    target_user_id = getattr(payload, "user_id", None)
    if normalized_title is None and metadata_update is None and target_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No conversation fields provided",
        )

    updated_at_iso = utcnow_aware().isoformat().replace("+00:00", "Z")
    valid_conversation_id = _is_valid_uuid(conversation_id)

    if target_user_id is not None and str(target_user_id) != str(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own conversations",
        )

    fallback_payload = {
        "id": conversation_id,
        "title": normalized_title,
        "created_at": updated_at_iso,
        "updated_at": updated_at_iso,
    }

    if not valid_conversation_id:
        return fallback_payload

    owner_user_id = int(target_user_id) if target_user_id is not None else int(current_user["id"])
    user_data_id = await ensure_user_data_record(owner_user_id)
    if user_data_id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User metadata storage is not available.",
        )

    def _as_iso(value: Any) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, datetime):
            dt_value = value
            if dt_value.tzinfo is None:
                dt_value = dt_value.replace(tzinfo=timezone.utc)
            else:
                dt_value = dt_value.astimezone(timezone.utc)
            return dt_value.isoformat().replace("+00:00", "Z")
        return updated_at_iso

    now = utcnow()
    try:
        select_query = user_chat_threads.select().where(user_chat_threads.c.id == conversation_id)
        existing = await database.fetch_one(select_query)

        if existing:
            values_to_update: Dict[str, Any] = {"updated_at": now}
            if normalized_title is not None:
                values_to_update["title"] = normalized_title

            if target_user_id is not None:
                values_to_update["user_identifier"] = owner_user_id
                values_to_update["user_data_id"] = user_data_id

            if metadata_update is not None and isinstance(metadata_update, dict):
                current_meta = dict(existing._mapping).get("metadata") or {}
                if isinstance(current_meta, str):
                    import json

                    try:
                        current_meta = json.loads(current_meta)
                    except Exception:
                        current_meta = {}
                if not isinstance(current_meta, dict):
                    current_meta = {}
                values_to_update["metadata"] = {**current_meta, **metadata_update}

            await database.execute(
                user_chat_threads.update()
                .where(user_chat_threads.c.id == conversation_id)
                .values(**values_to_update)
            )
        else:
            seed_title = normalized_title or "New Conversation"
            seed_metadata: Dict[str, Any] = metadata_update if isinstance(metadata_update, dict) else {}

            await database.execute(
                user_chat_threads.insert().values(
                    id=conversation_id,
                    user_data_id=user_data_id,
                    user_identifier=owner_user_id,
                    title=seed_title,
                    summary=None,
                    context_snapshot=[],
                    metadata=seed_metadata,
                    created_at=now,
                    updated_at=now,
                    last_message_at=now,
                )
            )

        updated = await database.fetch_one(select_query)
        if not updated:
            return fallback_payload

        CONVERSATION_OWNER_CACHE.set(conversation_id, owner_user_id)
        return {
            "id": conversation_id,
            "title": dict(updated._mapping).get("title"),
            "created_at": _as_iso(dict(updated._mapping).get("created_at")),
            "updated_at": _as_iso(dict(updated._mapping).get("updated_at")),
        }
    except HTTPException:
        raise
    except Exception as error:
        _handle_conversation_store_error("Error updating local SQLite conversation", error)
        return fallback_payload


async def update_conversation_title(conversation_id: str, title: str) -> None:
    """Update the title of a conversation in local SQLite."""
    if not _is_valid_uuid(conversation_id):
        return

    try:
        query = user_chat_threads.update().where(
            user_chat_threads.c.id == conversation_id
        ).values(title=title, updated_at=utcnow())
        await database.execute(query)
    except Exception as error:
        _handle_conversation_store_error("Error updating local conversation title", error)


__all__ = [
    "normalize_conversation_history",
    "load_thread_history",
    "overwrite_thread_history",
    "normalize_conversation_title",
    "apply_conversation_update",
    "update_conversation_title",
]
