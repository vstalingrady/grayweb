import pytest
from fastapi import BackgroundTasks

from backend.api import payments


class _StubRequest:
    def __init__(self, body: bytes = b"{}", headers: dict | None = None) -> None:
        self._body = body
        self.headers = headers or {}

    async def body(self) -> bytes:
        return self._body


@pytest.mark.asyncio
async def test_handle_dodo_webhook_missing_key_returns_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DODO_PAYMENTS_WEBHOOK_KEY", raising=False)
    monkeypatch.setattr(payments, "_DODO_WEBHOOK_KEY_MISSING_WARNED", False)

    warning_messages: list[str] = []

    class _StubLogger:
        def warning(self, message: str, *args, **kwargs) -> None:  # noqa: ANN002, ANN003
            warning_messages.append(message)

    monkeypatch.setattr(payments, "_get_logger", lambda: _StubLogger())
    monkeypatch.setattr(payments, "_get_cache_helpers", lambda: (lambda *a, **k: None, lambda *a, **k: None))

    request = _StubRequest()

    first_response = await payments.handle_dodo_webhook(request, BackgroundTasks())
    second_response = await payments.handle_dodo_webhook(request, BackgroundTasks())

    expected = {"status": "ignored", "reason": "webhook_verification_not_configured"}
    assert first_response == expected
    assert second_response == expected
    assert warning_messages == ["Dodo webhook key missing; acknowledging webhook without verification"]
