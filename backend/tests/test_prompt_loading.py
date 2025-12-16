import asyncio
import json
import tempfile
from pathlib import Path


def test_load_prompt_from_json_uses_fallback_when_key_missing():
    from backend.main import load_prompt_from_json

    with tempfile.TemporaryDirectory() as tmp_dir:
        prompt_path = Path(tmp_dir) / "prompts.json"
        prompt_path.write_text(json.dumps({"chat": {"en": "Hello"}}), encoding="utf-8")

        assert (
            load_prompt_from_json(prompt_path, "missing.key", fallback="fallback prompt", locale="en")
            == "fallback prompt"
        )


def test_load_prompt_from_json_uses_fallback_when_key_empty():
    from backend.main import load_prompt_from_json

    with tempfile.TemporaryDirectory() as tmp_dir:
        prompt_path = Path(tmp_dir) / "prompts.json"
        prompt_path.write_text(
            json.dumps({"title_generation": {"en": "   ", "id": ""}}), encoding="utf-8"
        )

        assert (
            load_prompt_from_json(prompt_path, "title_generation", fallback="fallback title prompt", locale="en")
            == "fallback title prompt"
        )


def test_generate_chat_title_inline_prefers_openrouter_when_available():
    import backend.main as main

    class StubOpenRouter:
        available = True

        async def generate(
            self,
            message,
            conversation_history,
            workspace_context,
            system_prompt,
            time_context,
            model,
            **kwargs,
        ):
            assert model == "google/gemini-2.5-flash-preview-09-2025" or model == main.OPENROUTER_LITE_MODEL
            assert "User:" in message
            assert "Assistant:" in message
            assert isinstance(system_prompt, str) and system_prompt.strip()
            assert kwargs.get("include_usage") is False
            assert kwargs.get("response_format") is None
            assert kwargs.get("tools") is None
            assert kwargs.get("tool_choice") is None
            return "Test Title"

    original_openrouter = main.OPENROUTER_SERVICE
    original_gemini = main.GEMINI_SERVICE
    try:
        main.OPENROUTER_SERVICE = StubOpenRouter()
        main.GEMINI_SERVICE = type("StubGemini", (), {"available": False})()

        async def run():
            title = await main._generate_chat_title_inline("hi", "hello", prompt_locale="en")
            assert title == "Test Title"

        asyncio.run(run())
    finally:
        main.OPENROUTER_SERVICE = original_openrouter
        main.GEMINI_SERVICE = original_gemini

