import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio

ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

TEST_DB_PATH = ROOT / "backend" / "tests" / "proactivity_chat_context.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_KEY", "")

import main  # noqa: E402
from proactivity_engine import ProactivityEngine  # noqa: E402


@pytest_asyncio.fixture
async def connected_db():
    if not main.database.is_connected:
        await main.database.connect()

    import sqlalchemy

    engine = sqlalchemy.create_engine(str(main.database.url))
    main.metadata.create_all(engine)

    for table in (main.proactivity_settings, main.proactive_notifications, main.general_chat_messages, main.users):
        await main.database.execute(table.delete())

    yield main.database
    await main.database.disconnect()


async def _create_test_user(db):
    now = datetime.now(timezone.utc)
    query = main.users.insert().values(
        email=f"proactivity-chat-{now.timestamp()}@example.com",
        full_name="Proactivity Chat User",
        initials="PC",
        role="user",
        created_at=now,
        updated_at=now,
    )
    return await db.execute(query)


@pytest.mark.asyncio
async def test_proactivity_uses_general_chat_context(connected_db):
    db = connected_db
    user_id = await _create_test_user(db)

    await db.execute(
        main.proactivity_settings.insert().values(
            user_id=user_id,
            payload={
                "cadence": "Daily",
                "time": "09:00",
                "times": ["09:00"],
                "channels": ["assistant"],
                "timezone": "UTC",
            },
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )

    await db.execute(
        main.general_chat_messages.insert().values(
            user_id=user_id,
            user_data_id=user_id,
            role="user",
            content="We decided the next sprint goal is shipping proactivity reminders for /g chats.",
            created_at=datetime.now(timezone.utc),
        )
    )

    mock_ai = AsyncMock()
    mock_ai.generate_daily_briefing.return_value = ("Summary", "Check-in")
    engine = ProactivityEngine(db=db, ai_generator=mock_ai)

    await engine.dispatch_user_if_due(user_id, source="test", force=True)

    assert mock_ai.generate_daily_briefing.await_count == 1
    kwargs = mock_ai.generate_daily_briefing.await_args.kwargs
    chat_context = kwargs.get("chat_context")
    assert isinstance(chat_context, str)
    assert "shipping proactivity reminders for /g chats" in chat_context

