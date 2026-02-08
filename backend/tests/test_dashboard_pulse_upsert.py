import os
from datetime import datetime, timezone
from pathlib import Path

import pytest
import pytest_asyncio
import sqlalchemy

ROOT = Path(__file__).resolve().parents[2]
TEST_DB_PATH = ROOT / "backend" / "tests" / "dashboard_pulse_upsert_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

import backend.main as main  # noqa: E402
from backend.api import dashboard as dashboard_api  # noqa: E402
from backend.models import DashboardPulseCreate  # noqa: E402


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
        main.dashboard_pulses,
        main.users,
    ):
        await main.database.execute(table.delete())

    yield main.database
    await main.database.disconnect()


async def _create_user(db) -> int:
    now = datetime.now(timezone.utc)
    return await db.execute(
        main.users.insert().values(
            email=f"dashboard-pulse-user-{now.timestamp()}@example.com",
            full_name="Dashboard Pulse User",
            initials="DP",
            role="user",
            created_at=now,
            updated_at=now,
        )
    )


@pytest.mark.asyncio
async def test_create_dashboard_pulse_is_idempotent_per_user_and_date(connected_db):
    db = connected_db
    user_id = await _create_user(db)
    current_user = {"id": user_id, "role": "user"}
    date_key = "2026-02-08"
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    first_payload = DashboardPulseCreate(
        date_key=date_key,
        timestamp=now_ms,
        plans=[{"id": "p1", "label": "first", "completed": False}],
        habits=[],
        proactivity={},
        carry_forward=False,
    )
    second_payload = DashboardPulseCreate(
        date_key=date_key,
        timestamp=now_ms + 1000,
        plans=[{"id": "p1", "label": "second", "completed": True}],
        habits=[],
        proactivity={},
        carry_forward=False,
    )

    first = await dashboard_api.create_dashboard_pulse(
        user_id=user_id,
        pulse=first_payload,
        current_user=current_user,
        db=db,
    )
    second = await dashboard_api.create_dashboard_pulse(
        user_id=user_id,
        pulse=second_payload,
        current_user=current_user,
        db=db,
    )

    rows = await db.fetch_all(
        main.dashboard_pulses.select().where(
            (main.dashboard_pulses.c.user_id == user_id)
            & (main.dashboard_pulses.c.date_key == date_key)
        )
    )
    assert len(rows) == 1
    assert first.id == second.id
    assert len(second.plans) == 1
    assert second.plans[0].label == "second"
    assert second.plans[0].completed is True
