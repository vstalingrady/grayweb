import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
import sqlalchemy

# Ensure backend module is importable
ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

TEST_DB_PATH = ROOT / "backend" / "tests" / "reminders_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

import main  # noqa: E402


@pytest_asyncio.fixture
async def connected_db():
    if not main.database.is_connected:
        await main.database.connect()
    
    # Ensure tables exist using sync engine for metadata.create_all
    db_url = str(main.database.url)
    if "+aiosqlite" in db_url:
        db_url = db_url.replace("+aiosqlite", "")
    
    engine = sqlalchemy.create_engine(db_url)
    main.metadata.drop_all(engine)
    main.metadata.create_all(engine)

    # Ensure a clean slate for each test.
    for table in (main.reminders, main.plans, main.habits, main.users):
        await main.database.execute(table.delete())
    yield main.database
    await main.database.disconnect()


async def _create_test_user(db):
    now = datetime.now(timezone.utc)
    return await db.execute(
        main.users.insert().values(
            email=f"reminder-user-{now.timestamp()}@example.com",
            full_name="Reminder Test User",
            initials="RT",
            role="user",
            created_at=now,
            updated_at=now,
        )
    )


def test_timezone_extraction_from_time_context():
    label, tzinfo = main._timezone_from_time_context(
        "Current local time: Monday 10:00 AM (timezone: Europe/Paris, UTC+01:00). ISO timestamp: 2025-01-01T09:00:00.000Z"
    )
    assert label == "Europe/Paris"
    assert tzinfo.utcoffset(datetime.now(timezone.utc)) is not None


@pytest.mark.asyncio
async def test_maybe_enrich_actions_with_relative_time():
    actions = [
        {
            "entity": "plan",
            "label": "Drink water",
            "description": None,
            "time_iso": None,
            "schedule_slot": None,
        }
    ]
    time_context = (
        "Current local time: Monday, January 6, 2025 at 01:23:00 PM "
        "(timezone: America/Los_Angeles, UTC-08:00). ISO timestamp: 2025-01-06T21:23:00.000Z"
    )
    await main._maybe_enrich_actions_with_reminder_time(
        actions,
        "please remind me in 30 minutes to drink water",
        time_context,
    )
    assert actions[0]["time_iso"] is not None
    assert actions[0]["description"] is not None


@pytest.mark.asyncio
async def test_repeat_request_reschedules_existing_reminder(connected_db):
    db = connected_db
    user_id = await _create_test_user(db)

    base_time = datetime.now(timezone.utc) + timedelta(minutes=2)
    follow_up_time = base_time + timedelta(seconds=30)
    first_action = {
        "entity": "plan",
        "label": "Remind Vstalin Grady to eat",
        "description": "eat in 2 minutes",
        "time_iso": base_time.isoformat(),
        "schedule_slot": None,
    }
    second_action = {
        **first_action,
        "description": "eat again in 2 minutes",
        "time_iso": follow_up_time.isoformat(),
    }

    first_creations = await main._create_reminders_from_actions(db, user_id, [first_action])
    assert len(first_creations) == 1
    assert first_creations[0]["operation"] == "created"
    reminder_id = first_creations[0]["reminder"]["id"]

    second_creations = await main._create_reminders_from_actions(db, user_id, [second_action])
    assert len(second_creations) == 1
    rescheduled = second_creations[0]
    assert rescheduled["operation"] == "rescheduled"
    assert rescheduled["reminder"]["id"] == reminder_id
    assert main._ensure_datetime_value(rescheduled["reminder"]["remind_at"]) == main._ensure_datetime_value(
        second_action["time_iso"]
    )

    reminder_rows = await db.fetch_all(main.reminders.select())
    assert len(reminder_rows) == 1
    plan_rows = await db.fetch_all(main.plans.select())
    assert len(plan_rows) == 1
    assert plan_rows[0]["deadline"] == second_action["time_iso"]
