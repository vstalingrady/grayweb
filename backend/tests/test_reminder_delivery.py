import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import pytest_asyncio
import sqlalchemy

# Ensure backend module is importable
ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

TEST_DB_PATH = ROOT / "backend" / "tests" / "reminder_delivery_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

import main  # noqa: E402
from proactivity_engine import ProactivityEngine, ProactivityRealtimeBroker  # noqa: E402


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

    for table in (main.reminders, main.proactive_notifications, main.general_chat_messages, main.user_data, main.users):
        await main.database.execute(table.delete())
    yield main.database
    await main.database.disconnect()


async def _create_test_user(db):
    now = datetime.now(timezone.utc)
    return await db.execute(
        main.users.insert().values(
            email=f"deliver-user-{now.timestamp()}@example.com",
            full_name="Reminder Delivery User",
            initials="RD",
            role="user",
            created_at=now,
            updated_at=now,
        )
    )


@pytest.mark.asyncio
async def test_dispatch_reminder_marks_delivered_and_emits_notification(connected_db):
    db = connected_db
    user_id = await _create_test_user(db)

    remind_at = datetime.now(timezone.utc) + timedelta(seconds=1)
    reminder_id = await db.execute(
        main.reminders.insert().values(
            user_id=user_id,
            label="Test reminder",
            description="Do the thing",
            summary=None,
            remind_at=remind_at,
            status="pending",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            delivered_at=None,
        )
    )

    broker = ProactivityRealtimeBroker()
    engine = ProactivityEngine(db=db, realtime_broker=broker, ai_generator=None)
    result = await engine.dispatch_reminder(user_id=user_id, reminder_id=int(reminder_id), source="test")
    assert result is not None

    reminder_row = await db.fetch_one(main.reminders.select().where(main.reminders.c.id == reminder_id))
    assert reminder_row is not None
    assert (reminder_row["status"] or "").lower() == "delivered"
    assert reminder_row["delivered_at"] is not None

    notification_rows = await db.fetch_all(
        main.proactive_notifications.select().where(main.proactive_notifications.c.user_id == user_id)
    )
    assert any((row["type"] or "").lower() == "reminder" for row in notification_rows)

    chat_rows = await db.fetch_all(
        main.general_chat_messages.select().where(main.general_chat_messages.c.user_id == user_id)
    )
    assert len(chat_rows) >= 1
    assert "Reminder:" in (chat_rows[-1]["content"] or "")

