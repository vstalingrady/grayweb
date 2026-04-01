from __future__ import annotations

from backend.openrouter_client import OpenRouterService
from backend.token_utils import trim_history_by_token_budget


def _extract_text_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for part in content:
            if not isinstance(part, dict):
                continue
            if part.get("type") != "text":
                continue
            text = part.get("text")
            if isinstance(text, str):
                text_parts.append(text)
        return "".join(text_parts)
    return ""


def test_trim_history_by_token_budget_keeps_all_when_budget_large():
    history = [{"role": "user", "text": "hello"} for _ in range(30)]
    trimmed = trim_history_by_token_budget(history, 10_000)
    assert len(trimmed) == len(history)


def test_trim_history_by_token_budget_trims_from_front_and_keeps_tail():
    history = [{"role": "user", "text": "word " * 2000} for _ in range(20)]
    trimmed = trim_history_by_token_budget(history, 2_000)
    assert 1 <= len(trimmed) < len(history)
    assert trimmed[-1] == history[-1]


def test_openrouter_build_messages_uses_token_budget_over_message_limit():
    history = []
    for index in range(25):
        role = "user" if index % 2 == 0 else "model"
        history.append({"role": role, "text": "hi"})

    client = OpenRouterService()
    messages = client._build_messages(
        history,
        "current",
        history_limit=10,
        history_token_budget=10_000,
    )

    assert len(messages) == len(history) + 1
    assert messages[-1]["role"] == "user"


def test_openrouter_build_messages_caches_all_history_turns_for_cacheable_models() -> None:
    history = [
        {"role": "user", "text": "first user"},
        {"role": "model", "text": "first assistant"},
        {"role": "user", "text": "second user"},
    ]
    client = OpenRouterService()
    messages = client._build_messages(
        conversation_history=history,
        message="current",
        history_limit=10,
        cache_model="anthropic/claude-sonnet-4.5",
    )

    assert len(messages) == 4
    for index in range(3):
        content = messages[index]["content"]
        assert isinstance(content, list)
        assert content
        assert content[0].get("cache_control")

    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == "current"


def test_openrouter_build_messages_caches_trimmed_history_turns() -> None:
    history = [
        {"role": "user", "text": "u1"},
        {"role": "model", "text": "a1"},
        {"role": "user", "text": "u2"},
        {"role": "model", "text": "a2"},
    ]
    client = OpenRouterService()
    messages = client._build_messages(
        conversation_history=history,
        message="current",
        history_limit=2,
        cache_model="anthropic/claude-sonnet-4.5",
    )

    assert len(messages) == 3
    for index in range(2):
        content = messages[index]["content"]
        assert isinstance(content, list)
        assert content
        assert content[0].get("cache_control")

    assert messages[-1]["content"] == "current"


def test_openrouter_build_messages_keeps_runtime_context_out_of_user_turn() -> None:
    client = OpenRouterService()
    messages = client._build_messages(
        conversation_history=[],
        message="please search",
        history_limit=8,
        runtime_context="<context>timezone: UTC+07:00</context>",
    )

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "timezone" in str(messages[0]["content"]).lower()
    assert messages[1]["role"] == "user"
    assert "runtime context" not in str(messages[1]["content"]).lower()
    assert "timezone" not in str(messages[1]["content"]).lower()


def test_openrouter_build_messages_keeps_runtime_context_out_of_user_multipart_turn() -> None:
    class _Attachment:
        def __init__(self) -> None:
            self.data = b"hello"
            self.mime_type = "image/png"
            self.filename = "x.png"
            self.content_hash = "testhash"

    client = OpenRouterService()
    messages = client._build_messages(
        conversation_history=[],
        message="please search",
        history_limit=8,
        attachments=[_Attachment()],
        runtime_context="<context>timezone: UTC+07:00</context>",
    )

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    user_content = messages[1]["content"]
    assert isinstance(user_content, list)
    assert any(
        isinstance(part, dict) and part.get("type") == "text" and "please search" in str(part.get("text", ""))
        for part in user_content
    )
    assert not any("timezone" in str(part).lower() for part in user_content)


