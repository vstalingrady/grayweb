"""Conversation management utilities.

Handles conversation CRUD operations including thread creation,
message persistence, and history loading.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    import databases

# Lazy imports
_database = None
_tables = None
_logger = None


def _get_database():
    """Get database connection."""
    global _database
    if _database is None:
        from backend.database import database
        _database = database
    return _database


def _get_tables():
    """Get database tables."""
    global _tables
    if _tables is None:
        from backend.database import user_chat_threads, user_chat_messages
        _tables = {"threads": user_chat_threads, "messages": user_chat_messages}
    return _tables


def _get_logger():
    """Get logger."""
    global _logger
    if _logger is None:
        from backend.logging_config import create_logger
        _logger = create_logger("backend.conversation_manager")
    return _logger


def _get_utcnow():
    """Get utcnow function."""
    from backend.time_utils import utcnow
    return utcnow


def _is_valid_uuid(value):
    """Check if value is a valid UUID."""
    if not value:
        return False
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False


def _get_conversation_store_helpers():
    """Get conversation store helpers."""
    from backend.core.chat_history import load_thread_history
    from backend.core.conversation_store import (
        CONVERSATION_OWNER_CACHE,
        GENERAL_CONVERSATION_PREFIX,
        _handle_conversation_store_error,
        _general_conversation_user_id,
        append_to_conversation_cache,
    )
    return {
        "CONVERSATION_OWNER_CACHE": CONVERSATION_OWNER_CACHE,
        "GENERAL_CONVERSATION_PREFIX": GENERAL_CONVERSATION_PREFIX,
        "_handle_conversation_store_error": _handle_conversation_store_error,
        "_general_conversation_user_id": _general_conversation_user_id,
        "load_thread_history": load_thread_history,
        "append_to_conversation_cache": append_to_conversation_cache,
    }


def _get_general_conversation_funcs():
    """Get general conversation functions."""
    from backend.core.general_conversation import (
        load_general_conversation_history,
        insert_general_conversation_message,
        ensure_user_data_record,
    )
    return {
        "load_history": load_general_conversation_history,
        "insert_message": insert_general_conversation_message,
        "ensure_user_data": ensure_user_data_record,
    }


async def load_conversation_history(conversation_id: str, user_id: int) -> List[Dict[str, Any]]:
    """Load a conversation's messages.

    General-chat IDs are handled via the local general_chat_messages store;
    thread conversations delegate to the shared chat_history module.
    """
    logger = _get_logger()
    helpers = _get_conversation_store_helpers()
    gen_funcs = _get_general_conversation_funcs()
    
    _general_conversation_user_id = helpers["_general_conversation_user_id"]
    load_thread_history = helpers["load_thread_history"]
    load_general_conversation_history = gen_funcs["load_history"]
    
    general_user_id = _general_conversation_user_id(conversation_id)
    if general_user_id is not None:
        # Enforce ownership for general chat
        if general_user_id != user_id:
            logger.warning(
                f"Access denied for general chat: user {user_id} tried to access {conversation_id}",
                extra={"event_type": "security_violation_general_chat"}
            )
            return []
        return await load_general_conversation_history(general_user_id)

    # Thread conversations handled by shared chat_history module.
    return await load_thread_history(conversation_id, user_id)


async def get_or_create_conversation(
    conversation_id: Optional[str],
    user_id: int,
    *,
    title: Optional[str] = None,
) -> str:
    """Get existing conversation or create a new one."""
    database = _get_database()
    tables = _get_tables()
    helpers = _get_conversation_store_helpers()
    gen_funcs = _get_general_conversation_funcs()
    utcnow = _get_utcnow()
    
    user_chat_threads = tables["threads"]
    CONVERSATION_OWNER_CACHE = helpers["CONVERSATION_OWNER_CACHE"]
    _handle_conversation_store_error = helpers["_handle_conversation_store_error"]
    _ensure_user_data_record = gen_funcs["ensure_user_data"]
    
    valid_id = conversation_id if _is_valid_uuid(conversation_id) else None
    if valid_id:
        cached_owner = CONVERSATION_OWNER_CACHE.get(valid_id)
        if str(cached_owner) == str(user_id):
            return valid_id
        try:
            query = user_chat_threads.select().where(
                (user_chat_threads.c.id == valid_id) & 
                (user_chat_threads.c.user_identifier == user_id)
            )
            row = await database.fetch_one(query)
            if row:
                CONVERSATION_OWNER_CACHE.set(valid_id, user_id)
                return valid_id
        except Exception as error:
            _handle_conversation_store_error("Error checking conversation", error)
            raise HTTPException(status_code=503, detail="Conversation storage is not available.")

    user_data_id: Optional[int] = None
    try:
        user_data_id = await _ensure_user_data_record(user_id)
        if user_data_id is None:
            raise HTTPException(status_code=503, detail="User metadata storage is not available.")
        
        new_id = str(uuid.uuid4())
        now = utcnow()
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
        raise HTTPException(status_code=503, detail="Conversation storage is not available.")

    raise HTTPException(status_code=500, detail="Failed to create conversation.")


async def save_conversation_message(
    conversation_id: str,
    message: Dict[str, Any],
    *,
    user_id: Optional[int] = None,
) -> Optional[int]:
    """Persist a single message for a conversation."""
    database = _get_database()
    tables = _get_tables()
    helpers = _get_conversation_store_helpers()
    gen_funcs = _get_general_conversation_funcs()
    logger = _get_logger()
    utcnow = _get_utcnow()
    
    user_chat_messages = tables["messages"]
    user_chat_threads = tables["threads"]
    _general_conversation_user_id = helpers["_general_conversation_user_id"]
    _handle_conversation_store_error = helpers["_handle_conversation_store_error"]
    append_to_conversation_cache = helpers["append_to_conversation_cache"]
    _insert_general_conversation_message = gen_funcs["insert_message"]
    
    raw_role = message.get("role")
    if not raw_role:
        return None
    role = "model" if raw_role == "assistant" else raw_role
    if role not in {"user", "model"}:
        return None
    text = message.get("text") or ""
    grounding_metadata = message.get("grounding_metadata") or message.get("groundingMetadata")

    general_user_id = _general_conversation_user_id(conversation_id)
    if general_user_id is not None:
        return await _insert_general_conversation_message(
            user_id=general_user_id,
            role=role,
            text=text,
            grounding_metadata=grounding_metadata,
            attachments=message.get("attachments"),
        )

    # Regular thread message
    try:
        insert_query = user_chat_messages.insert().values(
            thread_id=conversation_id,
            role=role,
            text=text,
            grounding_metadata=grounding_metadata,
            attachments=message.get("attachments"),
            created_at=utcnow(),
        )
        message_id = await database.execute(insert_query)
        
        update_query = (
            user_chat_threads.update()
            .where(user_chat_threads.c.id == conversation_id)
            .values(last_message_at=utcnow(), updated_at=utcnow())
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
        return message_id
        
    except Exception as error:
        _handle_conversation_store_error("Error saving message", error)
        logger.error(f"Failed to save message to thread {conversation_id}: {error}")
        return None
