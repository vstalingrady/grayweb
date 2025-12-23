import os
from datetime import datetime, timedelta, timezone as dt_timezone

import pytest

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

from backend.proactivity_engine import ProactivityEngine, ProactivityUserSettings  # noqa: E402


class _FakeDb:
    is_connected = True

    def __init__(self, *, general_row=None, thread_row=None):
        self.general_row = general_row
        self.thread_row = thread_row
        self.calls = []

    async def fetch_one(self, query, values=None):  # noqa: ANN001, ANN201
        query_str = str(query)
        self.calls.append(query_str)
        if "FROM general_chat_messages" in query_str:
            return self.general_row
        if "FROM user_chat_messages" in query_str:
            return self.thread_row
        raise AssertionError(f"Unexpected query: {query}")


class _TestEngine(ProactivityEngine):
    def __init__(self, db):  # noqa: ANN001
        super().__init__(db=db)
        self.sent = False

    def _current_window_bounds(self, settings, timezone, *, now_override=None):  # noqa: ANN001
        now = datetime.now(dt_timezone.utc)
        return now, now + timedelta(minutes=5)

    async def _send_proactivity_message(  # noqa: ANN001
        self, user_id, settings, timezone, *, source, delivery_key=None
    ):
        self.sent = True
        return {"sent": True}


@pytest.mark.asyncio
async def test_proactivity_skips_inactive_user(monkeypatch):
    monkeypatch.setenv("PROACTIVITY_INACTIVE_DAYS", "7")
    old_message = datetime.now(dt_timezone.utc) - timedelta(days=8)
    db = _FakeDb(general_row={"created_at": old_message}, thread_row=None)
    engine = _TestEngine(db=db)
    settings = ProactivityUserSettings(
        user_id=1,
        payload={"cadence": "daily", "times": ["09:00"]},
        timezone="UTC",
    )

    result = await engine._dispatch_user_if_due_impl(1, source="cron", user_settings=settings)

    assert result is None
    assert engine.sent is False


@pytest.mark.asyncio
async def test_proactivity_allows_recent_thread_activity(monkeypatch):
    monkeypatch.setenv("PROACTIVITY_INACTIVE_DAYS", "7")
    recent_message = datetime.now(dt_timezone.utc) - timedelta(days=2)
    db = _FakeDb(general_row=None, thread_row={"created_at": recent_message})
    engine = _TestEngine(db=db)
    settings = ProactivityUserSettings(
        user_id=1,
        payload={"cadence": "daily", "times": ["09:00"]},
        timezone="UTC",
    )

    result = await engine._dispatch_user_if_due_impl(1, source="cron", user_settings=settings)

    assert result is not None
    assert engine.sent is True
    assert any("FROM user_chat_messages" in call for call in db.calls)
