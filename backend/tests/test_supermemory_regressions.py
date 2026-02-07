from __future__ import annotations

import pytest

from backend.core import supermemory_handlers
from backend.supermemory import (
    SupermemoryService,
    _normalize_search_results,
    supermemory_force_enabled,
)


def test_normalize_search_results_preserves_memory_ids() -> None:
    results = _normalize_search_results(
        [
            {"memory": "Primary id", "id": "doc_1", "similarity": 0.9},
            {"memory": "Memory id fallback", "memoryId": "doc_2"},
            {"memory": "Document id fallback", "documentId": "doc_3"},
            {"memory": "No id is still valid"},
            {"memory": "  "},
            {"not_memory": "skip"},
        ]
    )

    assert [item["memory"] for item in results] == [
        "Primary id",
        "Memory id fallback",
        "Document id fallback",
        "No id is still valid",
    ]
    assert results[0]["id"] == "doc_1"
    assert results[1]["id"] == "doc_2"
    assert results[2]["id"] == "doc_3"
    assert "id" not in results[3]


def test_supermemory_force_is_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GRAY_SUPERMEMORY_FORCE", raising=False)
    assert supermemory_force_enabled() is False

    monkeypatch.setenv("GRAY_SUPERMEMORY_FORCE", "1")
    assert supermemory_force_enabled() is True


def test_scout_policy_is_disabled_pathfinder_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    scout_policy = service.policy_for_tier("scout")
    pathfinder_policy = service.policy_for_tier("pathfinder")

    assert scout_policy.enabled is False
    assert scout_policy.auto_recall is False
    assert scout_policy.auto_capture is False
    assert pathfinder_policy.enabled is True


@pytest.mark.asyncio
async def test_forget_by_query_deletes_using_search_result_id(monkeypatch: pytest.MonkeyPatch) -> None:
    service = SupermemoryService()
    captured: dict[str, str] = {}

    async def fake_search_memories(*, user_id: int, query: str, limit: int, plan_tier=None):
        assert user_id == 7
        assert query == "alpha"
        assert limit == 5
        return [{"memory": "Remember this", "id": "doc_abc"}]

    async def fake_delete_memory(*, memory_id: str, user_id: int | None = None, container_tag=None):
        captured["memory_id"] = memory_id
        captured["user_id"] = str(user_id)
        return True

    monkeypatch.setattr(service, "search_memories", fake_search_memories)
    monkeypatch.setattr(service, "delete_memory", fake_delete_memory)

    result = await service.forget_by_query(user_id=7, query="alpha", plan_tier="pioneer")

    assert result["success"] is True
    assert captured == {"memory_id": "doc_abc", "user_id": "7"}


@pytest.mark.asyncio
async def test_search_memories_handles_invalid_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    captured: dict[str, int] = {}

    async def fake_post(path: str, payload, *, container_tag=None):
        assert path == "/v4/search"
        captured["limit"] = payload["limit"]
        return {"results": [{"memory": "Result 1"}]}

    monkeypatch.setattr(service, "_post", fake_post)

    results = await service.search_memories(user_id=42, query="test", limit="not-a-number", plan_tier="pioneer")

    assert captured["limit"] == 5
    assert len(results) == 1
    assert results[0]["memory"] == "Result 1"


@pytest.mark.asyncio
async def test_supermemory_search_tool_falls_back_to_default_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, int] = {}

    async def fake_search_memories(*, user_id: int, query: str, limit: int, plan_tier=None):
        captured["limit"] = limit
        return [{"memory": "One"}]

    monkeypatch.setattr(supermemory_handlers, "_availability_error", lambda _plan_tier: None)
    monkeypatch.setattr(supermemory_handlers.SUPERMEMORY_SERVICE, "search_memories", fake_search_memories)

    result = await supermemory_handlers.supermemory_search_tool(
        user_id=1,
        args={"query": "memory", "limit": "five"},
        _db=None,
        plan_tier="pioneer",
    )

    assert result["status"] == "success"
    assert captured["limit"] == 5
