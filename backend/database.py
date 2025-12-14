import os
import databases
import sqlalchemy
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

# Use centralized environment detection
try:
    from backend.env_utils import ROOT_DIR
except ImportError:
    from env_utils import ROOT_DIR

load_dotenv(ROOT_DIR / ".env")


def _normalize_sqlite_url(url: str) -> str:
    """Return an absolute sqlite URL so relative paths work from any cwd."""
    if not url.startswith("sqlite:///"):
        return url
    path = url.replace("sqlite:///", "", 1)
    path_obj = Path(path)
    if not path_obj.is_absolute():
        path_obj = (ROOT_DIR / path_obj).resolve()
    return f"sqlite:///{path_obj}"


def _select_database_url() -> str:
    """
    Choose the fastest available database for app data.

    Priority (unless DB_MODE overrides):
    1) DATABASE_URL (env override / CLI)
    2) LOCAL_DATABASE_URL (fast local)
    3) SQLITE_DB_PATH (Docker volume mount)
    4) Fallback to local backend/users.db
    """
    db_mode = (os.getenv("DB_MODE") or "").lower()
    primary_url = os.getenv("DATABASE_URL")
    local_url = os.getenv("LOCAL_DATABASE_URL")
    
    # Support Docker volume mount via SQLITE_DB_PATH
    sqlite_path = os.getenv("SQLITE_DB_PATH")
    default_fallback = f"sqlite:///{sqlite_path}" if sqlite_path else "sqlite:///./backend/users.db"

    chosen: str
    if db_mode == "remote":
        chosen = primary_url or local_url or default_fallback
    elif db_mode == "local":
        chosen = local_url or primary_url or default_fallback
    else:
        chosen = primary_url or local_url or default_fallback

    return _normalize_sqlite_url(chosen)


DATABASE_URL = _select_database_url()

# Create database instance
# Create database instance
db_args = {}
if DATABASE_URL.startswith("postgresql"):
    db_args["statement_cache_size"] = 0

database = databases.Database(DATABASE_URL, **db_args)
metadata = sqlalchemy.MetaData()

