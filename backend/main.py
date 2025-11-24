import logging
import socket
import asyncio
import sqlite3
from fastapi import FastAPI, HTTPException, Depends, status, File, Form, Query, UploadFile, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, validator
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple, Union, Iterable, Set, Mapping
import databases
import sqlalchemy
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
import os
import json
from asyncio import TimeoutError, wait_for, sleep
import re
import time
from dotenv import load_dotenv
from supabase import Client
import psycopg2
# Support both package and module import contexts
try:
    from backend.supabase_utils import create_supabase_client, resolve_supabase_credentials  # type: ignore
except Exception:  # When running with backend/ on sys.path directly (tests)
    from supabase_utils import create_supabase_client, resolve_supabase_credentials  # type: ignore
from uuid import UUID, uuid4
from pathlib import Path
from urllib.parse import urlparse

# Enhanced logging imports
from logging_config import (
    setup_logging, create_logger, set_request_context, clear_request_context,
    RequestLoggingMiddleware, log_performance, log_database_query, log_api_call
)
from google_calendar import (
    GoogleCalendarCredentials,
    GoogleCalendarInfo,
    GoogleCalendarEvent,
    GoogleAuthRequest,
    GoogleAuthCallbackRequest,
    GoogleAuthResponse,
    get_google_auth_url,
    exchange_code_for_tokens,
    get_google_calendar_service,
    list_google_calendars,
    list_google_events,
    create_google_event
)
from google.genai import types
from gemini_client import GeminiAttachment, GeminiService
from anthropic_client import AnthropicService
from usage_tracker import UsageTracker, UsageLimitExceeded
try:
    from backend.calendar_tools import CALENDAR_TOOLS
    from backend.file_search import FileSearchService
except ImportError:
    from calendar_tools import CALENDAR_TOOLS
    from file_search import FileSearchService
try:
    from backend.onboarding_tools import ONBOARDING_TOOLS
except ImportError:
    from onboarding_tools import ONBOARDING_TOOLS
from ai_message_generator import AIMessageGenerator
from proactivity_engine import (
    ProactivityEngine,
    ProactivityRealtimeBroker,
    ProactivitySchedulerManager,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Initialize enhanced logging system
app_logger = setup_logging(
    log_level=logging.INFO,
    enable_console=True,
    enable_file=True,
    structured_format=os.getenv("ENVIRONMENT") == "production"
)

# Create specific loggers
db_logger = create_logger("backend.database")
api_logger = create_logger("backend.api")
auth_logger = create_logger("backend.auth")
ai_logger = create_logger("backend.ai")
file_logger = create_logger("backend.files")

# Suppress uvicorn access logs (we handle this ourselves with our middleware)
logging.getLogger("uvicorn.access").disabled = True

app_logger.info("Backend application starting up", extra={
    "event_type": "application_startup",
    "environment": os.getenv("ENVIRONMENT", "development"),
    "ai_provider": os.getenv("AI_PROVIDER", "gemini"),
    "file_search_enabled": os.getenv("ENABLE_FILE_SEARCH", "false").lower() == "true"
})


def _float_env(var_name: str, default: float) -> float:
    try:
        return float(os.getenv(var_name, default))
    except (TypeError, ValueError):
        return default


def _int_env(var_name: str, default: int) -> int:
    try:
        value = os.getenv(var_name)
        if value is None or value.strip() == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def load_prompt_from_file(path: Path, fallback: str) -> str:
    """Load a prompt from disk, falling back to the provided default."""
    try:
        content = path.read_text(encoding="utf-8").strip()
        if content:
            return content
        app_logger.warning("Prompt file is empty; using fallback", extra={"prompt_path": str(path)})
    except FileNotFoundError:
        app_logger.warning("Prompt file missing; using fallback", extra={"prompt_path": str(path)})
    except Exception as exc:
        app_logger.error(
            "Failed to load prompt file; using fallback",
            extra={"prompt_path": str(path), "error": str(exc)},
        )
    return fallback.strip()


AI_PROVIDER = (os.getenv("AI_PROVIDER") or "gemini").strip().lower()
GUMROAD_WEBHOOK_SECRET = os.getenv("GUMROAD_WEBHOOK_SECRET") or None
LEMONSQUEEZY_WEBHOOK_SECRET = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET") or None
LEMONSQUEEZY_VOYAGER_VARIANT_ID = os.getenv("LEMONSQUEEZY_VOYAGER") or None
LEMONSQUEEZY_PIONEER_VARIANT_ID = os.getenv("LEMONSQUEEZY_PIONEER") or None

GEMINI_SERVICE = GeminiService()
ANTHROPIC_SERVICE = AnthropicService()
VALIDATE_GEMINI_ON_STARTUP = os.getenv("VALIDATE_GEMINI_ON_STARTUP", "true").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}
FILE_SEARCH_SERVICE: Optional[FileSearchService] = None
FILE_SEARCH_ENABLED = bool(os.getenv("ENABLE_FILE_SEARCH", "false").lower() == "true")
if FILE_SEARCH_ENABLED:
    try:
        FILE_SEARCH_SERVICE = FileSearchService(os.getenv("GEMINI_API_KEY"))
    except ValueError as exc:
        print(f"[FileSearch] Disabled: {exc}")

AI_MESSAGE_GENERATOR = AIMessageGenerator()


FILE_SEARCH_MAX_TOKENS_PER_CHUNK = _int_env("FILE_SEARCH_MAX_TOKENS_PER_CHUNK", 200)
FILE_SEARCH_MAX_OVERLAP_TOKENS = _int_env("FILE_SEARCH_MAX_OVERLAP_TOKENS", 20)
FILE_SEARCH_CHUNKING_CONFIG: Optional[Dict[str, Any]] = {
    "white_space_config": {
        "max_tokens_per_chunk": FILE_SEARCH_MAX_TOKENS_PER_CHUNK,
        "max_overlap_tokens": FILE_SEARCH_MAX_OVERLAP_TOKENS,
    }
}

MEDIA_UPLOAD_DIR = Path(
    os.getenv("MEDIA_UPLOAD_DIR")
    or Path(__file__).resolve().parent / "media_uploads"
)
MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


SEARCH_TOOL = types.Tool(
    google_search=types.GoogleSearch(),
)

DEFAULT_CHAT_TOOLS = [SEARCH_TOOL, *CALENDAR_TOOLS]

PROMPTS_DIR = ROOT_DIR / "backend" / "prompts"
ONBOARDING_PROMPT_PATH = PROMPTS_DIR / "onboarding.txt"


def _ensure_sqlite_users_auth_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = {row[1] for row in cursor.fetchall()}
            if "auth_user_id" not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN auth_user_id TEXT")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "Failed to ensure auth_user_id column on sqlite users table",
            extra={"event_type": "sqlite_migration_error", "error": str(exc)},
        )


def _ensure_sqlite_has_seen_chat_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = {row[1] for row in cursor.fetchall()}
            if "has_seen_general_chat" not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN has_seen_general_chat BOOLEAN DEFAULT 0")
                conn.commit()
            # Backfill nulls to the default so Pydantic validation doesn't see None
            conn.execute("UPDATE users SET has_seen_general_chat = 0 WHERE has_seen_general_chat IS NULL")
            conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "Failed to ensure has_seen_general_chat column on sqlite users table",
            extra={"event_type": "sqlite_migration_error", "error": str(exc)},
        )


def _ensure_sqlite_maps_enabled_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = {row[1] for row in cursor.fetchall()}
            if "maps_enabled" not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN maps_enabled BOOLEAN DEFAULT 0")
                conn.commit()
            # Backfill nulls to the default so Pydantic validation doesn't see None
            conn.execute("UPDATE users SET maps_enabled = 0 WHERE maps_enabled IS NULL")
            conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "Failed to ensure maps_enabled column on sqlite users table",
            extra={"event_type": "sqlite_migration_error", "error": str(exc)},
        )


def _ensure_sqlite_usage_columns():
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = {row[1] for row in cursor.fetchall()}

            missing_alters = []
            if "daily_token_usage" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN daily_token_usage INTEGER DEFAULT 0")
            if "monthly_cost_usage" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN monthly_cost_usage REAL DEFAULT 0")
            if "weekly_cost_usage" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN weekly_cost_usage REAL DEFAULT 0")
            if "six_hour_cost_usage" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN six_hour_cost_usage REAL DEFAULT 0")
            if "last_daily_reset" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN last_daily_reset TEXT")
            if "last_monthly_reset" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN last_monthly_reset TEXT")
            if "last_weekly_reset" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN last_weekly_reset TEXT")
            if "last_six_hour_reset" not in columns:
                missing_alters.append("ALTER TABLE users ADD COLUMN last_six_hour_reset TEXT")

            for statement in missing_alters:
                conn.execute(statement)
            if missing_alters:
                conn.commit()

            # Backfill nulls for counters to zero to avoid None in logic
            conn.execute(
                """
                UPDATE users
                SET daily_token_usage = COALESCE(daily_token_usage, 0),
                    monthly_cost_usage = COALESCE(monthly_cost_usage, 0),
                    weekly_cost_usage = COALESCE(weekly_cost_usage, 0),
                    six_hour_cost_usage = COALESCE(six_hour_cost_usage, 0)
                """
            )
            conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "Failed to ensure usage columns on sqlite users table",
            extra={"event_type": "sqlite_migration_error", "error": str(exc)},
        )


def _ensure_sqlite_workspace_background_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = {row[1] for row in cursor.fetchall()}
            if "workspace_background_id" not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN workspace_background_id TEXT")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "Failed to ensure workspace_background_id column on sqlite users table",
            extra={"event_type": "sqlite_migration_error", "error": str(exc)},
        )


def _ensure_sqlite_personalization_show_calendar_column():
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute("PRAGMA table_info(users)")
            columns = {row[1] for row in cursor.fetchall()}
            if "personalization_show_calendar" not in columns:
                conn.execute("ALTER TABLE users ADD COLUMN personalization_show_calendar BOOLEAN DEFAULT 1")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "Failed to ensure personalization_show_calendar column on sqlite users table",
            extra={"event_type": "sqlite_migration_error", "error": str(exc)},
        )


# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

_ensure_sqlite_users_auth_column()
_ensure_sqlite_has_seen_chat_column()
_ensure_sqlite_maps_enabled_column()
_ensure_sqlite_usage_columns()
_ensure_sqlite_workspace_background_column()
_ensure_sqlite_personalization_show_calendar_column()

database = databases.Database(DATABASE_URL, statement_cache_size=0)
metadata = sqlalchemy.MetaData()


STREAMING_TOKEN_DELAY = max(0.0, _float_env("GRAY_STREAMING_TOKEN_DELAY_SECONDS", 0.045))

DEFAULT_DEV_ORIGIN_PORTS = (3000, 5173)


def _split_env_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _origin_variants(origin: str) -> List[str]:
    cleaned = origin.strip().rstrip("/")
    if not cleaned:
        return []

    variants = {cleaned}
    if cleaned.startswith("http://"):
        variants.add(cleaned.replace("http://", "https://", 1))
    elif cleaned.startswith("https://"):
        variants.add(cleaned.replace("https://", "http://", 1))
    return list(variants)


def _local_network_origins(ports: Iterable[int]) -> Set[str]:
    origins: Set[str] = set()
    try:
        hostname = socket.gethostname()
        addresses: Set[str] = set()
        try:
            addresses.update(info[4][0] for info in socket.getaddrinfo(hostname, None))
        except OSError:
            pass
        try:
            addresses.update(socket.gethostbyname_ex(hostname)[2])
        except OSError:
            pass

        for addr in addresses:
            if not addr or addr.startswith("127.") or addr.startswith("169.254") or addr == "0.0.0.0" or ":" in addr:
                continue
            for protocol in ("http", "https"):
                for port in ports:
                    origins.add(f"{protocol}://{addr}:{port}")
    except OSError:
        pass
    return origins


def _build_allowed_origins() -> List[str]:
    explicit = _split_env_list(os.getenv("CORS_ALLOW_ORIGINS"))
    if explicit:
        return explicit

    default_origins = {
        "http://localhost:3000",
        "https://localhost:3000",
        "http://gray.localhost:3000",
        "https://gray.localhost:3000",
        "http://127.0.0.1:3000",
        "https://127.0.0.1:3000",
        "http://localhost:5173",
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173",
    }

    candidate_env_vars = [
        os.getenv("NEXT_PUBLIC_SITE_URL"),
        os.getenv("SITE_URL"),
        os.getenv("NEXT_PUBLIC_AUTH_REDIRECT"),
        os.getenv("FRONTEND_URL"),
    ]

    for candidate in candidate_env_vars:
        for variant in _origin_variants(candidate or ""):
            default_origins.add(variant)

    node_env = os.getenv("NODE_ENV", "").strip().lower()
    environment = os.getenv("ENVIRONMENT", "").strip().lower()
    is_production = node_env == "production" or environment == "production"
    if not is_production:
        for origin in _local_network_origins(DEFAULT_DEV_ORIGIN_PORTS):
            default_origins.add(origin)

    return sorted(default_origins)


LOCAL_NETWORK_ORIGIN_PATTERN = (
    r"^https?://(?:(?:localhost|(?:[a-z0-9-]+\.)+localhost|127\.0\.0\.1)"
    r"|(?:10(?:\.\d{1,3}){3})"
    r"|(?:192\.168(?:\.\d{1,3}){2})"
    r"|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}))(?::\d+)?$"
)


def _local_network_origin_regex() -> Optional[str]:
    node_env = os.getenv("NODE_ENV", "").strip().lower()
    environment = os.getenv("ENVIRONMENT", "").strip().lower()
    is_production = node_env == "production" or environment == "production"
    if is_production:
        return None
    return LOCAL_NETWORK_ORIGIN_PATTERN


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    """Safely retrieve a column from SQLAlchemy Row objects or dictionaries."""
    if row is None:
        return default
    if isinstance(row, dict):
        return row.get(key, default)
    mapping = getattr(row, "_mapping", None)
    if isinstance(mapping, Mapping):
        return mapping.get(key, default)
    try:
        return row[key]  # type: ignore[index]
    except (KeyError, TypeError):
        return default


def _parse_json_field(value: Optional[str]) -> Optional[Dict[str, Any]]:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


ALLOWED_ORIGIN_REGEX = _local_network_origin_regex()
ALLOWED_ORIGINS = _build_allowed_origins()

def _fallback_title_from_message(message: str) -> str:
    trimmed = (message or "").strip()
    if not trimmed:
        return "New Chat"
    if len(trimmed) <= 48:
        return trimmed
    return f"{trimmed[:45].rstrip()}…"

MAX_DASHBOARD_PULSE_HISTORY = 30
DEFAULT_DASHBOARD_PROACTIVITY = {
    "id": "proactivity-default",
    "label": "Check-ins",
    "description": "Daily sync nudges for squad channels.",
    "cadence": "Daily",
    "time": "09:00 AM",
}

# Database tables
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

