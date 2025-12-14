import os
import sys
import sqlite3
from pathlib import Path

import pytest

# Ensure backend module is importable
ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

TEST_DB_PATH = ROOT / "backend" / "tests" / "push_subscribe_test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
# Force a dedicated sqlite DB for this test module (the repo's .env defaults DB_MODE=local).
os.environ["DB_MODE"] = "remote"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ.pop("LOCAL_DATABASE_URL", None)
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""

import main  # noqa: E402


@pytest.mark.asyncio
async def test_upsert_push_subscription_unique_violation_falls_back_to_update():
    from sqlalchemy.dialects import sqlite as sqlite_dialect

    class FakeDB:
        def __init__(self) -> None:
            self.insert_attempts = 0
            self.update_params: list[dict] = []
            self.executed_sql: list[str] = []

        async def fetch_one(self, query, values=None):  # noqa: ANN001
            return None

        async def execute(self, query, values=None):  # noqa: ANN001
            sql = str(query)
            self.executed_sql.append(sql)

            if "INSERT INTO proactivity_push_subscriptions" in sql:
                self.insert_attempts += 1
                raise sqlite3.IntegrityError(
                    "UNIQUE constraint failed: proactivity_push_subscriptions.endpoint"
                )

            if "UPDATE proactivity_push_subscriptions" in sql:
                compiled = query.compile(dialect=sqlite_dialect.dialect())
                self.update_params.append(compiled.params)

            return None

    fake_db = FakeDB()
    subscription = main.PushSubscriptionCreate(
        endpoint="https://example.com/push/endpoint",
        p256dh="new-p256dh",
        auth="new-auth",
    )

    result = await main._upsert_push_subscription(db=fake_db, user_id=1, subscription=subscription)

    assert result["status"] == "updated"
    assert fake_db.insert_attempts == 1
    assert any("UPDATE proactivity_push_subscriptions" in sql for sql in fake_db.executed_sql)
    assert fake_db.update_params

    params = fake_db.update_params[-1]
    assert params.get("user_id") == 1
    assert params.get("p256dh") == "new-p256dh"
    assert params.get("auth") == "new-auth"
    assert params.get("updated_at") is not None
