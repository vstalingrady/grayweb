from backend.core.ai_config import OPENROUTER_LITE_MODEL
from backend.core.stream_handlers.context import (
    DEFAULT_PIONEER_MODEL,
    build_intent_window_text,
    determine_provider_and_model,
)


def test_build_intent_window_text_uses_last_four_history_entries() -> None:
    history = [
        {"text": "old-1"},
        {"text": "old-2"},
        {"text": "keep-1"},
        {"text": "keep-2"},
        {"text": "keep-3"},
        {"text": "keep-4"},
    ]

    window = build_intent_window_text("latest message", history)

    assert window == "latest message\nkeep-1\nkeep-2\nkeep-3\nkeep-4"


def test_build_intent_window_text_ignores_non_dict_and_empty_text() -> None:
    history = [
        "not-a-dict",
        {"text": "first"},
        {"no_text": "missing"},
        {"text": ""},
        {"text": "second"},
    ]

    window = build_intent_window_text("prompt", history)

    assert window == "prompt\nfirst\nsecond"


def test_determine_provider_and_model_maps_tier_alias_and_sets_flag() -> None:
    provider, model, is_alias = determine_provider_and_model(
        model="gray-lite",
        openrouter_available=True,
        needs_structured_tools=False,
        is_onboarding_tool=False,
    )

    assert provider == "openrouter"
    assert model == OPENROUTER_LITE_MODEL
    assert is_alias is True


def test_determine_provider_and_model_maps_openrouter_auto_alias() -> None:
    provider, model, is_alias = determine_provider_and_model(
        model="openrouter/auto",
        openrouter_available=True,
        needs_structured_tools=False,
        is_onboarding_tool=False,
    )

    assert provider == "openrouter"
    assert model == "openrouter/auto"
    assert is_alias is False


def test_determine_provider_and_model_maps_pioneer_alias() -> None:
    provider, model, is_alias = determine_provider_and_model(
        model="pioneer",
        openrouter_available=False,
        needs_structured_tools=True,
        is_onboarding_tool=True,
    )

    assert provider == "openrouter"
    assert model == DEFAULT_PIONEER_MODEL
    assert is_alias is False


def test_determine_provider_and_model_normalizes_legacy_models_prefix() -> None:
    provider, model, is_alias = determine_provider_and_model(
        model="models/gemini-2.0-flash",
        openrouter_available=True,
        needs_structured_tools=False,
        is_onboarding_tool=False,
    )

    assert provider == "openrouter"
    assert model == "google/gemini-2.0-flash"
    assert is_alias is False
