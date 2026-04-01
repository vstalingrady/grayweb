import asyncio
import sys
import types

try:
    import httpx  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover - local test fallback
    sys.modules["httpx"] = types.SimpleNamespace(AsyncClient=object)

from backend.usage_tracker import UsageTracker


class _StubDb:
    def __init__(self, row=None):
        self.row = row
        self.execute_calls = []
        self.fetch_one_calls = []

    async def execute(self, query=None, values=None):
        self.execute_calls.append({"query": str(query), "values": dict(values or {})})
        return None

    async def fetch_one(self, query=None, values=None):
        self.fetch_one_calls.append({"query": str(query), "values": dict(values or {})})
        return self.row


def _run(coro):
    return asyncio.run(coro)


def test_track_usage_persists_usage_event_row(monkeypatch):
    db = _StubDb()
    tracker = UsageTracker(db)

    monkeypatch.setattr(
        "backend.usage_tracker.calculate_cost",
        lambda model_id, input_tokens, output_tokens, cached_tokens: 1.25,
    )

    _run(
        tracker.track_usage(
            user_id=1,
            input_tokens=300,
            output_tokens=120,
            cached_tokens=100,
            model="openai/gpt-5.2",
        )
    )

    assert len(db.execute_calls) == 2
    assert "UPDATE users" in db.execute_calls[0]["query"]
    assert db.execute_calls[0]["values"]["id"] == 1
    assert db.execute_calls[0]["values"]["tokens"] == 520
    assert db.execute_calls[0]["values"]["cost"] == 1.25

    assert "INSERT INTO usage_events" in db.execute_calls[1]["query"]
    assert db.execute_calls[1]["values"]["user_id"] == 1
    assert db.execute_calls[1]["values"]["model"] == "openai/gpt-5.2"
    assert db.execute_calls[1]["values"]["input_tokens"] == 300
    assert db.execute_calls[1]["values"]["output_tokens"] == 120
    assert db.execute_calls[1]["values"]["cached_tokens"] == 100
    assert db.execute_calls[1]["values"]["cost_usd"] == 1.25


def test_get_cache_hit_stats_returns_expected_rate():
    db = _StubDb(
        row={
            "input_tokens": 300,
            "output_tokens": 120,
            "cached_tokens": 100,
            "cost_usd": 1.25,
            "event_count": 2,
        }
    )
    tracker = UsageTracker(db)

    stats = _run(tracker.get_cache_hit_stats(1))

    assert stats["user_id"] == 1
    assert stats["event_count"] == 2
    assert stats["input_tokens"] == 300
    assert stats["cached_tokens"] == 100
    assert stats["total_prompt_tokens"] == 400
    assert stats["cache_hit_rate_percent"] == 25.0
    assert stats["cost_usd"] == 1.25


def test_get_cache_hit_stats_zero_when_no_rows():
    db = _StubDb(row=None)
    tracker = UsageTracker(db)

    stats = _run(tracker.get_cache_hit_stats(1))

    assert stats["event_count"] == 0
    assert stats["total_prompt_tokens"] == 0
    assert stats["cache_hit_rate_percent"] == 0.0
