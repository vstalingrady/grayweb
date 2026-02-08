"""
Context Cache API routes.

This router handles context cache CRUD endpoints.
"""

import os
import uuid
from typing import Any, Dict

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.auth import get_current_user, require_same_user

from backend.database import context_cache, get_database, user_chat_threads

from backend.time_utils import utcnow

from backend.models import ContextCache, ContextCacheBase

from backend.core.serializers import serialize_context_cache as _serialize_context_cache
from backend.core.cache import invalidate_context_cache

router = APIRouter(tags=["context-cache"])


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


CONTEXT_CACHE_MAX_CONTENT_CHARS = _int_env("CONTEXT_CACHE_MAX_CONTENT_CHARS", 20_000)


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


async def _require_conversation_owned_by_user(
    db: databases.Database,
    *,
    user_id: int,
    conversation_id: str,
) -> None:
    normalized = (conversation_id or "").strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="conversation_id cannot be blank.",
        )

    if normalized.startswith("general:"):
        try:
            owner_id = int(normalized.split(":", 1)[1])
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid conversation_id format.",
            )
        if owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own conversations.",
            )
        return

    if not _is_valid_uuid(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="conversation_id must be a valid conversation id.",
        )

    row = await db.fetch_one(
        user_chat_threads.select().where(user_chat_threads.c.id == normalized)
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    if str(row["user_identifier"]) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own conversations.",
        )


@router.post("/context-cache", response_model=ContextCache)
async def create_context_cache(
    request: Request,
    payload: ContextCacheBase,
    user_id: int = Query(..., description="ID of the user creating the context cache"),
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ContextCache:
    require_same_user(user_id, current_user)
    if len(payload.content) > CONTEXT_CACHE_MAX_CONTENT_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"content exceeds {CONTEXT_CACHE_MAX_CONTENT_CHARS} characters.",
        )
    if payload.conversation_id:
        await _require_conversation_owned_by_user(
            db,
            user_id=user_id,
            conversation_id=payload.conversation_id,
        )
    now = utcnow()
    query = context_cache.insert().values(
        user_id=user_id,
        conversation_id=payload.conversation_id,
        label=payload.label,
        content=payload.content,
        created_at=now,
    )
    cache_id = await db.execute(query)
    return ContextCache(
        id=cache_id,
        user_id=user_id,
        conversation_id=payload.conversation_id,
        label=payload.label,
        content=payload.content,
        created_at=now,
    )


@router.get("/context-cache/{cache_id}", response_model=ContextCache)
async def get_context_cache(
    request: Request,
    cache_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    record = await db.fetch_one(
        context_cache.select().where(context_cache.c.id == cache_id)
    )
    payload = _serialize_context_cache(record)
    if not payload:
        raise HTTPException(status_code=404, detail="Context cache not found.")
    require_same_user(payload["user_id"], current_user)
    return ContextCache(**payload)


@router.delete("/context-cache/{cache_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_context_cache(
    request: Request,
    cache_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> None:
    record = await db.fetch_one(
        context_cache.select().where(context_cache.c.id == cache_id)
    )
    payload = _serialize_context_cache(record)
    if not payload:
        raise HTTPException(status_code=404, detail="Context cache not found.")
    require_same_user(payload["user_id"], current_user)
    await db.execute(context_cache.delete().where(context_cache.c.id == cache_id))
    await invalidate_context_cache(cache_id, payload.get("user_id"))
