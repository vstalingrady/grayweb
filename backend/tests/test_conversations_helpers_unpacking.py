from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException


def _make_request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})


def _make_helpers(
    *,
    require_owner_raises: bool,
    tier_limit: int = 42,
    require_owner_exception: Exception | None = None,
):
    async def require_owner(_conversation_id, _current_user):
        if require_owner_exception is not None:
            raise require_owner_exception
        if require_owner_raises:
            raise RuntimeError("stop")

    async def load_history(_conversation_id, _user_id):
        return []

    def general_user_id(_conversation_id):
        return None

    async def noop_async(*_args, **_kwargs):
        return None

    def noop(*_args, **_kwargs):
        return None

    dummy_logger = SimpleNamespace(error=noop, info=noop, warning=noop, debug=noop)
    dummy_service = SimpleNamespace(available=False)
    dummy_openrouter = SimpleNamespace(
        get_model_context_limit=lambda _model: 8192,
        MODEL_CONTEXT_LIMITS={},
    )
    dummy_chat_sessions = SimpleNamespace(
        insert=lambda: SimpleNamespace(values=lambda **_kwargs: None),
    )

    return (
        require_owner,
        load_history,
        general_user_id,
        noop_async,
        noop_async,
        lambda _conversation_id: False,
        noop,
        noop_async,
        noop_async,
        lambda messages: messages,
        noop_async,
        noop_async,
        noop_async,  # invalidate_conversation_cache
        lambda _obj, _key: _obj.get(_key) if hasattr(_obj, "get") else getattr(_obj, _key, None),  # _row_get
        None,  # database
        dummy_logger,
        dummy_service,
        dummy_openrouter,
        dummy_chat_sessions,
        lambda _tier, _model=None: tier_limit,
        object(),
        object(),
        object(),
        object(),
        object(),
        object(),
    )


@pytest.mark.asyncio
async def test_get_conversation_unpacking_accepts_tier_token_limit(monkeypatch):
    from backend.api import conversations as conv_module
    from backend.core.rate_limit import limiter

    monkeypatch.setattr(limiter, "enabled", False, raising=False)
    monkeypatch.setattr(
        conv_module,
        "_get_conversation_helpers",
        lambda: _make_helpers(require_owner_raises=True),
    )

    with pytest.raises(HTTPException) as exc_info:
        await conv_module.get_conversation(
            request=_make_request(),
            conversation_id="general:1",
            current_user={"id": 1},
        )

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_get_conversation_usage_uses_tier_token_limit(monkeypatch):
    from backend.api import conversations as conv_module
    from backend.core.rate_limit import limiter

    monkeypatch.setattr(limiter, "enabled", False, raising=False)
    monkeypatch.setattr(
        conv_module,
        "_get_conversation_helpers",
        lambda: _make_helpers(require_owner_raises=False, tier_limit=123),
    )

    result = await conv_module.get_conversation_usage(
        request=_make_request(),
        conversation_id="general:1",
        current_user={
            "id": 1,
            "plan_tier": "free",
            "role": "user",
            "subscription_expires_at": None,
        },
    )

    assert result["limit"] == 123


@pytest.mark.asyncio
async def test_list_user_conversations_unpacking_accepts_tier_token_limit(monkeypatch):
    from backend.api import conversations as conv_module

    monkeypatch.setattr(
        conv_module,
        "_get_conversation_helpers",
        lambda: _make_helpers(require_owner_raises=False),
    )

    class StubDb:
        async def fetch_all(self, *_args, **_kwargs):
            return []

    result = await conv_module.list_user_conversations(
        user_id=123,
        current_user={"id": 1},
        limit=10,
        db=StubDb(),
    )

    assert result == []


@pytest.mark.asyncio
async def test_get_conversation_usage_preserves_http_exception(monkeypatch):
    from backend.api import conversations as conv_module
    from backend.core.rate_limit import limiter

    monkeypatch.setattr(limiter, "enabled", False, raising=False)
    monkeypatch.setattr(
        conv_module,
        "_get_conversation_helpers",
        lambda: _make_helpers(
            require_owner_raises=False,
            require_owner_exception=HTTPException(status_code=403, detail="forbidden"),
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await conv_module.get_conversation_usage(
            request=_make_request(),
            conversation_id="general:1",
            current_user={"id": 1},
        )

    assert exc_info.value.status_code == 403
