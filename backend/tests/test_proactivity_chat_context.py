import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

from backend.proactivity_engine import ProactivityEngine  # noqa: E402


class _FakeDb:
    is_connected = True

    def __init__(self, *, general_rows, thread_rows):
        self._general_rows = list(general_rows)
        self._thread_rows = list(thread_rows)
        self.calls = []

    async def fetch_all(self, query, values=None):  # noqa: ANN001, ANN201
        self.calls.append(str(query))
        if "FROM general_chat_messages" in str(query):
            return list(self._general_rows)
        if "FROM user_chat_messages" in str(query):
            return list(self._thread_rows)
        raise AssertionError(f"Unexpected query: {query}")


@pytest.mark.asyncio
async def test_proactivity_prefers_general_chat_history():
    now = datetime.now(timezone.utc)
    db = _FakeDb(
        general_rows=[{"role": "user", "content": "From /g", "created_at": (now - timedelta(minutes=5)).isoformat()}],
        thread_rows=[{"role": "user", "content": "From thread", "created_at": (now - timedelta(minutes=4)).isoformat()}],
    )
    engine = ProactivityEngine(db=db)  # type: ignore[arg-type]

    context = await engine._load_recent_chat_context(1)

    assert "From /g" in (context or "")
    assert any("FROM general_chat_messages" in call for call in db.calls)
    assert not any("FROM user_chat_messages" in call for call in db.calls)


@pytest.mark.asyncio
async def test_proactivity_falls_back_to_thread_history_when_general_empty():
    now = datetime.now(timezone.utc)
    db = _FakeDb(
        general_rows=[],
        thread_rows=[
            {"role": "assistant", "content": "Newest reply", "created_at": (now - timedelta(minutes=1)).isoformat()},
            {"role": "user", "content": "Oldest prompt", "created_at": (now - timedelta(minutes=2)).isoformat()},
        ],
    )
    engine = ProactivityEngine(db=db)  # type: ignore[arg-type]

    context = await engine._load_recent_chat_context(1)

    assert context is not None
    assert "- User: Oldest prompt" in context
    assert "- Gray: Newest reply" in context
    assert any("FROM general_chat_messages" in call for call in db.calls)
    assert any("FROM user_chat_messages" in call for call in db.calls)
