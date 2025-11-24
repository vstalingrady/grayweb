#!/usr/bin/env python3

import os
import sys
from pathlib import Path

import databases
import sqlalchemy
import uvicorn
import logging

# Ensure the repository root is on the Python path so `import backend` works.
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))


def _configure_logging() -> logging.Logger:
  """
  Configure enhanced logging for backend startup tasks.

  This logger is intentionally more detailed than the runtime app logger so that
  `npm run backend` / `npm run dev:full` clearly show what the process is
  doing (database setup, workspace seed, server bind, etc.).
  """
  # Import our enhanced logging configuration
  try:
      from logging_config import setup_logging, create_logger

      # Use the enhanced logging setup for startup too
      logger = setup_logging(
          log_level=logging.INFO,
          enable_console=True,
          enable_file=False,  # No file logging for startup to keep it simple
          structured_format=False  # Use colored format for startup
      )

      # Create a specific startup logger
      startup_logger = create_logger("backend.startup")

      # Log startup initialization
      startup_logger.info("Enhanced startup logging initialized", extra={
          "event_type": "startup_logging_initialized",
          "log_level": "INFO",
          "structured_format": False
      })

      return startup_logger

  except ImportError:
      # Fallback to basic logging if our enhanced config isn't available
      logger = logging.getLogger("backend.startup")
      if logger.handlers:
          return logger

      logger.setLevel(logging.INFO)
      handler = logging.StreamHandler()
      formatter = logging.Formatter("[backend.startup] %(asctime)s %(levelname)s: %(message)s")
      handler.setFormatter(formatter)
      logger.addHandler(handler)
      logger.propagate = False
      logging.getLogger("uvicorn.access").disabled = True
      return logger


LOG = _configure_logging()


DEFAULT_WORKSPACE_BACKGROUNDS = []


