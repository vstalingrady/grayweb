"""
Conversations API routes.

This router handles all conversation CRUD operations, compression, and usage stats.
"""

import os
from datetime import datetime
from typing import Any, Dict, List

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.auth import get_current_user, require_same_user
from backend.database import get_database
from backend.logging_config import create_logger

from backend.core.rate_limit import limiter

from backend.tier_utils import normalize_plan_tier

from backend.chat_cache import cache_messages, get_cached_messages, invalidate_conversation_cache
from backend.token_utils import estimate_tokens

router = APIRouter(tags=["conversations"])

api_logger = create_logger("backend.api.conversations")


def _get_conversation_helpers():
    """Lazy import conversation helpers to avoid circular imports."""
    from backend.main import (
        _require_conversation_owner,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _handle_conversation_store_error,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
    )
    from backend.compat_imports import (
        _load_conversation_history,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        _is_valid_uuid,
    )
    from backend.api.chat_models import (
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
    )
    from backend.models import (
        ChatSession,
        ChatSessionCreate,
    )
    return (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    )


@router.post("/api/conversation/{conversation_id}/message")
@router.post("/api/conversation/{conversation_id}/messages")
@limiter.limit("30/minute")
async def create_conversation_message(
    request: Request,
    conversation_id: str,
    payload: Any,  # Will be MessageCreateRequest
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Manually append a message to a conversation history."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        await _require_conversation_owner(conversation_id, current_user)
        if payload.user_id is not None:
            require_same_user(payload.user_id, current_user)
        payload_dict = {
            "role": payload.role,
            "text": payload.text
        }
        await save_conversation_message(conversation_id, payload_dict, user_id=payload.user_id)
        
        # Invalidate cache since conversation changed
        try:
            await invalidate_conversation_cache(conversation_id)
        except Exception as e:
            api_logger.debug(f"Cache invalidation failed for {conversation_id}: {e}")
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving message: {str(e)}")


@router.get("/api/conversation/{conversation_id}")
@limiter.limit("60/minute")
async def get_conversation(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get conversation history with Redis caching."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        await _require_conversation_owner(conversation_id, current_user)
        
        # Try Redis cache first
        cached = await get_cached_messages(conversation_id)
        if cached is not None:
            return cached
        
        # Fetch from database
        history = await _load_conversation_history(conversation_id, current_user["id"])
        
        # Cache the result
        try:
            if isinstance(history, list):
                await cache_messages(conversation_id, history)
        except Exception as e:
            api_logger.debug(f"Cache write failed for {conversation_id}: {e}")
        
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")


@router.post("/api/conversation")
@limiter.limit("30/minute")
async def create_conversation(
    request: Request,
    payload: Any,  # Will be ConversationCreateRequest
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a new conversation"""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        require_same_user(payload.user_id, current_user)
        conversation_id = await get_or_create_conversation(
            None, payload.user_id, title=payload.title
        )
        return {
            "id": conversation_id,
            "title": payload.title,
            "history": [],
            "user_id": payload.user_id,
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(error)}")


@router.delete("/api/conversation/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_conversation(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a conversation and all of its stored messages."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        await _require_conversation_owner(conversation_id, current_user)
        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None:
            await _delete_general_conversation_history(general_user_id)
            invalidate_conversation_cache(conversation_id)
            return

        if _is_valid_uuid(conversation_id):
            try:
                from backend.database import (
                    user_chat_threads as _user_chat_threads,
                    user_chat_messages as _user_chat_messages,
                )

                await database.execute(_user_chat_messages.delete().where(_user_chat_messages.c.thread_id == conversation_id))
                await database.execute(_user_chat_threads.delete().where(_user_chat_threads.c.id == conversation_id))
            except Exception as error:
                _handle_conversation_store_error("Error deleting conversation", error)
        invalidate_conversation_cache(conversation_id)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(error)}")


@router.delete("/users/{user_id}/conversations", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_all_conversations(
    request: Request,
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Delete all conversations and messages for a user."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        # Force the user_id to be the authenticated user's ID
        user_id = current_user["id"]

        # 1. Delete General Chat History
        await _delete_general_conversation_history(user_id, db=db)
        invalidate_conversation_cache(f"general:{user_id}")

        # 2. Delete All Named Threads (and their messages)
        try:
            from backend.database import (
                user_chat_threads as _user_chat_threads,
                user_chat_messages as _user_chat_messages,
            )

            query = _user_chat_threads.select().where(_user_chat_threads.c.user_identifier == user_id)
            rows = await db.fetch_all(query)
            thread_ids = [str(row["id"]) for row in rows]

            if thread_ids:
                await db.execute(_user_chat_messages.delete().where(_user_chat_messages.c.thread_id.in_(thread_ids)))
                await db.execute(_user_chat_threads.delete().where(_user_chat_threads.c.id.in_(thread_ids)))

                for thread_id in thread_ids:
                    invalidate_conversation_cache(thread_id)

        except Exception as db_error:
            app_logger.error(f"Error checking/deleting named threads: {db_error}")

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error deleting all conversations: {str(error)}")


async def _overwrite_conversation_history_logic(
    conversation_id: str,
    payload: Any,  # ConversationHistoryPayload
    current_user: Dict[str, Any],
    *,
    allow_truncate: bool = False,
):
    """Internal logic for overwriting conversation history."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        await _require_conversation_owner(conversation_id, current_user)
        app_logger.info(
            f"Overwriting history for conversation {conversation_id}",
            extra={
                "event_type": "history_overwrite_start",
                "message_count": len(payload.messages),
            },
        )
        normalized_history = normalize_conversation_history(payload.messages)
        incoming_len = len(normalized_history)

        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None and not allow_truncate:
            existing_len = 0
            try:
                existing_history = await _load_conversation_history(conversation_id, current_user["id"])
                if isinstance(existing_history, list):
                    existing_len = len(existing_history)
            except Exception as error:
                app_logger.warning(
                    "Failed to load existing general history for overwrite guard",
                    extra={
                        "event_type": "history_overwrite_guard_load_failed",
                        "conversation_id": conversation_id,
                        "user_id": current_user.get("id"),
                        "error": str(error),
                    },
                )

            if incoming_len == 0:
                app_logger.warning(
                    "Refusing to overwrite general history with empty payload",
                    extra={
                        "event_type": "history_overwrite_rejected_empty",
                        "conversation_id": conversation_id,
                        "user_id": current_user.get("id"),
                        "existing_count": existing_len,
                    },
                )
                return {
                    "id": conversation_id,
                    "message_count": existing_len,
                    "skipped": True,
                    "reason": "empty_payload",
                }

            if existing_len >= 8:
                min_keep = max(5, existing_len // 2)
                if incoming_len < min_keep:
                    app_logger.warning(
                        "Refusing to overwrite general history with suspiciously small payload",
                        extra={
                            "event_type": "history_overwrite_rejected_truncation",
                            "conversation_id": conversation_id,
                            "user_id": current_user.get("id"),
                            "existing_count": existing_len,
                            "incoming_count": incoming_len,
                            "min_keep": min_keep,
                        },
                    )
                    return {
                        "id": conversation_id,
                        "message_count": existing_len,
                        "skipped": True,
                        "reason": "suspicious_truncation",
                    }

        if general_user_id is not None:
            await _replace_general_conversation_history(
                general_user_id, normalized_history
            )
            invalidate_conversation_cache(conversation_id)
            return {
                "id": conversation_id,
                "message_count": len(normalized_history),
            }

        result = await overwrite_thread_history(
            conversation_id, normalized_history, current_user["id"]
        )
        invalidate_conversation_cache(conversation_id)
        return result
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error overwriting conversation history: {str(error)}",
        )


@router.put("/api/conversation/{conversation_id}/history")
@limiter.limit("20/minute")
async def overwrite_conversation_history(
    request: Request,
    conversation_id: str,
    payload: Any,  # ConversationHistoryPayload
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Replace the full message history for a conversation."""
    return await _overwrite_conversation_history_logic(conversation_id, payload, current_user)


@router.patch("/api/conversation/{conversation_id}/metadata")
@limiter.limit("30/minute")
async def update_conversation(
    request: Request,
    conversation_id: str,
    payload: Any,  # ConversationUpdateRequest
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update conversation metadata such as its title."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    return await apply_conversation_update(conversation_id, payload, current_user)


@router.post("/api/conversation/{conversation_id}/metadata")
@limiter.limit("30/minute")
async def update_conversation_metadata(
    request: Request,
    conversation_id: str,
    payload: Any,  # ConversationUpdateRequest
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update metadata via POST for clients that cannot rely on PATCH."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    return await apply_conversation_update(conversation_id, payload, current_user)


@router.get("/api/conversation/{conversation_id}/usage")
@limiter.limit("60/minute")
async def get_conversation_usage(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get conversation usage statistics"""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        await _require_conversation_owner(conversation_id, current_user)
        history = await _load_conversation_history(conversation_id, current_user["id"])
        
        message_count = len(history)
        
        total_tokens = sum(estimate_tokens(str(msg.get("text", ""))) for msg in history)

        user_tier = normalize_plan_tier(
            current_user.get("plan_tier"),
            current_user.get("role"),
            current_user.get("subscription_expires_at")
        )

        tier_context_limit = tier_conversation_token_limit(user_tier)
        
        provider = os.getenv("AI_PROVIDER", "openrouter")
        model_name = os.getenv("AI_MODEL_NAME", None)
        
        model_context_limit = tier_context_limit
        context_warning = None
        suggested_models = None
        
        if user_tier == "pioneer" and model_name:
            model_context_limit = OPENROUTER_SERVICE.get_model_context_limit(model_name)
            
            if total_tokens > model_context_limit:
                higher_context_models = []
                for model_id, limit in OPENROUTER_SERVICE.MODEL_CONTEXT_LIMITS.items():
                    if limit > model_context_limit:
                        friendly_name = model_id.split("/")[-1] if "/" in model_id else model_id
                        higher_context_models.append({
                            "model_id": model_id,
                            "name": friendly_name,
                            "context_limit": limit
                        })
                
                higher_context_models.sort(key=lambda x: x["context_limit"], reverse=True)
                
                if higher_context_models:
                    context_warning = f"This conversation ({total_tokens:,} tokens) exceeds {model_name}'s context limit ({model_context_limit:,} tokens). Consider switching models."
                    suggested_models = higher_context_models[:3]
        
        return {
            "conversation_id": conversation_id,
            "message_count": message_count,
            "conversation_tokens": total_tokens,
            "limit": tier_context_limit,
            "model_limit": model_context_limit,
            "provider": provider,
            "model_name": model_name,
            "model_label": model_name,
            "user_tier": user_tier,
            "context_warning": context_warning,
            "suggested_models": suggested_models,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation usage: {str(e)}")


@router.post("/api/conversation/{conversation_id}/compress")
@limiter.limit("5/minute")
async def compress_conversation(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Compress a conversation by summarizing its history"""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    try:
        await _require_conversation_owner(conversation_id, current_user)
        history = await _load_conversation_history(conversation_id, current_user["id"])
        
        if len(history) < 2:
            return {
                "success": False,
                "message": "Conversation too short to compress (need at least 2 messages)"
            }
        
        original_chars = sum(len(msg.get("text", "")) for msg in history)
        original_tokens = original_chars // 4
        
        conversation_text = "\n\n".join([
            f"{msg.get('role', 'unknown').upper()}: {msg.get('text', '')}"
            for msg in history
        ])
        
        summary_prompt = f"""Please provide a concise summary of the following conversation, preserving all key information, decisions, and context. The summary should be detailed enough that the conversation can continue naturally from this point.

Conversation:
{conversation_text}

Summary:"""
        
        summary_text = ""
        if GEMINI_SERVICE.available:
            try:
                summary_response = await GEMINI_SERVICE.generate(
                    summary_prompt,
                    conversation_history=[],
                    workspace_context=None,
                    system_prompt=None,
                    time_context="UTC",
                    model=None,
                )
                summary_text = getattr(summary_response, "text", "") or ""
            except Exception as gemini_error:
                api_logger.warning(
                    "Gemini summary generation failed; skipping compression",
                    extra={"error": str(gemini_error)},
                )
        
        if not summary_text:
            return {
                "success": False,
                "message": "Failed to generate summary"
            }
        
        compressed_history = [
            {
                "role": "model",
                "text": f"[CONVERSATION SUMMARY]\n\n{summary_text}\n\n[END SUMMARY - Conversation continues below]"
            }
        ]
        
        await _overwrite_conversation_history_logic(
            conversation_id,
            ConversationHistoryPayload(messages=compressed_history),
            current_user,
            allow_truncate=True,
        )
        
        new_chars = len(summary_text)
        new_tokens = new_chars // 4
        saved_tokens = original_tokens - new_tokens
        
        return {
            "success": True,
            "message": f"Conversation compressed! Reduced from {original_tokens} to {new_tokens} tokens (saved {saved_tokens} tokens)"
        }
    except Exception as e:
        api_logger.error(f"Error compressing conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error compressing conversation: {str(e)}")


@router.post("/users/{user_id}/chat-sessions", status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    user_id: int,
    session: Any,  # ChatSessionCreate
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a new chat session."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    query = chat_sessions.insert().values(
        user_id=user_id,
        title=session.title,
        scope="thread"
    )
    session_id = await db.execute(query)
    return {**session.dict(), "id": session_id, "user_id": user_id}


@router.get("/users/{user_id}/conversations", response_model=List[Dict[str, Any]])
async def list_user_conversations(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    db: databases.Database = Depends(get_database),
):
    """List all conversations for a user."""
    (
        _require_conversation_owner,
        _load_conversation_history,
        _general_conversation_user_id,
        _delete_general_conversation_history,
        _replace_general_conversation_history,
        _is_valid_uuid,
        _handle_conversation_store_error,
        save_conversation_message,
        get_or_create_conversation,
        normalize_conversation_history,
        overwrite_thread_history,
        apply_conversation_update,
        invalidate_conversation_cache,
        database,
        app_logger,
        GEMINI_SERVICE,
        OPENROUTER_SERVICE,
        chat_sessions,
        tier_conversation_token_limit,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationHistoryPayload,
        ConversationUpdateRequest,
        ChatSession,
        ChatSessionCreate,
    ) = _get_conversation_helpers()
    
    # Force the user_id to be the authenticated user's ID
    user_id = current_user["id"]
    
    try:
        from backend.database import user_chat_threads

        query = (
            user_chat_threads.select()
            .where(user_chat_threads.c.user_identifier == user_id)
            .where(~user_chat_threads.c.id.like("general:%"))
            .order_by(user_chat_threads.c.last_message_at.desc())
            .limit(limit)
        )
        rows = await db.fetch_all(query)
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            created_at = row["created_at"]
            updated_at = row["updated_at"]
            last_message_at = row["last_message_at"]
            
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat() + "Z"
            if isinstance(updated_at, datetime):
                updated_at = updated_at.isoformat() + "Z"
            if isinstance(last_message_at, datetime):
                last_message_at = last_message_at.isoformat() + "Z"
            
            normalized.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "last_message_at": last_message_at,
                }
            )
        return normalized
    except Exception as error:
        app_logger.error(f"Failed to list conversations from local database: {error}", exc_info=True)
        return []
