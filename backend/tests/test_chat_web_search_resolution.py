from backend.api.chat import _resolve_web_search_enabled
from backend.api.chat_models import ChatRequest


def _build_request(message: str, *, mode: str | None, enabled: bool = False) -> ChatRequest:
    payload = {
        "message": message,
        "user_id": 1,
        "web_search_enabled": enabled,
    }
    if mode is not None:
        payload["web_search_mode"] = mode
    return ChatRequest(**payload)


def test_mode_off_still_enables_explicit_search_request() -> None:
    request = _build_request("search this", mode="off", enabled=False)
    assert _resolve_web_search_enabled(request) is True


def test_mode_off_keeps_non_search_request_disabled() -> None:
    request = _build_request("write me a haiku", mode="off", enabled=False)
    assert _resolve_web_search_enabled(request) is False


def test_mode_on_stays_enabled_for_memory_meta_prompt() -> None:
    request = _build_request("what did i search up before this", mode="on", enabled=False)
    assert _resolve_web_search_enabled(request) is True


def test_legacy_payload_without_mode_honors_explicit_search_request() -> None:
    request = _build_request("can you google this meme?", mode=None, enabled=False)
    assert _resolve_web_search_enabled(request) is True


def test_mode_auto_disables_cross_chat_memory_prompt_without_explicit_search() -> None:
    request = _build_request(
        "did i ask before in another chat about something else",
        mode="auto",
        enabled=False,
    )
    assert _resolve_web_search_enabled(request) is False


def test_mode_auto_disables_different_chat_memory_prompt_without_explicit_search() -> None:
    request = _build_request(
        "did i ask before in a different chat about that",
        mode="auto",
        enabled=False,
    )
    assert _resolve_web_search_enabled(request) is False


def test_mode_auto_keeps_explicit_search_when_memory_phrase_present() -> None:
    request = _build_request(
        "search another chat and find what i asked before",
        mode="auto",
        enabled=False,
    )
    assert _resolve_web_search_enabled(request) is True


def test_mode_auto_disables_meta_search_history_question() -> None:
    request = _build_request("what did i search up before this", mode="auto", enabled=False)
    assert _resolve_web_search_enabled(request) is False


def test_mode_auto_respects_client_signal_for_non_search_prompt() -> None:
    request = _build_request("write me a haiku", mode="auto", enabled=False)
    assert _resolve_web_search_enabled(request) is False


def test_mode_auto_enables_when_client_signals_search_intent() -> None:
    request = _build_request("latest nba score", mode="auto", enabled=True)
    assert _resolve_web_search_enabled(request) is True
