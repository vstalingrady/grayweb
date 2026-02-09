import json

import pytest

from backend.core.stream_handlers.openrouter import stream_openrouter_response


class _StubOpenRouterService:
    available = True

    def __init__(self, turns):
        self._turns = turns
        self._turn_index = 0

    async def stream(self, *args, **kwargs):
        chunks = self._turns[self._turn_index] if self._turn_index < len(self._turns) else []
        self._turn_index += 1
        for chunk in chunks:
            yield chunk


async def _execute_function_call_stub(tool_call, user_id, db, **kwargs):
    return {"tool": tool_call.name, "ok": True}


async def _collect_events(
    openrouter_service: _StubOpenRouterService,
    *,
    message: str = "hello",
    search_enabled: bool = False,
):
    return [
        event
        async for event in stream_openrouter_response(
            openrouter_service=openrouter_service,
            message=message,
            conversation_history=[],
            workspace_context=None,
            system_prompt=None,
            time_context=None,
            model=None,
            tool_list=[],
            search_enabled=search_enabled,
            reasoning_mode=False,
            media_attachments=[],
            history_token_budget=0,
            user_id=1,
            needs_structured_tools=False,
            is_onboarding_tool=False,
            execute_function_call_fn=_execute_function_call_stub,
            db=None,
        )
    ]


@pytest.mark.asyncio
async def test_tool_only_non_search_turn_emits_generic_fallback_final_text():
    openrouter_service = _StubOpenRouterService(
        turns=[
            [
                {
                    "tool_calls": [
                        {
                            "index": 0,
                            "id": "tool_non_search",
                            "function": {
                                "name": "create_reminder",
                                "arguments": json.dumps({"title": "Pay rent"}),
                            },
                        }
                    ]
                }
            ],
            [],
        ]
    )

    events = await _collect_events(openrouter_service)
    final_payload = next(payload for event_type, payload in events if event_type == "final")

    assert final_payload["text"] == "I couldn't generate a complete reply just now. Please try again."
    assert final_payload["text"].strip()


@pytest.mark.asyncio
async def test_tool_only_search_turn_emits_search_fallback_with_query_and_grounding():
    query = "latest mars weather update"
    openrouter_service = _StubOpenRouterService(
        turns=[
            [
                {
                    "tool_calls": [
                        {
                            "index": 0,
                            "id": "tool_web_search",
                            "function": {
                                "name": "web_search",
                                "arguments": json.dumps({"params": {"query": query}}),
                            },
                        }
                    ]
                }
            ],
            [
                {
                    "annotations": [
                        {
                            "type": "url_citation",
                            "url_citation": {
                                "url": "https://example.com/mars-weather",
                                "title": "Mars Weather",
                                "start_index": 0,
                                "end_index": 12,
                            },
                        }
                    ]
                }
            ],
        ]
    )

    events = await _collect_events(
        openrouter_service,
        message="help me with this",
        search_enabled=True,
    )

    search_start = next(
        payload
        for event_type, payload in events
        if event_type == "tool_status" and payload.get("status") == "start"
    )
    final_payload = next(payload for event_type, payload in events if event_type == "final")

    assert search_start["query"] == query
    assert (
        final_payload["text"]
        == "I couldn't find enough signal from that search. Try rephrasing with a bit more detail, or ask me to recall from memory."
    )
    assert final_payload["text"].strip()
    assert final_payload["grounding_metadata"]["web_search_queries"] == [query]
    assert (
        final_payload["grounding_metadata"]["grounding_chunks"][0]["web"]["uri"]
        == "https://example.com/mars-weather"
    )
