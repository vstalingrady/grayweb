import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

from backend.proactivity_engine import ProactivityEngine  # noqa: E402


def _engine():
    # db is unused for timing helpers, so a sentinel works.
    return ProactivityEngine(db=None)  # type: ignore[arg-type]


def test_current_window_bounds_never_sends_early():
    engine = _engine()
    settings = {"cadence": "daily", "times": ["09:00"]}

    # 15 minutes before scheduled time should not be due.
    now = datetime(2025, 1, 1, 8, 45, tzinfo=timezone.utc)
    assert engine._current_window_bounds(settings, "UTC", now_override=now) is None


def test_current_window_bounds_allows_grace_after_time():
    engine = _engine()
    settings = {"cadence": "daily", "times": ["09:00"]}

    at_time = datetime(2025, 1, 1, 9, 0, tzinfo=timezone.utc)
    window = engine._current_window_bounds(settings, "UTC", now_override=at_time)
    assert window is not None
    start, end = window
    assert start == at_time.replace(second=0, microsecond=0)
    assert end - start == timedelta(minutes=30)

    within_grace = datetime(2025, 1, 1, 9, 20, tzinfo=timezone.utc)
    assert engine._current_window_bounds(settings, "UTC", now_override=within_grace) is not None

    after_grace = datetime(2025, 1, 1, 9, 31, tzinfo=timezone.utc)
    assert engine._current_window_bounds(settings, "UTC", now_override=after_grace) is None
