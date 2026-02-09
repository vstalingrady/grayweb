from __future__ import annotations

import pytest

from backend.core import supermemory_handlers
from backend.supermemory import (
    SupermemoryService,
    _extract_atomic_user_memories,
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
async def test_forget_by_query_prefers_exact_match_over_higher_similarity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = SupermemoryService()
    captured: dict[str, str] = {}

    async def fake_search_memories(*, user_id: int, query: str, limit: int, plan_tier=None):
        assert user_id == 8
        assert query == "I prefer tea"
        assert limit == 5
        return [
            {"memory": "I prefer coffee", "id": "doc_high", "similarity": 0.98},
            {"memory": "I prefer tea", "id": "doc_exact", "similarity": 0.80},
        ]

    async def fake_delete_memory(*, memory_id: str, user_id: int | None = None, container_tag=None):
        del container_tag
        captured["memory_id"] = memory_id
        captured["user_id"] = str(user_id)
        return True

    monkeypatch.setattr(service, "search_memories", fake_search_memories)
    monkeypatch.setattr(service, "delete_memory", fake_delete_memory)

    result = await service.forget_by_query(user_id=8, query="I prefer tea", plan_tier="pioneer")

    assert result["success"] is True
    assert captured == {"memory_id": "doc_exact", "user_id": "8"}


@pytest.mark.asyncio
async def test_forget_by_query_rejects_low_similarity_when_no_exact_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = SupermemoryService()

    async def fake_search_memories(*, user_id: int, query: str, limit: int, plan_tier=None):
        assert user_id == 9
        assert query == "favorite editor"
        assert limit == 5
        return [{"memory": "User uses VS Code", "id": "doc_low", "similarity": 0.62}]

    async def fake_delete_memory(*, memory_id: str, user_id: int | None = None, container_tag=None):
        del memory_id, user_id, container_tag
        raise AssertionError("delete_memory should not be called for low-confidence matches")

    monkeypatch.setattr(service, "search_memories", fake_search_memories)
    monkeypatch.setattr(service, "delete_memory", fake_delete_memory)

    result = await service.forget_by_query(user_id=9, query="favorite editor", plan_tier="pioneer")

    assert result == {"success": False, "message": "No matching memory found to forget."}


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


@pytest.mark.asyncio
async def test_delete_conversation_memories_filters_by_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    captured_batches: list[list[str]] = []

    class _StubResponse:
        def __init__(self, payload):
            self._payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self._payload

    class _StubClient:
        def __init__(self):
            self._list_page = 0

        async def post(self, url: str, json=None, headers=None):
            del headers
            if url.endswith("/v3/documents/list"):
                self._list_page += 1
                if self._list_page == 1:
                    return _StubResponse(
                        {
                            "memories": [
                                {"id": "doc_a", "metadata": {"conversation_id": "thread_1"}},
                                {"id": "doc_b", "metadata": {"conversation_id": "thread_2"}},
                                {"id": "doc_c", "metadata": {"conversationId": "thread_1"}},
                                {"id": "doc_d", "meta": {"conversation_id": "thread_1"}},
                            ],
                            "pagination": {"totalPages": 2},
                        }
                    )
                return _StubResponse(
                    {
                        "memories": [
                            {"id": "doc_e", "metadata": {"conversation_id": "thread_1"}},
                        ],
                        "pagination": {"totalPages": 2},
                    }
                )
            if url.endswith("/v3/documents/delete-bulk"):
                captured_batches.append(list(json.get("ids") or []))
                return _StubResponse({})
            raise AssertionError(f"Unexpected URL: {url}")

    stub_client = _StubClient()

    async def fake_get_client():
        return stub_client

    monkeypatch.setattr(service, "_get_client", fake_get_client)

    result = await service.delete_conversation_memories(
        user_id=5,
        conversation_id="thread_1",
    )

    assert result == {"matchedCount": 4, "deletedCount": 4}
    assert captured_batches == [["doc_a", "doc_c", "doc_d", "doc_e"]]


def test_extract_atomic_user_memories_captures_preferences_facts_and_decisions() -> None:
    memories = _extract_atomic_user_memories(
        "I prefer short bullet answers. I work as a product manager. I decided to use Python.",
    )

    assert memories == [
        ("I prefer short bullet answers", "preference"),
        ("I work as a product manager", "fact"),
        ("I decided to use Python", "decision"),
    ]


@pytest.mark.asyncio
async def test_capture_turn_stores_atomic_user_memories_with_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    captured_payloads: list[dict] = []

    async def fake_post(path: str, payload, *, container_tag=None):
        assert path == "/v3/documents"
        assert container_tag == payload["containerTag"]
        captured_payloads.append(payload)
        return {"ok": True}

    monkeypatch.setattr(service, "_post", fake_post)

    await service.capture_turn(
        user_id=11,
        user_message="I prefer tea. I live in Seattle.",
        assistant_message="Great, I'll keep that in mind.",
        conversation_id="thread_abc",
        plan_tier="pioneer",
    )

    assert len(captured_payloads) == 2
    assert [payload["content"] for payload in captured_payloads] == [
        "I prefer tea",
        "I live in Seattle",
    ]
    for payload in captured_payloads:
        metadata = payload.get("metadata") or {}
        assert metadata.get("source") == "gray_capture_turn"
        assert metadata.get("user_id") == "11"
        assert metadata.get("conversation_id") == "thread_abc"
        assert metadata.get("category") in {"preference", "fact"}
        assert metadata.get("type") in {"preference", "fact"}
        assert isinstance(payload.get("customId"), str)
        assert payload["customId"].startswith("gray_atomic_")


@pytest.mark.asyncio
async def test_capture_turn_falls_back_to_role_blocks_when_no_atomic_memories(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    captured_payloads: list[dict] = []

    async def fake_post(path: str, payload, *, container_tag=None):
        assert path == "/v3/documents"
        assert container_tag == payload["containerTag"]
        captured_payloads.append(payload)
        return {"ok": True}

    monkeypatch.setattr(service, "_post", fake_post)

    await service.capture_turn(
        user_id=12,
        user_message="Can you help me debug this traceback?",
        assistant_message="Sure, share the error output and stack trace.",
        conversation_id="thread_xyz",
        plan_tier="pioneer",
    )

    assert len(captured_payloads) == 1
    payload = captured_payloads[0]
    assert "[role: user]" in payload["content"]
    assert "[role: assistant]" in payload["content"]
    metadata = payload.get("metadata") or {}
    assert metadata.get("source") == "gray"
    assert metadata.get("user_id") == "12"
    assert metadata.get("conversation_id") == "thread_xyz"
    assert "category" not in metadata
    assert "type" not in metadata
    assert isinstance(payload.get("customId"), str)
    assert payload["customId"].startswith("gray_turn_")


@pytest.mark.asyncio
async def test_recall_context_uses_search_fallback_when_profile_is_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    paths: list[str] = []

    async def fake_post(path: str, payload, *, container_tag=None):
        del payload, container_tag
        paths.append(path)
        if path == "/v4/profile":
            return {"profile": {"static": [], "dynamic": []}, "searchResults": {"results": []}}
        if path == "/v4/search":
            return {"results": [{"memory": "User likes concise answers", "similarity": 0.9}]}
        raise AssertionError(f"Unexpected path: {path}")

    monkeypatch.setattr(service, "_post", fake_post)

    context = await service.recall_context(
        user_id=21,
        prompt="How should I respond to this user?",
        conversation_history=[],
        plan_tier="pioneer",
    )

    assert context is not None
    assert "Relevant Memories" in context
    assert "User likes concise answers" in context
    assert paths == ["/v4/profile", "/v4/search"]


@pytest.mark.asyncio
async def test_recall_context_skips_search_fallback_when_profile_has_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    paths: list[str] = []

    async def fake_post(path: str, payload, *, container_tag=None):
        del payload, container_tag
        paths.append(path)
        if path == "/v4/profile":
            return {
                "profile": {"static": ["User likes concise answers"], "dynamic": []},
                "searchResults": {"results": []},
            }
        if path == "/v4/search":
            raise AssertionError("Search fallback should not run when profile has data")
        raise AssertionError(f"Unexpected path: {path}")

    monkeypatch.setattr(service, "_post", fake_post)

    context = await service.recall_context(
        user_id=22,
        prompt="What should I remember about this user?",
        conversation_history=[],
        plan_tier="pioneer",
    )

    assert context is not None
    assert "User Profile (Persistent)" in context
    assert "User likes concise answers" in context
    assert paths == ["/v4/profile"]


@pytest.mark.asyncio
async def test_recall_context_falls_back_to_search_when_profile_request_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPERMEMORY_API_KEY", "sm_12345678901234567890")
    monkeypatch.setenv("SUPERMEMORY_ENABLED", "1")

    service = SupermemoryService()
    paths: list[str] = []

    async def fake_post(path: str, payload, *, container_tag=None):
        del payload, container_tag
        paths.append(path)
        if path == "/v4/profile":
            return None
        if path == "/v4/search":
            return {"results": [{"memory": "User prefers concise responses", "similarity": 0.88}]}
        raise AssertionError(f"Unexpected path: {path}")

    monkeypatch.setattr(service, "_post", fake_post)

    context = await service.recall_context(
        user_id=23,
        prompt="How should I reply?",
        conversation_history=[],
        plan_tier="pioneer",
    )

    assert context is not None
    assert "User prefers concise responses" in context
    assert paths == ["/v4/profile", "/v4/search"]
