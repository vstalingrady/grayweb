from types import SimpleNamespace

import pytest

from backend.core.stream_handlers.openrouter import stream_openrouter_response
from backend.models.proactivity import ProactivitySettings


def test_proactivity_settings_accepts_int_id():
    settings = ProactivitySettings(id=2)
    assert settings.id == 2


@pytest.mark.asyncio
async def test_stream_openrouter_response_allows_missing_response_format():
    openrouter_service = SimpleNamespace(available=False)
    events = [
        event
        async for event in stream_openrouter_response(
            openrouter_service=openrouter_service,
            message="hello",
            conversation_history=[],
            workspace_context=None,
            system_prompt=None,
            time_context=None,
            model=None,
            tool_list=[],
            search_enabled=False,
            reasoning_mode=False,
            media_attachments=[],
            history_token_budget=0,
            user_id=1,
            needs_structured_tools=False,
            is_onboarding_tool=False,
        )
    ]
    assert events

