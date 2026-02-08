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


def test_legacy_payload_without_mode_honors_explicit_search_request() -> None:
    request = _build_request("can you google this meme?", mode=None, enabled=False)
    assert _resolve_web_search_enabled(request) is True
