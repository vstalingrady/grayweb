import os
import databases
import sqlalchemy
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback for development if not set
    DATABASE_URL = "sqlite:///./gray.db"

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
    sqlalchemy.Column("plan_tier", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("has_seen_general_chat", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("daily_token_usage", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("monthly_cost_usage", sqlalchemy.Float, default=0.0),
    sqlalchemy.Column("weekly_cost_usage", sqlalchemy.Float, default=0.0),
    sqlalchemy.Column("six_hour_cost_usage", sqlalchemy.Float, default=0.0),
    sqlalchemy.Column("last_daily_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_monthly_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_weekly_reset", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("last_six_hour_reset", sqlalchemy.String, nullable=True),
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
    sqlalchemy.Column("thread_id", sqlalchemy.String, sqlalchemy.ForeignKey("user_chat_threads.id"), nullable=False),
    sqlalchemy.Column("role", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("text", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("grounding_metadata", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("attachments", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)
