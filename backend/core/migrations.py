"""
Database migration helpers.

Extracted from main.py to improve modularity.
"""

from backend.database import database, DATABASE_URL
from backend.core.sqlite_helpers import (
    ensure_sqlite_columns as _ensure_sqlite_columns,
    ensure_sqlite_index as _ensure_sqlite_index,
    ensure_sqlite_unique_index as _ensure_sqlite_unique_index,
    ensure_sqlite_table as _ensure_sqlite_table,
    drop_sqlite_table as _drop_sqlite_table,
    rename_sqlite_column_if_needed as _rename_sqlite_column_if_needed,
    rebuild_sqlite_table_without_columns as _rebuild_sqlite_table_without_columns,
)
from backend.logging_config import create_logger

api_logger = create_logger("backend.api")
app_logger = create_logger("backend.core")


# User columns to ensure exist at startup (sync, runs at import time)
_USER_COLUMNS = [
    ("auth_user_id", "TEXT", None),
    ("subscription_expires_at", "DATETIME", None),
    ("has_seen_general_chat", "BOOLEAN", "0"),
    ("maps_enabled", "BOOLEAN", "0"),
    ("improve_model_for_everyone", "BOOLEAN", "0"),
    ("daily_token_usage", "INTEGER", "0"),
    ("monthly_cost_usage", "REAL", "0"),
    ("weekly_cost_usage", "REAL", "0"),
    ("six_hour_cost_usage", "REAL", "0"),
    ("last_daily_reset", "TEXT", None),
    ("last_monthly_reset", "TEXT", None),
    ("last_weekly_reset", "TEXT", None),
    ("last_six_hour_reset", "TEXT", None),
    ("daily_gemini_pro_usage", "INTEGER", "0"),
    ("last_daily_gemini_pro_reset", "TEXT", None),
    ("workspace_background_id", "TEXT", None),
    ("personalization_show_calendar", "BOOLEAN", "1"),
    ("personalization_system_prompt_override", "TEXT", None),
    ("preferred_model", "TEXT", None),
    ("theme_mode", "TEXT", None),
    ("ui_locale", "TEXT", None),
    ("preferred_response_language", "TEXT", None),
    ("notification_preferences", "TEXT", None),
    ("conversation_memory_enabled", "BOOLEAN", "1"),
    ("auto_web_search_enabled", "BOOLEAN", "0"),
    ("visible_model_ids", "TEXT", None),
]

_USER_BACKFILL_NULLS = {
    "has_seen_general_chat": "0",
    "maps_enabled": "0",
    "improve_model_for_everyone": "0",
    "daily_token_usage": "0",
    "monthly_cost_usage": "0",
    "weekly_cost_usage": "0",
    "six_hour_cost_usage": "0",
    "daily_gemini_pro_usage": "0",
    "conversation_memory_enabled": "1",
    "auto_web_search_enabled": "0",
}


def run_startup_migrations():
    """
    Run synchronous SQLite migrations at import time.
    
    This consolidates the migration calls that were previously inline in main.py.
    These run BEFORE the FastAPI app starts, ensuring schema is ready.
    """
    # Ensure user columns
    _ensure_sqlite_columns("users", _USER_COLUMNS, backfill_nulls=_USER_BACKFILL_NULLS)

    # Some legacy DBs were created with a bad column name ("VARCHAR") for plan/habit descriptions.
    _rename_sqlite_column_if_needed("plans", "VARCHAR", "description")
    _rename_sqlite_column_if_needed("habits", "VARCHAR", "description")

    # User data columns
    _ensure_sqlite_columns("user_data", [
        ("profile", "JSON", None),
        ("context", "JSON", None),
        ("metadata", "JSON", None),
        ("workspace_context", "TEXT", None),
        ("long_term_memory", "TEXT", None),
    ])
    
    # General chat messages table
    _ensure_sqlite_table("general_chat_messages", """
        CREATE TABLE general_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_data_id INTEGER,
            role VARCHAR,
            content VARCHAR,
            grounding_metadata JSON,
            reminders JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    
    # Archive table for rolling memory compression
    _ensure_sqlite_table("archived_chat_messages", """
        CREATE TABLE archived_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            user_data_id INTEGER,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            grounding_metadata JSON,
            attachments JSON,
            reminders JSON,
            original_created_at DATETIME,
            archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            compression_batch_id TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    
    # Ensure reminders column for existing tables
    _ensure_sqlite_columns("general_chat_messages", [
        ("reminders", "JSON", None),
    ])
    
    # Indexes
    _ensure_sqlite_index("archived_chat_messages", "ix_archived_chat_messages_user_id", "user_id")
    _ensure_sqlite_index("user_chat_messages", "ix_user_chat_messages_thread_id", "thread_id")
    _ensure_sqlite_index("transactions", "ix_transactions_user_id", "user_id")
    _ensure_sqlite_index("user_chat_threads", "ix_user_chat_threads_user_identifier_last_message_at", "user_identifier, last_message_at")
    _ensure_sqlite_index("general_chat_messages", "ix_general_chat_messages_user_id_created_at", "user_id, created_at")
    _ensure_sqlite_index("media_uploads", "ix_media_uploads_user_id_created_at", "user_id, created_at")
    _ensure_sqlite_index("reminders", "ix_reminders_user_status_remind_at", "user_id, status, remind_at")
    _ensure_sqlite_unique_index("dashboard_pulses", "uq_dashboard_pulses_user_date", "user_id, date_key")
    _ensure_sqlite_unique_index("proactivity_settings", "uq_proactivity_settings_user_id", "user_id")

    # Transaction columns
    _ensure_sqlite_columns("transactions", [
        ("billing_cycle", "VARCHAR", None),
        ("subscription_starts_at", "DATETIME", None),
        ("subscription_ends_at", "DATETIME", None),
    ])


    _ensure_sqlite_columns(
        "plans",
        [
            ("deadline", "TEXT", None),
            ("schedule_slot", "TEXT", None),
            ("description", "TEXT", None),
            ("color", "TEXT", None),
        ],
    )
    _ensure_sqlite_columns("habits", [("description", "TEXT", None)])
    _ensure_sqlite_columns("chat_sessions", [("scope", "TEXT", "'thread'")])
    _ensure_sqlite_columns(
        "user_chat_threads",
        [
            ("summary", "TEXT", None),
            ("context_snapshot", "JSON", None),
            ("metadata", "JSON", None),
            ("last_message_at", "DATETIME", "CURRENT_TIMESTAMP"),
        ],
    )
    _ensure_sqlite_columns(
        "calendar_events",
        [
            ("color", "TEXT", None),
            ("reminder_minutes_before", "INTEGER", None),
            ("entry_type", "TEXT", "'event'"),
            ("is_completed", "BOOLEAN", "0"),
            ("recurrence", "TEXT", None),
            ("habit_id", "INTEGER", None),
            ("reminder_at", "DATETIME", None),
        ],
    )


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
