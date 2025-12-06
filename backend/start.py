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
      from logging_config import setup_logging, create_logger, get_log_level

      # Use the enhanced logging setup for startup too
      logger = setup_logging(
          log_level=get_log_level(),
          enable_console=True,
          enable_file=False,  # No file logging for startup to keep it simple
          structured_format=False  # Use colored format for startup
      )

      # Create a specific startup logger
      startup_logger = create_logger("backend.startup")

      startup_logger.debug("Startup logging initialized")

      return startup_logger

  except ImportError:
      # Fallback to basic logging if our enhanced config isn't available
      log_level = getattr(logging, os.getenv("LOG_LEVEL", "WARNING").upper(), logging.WARNING)
      logger = logging.getLogger("backend.startup")
      if logger.handlers:
          return logger

      logger.setLevel(log_level)
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

    LOG.info("Backend startup initiated")

    LOG.debug(f"Loading environment from {ROOT_DIR / '.env'}")

    load_dotenv(ROOT_DIR / ".env", override=False)



    def _normalize_sqlite_url(url: str) -> str:
        if not url.startswith("sqlite:///"):
            return url
        path = url.replace("sqlite:///", "", 1)
        path_obj = Path(path)
        if not path_obj.is_absolute():
            path_obj = (ROOT_DIR / path_obj).resolve()
        return f"sqlite:///{path_obj}"

    def _select_database_url() -> str:
        db_mode = (os.getenv("DB_MODE") or "").lower()
        primary_url = os.getenv("DATABASE_URL")
        local_url = os.getenv("LOCAL_DATABASE_URL")
        if db_mode == "remote":
            chosen = primary_url or local_url or "sqlite:///./users.db"
        elif db_mode == "local":
            chosen = local_url or primary_url or "sqlite:///./users.db"
        else:
            chosen = primary_url or local_url or "sqlite:///./users.db"
        return _normalize_sqlite_url(chosen)

    DATABASE_URL = _select_database_url()
    db_type = "sqlite" if "sqlite" in DATABASE_URL else "postgresql"
    LOG.info(f"Using {db_type} database")

    LOG.debug("Creating database tables...")
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
    transactions = sqlalchemy.Table(
        "transactions",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), nullable=False),
        sqlalchemy.Column("order_id", sqlalchemy.String, unique=True, index=True, nullable=False),
        sqlalchemy.Column("amount", sqlalchemy.Integer, nullable=False),
        sqlalchemy.Column("status", sqlalchemy.String, default="pending"),  # pending, settlement, cancel, expire, failure
        sqlalchemy.Column("payment_type", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("plan_tier", sqlalchemy.String, nullable=False),  # voyager, pioneer
        sqlalchemy.Column("snap_token", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("snap_redirect_url", sqlalchemy.String, nullable=True),
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

    google_calendar_states = sqlalchemy.Table(
        "google_calendar_states",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("state_token", sqlalchemy.String, unique=True, nullable=False),
        sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
        sqlalchemy.Column("nonce", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("redirect_uri", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("consumed_at", sqlalchemy.DateTime, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )

    # User data table for general chat and other personalization (local-only)
    user_data = sqlalchemy.Table(
        "user_data",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_identifier", sqlalchemy.Integer, unique=True, nullable=False),  # References users.id
        # JSON profile fields expected by the runtime database models
        sqlalchemy.Column("profile", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("context", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("metadata", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("workspace_context", sqlalchemy.String, nullable=True),
        # Additional local-only personalization helpers
        sqlalchemy.Column("nickname", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("occupation", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("about", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("custom_instructions", sqlalchemy.String, nullable=True),
        sqlalchemy.Column("has_seen_general_chat", sqlalchemy.Boolean, default=False),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
        sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=sqlalchemy.func.now(), onupdate=sqlalchemy.func.now()),
    )

    # General chat messages (local-only, for now)
    general_chat_messages = sqlalchemy.Table(
        "general_chat_messages",
        metadata,
        sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
        sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False),  # References users.id
        sqlalchemy.Column("user_data_id", sqlalchemy.ForeignKey("user_data.id"), nullable=False),
        sqlalchemy.Column("role", sqlalchemy.String, nullable=False),
        sqlalchemy.Column("content", sqlalchemy.Text, nullable=False),
        sqlalchemy.Column("grounding_metadata", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("attachments", sqlalchemy.JSON, nullable=True),
        sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=sqlalchemy.func.now()),
    )

    table_creation_start = time.time()
    LOG.debug(f"Creating {len(metadata.tables)} database tables...")

    metadata.create_all(engine)

    table_creation_time = (time.time() - table_creation_start) * 1000
    LOG.debug(f"Tables created ({table_creation_time:.0f}ms)")

    def _table_columns(table_name: str) -> set[str]:
        inspector = sqlalchemy.inspect(engine)
        return {column["name"] for column in inspector.get_columns(table_name)}

    # Migration tracking
    migrations_performed = []
    migration_start = time.time()

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
            LOG.debug(f"Renamed column {table_name}.{old_name} -> {new_name}")

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
            LOG.debug(f"Added column {table_name}.{column_name}")

    # Run migrations
    rename_column_if_needed("plans", "VARCHAR", "description")
    rename_column_if_needed("habits", "VARCHAR", "description")
    ensure_column("plans", "deadline", "VARCHAR")
    ensure_column("plans", "schedule_slot", "VARCHAR")
    ensure_column("plans", "description", "VARCHAR")
    ensure_column("habits", "description", "VARCHAR")
    ensure_column("chat_sessions", "scope", "VARCHAR DEFAULT 'thread'")

    migration_time = (time.time() - migration_start) * 1000
    if migrations_performed:
        LOG.info(f"Ran {len(migrations_performed)} migrations ({migration_time:.0f}ms)")

    # Seed workspace backgrounds
    try:
        with engine.begin() as conn:
            # Check if we need to seed
            count = conn.execute(sqlalchemy.text("SELECT count(*) FROM workspace_backgrounds")).scalar()
            if count == 0:
                seed_start = time.time()
                LOG.debug("Seeding default workspace backgrounds...")
                DEFAULT_BACKGROUNDS = [
                    {
                        "slug": "aurora",
                        "label": "Aurora",
                        "description": "Northern lights gradient",
                        "preview_css": "background: linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)",
                        "backdrop_css": "background: linear-gradient(135deg, rgba(0,198,255,0.1) 0%, rgba(0,114,255,0.1) 100%)"
                    },
                    {
                        "slug": "midnight",
                        "label": "Midnight",
                        "description": "Dark calm vibes",
                        "preview_css": "background: linear-gradient(135deg, #232526 0%, #414345 100%)",
                        "backdrop_css": "background: linear-gradient(135deg, rgba(35,37,38,0.5) 0%, rgba(65,67,69,0.5) 100%)"
                    },
                    {
                        "slug": "sunset",
                        "label": "Sunset",
                        "description": "Warm evening tones",
                        "preview_css": "background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%)",
                        "backdrop_css": "background: linear-gradient(135deg, rgba(255,81,47,0.1) 0%, rgba(221,36,118,0.1) 100%)"
                    },
                    {
                        "slug": "ocean",
                        "label": "Ocean",
                        "description": "Deep blue sea",
                        "preview_css": "background: linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)",
                        "backdrop_css": "background: linear-gradient(135deg, rgba(33,147,176,0.1) 0%, rgba(109,213,237,0.1) 100%)"
                    }
                ]
                
                for bg in DEFAULT_BACKGROUNDS:
                    conn.execute(
                        sqlalchemy.text("""
                            INSERT INTO workspace_backgrounds (slug, label, description, preview_css, backdrop_css, created_at, updated_at)
                            VALUES (:slug, :label, :description, :preview_css, :backdrop_css, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """),
                        bg
                    )
                LOG.debug(f"Seeded {len(DEFAULT_BACKGROUNDS)} backgrounds in {(time.time() - seed_start)*1000:.0f}ms")
    except Exception as e:
        LOG.warning(f"Failed to seed workspace backgrounds: {e}")

    total_startup_time = (time.time() - startup_start_time) * 1000
    LOG.info(f"🚀 Server starting on http://localhost:8000 (startup: {total_startup_time:.0f}ms)")

    # Start the FastAPI server
    uvicorn_log_level = logging.getLevelName(LOG.getEffectiveLevel()).lower()

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["*.db", "*.sqlite", "*.sqlite3", "*.log"],
        log_level=uvicorn_log_level,
        access_log=False
    )

