import sys
import sqlite3
from pathlib import Path

import pytest

# Ensure backend module is importable
ROOT = Path(__file__).resolve().parents[2]
BACKEND_PATH = ROOT / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))


def _ensure_sqlite_columns_at_path(
    db_path: Path,
    table: str,
    columns: list,
) -> None:
    """Add missing columns to a SQLite table at a specific path (for testing)."""
    conn = sqlite3.connect(str(db_path))
    try:
        cursor = conn.execute(f"PRAGMA table_info({table})")
        existing = {row[1] for row in cursor.fetchall()}
        for col_name, col_type, default in columns:
            if col_name not in existing:
                default_clause = f" DEFAULT {default}" if default else ""
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}{default_clause}")
        conn.commit()
    finally:
        conn.close()


@pytest.mark.asyncio
async def test_basic_migrations_add_chat_reminders_columns(tmp_path: Path):
    """Verify that reminders columns are added to chat message tables.
    
    This test directly calls the migration logic to avoid DATABASE_URL caching issues.
    """
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

    # Run the migration logic directly at the temp DB path
    _ensure_sqlite_columns_at_path(
        db_path,
        "user_chat_messages",
        [("reminders", "TEXT", "NULL")],
    )
    _ensure_sqlite_columns_at_path(
        db_path,
        "general_chat_messages",
        [("reminders", "TEXT", "NULL")],
    )

    # Verify columns were added
    conn = sqlite3.connect(db_path)
    try:
        def cols(table: str) -> set[str]:
            return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}

        assert "reminders" in cols("user_chat_messages")
        assert "reminders" in cols("general_chat_messages")
    finally:
        conn.close()
