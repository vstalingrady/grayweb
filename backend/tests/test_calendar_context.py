import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

from calendar_context import build_calendar_context  # noqa: E402


class _FakeDb:
    def __init__(self, *, calendars_rows, events_rows):
        self._calendars_rows = list(calendars_rows)
        self._events_rows = list(events_rows)
        self.calls = []

    async def fetch_all(self, query, values=None):  # noqa: ANN001, ANN201
        query_text = str(query)
        self.calls.append(query_text)
        if "FROM calendars" in query_text:
            return list(self._calendars_rows)
        if "FROM calendar_events" in query_text:
            return list(self._events_rows)
        raise AssertionError(f"Unexpected query: {query_text}")


@pytest.mark.asyncio
async def test_build_calendar_context_formats_events():
    db = _FakeDb(
        calendars_rows=[
            {"id": 1, "label": "Work", "is_visible": True},
            {"id": 2, "label": "Hidden", "is_visible": False},
        ],
        events_rows=[
            {
                "id": 10,
                "user_id": 1,
                "calendar_id": 1,
                "title": "Standup",
                "description": "Daily sync",
                "start_time": "2025-01-01T11:00:00Z",
                "end_time": "2025-01-01T12:00:00Z",
            },
            {
                "id": 11,
                "user_id": 1,
                "calendar_id": None,
                "title": "Gym",
                "description": None,
                "start_time": "2025-01-02T09:00:00Z",
                "end_time": "2025-01-02T10:00:00Z",
            },
        ],
    )

    context = await build_calendar_context(
        user_id=1,
        db=db,
        user_timezone="UTC",
        time_context="The user's local time is Wednesday, January 1, 2025 at 10:00 AM (timezone: UTC, UTC+00:00). ISO timestamp: 2025-01-01T10:00:00Z.",
    )

    assert context is not None
    assert "Timezone: UTC" in context
    assert "Now: 2025-01-01 10:00" in context
    assert '- Today 11:00–12:00: "Standup" (Work) — Daily sync' in context
    assert '- Tomorrow 09:00–10:00: "Gym"' in context
    assert "(hidden calendars excluded)" in context


@pytest.mark.asyncio
async def test_build_calendar_context_reports_empty_schedule():
    db = _FakeDb(calendars_rows=[], events_rows=[])

    context = await build_calendar_context(
        user_id=1,
        db=db,
        user_timezone="UTC",
        time_context="The user's local time is Wednesday, January 1, 2025 at 10:00 AM (timezone: UTC, UTC+00:00). ISO timestamp: 2025-01-01T10:00:00Z.",
    )

    assert context is not None
    assert "Events (next 7 days): none" in context

