"""
Database migration helpers.

Extracted from main.py to improve modularity.
"""

try:
    from backend.database import database, DATABASE_URL
except ImportError:
    from database import database, DATABASE_URL  # type: ignore

try:
    from backend.core.sqlite_helpers import (
        ensure_sqlite_columns as _ensure_sqlite_columns,
        ensure_sqlite_index as _ensure_sqlite_index,
        drop_sqlite_table as _drop_sqlite_table,
        rebuild_sqlite_table_without_columns as _rebuild_sqlite_table_without_columns,
    )
except ImportError:
    from core.sqlite_helpers import (  # type: ignore
        ensure_sqlite_columns as _ensure_sqlite_columns,
        ensure_sqlite_index as _ensure_sqlite_index,
        drop_sqlite_table as _drop_sqlite_table,
        rebuild_sqlite_table_without_columns as _rebuild_sqlite_table_without_columns,
    )

try:
    from backend.logging_config import create_logger
except ImportError:
    from logging_config import create_logger  # type: ignore

api_logger = create_logger("backend.api")
app_logger = create_logger("backend.core")


async def run_basic_migrations():
    """Ensure critical SQLite columns exist."""
    _drop_sqlite_table("user_streaks")
    _rebuild_sqlite_table_without_columns("habits", {"streak_label", "streak_id"})
    _ensure_sqlite_index("habits", "ix_habits_user_id", "user_id")

    _ensure_sqlite_columns(
        "users",
        [
            ("visible_model_ids", "TEXT", "NULL"),
            ("personalization_location", "TEXT", "NULL"),
            ("personalization_time_zone", "TEXT", "NULL"),
            ("personalization_system_prompt_override", "TEXT", "NULL"),
            ("theme_mode", "TEXT", "NULL"),
            ("ui_locale", "TEXT", "NULL"),
            ("preferred_response_language", "TEXT", "NULL"),
            ("notification_preferences", "TEXT", "NULL"),
            ("conversation_memory_enabled", "BOOLEAN", "1"),
            ("auto_web_search_enabled", "BOOLEAN", "0"),
        ],
    )
    if DATABASE_URL.startswith("postgres"):
        try:
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS visible_model_ids JSONB"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_location TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_time_zone TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_system_prompt_override TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_mode TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_locale TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_response_language TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS conversation_memory_enabled BOOLEAN DEFAULT TRUE"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_web_search_enabled BOOLEAN DEFAULT FALSE"
            )
        except Exception as exc:  # pragma: no cover - best effort migration
            app_logger.warning(
                "Postgres migration failed",
                extra={"event_type": "postgres_migration_error", "table": "users", "error": str(exc)},
            )
    _ensure_sqlite_columns(
        "user_chat_messages",
        [
            # Older local DBs did not include reminders; missing columns break SELECT *.
            ("reminders", "TEXT", "NULL"),
        ],
    )
    _ensure_sqlite_columns(
        "general_chat_messages",
        [
            # Older local DBs did not include reminders; missing columns break SELECT *.
            ("reminders", "TEXT", "NULL"),
        ],
    )
    _ensure_sqlite_columns(
        "reminders",
        [
            ("label", "TEXT", "''"),
            ("remind_at", "TIMESTAMP", "CURRENT_TIMESTAMP"),
            ("status", "TEXT", "'pending'"),
            ("description", "TEXT", "NULL"),
            ("summary", "TEXT", "NULL"),
            ("entity_type", "TEXT", "NULL"),
            ("entity_id", "INTEGER", "NULL"),
            ("delivery_mode", "TEXT", "NULL"),
            ("metadata", "TEXT", "NULL"),
            ("delivered_at", "TIMESTAMP", "NULL"),
        ]
    )


async def ensure_paddle_columns():
    """Ensure Paddle columns exist in SQLite."""
    try:
        # Check users table
        api_logger.info("Checking for Paddle columns...")
        query = "PRAGMA table_info(users)"
        columns = await database.fetch_all(query)
        col_names = [col["name"] for col in columns]

        if "paddle_customer_id" not in col_names:
            api_logger.info("Adding paddle_customer_id to users")
            await database.execute("ALTER TABLE users ADD COLUMN paddle_customer_id TEXT")
            await database.execute("CREATE INDEX ix_users_paddle_customer_id ON users (paddle_customer_id)")
        
        if "paddle_subscription_id" not in col_names:
            api_logger.info("Adding paddle_subscription_id to users")
            await database.execute("ALTER TABLE users ADD COLUMN paddle_subscription_id TEXT")
            await database.execute("CREATE INDEX ix_users_paddle_subscription_id ON users (paddle_subscription_id)")

        # Check transactions table
        query = "PRAGMA table_info(transactions)"
        columns = await database.fetch_all(query)
        col_names = [col["name"] for col in columns]
        
        if "paddle_transaction_id" not in col_names:
            api_logger.info("Adding paddle_transaction_id to transactions")
            await database.execute("ALTER TABLE transactions ADD COLUMN paddle_transaction_id TEXT")
            await database.execute("CREATE UNIQUE INDEX ix_transactions_paddle_transaction_id ON transactions (paddle_transaction_id)")

    except Exception as e:
        api_logger.error(f"Failed to ensure Paddle columns: {e}")
