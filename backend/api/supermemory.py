from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.auth import get_current_user
from backend.compat_imports import row_get as _row_get
from backend.supermemory import SUPERMEMORY_SERVICE, MEMORY_CATEGORIES, detect_memory_category
from backend.tier_utils import normalize_plan_tier

router = APIRouter(tags=["supermemory"])


class SupermemoryStoreRequest(BaseModel):
    text: str = Field(..., min_length=1)
    category: Optional[str] = None


class SupermemorySearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    limit: Optional[int] = Field(5, ge=1, le=20)


class SupermemoryProfileRequest(BaseModel):
    query: Optional[str] = None


class SupermemoryForgetRequest(BaseModel):
    query: Optional[str] = None
    memory_id: Optional[str] = None


class SupermemoryWipeRequest(BaseModel):
    confirm: bool = False


def _normalized_tier(user: Dict[str, Any]) -> str:
    return normalize_plan_tier(
        _row_get(user, "plan_tier"),
        _row_get(user, "role"),
        _row_get(user, "subscription_expires_at"),
    )


def _require_supermemory_access(user: Dict[str, Any]) -> str:
    if not SUPERMEMORY_SERVICE.available:
        raise HTTPException(status_code=503, detail="Long-term memory is not configured.")
    if _row_get(user, "conversation_memory_enabled") is False:
        raise HTTPException(status_code=403, detail="Conversation memory is disabled.")
    plan_tier = _normalized_tier(user)
    policy = SUPERMEMORY_SERVICE.policy_for_tier(plan_tier)
    if not policy.enabled:
        raise HTTPException(
            status_code=403,
            detail="Long-term memory is available on Pathfinder and above.",
        )
    return plan_tier


def _normalize_category(category: Optional[str], text: str) -> str:
    if category and category in MEMORY_CATEGORIES:
        return category
    return detect_memory_category(text)


@router.post("/api/supermemory/store")
async def supermemory_store(
    payload: SupermemoryStoreRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    plan_tier = _require_supermemory_access(current_user)
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing text.")
    category = _normalize_category(payload.category, text)
    metadata = {
        "type": category,
        "source": "gray_ui",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    result = await SUPERMEMORY_SERVICE.store_memory(
        user_id=current_user["id"],
        content=text,
        metadata=metadata,
        plan_tier=plan_tier,
    )
    if not result:
        raise HTTPException(status_code=502, detail="Failed to store memory.")
    preview = text[:80] + ("..." if len(text) > 80 else "")
    return {
        "success": True,
        "message": f'Stored: "{preview}"',
        "category": category,
        "data": result,
    }


@router.post("/api/supermemory/search")
async def supermemory_search(
    payload: SupermemorySearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    plan_tier = _require_supermemory_access(current_user)
    results = await SUPERMEMORY_SERVICE.search_memories(
        user_id=current_user["id"],
        query=payload.query,
        limit=payload.limit or 5,
        plan_tier=plan_tier,
    )
    return {"results": results, "count": len(results)}


@router.post("/api/supermemory/profile")
async def supermemory_profile(
    payload: SupermemoryProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    plan_tier = _require_supermemory_access(current_user)
    profile = await SUPERMEMORY_SERVICE.get_profile(
        user_id=current_user["id"],
        query=payload.query,
        plan_tier=plan_tier,
    )
    if not profile:
        return {"static": [], "dynamic": [], "searchResults": []}
    return profile


@router.post("/api/supermemory/forget")
async def supermemory_forget(
    payload: SupermemoryForgetRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    plan_tier = _require_supermemory_access(current_user)
    memory_id = (payload.memory_id or "").strip()
    if memory_id:
        deleted = await SUPERMEMORY_SERVICE.delete_memory(
            memory_id=memory_id,
            user_id=current_user["id"],
        )
        if not deleted:
            raise HTTPException(status_code=502, detail="Failed to forget memory.")
        return {"success": True, "message": "Memory forgotten."}
    query = (payload.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Provide a query or memory_id to forget.")
    return await SUPERMEMORY_SERVICE.forget_by_query(
        user_id=current_user["id"],
        query=query,
        plan_tier=plan_tier,
    )


@router.post("/api/supermemory/wipe", status_code=status.HTTP_200_OK)
async def supermemory_wipe(
    payload: SupermemoryWipeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    plan_tier = _require_supermemory_access(current_user)
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Confirmation required.")
    result = await SUPERMEMORY_SERVICE.wipe_all(
        user_id=current_user["id"],
        plan_tier=plan_tier,
    )
    return result
