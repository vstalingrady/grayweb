from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """
    Return a naive UTC datetime without using datetime.utcnow().

    The backend historically stores naive UTC timestamps in SQLite/Postgres.
    Python 3.12 deprecates datetime.utcnow(), so we build the same value via
    datetime.now(timezone.utc) and strip tzinfo.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utcnow_aware() -> datetime:
    """Return a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

