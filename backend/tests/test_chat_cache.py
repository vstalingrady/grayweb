import asyncio
import json

import pytest

from backend import chat_cache


class _FakeRedis:
    def __init__(self) -> None:
        self.storage = {}
        self.expire_calls = []
        self.setex_calls = []

    async def get(self, key):
        return self.storage.get(key)

    async def setex(self, key, ttl, value):
        self.storage[key] = value
        self.setex_calls.append((key, ttl))

    async def expire(self, key, ttl):
        self.expire_calls.append((key, ttl))

    async def delete(self, *keys):
        for key in keys:
            self.storage.pop(key, None)


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _clear_local_cache():
    chat_cache._LOCAL_CACHE.clear()
    yield
    chat_cache._LOCAL_CACHE.clear()


def test_get_cached_messages_refreshes_ttl(monkeypatch):
    redis = _FakeRedis()
    key = f"{chat_cache.CHAT_CACHE_PREFIX}thread-1:messages"
    redis.storage[key] = json.dumps([{"role": "user", "text": "hello"}])

    async def _mock_conn():
        return redis

    monkeypatch.setattr(chat_cache, "_get_redis_connection", _mock_conn)

    cached = _run(chat_cache.get_cached_messages("thread-1"))

    assert cached == [{"role": "user", "text": "hello"}]
    assert redis.expire_calls == [(key, chat_cache.CHAT_CACHE_TTL)]


def test_append_cached_message_updates_existing_cache(monkeypatch):
    redis = _FakeRedis()
    key = f"{chat_cache.CHAT_CACHE_PREFIX}thread-2:messages"
    redis.storage[key] = json.dumps(
        [
            {"role": "user", "text": "first"},
        ]
    )

    async def _mock_conn():
        return redis

    monkeypatch.setattr(chat_cache, "_get_redis_connection", _mock_conn)

    appended = _run(
        chat_cache.append_cached_message(
            "thread-2",
            {"role": "model", "text": "second", "groundingMetadata": {"src": "web"}},
        )
    )

    assert appended is True
    parsed = json.loads(redis.storage[key])
    assert parsed == [
        {"role": "user", "text": "first"},
        {"role": "model", "text": "second", "grounding_metadata": {"src": "web"}},
    ]
    assert redis.setex_calls == [(key, chat_cache.CHAT_CACHE_TTL)]


def test_append_cached_message_miss_when_cache_not_primed(monkeypatch):
    redis = _FakeRedis()

    async def _mock_conn():
        return redis

    monkeypatch.setattr(chat_cache, "_get_redis_connection", _mock_conn)

    appended = _run(
        chat_cache.append_cached_message(
            "thread-3",
            {"role": "user", "text": "hello"},
        )
    )

    assert appended is False
    assert redis.setex_calls == []


def test_local_fallback_cache_append_and_get(monkeypatch):
    async def _mock_conn():
        return None

    monkeypatch.setattr(chat_cache, "_get_redis_connection", _mock_conn)

    written = _run(
        chat_cache.cache_messages(
            "thread-4",
            [{"role": "user", "text": "first"}],
        )
    )
    assert written is True

    appended = _run(
        chat_cache.append_cached_message(
            "thread-4",
            {"role": "model", "text": "second"},
        )
    )
    assert appended is True

    cached = _run(chat_cache.get_cached_messages("thread-4"))
    assert cached == [
        {"role": "user", "text": "first"},
        {"role": "model", "text": "second"},
    ]


def test_local_fallback_invalidate_clears_messages_and_metadata(monkeypatch):
    async def _mock_conn():
        return None

    monkeypatch.setattr(chat_cache, "_get_redis_connection", _mock_conn)

    _run(
        chat_cache.cache_messages(
            "thread-5",
            [{"role": "user", "text": "hello"}],
        )
    )
    _run(
        chat_cache.cache_conversation_metadata(
            "thread-5",
            {"title": "cached"},
        )
    )

    invalidated = _run(chat_cache.invalidate_conversation_cache("thread-5"))
    assert invalidated is True
    assert _run(chat_cache.get_cached_messages("thread-5")) is None
    assert _run(chat_cache.get_cached_conversation_metadata("thread-5")) is None