# Define users table
users = sqlalchemy.Table(
    "users",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("auth_user_id", sqlalchemy.String, unique=True, nullable=True, index=True),  # Supabase Auth UUID
    sqlalchemy.Column("email", sqlalchemy.String, unique=True, index=True),
    sqlalchemy.Column("full_name", sqlalchemy.String),
    sqlalchemy.Column("profile_picture_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String, default="user"),
    sqlalchemy.Column("initials", sqlalchemy.String),
    sqlalchemy.Column("workspace_background_id", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("maps_enabled", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("improve_model_for_everyone", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("personalization_nickname", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_occupation", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_about", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_custom_instructions", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_show_calendar", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("personalization_system_prompt_override", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("plan_tier", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("subscription_expires_at", sqlalchemy.DateTime, nullable=True),  # When subscription expires
    sqlalchemy.Column("has_seen_general_chat", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("daily_token_usage", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("monthly_cost_usage", sqlalchemy.Float, default=0.0),
    sqlalchemy.Column("weekly_cost_usage", sqlalchemy.Float, default=0.0),
    sqlalchemy.Column("six_hour_cost_usage", sqlalchemy.Float, default=0.0),
    # Per-user Gemini Pro usage tracking
    sqlalchemy.Column("daily_gemini_pro_usage", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("last_daily_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_monthly_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_weekly_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_six_hour_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_daily_gemini_pro_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("preferred_model", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
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
    sqlalchemy.Column("billing_cycle", sqlalchemy.String, nullable=True),  # monthly, annual
    sqlalchemy.Column("snap_token", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("snap_redirect_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

# Chat tables
user_data = sqlalchemy.Table(
    "user_data",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_identifier", sqlalchemy.Integer, unique=True, nullable=False),
    sqlalchemy.Column("profile", sqlalchemy.JSON, default={}),
    sqlalchemy.Column("context", sqlalchemy.JSON, default=[]),
    sqlalchemy.Column("metadata", sqlalchemy.JSON, default={}),
    sqlalchemy.Column("workspace_context", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("long_term_memory", sqlalchemy.Text, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

user_chat_threads = sqlalchemy.Table(
    "user_chat_threads",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.String, primary_key=True),  # UUID
    sqlalchemy.Column("user_data_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("user_data.id"), nullable=False),
    sqlalchemy.Column("user_identifier", sqlalchemy.Integer, nullable=False),
    sqlalchemy.Column("title", sqlalchemy.String, default="New Conversation"),
    sqlalchemy.Column("summary", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("context_snapshot", sqlalchemy.JSON, default=[]),
    sqlalchemy.Column("metadata", sqlalchemy.JSON, default={}),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    sqlalchemy.Column("last_message_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

user_chat_messages = sqlalchemy.Table(
    "user_chat_messages",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("thread_id", sqlalchemy.String, sqlalchemy.ForeignKey("user_chat_threads.id"), nullable=False, index=True),
    sqlalchemy.Column("role", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("text", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("grounding_metadata", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("attachments", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("reminders", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

# Proactivity tables
proactivity_settings = sqlalchemy.Table(
    "proactivity_settings",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("payload", sqlalchemy.JSON, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

proactive_notifications = sqlalchemy.Table(
    "proactive_notifications",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("type", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("title", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("message", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("metadata", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("due_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("sent_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("read_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("completed_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

proactivity_logs = sqlalchemy.Table(
    "proactivity_logs",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("activity_date", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("tasks_completed", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("total_tasks", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("score", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("notes", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

proactivity_push_subscriptions = sqlalchemy.Table(
    "proactivity_push_subscriptions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("endpoint", sqlalchemy.String, unique=True, nullable=False),
    sqlalchemy.Column("p256dh", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("auth", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

dashboard_pulses = sqlalchemy.Table(
    "dashboard_pulses",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False),
    sqlalchemy.Column("date_key", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("timestamp", sqlalchemy.DateTime, nullable=False),
    sqlalchemy.Column("plans", sqlalchemy.JSON, default=[]),
    sqlalchemy.Column("habits", sqlalchemy.JSON, default=[]),
    sqlalchemy.Column("proactivity", sqlalchemy.JSON, default={}),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

reminders = sqlalchemy.Table(
    "reminders",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("label", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("remind_at", sqlalchemy.DateTime, nullable=False),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("summary", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("entity_type", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("entity_id", sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("delivery_mode", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("metadata", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("status", sqlalchemy.String, default="pending", index=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    sqlalchemy.Column("delivered_at", sqlalchemy.DateTime, nullable=True),
)

# Calendar tables
calendars = sqlalchemy.Table(
    "calendars",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("label", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("color", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("is_visible", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

calendar_events = sqlalchemy.Table(
    "calendar_events",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("calendar_id", sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("title", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("start_time", sqlalchemy.DateTime, nullable=False),
    sqlalchemy.Column("end_time", sqlalchemy.DateTime, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

google_calendar_credentials = sqlalchemy.Table(
    "google_calendar_credentials",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, unique=True, nullable=False),
    sqlalchemy.Column("access_token", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("refresh_token", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("token_uri", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("client_id", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("client_secret", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("scopes", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

file_search_stores = sqlalchemy.Table(
    "file_search_stores",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, unique=True, nullable=False),
    sqlalchemy.Column("store_name", sqlalchemy.String, unique=True, nullable=False),
    sqlalchemy.Column("display_name", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

media_uploads = sqlalchemy.Table(
    "media_uploads",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("filename", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("mime_type", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("size", sqlalchemy.Integer, nullable=False),
    sqlalchemy.Column("storage_path", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

user_streaks = sqlalchemy.Table(
    "user_streaks",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, unique=True, nullable=False, index=True),
    sqlalchemy.Column("current_streak", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("longest_streak", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("last_activity_date", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

general_chat_messages = sqlalchemy.Table(
    "general_chat_messages",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("user_data_id", sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("content", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("grounding_metadata", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("reminders", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

archived_chat_messages = sqlalchemy.Table(
    "archived_chat_messages",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("user_data_id", sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("content", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("grounding_metadata", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("attachments", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("reminders", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("original_created_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("archived_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("compression_batch_id", sqlalchemy.String, nullable=True),
)

context_cache = sqlalchemy.Table(
    "context_cache",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("conversation_id", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("label", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("content", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)
