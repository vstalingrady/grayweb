from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from backend.supermemory import (
    SUPERMEMORY_SERVICE,
    MEMORY_CATEGORIES,
    detect_memory_category,
)


def _normalize_category(category: Optional[str], text: str) -> str:
    if category and category in MEMORY_CATEGORIES:
        return category
    return detect_memory_category(text)


def _availability_error(plan_tier: Optional[str]) -> Optional[str]:
    if not SUPERMEMORY_SERVICE.available:
        return "Long-term memory is not configured."
    policy = SUPERMEMORY_SERVICE.policy_for_tier(plan_tier)
    if not policy.enabled:
        return "Long-term memory is available on Pathfinder and above."
    return None


async def supermemory_store_tool(
    user_id: int,
    args: Dict[str, Any],
    _db,
    plan_tier: Optional[str] = None,
) -> Dict[str, Any]:
    error = _availability_error(plan_tier)
    if error:
        return {"error": error}
    text = (args.get("text") or args.get("content") or "").strip()
    if not text:
        return {"error": "Missing text to store."}
    category = _normalize_category(args.get("category"), text)
    metadata = {
        "type": category,
        "source": "gray_tool",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    result = await SUPERMEMORY_SERVICE.store_memory(
        user_id=user_id,
        content=text,
        metadata=metadata,
        plan_tier=plan_tier,
    )
    if not result:
        return {"error": "Failed to store memory."}
    preview = text[:80] + ("..." if len(text) > 80 else "")
    return {
        "status": "success",
        "message": f'Stored: "{preview}"',
        "category": category,
    }


async def supermemory_search_tool(
    user_id: int,
    args: Dict[str, Any],
    _db,
    plan_tier: Optional[str] = None,
) -> Dict[str, Any]:
    error = _availability_error(plan_tier)
    if error:
        return {"error": error}
    query = (args.get("query") or args.get("text") or "").strip()
    if not query:
        return {"error": "Missing query."}
    limit = args.get("limit") or 5
    results = await SUPERMEMORY_SERVICE.search_memories(
        user_id=user_id,
        query=query,
        limit=int(limit),
        plan_tier=plan_tier,
    )
    if not results:
        return {"status": "empty", "message": "No relevant memories found.", "results": []}
    return {
        "status": "success",
        "count": len(results),
        "results": results,
        "message": f"Found {len(results)} memories.",
    }


async def supermemory_profile_tool(
    user_id: int,
    args: Dict[str, Any],
    _db,
    plan_tier: Optional[str] = None,
) -> Dict[str, Any]:
    error = _availability_error(plan_tier)
    if error:
        return {"error": error}
    query = (args.get("query") or "").strip() or None
    profile = await SUPERMEMORY_SERVICE.get_profile(
        user_id=user_id,
        query=query,
        plan_tier=plan_tier,
    )
    if not profile:
        return {"status": "empty", "message": "No profile information available yet."}
    static_facts = profile.get("static") or []
    dynamic_facts = profile.get("dynamic") or []
    if not static_facts and not dynamic_facts:
        return {"status": "empty", "message": "No profile information available yet."}
    return {
        "status": "success",
        "profile": profile,
        "static_count": len(static_facts),
        "dynamic_count": len(dynamic_facts),
    }


async def supermemory_forget_tool(
    user_id: int,
    args: Dict[str, Any],
    _db,
    plan_tier: Optional[str] = None,
) -> Dict[str, Any]:
    error = _availability_error(plan_tier)
    if error:
        return {"error": error}
    memory_id = (args.get("memory_id") or args.get("memoryId") or "").strip()
    if memory_id:
        deleted = await SUPERMEMORY_SERVICE.delete_memory(
            memory_id=memory_id,
            user_id=user_id,
        )
        if deleted:
            return {"status": "success", "message": "Memory forgotten."}
        return {"error": "Failed to forget memory."}
    query = (args.get("query") or "").strip()
    if not query:
        return {"error": "Provide a query or memory_id to forget."}
    return await SUPERMEMORY_SERVICE.forget_by_query(
        user_id=user_id,
        query=query,
        plan_tier=plan_tier,
    )
