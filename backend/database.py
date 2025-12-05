import os
import databases
import sqlalchemy
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
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
    3) Fallback to local users.db
    """
    db_mode = (os.getenv("DB_MODE") or "").lower()
    primary_url = os.getenv("DATABASE_URL")
    local_url = os.getenv("LOCAL_DATABASE_URL")

    chosen: str
    if db_mode == "remote":
        chosen = primary_url or local_url or "sqlite:///./backend/users.db"
    elif db_mode == "local":
        chosen = local_url or primary_url or "sqlite:///./backend/users.db"
    else:
        chosen = primary_url or local_url or "sqlite:///./backend/users.db"

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
    sqlalchemy.Column("personalization_nickname", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_occupation", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_about", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_custom_instructions", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_show_calendar", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("personalization_system_prompt_override", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("plan_tier", sqlalchemy.String, nullable=True),
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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)
