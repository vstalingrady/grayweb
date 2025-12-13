from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from backend.time_utils import utcnow, utcnow_aware
except Exception:  # pragma: no cover
    from time_utils import utcnow, utcnow_aware  # type: ignore

import databases
import sqlalchemy
from fastapi import HTTPException, status

logger = logging.getLogger("backend.chat_history")

try:
    from backend.database import database, user_chat_messages, user_chat_threads
except Exception:  # pragma: no cover - fallback when running backend/ directly
    from database import database, user_chat_messages, user_chat_threads  # type: ignore

try:
    from backend.core import conversation_store
    from backend.core.conversation_store import (
        CONVERSATION_HISTORY_CACHE,
        CONVERSATION_OWNER_CACHE,
        _conversation_store_available,
        _handle_conversation_store_error,
        _general_conversation_user_id,
        ensure_user_data_record,
        cache_conversation_history,
    )
except Exception:  # pragma: no cover - fallback when running backend/ directly
    from core import conversation_store  # type: ignore
    from core.conversation_store import (  # type: ignore
        CONVERSATION_HISTORY_CACHE,
        CONVERSATION_OWNER_CACHE,
        _conversation_store_available,
        _handle_conversation_store_error,
        _general_conversation_user_id,
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
                        entry["timestamp"] = int(created_at.timestamp() * 1000)
                except Exception:
                    # If parsing fails, omit timestamp rather than dropping history.
                    pass
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
    Updates both Supabase (when available) and local SQLite storage to ensure
    message deletions persist across cache expiry and page reloads.
    """
    updated_at_iso = utcnow_aware().isoformat().replace("+00:00", "Z")

    # 1. Update Supabase if available
    # 1. Update Supabase if available (Auth only, no data tables)
    # Supabase data operations removed.

    # 2. Update local SQLite database



    # 2. Update local SQLite database
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
        from chat_cache import invalidate_conversation_cache
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
    Update conversation metadata (title / ownership) in Supabase when
    available, falling back to a best-effort acknowledgement when storage
    is disabled or the ID is not a UUID.
    """
    from backend.core.conversation_store import _conversation_store_available as store_available

    normalized_title = normalize_conversation_title(payload)
    if normalized_title is None and getattr(payload, "user_id", None) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No conversation fields provided",
        )

    updated_at_iso = utcnow_aware().isoformat().replace("+00:00", "Z")
    storage_available = store_available()
    valid_conversation_id = _is_valid_uuid(conversation_id)

    local_user_data_id: Optional[int] = None
    supabase_user_data_id: Optional[int] = None
    target_user_id = getattr(payload, "user_id", None)
    if target_user_id is not None:
        if str(target_user_id) != str(current_user["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own conversations",
            )
        local_user_data_id = await ensure_user_data_record(target_user_id)
        if storage_available:
            supabase_user_data_id = await require_supabase_user_data_id(target_user_id)

    # 1. Update Local SQLite (Always try to update local DB first)
    if valid_conversation_id:
        try:
            # If metadata is present, we need to fetch existing metadata to merge it
            metadata_update = getattr(payload, "metadata", None)
            
            values_to_update = {"updated_at": utcnow()}
            if normalized_title:
                values_to_update["title"] = normalized_title
                
            if metadata_update is not None:
                 # Fetch existing to merge
                select_query = user_chat_threads.select().where(
                    user_chat_threads.c.id == conversation_id
                )
                existing = await database.fetch_one(select_query)
                if existing:
                    current_meta = dict(existing._mapping).get("metadata") or {}
                    # Handle stringified JSON if necessary (SQLite sometimes returns dict, sometimes str depending on driver)
                    if isinstance(current_meta, str):
                        import json
                        try:
                            current_meta = json.loads(current_meta)
                        except Exception:
                            current_meta = {}
                    
                    # Merge
                    merged = {**current_meta, **metadata_update}
                    values_to_update["metadata"] = merged

            # Only execute update if we have something to update
            if len(values_to_update) > 1 or (metadata_update is not None):
                query_update = user_chat_threads.update().where(
                    user_chat_threads.c.id == conversation_id
                ).values(**values_to_update)
                await database.execute(query_update)
        except Exception as error:
             _handle_conversation_store_error("Error updating local SQLite conversation", error)

    if storage_available and valid_conversation_id:
        update_values: Dict[str, Any] = {"updated_at": updated_at_iso}
        if normalized_title is not None:
            update_values["title"] = normalized_title
        if target_user_id is not None:
            update_values["user_identifier"] = target_user_id
            # Removed require_supabase_user_data_id usage

        try:
            result = conversation_store.supabase.table("user_chat_threads").update(
                update_values
            ).eq("id", conversation_id).execute()
            rows = result.data or []
            if not rows:
                secondary = (
                    conversation_store.supabase.table("user_chat_threads")
                    .select("id, title, created_at, updated_at")
                    .eq("id", conversation_id)
                    .limit(1)
                    .execute()
                )
                rows = secondary.data or []

            if rows:
                row = rows[0]
                return {
                    "id": row.get("id") or conversation_id,
                    "title": row.get("title"),
                    "created_at": row.get("created_at"),
                    "updated_at": row.get("updated_at"),
                }

            if target_user_id is not None:
                seed_title = normalized_title or "New Conversation"
                # Removed require_supabase_user_data_id usage
                try:
                    created = (
                        conversation_store.supabase.table("user_chat_threads")
                        .insert(
                            {
                                "id": conversation_id,
                                "user_identifier": target_user_id,
                                "user_data_id": local_user_data_id, # Fallback to local ID if needed, though this block is Supabase specific
                                "title": seed_title,
                                "context_snapshot": [],
                                "metadata": {},
                                "created_at": updated_at_iso,
                                "updated_at": updated_at_iso,
                            }
                        )
                        .execute()
                    )
                    created_rows = created.data or []
                    if not created_rows:
                        fallback_created = (
                            supabase.table("user_chat_threads")
                            .select("id, title, created_at, updated_at")
                            .eq("id", conversation_id)
                            .limit(1)
                            .execute()
                        )
                        created_rows = fallback_created.data or []
                    if created_rows:
                        row = created_rows[0]
                        return {
                            "id": row.get("id") or conversation_id,
                            "title": row.get("title"),
                            "created_at": row.get("created_at"),
                            "updated_at": row.get("updated_at"),
                        }
                except Exception as error:
                    _handle_conversation_store_error(
                        "Error creating missing conversation", error
                    )

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        except HTTPException:
            raise
        except Exception as error:
            _handle_conversation_store_error("Error updating conversation", error)
            storage_available = store_available()

    fallback_payload = {
        "id": conversation_id,
        "title": normalized_title,
        "created_at": updated_at_iso,
        "updated_at": updated_at_iso,
    }

    if not storage_available:
        # Since we updated local SQLite above, we can return success-ish payload
        return fallback_payload

    if not valid_conversation_id:
        # Fall back to acknowledgement without persistence when the ID is not
        # a UUID (e.g., local-only identifiers).
        return fallback_payload

    return fallback_payload


async def update_conversation_title(conversation_id: str, title: str) -> None:
    """Update the title of a conversation in Supabase AND local SQLite."""
    if not _is_valid_uuid(conversation_id):
        return

    # 1. Update Supabase
    if _conversation_store_available():
        try:
            conversation_store.supabase.table("user_chat_threads").update(
                {"title": title}
            ).eq("id", conversation_id).execute()
        except Exception as error:
            _handle_conversation_store_error("Error updating conversation title", error)

    # 2. Update Local SQLite
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