if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    import time

    startup_start_time = time.time()

    LOG.info("Backend startup process initiated", extra={
        "event_type": "startup_initiated",
        "root_dir": str(ROOT_DIR),
        "python_version": sys.version,
        "pid": os.getpid()
    })

    LOG.info("Loading environment from %s", ROOT_DIR / ".env", extra={
        "event_type": "environment_loading_start",
        "env_file": str(ROOT_DIR / ".env"),
        "file_exists": (ROOT_DIR / ".env").exists()
    })

    load_dotenv(ROOT_DIR / ".env", override=True)

    # Log key environment variables (excluding sensitive ones)
    env_info = {
        "event_type": "environment_loaded",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "ai_provider": os.getenv("AI_PROVIDER", "gemini"),
        "file_search_enabled": os.getenv("ENABLE_FILE_SEARCH", "false"),
        "validate_gemini": os.getenv("VALIDATE_GEMINI_ON_STARTUP", "true")
    }

    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./users.db")
    env_info["database_type"] = "sqlite" if "sqlite" in DATABASE_URL else "postgresql"
    env_info["database_url_safe"] = DATABASE_URL.split('?')[0] if DATABASE_URL else None

    LOG.info("Environment configuration loaded", extra=env_info)
    LOG.info("Using DATABASE_URL=%s", DATABASE_URL)

    # Create database tables if they don't exist
    LOG.info("Connecting to database and ensuring tables exist...", extra={
        "event_type": "database_setup_start",
        "database_url_safe": DATABASE_URL.split('?')[0] if DATABASE_URL else None
    })
    engine = sqlalchemy.create_engine(DATABASE_URL.replace("sqlite:///", "sqlite:///"), echo=False)
    metadata = sqlalchemy.MetaData()

    # Define tables
    users = sqlalchemy.Table(
        "users",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("email", sqlalchemy.String, unique=True, index=True),
        sqlalchemy.Column("full_name", sqlalchemy.String),
        sqlalchemy.Column("profile_picture_url", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("role", sqlalchemy.String, default="user"),
        sqlalchemy.Column("plan_tier", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("initials", sqlalchemy.String),
        sqlalchemy.Column("personalization_nickname", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("personalization_occupation", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("personalization_about", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("personalization_custom_instructions", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    chat_sessions = sqlalchemy.Table(
        "chat_sessions",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("title", sqlalchemy.String),
        sqlalchemy.Column("scope", sqlalchemy.String, default="thread"),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    calendars = sqlalchemy.Table(
        "calendars",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("label", sqlalchemy.String),
        sqlalchemy.Column("color", sqlalchemy.String),
        sqlalchemy.Column("is_visible", sqlalchemy.Boolean, default=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    # Note: calendar_events table removed calendar_id column - it was conflicting with queries
    calendar_events = sqlalchemy.Table(
        "calendar_events",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")), 
        sqlalchemy.Column("calendar_id", sqlalchemy.ForeignKey("calendars.id"), nullable=True),
        sqlalchemy.Column("title", sqlalchemy.String),
        sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("start_time", sqlalchemy.DateTime),
        sqlalchemy.Column("end_time", sqlalchemy.DateTime),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )
    plans = sqlalchemy.Table(
        "plans",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("label", sqlalchemy.String),
        sqlalchemy.Column("completed", sqlalchemy.Boolean, default=False),
        sqlalchemy.Column("deadline", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("schedule_slot", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    proactive_state = sqlalchemy.Table(
        "proactive_state",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True, nullable=False),
        sqlalchemy.Column("next_check_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("queued_signature", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("queued_reason", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("queued_window", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("queued_time_label", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("engagement_snapshot", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("window_preferences", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("metadata", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    # Add habits table
    habits = sqlalchemy.Table(
        "habits",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("label", sqlalchemy.String),
        sqlalchemy.Column("streak_label", sqlalchemy.String),
        sqlalchemy.Column("previous_label", sqlalchemy.String),
        sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    reminders = sqlalchemy.Table(
        "reminders",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), nullable=False),
        sqlalchemy.Column("entity_type", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("entity_id", sqlalchemy.Integer, nullable=True),
        sqlalchemy.Column("delivery_mode", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("label", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("summary", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("remind_at", sqlalchemy.DateTime, nullable=False),
        sqlalchemy.Column("status", sqlalchemy.String, default="pending"),
        sqlalchemy.Column("metadata", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
        sqlalchemy.Column("delivered_at", sqlalchemy.DateTime, nullable=True),
    )
    dashboard_pulses = sqlalchemy.Table(
        "dashboard_pulses",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), nullable=False),
        sqlalchemy.Column("date_key", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("timestamp", sqlalchemy.DateTime, nullable=False),
        sqlalchemy.Column("plans", sqlalchemy.JSON, nullable=False, default=list),
        sqlalchemy.Column("habits", sqlalchemy.JSON, nullable=False, default=list),
        sqlalchemy.Column("proactivity", sqlalchemy.JSON, nullable=False, default=dict),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
        sqlalchemy.UniqueConstraint("user_id", "date_key", name="uq_dashboard_pulses_user_date"),
    )
    proactivity_settings = sqlalchemy.Table(
        "proactivity_settings",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
        sqlalchemy.Column("payload", sqlalchemy.JSON, nullable=False, default=dict),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    proactivity_push_subscriptions = sqlalchemy.Table(
        "proactivity_push_subscriptions",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), nullable=False),
        sqlalchemy.Column("endpoint", sqlalchemy.String, nullable=False, unique=True),
        sqlalchemy.Column("p256dh", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("auth", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )
    user_streaks = sqlalchemy.Table(
        "user_streaks",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
        sqlalchemy.Column("current_streak", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("last_activity_date", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    # Proactivity tracking
    proactivity_logs = sqlalchemy.Table(
        "proactivity_logs",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("activity_date", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("tasks_completed", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("total_tasks", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("score", sqlalchemy.Integer, default=0),
        sqlalchemy.Column("notes", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    context_cache = sqlalchemy.Table(
        "context_cache",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("conversation_id", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("label", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("content", sqlalchemy.Text, nullable=False),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )

    # Proactive notifications
    proactive_notifications = sqlalchemy.Table(
        "proactive_notifications",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("type", sqlalchemy.String),
        sqlalchemy.Column("title", sqlalchemy.String),
        sqlalchemy.Column("message", sqlalchemy.String),
        sqlalchemy.Column("metadata", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("due_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("sent_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("read_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("completed_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )

    file_search_stores = sqlalchemy.Table(
        "file_search_stores",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
        sqlalchemy.Column("store_name", sqlalchemy.String, unique=True),
        sqlalchemy.Column("display_name", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    media_uploads = sqlalchemy.Table(
        "media_uploads",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("filename", sqlalchemy.String),
        sqlalchemy.Column("mime_type", sqlalchemy.String),
        sqlalchemy.Column("size", sqlalchemy.Integer),
        sqlalchemy.Column("storage_path", sqlalchemy.String),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )

    workspace_backgrounds = sqlalchemy.Table(
        "workspace_backgrounds",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("slug", sqlalchemy.String, unique=True, index=True),
        sqlalchemy.Column("label", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("preview_css", sqlalchemy.Text, nullable=False),
        sqlalchemy.Column("backdrop_css", sqlalchemy.Text, nullable=False),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    # Fixed: Removed calendar_id reference from CalendarEvent table

    # Google Calendar credentials table
    google_calendar_credentials = sqlalchemy.Table(
        "google_calendar_credentials",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("access_token", sqlalchemy.String),
        sqlalchemy.Column("refresh_token", sqlalchemy.String),
        sqlalchemy.Column("token_uri", sqlalchemy.String),
        sqlalchemy.Column("client_id", sqlalchemy.String),
        sqlalchemy.Column("client_secret", sqlalchemy.String),
        sqlalchemy.Column("scopes", sqlalchemy.String),  # JSON string
        sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    table_creation_start = time.time()
    LOG.info("Creating database tables...", extra={
        "event_type": "table_creation_start",
        "table_count": len(metadata.tables)
    })

    metadata.create_all(engine)

    table_creation_time = (time.time() - table_creation_start) * 1000
    LOG.info("Database tables created successfully", extra={
        "event_type": "table_creation_complete",
        "table_count": len(metadata.tables),
        "creation_time_ms": table_creation_time,
        "tables": list(metadata.tables.keys())
    })

    # Seed workspace backgrounds
    LOG.info("Seeding workspace backgrounds...", extra={
        "event_type": "workspace_backgrounds_seeding_start"
    })

    with engine.begin() as connection:
        existing_slugs = {
            row[0]
            for row in connection.execute(sqlalchemy.select(workspace_backgrounds.c.slug))
        }

        backgrounds_added = 0
        for background in DEFAULT_WORKSPACE_BACKGROUNDS:
            if background["slug"] in existing_slugs:
                continue
            connection.execute(
                workspace_backgrounds.insert().values(
                    slug=background["slug"],
                    label=background["label"],
                    description=background.get("description"),
                    preview_css=background["preview_css"],
                    backdrop_css=background["backdrop_css"],
                )
            )
            backgrounds_added += 1

    LOG.info("Workspace backgrounds seeding completed", extra={
        "event_type": "workspace_backgrounds_seeding_complete",
        "total_backgrounds": len(DEFAULT_WORKSPACE_BACKGROUNDS),
        "existing_slugs": len(existing_slugs),
        "backgrounds_added": backgrounds_added
    })

    def _table_columns(table_name: str) -> set[str]:
        inspector = sqlalchemy.inspect(engine)
        return {column["name"] for column in inspector.get_columns(table_name)}

    # Enhanced migration logging
    migrations_performed = []

    def rename_column_if_needed(table_name: str, old_name: str, new_name: str) -> None:
        columns = _table_columns(table_name)
        if old_name not in columns or new_name in columns:
            return
        with engine.begin() as connection:
            connection.execute(
                sqlalchemy.text(
                    f'ALTER TABLE {table_name} RENAME COLUMN "{old_name}" TO "{new_name}"'
                )
            )
            migrations_performed.append(f"rename_{table_name}_{old_name}_to_{new_name}")
            LOG.info(f"Renamed column in {table_name}: {old_name} -> {new_name}", extra={
                "event_type": "column_renamed",
                "table": table_name,
                "old_name": old_name,
                "new_name": new_name
            })

    def ensure_column(table_name: str, column_name: str, column_type: str) -> None:
        if column_name in _table_columns(table_name):
            return
        with engine.begin() as connection:
            connection.execute(
                sqlalchemy.text(
                    f'ALTER TABLE {table_name} ADD COLUMN "{column_name}" {column_type}'
                )
            )
            migrations_performed.append(f"add_{table_name}_{column_name}_{column_type}")
            LOG.info(f"Added column to {table_name}: {column_name} ({column_type})", extra={
                "event_type": "column_added",
                "table": table_name,
                "column_name": column_name,
                "column_type": column_type
            })

    migration_start = time.time()
    LOG.info("Running database migrations...", extra={
        "event_type": "migrations_start"
    })

    rename_column_if_needed("plans", "VARCHAR", "description")
    rename_column_if_needed("habits", "VARCHAR", "description")
    ensure_column("plans", "deadline", "VARCHAR")
    ensure_column("plans", "schedule_slot", "VARCHAR")
    ensure_column("plans", "description", "VARCHAR")
    ensure_column("habits", "description", "VARCHAR")
    ensure_column("chat_sessions", "scope", "VARCHAR DEFAULT 'thread'")

    migration_time = (time.time() - migration_start) * 1000
    LOG.info("Database migrations completed", extra={
        "event_type": "migrations_complete",
        "migration_time_ms": migration_time,
        "migrations_performed": len(migrations_performed),
        "migration_list": migrations_performed
    })

    total_startup_time = (time.time() - startup_start_time) * 1000
    LOG.info("Database setup completed successfully", extra={
        "event_type": "database_setup_complete",
        "total_startup_time_ms": total_startup_time,
        "migration_time_ms": migration_time,
        "table_creation_time_ms": table_creation_time,
        "migrations_performed": len(migrations_performed)
    })

    # Start the FastAPI server
    server_start_info = {
        "host": "0.0.0.0",
        "port": 8000,
        "reload": True,
        "log_level": "info",
        "access_log": False,
        "total_startup_time_ms": (time.time() - startup_start_time) * 1000
    }

    LOG.info("Starting FastAPI server", extra={
        "event_type": "server_startup_initiated",
        **server_start_info
    })

    LOG.info("🚀 Backend startup completed successfully!", extra={
        "event_type": "startup_complete",
        "server_url": "http://localhost:8000",
        "host": server_start_info["host"],
        "port": server_start_info["port"],
        "reload": server_start_info["reload"],
        "total_startup_time_ms": server_start_info["total_startup_time_ms"]
    })

    uvicorn.run(
        "backend.main:app",
        host=server_start_info["host"],
        port=server_start_info["port"],
        reload=server_start_info["reload"],
        reload_excludes=["*.db", "*.sqlite", "*.sqlite3", "*.log"],
        log_level=server_start_info["log_level"],
        access_log=server_start_info["access_log"]
    )