chat_sessions = sqlalchemy.Table(
    "chat_sessions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("title", sqlalchemy.String),
    sqlalchemy.Column("scope", sqlalchemy.String, default="thread"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

calendars = sqlalchemy.Table(
    "calendars",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("color", sqlalchemy.String),
    sqlalchemy.Column("is_visible", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

habits = sqlalchemy.Table(
    "habits",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("streak_label", sqlalchemy.String),
    sqlalchemy.Column("previous_label", sqlalchemy.String),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    sqlalchemy.UniqueConstraint("user_id", "date_key", name="uq_dashboard_pulses_user_date"),
)

proactivity_settings = sqlalchemy.Table(
    "proactivity_settings",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
    sqlalchemy.Column("payload", sqlalchemy.JSON, nullable=False, default=dict),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)
proactivity_push_subscriptions = sqlalchemy.Table(
    "proactivity_push_subscriptions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), nullable=False),
    sqlalchemy.Column("endpoint", sqlalchemy.String, nullable=False, unique=True),
    sqlalchemy.Column("p256dh", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("auth", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

user_streaks = sqlalchemy.Table(
    "user_streaks",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
    sqlalchemy.Column("current_streak", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("last_activity_date", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

# Proactivity tracking
proactivity_logs = sqlalchemy.Table(
    "proactivity_logs",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("activity_date", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("tasks_completed", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("total_tasks", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("score", sqlalchemy.Integer, default=0),
    sqlalchemy.Column("notes", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)


file_search_stores = sqlalchemy.Table(
    "file_search_stores",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
    sqlalchemy.Column("store_name", sqlalchemy.String, unique=True),
    sqlalchemy.Column("display_name", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

# Context caching for long context reuse
context_cache = sqlalchemy.Table(
    "context_cache",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("conversation_id", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("label", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("content", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

DEFAULT_WORKSPACE_BACKGROUNDS: List[Dict[str, Any]] = []

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
    sqlalchemy.Column("sent_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("read_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("completed_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
)

google_calendar_credentials = sqlalchemy.Table(
    "google_calendar_credentials",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id"), unique=True),
    sqlalchemy.Column("access_token", sqlalchemy.String),
    sqlalchemy.Column("refresh_token", sqlalchemy.String),
    sqlalchemy.Column("token_uri", sqlalchemy.String),
    sqlalchemy.Column("client_id", sqlalchemy.String),
    sqlalchemy.Column("client_secret", sqlalchemy.String),
    sqlalchemy.Column("scopes", sqlalchemy.String),
    sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

# Pydantic models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    profile_picture_url: Optional[str] = None
    role: str = "user"
    plan_tier: Optional[str] = None
    workspace_background_id: Optional[str] = None
    maps_enabled: Optional[bool] = False
    has_seen_general_chat: Optional[bool] = False
    personalization_nickname: Optional[str] = None
    personalization_occupation: Optional[str] = None
    personalization_about: Optional[str] = None
    personalization_custom_instructions: Optional[str] = None
    personalization_show_calendar: Optional[bool] = True
    auth_user_id: Optional[str] = None  # Link to Supabase Auth UUID
    daily_token_usage: Optional[int] = 0
    monthly_cost_usage: Optional[float] = 0.0
    weekly_cost_usage: Optional[float] = 0.0
    six_hour_cost_usage: Optional[float] = 0.0

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: Optional[str] = None
    plan_tier: Optional[str] = None
    workspace_background_id: Optional[str] = None
    maps_enabled: Optional[bool] = None
    has_seen_general_chat: Optional[bool] = None
    personalization_nickname: Optional[str] = None
    personalization_occupation: Optional[str] = None
    personalization_about: Optional[str] = None
    personalization_custom_instructions: Optional[str] = None
    personalization_show_calendar: Optional[bool] = None

class User(UserBase):
    id: int
    initials: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ChatSessionBase(BaseModel):
    title: str

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CalendarBase(BaseModel):
    label: str
    color: str
    is_visible: bool = True

class CalendarCreate(CalendarBase):
    pass

class CalendarUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    is_visible: Optional[bool] = None

class Calendar(CalendarBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CalendarEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    calendar_id: Optional[int] = None
    color: Optional[str] = None

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    calendar_id: Optional[int] = None
    color: Optional[str] = None

class CalendarEvent(CalendarEventBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class WorkspaceBackground(BaseModel):
    slug: str
    label: str
    preview_css: str
    backdrop_css: str
    description: Optional[str] = None
    id: Optional[int] = None

WORKSPACE_BACKGROUNDS: List[WorkspaceBackground] = [
    WorkspaceBackground(**{**payload, "id": index + 1})
    for index, payload in enumerate(DEFAULT_WORKSPACE_BACKGROUNDS)
]

class ProactivitySettings(BaseModel):
    id: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    cadence: Optional[str] = None
    time: Optional[str] = None
    times: Optional[List[str]] = None
    channels: Optional[List[str]] = None
    timezone: Optional[str] = None

class PlanBase(BaseModel):
    label: str
    completed: bool = False
    deadline: Optional[str] = None
    schedule_slot: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class PlanCreate(PlanBase):
    pass

class Plan(PlanBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class UserStreakBase(BaseModel):
    current_streak: int = 0
    last_activity_date: Optional[datetime] = None

class UserStreakCreate(UserStreakBase):
    pass

class UserStreak(UserStreakBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Proactivity models
class ProactivityLogBase(BaseModel):
    activity_date: datetime
    tasks_completed: int = 0
    total_tasks: int = 0
    score: int = 0
    notes: Optional[str] = None

class ProactivityLogCreate(ProactivityLogBase):
    pass

class DailyCheckIn(BaseModel):
    tasks_completed: int
    total_tasks: int
    notes: Optional[str] = None

class ProactivityLog(ProactivityLogBase):
    id: int
    user_id: int
    activity_date: datetime
    tasks_completed: int
    total_tasks: int
    score: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ContextCacheBase(BaseModel):
    label: Optional[str] = None
    conversation_id: Optional[str] = None
    content: str


class ContextCache(ContextCacheBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MediaUploadBase(BaseModel):
    filename: str
    mime_type: str
    size: int


class MediaUpload(MediaUploadBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatAttachment(BaseModel):
    id: int


class ProactivityNotification(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    metadata: Optional[Dict[str, Any]] = None
    due_at: Optional[datetime] = None
    sent_at: datetime
    read_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class ReminderBase(BaseModel):
    label: str
    remind_at: datetime
    description: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    delivery_mode: Optional[str] = None
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    color: Optional[str] = None


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    remind_at: Optional[datetime] = None
    status: Optional[str] = None
    delivery_mode: Optional[str] = None
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class PlanUpdate(BaseModel):
    label: Optional[str] = None
    completed: Optional[bool] = None
    deadline: Optional[str] = None
    schedule_slot: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class HabitBase(BaseModel):
    label: str
    streak_label: str
    previous_label: str
    description: Optional[str] = None

class HabitCreate(HabitBase):
    pass

class Habit(HabitBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class HabitUpdate(BaseModel):
    label: Optional[str] = None
    streak_label: Optional[str] = None
    previous_label: Optional[str] = None
    description: Optional[str] = None


class DashboardPulsePlanItem(BaseModel):
    id: str
    label: str
    completed: bool = False


class DashboardPulseHabitItem(BaseModel):
    id: str
    label: str
    streak_label: Optional[str] = None
    previous_label: Optional[str] = None
    completed: bool = False


class DashboardPulseProactivity(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    cadence: str
    time: str


class DashboardPulseBase(BaseModel):
    date_key: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    timestamp: Optional[int] = None
    plans: List[DashboardPulsePlanItem] = []
    habits: List[DashboardPulseHabitItem] = []
    proactivity: DashboardPulseProactivity

    @validator("timestamp", pre=True, always=True)
    def _validate_timestamp(cls, value):
        if value is None:
            return int(datetime.utcnow().timestamp() * 1000)
        if isinstance(value, datetime):
            return int(value.replace(tzinfo=timezone.utc).timestamp() * 1000)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value.strip():
            try:
                return int(float(value))
            except ValueError as exc:
                raise ValueError("timestamp must be milliseconds since epoch") from exc
        raise ValueError("timestamp must be milliseconds since epoch")


class DashboardPulseCreate(DashboardPulseBase):
    carry_forward: bool = False


class DashboardPulseUpdate(BaseModel):
    timestamp: Optional[int] = None
    plans: Optional[List[DashboardPulsePlanItem]] = None
    habits: Optional[List[DashboardPulseHabitItem]] = None
    proactivity: Optional[DashboardPulseProactivity] = None


class DashboardPulse(DashboardPulseBase):
    id: int
    user_id: int
    timestamp: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardProactivitySummary(BaseModel):
    logs: List[ProactivityLog] = Field(default_factory=list)
    streak: Dict[str, int] = Field(default_factory=dict)


class DashboardSummary(BaseModel):
    today: Optional[DashboardPulse] = None
    recent: List[DashboardPulse] = Field(default_factory=list)
    pulses: List[DashboardPulse] = Field(default_factory=list)
    proactivity: DashboardProactivitySummary = Field(default_factory=DashboardProactivitySummary)

class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    text: str

class ConversationCreateRequest(BaseModel):
    title: str
    user_id: int

class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    user_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: int
    context: Optional[str] = None
    time_context: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    attachments: Optional[List[ChatAttachment]] = None
    response_json_schema: Optional[Dict[str, Any]] = None
    response_mime_type: Optional[str] = None
    context_cache_id: Optional[int] = None
    maps_enabled: bool = False
    maps_latitude: Optional[float] = None
    maps_longitude: Optional[float] = None
    maps_widget: bool = False
    web_search_enabled: bool = True
    file_search_enabled: bool = False
    should_generate_title: bool = False
    reasoning_mode: bool = False
    timezone: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    grounding_metadata: Optional[Dict[str, Any]] = None
    title: Optional[str] = None


class ChatStarterRequest(BaseModel):
    user_id: int
    name: Optional[str] = None
    nickname: Optional[str] = None
    occupation: Optional[str] = None
    about: Optional[str] = None
    custom_instructions: Optional[str] = None
    workspace_context: Optional[str] = None
    system_prompt: Optional[str] = None
    time_context: Optional[str] = None


class ChatStarterResponse(BaseModel):
    message: str
    used_fallback: bool = False


class ChatTitleRequest(BaseModel):
    message: str


class ChatTitleResponse(BaseModel):
    title: str


def _extract_project_ref(url_value: Optional[str]) -> Optional[str]:
    if not url_value:
        return None
    try:
        parsed = urlparse(url_value)
        host = parsed.hostname or ""
        if host.endswith(".supabase.co"):
            return host.split(".")[0]
    except Exception:
        return None
    return None


def _ensure_supabase_chat_tables(supabase_url: Optional[str]) -> None:
    """Create chat persistence tables in Supabase when missing.

    The deployment recently switched Supabase projects, and the new project is
    missing the user_chat_* schema. This guard self-heals by applying the chat
    migrations directly against the Supabase Postgres instance using the
    service password so chat history can be stored again.
    """
    project_ref = _extract_project_ref(supabase_url)
    password = os.getenv("SUPABASE_DB_PASSWORD")
    if not project_ref or not password:
        return

    dsn = f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres"
    try:
        conn = psycopg2.connect(dsn, connect_timeout=4)
        conn.autocommit = True
    except Exception as exc:
        print(f"Warning: Skipping Supabase chat schema check (connection failed): {exc}")
        return

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                select
                  to_regclass('public.user_chat_threads'),
                  to_regclass('public.user_chat_messages'),
                  to_regclass('public.general_chat_messages'),
                  to_regclass('public.user_data');
                """
            )
            row = cursor.fetchone() or []
            missing_tables = any(value is None for value in row)
            if not missing_tables:
                return

            migration_paths = [
                ROOT_DIR / "supabase" / "migrations" / "20251116140000_user_first_chat_schema.sql",
                ROOT_DIR / "supabase" / "migrations" / "20251116133000_refactor_chat_tables.sql",
                ROOT_DIR / "supabase" / "migrations" / "20251116143000_link_general_chat_to_user_data.sql",
            ]
            for path in migration_paths:
                if not path.exists():
                    continue
                cursor.execute(path.read_text())

            print(
                "Supabase chat tables were missing; applied chat migrations so messages persist again."
            )
    except Exception as exc:
        print(f"Warning: Failed to ensure Supabase chat tables exist: {exc}")
    finally:
        try:
            conn.close()
        except Exception:
            pass

# Supabase setup
SUPABASE_URL, SUPABASE_KEY, SUPABASE_KEY_SOURCE = resolve_supabase_credentials()

# Self-heal missing Supabase chat tables so conversation history can be stored.
_ensure_supabase_chat_tables(SUPABASE_URL)

# Initialize Supabase using unified helper
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    supabase = create_supabase_client()
    if supabase is not None:
        source_label = SUPABASE_KEY_SOURCE or "SUPABASE_KEY"
        print(f"Supabase client initialized successfully (source: {source_label}).")
        if SUPABASE_KEY_SOURCE in {"SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"}:
            print("Warning: Using SUPABASE_ANON_KEY may limit write operations; configure a service-role key for full functionality.")
    else:
        print("Warning: Failed to initialize Supabase client via helper; conversation history disabled.")
else:
    print("Warning: Supabase credentials not configured. Conversation history will not be persisted.")

SUPABASE_CONVERSATIONS_ENABLED = supabase is not None

GENERAL_CONVERSATION_PREFIX = "general:"
_USER_DATA_CACHE: Dict[int, int] = {}
_USER_TIMEZONE_CACHE: Dict[int, Optional[str]] = {}


def _conversation_store_available() -> bool:
  return supabase is not None and SUPABASE_CONVERSATIONS_ENABLED


def _disable_conversation_store(reason: str) -> None:
  global SUPABASE_CONVERSATIONS_ENABLED
  if SUPABASE_CONVERSATIONS_ENABLED:
    SUPABASE_CONVERSATIONS_ENABLED = False
    print(f"Conversation storage disabled: {reason}")


def _handle_conversation_store_error(context: str, error: Exception) -> None:
  code = getattr(error, "code", None)
  message = getattr(error, "message", None)
  if isinstance(error, dict):
    code = error.get("code")
    message = error.get("message")
  details = message or str(error)
  print(f"{context}: {details}")
  normalized = (details or "").lower()
  if code == "PGRST205" or "could not find the table" in normalized:
    _disable_conversation_store("Supabase user chat tables missing; suppressing further requests.")
  elif (
    "permission denied" in normalized
    or "insufficient privilege" in normalized
    or "not authorized" in normalized
  ):
    _disable_conversation_store("Supabase conversation access denied; suppressing further requests.")


def _handle_supabase_table_error(context: str, error: Exception) -> None:
    details = getattr(error, "message", None) or str(error)
    print(f"{context}: {details}")


def _general_conversation_user_id(conversation_id: Optional[str]) -> Optional[int]:
    if (
        not conversation_id
        or not isinstance(conversation_id, str)
        or not conversation_id.startswith(GENERAL_CONVERSATION_PREFIX)
    ):
        return None
    try:
        return int(conversation_id.split(":", 1)[1])
    except (ValueError, IndexError):
        return None


def _load_general_conversation_history(user_id: int) -> List[Dict[str, Any]]:
    if not _conversation_store_available():
        return []
    try:
        # Check plan tier for retention policy (Scout = 14 days)
        is_restricted = True
        try:
            user_res = supabase.table("users").select("plan_tier").eq("id", user_id).single().execute()
            if user_res.data:
                tier = (user_res.data.get("plan_tier") or "").lower()
                if tier in ("voyager", "pioneer", "depth"):
                    is_restricted = False
        except Exception:
            pass

        query = supabase.table("general_chat_messages").select("role, content, grounding_metadata").eq("user_id", user_id)

        if is_restricted:
            cutoff = datetime.utcnow() - timedelta(days=14)
            query = query.gte("created_at", cutoff.isoformat())

        result = query.order("created_at", desc=False).execute()
    except Exception as error:
        _handle_conversation_store_error("Warning: General chat history unavailable", error)
        return []
    rows = result.data or []
    history: List[Dict[str, Any]] = []
    for row in rows:
        role = row.get("role")
        if role not in {"user", "model"}:
            continue
        entry: Dict[str, Any] = {
            "role": role,
            "text": row.get("content") or "",
        }
        grounding_metadata = row.get("grounding_metadata")
        if grounding_metadata is not None:
            entry["grounding_metadata"] = grounding_metadata
        history.append(entry)
    return history


def _insert_general_conversation_message(
    *,
    user_id: int,
    role: str,
    text: str,
    grounding_metadata: Optional[Any] = None,
    attachments: Optional[Any] = None,
) -> None:
    if not _conversation_store_available():
        return
    user_data_id = _ensure_user_data_record(user_id)
    if user_data_id is None:
        return
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "user_data_id": user_data_id,
        "role": role,
        "content": text,
    }
    if grounding_metadata is not None:
        payload["grounding_metadata"] = grounding_metadata
    if attachments is not None:
        payload["attachments"] = attachments
    try:
        supabase.table("general_chat_messages").insert(payload).execute()
    except Exception as error:
        _handle_conversation_store_error("Error saving general conversation message", error)


def _replace_general_conversation_history(user_id: int, history: List[Dict[str, Any]]) -> None:
    if not _conversation_store_available():
        return
    try:
        user_data_id = _ensure_user_data_record(user_id)
        if user_data_id is None:
            return
        supabase.table("general_chat_messages").delete().eq("user_id", user_id).execute()
        if history:
            rows: List[Dict[str, Any]] = []
            for entry in history:
                rows.append(
                    {
                        "user_id": user_id,
                        "user_data_id": user_data_id,
                        "role": entry.get("role"),
                        "content": entry.get("text") or "",
                        "grounding_metadata": entry.get("grounding_metadata"),
                    }
                )
            if rows:
                supabase.table("general_chat_messages").insert(rows).execute()
    except Exception as error:
        _handle_conversation_store_error("Error replacing general conversation history", error)


def _delete_general_conversation_history(user_id: int) -> None:
    if not _conversation_store_available():
        return
    try:
        supabase.table("general_chat_messages").delete().eq("user_id", user_id).execute()
    except Exception as error:
        _handle_conversation_store_error("Error deleting general conversation history", error)


def _delete_supabase_user_records(user_id: int) -> None:
    if not supabase:
        api_logger.info("Supabase not configured, skipping remote deletion", extra={"user_id": user_id})
        return

    api_logger.info(f"Starting Supabase data deletion for user {user_id}", extra={"user_id": user_id})

    # Special handling for user_chat_messages which doesn't have a direct user_id column
    # but is linked via thread_id to user_chat_threads
    try:
        # 1. Fetch all thread IDs belonging to the user
        threads_result = (
            supabase.table("user_chat_threads")
            .select("id")
            .eq("user_identifier", user_id)
            .execute()
        )
        thread_rows = threads_result.data or []
        thread_ids = [row["id"] for row in thread_rows]

        # 2. Delete messages for these threads
        if thread_ids:
            api_logger.info(f"Deleting chat messages for {len(thread_ids)} threads", extra={"user_id": user_id, "thread_count": len(thread_ids)})
            # Delete in batches if necessary, but for now assuming reasonable size
            supabase.table("user_chat_messages").delete().in_("thread_id", thread_ids).execute()
            
    except Exception as error:
        _handle_supabase_table_error(
            f"Warning: Failed to delete user_chat_messages for user {user_id}",
            error,
        )

    delete_targets: List[Tuple[str, str]] = [
        ("general_chat_messages", "user_id"),
        ("user_chat_threads", "user_identifier"),
        ("user_data", "user_identifier"),
        ("plans", "user_id"),
        ("habits", "user_id"),
        ("reminders", "user_id"),
        ("calendars", "user_id"),
        ("calendar_events", "user_id"),
        ("dashboard_pulses", "user_id"),
        ("user_streaks", "user_id"),
        ("context_cache", "user_id"),
        ("file_search_stores", "user_id"),
        ("media_uploads", "user_id"),
        ("proactivity_logs", "user_id"),
        ("proactivity_settings", "user_id"),
        ("proactive_notifications", "user_id"),
        ("google_calendar_credentials", "user_id"),
        ("proactivity_push_subscriptions", "user_id"),
    ]

    for table_name, column in delete_targets:
        try:
            supabase.table(table_name).delete().eq(column, user_id).execute()
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to delete Supabase data for user {user_id} in {table_name}",
                error,
            )
    
    api_logger.info(f"Completed Supabase data deletion for user {user_id}", extra={"user_id": user_id})


def _ensure_user_data_record(user_identifier: int) -> Optional[int]:
    """Return the user_data.id for the provided identifier, creating it if needed."""
    if user_identifier is None or not _conversation_store_available() or supabase is None:
        return None

    cached = _USER_DATA_CACHE.get(user_identifier)
    if cached is not None:
        return cached

    try:
        result = (
            supabase.table("user_data")
            .select("id")
            .eq("user_identifier", user_identifier)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if rows:
            row = rows[0]
            user_data_id = _row_get(row, "id")
            if isinstance(user_data_id, int):
                _USER_DATA_CACHE[user_identifier] = user_data_id
                return user_data_id
    except Exception as error:
        _handle_conversation_store_error("Error loading user data record", error)
        return None

    try:
        created = supabase.table("user_data").insert({"user_identifier": user_identifier}).execute()
        rows = created.data or []
        if not rows:
            lookup = (
                supabase.table("user_data")
                .select("id")
                .eq("user_identifier", user_identifier)
                .limit(1)
                .execute()
            )
            rows = lookup.data or []
        if rows:
            user_data_id = _row_get(rows[0], "id")
            if isinstance(user_data_id, int):
                _USER_DATA_CACHE[user_identifier] = user_data_id
                return user_data_id
    except Exception as error:
        _handle_conversation_store_error("Error creating user data record", error)
    return None


def _deserialize_proactivity_settings_payload(payload: Any) -> Optional[ProactivitySettings]:
    if payload is None:
        return None
    candidate: Any = payload
    if isinstance(candidate, str):
        candidate = _parse_json_field(candidate)
    if not isinstance(candidate, dict):
        return None
    try:
        return ProactivitySettings.model_validate(candidate)
    except Exception as e:
        # Log deserialization errors for debugging
        api_logger.warning(f"Failed to deserialize proactivity settings: {e}", extra={
            "event_type": "proactivity_settings_deserialization_error",
            "payload": candidate,
            "error": str(e)
        })
        return None


def _fetch_supabase_proactivity_settings(user_id: int) -> Optional[ProactivitySettings]:
    if not supabase:
        return None
    try:
        result = (
            supabase.table("proactivity_settings")
            .select("payload")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as error:
        api_logger.warning(f"Failed to fetch proactivity settings from Supabase for user {user_id}: {error}", extra={
            "event_type": "proactivity_settings_supabase_fetch_error",
            "user_id": user_id,
            "error": str(error)
        })
        _handle_supabase_table_error(
            "Warning: Proactivity settings table not found or inaccessible",
            error,
        )
        return None
    rows = getattr(result, "data", None)
    if not rows:
        api_logger.debug(f"No proactivity settings found in Supabase for user {user_id}", extra={
            "event_type": "proactivity_settings_supabase_not_found",
            "user_id": user_id
        })
        return None
    payload = rows[0].get("payload")
    api_logger.debug(f"Retrieved proactivity settings from Supabase for user {user_id}", extra={
        "event_type": "proactivity_settings_supabase_fetched",
        "user_id": user_id,
        "payload": payload
    })
    return _deserialize_proactivity_settings_payload(payload)


async def _resolve_user_timezone_for_streak(user_id: int, db: databases.Database) -> Optional[str]:
    """
    Best-effort resolution of a user's timezone for streak calculations.

    Preference order:
      1. In-memory cache.
      2. Supabase proactivity_settings payload.
      3. Local proactivity_settings payload (SQLite).
    Falls back to UTC when no setting is available or parsing fails.
    """
    cached = _USER_TIMEZONE_CACHE.get(user_id)
    if cached is not None:
        return cached

    timezone_name: Optional[str] = None

    try:
        supabase_settings = _fetch_supabase_proactivity_settings(user_id)
        if supabase_settings and supabase_settings.timezone:
            timezone_name = supabase_settings.timezone
    except Exception as error:  # pragma: no cover - defensive logging
        api_logger.debug(
            f"Failed to resolve timezone from Supabase for user {user_id}: {error}",
            extra={
                "event_type": "user_timezone_supabase_error",
                "user_id": user_id,
                "error": str(error),
            },
        )

    if timezone_name is None:
        try:
            record = await db.fetch_one(
                proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
            )
            if record:
                payload = _row_get(record, "payload")
                local_settings = _deserialize_proactivity_settings_payload(payload)
                if local_settings and local_settings.timezone:
                    timezone_name = local_settings.timezone
        except Exception as error:  # pragma: no cover - defensive logging
            api_logger.debug(
                f"Failed to resolve timezone from local DB for user {user_id}: {error}",
                extra={
                    "event_type": "user_timezone_db_error",
                    "user_id": user_id,
                    "error": str(error),
                },
            )

    # Cache even when None so we don't repeatedly query.
    _USER_TIMEZONE_CACHE[user_id] = timezone_name
    return timezone_name


def _upsert_supabase_proactivity_settings(user_id: int, payload: Dict[str, Any]) -> None:
    if not supabase:
        api_logger.debug(f"Supabase not configured, skipping proactivity settings sync for user {user_id}", extra={
            "event_type": "proactivity_settings_supabase_skip",
            "user_id": user_id
        })
        return
    timestamp = datetime.utcnow().isoformat()
    try:
        api_logger.debug(f"Upserting proactivity settings to Supabase for user {user_id}", extra={
            "event_type": "proactivity_settings_supabase_upsert_start",
            "user_id": user_id,
            "payload": payload
        })
        (
            supabase.table("proactivity_settings")
            .upsert(
                {
                    "user_id": user_id,
                    "payload": payload,
                    "updated_at": timestamp,
                },
                on_conflict="user_id",
            )
            .execute()
        )
        api_logger.debug(f"Successfully upserted proactivity settings to Supabase for user {user_id}", extra={
            "event_type": "proactivity_settings_supabase_upsert_success",
            "user_id": user_id
        })
    except Exception as error:
        api_logger.warning(f"Failed to upsert proactivity settings to Supabase for user {user_id}: {error}", extra={
            "event_type": "proactivity_settings_supabase_upsert_error",
            "user_id": user_id,
            "error": str(error)
        })
        _handle_supabase_table_error(
            "Warning: Failed to upsert proactivity settings",
            error,
        )


def _is_valid_uuid(value: Optional[str]) -> bool:
    if not value:
        return False
    try:
        UUID(value)
        return True
    except (ValueError, TypeError):
        return False


# FastAPI app
app = FastAPI(title="User Profile API with AI Chat", version="1.0.0")

# Temporarily disable request logging middleware to debug 422 errors
# app.add_middleware(RequestLoggingMiddleware, logger=api_logger)

app_logger.info("FastAPI application created with enhanced logging middleware", extra={
    "event_type": "fastapi_created",
    "title": "User Profile API with AI Chat",
    "version": "1.0.0"
})

# Global proactivity services
proactivity_engine: Optional[ProactivityEngine] = None
proactivity_scheduler: Optional[ProactivitySchedulerManager] = None
proactivity_realtime_broker = ProactivityRealtimeBroker()


@app.on_event("startup")
async def _connect_database():
    """Connect to the database on startup."""
    try:
        await database.connect()
        db_logger.info("Database connection established via startup event", extra={
            "event_type": "database_connected_startup"
        })
    except Exception as e:
        db_logger.error(
            f"Database connection failed on startup: {e}",
            exc_info=True,
            extra={
                "event_type": "database_connection_failed_startup",
                "error": str(e),
            },
        )
        raise


@app.on_event("shutdown")
async def _disconnect_database():
    """Disconnect from the database on shutdown."""
    try:
        await database.disconnect()
        db_logger.info("Database connection closed via shutdown event", extra={
            "event_type": "database_disconnected_shutdown"
        })
    except Exception as e:
        db_logger.error(
            f"Database disconnection failed on shutdown: {e}",
            exc_info=True,
            extra={
                "event_type": "database_disconnection_failed_shutdown",
                "error": str(e),
            },
        )

@app.on_event("startup")
async def _initialize_proactivity_engine():
    """Initialize the hybrid proactivity engine + scheduler."""
    global proactivity_engine, proactivity_scheduler

    try:
        app_logger.info("Initializing proactivity engine", extra={
            "event_type": "proactivity_engine_init_start"
        })

        proactivity_engine = ProactivityEngine(
            database,
            supabase,
            proactivity_realtime_broker,
            AI_MESSAGE_GENERATOR,
        )
        proactivity_scheduler = ProactivitySchedulerManager(proactivity_engine)
        await proactivity_scheduler.start()

        app_logger.info("Proactivity engine initialized successfully", extra={
            "event_type": "proactivity_engine_init_success"
        })
    except Exception as e:
        app_logger.error(
            f"Failed to initialize proactivity engine: {e}",
            exc_info=True,
            extra={
                "event_type": "proactivity_engine_init_error",
                "error": str(e),
            },
        )


@app.on_event("shutdown")
async def _shutdown_proactivity_engine():
    """Stop the APScheduler + clean up."""
    global proactivity_scheduler

    try:
        if proactivity_scheduler:
            await proactivity_scheduler.shutdown()

        app_logger.info("Proactivity engine stopped", extra={
            "event_type": "proactivity_engine_shutdown"
        })
    except Exception as e:
        app_logger.error(f"Error stopping proactivity engine: {e}", extra={
            "event_type": "proactivity_engine_shutdown_error",
            "error": str(e)
        })


@app.on_event("startup")
async def _validate_gemini_api_key_on_startup():
    app_logger.info("Starting application startup validation", extra={
        "event_type": "startup_validation_start",
        "ai_provider": AI_PROVIDER,
        "validation_enabled": VALIDATE_GEMINI_ON_STARTUP
    })

    if AI_PROVIDER != "gemini" or not VALIDATE_GEMINI_ON_STARTUP:
        app_logger.info("Gemini validation skipped", extra={
            "event_type": "gemini_validation_skipped",
            "reason": "not_gemini_provider_or_validation_disabled"
        })
        return

    if not GEMINI_SERVICE.available:
        app_logger.warning("Gemini validation skipped; no API key configured", extra={
            "event_type": "gemini_validation_skipped",
            "reason": "no_api_key"
        })
        return

    app_logger.info("Starting Gemini API key validation", extra={
        "event_type": "gemini_validation_start"
    })

    try:
        await GEMINI_SERVICE.validate_connection()
        app_logger.info("Gemini API validation succeeded", extra={
            "event_type": "gemini_validation_success"
        })
    except Exception as exc:  # pragma: no cover - best effort logging
        app_logger.error(
            f"Gemini API validation failed: {exc}",
            exc_info=True,
            extra={
                "event_type": "gemini_validation_failure",
                "error": str(exc),
            },
        )

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app_logger.info("CORS middleware configured", extra={
    "event_type": "cors_configured",
    "allowed_origins": ALLOWED_ORIGINS[:3] if len(ALLOWED_ORIGINS) > 3 else ALLOWED_ORIGINS,  # Limit logging
    "origin_regex_enabled": bool(ALLOWED_ORIGIN_REGEX)
})

# Security
security = HTTPBearer()

# Database dependency
async def get_database():
    """
    Dependency to get the database connection.
    Connection is managed globally by startup/shutdown events.
    """
    yield database

# Helper functions
def generate_initials(full_name: str) -> str:
    """Generate initials from full name."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1:
        return parts[0][:2].upper()
    return "U"


def _timestamp_ms_to_datetime(timestamp_ms: Optional[int]) -> datetime:
    if timestamp_ms is None:
        return datetime.utcnow()
    try:
        normalized = datetime.fromtimestamp(int(timestamp_ms) / 1000, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        normalized = datetime.utcnow().replace(tzinfo=timezone.utc)
    return normalized.replace(tzinfo=None)


def _datetime_to_ms(value: Optional[datetime]) -> int:
    base: datetime
    if isinstance(value, datetime):
        base = value
    elif isinstance(value, str):
        candidate = value.strip()
        if candidate:
            try:
                base = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
            except ValueError:
                base = datetime.utcnow()
        else:
            base = datetime.utcnow()
    else:
        base = datetime.utcnow()
    if base.tzinfo is None:
        aware = base.replace(tzinfo=timezone.utc)
    else:
        aware = base.astimezone(timezone.utc)
    return int(aware.timestamp() * 1000)


@app.post("/api/payments/gumroad")
async def gumroad_webhook(request: Request, db: databases.Database = Depends(get_database)):
    """
    Handle Gumroad webhook / ping events.

    On a successful, non-refunded purchase we mark the associated user as a
    premium ("Depth") member by setting `plan_tier = 'depth'` on the user row.
    Gumroad is expected to send `custom_id` containing the local user id.
    """
    form = await request.form()

    # Basic shared-secret validation; if no secret is configured locally,
    # accept the ping but avoid mutating state.
    configured_secret = GUMROAD_WEBHOOK_SECRET
    incoming_secret = form.get("secret")
    if configured_secret and incoming_secret != configured_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    custom_id = form.get("custom_id")
    if not custom_id:
        # Nothing to associate with a local user; acknowledge without changes.
        return {"ok": True}

    try:
        user_id = int(str(custom_id).strip())
    except (TypeError, ValueError):
        return {"ok": True}

    refunded_flag = str(form.get("refunded", "")).lower() == "true"
    success_flag = str(form.get("success", "")).lower() in {"true", "1"}
    sale_kind = (form.get("sale_kind") or form.get("resource_name") or "").lower()

    is_charge_event = sale_kind in {"sale", "subscription_payment", "recurring_subscription_payment"} or not sale_kind
    should_activate = success_flag and is_charge_event and not refunded_flag

    if not should_activate:
        # For now we ignore refunds / cancellations; downgrade logic can be
        # added later once product behavior is finalized.
        return {"ok": True}

    try:
        await db.execute(
            users.update()
            .where(users.c.id == user_id)
            .values(
                plan_tier="depth",
                updated_at=datetime.utcnow(),
            )
        )
    except Exception as error:
        api_logger.error(
            "Failed to update user plan from Gumroad webhook",
            exc_info=True,
            extra={
                "event_type": "gumroad_webhook_error",
                "user_id": user_id,
                "error": str(error),
            },
        )
        # Do not surface internal errors to Gumroad; just acknowledge receipt.
        return {"ok": False}

    api_logger.info(
        "Upgraded user via Gumroad webhook",
        extra={
            "event_type": "gumroad_webhook_upgrade",
            "user_id": user_id,
        },
    )
    return {"ok": True}


@app.post("/lemonsqueezy-webhook")
async def lemonsqueezy_webhook(request: Request, db: databases.Database = Depends(get_database)):
    """
    Handle LemonSqueezy webhook events for subscription purchases.
    
    Updates user plan_tier based on variant_id from subscription events.
    Expects user_id to be passed in meta.custom_data during checkout.
    """
    import hmac
    import hashlib
    
    # Verify webhook signature
    body_bytes = await request.body()
    if LEMONSQUEEZY_WEBHOOK_SECRET:
        signature = request.headers.get("X-Signature")
        if not signature:
            api_logger.warning(
                "LemonSqueezy webhook received without signature",
                extra={"event_type": "lemonsqueezy_webhook_no_signature"},
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No signature")
        
        expected_signature = hmac.new(
            LEMONSQUEEZY_WEBHOOK_SECRET.encode(),
            body_bytes,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            api_logger.warning(
                "LemonSqueezy webhook signature mismatch",
                extra={"event_type": "lemonsqueezy_webhook_invalid_signature"},
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    
    try:
        payload = json.loads(body_bytes.decode())
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        api_logger.error(
            "Failed to parse LemonSqueezy webhook payload",
            exc_info=True,
            extra={"event_type": "lemonsqueezy_webhook_parse_error", "error": str(error)},
        )
        return {"ok": False, "error": "Invalid JSON"}
    
    event_name = payload.get("meta", {}).get("event_name")
    custom_data = payload.get("meta", {}).get("custom_data", {})
    attributes = payload.get("data", {}).get("attributes", {})
    
    # Only process subscription events
    if event_name not in ["subscription_created", "subscription_updated"]:
        return {"ok": True}
    
    # Extract user_id from custom data
    user_id = custom_data.get("user_id")
    if not user_id:
        api_logger.warning(
            "LemonSqueezy webhook missing user_id",
            extra={"event_type": "lemonsqueezy_webhook_no_user_id", "event_name": event_name},
        )
        return {"ok": True}
    
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        api_logger.warning(
            "LemonSqueezy webhook invalid user_id format",
            extra={"event_type": "lemonsqueezy_webhook_invalid_user_id", "user_id": user_id},
        )
        return {"ok": True}
    
    # Determine tier from variant_id
    variant_id = str(attributes.get("variant_id", ""))
    plan_tier = None
    
    if variant_id == LEMONSQUEEZY_VOYAGER_VARIANT_ID:
        plan_tier = "voyager"
    elif variant_id == LEMONSQUEEZY_PIONEER_VARIANT_ID:
        plan_tier = "pioneer"
    
    if not plan_tier:
        api_logger.warning(
            "LemonSqueezy webhook unknown variant_id",
            extra={
                "event_type": "lemonsqueezy_webhook_unknown_variant",
                "variant_id": variant_id,
                "user_id": user_id,
            },
        )
        return {"ok": True}
    
    # Check subscription status
    subscription_status = attributes.get("status", "")
    if subscription_status not in ["active", "on_trial"]:
        # Don't upgrade if subscription is not active
        api_logger.info(
            "LemonSqueezy webhook skipping inactive subscription",
            extra={
                "event_type": "lemonsqueezy_webhook_inactive_subscription",
                "user_id": user_id,
                "status": subscription_status,
            },
        )
        return {"ok": True}
    
    # Update user tier
    try:
        await db.execute(
            users.update()
            .where(users.c.id == user_id)
            .values(
                plan_tier=plan_tier,
                updated_at=datetime.utcnow(),
            )
        )
        api_logger.info(
            "Updated user tier from LemonSqueezy webhook",
            extra={
                "event_type": "lemonsqueezy_webhook_tier_update",
                "user_id": user_id,
                "plan_tier": plan_tier,
                "variant_id": variant_id,
            },
        )
    except Exception as error:
        api_logger.error(
            "Failed to update user plan from LemonSqueezy webhook",
            exc_info=True,
            extra={
                "event_type": "lemonsqueezy_webhook_error",
                "user_id": user_id,
                "error": str(error),
            },
        )
        return {"ok": False}
    
    return {"ok": True}


def _normalize_plan_items(raw: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(raw, list):
        return normalized

    seen_ids: set[str] = set()
    seen_labels: set[str] = set()

    for entry in raw:
        if not isinstance(entry, dict):
            continue
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        dedupe_key = label.lower()
        if identifier:
            if identifier in seen_ids:
                continue
            seen_ids.add(identifier)
        elif dedupe_key in seen_labels:
            continue
        else:
            identifier = f"plan-{uuid4().hex[:8]}"
        seen_labels.add(dedupe_key)
        normalized.append(
            {
                "id": identifier,
                "label": label,
                "completed": bool(entry.get("completed")),
            }
        )
    return normalized


def _normalize_habit_items(raw: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(raw, list):
        return normalized

    seen_ids: set[str] = set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        if identifier:
            if identifier in seen_ids:
                continue
            seen_ids.add(identifier)
        else:
            identifier = f"habit-{uuid4().hex[:8]}"
        normalized.append(
            {
                "id": identifier,
                "label": label,
                "streak_label": str(entry.get("streak_label") or ""),
                "previous_label": str(entry.get("previous_label") or ""),
                "completed": bool(entry.get("completed")),
            }
        )
    return normalized


def _normalize_proactivity(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raw = {}

    identifier = str(raw.get("id") or DEFAULT_DASHBOARD_PROACTIVITY["id"]).strip()
    label = str(raw.get("label") or DEFAULT_DASHBOARD_PROACTIVITY["label"]).strip()
    description = raw.get("description")
    cadence = str(raw.get("cadence") or DEFAULT_DASHBOARD_PROACTIVITY["cadence"]).strip()
    time_label = str(raw.get("time") or DEFAULT_DASHBOARD_PROACTIVITY["time"]).strip()

    return {
        "id": identifier or DEFAULT_DASHBOARD_PROACTIVITY["id"],
        "label": label or DEFAULT_DASHBOARD_PROACTIVITY["label"],
        "description": (description or DEFAULT_DASHBOARD_PROACTIVITY.get("description")) or "",
        "cadence": cadence or DEFAULT_DASHBOARD_PROACTIVITY["cadence"],
        "time": time_label or DEFAULT_DASHBOARD_PROACTIVITY["time"],
    }


def _serialize_dashboard_pulse_record(record: Any) -> Optional[Dict[str, Any]]:
    if not record:
        return None
    plans = _normalize_plan_items(record["plans"])
    habits = _normalize_habit_items(record["habits"])
    proactivity = _normalize_proactivity(record["proactivity"])
    timestamp_ms = _datetime_to_ms(record["timestamp"])
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "date_key": record["date_key"],
        "timestamp": timestamp_ms,
        "plans": plans,
        "habits": habits,
        "proactivity": proactivity,
        "created_at": record["created_at"],
        "updated_at": record["updated_at"],
    }


def _serialize_proactivity_notification(record: Any) -> Optional[Dict[str, Any]]:
    if not record:
        return None
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "type": record["type"],
        "title": record["title"],
        "message": record["message"],
        "metadata": _row_get(record, "metadata"),
        "due_at": _row_get(record, "due_at"),
        "sent_at": record["sent_at"],
        "read_at": _row_get(record, "read_at"),
        "completed_at": _row_get(record, "completed_at"),
        "created_at": record["created_at"],
    }


def _serialize_context_cache(record: Any) -> Optional[Dict[str, Any]]:
    if not record:
        return None
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "conversation_id": _row_get(record, "conversation_id"),
        "label": _row_get(record, "label"),
        "content": _row_get(record, "content") or "",
        "created_at": record["created_at"],
    }


def _candidate_grounding_payload(candidate: Any) -> Optional[Dict[str, Any]]:
    """
    Normalize grounding information from a Gemini candidate into a JSON-serializable dict.

    Prefer the official grounding_metadata field when present, but fall back to
    citation_metadata so the UI can still render a Sources panel even when the
    Search tool only returns citations.
    """
    grounding: Optional[Dict[str, Any]] = None

    # Preferred: explicit grounding_metadata from the model.
    candidate_grounding = getattr(candidate, "grounding_metadata", None)
    if candidate_grounding is not None:
        try:
            grounding = candidate_grounding.model_dump(exclude_none=True)
        except Exception:
            grounding = None

    # Fallback: synthesize grounding chunks/supports from citation_metadata.
    citation_metadata = getattr(candidate, "citation_metadata", None)
    citations = getattr(citation_metadata, "citations", None)
    if citations:
        chunks: List[Dict[str, Any]] = []
        supports: List[Dict[str, Any]] = []
        for index, citation in enumerate(citations):
            uri = getattr(citation, "uri", None)
            title = getattr(citation, "title", None)
            start_index = getattr(citation, "start_index", None)
            end_index = getattr(citation, "end_index", None)
            if not uri:
                continue
            chunks.append(
                {
                    "web": {
                        "uri": uri,
                        "title": title or uri,
                    }
                }
            )
            if isinstance(start_index, int) and isinstance(end_index, int) and end_index > start_index:
                supports.append(
                    {
                        "segment": {
                            "start_index": start_index,
                            "end_index": end_index,
                        },
                        "grounding_chunk_indices": [index],
                    }
                )

        if chunks:
            synthesized = {
                "grounding_chunks": chunks,
            }
            if supports:
                synthesized["grounding_supports"] = supports

            if grounding:
                # Merge, giving precedence to explicit grounding metadata.
                merged = dict(grounding)
                merged.setdefault("grounding_chunks", []).extend(synthesized.get("grounding_chunks", []))
                if "grounding_supports" in synthesized:
                    merged.setdefault("grounding_supports", []).extend(
                        synthesized.get("grounding_supports", [])
                    )
                grounding = merged
            else:
                grounding = synthesized

    return grounding


def _build_maps_tool_and_config(
    maps_enabled: bool,
    maps_latitude: Optional[float],
    maps_longitude: Optional[float],
    maps_widget: bool,
) -> Tuple[List[types.Tool], Optional[types.ToolConfig]]:
    if not maps_enabled:
        return [], None

    tool = types.Tool(
        google_maps=types.GoogleMaps(enable_widget=maps_widget)
    )

    if maps_latitude is not None and maps_longitude is not None:
        lat_lng = types.LatLng(
            latitude=maps_latitude,
            longitude=maps_longitude,
        )
        tool_config = types.ToolConfig(
            retrieval_config=types.RetrievalConfig(lat_lng=lat_lng)
        )
    else:
        tool_config = types.ToolConfig()

    return [tool], tool_config


async def _load_context_cache(cache_id: int, user_id: int, db: databases.Database) -> Optional[Dict[str, Any]]:
    if cache_id is None:
        return None
    record = await db.fetch_one(
        context_cache.select().where(
            (context_cache.c.id == cache_id)
            & (context_cache.c.user_id == user_id)
        )
    )
    return record


def _context_cache_contents(record: Optional[Dict[str, Any]]) -> Optional[List[types.Content]]:
    if not record:
        return None
    content_text = _row_get(record, "content")
    if not isinstance(content_text, str) or not content_text.strip():
        return None
    return [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=content_text)],
        )
    ]


GRAY_TITLE_INSTRUCTION = (
    "When you can name this conversation, emit exactly one concise title using "
    "the <graytitle>Example Title</graytitle> format (for example "
    "<graytitle>Mamdani vs Cuomo New York</graytitle>). Keep the tag separate from "
    "the rest of your reply, do not repeat it, and only include it when you feel "
    "confident about the summary. Keep the title short (ideally under 50 characters "
    "and no more than 6–8 words)."
)


def _build_gray_title_instruction_contents(
    should_generate_title: bool,
) -> List[types.Content]:
    if not should_generate_title:
        return []
    return [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=GRAY_TITLE_INSTRUCTION)],
        )
    ]


def _merge_extra_contents(*lists: Optional[List[types.Content]]) -> Optional[List[types.Content]]:
  merged: List[types.Content] = []
  for candidate in lists:
    if candidate:
      merged.extend(candidate)
  return merged or None


def _normalize_conversation_history(history: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
  if not history:
    return []

  normalized: List[Dict[str, Any]] = []
  last_role: Optional[str] = None
  last_text: Optional[str] = None

  for entry in history:
    raw_role = entry.get("role")
    if not raw_role:
      continue

    role = "model" if raw_role == "assistant" else raw_role
    if role not in {"user", "model"}:
      continue

    text = entry.get("text") or ""

    # Deduplicate consecutive identical messages so that if the same user
    # message is accidentally persisted twice, it only influences context once.
    if last_role == role and last_text == text:
      continue

    normalized.append(
      {
        "role": role,
        "text": text,
      }
    )
    last_role = role
    last_text = text

  return normalized


async def _load_conversation_history(conversation_id: str) -> List[Dict[str, Any]]:
  """Load a conversation's messages from the user-centric Supabase tables."""
  general_user_id = _general_conversation_user_id(conversation_id)
  if general_user_id is not None:
    return _load_general_conversation_history(general_user_id)

  if not _conversation_store_available():
    return []

  if not _is_valid_uuid(conversation_id) or supabase is None:
    return []

  try:
    result = (
      supabase.table("user_chat_messages")
      .select("role, text, grounding_metadata, attachments")
      .eq("thread_id", conversation_id)
      .order("created_at", desc=False)
      .execute()
    )
    rows = result.data or []
    history: List[Dict[str, Any]] = []
    for row in rows:
      role = row.get("role")
      if not role:
        continue
      entry: Dict[str, Any] = {
        "role": role,
        "text": row.get("text") or "",
      }
      grounding_metadata = row.get("grounding_metadata")
      if grounding_metadata is not None:
        entry["grounding_metadata"] = grounding_metadata
      attachments = row.get("attachments")
      if attachments is not None:
        entry["attachments"] = attachments
      history.append(entry)
    return history
  except Exception as error:
    _handle_conversation_store_error(
      "Warning: User chat messages table not found or inaccessible",
      error,
    )
    return []


async def _ensure_user_file_search_store(
    db: databases.Database,
    user_id: int,
) -> Optional[str]:
    if not FILE_SEARCH_ENABLED or not FILE_SEARCH_SERVICE:
        return None

    query = file_search_stores.select().where(file_search_stores.c.user_id == user_id)
    existing = await db.fetch_one(query)
    if existing:
        return existing["store_name"]

    display_name = f"Gray uploads for user {user_id}"
    try:
        store = await FILE_SEARCH_SERVICE.create_store(display_name=display_name)
    except Exception as error:  # pragma: no cover - best effort logging
        print(f"[FileSearch] Failed to create store for user {user_id}: {error}")
        return None

    try:
        await db.execute(
            file_search_stores.insert().values(
                user_id=user_id,
                store_name=store.name,
                display_name=store.display_name,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
    except sqlalchemy.exc.IntegrityError:
        existing = await db.fetch_one(query)
        if existing:
            return existing["store_name"]
        raise

    return store.name


async def _upload_file_search_document(
    store_name: str,
    file_path: Path,
    display_name: Optional[str] = None,
) -> None:
    if not FILE_SEARCH_ENABLED or not FILE_SEARCH_SERVICE:
        return

    try:
        operation = await FILE_SEARCH_SERVICE.upload_to_store(
            file=str(file_path),
            store_name=store_name,
            display_name=display_name,
            chunking_config=FILE_SEARCH_CHUNKING_CONFIG,
        )
        await _wait_for_operation(operation)
    except Exception as error:  # pragma: no cover - best effort logging
        print(
            f"[FileSearch] Failed to upload {file_path.name} to {store_name}: {error}"
        )


async def _get_user_file_search_store_names(
    db: Optional[databases.Database],
    user_id: Optional[int],
) -> List[str]:
    if (
        not FILE_SEARCH_ENABLED
        or db is None
        or user_id is None
        or not FILE_SEARCH_SERVICE
    ):
        return []

    rows = await db.fetch_all(
        file_search_stores.select().where(file_search_stores.c.user_id == user_id)
    )

    return [row["store_name"] for row in rows if row and _row_get(row, "store_name")]


async def _build_file_search_tools(
    db: Optional[databases.Database],
    user_id: Optional[int],
) -> List[types.Tool]:
    store_names = await _get_user_file_search_store_names(db, user_id)
    if not store_names:
        return []
    return [
        types.Tool(
            file_search=types.FileSearch(
                file_search_store_names=store_names,
            )
        )
    ]


async def _fetch_proactivity_summary(user_id: int, info_type: Optional[str], db: databases.Database) -> Dict[str, Any]:
    """
    Build a lightweight proactivity summary based only on the current plans and habits
    stored for this user, not on any local dashboard snapshots.

    This avoids leaking or double-counting historical/local data and keeps the
    assistant's view aligned with the canonical per-user records.
    """
    plan_labels: List[str] = []
    habit_labels: List[str] = []

    # Prefer Supabase-backed tables when available so the view matches the
    # rest of the app's plan/habit APIs.
    if supabase:
        try:
            plan_result = (
                supabase.table("plans")
                .select("label")
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            for row in getattr(plan_result, "data", []) or []:
                label = str(_row_get(row, "label") or "").strip()
                if label:
                    plan_labels.append(label)
        except Exception as error:
            _handle_supabase_table_error("Warning: Proactivity summary could not load plans from Supabase", error)

        try:
            habit_result = (
                supabase.table("habits")
                .select("label")
                .eq("user_id", user_id)
                .order("created_at", desc=False)
                .execute()
            )
            for row in getattr(habit_result, "data", []) or []:
                label = str(_row_get(row, "label") or "").strip()
                if label:
                    habit_labels.append(label)
        except Exception as error:
            _handle_supabase_table_error("Warning: Proactivity summary could not load habits from Supabase", error)

    # Fallback: use the local relational tables only if Supabase isn't configured.
    if not plan_labels:
        rows = await db.fetch_all(
            plans.select()
            .where(plans.c.user_id == user_id)
            .order_by(plans.c.created_at)
        )
        for row in rows:
            label = str(_row_get(row, "label") or "").strip()
            if label:
                plan_labels.append(label)

    if not habit_labels:
        rows = await db.fetch_all(
            habits.select()
            .where(habits.c.user_id == user_id)
            .order_by(habits.c.created_at)
        )
        for row in rows:
            label = str(_row_get(row, "label") or "").strip()
            if label:
                habit_labels.append(label)

    plan_labels = plan_labels[:6]
    habit_labels = habit_labels[:6]

    summary_parts: List[str] = []
    if plan_labels:
        summary_parts.append(f"{len(plan_labels)} active plans")
    if habit_labels:
        summary_parts.append(f"{len(habit_labels)} tracked habits")
    if not summary_parts:
        summary_parts.append("No recorded plan or habit data yet.")

    return {
        "summary": " | ".join(summary_parts),
        "focus": info_type or "general",
        "plans": plan_labels,
        "habits": habit_labels,
        "latest_date": None,
    }


async def _list_calendar_events(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    start_str = args.get("start_date")
    end_str = args.get("end_date")
    calendar_id = args.get("calendar_id")

    if start_str:
        try:
            start_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except ValueError:
            return {"error": "Invalid start_date format. Use ISO 8601."}
    else:
        start_date = datetime.utcnow()

    if end_str:
        try:
            end_date = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
        except ValueError:
            return {"error": "Invalid end_date format. Use ISO 8601."}
    else:
        end_date = start_date + timedelta(days=7)

    query = calendar_events.select().where(
        (calendar_events.c.user_id == user_id) &
        (calendar_events.c.start_time >= start_date) &
        (calendar_events.c.start_time <= end_date)
    )

    if calendar_id:
        query = query.where(calendar_events.c.calendar_id == calendar_id)

    query = query.order_by(calendar_events.c.start_time.asc())
    rows = await db.fetch_all(query)

    events = []
    for row in rows:
        events.append({
            "id": row["id"],
            "title": row["title"],
            "start": row["start_time"].isoformat() if row["start_time"] else None,
            "end": row["end_time"].isoformat() if row["end_time"] else None,
            "description": row["description"],
            "calendar_id": row["calendar_id"]
        })

    return {"events": events}


async def _create_calendar_event(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    title = args.get("title")
    start_str = args.get("start_time")
    end_str = args.get("end_time")
    description = args.get("description")
    calendar_id = args.get("calendar_id")

    if not title or not start_str or not end_str:
        return {"error": "Missing required fields: title, start_time, end_time"}

    try:
        start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
    except ValueError:
        return {"error": "Invalid date format. Use ISO 8601."}

    query = calendar_events.insert().values(
        user_id=user_id,
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        calendar_id=calendar_id,
        created_at=datetime.utcnow()
    )
    event_id = await db.execute(query)
    return {"status": "success", "event_id": event_id, "message": f"Event '{title}' created."}


async def _update_calendar_event(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    event_id = args.get("event_id")
    if not event_id:
        return {"error": "event_id is required"}

    updates = {}
    if "title" in args:
        updates["title"] = args["title"]
    if "description" in args:
        updates["description"] = args["description"]
    if "start_time" in args:
        try:
            updates["start_time"] = datetime.fromisoformat(args["start_time"].replace("Z", "+00:00"))
        except ValueError:
            return {"error": "Invalid start_time format."}
    if "end_time" in args:
        try:
            updates["end_time"] = datetime.fromisoformat(args["end_time"].replace("Z", "+00:00"))
        except ValueError:
            return {"error": "Invalid end_time format."}
    if "calendar_id" in args:
        updates["calendar_id"] = args["calendar_id"]

    if not updates:
        return {"status": "no_changes", "message": "No updates provided."}

    # Verify ownership
    check_query = calendar_events.select().where((calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Event not found or access denied."}

    query = calendar_events.update().where(calendar_events.c.id == event_id).values(**updates)
    await db.execute(query)
    return {"status": "success", "message": "Event updated."}


async def _delete_calendar_event(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    event_id = args.get("event_id")
    if not event_id:
        return {"error": "event_id is required"}

    # Verify ownership
    check_query = calendar_events.select().where((calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Event not found or access denied."}

    query = calendar_events.delete().where(calendar_events.c.id == event_id)
    await db.execute(query)
    return {"status": "success", "message": "Event deleted."}


async def _complete_onboarding(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    core_blocker = args.get("core_blocker")
    # Log the blocker to personalization_about
    await db.execute(
        users.update()
        .where(users.c.id == user_id)
        .values(
            has_seen_general_chat=True,
            personalization_about=f"Core Blocker: {core_blocker}",
            updated_at=datetime.utcnow()
        )
    )
    return {"status": "success", "message": "Onboarding completed."}

async def _execute_function_call(
    function_call: types.FunctionCall,
    user_id: int,
    db: databases.Database,
) -> Dict[str, Any]:
    handler = {
        "fetch_proactivity_summary": lambda u, a, d: _fetch_proactivity_summary(u, a.get("info_type"), d),
        "list_calendar_events": lambda u, a, d: _list_calendar_events(u, a, d),
        "create_calendar_event": lambda u, a, d: _create_calendar_event(u, a, d),
        "update_calendar_event": lambda u, a, d: _update_calendar_event(u, a, d),
        "delete_calendar_event": lambda u, a, d: _delete_calendar_event(u, a, d),
        "complete_onboarding": lambda u, a, d: _complete_onboarding(u, a, d),
    }.get(function_call.name)
    if not handler:
        raise HTTPException(status_code=501, detail=f"Unsupported function: {function_call.name}")

    args = function_call.args or {}
    return await handler(user_id, args, db)


def _build_function_call_contents(
    function_call: types.FunctionCall,
    result: Dict[str, Any],
) -> List[types.Content]:
    return [
        types.Content(
            role="model",
            parts=[types.Part.from_function_call(name=function_call.name, args=function_call.args or {})],
        ),
        types.Content(
            role="user",
            parts=[types.Part.from_function_response(name=function_call.name, response=result)],
        ),
    ]


def _extract_function_call(response: types.GenerateContentResponse) -> Optional[types.FunctionCall]:
    calls = response.function_calls
    if calls:
        return calls[0]
    return None


async def _resolve_media_attachments(
    db: databases.Database,
    attachment_specs: Optional[List[ChatAttachment]],
    user_id: int,
) -> List[GeminiAttachment]:
    if not attachment_specs:
        return []

    attachment_ids = [attachment.id for attachment in attachment_specs]
    if not attachment_ids:
        return []

    query = media_uploads.select().where(
        (media_uploads.c.id.in_(attachment_ids))
        & (media_uploads.c.user_id == user_id)
    )
    rows = await db.fetch_all(query)
    records = {row["id"]: row for row in rows}

    missing = [str(attachment_id) for attachment_id in attachment_ids if attachment_id not in records]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment(s) not found: {', '.join(missing)}",
        )

    attachments: List[GeminiAttachment] = []
    for attachment_id in attachment_ids:
        record = records[attachment_id]
        storage_path = Path(record["storage_path"])
        if not storage_path.exists():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Attachment file is no longer available.",
            )
        try:
            data = storage_path.read_bytes()
        except OSError as error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read attachment: {error}",
            ) from error

        attachments.append(
            GeminiAttachment(
                data=data,
                mime_type=record["mime_type"],
                filename=record["filename"],
            )
        )

    return attachments


def _carry_forward_dashboard_entries(
    previous: Optional[Dict[str, Any]],
    plans: List[Dict[str, Any]],
    habits: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not previous:
        return plans, habits

    carry_plans = list(plans)
    carry_habits = list(habits)

    existing_plan_ids = {item["id"] for item in carry_plans}
    existing_plan_labels = {item["label"].lower() for item in carry_plans}

    for entry in previous.get("plans", []):
        if entry.get("completed"):
            continue
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        if identifier and identifier in existing_plan_ids:
            continue
        if label.lower() in existing_plan_labels:
            continue
        carry_plans.append(
            {
                "id": identifier or f"plan-{uuid4().hex[:8]}",
                "label": label,
                "completed": False,
            }
        )
        if identifier:
            existing_plan_ids.add(identifier)
        existing_plan_labels.add(label.lower())

    existing_habit_ids = {item["id"] for item in carry_habits}
    for entry in previous.get("habits", []):
        identifier = str(entry.get("id") or "").strip()
        label = str(entry.get("label") or "").strip()
        if not label:
            continue
        if identifier and identifier in existing_habit_ids:
            continue
        carry_habits.append(
            {
                "id": identifier or f"habit-{uuid4().hex[:8]}",
                "label": label,
                "streak_label": str(entry.get("streak_label") or ""),
                "previous_label": str(entry.get("previous_label") or ""),
                "completed": False,
            }
        )
        if identifier:
            existing_habit_ids.add(identifier)

    return carry_plans, carry_habits


async def _load_dashboard_pulse_by_date(db: databases.Database, user_id: int, date_key: str):
    # Prefer Supabase when available.
    if supabase:
        try:
            result = (
                supabase.table("dashboard_pulses")
                .select("*")
                .eq("user_id", user_id)
                .eq("date_key", date_key)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if rows:
                return rows[0]
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to load dashboard pulse from Supabase for user {user_id}",
                error,
            )

    query = (
        dashboard_pulses.select()
        .where(
            (dashboard_pulses.c.user_id == user_id)
            & (dashboard_pulses.c.date_key == date_key)
        )
        .limit(1)
    )
    return await db.fetch_one(query)


async def _load_previous_dashboard_pulse(db: databases.Database, user_id: int, date_key: str):
    # Prefer Supabase when available.
    if supabase:
        try:
            result = (
                supabase.table("dashboard_pulses")
                .select("*")
                .eq("user_id", user_id)
                .lt("date_key", date_key)
                .order("date_key", desc=True)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if rows:
                return rows[0]
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to load previous dashboard pulse from Supabase for user {user_id}",
                error,
            )

    query = (
        dashboard_pulses.select()
        .where(
            (dashboard_pulses.c.user_id == user_id)
            & (dashboard_pulses.c.date_key < date_key)
        )
        .order_by(dashboard_pulses.c.date_key.desc())
        .limit(1)
    )
    return await db.fetch_one(query)


def _coerce_activity_day(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        try:
            parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.strptime(candidate.split(".")[0], "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                return None
        return parsed.date()
    return None


async def _compute_proactivity_streak(db: databases.Database, user_id: int) -> Dict[str, int]:
    if not supabase:
        return {"current_streak": 0, "best_streak": 0}

    rows = []
    try:
        result = supabase.table("proactivity_logs").select("*").eq("user_id", user_id).order("activity_date", desc=True).execute()
        rows = getattr(result, "data", None) or []
    except Exception as error:
        logger.error(f"Failed to fetch proactivity logs from Supabase for user {user_id}: {error}")
        return {"current_streak": 0, "best_streak": 0}

    qualifying_days: List[date] = []
    seen: set[date] = set()

    for row in rows:
        # Handle dict (Supabase) access
        score = row.get("score")
        activity_date_val = row.get("activity_date") if isinstance(row, dict) else row["activity_date"]

        if score is not None and score < 70:
            continue
        day = _coerce_activity_day(activity_date_val)
        if day is None or day in seen:
            continue
        seen.add(day)
        qualifying_days.append(day)

    if not qualifying_days:
        return {"current_streak": 0, "best_streak": 0}

    qualifying_days_sorted = sorted(qualifying_days)
    best_streak = 0
    streak = 0
    previous_day: Optional[date] = None

    for day in qualifying_days_sorted:
        if previous_day is None:
            streak = 1
        else:
            delta = (day - previous_day).days
            if delta == 0:
                continue
            if delta == 1:
                streak += 1
            else:
                streak = 1
        previous_day = day
        best_streak = max(best_streak, streak)

    qualifying_days_desc = sorted(qualifying_days, reverse=True)
    current_streak = 0
    previous_day = None
    for day in qualifying_days_desc:
        if previous_day is None:
            current_streak = 1
        else:
            delta = (previous_day - day).days
            if delta == 0:
                continue
            if delta == 1:
                current_streak += 1
            else:
                break
        previous_day = day

    best_streak = max(best_streak, current_streak)
    return {"current_streak": current_streak, "best_streak": best_streak}


# Streak helper functions
async def get_or_create_user_streak(user_id: int, db: databases.Database) -> UserStreak:
    """Get existing user streak or create new one"""
    if not supabase:
         raise HTTPException(status_code=503, detail="Supabase is not configured")

    try:
        result = supabase.table("user_streaks").select("*").eq("user_id", user_id).limit(1).execute()
        rows = getattr(result, "data", None) or []
        if rows:
            return rows[0]

        now = datetime.utcnow().isoformat()
        supabase.table("user_streaks").insert(
            {
                "user_id": user_id,
                "current_streak": 0,
                "last_activity_date": None,
                "created_at": now,
                "updated_at": now,
            }
        ).execute()

        created = (
            supabase.table("user_streaks").select("*").eq("user_id", user_id).limit(1).execute()
        )
        created_rows = getattr(created, "data", None) or []
        if created_rows:
            return created_rows[0]
        
        raise HTTPException(status_code=500, detail="Failed to retrieve created user streak from Supabase")

    except Exception as error:
        logger.error(f"Critical: Failed to load or create user streak in Supabase for user {user_id}: {error}")
        raise HTTPException(status_code=500, detail="Database write failed for user streak")

async def update_user_streak(
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
):
    """Update user streak based on daily activity"""
    from datetime import datetime, date

    # Use the client's reported timezone when available, falling back
    # to stored user preferences and finally UTC. This keeps streak
    # boundaries aligned with the user's local calendar day.
    timezone_name = user_timezone or await _resolve_user_timezone_for_streak(user_id, db)
    if timezone_name:
        try:
            user_tz = ZoneInfo(timezone_name)
            today = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(user_tz).date()
        except Exception:  # pragma: no cover - defensive fallback
            today = datetime.utcnow().date()
    else:
        today = datetime.utcnow().date()

    for _ in range(3):  # Retry loop for optimistic locking
        streak = await get_or_create_user_streak(user_id, db)

        # Check if last activity was yesterday
        if streak['last_activity_date']:
            last_activity = _coerce_activity_day(streak['last_activity_date'])
            if last_activity is None:
                # If we can't parse the date, treat as first activity
                new_streak = 1
            else:
                yesterday = date.fromordinal(today.toordinal() - 1)

                if last_activity == yesterday:
                    # Continue streak
                    new_streak = streak['current_streak'] + 1
                elif last_activity < yesterday:
                    # Streak broken, start new one
                    new_streak = 1
                else:
                    # Already updated today
                    return streak
        else:
            # First activity ever
            new_streak = 1

        # Supabase-first update.
        if not supabase:
            raise HTTPException(status_code=503, detail="Supabase is not configured")

        try:
            now = datetime.utcnow().isoformat()
            # Optimistic locking: Ensure current_streak matches what we read
            current_val = streak.get('current_streak', 0)
            
            res = supabase.table("user_streaks").update(
                {
                    "current_streak": new_streak,
                    "last_activity_date": now,
                    "updated_at": now,
                }
            ).eq("user_id", user_id).eq("current_streak", current_val).execute()

            refreshed_rows = getattr(res, "data", None) or []
            if refreshed_rows:
                return refreshed_rows[0]
            
            # If no rows returned, the condition failed (race). Retry.
            continue

        except Exception as error:
            logger.error(f"Critical: Failed to update user streak in Supabase for user {user_id}: {error}")
            raise HTTPException(status_code=500, detail="Database update failed for user streak")

    raise HTTPException(status_code=409, detail="Concurrency error updating streak")

# API Routes

@app.get("/")
async def root():
    return {"message": "User Profile API with AI Chat"}

# AI Chat helper functions
async def get_or_create_conversation(
  conversation_id: Optional[str],
  user_id: int,
  *,
  title: Optional[str] = None,
) -> str:
  """Get existing conversation or create a new one in Supabase."""
  if not _conversation_store_available():
    raise HTTPException(status_code=503, detail="Conversation storage is not available.")

  valid_id = conversation_id if _is_valid_uuid(conversation_id) else None
  if valid_id:
    try:
      # Check if conversation exists and belongs to this user
      result = (
        supabase.table("user_chat_threads")
        .select("id")
        .eq("id", valid_id)
        .eq("user_identifier", user_id)
        .limit(1)
        .execute()
      )
      if result.data:
        return valid_id
    except Exception as error:
      _handle_conversation_store_error("Error checking conversation", error)
      raise HTTPException(status_code=503, detail="Conversation storage is not available.")

  user_data_id: Optional[int] = None
  try:
    user_data_id = _ensure_user_data_record(user_id)
    if user_data_id is None:
      raise HTTPException(status_code=503, detail="User metadata storage is not available.")
    result = (
      supabase.table("user_chat_threads")
      .insert(
        {
          "title": title or "New Conversation",
          "user_identifier": user_id,
          "user_data_id": user_data_id,
          "context_snapshot": [],
          "metadata": {},
        }
      )
      .execute()
    )
    rows = result.data or []
    if not rows:
      fallback = (
        supabase.table("user_chat_threads")
        .select("id")
        .eq("user_identifier", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
      )
      rows = fallback.data or []
    if rows:
      conversation_row = rows[0]
      conversation_id = _row_get(conversation_row, "id")
      if isinstance(conversation_id, str):
        return conversation_id
  except Exception as error:
    _handle_conversation_store_error("Error creating conversation", error)
    raise HTTPException(status_code=503, detail="Conversation storage is not available.")

  raise HTTPException(status_code=500, detail="Failed to create conversation.")


async def save_conversation_message(
  conversation_id: str,
  message: Dict[str, Any],
  *,
  user_id: Optional[int] = None,
) -> None:
  """Persist a single message for a conversation."""
  # Normalize the payload we write to storage so that rows are tidy and
  # consistent.
  raw_role = message.get("role")
  if not raw_role:
    return
  role = "model" if raw_role == "assistant" else raw_role
  if role not in {"user", "model"}:
    return
  text = message.get("text") or ""
  grounding_metadata = message.get("grounding_metadata") or message.get("groundingMetadata")

  general_user_id = _general_conversation_user_id(conversation_id)
  if general_user_id is not None:
      _insert_general_conversation_message(
          user_id=general_user_id,
          role=role,
          text=text,
          grounding_metadata=grounding_metadata,
          attachments=message.get("attachments"),
      )
      return

  if not _conversation_store_available() or not _is_valid_uuid(conversation_id):
    # If the conversation store is unavailable or the identifier is not a real
    # UUID, skip persistence rather than falling back to in-memory storage.
    return

  try:
    insert_payload: Dict[str, Any] = {
      "thread_id": conversation_id,
      "role": role,
      "text": text,
    }
    if grounding_metadata is not None:
      insert_payload["grounding_metadata"] = grounding_metadata
    attachments = message.get("attachments")
    if attachments is not None:
      insert_payload["attachments"] = attachments

    supabase.table("user_chat_messages").insert(insert_payload).execute()

    # Keep the parent conversation's updated_at fresh so the list endpoint
    # naturally sorts by most recent activity.
    updated_at_iso = datetime.utcnow().isoformat() + "Z"
    supabase.table("user_chat_threads").update(
      {
        "updated_at": updated_at_iso,
        "last_message_at": updated_at_iso,
      }
    ).eq("id", conversation_id).execute()
  except Exception as error:
    _handle_conversation_store_error("Error saving message", error)


def _format_structured_ai_reply(user_message: str, thinking: str, ai_reply: str) -> str:
    """Return a response that matches the user/thinking/ai template expected by the client."""
    user_section = (user_message or "").strip() or "(no message provided)"
    thinking_section = (thinking or "").strip() or "Considering how to respond helpfully."
    ai_section = (ai_reply or "").strip() or "Let me know how I can assist further."
    return "\n\n".join(
        [
            f"user:\n{user_section}",
            f"thinking (not visible):\n<thinking>{thinking_section}</thinking>",
            f"ai:\n{ai_section}",
        ]
    )

async def generate_chat_title_suggestion(message: str) -> Optional[str]:
    """Generate a concise chat title locally."""
    trimmed = (message or "").strip()
    if not trimmed:
        return None
    return _fallback_title_from_message(trimmed)


def _extract_title_from_response(response: str) -> Optional[str]:
    """Extract title from AI response using <graytitle> tags."""
    if not response:
        return None

    # Try to match <graytitle>...</graytitle> tags
    match = re.search(r'<graytitle\b[^>]*>([\s\S]*?)<\/graytitle>', response, re.IGNORECASE)
    if match:
        title = match.group(1).strip()
        if title:
            return title

    # Try legacy format <<gray-title>>...<<gray-title-end>>
    match = re.search(r'<<gray-title>>([\s\S]*?)<<gray-title-end>>', response, re.IGNORECASE)
    if match:
        title = match.group(1).strip()
        if title:
            return title

    return None


async def _update_conversation_title(conversation_id: str, title: str) -> None:
    """Update the title of a conversation in Supabase."""
    if not _conversation_store_available() or not _is_valid_uuid(conversation_id):
        return

    try:
        supabase.table("user_chat_threads").update(
            {"title": title}
        ).eq("id", conversation_id).execute()
    except Exception as error:
        _handle_conversation_store_error("Error updating conversation title", error)


async def stream_ai_response(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    model: Optional[str] = None,
    attachments: Optional[List[ChatAttachment]] = None,
    *,
    user_id: int,
    db: databases.Database,
    context_cache_id: Optional[int] = None,
    maps_enabled: bool = False,
    maps_latitude: Optional[float] = None,
    maps_longitude: Optional[float] = None,
    maps_widget: bool = False,
    search_enabled: bool = True,
    file_search_enabled: bool = False,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    tools: Optional[List[types.Tool]] = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Yield token chunks using the configured AI provider."""
    # Check usage limits
    if user_id is not None and db is not None:
        tracker = UsageTracker(db)
        try:
            await tracker.check_limits(user_id)
        except UsageLimitExceeded as e:
            reset_msg = ""
            if e.next_reset_time:
                reset_msg = f"\n\nLimit resets at {e.next_reset_time.strftime('%Y-%m-%d %H:%M')} UTC."

            limit_msg = (
                f"**Usage Limit Reached**\n\n"
                f"I've hit the usage cap for your **{e.tier.capitalize()}** plan. {e.message}{reset_msg}\n\n"
                f"To keep chatting without interruption, consider upgrading to a higher tier, or wait for the limit to reset."
            )
            # Yield the message as a delta so it appears, then finish.
            yield ("delta", limit_msg)
            yield ("final", {"text": limit_msg, "grounding_metadata": None})
            return

    provider = AI_PROVIDER or "gemini"
    conversation_history = _normalize_conversation_history(conversation_history)
    cached_contents = None
    cache_text_block: Optional[str] = None
    if context_cache_id:
        cache_record = await _load_context_cache(context_cache_id, user_id, db)
        cached_contents = _context_cache_contents(cache_record)
        cache_text = _row_get(cache_record, "content")
        if isinstance(cache_text, str) and cache_text.strip():
            cache_text_block = f"Context cache:\n{cache_text.strip()}"

    workspace_with_cache = workspace_context
    if cache_text_block:
        workspace_with_cache = "\n\n".join(filter(None, [workspace_context, cache_text_block]))
    title_instruction_contents = _build_gray_title_instruction_contents(should_generate_title)

    if provider == "anthropic":
        if not ANTHROPIC_SERVICE.available:
            raise RuntimeError("Anthropic service unavailable")
        accumulated = ""
        async for fragment in ANTHROPIC_SERVICE.stream(
            message,
            conversation_history,
            workspace_with_cache,
            system_prompt,
            time_context,
            model,
        ):
            if not fragment:
                continue
            accumulated += fragment
            yield ("delta", fragment)
        yield ("final", {"text": accumulated, "grounding_metadata": None})
        return

    media_attachments = await _resolve_media_attachments(db, attachments, user_id)
    maps_tools, maps_tool_config = _build_maps_tool_and_config(
        maps_enabled,
        maps_latitude,
        maps_longitude,
        maps_widget,
    )
    file_search_tools = []
    if file_search_enabled:
         file_search_tools = await _build_file_search_tools(db, user_id)

    if tools is not None:
        base_tools = tools
    else:
        base_tools = DEFAULT_CHAT_TOOLS if search_enabled else []
    tool_list = [*base_tools, *maps_tools, *file_search_tools]
    grounding_metadata: Optional[Dict[str, Any]] = None
    if GEMINI_SERVICE.available:
        try:
            accumulated = ""
            final_usage = None
            async for chunk in GEMINI_SERVICE.stream(
                message,
                conversation_history,
                workspace_with_cache,
                system_prompt,
                time_context,
                model,
                attachments=media_attachments,
                extra_contents=_merge_extra_contents(title_instruction_contents, cached_contents),
                tools=tool_list,
                tool_config=maps_tool_config,
                reasoning_mode=reasoning_mode,
            ):
                if chunk.usage_metadata:
                    final_usage = chunk.usage_metadata

                text_fragment = chunk.text or ""
                if chunk.candidates:
                    candidate = chunk.candidates[0]
                    payload = _candidate_grounding_payload(candidate)
                    if payload:
                        grounding_metadata = payload
                accumulated += text_fragment
                if text_fragment:
                    yield ("delta", text_fragment)
                
                # Check for function calls
                if chunk.candidates:
                    candidate = chunk.candidates[0]
                    for part in candidate.content.parts:
                        if part.function_call:
                            try:
                                await _execute_function_call(part.function_call, user_id, db)
                            except Exception as e:
                                api_logger.error(f"Tool execution failed: {e}")
            
            if final_usage and user_id is not None and db is not None:
                tracker = UsageTracker(db)
                await tracker.track_usage(
                    user_id,
                    final_usage.prompt_token_count or 0,
                    final_usage.candidates_token_count or 0
                )

            final_payload = {"text": accumulated, "grounding_metadata": grounding_metadata}
            if accumulated:
                yield ("final", final_payload)
                return
            # Fallback for empty response (e.g. safety blocks)
            yield ("final", {"text": "I'm unable to generate a response for that request.", "grounding_metadata": grounding_metadata})
            return
        except Exception as gemini_error:  # pragma: no cover - best effort logging
            print(f"[Gemini] Streaming failed: {gemini_error}")
            raise

    raise RuntimeError("AI service unavailable")


async def generate_ai_response(
    message: str,
    conversation_history: List[Dict[str, Any]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    model: Optional[str] = None,
    attachments: Optional[List[ChatAttachment]] = None,
    user_id: Optional[int] = None,
    db: Optional[databases.Database] = None,
    response_schema: Optional[Dict[str, Any]] = None,
    response_mime_type: Optional[str] = None,
    *,
    context_cache_id: Optional[int] = None,
    maps_enabled: bool = False,
    maps_latitude: Optional[float] = None,
    maps_longitude: Optional[float] = None,
    maps_widget: bool = False,
    search_enabled: bool = True,
    file_search_enabled: bool = False,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    tools: Optional[List[types.Tool]] = None,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Generate a structured response using the configured AI provider."""
    # Check usage limits if user context is available
    if user_id is not None and db is not None:
        tracker = UsageTracker(db)
        try:
            await tracker.check_limits(user_id)
        except UsageLimitExceeded as e:
            reset_msg = ""
            if e.next_reset_time:
                reset_msg = f"\n\nLimit resets at {e.next_reset_time.strftime('%Y-%m-%d %H:%M')} UTC."
            
            limit_msg = (
                f"**Usage Limit Reached**\n\n"
                f"I've hit the usage cap for your **{e.tier.capitalize()}** plan. {e.message}{reset_msg}\n\n"
                f"To keep chatting without interruption, consider upgrading to a higher tier, or wait for the limit to reset."
            )
            return limit_msg, None

    conversation_history = _normalize_conversation_history(conversation_history)
    if not (message or "").strip() and not conversation_history and not (attachments or []):
        message = "Let's get started."
    provider = AI_PROVIDER or "gemini"

    cached_contents = None
    cache_text_block: Optional[str] = None
    if context_cache_id:
        if user_id is None or db is None:
            raise HTTPException(status_code=400, detail="User context is required for cached contexts.")
        cache_record = await _load_context_cache(context_cache_id, user_id, db)
        cached_contents = _context_cache_contents(cache_record)
        cache_text = _row_get(cache_record, "content")
        if isinstance(cache_text, str) and cache_text.strip():
            cache_text_block = f"Context cache:\n{cache_text.strip()}"

    workspace_with_cache = workspace_context
    if cache_text_block:
        workspace_with_cache = "\n\n".join(filter(None, [workspace_context, cache_text_block]))
    title_instruction_contents = _build_gray_title_instruction_contents(should_generate_title)

    if provider == "anthropic":
        if not ANTHROPIC_SERVICE.available:
            raise HTTPException(status_code=503, detail="Anthropic service unavailable")
        if attachments:
            print("[Anthropic] Attachment support is not implemented; ignoring attachments for this request.")
        response_text = await ANTHROPIC_SERVICE.generate(
            message,
            conversation_history,
            workspace_with_cache,
            system_prompt,
            time_context,
            model,
        )
        if not response_text:
            raise RuntimeError("AI response was empty")
        return response_text, None

    attachment_payloads: List[GeminiAttachment] = []
    if attachments:
        if user_id is None or db is None:
            raise HTTPException(status_code=400, detail="User information is required for attachments.")
        attachment_payloads = await _resolve_media_attachments(db, attachments, user_id)

    maps_tools, maps_tool_config = _build_maps_tool_and_config(
        maps_enabled,
        maps_latitude,
        maps_longitude,
        maps_widget,
    )
    file_search_tools = []
    if file_search_enabled:
         file_search_tools = await _build_file_search_tools(db, user_id)

    if tools is not None:
        base_tools = tools
    else:
        base_tools = DEFAULT_CHAT_TOOLS if search_enabled else []
    tool_list = [*base_tools, *maps_tools, *file_search_tools]
    grounding_metadata: Optional[Dict[str, Any]] = None
    if GEMINI_SERVICE.available:
        try:
            response = await GEMINI_SERVICE.generate(
                message,
                conversation_history,
                workspace_with_cache,
                system_prompt,
                time_context,
                model,
                attachments=attachment_payloads,
                extra_contents=_merge_extra_contents(title_instruction_contents, cached_contents),
                response_schema=response_schema,
                response_mime_type=response_mime_type,
                tools=tool_list,
                tool_config=maps_tool_config,
                reasoning_mode=reasoning_mode,
            )

            # Track usage
            if user_id is not None and db is not None and response.usage_metadata:
                tracker = UsageTracker(db)
                await tracker.track_usage(
                    user_id,
                    response.usage_metadata.prompt_token_count or 0,
                    response.usage_metadata.candidates_token_count or 0
                )

            if response.candidates:
                candidate = response.candidates[0]
                for part in candidate.content.parts:
                    if part.function_call:
                        try:
                            await _execute_function_call(part.function_call, user_id, db)
                        except Exception as e:
                            api_logger.error(f"Tool execution failed: {e}")

            if response.candidates:
                candidate = response.candidates[0]
                if candidate.grounding_metadata:
                    grounding_metadata = candidate.grounding_metadata.model_dump(exclude_none=True)
            attempts = 0
            while attempts < 3:
                function_call = _extract_function_call(response)
                if not function_call:
                    break
                if user_id is None or db is None:
                    raise HTTPException(
                        status_code=400,
                        detail="User context is required to execute function calls.",
                    )
                tool_result = await _execute_function_call(function_call, user_id, db)
                tool_contents = _build_function_call_contents(function_call, tool_result)
                extra_payloads = _merge_extra_contents(
                    title_instruction_contents,
                    cached_contents,
                    tool_contents,
                )
                response = await GEMINI_SERVICE.generate(
                    message,
                    conversation_history,
                    workspace_with_cache,
                    system_prompt,
                    time_context,
                    model,
                    attachments=attachment_payloads,
                    extra_contents=extra_payloads,
                    response_schema=response_schema,
                    response_mime_type=response_mime_type,
                    tools=tool_list,
                    tool_config=maps_tool_config,
                    reasoning_mode=reasoning_mode,
                )
                
                # Track usage for follow-up generation
                if user_id is not None and db is not None and response.usage_metadata:
                    tracker = UsageTracker(db)
                    await tracker.track_usage(
                        user_id,
                        response.usage_metadata.prompt_token_count or 0,
                        response.usage_metadata.candidates_token_count or 0
                    )

                if response.candidates:
                    candidate = response.candidates[0]
                    payload = _candidate_grounding_payload(candidate)
                    if payload:
                        grounding_metadata = payload
                attempts += 1
            final_text = response.text or ""
            if final_text:
                return final_text, grounding_metadata
            raise RuntimeError("AI response was empty")
        except Exception as gemini_error:  # pragma: no cover - best effort logging
            print(f"[Gemini] Unable to generate response: {gemini_error}")
            raise
    raise HTTPException(status_code=503, detail="AI service unavailable")



def _sse_event(event: str, payload: Dict[str, Any]) -> str:
    """Serialize an SSE event."""
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _starter_profile_context(payload: ChatStarterRequest) -> str:
    lines: List[str] = []
    if payload.nickname and payload.nickname.strip():
        lines.append(f"Preferred name: {payload.nickname.strip()}")
    elif payload.name and payload.name.strip():
        lines.append(f"Name: {payload.name.strip()}")
    if payload.occupation and payload.occupation.strip():
        lines.append(f"Occupation: {payload.occupation.strip()}")
    if payload.about and payload.about.strip():
        lines.append(f"About: {payload.about.strip()}")
    if payload.custom_instructions and payload.custom_instructions.strip():
        lines.append(f"Tone guidance: {payload.custom_instructions.strip()}")
    return "\n".join(lines)


def _starter_fallback_message(payload: ChatStarterRequest) -> str:
    preferred = (payload.nickname or payload.name or "there").strip() or "there"
    return f"Hey {preferred}! I'm Gray. I'm here to help you stay on track and build momentum. What's the main thing you're focused on right now?"


def _build_starter_prompt(payload: ChatStarterRequest, profile_context: str) -> str:
    prompt_parts = [
        "You are Gray, a smart productivity partner here to help users gain clarity and momentum.",
        "Write a warm, brief greeting (2-3 sentences) to kick off a chat with a new user.",
        "Introduce yourself simply as Gray.",
        "Ask them one specific question to get started, like 'What's the main thing you're focused on right now?'",
        "Keep the tone casual, friendly, and encouraging. Avoid corporate speak or being overly formal.",
        "Reference the person’s preferred name if provided.",
    ]
    if profile_context:
        prompt_parts.append(f"Profile hints:\n{profile_context}")
    return "\n\n".join(part for part in prompt_parts if part.strip())


@app.post("/api/chat/starter", response_model=ChatStarterResponse)
async def generate_chat_starter(request: ChatStarterRequest) -> ChatStarterResponse:
    """Return an AI-authored greeting for the General workspace."""
    profile_context = _starter_profile_context(request)
    prompt = _build_starter_prompt(request, profile_context)
    fallback_message = _starter_fallback_message(request)
    try:
        ai_logger.info(
            "Generating chat starter",
            extra={
                "event_type": "chat_starter_request",
                "user_id": request.user_id,
                "has_profile_context": bool(profile_context),
            },
        )
        response_text, _ = await generate_ai_response(
            prompt,
            conversation_history=[],
            workspace_context=request.workspace_context,
            system_prompt=request.system_prompt,
            time_context=request.time_context,
            model=None,
            attachments=None,
            user_id=request.user_id,
            db=database,
            search_enabled=False,
            should_generate_title=False,
        )
        cleaned = (response_text or "").strip()
        if not cleaned:
            raise RuntimeError("Starter response was empty")
        return ChatStarterResponse(message=cleaned, used_fallback=False)
    except Exception as error:  # pragma: no cover - best effort logging
        ai_logger.error(
            "Chat starter generation failed",
            extra={
                "event_type": "chat_starter_error",
                "user_id": request.user_id,
            },
            exc_info=True,
        )
        return ChatStarterResponse(message=fallback_message, used_fallback=True)


# AI Chat endpoints
@app.post("/api/chat/title", response_model=ChatTitleResponse)
async def create_chat_title(request: ChatTitleRequest):
    """Generate a chat title suggestion using local heuristics."""
    suggestion: Optional[str] = None
    try:
        suggestion = await generate_chat_title_suggestion(request.message)
    except Exception as error:  # pragma: no cover - best effort logging
        print(f"Title generation error: {error}")
    if suggestion:
        return ChatTitleResponse(title=suggestion)
    return ChatTitleResponse(title=_fallback_title_from_message(request.message))


@app.post("/context-cache", response_model=ContextCache)
async def create_context_cache(
    payload: ContextCacheBase,
    user_id: int = Query(..., description="ID of the user creating the context cache"),
    db: databases.Database = Depends(get_database),
) -> ContextCache:
    now = datetime.utcnow()
    query = context_cache.insert().values(
        user_id=user_id,
        conversation_id=payload.conversation_id,
        label=payload.label,
        content=payload.content,
        created_at=now,
    )
    cache_id = await db.execute(query)
    return ContextCache(
        id=cache_id,
        user_id=user_id,
        conversation_id=payload.conversation_id,
        label=payload.label,
        content=payload.content,
        created_at=now,
    )


@app.get("/context-cache/{cache_id}", response_model=ContextCache)
async def get_context_cache(cache_id: int, db: databases.Database = Depends(get_database)):
    record = await db.fetch_one(
        context_cache.select().where(context_cache.c.id == cache_id)
    )
    payload = _serialize_context_cache(record)
    if not payload:
        raise HTTPException(status_code=404, detail="Context cache not found.")
    return ContextCache(**payload)


class FileSearchStoreCreate(BaseModel):
    display_name: Optional[str] = None


class FileSearchUploadResponse(BaseModel):
    operation_name: str
    done: bool
    result: Optional[Dict[str, Any]] = None


class FileSearchImportPayload(BaseModel):
    file_search_store_name: str
    file_name: str
    chunking_config: Optional[Dict[str, Any]] = None


def _ensure_file_search_enabled():
    if not FILE_SEARCH_ENABLED or not FILE_SEARCH_SERVICE:
        raise HTTPException(status_code=503, detail="File Search is not enabled.")


async def _wait_for_operation(operation: types.Operation) -> types.Operation:
    while not operation.done:
        await sleep(2)
        operation = await FILE_SEARCH_SERVICE.get_operation(operation.name)
    return operation


@app.post("/api/file-search/stores", response_model=Dict[str, Any])
async def create_file_search_store(
    payload: FileSearchStoreCreate,
):
    _ensure_file_search_enabled()
    store = await FILE_SEARCH_SERVICE.create_store(payload.display_name)
    return {"name": store.name, "display_name": store.display_name}


@app.post("/api/file-search/upload", response_model=FileSearchUploadResponse)
async def upload_to_file_search_store(
    store_name: str = Form(...),
    file: UploadFile = File(...),
    display_name: Optional[str] = Form(None),
    chunking_config: Optional[str] = Form(None),
):
    _ensure_file_search_enabled()
    chunk_config = _parse_json_field(chunking_config)
    temp_path = MEDIA_UPLOAD_DIR / f"filesearch-{uuid4().hex}{Path(file.filename or 'upload').suffix}"
    data = await file.read()
    temp_path.write_bytes(data)
    try:
        operation = await FILE_SEARCH_SERVICE.upload_to_store(
            str(temp_path),
            store_name,
            display_name,
            chunk_config,
        )
        result = await _wait_for_operation(operation)
    finally:
        try:
            temp_path.unlink()
        except OSError:
            pass
    return FileSearchUploadResponse(
        operation_name=result.name,
        done=result.done,
        result=result.result.model_dump() if result.result else None,
    )


@app.post("/api/file-search/import", response_model=FileSearchUploadResponse)
async def import_file_search(
    payload: FileSearchImportPayload,
):
    _ensure_file_search_enabled()
    operation = await FILE_SEARCH_SERVICE.import_file(
        payload.file_search_store_name,
        payload.file_name,
        payload.chunking_config,
    )
    result = await _wait_for_operation(operation)
    return FileSearchUploadResponse(
        operation_name=result.name,
        done=result.done,
        result=result.result.model_dump() if result.result else None,
    )


@app.post("/api/uploads", response_model=MediaUpload)
async def upload_media(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: databases.Database = Depends(get_database),
):
    """Upload an image or PDF for later chat use."""
    content_type = (file.content_type or "").lower()
    if not content_type:
        raise HTTPException(status_code=400, detail="Missing content type for upload.")

    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Only image and PDF media are supported.")

    original_name = Path(file.filename or "").name or "upload"
    extension = Path(original_name).suffix
    media_id = uuid4().hex
    storage_name = f"{media_id}{extension}"
    storage_path = MEDIA_UPLOAD_DIR / storage_name

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        storage_path.write_bytes(file_bytes)
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"Failed to store upload: {error}") from error

    now = datetime.utcnow()
    query = media_uploads.insert().values(
        user_id=user_id,
        filename=original_name,
        mime_type=content_type,
        size=len(file_bytes),
        storage_path=str(storage_path),
        created_at=now,
    )
    media_record_id = await db.execute(query)
    if FILE_SEARCH_ENABLED and FILE_SEARCH_SERVICE:
        store_name = await _ensure_user_file_search_store(db, user_id)
        if store_name:
            await _upload_file_search_document(store_name, storage_path, original_name)
    return MediaUpload(
        id=media_record_id,
        user_id=user_id,
        filename=original_name,
        mime_type=content_type,
        size=len(file_bytes),
        created_at=now,
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest, db: databases.Database = Depends(get_database)):
    """Send a message to AI and get a response"""
    start_time = datetime.utcnow()

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(request.user_id)[:8])

    api_logger.info("Chat request received", extra={
        "event_type": "chat_request_start",
        "user_id": request.user_id,
        "message_length": len(request.message),
        "conversation_id": request.conversation_id,
        "model": request.model,
        "correlation_id": correlation_id
    })

    try:
        # Generate a title for the chat session (only if requested)
        session_title = None
        if request.should_generate_title:
            try:
                title_request = ChatTitleRequest(message=request.message)
                # Add timeout to prevent title generation from blocking
                title_response = await wait_for(
                    create_chat_title(title_request),
                    timeout=3.0
                )
                session_title = title_response.title
            except TimeoutError:
                api_logger.warning("Title generation timeout, using fallback", extra={
                    "event_type": "title_generation_timeout",
                    "user_id": request.user_id,
                    "correlation_id": correlation_id
                })
                session_title = _fallback_title_from_message(request.message)
            except Exception as title_error:
                api_logger.warning(f"Title generation failed: {title_error}", extra={
                    "event_type": "title_generation_error",
                    "user_id": request.user_id,
                    "error": str(title_error),
                    "correlation_id": correlation_id
                })
                session_title = _fallback_title_from_message(request.message)

        if not session_title:
            session_title = _fallback_title_from_message(request.message)

        # Create chat session
        now = datetime.utcnow()
        chat_session_query = chat_sessions.insert().values(
            user_id=request.user_id,
            title=session_title,
            scope="thread",
            created_at=now,
            updated_at=now
        )
        session_id = await db.execute(chat_session_query)

        # Determine conversation_id, only using Supabase when provided ID is valid or unspecified
        requested_conversation_id = request.conversation_id
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        if requested_conversation_id and not valid_requested_conversation_id:
            conversation_id = requested_conversation_id
        else:
            conversation_id = await get_or_create_conversation(
                requested_conversation_id if valid_requested_conversation_id else None,
                request.user_id,
                title=session_title,
            )

        # Get conversation history for context
        conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id)

        # Save user message to local conversation store (after capturing prior history),
        # but avoid writing an identical message twice in a row (e.g., when a fallback
        # request replays the same prompt after a streaming failure).
        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": request.message
        }
        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and last_history_entry.get("role") in {"user", "assistant", "model"}
            and (last_history_entry.get("text") or "") == request.message
        )
        if should_persist_user:
            await save_conversation_message(conversation_id, user_message_payload, user_id=request.user_id)

        # Enforce tier restrictions
        # Only Voyager and Pioneer users can use reasoning mode.
        # If the user is on the 'scout' plan (or no plan), force reasoning_mode to False.
        user_record = await db.fetch_one(users.select().where(users.c.id == request.user_id))
        plan_tier = user_record["plan_tier"] if user_record else None
        
        # Normalize tier to lowercase for comparison
        normalized_tier = (plan_tier or "scout").lower()
        
        # If user requested reasoning but is not eligible, disable it silently (or we could raise 403)
        effective_reasoning_mode = request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            api_logger.info(f"Disabling reasoning mode for user {request.user_id} (tier: {normalized_tier})")
            effective_reasoning_mode = False

        # Generate AI response
        ai_response, grounding_metadata = await generate_ai_response(
            request.message,
            conversation_history,
            request.context,
            request.system_prompt,
            request.time_context,
            request.model,
            request.attachments,
            request.user_id,
            db,
            response_schema=request.response_json_schema,
            response_mime_type=request.response_mime_type,
            context_cache_id=request.context_cache_id,
            maps_enabled=request.maps_enabled,
            maps_latitude=request.maps_latitude,
            maps_longitude=request.maps_longitude,
            maps_widget=request.maps_widget,
            search_enabled=request.web_search_enabled,
            file_search_enabled=request.file_search_enabled,
            should_generate_title=request.should_generate_title,
            reasoning_mode=effective_reasoning_mode,
        )

        # Save AI response (including grounding metadata for downstream UI)
        assistant_message_payload: Dict[str, Any] = {
            "role": "model",
            "text": ai_response,
        }
        if grounding_metadata:
            assistant_message_payload["grounding_metadata"] = grounding_metadata
        await save_conversation_message(conversation_id, assistant_message_payload, user_id=request.user_id)

        # Extract title from AI response if title generation was requested
        extracted_title: Optional[str] = None
        if request.should_generate_title:
            extracted_title = _extract_title_from_response(ai_response)
            if extracted_title:
                # Update the title in the database with the AI-generated one
                await _update_conversation_title(conversation_id, extracted_title)
                session_title = extracted_title

        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id,
            grounding_metadata=grounding_metadata,
            title=session_title,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


DEFAULT_ONBOARDING_SYSTEM_PROMPT = """
You are Gray, a smart productivity partner here to help users gain clarity and momentum.

This is a new user's first interaction. Keep it warm, brief, and action-oriented.

Introduce yourself simply: "Hey! I'm Gray. I'm here to help you stay on track and build momentum."

Then ask just 2-3 quick questions to get started:
1. What name should I use when I hype you up?
2. What's the main thing you're building toward right now?

That's it. Keep it casual and encouraging. Don't overwhelm them with a long questionnaire.
After they share, acknowledge what they said and let them know you're ready to help them stay accountable.

Tone:
- Warm and friendly, like a supportive friend
- Brief and to the point
- Encouraging without being pushy
- Gen Z casual but not forced
"""

ONBOARDING_SYSTEM_PROMPT = load_prompt_from_file(ONBOARDING_PROMPT_PATH, DEFAULT_ONBOARDING_SYSTEM_PROMPT)


@app.post("/api/chat/stream")
async def chat_with_ai_stream(request: ChatRequest, db: databases.Database = Depends(get_database)):
    """Stream an AI response token-by-token using Server-Sent Events."""
    start_time = datetime.utcnow()

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(request.user_id)[:8])

    api_logger.info("Chat stream request received", extra={
        "event_type": "chat_stream_request_start",
        "user_id": request.user_id,
        "message_length": len(request.message),
        "conversation_id": request.conversation_id,
        "model": request.model,
        "correlation_id": correlation_id
    })

    try:
        # Fetch user record for logic
        user_record = await db.fetch_one(users.select().where(users.c.id == request.user_id))
        
        # Handle Onboarding Logic
        effective_message = request.message
        effective_system_prompt = request.system_prompt
        tool_list = None

        if user_record and not user_record["has_seen_general_chat"]:
            # Always use onboarding prompt for the first interaction
            effective_system_prompt = ONBOARDING_SYSTEM_PROMPT
            tool_list = list(ONBOARDING_TOOLS)
            
            # Force a capable model for onboarding tools
            request.model = "models/gemini-1.5-flash"
            
            # If this is the very first interaction (triggered by frontend with empty message usually)
            if not effective_message or not effective_message.strip():
                effective_message = "Hi Gray, I'm new here. Let's get started."
            
            api_logger.info(f"User {request.user_id} is in onboarding flow")

        # Generate a title for the chat session (only if requested)
        session_title = None
        if request.should_generate_title:
            try:
                title_request = ChatTitleRequest(message=effective_message)
                # Add timeout to prevent title generation from blocking the stream
                title_response = await wait_for(
                    create_chat_title(title_request),
                    timeout=3.0
                )
                session_title = title_response.title
            except TimeoutError:
                api_logger.warning("Title generation timeout, using fallback", extra={
                    "event_type": "title_generation_timeout",
                    "user_id": request.user_id,
                    "correlation_id": correlation_id
                })
                session_title = _fallback_title_from_message(effective_message)
            except Exception as title_error:
                api_logger.warning(f"Title generation failed: {title_error}", extra={
                    "event_type": "title_generation_error",
                    "user_id": request.user_id,
                    "error": str(title_error),
                    "correlation_id": correlation_id
                })
                session_title = _fallback_title_from_message(effective_message)

        if not session_title:
            session_title = _fallback_title_from_message(effective_message)

        # Create chat session
        now = datetime.utcnow()
        chat_session_query = chat_sessions.insert().values(
            user_id=request.user_id,
            title=session_title,
            scope="thread",
            created_at=now,
            updated_at=now
        )
        session_id = await db.execute(chat_session_query)

        requested_conversation_id = request.conversation_id
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        if requested_conversation_id and not valid_requested_conversation_id:
            conversation_id = requested_conversation_id
        else:
            conversation_id = await get_or_create_conversation(
                requested_conversation_id if valid_requested_conversation_id else None,
                request.user_id,
                title=session_title,
            )

        conversation_history: List[Dict[str, Any]] = []
        if conversation_id:
            conversation_history = await _load_conversation_history(conversation_id)

        # Avoid sending an empty payload to the AI provider (Gemini rejects requests with no contents).
        if not (effective_message or "").strip() and not conversation_history and not (request.attachments or []):
            effective_message = "Let's get started."

        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": effective_message,
        }

        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and last_history_entry.get("role") in {"user", "assistant", "model"}
            and (last_history_entry.get("text") or "") == effective_message
        )
        if should_persist_user:
            await save_conversation_message(conversation_id, user_message_payload, user_id=request.user_id)

        # Enforce tier restrictions for streaming
        # user_record was already fetched above
        plan_tier = user_record["plan_tier"] if user_record else None
        normalized_tier = (plan_tier or "scout").lower()
        
        effective_reasoning_mode = request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            api_logger.info(f"Disabling reasoning mode for user {request.user_id} (tier: {normalized_tier})")
            effective_reasoning_mode = False

        async def event_stream() -> AsyncGenerator[str, None]:
            nonlocal session_title
            start_time = time.perf_counter()
            first_token_time: Optional[float] = None
            try:
                accumulated_visible = ""
                final_response: Optional[str] = None
                grounding_metadata_payload: Optional[Dict[str, Any]] = None
                async for kind, payload in stream_ai_response(
                    effective_message,
                    conversation_history,
                    request.context,
                    effective_system_prompt,
                    user_id=request.user_id,
                    db=db,
                    time_context=request.time_context,
                    model=request.model,
                    attachments=request.attachments,
                    context_cache_id=request.context_cache_id,
                    maps_enabled=request.maps_enabled,
                    maps_latitude=request.maps_latitude,
                    maps_longitude=request.maps_longitude,
                    maps_widget=request.maps_widget,
                    search_enabled=request.web_search_enabled,
                    file_search_enabled=request.file_search_enabled,
                    should_generate_title=request.should_generate_title,
                    reasoning_mode=effective_reasoning_mode,
                    tools=tool_list,
                ):
                    if kind == "delta":
                        if not payload:
                            continue
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        accumulated_visible += payload
                        yield _sse_event("token", {"delta": payload})
                        if STREAMING_TOKEN_DELAY:
                            await sleep(STREAMING_TOKEN_DELAY)
                        else:
                            await sleep(0)
                    elif kind == "final":
                        if isinstance(payload, dict):
                            final_response = payload.get("text") or accumulated_visible
                            grounding_metadata_payload = payload.get("grounding_metadata")
                        elif payload:
                            final_response = payload

                if final_response is None:
                    final_response = accumulated_visible

                assistant_message_payload: Dict[str, Any] = {
                    "role": "model",
                    "text": final_response,
                }
                if grounding_metadata_payload:
                    assistant_message_payload["grounding_metadata"] = grounding_metadata_payload
                await save_conversation_message(conversation_id, assistant_message_payload, user_id=request.user_id)

                # Extract title from AI response if title generation was requested
                extracted_title: Optional[str] = None
                if request.should_generate_title:
                    extracted_title = _extract_title_from_response(final_response)
                    if extracted_title:
                        # Update the title in the database with the AI-generated one
                        await _update_conversation_title(conversation_id, extracted_title)
                        session_title = extracted_title

                end_payload: Dict[str, Any] = {
                    "conversation_id": conversation_id,
                    "response": final_response,
                    "title": session_title,
                }
                if grounding_metadata_payload:
                    end_payload["grounding_metadata"] = grounding_metadata_payload
                final_time = time.perf_counter()
                timing_payload: Dict[str, int] = {
                    "total_ms": int(max(0.0, (final_time - start_time) * 1000)),
                }
                if first_token_time is not None:
                    timing_payload["first_token_ms"] = int(max(0.0, (first_token_time - start_time) * 1000))
                end_payload["timing"] = timing_payload
                yield _sse_event("end", end_payload)
            except Exception as stream_error:  # pragma: no cover - best effort logging
                yield _sse_event("error", {"message": str(stream_error)})

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }

        # Log successful completion
        total_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        api_logger.info("Chat request completed successfully", extra={
            "event_type": "chat_request_complete",
            "user_id": request.user_id,
            "conversation_id": conversation_id,
            "total_time_ms": total_time,
            "response_length": len(final_response) if 'final_response' in locals() else 0,
            "correlation_id": correlation_id
        })

        clear_request_context()
        return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
    except Exception as error:
        total_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        error_msg = str(error)
        api_logger.error(
            f"Chat stream request failed: {error_msg}",
            exc_info=True,
            extra={
                "event_type": "chat_stream_request_error",
                "user_id": request.user_id,
                "error": error_msg,
                "total_time_ms": total_time,
                "correlation_id": correlation_id,
            },
        )

        async def error_stream() -> AsyncGenerator[str, None]:
            yield _sse_event("error", {"message": error_msg})

        clear_request_context()
        return StreamingResponse(error_stream(), status_code=500, media_type="text/event-stream")

class MessageCreateRequest(BaseModel):
    role: str
    text: str
    user_id: Optional[int] = None

@app.post("/api/conversation/{conversation_id}/messages")
async def create_conversation_message(conversation_id: str, request: MessageCreateRequest):
    """Manually append a message to a conversation history."""
    try:
        payload = {
            "role": request.role,
            "text": request.text
        }
        await save_conversation_message(conversation_id, payload, user_id=request.user_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving message: {str(e)}")

@app.get("/api/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
  """Get conversation history."""
  try:
    history = await _load_conversation_history(conversation_id)
    return history
  except Exception as e:
    raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")

@app.post("/api/conversation")
async def create_conversation(request: ConversationCreateRequest):
    """Create a new conversation"""
    try:
        if not _conversation_store_available():
            # Fallback: return mock conversation
            import uuid
            return {
                "id": str(uuid.uuid4()),
                "title": request.title,
                "history": [],
                "user_id": request.user_id,
            }

        try:
            user_data_id = _ensure_user_data_record(request.user_id)
            if user_data_id is None:
                raise HTTPException(status_code=503, detail="User metadata storage is not available.")
            result = (
                supabase.table("user_chat_threads")
                .insert(
                    {
                        "title": request.title or "New Conversation",
                        "user_identifier": request.user_id,
                        "user_data_id": user_data_id,
                        "context_snapshot": [],
                        "metadata": {},
                    }
                )
                .execute()
            )

            rows = result.data or []
            if not rows:
                fallback = (
                    supabase.table("user_chat_threads")
                    .select("id, title, created_at, updated_at")
                    .eq("user_identifier", request.user_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                rows = fallback.data or []

            if rows:
                row = rows[0]
                return {
                    **row,
                    "history": [],
                    "user_id": request.user_id,
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to create conversation")
        except Exception as supabase_error:
            # Handle missing table gracefully
            _handle_conversation_store_error("Warning: Conversations table not found or inaccessible", supabase_error)
            # Fallback: return mock conversation
            import uuid
            return {
                "id": str(uuid.uuid4()),
                "title": request.title,
                "history": [],
                "user_id": request.user_id,
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(e)}")


@app.delete("/api/conversation/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str):
    """Delete a conversation and all of its stored messages.

    This is used by the frontend when a user deletes an entire chat.
    It mirrors the behavior of other conversation helpers by updating
    both Supabase (when available) and the in-memory fallback store.
    """
    try:
        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None:
            _delete_general_conversation_history(general_user_id)
            return

        if _conversation_store_available() and _is_valid_uuid(conversation_id):
            try:
                supabase.table("user_chat_threads").delete().eq("id", conversation_id).execute()
            except Exception as error:
                _handle_conversation_store_error("Error deleting conversation", error)
        # When storage is unavailable or the ID is not a UUID, there is nothing to delete.
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(error)}")


class ConversationHistoryPayload(BaseModel):
    messages: List[Dict[str, Any]]


@app.put("/api/conversation/{conversation_id}/history")
async def overwrite_conversation_history(conversation_id: str, payload: ConversationHistoryPayload):
    """Replace the full message history for a conversation.

    The frontend uses this when the user deletes individual messages so that
    server-side history matches the locally edited conversation.
    """
    try:
        normalized_history = _normalize_conversation_history(payload.messages)
        updated_at_iso = datetime.utcnow().isoformat() + "Z"

        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None:
            _replace_general_conversation_history(general_user_id, normalized_history)
            return {
                "id": conversation_id,
                "message_count": len(normalized_history),
            }

        # Write to Supabase when available and the conversation_id is a real UUID.
        if _conversation_store_available() and _is_valid_uuid(conversation_id):
            try:
                supabase.table("user_chat_messages").delete().eq("thread_id", conversation_id).execute()
                if normalized_history:
                    rows: List[Dict[str, Any]] = []
                    for entry in normalized_history:
                        rows.append(
                            {
                                "thread_id": conversation_id,
                                "role": entry.get("role"),
                                "text": entry.get("text") or "",
                            }
                        )
                    supabase.table("user_chat_messages").insert(rows).execute()

                supabase.table("user_chat_threads").update({
                    "updated_at": updated_at_iso,
                    "last_message_at": updated_at_iso,
                }).eq("id", conversation_id).execute()
            except Exception as error:
                _handle_conversation_store_error("Error overwriting conversation history", error)

        return {
            "id": conversation_id,
            "message_count": len(normalized_history),
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error overwriting conversation history: {str(error)}",
        )

def _normalize_conversation_title(payload: ConversationUpdateRequest) -> str | None:
    normalized_title: Optional[str] = None
    if payload.title is not None:
        normalized_title = payload.title.strip()
        if not normalized_title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation title cannot be empty")
    return normalized_title


async def _apply_conversation_update(
    conversation_id: str, payload: ConversationUpdateRequest
) -> Dict[str, Any]:
    normalized_title = _normalize_conversation_title(payload)
    if normalized_title is None and payload.user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No conversation fields provided")

    updated_at_iso = datetime.utcnow().isoformat() + "Z"
    storage_available = _conversation_store_available()
    valid_conversation_id = _is_valid_uuid(conversation_id)

    user_data_id_for_update: Optional[int] = None
    if payload.user_id is not None:
        user_data_id_for_update = _ensure_user_data_record(payload.user_id)

    if storage_available and valid_conversation_id:
        update_values: Dict[str, Any] = {"updated_at": updated_at_iso}
        if normalized_title is not None:
            update_values["title"] = normalized_title
        if payload.user_id is not None:
            update_values["user_identifier"] = payload.user_id
            if user_data_id_for_update is not None:
                update_values["user_data_id"] = user_data_id_for_update

        try:
            result = (
                supabase.table("user_chat_threads")
                .update(update_values)
                .eq("id", conversation_id)
                .execute()
            )
            rows = result.data or []
            if not rows:
                secondary = (
                    supabase.table("user_chat_threads")
                    .select("id, title, created_at, updated_at")
                    .eq("id", conversation_id)
                    .limit(1)
                    .execute()
                )
                rows = secondary.data or []

            if rows:
                row = rows[0]
                return {
                    "id": _row_get(row, "id") or conversation_id,
                    "title": _row_get(row, "title"),
                    "created_at": _row_get(row, "created_at"),
                    "updated_at": _row_get(row, "updated_at"),
                }

            if payload.user_id is not None:
                seed_title = normalized_title or "New Conversation"
                if user_data_id_for_update is None:
                    user_data_id_for_update = _ensure_user_data_record(payload.user_id)
                if user_data_id_for_update is None:
                    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="User metadata storage is not available.")
                try:
                    created = (
                        supabase.table("user_chat_threads")
                        .insert(
                            {
                                "id": conversation_id,
                                "user_identifier": payload.user_id,
                                "user_data_id": user_data_id_for_update,
                                "title": seed_title,
                                "context_snapshot": [],
                                "metadata": {},
                                "created_at": updated_at_iso,
                                "updated_at": updated_at_iso,
                            }
                        )
                        .execute()
                    )
                    created_rows = created.data or []
                    if not created_rows:
                        fallback_created = (
                            supabase.table("user_chat_threads")
                            .select("id, title, created_at, updated_at")
                            .eq("id", conversation_id)
                            .limit(1)
                            .execute()
                        )
                        created_rows = fallback_created.data or []
                    if created_rows:
                        row = created_rows[0]
                        return {
                            "id": _row_get(row, "id") or conversation_id,
                            "title": _row_get(row, "title"),
                            "created_at": _row_get(row, "created_at"),
                            "updated_at": _row_get(row, "updated_at"),
                        }
                except Exception as error:
                    _handle_conversation_store_error("Error creating missing conversation", error)

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        except HTTPException:
            raise
        except Exception as error:
            _handle_conversation_store_error("Error updating conversation", error)
            storage_available = _conversation_store_available()
            # Fall back to local storage if possible

    fallback_payload = {
        "id": conversation_id,
        "title": normalized_title,
        "created_at": updated_at_iso,
        "updated_at": updated_at_iso,
    }

    if not storage_available:
        # Best-effort acknowledgement when conversation storage is disabled.
        return fallback_payload

    if not valid_conversation_id:
        app_logger.warning(
            "Received conversation metadata update with invalid identifier; acknowledging without persistence.",
            extra={"conversation_id": conversation_id}
        )
        return fallback_payload

    app_logger.warning(
        "Conversation metadata update failed after retries; acknowledging without persistence.",
        extra={"conversation_id": conversation_id, "user_id": payload.user_id}
    )
    return fallback_payload


@app.patch("/api/conversation/{conversation_id}")
async def update_conversation(conversation_id: str, payload: ConversationUpdateRequest):
    """Update conversation metadata such as its title."""
    return await _apply_conversation_update(conversation_id, payload)


@app.post("/api/conversation/{conversation_id}/metadata")
async def update_conversation_metadata(conversation_id: str, payload: ConversationUpdateRequest):
    """Update metadata via POST for clients that cannot rely on PATCH."""
    return await _apply_conversation_update(conversation_id, payload)

@app.get("/api/conversation/{conversation_id}/usage")
async def get_conversation_usage(conversation_id: str):
    """Get conversation usage statistics"""
    try:
        # Load the actual conversation history
        history = await _load_conversation_history(conversation_id)
        
        # Count messages
        message_count = len(history)
        
        # Better token estimation: use tiktoken if available, otherwise rough estimate
        try:
            import tiktoken
            encoding = tiktoken.get_encoding("cl100k_base")  # GPT-4/Gemini-compatible
            total_tokens = sum(
                len(encoding.encode(msg.get("text", "")))
                for msg in history
            )
        except (ImportError, Exception):
            # Fallback: improved estimation (more accurate than chars/4)
            # Average English word ~= 1.3 tokens, average word ~= 5 chars
            total_chars = sum(len(msg.get("text", "")) for msg in history)
            total_tokens = int(total_chars / 3.8)  # More accurate than /4
        
        # Determine context limit based on user tier
        # Extract user_id from conversation to lookup tier
        # Handle generic session ID gracefully
        if conversation_id == "general-session":
            # We can't determine the user from this ID alone, so we return default/empty usage
            # or we could try to get it from the request if we had auth context.
            # For now, return safe defaults.
            return {
                "conversation_id": conversation_id,
                "message_count": 0,
                "conversation_tokens": 0,
                "limit": 65_536, # Scout limit
                "provider": os.getenv("AI_PROVIDER", "gemini"),
                "model_name": os.getenv("AI_MODEL_NAME", None),
                "model_label": os.getenv("AI_MODEL_NAME", None),
                "user_tier": "scout",
            }

        # Extract user_id from conversation to lookup tier
        user_tier = "scout"  # Default
        try:
            # Case 1: General conversation (format: "general:123")
            if conversation_id.startswith("general:"):
                try:
                    user_id = int(conversation_id.split(":")[1])
                except (ValueError, IndexError):
                    user_id = None
            
            # Case 2: Thread conversation (UUID)
            else:
                # Get user_id from the conversation metadata in Supabase
                # Note: The column in user_chat_threads is 'user_identifier', not 'user_id'
                if supabase:
                    conv_result = supabase.table("user_chat_threads").select("user_identifier").eq("id", conversation_id).single().execute()
                    if conv_result and conv_result.data:
                        user_id = conv_result.data.get("user_identifier")
            
            # If we found a user_id, look up their tier
            if user_id:
                # Check if user_id is an int (SQLite/Postgres ID) or UUID (Supabase Auth ID)
                # The users table uses integer IDs for the primary key 'id'
                # If user_identifier is a string (UUID), we might need to query by auth_user_id
                
                # Try querying by ID first (assuming it's the integer ID)
                user_result = supabase.table("users").select("plan_tier").eq("id", user_id).single().execute()
                
                # If not found and it looks like a UUID, try auth_user_id? 
                # Actually, the system seems to use integer IDs for internal linking mostly.
                # Let's stick to ID for now as that's what the general chat uses.
                
                if user_result and user_result.data:
                    user_tier = (user_result.data.get("plan_tier") or "scout").lower()
                    
        except Exception as tier_error:
            app_logger.warning(f"Could not determine user tier for conversation {conversation_id}: {tier_error}")
        
        # Set context limits by tier
        TIER_CONTEXT_LIMITS = {
            "scout": 65_536,      # 64k tokens
            "voyager": 1_048_576, # 1M tokens (full context)
            "pioneer": 1_048_576, # 1M tokens (full context)
        }
        
        context_limit = TIER_CONTEXT_LIMITS.get(user_tier, TIER_CONTEXT_LIMITS["scout"])
        
        # Get provider info from environment
        provider = os.getenv("AI_PROVIDER", "gemini")
        model_name = os.getenv("AI_MODEL_NAME", None)
        
        return {
            "conversation_id": conversation_id,
            "message_count": message_count,
            "conversation_tokens": total_tokens,
            "limit": context_limit,
            "provider": provider,
            "model_name": model_name,
            "model_label": model_name,
            "user_tier": user_tier,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation usage: {str(e)}")

@app.post("/api/conversation/{conversation_id}/compress")
async def compress_conversation(conversation_id: str):
    """Compress a conversation by summarizing its history"""
    try:
        # Load the current conversation history
        history = await _load_conversation_history(conversation_id)
        
        if len(history) < 2:
            return {
                "success": False,
                "message": "Conversation too short to compress (need at least 2 messages)"
            }
        
        # Calculate original token count
        original_chars = sum(len(msg.get("text", "")) for msg in history)
        original_tokens = original_chars // 4
        
        # Create a summary prompt
        conversation_text = "\n\n".join([
            f"{msg.get('role', 'unknown').upper()}: {msg.get('text', '')}"
            for msg in history
        ])
        
        summary_prompt = f"""Please provide a concise summary of the following conversation, preserving all key information, decisions, and context. The summary should be detailed enough that the conversation can continue naturally from this point.

Conversation:
{conversation_text}

Summary:"""
        
        # Use Gemini to generate summary
        gemini = get_gemini_client()
        summary_response = await gemini.generate_text(
            prompt=summary_prompt,
            user_id=None,
            conversation_id=None,
            timezone="UTC"
        )
        
        summary_text = summary_response.get("text", "")
        
        if not summary_text:
            return {
                "success": False,
                "message": "Failed to generate summary"
            }
        
        # Create new compressed history with just the summary
        compressed_history = [
            {
                "role": "model",
                "text": f"[CONVERSATION SUMMARY]\n\n{summary_text}\n\n[END SUMMARY - Conversation continues below]"
            }
        ]
        
        # Save the compressed history
        await overwrite_conversation_history(
            conversation_id,
            ConversationHistoryPayload(messages=compressed_history)
        )
        
        # Calculate new token count
        new_chars = len(summary_text)
        new_tokens = new_chars // 4
        saved_tokens = original_tokens - new_tokens
        
        return {
            "success": True,
            "message": f"Conversation compressed! Reduced from {original_tokens} to {new_tokens} tokens (saved {saved_tokens} tokens)"
        }
    except Exception as e:
        api_logger.error(f"Error compressing conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error compressing conversation: {str(e)}")

# User endpoints
@app.post("/users/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: databases.Database = Depends(get_database)):
    initials = generate_initials(user.full_name)
    now = datetime.utcnow()
    query = users.insert().values(
        email=user.email,
        full_name=user.full_name,
        profile_picture_url=user.profile_picture_url,
        role=user.role,
        plan_tier=user.plan_tier,
        initials=initials,
        workspace_background_id=user.workspace_background_id,
        auth_user_id=user.auth_user_id,
        created_at=now,
        updated_at=now
    )
    user_id = await db.execute(query)

    # Seed default calendars (disabled – calendars are user generated now)
    default_calendars: List[Dict[str, str | bool]] = []

    calendar_ids: Dict[str, int] = {}
    for calendar in default_calendars:
        calendar_id = await db.execute(
            calendars.insert().values(
                user_id=user_id,
                label=calendar["label"],
                color=calendar["color"],
                is_visible=calendar["is_visible"],
                created_at=now,
                updated_at=now,
            )
        )
        calendar_ids[calendar["label"]] = calendar_id

    # Seed default calendar events (disabled – events are user generated now)
    default_events: List[Dict[str, str]] = []

    for event in default_events:
        calendar_id = calendar_ids.get(event["calendar_label"])
        if calendar_id is None:
            continue
        try:
            start_time = datetime.fromisoformat(event["start"])
            end_time = datetime.fromisoformat(event["end"])
        except ValueError:
            # Skip invalid event definitions rather than breaking user creation
            continue

        await db.execute(
            calendar_events.insert().values(
                user_id=user_id,
                calendar_id=calendar_id,
                title=event["title"],
                description=None,
                start_time=start_time,
                end_time=end_time,
                created_at=now,
            )
        )

    # Plans: no default placeholder data - users create their own

    # Habits: no default placeholder data - users create their own

    return {
        **user.dict(),
        "id": user_id,
        "initials": initials,
        "created_at": now,
        "updated_at": now
    }

@app.get("/users/email/{email}", response_model=User)
async def get_user_by_email(email: str, db: databases.Database = Depends(get_database)):
    query = users.select().where(users.c.email == email)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int, db: databases.Database = Depends(get_database)):
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/users/{user_id}", response_model=User)
async def update_user(user_id: int, user_update: UserUpdate, db: databases.Database = Depends(get_database)):
    # Get current user
    query = users.select().where(users.c.id == user_id)
    current_user = await db.fetch_one(query)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    update_data = user_update.dict(exclude_unset=True)
    if "full_name" in update_data:
        update_data["initials"] = generate_initials(update_data["full_name"])

    update_data["updated_at"] = datetime.utcnow()

    query = users.update().where(users.c.id == user_id).values(**update_data)
    await db.execute(query)

    # Return updated user
    query = users.select().where(users.c.id == user_id)
    return await db.fetch_one(query)


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(user_id: int, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    user_email = existing["email"]
    auth_user_id = existing["auth_user_id"] if "auth_user_id" in existing else None
    
    api_logger.info(f"Processing account deletion for user {user_id} ({user_email})", extra={"user_id": user_id, "email": user_email, "event_type": "account_deletion_start"})

    _delete_supabase_user_records(user_id)

    # Delete from Supabase Auth using the stored ID
    if supabase and SUPABASE_KEY_SOURCE in {"SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"}:
        try:
            if auth_user_id:
                supabase.auth.admin.delete_user(auth_user_id)
                api_logger.info(f"Deleted Supabase Auth user {auth_user_id}", extra={"user_id": user_id, "auth_user_id": auth_user_id})
            else:
                # Fallback to email search only if auth_id is missing (legacy users)
                api_logger.warning(f"auth_user_id missing for user {user_id}, attempting fallback search by email", extra={"user_id": user_id})
                auth_users_response = supabase.auth.admin.list_users()
                auth_users = getattr(auth_users_response, "users", []) or []
                
                found_id = None
                for auth_user in auth_users:
                     if hasattr(auth_user, "email") and auth_user.email == user_email:
                         found_id = auth_user.id
                         break
                
                if found_id:
                    supabase.auth.admin.delete_user(found_id)
                    api_logger.info(f"Deleted Supabase Auth user {found_id} (via fallback)", extra={"user_id": user_id, "auth_user_id": found_id})
                else:
                    api_logger.warning(f"Could not find Supabase Auth user for email {user_email}", extra={"user_id": user_id})
                
        except Exception as e:
            api_logger.error(f"Failed to delete Supabase Auth user: {e}", extra={"user_id": user_id, "error": str(e)})

    deletion_tables = [
        chat_sessions,
        calendar_events,
        calendars,
        plans,
        habits,
        reminders,
        dashboard_pulses,
        user_streaks,
        context_cache,
        file_search_stores,
        media_uploads,
        proactivity_logs,
        proactivity_settings,
        proactive_notifications,
        google_calendar_credentials,
        proactivity_push_subscriptions,
    ]

    for table in deletion_tables:
        await db.execute(table.delete().where(table.c.user_id == user_id))

    await db.execute(users.delete().where(users.c.id == user_id))
    
    api_logger.info(f"User account {user_id} deleted successfully", extra={"user_id": user_id, "event_type": "account_deletion_complete"})

@app.get("/users/{user_id}/chat-sessions", response_model=List[ChatSession])
async def get_user_chat_sessions(user_id: int, db: databases.Database = Depends(get_database)):
    query = chat_sessions.select().where(chat_sessions.c.user_id == user_id).order_by(chat_sessions.c.updated_at.desc())
    return await db.fetch_all(query)

@app.post("/users/{user_id}/chat-sessions", response_model=ChatSession, status_code=status.HTTP_201_CREATED)
async def create_chat_session(user_id: int, session: ChatSessionCreate, db: databases.Database = Depends(get_database)):
    query = chat_sessions.insert().values(
        user_id=user_id,
        title=session.title,
        scope="thread"
    )
    session_id = await db.execute(query)
    return {**session.dict(), "id": session_id, "user_id": user_id}

@app.get("/users/{user_id}/calendars", response_model=List[Calendar])
async def get_user_calendars(user_id: int, db: databases.Database = Depends(get_database)):
    query = calendars.select().where(calendars.c.user_id == user_id).order_by(calendars.c.created_at)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/calendars", response_model=Calendar, status_code=status.HTTP_201_CREATED)
async def create_calendar(user_id: int, calendar: CalendarCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    calendar_id = await db.execute(
        calendars.insert().values(
            user_id=user_id,
            label=calendar.label,
            color=calendar.color,
            is_visible=calendar.is_visible,
            created_at=now,
            updated_at=now,
        )
    )
    query = calendars.select().where(calendars.c.id == calendar_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/calendars/{calendar_id}", response_model=Calendar)
async def update_calendar(user_id: int, calendar_id: int, calendar_update: CalendarUpdate, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(
        calendars.select().where(
            (calendars.c.id == calendar_id) & (calendars.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Calendar not found")

    update_data = calendar_update.dict(exclude_unset=True)
    if not update_data:
        return existing

    update_data["updated_at"] = datetime.utcnow()

    await db.execute(
        calendars.update()
        .where((calendars.c.id == calendar_id) & (calendars.c.user_id == user_id))
        .values(**update_data)
    )
    query = calendars.select().where(calendars.c.id == calendar_id)
    return await db.fetch_one(query)

@app.get("/users/{user_id}/plans", response_model=List[Plan])
async def get_user_plans(
    user_id: int,
    limit: Optional[int] = Query(None, gt=0),
    db: databases.Database = Depends(get_database)
):
    if supabase:
        try:
            query = (
                supabase.table("plans")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=False)
            )
            if limit:
                query = query.limit(limit)
            result = query.execute()
            if result.data is not None:
                return result.data
        except Exception as error:
            _handle_supabase_table_error("Warning: Plans table not found or inaccessible", error)
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    if limit:
        query = query.limit(limit)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/plans", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(user_id: int, plan: PlanCreate, db: databases.Database = Depends(get_database)):
    base_values = {
        "user_id": user_id,
        "label": plan.label,
        "completed": plan.completed,
        "deadline": plan.deadline,
        "schedule_slot": plan.schedule_slot,
        "description": plan.description,
    }
    if supabase:
        timestamp = datetime.utcnow().isoformat()
        payload = {**base_values, "created_at": timestamp, "updated_at": timestamp}
        try:
            result = supabase.table("plans").insert(payload).execute()
            rows = getattr(result, "data", None) or []
            if isinstance(rows, list) and rows:
                return rows[0]
            if isinstance(rows, dict) and rows:
                return rows
            raise HTTPException(status_code=500, detail="Failed to create plan in Supabase: No data returned")
        except Exception as e:
            api_logger.error(f"Supabase plan creation failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to create plan in Supabase: {str(e)}")

    now = datetime.utcnow()
    plan_id = await db.execute(
        plans.insert().values(
            **base_values,
            created_at=now,
            updated_at=now,
        )
    )
    query = plans.select().where(plans.c.id == plan_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/plans/{plan_id}", response_model=Plan)
async def update_plan(user_id: int, plan_id: int, plan_update: PlanUpdate, db: databases.Database = Depends(get_database)):
    update_data = plan_update.dict(exclude_unset=True)
    if supabase:
        existing = (
            supabase.table("plans")
            .select("id")
            .eq("id", plan_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Plan not found")
        if not update_data:
            plan_record = (
                supabase.table("plans")
                .select("*")
                .eq("id", plan_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            record_rows = getattr(plan_record, "data", None) or []
            if isinstance(record_rows, list) and record_rows:
                return record_rows[0]
            if isinstance(record_rows, dict) and record_rows:
                return record_rows
            raise HTTPException(status_code=404, detail="Plan not found")
        update_payload = {
            **update_data,
            "updated_at": datetime.utcnow().isoformat(),
        }
        result = (
            supabase.table("plans")
            .update(update_payload)
            .eq("id", plan_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = getattr(result, "data", None) or []
        if isinstance(rows, list) and rows:
            return rows[0]
        if isinstance(rows, dict) and rows:
            return rows
    existing = await db.fetch_one(
        plans.select().where(
            (plans.c.id == plan_id) & (plans.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not update_data:
        return existing
    update_data["updated_at"] = datetime.utcnow()
    await db.execute(
        plans.update()
        .where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
        .values(**update_data)
    )
    query = plans.select().where(plans.c.id == plan_id)
    return await db.fetch_one(query)

@app.delete("/users/{user_id}/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(user_id: int, plan_id: int, db: databases.Database = Depends(get_database)):
    if supabase:
        existing = (
            supabase.table("plans")
            .select("id")
            .eq("id", plan_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Delete from plans table
        supabase.table("plans").delete().eq("id", plan_id).eq("user_id", user_id).execute()
        
        # Attempt to sync with dashboard_pulses (remove from today's pulse if present)
        try:
            today_key = datetime.utcnow().strftime("%Y-%m-%d")
            pulse_res = supabase.table("dashboard_pulses").select("*").eq("user_id", user_id).eq("date_key", today_key).execute()
            if pulse_res.data:
                pulse = pulse_res.data[0]
                current_plans = pulse.get("plans", []) or []
                # Filter out the deleted plan. Handle string/int mismatch.
                new_plans = [p for p in current_plans if str(p.get("id")) != str(plan_id)]
                
                if len(new_plans) != len(current_plans):
                    supabase.table("dashboard_pulses").update({
                        "plans": new_plans, 
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", pulse["id"]).execute()
                    api_logger.info(f"Synced plan deletion to dashboard_pulse for user {user_id}")
        except Exception as e:
            api_logger.warning(f"Failed to sync plan deletion to dashboard_pulses: {e}")
            
        return None
    query = plans.select().where(
        (plans.c.id == plan_id) & (plans.c.user_id == user_id)
    )
    existing = await db.fetch_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")
    delete_query = plans.delete().where(
        (plans.c.id == plan_id) & (plans.c.user_id == user_id)
    )
    await db.execute(delete_query)
    return None

@app.get("/users/{user_id}/habits", response_model=List[Habit])
async def get_user_habits(
    user_id: int,
    limit: Optional[int] = Query(None, gt=0),
    db: databases.Database = Depends(get_database)
):
    if supabase:
        try:
            query = (
                supabase.table("habits")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=False)
            )
            if limit:
                query = query.limit(limit)
            result = query.execute()
            if result.data is not None:
                return result.data
        except Exception as error:
            _handle_supabase_table_error("Warning: Habits table not found or inaccessible", error)
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    if limit:
        query = query.limit(limit)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/habits", response_model=Habit, status_code=status.HTTP_201_CREATED)
async def create_habit(user_id: int, habit: HabitCreate, db: databases.Database = Depends(get_database)):
    base_values = {
        "user_id": user_id,
        "label": habit.label,
        "streak_label": habit.streak_label,
        "previous_label": habit.previous_label,
        "description": habit.description,
    }
    if supabase:
        timestamp = datetime.utcnow().isoformat()
        payload = {**base_values, "created_at": timestamp, "updated_at": timestamp}
        try:
            result = supabase.table("habits").insert(payload).execute()
            rows = getattr(result, "data", None) or []
            if isinstance(rows, list) and rows:
                return rows[0]
            if isinstance(rows, dict) and rows:
                return rows
            raise HTTPException(status_code=500, detail="Failed to create habit in Supabase: No data returned")
        except Exception as e:
            api_logger.error(f"Supabase habit creation failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to create habit in Supabase: {str(e)}")

    now = datetime.utcnow()
    habit_id = await db.execute(
        habits.insert().values(
            **base_values,
            created_at=now,
            updated_at=now,
        )
    )
    query = habits.select().where(habits.c.id == habit_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/habits/{habit_id}", response_model=Habit)
async def update_habit(user_id: int, habit_id: int, habit_update: HabitUpdate, db: databases.Database = Depends(get_database)):
    update_data = habit_update.dict(exclude_unset=True)
    if supabase:
        existing = (
            supabase.table("habits")
            .select("id")
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Habit not found")
        if not update_data:
            habit_row = (
                supabase.table("habits")
                .select("*")
                .eq("id", habit_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            habit_rows = getattr(habit_row, "data", None) or []
            if isinstance(habit_rows, list) and habit_rows:
                return habit_rows[0]
            if isinstance(habit_rows, dict) and habit_rows:
                return habit_rows
            raise HTTPException(status_code=404, detail="Habit not found")
        update_payload = {
            **update_data,
            "updated_at": datetime.utcnow().isoformat(),
        }
        result = (
            supabase.table("habits")
            .update(update_payload)
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = getattr(result, "data", None) or []
        if isinstance(rows, list) and rows:
            return rows[0]
        if isinstance(rows, dict) and rows:
            return rows
            
        raise HTTPException(status_code=500, detail="Failed to update habit in Supabase")

    existing = await db.fetch_one(
        habits.select().where(
            (habits.c.id == habit_id) & (habits.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")
    if not update_data:
        return existing
    update_data["updated_at"] = datetime.utcnow()
    await db.execute(
        habits.update()
        .where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
        .values(**update_data)
    )
    query = habits.select().where(habits.c.id == habit_id)
    return await db.fetch_one(query)

@app.delete("/users/{user_id}/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(user_id: int, habit_id: int, db: databases.Database = Depends(get_database)):
    if supabase:
        existing = (
            supabase.table("habits")
            .select("id")
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Habit not found")
        
        # Delete from habits table
        supabase.table("habits").delete().eq("id", habit_id).eq("user_id", user_id).execute()
        
        # Attempt to sync with dashboard_pulses (remove from today's pulse if present)
        try:
            today_key = datetime.utcnow().strftime("%Y-%m-%d")
            pulse_res = supabase.table("dashboard_pulses").select("*").eq("user_id", user_id).eq("date_key", today_key).execute()
            if pulse_res.data:
                pulse = pulse_res.data[0]
                current_habits = pulse.get("habits", []) or []
                # Filter out the deleted habit.
                new_habits = [h for h in current_habits if str(h.get("id")) != str(habit_id)]
                
                if len(new_habits) != len(current_habits):
                    supabase.table("dashboard_pulses").update({
                        "habits": new_habits, 
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", pulse["id"]).execute()
                    api_logger.info(f"Synced habit deletion to dashboard_pulse for user {user_id}")
        except Exception as e:
            api_logger.warning(f"Failed to sync habit deletion to dashboard_pulses: {e}")
            
        return None
    query = habits.select().where(
        (habits.c.id == habit_id) & (habits.c.user_id == user_id)
    )
    existing = await db.fetch_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")
    delete_query = habits.delete().where(
        (habits.c.id == habit_id) & (habits.c.user_id == user_id)
    )
    await db.execute(delete_query)
    return None

@app.get("/users/{user_id}/streak", response_model=UserStreak)
async def get_user_streak(user_id: int, db: databases.Database = Depends(get_database)):
    streak = await get_or_create_user_streak(user_id, db)
    return streak

@app.post("/users/{user_id}/streak", response_model=UserStreak)
async def touch_user_streak(user_id: int, db: databases.Database = Depends(get_database)):
    return await update_user_streak(user_id, db)

@app.get("/users/{user_id}/calendar-events", response_model=List[CalendarEvent])
async def get_user_calendar_events(
    user_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: databases.Database = Depends(get_database)
):
    # Supabase-first for calendar events.
    if supabase:
        try:
            query = supabase.table("calendar_events").select("*").eq("user_id", user_id)
            
            if start_date:
                query = query.gte("start_time", start_date)
            if end_date:
                query = query.lte("end_time", end_date)
                
            result = query.order("start_time", desc=False).execute()
            rows = result.data or []
            now = datetime.utcnow().isoformat()
            normalized = []
            for row in rows:
                record = dict(row)
                if record.get("created_at") is None:
                    record["created_at"] = now
                normalized.append(record)
            return normalized
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to fetch calendar events from Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    query = calendar_events.select().where(calendar_events.c.user_id == user_id)
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.where(calendar_events.c.start_time >= start_dt)
        except ValueError:
            pass
            
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.where(calendar_events.c.end_time <= end_dt)
        except ValueError:
            pass

    query = query.order_by(calendar_events.c.start_time)
    rows = await db.fetch_all(query)
    now = datetime.utcnow()
    normalized = []
    for row in rows:
        record = dict(row)
        if record.get("created_at") is None:
            record["created_at"] = now
        normalized.append(record)
    return normalized


def _serialize_reminder_row(row: Any) -> Dict[str, Any]:
  record = dict(row)
  for key in ("remind_at", "created_at", "updated_at", "delivered_at"):
      value = record.get(key)
      if isinstance(value, datetime):
          record[key] = value.isoformat()
  return record


@app.get("/users/{user_id}/reminders", response_model=List[Dict[str, Any]])
async def list_user_reminders(
    user_id: int,
    limit: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = None,
    delivery_mode: Optional[str] = None,
    entity_type: Optional[str] = None,
    include_archived: bool = Query(False),
    db: databases.Database = Depends(get_database),
):
    if supabase:
        try:
            builder = (
                supabase.table("reminders")
                .select("*")
                .eq("user_id", user_id)
            )
            if status_filter:
                builder = builder.eq("status", status_filter)
            elif not include_archived:
                builder = builder.in_("status", ["pending", "delivered"])
            if delivery_mode:
                builder = builder.eq("delivery_mode", delivery_mode)
            if entity_type:
                builder = builder.eq("entity_type", entity_type)
            builder = builder.order("remind_at", desc=False)
            if limit is not None:
                builder = builder.limit(limit)
            result = builder.execute()
            
            rows = result.data if result.data is not None else []

            # Self-healing: Auto-DELETE stale pending reminders to prevent loop
            # Only delete reminders that haven't been delivered yet (delivered_at is None)
            if status_filter == "pending" and rows:
                now = datetime.utcnow()
                stale_threshold = now - timedelta(minutes=15)
                stale_ids = []
                for row in rows:
                    try:
                        remind_at_str = row.get("remind_at")
                        delivered_at = row.get("delivered_at")
                        # Only delete if it hasn't been delivered before
                        if remind_at_str and not delivered_at:
                            remind_at = datetime.fromisoformat(remind_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
                            if remind_at < stale_threshold:
                                stale_ids.append(row["id"])
                    except (ValueError, TypeError):
                        continue
                
                if stale_ids:
                    # Delete stale reminders completely instead of marking as delivered
                    try:
                        api_logger.info(f"Auto-deleting {len(stale_ids)} stale reminders", extra={"user_id": user_id, "reminder_ids": stale_ids})
                        supabase.table("reminders").delete().in_("id", stale_ids).execute()
                        # Filter out the deleted reminders from the response
                        rows = [row for row in rows if row["id"] not in stale_ids]
                    except Exception as e:
                        api_logger.error(f"Failed to auto-delete stale reminders: {e}")

            return [_serialize_reminder_row(row) for row in rows]
        except Exception as error:
            _handle_supabase_table_error("Warning: Reminders table not found or inaccessible", error)

    query = reminders.select().where(reminders.c.user_id == user_id)

    if status_filter:
        query = query.where(reminders.c.status == status_filter)
    elif not include_archived:
        query = query.where(reminders.c.status.in_(["pending", "delivered"]))

    if delivery_mode:
        query = query.where(reminders.c.delivery_mode == delivery_mode)

    if entity_type:
        query = query.where(reminders.c.entity_type == entity_type)

    query = query.order_by(reminders.c.remind_at.asc())

    if limit is not None:
        query = query.limit(limit)

    rows = await db.fetch_all(query)
    return [_serialize_reminder_row(row) for row in rows]


@app.post(
    "/users/{user_id}/reminders",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
async def create_user_reminder(
    user_id: int,
    payload: ReminderCreate,
    db: databases.Database = Depends(get_database),
):
    now = datetime.utcnow()
    values = {
        "user_id": user_id,
        "label": payload.label,
        "description": payload.description,
        "summary": payload.summary,
        "remind_at": payload.remind_at.isoformat(),
        "entity_type": payload.entity_type,
        "entity_id": payload.entity_id,
        "delivery_mode": payload.delivery_mode,
        "metadata": payload.metadata,
        "status": "pending",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    if supabase:
        try:
            result = supabase.table("reminders").insert(values).execute()
            rows = getattr(result, "data", None) or []
            if isinstance(rows, list) and rows:
                return _serialize_reminder_row(rows[0])
            if isinstance(rows, dict) and rows:
                return _serialize_reminder_row(rows)
            raise HTTPException(status_code=500, detail="Failed to create reminder in Supabase: No data returned")
        except Exception as error:
            api_logger.error(f"Supabase reminder creation failed: {error}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to create reminder in Supabase: {str(error)}")

    sqlite_values = {
        **values,
        "remind_at": payload.remind_at,
        "created_at": now,
        "updated_at": now,
    }
    reminder_id = await db.execute(reminders.insert().values(sqlite_values))
    row = await db.fetch_one(reminders.select().where(reminders.c.id == reminder_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create reminder")
    return _serialize_reminder_row(row)


@app.patch("/users/{user_id}/reminders/{reminder_id}", response_model=Dict[str, Any])
async def update_user_reminder(
    user_id: int,
    reminder_id: int,
    payload: ReminderUpdate,
    db: databases.Database = Depends(get_database),
):
    update_values: Dict[str, Any] = {}
    if payload.label is not None:
        update_values["label"] = payload.label
    if payload.description is not None:
        update_values["description"] = payload.description
    if payload.summary is not None:
        update_values["summary"] = payload.summary
    if payload.remind_at is not None:
        update_values["remind_at"] = payload.remind_at.isoformat()
    if payload.status is not None:
        update_values["status"] = payload.status
    if payload.delivery_mode is not None:
        update_values["delivery_mode"] = payload.delivery_mode
    if payload.metadata is not None:
        update_values["metadata"] = payload.metadata

    if supabase:
        try:
            existing = (
                supabase.table("reminders")
                .select("*")
                .eq("id", reminder_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if not existing.data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
            if not update_values:
                return _serialize_reminder_row(existing.data)
            update_payload = {
                **update_values,
                "updated_at": datetime.utcnow().isoformat(),
            }
            result = (
                supabase.table("reminders")
                .update(update_payload)
                .eq("id", reminder_id)
                .eq("user_id", user_id)
                .execute()
            )
            rows = getattr(result, "data", None) or []
            if isinstance(rows, list) and rows:
                return _serialize_reminder_row(rows[0])
            if isinstance(rows, dict) and rows:
                return _serialize_reminder_row(rows)
            
            # If Supabase returns no data, it implies failure to update (likely permission or not found)
            api_logger.error(f"Supabase update returned no data for reminder {reminder_id}", extra={"user_id": user_id})
            raise HTTPException(status_code=500, detail="Failed to update reminder in Supabase (no data returned)")
        except HTTPException:
            raise
        except Exception as error:
            api_logger.error(f"Supabase update failed: {error}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Supabase update failed: {str(error)}")

    existing = await db.fetch_one(
        reminders.select().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    if not update_values:
        return _serialize_reminder_row(existing)

    update_values["updated_at"] = datetime.utcnow()

    await db.execute(
        reminders.update()
        .where(reminders.c.id == reminder_id, reminders.c.user_id == user_id)
        .values(**update_values)
    )
    row = await db.fetch_one(
        reminders.select().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found after update")
    return _serialize_reminder_row(row)


@app.delete(
    "/users/{user_id}/reminders/{reminder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user_reminder(
    user_id: int,
    reminder_id: int,
    db: databases.Database = Depends(get_database),
):
    api_logger.info(f"DELETE reminder request: user_id={user_id}, reminder_id={reminder_id}")
    if supabase:
        try:
            existing = (
                supabase.table("reminders")
                .select("id")
                .eq("id", reminder_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not existing.data:
                api_logger.warning(f"Reminder {reminder_id} not found for user {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
            
            api_logger.info(f"Deleting reminder {reminder_id} from Supabase")
            result = supabase.table("reminders").delete().eq("id", reminder_id).eq("user_id", user_id).execute()
            api_logger.info(f"Successfully deleted reminder {reminder_id}, result: {result.data}")
            
            # Verify deletion
            check = supabase.table("reminders").select("id").eq("id", reminder_id).execute()
            if check.data:
                api_logger.error(f"Reminder {reminder_id} still exists after deletion attempt!")
                raise HTTPException(status_code=500, detail="Failed to delete reminder (persistence error)")
                
            return
        except HTTPException:
            raise
        except Exception as error:
            api_logger.error(f"Failed to delete reminder {reminder_id}: {error}", exc_info=True)
            _handle_supabase_table_error("Warning: Failed to delete reminder", error)

    existing = await db.fetch_one(
        reminders.select().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    await db.execute(
        reminders.delete().where(
            reminders.c.id == reminder_id,
            reminders.c.user_id == user_id,
        )
    )


@app.get("/users/{user_id}/conversations", response_model=List[Dict[str, Any]])
async def list_user_conversations(
    user_id: int,
    limit: int = Query(100, ge=1, le=500),
):
    if not _conversation_store_available():
        return []

    try:
        result = (
            supabase.table("user_chat_threads")
            .select("id, title, created_at, updated_at, last_message_at")
            .eq("user_identifier", user_id)
            .order("last_message_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = result.data or []
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            normalized.append(
                {
                    "id": _row_get(row, "id"),
                    "title": _row_get(row, "title"),
                    "created_at": _row_get(row, "created_at"),
                    "updated_at": _row_get(row, "updated_at"),
                    "last_message_at": _row_get(row, "last_message_at"),
                }
            )
        return normalized
    except Exception as error:
        _handle_conversation_store_error("Warning: Conversations table not found or inaccessible", error)
        return []

@app.post("/users/{user_id}/calendar-events", response_model=CalendarEvent, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(user_id: int, event: CalendarEventCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    # Supabase-first create.
    if supabase:
        try:
            payload = {
                "user_id": user_id,
                "calendar_id": event.calendar_id,
                "title": event.title,
                "description": event.description,
                "start_time": event.start_time.isoformat(),
                "end_time": event.end_time.isoformat(),
                "created_at": now.isoformat(),
            }
            result = supabase.table("calendar_events").insert(payload).execute()
            data = result.data if isinstance(result.data, list) else [result.data]
            if data:
                return data[0]
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to create calendar event in Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    event_id = await db.execute(
        calendar_events.insert().values(
            user_id=user_id,
            calendar_id=event.calendar_id,
            title=event.title,
            description=event.description,
            start_time=event.start_time,
            end_time=event.end_time,
            created_at=now,
        )
    )
    query = calendar_events.select().where(calendar_events.c.id == event_id)
    return await db.fetch_one(query)


@app.patch("/users/{user_id}/calendar-events/{event_id}", response_model=CalendarEvent)
async def update_calendar_event(
    user_id: int,
    event_id: int,
    event_update: CalendarEventUpdate,
    db: databases.Database = Depends(get_database),
):
    update_data = event_update.dict(exclude_unset=True)

    if supabase:
        try:
            existing = (
                supabase.table("calendar_events")
                .select("*")
                .eq("id", event_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            # If Supabase has no record, fall back to SQLite without raising; the event
            # may be stored only in the local DB.
            if not existing.data:
                existing = None  # type: ignore[assignment]
            elif not update_data:
                return existing.data

            if update_data:
                # Work on a copy so the SQLite fallback still receives datetime objects.
                supabase_update: Dict[str, Any] = dict(update_data)
                if "start_time" in supabase_update and isinstance(supabase_update["start_time"], datetime):
                    supabase_update["start_time"] = supabase_update["start_time"].isoformat()
                if "end_time" in supabase_update and isinstance(supabase_update["end_time"], datetime):
                    supabase_update["end_time"] = supabase_update["end_time"].isoformat()

                update_payload = {
                    **supabase_update,
                }
                result = (
                    supabase.table("calendar_events")
                    .update(update_payload)
                    .eq("id", event_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                rows = getattr(result, "data", None) or []
                if isinstance(rows, list) and rows:
                    return rows[0]
                if isinstance(rows, dict) and rows:
                    return rows
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to update calendar event {event_id} for user {user_id}",
                error,
            )

    # Filter out fields that don't exist on the local SQLite table (for example, "color").
    allowed_sqlite_keys = set(calendar_events.c.keys())
    sqlite_update_data = {
        key: value for key, value in update_data.items() if key in allowed_sqlite_keys
    }

    existing = await db.fetch_one(
        calendar_events.select().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    if not sqlite_update_data:
        return existing

    await db.execute(
        calendar_events.update()
        .where((calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id))
        .values(**sqlite_update_data)
    )
    query = calendar_events.select().where(calendar_events.c.id == event_id)
    updated = await db.fetch_one(query)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    return updated


@app.delete("/users/{user_id}/calendar-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    user_id: int,
    event_id: int,
    db: databases.Database = Depends(get_database),
):
    if supabase:
        try:
            existing = (
                supabase.table("calendar_events")
                .select("id")
                .eq("id", event_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            # If Supabase has no record, fall back to SQLite without raising; the event
            # may be stored only in the local DB.
            if existing.data:
                supabase.table("calendar_events").delete().eq("id", event_id).eq("user_id", user_id).execute()
                return None
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to delete calendar event {event_id} for user {user_id}",
                error,
            )

    existing = await db.fetch_one(
        calendar_events.select().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    await db.execute(
        calendar_events.delete().where(
            (calendar_events.c.id == event_id) & (calendar_events.c.user_id == user_id)
        )
    )
    return None


# Dashboard API endpoints
@app.get("/users/{user_id}/dashboard/pulses", response_model=List[DashboardPulse])
async def list_dashboard_pulses(
    user_id: int,
    limit: int = MAX_DASHBOARD_PULSE_HISTORY,
    db: databases.Database = Depends(get_database),
):
    safe_limit = max(1, min(limit, MAX_DASHBOARD_PULSE_HISTORY))

    records: List[Any] = []
    # Prefer Supabase when available.
    if supabase:
        try:
            result = (
                supabase.table("dashboard_pulses")
                .select("*")
                .eq("user_id", user_id)
                .order("date_key", desc=True)
                .limit(safe_limit)
                .execute()
            )
            records = result.data or []
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to list dashboard pulses from Supabase for user {user_id}",
                error,
            )

    if not records:
        query = (
            dashboard_pulses.select()
            .where(dashboard_pulses.c.user_id == user_id)
            .order_by(dashboard_pulses.c.date_key.desc())
            .limit(safe_limit)
        )
        records = await db.fetch_all(query)
    pulses: List[DashboardPulse] = []
    for record in records:
        payload = _serialize_dashboard_pulse_record(record)
        if not payload:
            continue
        pulses.append(DashboardPulse(**payload))
    return pulses


@app.get("/users/{user_id}/dashboard/pulses/{date_key}", response_model=DashboardPulse)
async def get_dashboard_pulse(
    user_id: int,
    date_key: str,
    db: databases.Database = Depends(get_database),
):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date key; expected YYYY-MM-DD")

    record = await _load_dashboard_pulse_by_date(db, user_id, date_key)
    payload = _serialize_dashboard_pulse_record(record)
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")
    return DashboardPulse(**payload)


@app.post("/users/{user_id}/dashboard/pulses", response_model=DashboardPulse, status_code=status.HTTP_201_CREATED)
async def create_dashboard_pulse(
    user_id: int,
    pulse: DashboardPulseCreate,
    db: databases.Database = Depends(get_database),
):
    timestamp_dt = _timestamp_ms_to_datetime(pulse.timestamp)
    plans_payload = _normalize_plan_items([item.dict() for item in pulse.plans])
    habits_payload = _normalize_habit_items([item.dict() for item in pulse.habits])
    proactivity_payload = _normalize_proactivity(pulse.proactivity.dict())

    if pulse.carry_forward:
        previous_record = await _load_previous_dashboard_pulse(db, user_id, pulse.date_key)
        previous_serialized = _serialize_dashboard_pulse_record(previous_record)
        plans_payload, habits_payload = _carry_forward_dashboard_entries(
            previous_serialized or {"plans": [], "habits": []},
            plans_payload,
            habits_payload,
        )

    now = datetime.utcnow()

    # Supabase-first implementation.
    if supabase:
        try:
            existing = await _load_dashboard_pulse_by_date(db, user_id, pulse.date_key)
            if existing and isinstance(existing, dict):
                pulse_id = existing.get("id")
                update_payload = {
                    "timestamp": timestamp_dt.isoformat(),
                    "plans": plans_payload,
                    "habits": habits_payload,
                    "proactivity": proactivity_payload,
                    "updated_at": now.isoformat(),
                }
                result = (
                    supabase.table("dashboard_pulses")
                    .update(update_payload)
                    .eq("id", pulse_id)
                    .eq("user_id", user_id)
                    .select("*")
                    .single()
                    .execute()
                )
                record = result.data
            else:
                insert_payload = {
                    "user_id": user_id,
                    "date_key": pulse.date_key,
                    "timestamp": timestamp_dt.isoformat(),
                    "plans": plans_payload,
                    "habits": habits_payload,
                    "proactivity": proactivity_payload,
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }
                result = (
                    supabase.table("dashboard_pulses")
                    .insert(insert_payload)
                    .select("*")
                    .single()
                    .execute()
                )
                record = result.data

            payload = _serialize_dashboard_pulse_record(record)
            if not payload:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to persist dashboard pulse",
                )
            return DashboardPulse(**payload)
        except HTTPException:
            raise
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to create dashboard pulse in Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    existing = await _load_dashboard_pulse_by_date(db, user_id, pulse.date_key)

    if existing:
        await db.execute(
            dashboard_pulses.update()
            .where(dashboard_pulses.c.id == existing["id"])
            .values(
                timestamp=timestamp_dt,
                plans=plans_payload,
                habits=habits_payload,
                proactivity=proactivity_payload,
                updated_at=now,
            )
        )
        record = await db.fetch_one(
            dashboard_pulses.select().where(dashboard_pulses.c.id == existing["id"])
        )
    else:
        pulse_id = await db.execute(
            dashboard_pulses.insert().values(
                user_id=user_id,
                date_key=pulse.date_key,
                timestamp=timestamp_dt,
                plans=plans_payload,
                habits=habits_payload,
                proactivity=proactivity_payload,
                created_at=now,
                updated_at=now,
            )
        )
        record = await db.fetch_one(
            dashboard_pulses.select().where(dashboard_pulses.c.id == pulse_id)
        )

    payload = _serialize_dashboard_pulse_record(record)
    if not payload:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist dashboard pulse")
    return DashboardPulse(**payload)


@app.put("/users/{user_id}/dashboard/pulses/{pulse_id}", response_model=DashboardPulse)
async def update_dashboard_pulse(
    user_id: int,
    pulse_id: int,
    pulse_update: DashboardPulseUpdate,
    db: databases.Database = Depends(get_database),
):
    existing: Any = None
    # Supabase-first lookup.
    if supabase:
        try:
            result = (
                supabase.table("dashboard_pulses")
                .select("*")
                .eq("id", pulse_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            if rows:
                existing = rows[0]
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to load dashboard pulse from Supabase for user {user_id}",
                error,
            )

    if existing is None:
        existing = await db.fetch_one(
            dashboard_pulses.select().where(
                (dashboard_pulses.c.id == pulse_id) & (dashboard_pulses.c.user_id == user_id)
            )
        )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")
    update_data: Dict[str, Any] = {}
    if pulse_update.timestamp is not None:
        update_data["timestamp"] = _timestamp_ms_to_datetime(pulse_update.timestamp)
    if pulse_update.plans is not None:
        update_data["plans"] = _normalize_plan_items([item.dict() for item in pulse_update.plans])
    if pulse_update.habits is not None:
        update_data["habits"] = _normalize_habit_items([item.dict() for item in pulse_update.habits])
    if pulse_update.proactivity is not None:
        update_data["proactivity"] = _normalize_proactivity(pulse_update.proactivity.dict())

    if not update_data:
        payload = _serialize_dashboard_pulse_record(existing)
        if not payload:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load dashboard pulse")
        return DashboardPulse(**payload)

    # Supabase-first update path.
    if supabase:
        try:
            update_payload = {
                **update_data,
                "updated_at": datetime.utcnow().isoformat(),
            }
            result = (
                supabase.table("dashboard_pulses")
                .update(update_payload)
                .eq("id", pulse_id)
                .eq("user_id", user_id)
                .select("*")
                .single()
                .execute()
            )
            record = result.data
            payload = _serialize_dashboard_pulse_record(record)
            if not payload:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update dashboard pulse",
                )
            return DashboardPulse(**payload)
        except HTTPException:
            raise
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to update dashboard pulse in Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    update_data["updated_at"] = datetime.utcnow()
    await db.execute(
        dashboard_pulses.update()
        .where(dashboard_pulses.c.id == pulse_id)
        .values(**update_data)
    )
    record = await db.fetch_one(dashboard_pulses.select().where(dashboard_pulses.c.id == pulse_id))
    payload = _serialize_dashboard_pulse_record(record)
    if not payload:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update dashboard pulse")
    return DashboardPulse(**payload)


@app.delete("/users/{user_id}/dashboard/pulses/{pulse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_pulse(
    user_id: int,
    pulse_id: int,
    db: databases.Database = Depends(get_database),
):
    # Supabase-first delete.
    if supabase:
        try:
            existing = (
                supabase.table("dashboard_pulses")
                .select("id")
                .eq("id", pulse_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            rows = existing.data or []
            if not rows:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")
            supabase.table("dashboard_pulses").delete().eq("id", pulse_id).eq("user_id", user_id).execute()
            return None
        except HTTPException:
            raise
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to delete dashboard pulse in Supabase for user {user_id}",
                error,
            )

    existing = await db.fetch_one(
        dashboard_pulses.select().where(
            (dashboard_pulses.c.id == pulse_id) & (dashboard_pulses.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pulse entry not found")

    await db.execute(
        dashboard_pulses.delete().where(dashboard_pulses.c.id == pulse_id)
    )
    return None


@app.get("/users/{user_id}/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    user_id: int,
    db: databases.Database = Depends(get_database),
):
    pulse_records: List[Any] = []
    # Supabase-first for dashboard pulses.
    if supabase:
        try:
            result = (
                supabase.table("dashboard_pulses")
                .select("*")
                .eq("user_id", user_id)
                .order("date_key", desc=True)
                .limit(MAX_DASHBOARD_PULSE_HISTORY)
                .execute()
            )
            pulse_records = result.data or []
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to fetch dashboard pulses from Supabase for user {user_id}",
                error,
            )

    if not pulse_records:
        pulses_query = (
            dashboard_pulses.select()
            .where(dashboard_pulses.c.user_id == user_id)
            .order_by(dashboard_pulses.c.date_key.desc())
            .limit(MAX_DASHBOARD_PULSE_HISTORY)
        )
        pulse_records = await db.fetch_all(pulses_query)

    pulse_items: List[DashboardPulse] = []
    for record in pulse_records:
        payload = _serialize_dashboard_pulse_record(record)
        if not payload:
            continue
        pulse_items.append(DashboardPulse(**payload))

    today_key = datetime.utcnow().strftime("%Y-%m-%d")
    today_entry = next((pulse for pulse in pulse_items if pulse.date_key == today_key), None)
    recent_entries = pulse_items[:7]

    # Supabase-first for proactivity logs.
    proactivity_records: List[Any] = []
    if supabase:
        try:
            result = (
                supabase.table("proactivity_logs")
                .select("*")
                .eq("user_id", user_id)
                .order("activity_date", desc=True)
                .limit(10)
                .execute()
            )
            proactivity_records = result.data or []
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to fetch proactivity logs from Supabase for user {user_id}",
                error,
            )

    if not proactivity_records:
        proactivity_records = await db.fetch_all(
            proactivity_logs.select()
            .where(proactivity_logs.c.user_id == user_id)
            .order_by(proactivity_logs.c.activity_date.desc())
            .limit(10)
        )
    proactivity_logs_payload: List[ProactivityLog] = []
    for record in proactivity_records:
        proactivity_logs_payload.append(
            ProactivityLog(
                id=record["id"],
                user_id=record["user_id"],
                activity_date=record["activity_date"],
                tasks_completed=record["tasks_completed"],
                total_tasks=record["total_tasks"],
                score=record["score"],
                notes=record["notes"],
                created_at=record["created_at"],
                updated_at=record["updated_at"],
            )
        )

    streak = await _compute_proactivity_streak(db, user_id)

    return DashboardSummary(
        today=today_entry,
        recent=recent_entries,
        pulses=pulse_items,
        proactivity=DashboardProactivitySummary(
            logs=proactivity_logs_payload,
            streak=streak,
        ),
    )


# Proactivity API endpoints
@app.get("/users/{user_id}/proactivity", response_model=List[ProactivityLog])
async def get_user_proactivity(user_id: int, db: databases.Database = Depends(get_database)):
    """Get user's proactivity logs"""
    from datetime import datetime

    query = proactivity_logs.select().where(proactivity_logs.c.user_id == user_id).order_by(proactivity_logs.c.activity_date.desc())
    results = await db.fetch_all(query)

    # Fix null timestamps for response
    formatted_results = []
    for result in results:
        formatted_results.append({
            "id": result.id,
            "user_id": result.user_id,
            "activity_date": result.activity_date,
            "tasks_completed": result.tasks_completed,
            "total_tasks": result.total_tasks,
            "score": result.score,
            "notes": result.notes,
            "created_at": result.created_at if result.created_at else datetime.utcnow(),
            "updated_at": result.updated_at if result.updated_at else datetime.utcnow()
        })

    return formatted_results


@app.get("/users/{user_id}/proactivity/stream")
async def stream_user_proactivity(user_id: int):
    """
    SSE endpoint used by /g so active sessions can trigger evaluations and get notified.
    """
    global proactivity_engine, proactivity_realtime_broker

    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")

    queue = await proactivity_realtime_broker.register(user_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            yield _sse_event("ready", {"user_id": user_id})
            # For realtime sessions, respect the duplicate guard so reconnects
            # (e.g., on backend restarts) don't re-send the same ping each time.
            await proactivity_engine.dispatch_user_if_due(user_id, source="realtime")

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=25)
                except asyncio.TimeoutError:
                    yield _sse_event("ping", {"user_id": user_id})
                    continue

                if not isinstance(payload, dict):
                    continue
                event_name = payload.get("event") or "message"
                yield _sse_event(event_name, payload)
        finally:
            await proactivity_realtime_broker.unregister(user_id, queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@app.post("/users/{user_id}/proactivity", response_model=ProactivityLog, status_code=status.HTTP_201_CREATED)
async def create_proactivity_log(user_id: int, proactivity: ProactivityLogCreate, db: databases.Database = Depends(get_database)):
    """Create a new proactivity log entry"""
    # Calculate score based on tasks completed vs total tasks
    score = min(100, (proactivity.tasks_completed / max(proactivity.total_tasks, 1)) * 100) if proactivity.total_tasks > 0 else 0
    query = proactivity_logs.insert().values(
        user_id=user_id,
        activity_date=datetime.utcnow(),
        tasks_completed=proactivity.tasks_completed,
        total_tasks=proactivity.total_tasks,
        score=score,
        notes=proactivity.notes
    )
    log_id = await db.execute(query)
    result = await db.fetch_one(proactivity_logs.select().where(proactivity_logs.c.id == log_id))
    return {
        "id": result.id,
        "user_id": result.user_id,
        "activity_date": result.activity_date,
        "tasks_completed": result.tasks_completed,
        "total_tasks": result.total_tasks,
        "score": result.score,
        "notes": result.notes,
        "created_at": result.created_at,
        "updated_at": result.updated_at,
    }


@app.get("/users/{user_id}/proactivity/deliveries")
async def list_proactivity_deliveries(user_id: int, db: databases.Database = Depends(get_database)):
    """
    Return recent proactivity deliveries for a user so the client can hydrate
    which time slots have already fired.
    """
    now = datetime.utcnow()
    since = now - timedelta(days=1)

    # Prefer Supabase for proactivity deliveries when available.
    if supabase:
        try:
            result = (
                supabase.table("proactive_notifications")
                .select("sent_at")
                .eq("user_id", user_id)
                .eq("type", "check_in")
                .gte("sent_at", since.isoformat())
                .order("sent_at", desc=False)
                .execute()
            )
            rows = result.data or []
            sent_at_values = []
            for row in rows:
                value = row.get("sent_at")
                if isinstance(value, datetime):
                    sent_at_values.append(value.isoformat())
                elif isinstance(value, str):
                    sent_at_values.append(value)
            return {"sent_at": sent_at_values}
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to load proactivity deliveries from Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    query = """
        SELECT sent_at
        FROM proactive_notifications
        WHERE user_id = :user_id
          AND type = :type
          AND sent_at >= :since
        ORDER BY sent_at ASC
    """
    rows = await db.fetch_all(query, {"user_id": user_id, "type": "check_in", "since": since})
    sent_at_values = []
    for row in rows:
        value = row["sent_at"]
        if isinstance(value, datetime):
            sent_at_values.append(value.isoformat())
        elif isinstance(value, str):
            sent_at_values.append(value)
    return {"sent_at": sent_at_values}


@app.post("/users/{user_id}/proactivity/subscription", status_code=status.HTTP_204_NO_CONTENT)
async def upsert_proactivity_push_subscription(
    user_id: int,
    subscription: Dict[str, Any],
    db: databases.Database = Depends(get_database),
):
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth_key = keys.get("auth")

    if not endpoint or not p256dh or not auth_key:
        raise HTTPException(status_code=400, detail="Invalid subscription payload")

    query_existing = proactivity_push_subscriptions.select().where(
        (proactivity_push_subscriptions.c.user_id == user_id)
        & (proactivity_push_subscriptions.c.endpoint == endpoint)
    )
    existing = await db.fetch_one(query_existing)

    if existing:
        update_query = (
            proactivity_push_subscriptions.update()
            .where(proactivity_push_subscriptions.c.id == existing["id"])
            .values(p256dh=p256dh, auth=auth_key, updated_at=datetime.utcnow())
        )
        await db.execute(update_query)
    else:
        insert_query = proactivity_push_subscriptions.insert().values(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth_key,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await db.execute(insert_query)

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/users/{user_id}/proactivity/daily-checkin", response_model=ProactivityLog)
async def daily_proactivity_checkin(
    user_id: int,
    checkin: DailyCheckIn,
    db: databases.Database = Depends(get_database)
):
    """Daily proactivity check-in - creates or updates today's proactivity log"""
    from datetime import datetime, time

    today = datetime.utcnow().date()
    
    if supabase:
        try:
            # Define "today" range for Supabase timestamp comparison
            start_of_day = datetime.combine(today, time.min).isoformat()
            end_of_day = datetime.combine(today, time.max).isoformat()

            # Check for existing log in Supabase
            result = (
                supabase.table("proactivity_logs")
                .select("*")
                .eq("user_id", user_id)
                .gte("activity_date", start_of_day)
                .lte("activity_date", end_of_day)
                .limit(1)
                .execute()
            )
            rows = getattr(result, "data", None) or []
            
            score = min(100, (checkin.tasks_completed / max(checkin.total_tasks, 1)) * 100) if checkin.total_tasks > 0 else 0
            now = datetime.utcnow().isoformat()

            if rows:
                existing_id = rows[0]['id']
                # Update existing
                update_resp = supabase.table("proactivity_logs").update({
                    "tasks_completed": checkin.tasks_completed,
                    "total_tasks": checkin.total_tasks,
                    "score": score,
                    "notes": checkin.notes,
                    "updated_at": now
                }).eq("id", existing_id).select().execute()
                
                updated_rows = getattr(update_resp, "data", None) or []
                if updated_rows:
                    return updated_rows[0]
                raise HTTPException(status_code=500, detail="Failed to retrieve updated proactivity log from Supabase")
            else:
                # Create new
                insert_resp = supabase.table("proactivity_logs").insert({
                    "user_id": user_id,
                    "activity_date": now,
                    "tasks_completed": checkin.tasks_completed,
                    "total_tasks": checkin.total_tasks,
                    "score": score,
                    "notes": checkin.notes,
                    "created_at": now,
                    "updated_at": now
                }).select().execute()
                
                new_rows = getattr(insert_resp, "data", None) or []
                if new_rows:
                    return new_rows[0]
                raise HTTPException(status_code=500, detail="Failed to retrieve created proactivity log from Supabase")

        except Exception as error:
            logger.error(f"Critical: Failed to write proactivity log to Supabase for user {user_id}: {error}")
            raise HTTPException(status_code=500, detail="Database write failed for proactivity log")

    # Fallback to local SQLite (only if Supabase is not configured)
    from sqlalchemy import func
    existing_log_query = proactivity_logs.select().where(
        (proactivity_logs.c.user_id == user_id) &
        (func.date(proactivity_logs.c.activity_date) == today)
    )
    existing_log = await db.fetch_one(existing_log_query)

    if existing_log:
        # Update existing log with new data
        score = min(100, (checkin.tasks_completed / max(checkin.total_tasks, 1)) * 100) if checkin.total_tasks > 0 else 0
        await db.execute(
            proactivity_logs.update()
            .where(proactivity_logs.c.id == existing_log.id)
            .values(
                tasks_completed=checkin.tasks_completed,
                total_tasks=checkin.total_tasks,
                score=score,
                notes=checkin.notes
            )
        )
        result = await db.fetch_one(proactivity_logs.select().where(proactivity_logs.c.id == existing_log.id))
        return {
            "id": result.id,
            "user_id": result.user_id,
            "activity_date": result.activity_date,
            "tasks_completed": result.tasks_completed,
            "total_tasks": result.total_tasks,
            "score": result.score,
            "notes": result.notes,
            "created_at": result.created_at if result.created_at else datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    else:
        # Create new log for today
        score = min(100, (checkin.tasks_completed / max(checkin.total_tasks, 1)) * 100) if checkin.total_tasks > 0 else 0
        query = proactivity_logs.insert().values(
            user_id=user_id,
            activity_date=datetime.utcnow(),
            tasks_completed=checkin.tasks_completed,
            total_tasks=checkin.total_tasks,
            score=score,
            notes=checkin.notes
        )
        log_id = await db.execute(query)
        result = await db.fetch_one(proactivity_logs.select().where(proactivity_logs.c.id == log_id))
        return {
            "id": result.id,
            "user_id": result.user_id,
            "activity_date": result.activity_date,
            "tasks_completed": result.tasks_completed,
            "total_tasks": result.total_tasks,
            "score": result.score,
            "notes": result.notes,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

@app.get("/users/{user_id}/proactivity/streak", response_model=dict)
async def get_proactivity_streak(user_id: int, db: databases.Database = Depends(get_database)):
    """Get user's current proactivity streak"""
    return await _compute_proactivity_streak(db, user_id)


@app.get(
    "/users/{user_id}/proactivity/notifications",
    response_model=List[ProactivityNotification]
)
async def get_proactivity_notifications(
    user_id: int,
    limit: Optional[int] = Query(None, ge=1),
    unread_only: bool = Query(False),
    db: databases.Database = Depends(get_database),
) -> List[ProactivityNotification]:
    """Fetch proactivity notifications for a user."""
    # Prefer Supabase when available.
    if supabase:
        try:
            query = (
                supabase.table("proactive_notifications")
                .select("*")
                .eq("user_id", user_id)
            )
            if unread_only:
                query = query.is_("read_at", None)
            query = query.order("sent_at", desc=True)
            if limit:
                query = query.limit(limit)
            result = query.execute()
            rows = result.data or []
            return [
                ProactivityNotification.model_validate(
                    _serialize_proactivity_notification(row)
                )
                for row in rows
                if _serialize_proactivity_notification(row) is not None
            ]
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to fetch proactivity notifications from Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    query = proactive_notifications.select().where(proactive_notifications.c.user_id == user_id)
    if unread_only:
        query = query.where(proactive_notifications.c.read_at.is_(None))
    query = query.order_by(proactive_notifications.c.sent_at.desc())
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return [
        ProactivityNotification.model_validate(
            _serialize_proactivity_notification(row)
        )
        for row in rows
    ]


@app.post(
    "/users/{user_id}/proactivity/notifications/{notification_id}/read",
    response_model=ProactivityNotification
)
async def mark_proactivity_notification_read(
    user_id: int,
    notification_id: int,
    db: databases.Database = Depends(get_database),
) -> ProactivityNotification:
    """Mark a notification as read and return the updated record."""
    # Prefer Supabase when available.
    if supabase:
        try:
            # Verify the notification belongs to the user.
            existing = (
                supabase.table("proactive_notifications")
                .select("*")
                .eq("id", notification_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            rows = existing.data or []
            if not rows:
                raise HTTPException(status_code=404, detail="Notification not found.")

            updated = (
                supabase.table("proactive_notifications")
                .update({"read_at": datetime.utcnow().isoformat()})
                .eq("id", notification_id)
                .eq("user_id", user_id)
                .execute()
            )
            data = (updated.data or rows)[0]
            payload = _serialize_proactivity_notification(data)
            if not payload:
                raise HTTPException(status_code=500, detail="Failed to serialize notification")
            return ProactivityNotification.model_validate(payload)
        except HTTPException:
            raise
        except Exception as error:
            _handle_supabase_table_error(
                f"Warning: Failed to mark proactivity notification read in Supabase for user {user_id}",
                error,
            )

    # Fallback to local SQLite.
    select_query = proactive_notifications.select().where(
        (proactive_notifications.c.user_id == user_id)
        & (proactive_notifications.c.id == notification_id)
    )
    record = await db.fetch_one(select_query)
    if not record:
        raise HTTPException(status_code=404, detail="Notification not found.")

    await db.execute(
        proactive_notifications.update()
        .where(proactive_notifications.c.id == notification_id)
        .values(read_at=datetime.utcnow())
    )
    updated = await db.fetch_one(select_query)
    return ProactivityNotification.model_validate(
        _serialize_proactivity_notification(updated)
    )


@app.get("/users/{user_id}/proactivity/settings", response_model=Optional[ProactivitySettings])
async def get_proactivity_settings_route(
    user_id: int,
    db: databases.Database = Depends(get_database),
):
    supabase_settings = _fetch_supabase_proactivity_settings(user_id)
    if supabase_settings:
        api_logger.debug(f"Retrieved proactivity settings from Supabase for user {user_id}", extra={
            "event_type": "proactivity_settings_retrieved_supabase",
            "user_id": user_id,
            "settings": supabase_settings.model_dump(exclude_none=True)
        })
        return supabase_settings

    record = await db.fetch_one(
        proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
    )
    if not record:
        api_logger.debug(f"No proactivity settings found for user {user_id}", extra={
            "event_type": "proactivity_settings_not_found",
            "user_id": user_id
        })
        return None
    payload = _row_get(record, "payload")
    api_logger.debug(f"Retrieved proactivity settings payload from database for user {user_id}", extra={
        "event_type": "proactivity_settings_retrieved_db",
        "user_id": user_id,
        "payload": payload
    })
    settings = _deserialize_proactivity_settings_payload(payload)
    if settings:
        # Backfill Supabase when local sqlite contains the canonical value.
        _upsert_supabase_proactivity_settings(user_id, settings.model_dump(exclude_none=True))
    return settings


@app.api_route(
    "/users/{user_id}/proactivity/settings",
    methods=["POST", "PUT"],
    response_model=ProactivitySettings
)
async def update_proactivity_settings_route(
    user_id: int,
    settings: ProactivitySettings,
    db: databases.Database = Depends(get_database),
):
    payload = settings.model_dump(exclude_none=True)
    now = datetime.utcnow()

    api_logger.debug(f"Saving proactivity settings for user {user_id}", extra={
        "event_type": "proactivity_settings_save_start",
        "user_id": user_id,
        "payload": payload
    })

    try:
        existing = await db.fetch_one(
            proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
        )
        if existing:
            await db.execute(
                proactivity_settings.update()
                .where(proactivity_settings.c.user_id == user_id)
                .values(payload=payload, updated_at=now)
            )
        else:
            await db.execute(
                proactivity_settings.insert().values(
                    user_id=user_id,
                    payload=payload,
                    created_at=now,
                    updated_at=now,
                )
            )
    except Exception as db_error:
        api_logger.error(
            f"Database error saving proactivity settings: {db_error}",
            exc_info=True,
            extra={
                "event_type": "proactivity_settings_db_error",
                "user_id": user_id,
                "error": str(db_error),
            },
        )
        raise HTTPException(status_code=500, detail=f"Failed to save proactivity settings: {str(db_error)}")

    try:
        _upsert_supabase_proactivity_settings(user_id, payload)
    except Exception as supabase_error:
        # Log but don't fail the request for Supabase errors (it's a backup)
        api_logger.warning(f"Failed to sync proactivity settings to Supabase: {supabase_error}", extra={
            "event_type": "proactivity_settings_supabase_error",
            "user_id": user_id,
            "error": str(supabase_error)
        })

    api_logger.debug(f"Successfully saved proactivity settings for user {user_id}", extra={
        "event_type": "proactivity_settings_save_success",
        "user_id": user_id
    })

    # Keep the in-memory timezone cache in sync so streak calculations
    # immediately respect updated user preferences.
    _USER_TIMEZONE_CACHE[user_id] = settings.timezone

    if proactivity_scheduler:
        try:
            await proactivity_scheduler.refresh_jobs()
        except Exception as scheduler_error:
            api_logger.warning(f"Failed to refresh proactivity scheduler jobs: {scheduler_error}", extra={
                "event_type": "proactivity_scheduler_refresh_error",
                "user_id": user_id,
                "error": str(scheduler_error)
            })

    return ProactivitySettings.model_validate(payload)


@app.get("/api/workspace-backgrounds", response_model=List[WorkspaceBackground])
async def list_workspace_backgrounds():
    return WORKSPACE_BACKGROUNDS


@app.post("/api/workspace-backgrounds", response_model=WorkspaceBackground)
async def create_workspace_background(background: WorkspaceBackground):
    new_id = len(WORKSPACE_BACKGROUNDS) + 1
    payload = background.model_dump(exclude_none=True)
    return WorkspaceBackground(**{**payload, "id": new_id})


@app.post("/api/workspace-backgrounds/assets")
async def upload_workspace_background_asset(file: UploadFile = File(...)):
    return {
        "filename": file.filename,
        "asset_path": f"/uploads/{file.filename}",
        "content_type": file.content_type or "application/octet-stream",
        "size": 0,
    }

# Google Calendar helpers

def _serialize_scopes(scopes: List[str]) -> str:
    try:
        return json.dumps(scopes)
    except (TypeError, ValueError):
        return json.dumps([])


def _hydrate_scopes(raw_scopes):
    if isinstance(raw_scopes, list):
        return raw_scopes
    if isinstance(raw_scopes, str):
        try:
            loaded = json.loads(raw_scopes)
            if isinstance(loaded, list):
                return loaded
        except json.JSONDecodeError:
            return [scope.strip() for scope in raw_scopes.split() if scope.strip()]
    return []


def map_google_credentials(record) -> GoogleCalendarCredentials:
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google Calendar not connected. Please authorize first."
        )

    record_dict = dict(record)
    scopes = _hydrate_scopes(record_dict.get("scopes"))
    return GoogleCalendarCredentials(
        user_id=record_dict["user_id"],
        access_token=record_dict["access_token"],
        refresh_token=record_dict["refresh_token"],
        token_uri=record_dict["token_uri"],
        client_id=record_dict["client_id"],
        client_secret=record_dict["client_secret"],
        scopes=scopes,
        expires_at=record_dict.get("expires_at"),
        created_at=record_dict.get("created_at", datetime.utcnow()),
        updated_at=record_dict.get("updated_at", datetime.utcnow()),
    )


async def upsert_google_calendar_credentials(db: databases.Database, creds: GoogleCalendarCredentials) -> None:
    payload = {
        "user_id": creds.user_id,
        "access_token": creds.access_token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": _serialize_scopes(creds.scopes),
        "expires_at": creds.expires_at,
        "created_at": creds.created_at,
        "updated_at": datetime.utcnow(),
    }

    existing = await db.fetch_one(
        google_calendar_credentials.select().where(google_calendar_credentials.c.user_id == creds.user_id)
    )

    if existing:
        await db.execute(
            google_calendar_credentials
            .update()
            .where(google_calendar_credentials.c.user_id == creds.user_id)
            .values(payload)
        )
    else:
        await db.execute(google_calendar_credentials.insert().values(payload))


# Google Calendar endpoints
@app.post("/users/{user_id}/google-calendar/auth", response_model=GoogleAuthResponse)
async def google_calendar_auth(user_id: int, request: GoogleAuthRequest, db: databases.Database = Depends(get_database)):
    """Generate Google Calendar authorization URL."""
    if request.user_id and request.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mismatched user identifier for Google Calendar auth request")
    return get_google_auth_url(user_id, request.redirect_uri)

@app.post("/google-calendar/oauth/callback", response_model=GoogleCalendarCredentials)
async def google_calendar_callback(request: GoogleAuthCallbackRequest, db: databases.Database = Depends(get_database)):
    """Handle Google Calendar OAuth callback."""
    try:
        credentials = await exchange_code_for_tokens(request.code, request.state, request.redirect_uri)
        await upsert_google_calendar_credentials(db, credentials)
        return credentials
    except HTTPException as e:
        raise e

@app.get("/users/{user_id}/google-calendars", response_model=List[GoogleCalendarInfo])
async def get_google_calendars(user_id: int, db: databases.Database = Depends(get_database)):
    """Get user's Google Calendars."""
    try:
        # Get user's Google Calendar credentials from database
        query = google_calendar_credentials.select().where(google_calendar_credentials.c.user_id == user_id)
        stored_creds = await db.fetch_one(query)

        creds = map_google_credentials(stored_creds)
        service = await get_google_calendar_service(creds)
        calendars = await list_google_calendars(service)
        return calendars
    except HTTPException as e:
        raise e

@app.get("/users/{user_id}/google-calendars/{calendar_id}/events", response_model=List[GoogleCalendarEvent])
async def get_google_calendar_events(user_id: int, calendar_id: str, time_min: Optional[datetime] = None, time_max: Optional[datetime] = None, db: databases.Database = Depends(get_database)):
    """Get events from a Google Calendar."""
    try:
        # Get user's Google Calendar credentials from database
        query = google_calendar_credentials.select().where(google_calendar_credentials.c.user_id == user_id)
        stored_creds = await db.fetch_one(query)

        creds = map_google_credentials(stored_creds)
        service = await get_google_calendar_service(creds)
        events = await list_google_events(service, calendar_id, time_min, time_max)
        return events
    except HTTPException as e:
        raise e

@app.post("/users/{user_id}/google-calendars/{calendar_id}/events", response_model=GoogleCalendarEvent)
async def create_google_calendar_event(user_id: int, calendar_id: str, event_data: dict, db: databases.Database = Depends(get_database)):
    """Create a new event in Google Calendar."""
    try:
        # Get user's Google Calendar credentials from database
        query = google_calendar_credentials.select().where(google_calendar_credentials.c.user_id == user_id)
        stored_creds = await db.fetch_one(query)

        creds = map_google_credentials(stored_creds)
        service = await get_google_calendar_service(creds)
        event = await create_google_event(service, calendar_id, event_data)
        return event
    except HTTPException as e:
        raise e


# Proactivity scheduler endpoints
@app.post("/api/proactivity/evaluate")
async def trigger_proactivity_evaluation():
    """
    Manually trigger proactivity evaluation for all users.
    Returns a summary of actions taken.
    """
    global proactivity_engine

    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")

    try:
        results = await proactivity_engine.dispatch_all_due(source="manual")
        return {"status": "success", "evaluation_results": results}
    except Exception as e:
        api_logger.error(
            f"Error evaluating proactivity: {e}",
            exc_info=True,
            extra={
                "event_type": "proactivity_evaluation_manual_error",
                "error": str(e),
            },
        )
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@app.post("/users/{user_id}/proactivity/evaluate")
async def trigger_proactivity_for_user(user_id: int):
    """
    Manually trigger proactivity message generation for a specific user.
    """
    global proactivity_engine

    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")

    try:
        result = await proactivity_engine.dispatch_user_if_due(user_id, source="manual", force=True)
        if result:
            return {"status": "success", "message": "Proactivity message sent"}
        raise HTTPException(status_code=404, detail="No proactivity settings found for user")

    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(
            f"Error triggering proactivity for user {user_id}: {e}",
            exc_info=True,
            extra={
                "event_type": "proactivity_user_manual_error",
                "user_id": user_id,
                "error": str(e),
            },
        )
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=False)
