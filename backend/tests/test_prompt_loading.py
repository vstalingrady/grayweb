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
    from backend.core.title_generator import generate_chat_title_inline

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
            assert model == "google/gemini-3-flash-preview"
            assert "User:" in message
            assert "Assistant:" in message
            assert isinstance(system_prompt, str) and system_prompt.strip()
            assert kwargs.get("include_usage") is False
            assert kwargs.get("response_format") is None
            assert kwargs.get("tools") is None
            assert kwargs.get("tool_choice") is None
            return "Test Title"

    class StubGemini:
        available = False

    async def run():
        title = await generate_chat_title_inline(
            "hi", 
            "hello", 
            prompt_locale="en",
            gemini_service=StubGemini(),
            openrouter_service=StubOpenRouter(),
        )
        assert title == "Test Title"

    asyncio.run(run())