def test_openrouter_build_messages_structured_runtime_context_preserves_text_shape() -> None:
    client = OpenRouterService()
    runtime_payload = {
        "parts": [
            {"text": "timezone: UTC+07:00", "cacheable": False},
            {"text": "Use web search when needed.", "cacheable": True},
        ]
    }
    runtime_context = client._build_runtime_context(runtime_payload)
    messages = client._build_messages(
        conversation_history=[],
        message="please search",
        history_limit=8,
        runtime_context=runtime_context,
        cache_model="anthropic/claude-sonnet-4.5",
    )

    assert len(messages) == 2
    system_content = messages[0]["content"]
    assert _extract_text_content(system_content) == (
        "<context>\n"
        "timezone: UTC+07:00\n\n"
        "Use web search when needed.\n"
        "</context>"
    )


def test_openrouter_build_messages_structured_runtime_context_marks_cacheable_segments() -> None:
    client = OpenRouterService()
    runtime_payload = {
        "parts": [
            {"text": "volatile-now", "cacheable": False},
            {"text": "stable-runtime-note", "cacheable": True},
        ]
    }
    runtime_context = client._build_runtime_context(runtime_payload)
    messages = client._build_messages(
        conversation_history=[],
        message="please search",
        history_limit=8,
        runtime_context=runtime_context,
        cache_model="anthropic/claude-sonnet-4.5",
    )

    system_content = messages[0]["content"]
    assert isinstance(system_content, list)
    cached_parts = [part for part in system_content if isinstance(part, dict) and part.get("cache_control")]
    assert len(cached_parts) == 1
    assert cached_parts[0]["text"] == "stable-runtime-note"


def test_openrouter_build_messages_structured_runtime_context_uses_plain_text_for_non_cache_models() -> None:
    client = OpenRouterService()
    runtime_payload = {
        "parts": [
            {"text": "volatile-now", "cacheable": False},
            {"text": "stable-runtime-note", "cacheable": True},
        ]
    }
    runtime_context = client._build_runtime_context(runtime_payload)
    messages = client._build_messages(
        conversation_history=[],
        message="please search",
        history_limit=8,
        runtime_context=runtime_context,
        cache_model="openai/gpt-5.2-chat",
    )

    assert isinstance(messages[0]["content"], str)
    assert "stable-runtime-note" in messages[0]["content"]


def test_openrouter_prompt_cache_prefixes_blank_uses_safe_defaults(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_PROMPT_CACHE_PREFIXES", "")
    client = OpenRouterService()

    assert client._should_cache_prompt("anthropic/claude-sonnet-4.5") is True
    assert client._should_cache_prompt("google/gemini-3-pro-preview") is True
    assert client._should_cache_prompt("openai/gpt-5.2-chat") is False


def test_openrouter_prompt_cache_prefixes_star_enables_all_models(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_PROMPT_CACHE_PREFIXES", "*")
    client = OpenRouterService()

    assert client._should_cache_prompt("openai/gpt-5.2-chat") is True


def test_openrouter_build_404_retry_payloads_progressive_fallback() -> None:
    client = OpenRouterService()
    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": "hi"}],
        "provider": {"allow_fallbacks": True},
        "transforms": ["middle-out"],
        "plugins": [{"id": "web"}],
        "web_search_options": {"search_context_size": "high"},
        "tools": [{"type": "function", "function": {"name": "x"}}],
        "tool_choice": "auto",
        "response_format": {"type": "json_object"},
        "reasoning": {"effort": "high"},
    }

    variants = client._build_404_retry_payloads(payload)
    labels = [label for label, _ in variants]

    assert labels == [
        "drop_routing_hints",
        "drop_search_params",
        "drop_tools",
        "drop_strict_output",
    ]
    assert "provider" not in variants[0][1] and "transforms" not in variants[0][1]
    assert "plugins" not in variants[1][1] and "web_search_options" not in variants[1][1]
    assert "tools" not in variants[2][1] and "tool_choice" not in variants[2][1]
    assert "response_format" not in variants[3][1] and "reasoning" not in variants[3][1]
