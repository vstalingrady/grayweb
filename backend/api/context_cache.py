"""
Context Cache API routes.

This router handles context cache CRUD endpoints.
"""

from typing import Any, Dict

import databases
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.auth import get_current_user, require_same_user

from backend.database import context_cache, get_database

from backend.time_utils import utcnow

from backend.models import ContextCache, ContextCacheBase

from backend.core.serializers import serialize_context_cache as _serialize_context_cache
from backend.core.cache import invalidate_context_cache

router = APIRouter(tags=["context-cache"])


@router.post("/context-cache", response_model=ContextCache)
async def create_context_cache(
    request: Request,
    payload: ContextCacheBase,
    user_id: int = Query(..., description="ID of the user creating the context cache"),
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ContextCache:
    require_same_user(user_id, current_user)
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
