import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import pytest_asyncio
import sqlalchemy

ROOT = Path(__file__).resolve().parents[2]
TEST_DB_PATH = ROOT / "backend" / "tests" / "calendar_event_reminders_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

import backend.main as main  # noqa: E402
from backend.api import calendars as calendars_api  # noqa: E402
from backend.models import CalendarEventUpdate  # noqa: E402


def _normalize_dt(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _is_utc_aware(value: datetime | str | None) -> bool:
    normalized = _normalize_dt(value)
    if normalized is None:
        return False
    return normalized.utcoffset() == timedelta(0)


@pytest_asyncio.fixture
async def connected_db():
    if not main.database.is_connected:
        await main.database.connect()

    db_url = str(main.database.url)
    if "+aiosqlite" in db_url:
        db_url = db_url.replace("+aiosqlite", "")

    engine = sqlalchemy.create_engine(db_url)
    main.metadata.drop_all(engine)
    main.metadata.create_all(engine)

    for table in (
        main.reminders,
        main.calendar_events,
        main.calendars,
        main.users,
    ):
        await main.database.execute(table.delete())
    yield main.database
    await main.database.disconnect()


async def _create_user(db) -> int:
    now = datetime.now(timezone.utc)
    return await db.execute(
        main.users.insert().values(
            email=f"calendar-reminder-user-{now.timestamp()}@example.com",
            full_name="Calendar Reminder User",
            initials="CR",
            role="user",
            plan_tier="voyager",
            created_at=now,
            updated_at=now,
        )
    )


async def _create_calendar(db, user_id: int) -> int:
    now = datetime.now(timezone.utc)
    return await db.execute(
        main.calendars.insert().values(
            user_id=user_id,
            label="Main",
            color="#4f63ff",
            is_visible=True,
            created_at=now,
            updated_at=now,
        )
    )


async def _create_event_with_pending_reminder(
    db,
    *,
    user_id: int,
    calendar_id: int,
    title: str,
    description: str | None,
    start_time: datetime,
    end_time: datetime,
    reminder_minutes_before: int | None,
    reminder_at: datetime | None,
) -> tuple[int, int]:
    event_id = await db.execute(
        main.calendar_events.insert().values(
            user_id=user_id,
            calendar_id=calendar_id,
            title=title,
            description=description,
            start_time=start_time,
            end_time=end_time,
            color="#4452ff",
            reminder_minutes_before=reminder_minutes_before,
            entry_type="event",
            is_completed=False,
            recurrence=None,
            habit_id=None,
            reminder_at=reminder_at,
            created_at=datetime.now(timezone.utc),
        )
    )
    reminder_id = await db.execute(
        main.reminders.insert().values(
            user_id=user_id,
            label=title,
            description=description,
            summary=description,
            remind_at=reminder_at if reminder_at is not None else start_time,
            entity_type="event",
            entity_id=int(event_id),
            delivery_mode="event",
            metadata=None,
            status="pending",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            delivered_at=None,
        )
    )
    return int(event_id), int(reminder_id)


@pytest.mark.asyncio
async def test_update_calendar_event_title_updates_pending_reminder_payload(connected_db):
    db = connected_db
    user_id = await _create_user(db)
    calendar_id = await _create_calendar(db, user_id)

    start_time = datetime.now(timezone.utc) + timedelta(hours=4)
    end_time = start_time + timedelta(hours=1)
    reminder_at = start_time - timedelta(minutes=15)

    event_id, reminder_id = await _create_event_with_pending_reminder(
        db,
        user_id=user_id,
        calendar_id=calendar_id,
        title="Old title",
        description="Old details",
        start_time=start_time,
        end_time=end_time,
        reminder_minutes_before=15,
        reminder_at=reminder_at,
    )

    current_user = {"id": user_id, "role": "user", "plan_tier": "voyager", "subscription_expires_at": None}
    await calendars_api.update_calendar_event(
        user_id=user_id,
        event_id=event_id,
        event_update=CalendarEventUpdate(title="New title"),
        db=db,
        current_user=current_user,
    )

    updated_reminder = await db.fetch_one(main.reminders.select().where(main.reminders.c.id == reminder_id))
    assert updated_reminder is not None
    assert updated_reminder["label"] == "New title"
    assert updated_reminder["description"] == "Old details"


@pytest.mark.asyncio
async def test_update_calendar_event_start_time_preserves_absolute_reminder(connected_db):
    db = connected_db
    user_id = await _create_user(db)
    calendar_id = await _create_calendar(db, user_id)

    start_time = datetime.now(timezone.utc) + timedelta(hours=3)
    end_time = start_time + timedelta(hours=1)
    reminder_at = start_time - timedelta(minutes=20)

    event_id, reminder_id = await _create_event_with_pending_reminder(
        db,
        user_id=user_id,
        calendar_id=calendar_id,
        title="Absolute reminder event",
        description="Needs absolute reminder",
        start_time=start_time,
        end_time=end_time,
        reminder_minutes_before=None,
        reminder_at=reminder_at,
    )

    moved_start_time = start_time + timedelta(hours=2)
    current_user = {"id": user_id, "role": "user", "plan_tier": "voyager", "subscription_expires_at": None}
    response = await calendars_api.update_calendar_event(
        user_id=user_id,
        event_id=event_id,
        event_update=CalendarEventUpdate(start_time=moved_start_time),
        db=db,
        current_user=current_user,
    )

    updated_reminder = await db.fetch_one(main.reminders.select().where(main.reminders.c.id == reminder_id))
    assert updated_reminder is not None

    expected = _normalize_dt(reminder_at)
    actual_from_reminder = _normalize_dt(updated_reminder["remind_at"])
    actual_from_response = _normalize_dt(response.get("reminder_at"))

    assert actual_from_reminder == expected
    assert actual_from_response == expected
    assert _is_utc_aware(response.get("start_time"))
    assert _is_utc_aware(response.get("end_time"))
    assert _is_utc_aware(response.get("reminder_at"))


@pytest.mark.asyncio
async def test_get_user_calendar_events_returns_utc_aware_timestamps(connected_db):
    db = connected_db
    user_id = await _create_user(db)
    calendar_id = await _create_calendar(db, user_id)

    start_time = datetime.now(timezone.utc) + timedelta(hours=6)
    end_time = start_time + timedelta(minutes=45)
    reminder_at = start_time - timedelta(minutes=10)

    await _create_event_with_pending_reminder(
        db,
        user_id=user_id,
        calendar_id=calendar_id,
        title="UTC normalization check",
        description="Ensure event payload timestamps are UTC aware",
        start_time=start_time,
        end_time=end_time,
        reminder_minutes_before=None,
        reminder_at=reminder_at,
    )

    current_user = {"id": user_id, "role": "user", "plan_tier": "voyager", "subscription_expires_at": None}
    events = await calendars_api.get_user_calendar_events(
        user_id=user_id,
        current_user=current_user,
        start_date=None,
        end_date=None,
        db=db,
    )

    assert len(events) == 1
    event = events[0]
    assert _is_utc_aware(event.get("start_time"))
    assert _is_utc_aware(event.get("end_time"))
    assert _is_utc_aware(event.get("created_at"))
    assert _is_utc_aware(event.get("reminder_at"))
