import sys
import sqlite3
from pathlib import Path

import pytest

# Ensure backend module is importable
ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

import main


@pytest.mark.asyncio
async def test_basic_migrations_add_chat_reminders_columns(tmp_path: Path):
    db_path = tmp_path / "chat_migrations_test.db"

    # Create an intentionally older schema (no `reminders` columns).
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("CREATE TABLE reminders (id INTEGER PRIMARY KEY, user_id INTEGER)")
        conn.execute(
            """
            CREATE TABLE user_chat_messages (
                id INTEGER PRIMARY KEY,
                thread_id TEXT NOT NULL,
                role TEXT NOT NULL,
                text TEXT NOT NULL,
                grounding_metadata TEXT,
                attachments TEXT,
                created_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE general_chat_messages (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                user_data_id INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                grounding_metadata TEXT,
                attachments TEXT,
                created_at TEXT
            )
            """
        )
        conn.commit()
    finally:
        conn.close()

    # Point migrations at the temp DB path (the migrations use sqlite3 directly).
    previous_url = getattr(main, "DATABASE_URL", "")
    main.DATABASE_URL = f"sqlite:////{db_path}"
    try:
        await main._run_basic_migrations()
    finally:
        main.DATABASE_URL = previous_url

    conn = sqlite3.connect(db_path)
    try:
        def cols(table: str) -> set[str]:
            return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}

        assert "reminders" in cols("user_chat_messages")
        assert "reminders" in cols("general_chat_messages")
    finally:
        conn.close()
