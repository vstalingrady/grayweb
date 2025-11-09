from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field, ConfigDict, constr, validator
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple, Union
import databases
import sqlalchemy
from datetime import datetime, timezone, date
import os
import json
import asyncio
import threading
import tempfile
import time
import re
from dotenv import load_dotenv
try:
    from google import genai  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    genai = None  # type: ignore

try:
    import google.generativeai as legacy_genai  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    legacy_genai = None  # type: ignore
from supabase import create_client, Client
from pathlib import Path
from urllib.parse import quote_plus
from uuid import uuid4
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
from supabase_database import SupabaseDatabaseService, SupabaseTransientError

# Proactivity system
from datetime import datetime, timedelta, timezone as dt_timezone
import uuid as uuid_lib

# AI Message Generator
from ai_message_generator import AIMessageGenerator, generate_proactive_message

# Web search integration
import httpx
import asyncio

try:
    import tiktoken
except ImportError:  # pragma: no cover - optional dependency
    tiktoken = None

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()


def _int_env(var_name: str, default: int) -> int:
    try:
        return int(os.getenv(var_name, default))
    except (TypeError, ValueError):
        return default


def _float_env(var_name: str, default: float) -> float:
    try:
        return float(os.getenv(var_name, default))
    except (TypeError, ValueError):
        return default


MAX_GEMINI_UPLOAD_MB = max(1, _int_env("GEMINI_MAX_UPLOAD_MB", 20))
MAX_GEMINI_UPLOAD_BYTES = MAX_GEMINI_UPLOAD_MB * 1024 * 1024
GEMINI_FILE_POLL_INTERVAL = max(0.25, _float_env("GEMINI_FILE_POLL_INTERVAL", 1.0))
GEMINI_FILE_POLL_TIMEOUT = max(5.0, _float_env("GEMINI_FILE_POLL_TIMEOUT", 60.0))
STREAMING_TOKEN_DELAY = max(0.0, _float_env("GRAY_STREAMING_TOKEN_DELAY_SECONDS", 0.0))
DEFAULT_CONTEXT_TOKEN_LIMIT = max(1, _int_env("GRAY_CONTEXT_TOKEN_LIMIT", 128_000))
TOKEN_ENCODING_MODEL = os.getenv("GRAY_CONTEXT_TOKEN_MODEL")
TOKEN_ENCODING_NAME = os.getenv("GRAY_TOKEN_ENCODING", "cl100k_base")

_TOKEN_ENCODER = None
if tiktoken:
    if TOKEN_ENCODING_MODEL:
        try:
            _TOKEN_ENCODER = tiktoken.encoding_for_model(TOKEN_ENCODING_MODEL)
        except Exception:
            _TOKEN_ENCODER = None
    if _TOKEN_ENCODER is None:
        try:
            _TOKEN_ENCODER = tiktoken.get_encoding(TOKEN_ENCODING_NAME or "cl100k_base")
        except Exception:
            try:
                _TOKEN_ENCODER = tiktoken.get_encoding("cl100k_base")
            except Exception:
                _TOKEN_ENCODER = None

CONTEXT_LIMIT_CACHE: Dict[Tuple[str, Optional[str]], int] = {}
IDENTITY_CACHE: Dict[str, Any] = {"path": None, "mtime": None, "value": ("gemini", None, None)}


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


def _build_allowed_origins() -> List[str]:
    explicit = _split_env_list(os.getenv("CORS_ALLOW_ORIGINS"))
    if explicit:
        return explicit

    default_origins = {
        "http://localhost:3000",
        "https://localhost:3000",
        "http://127.0.0.1:3000",
        "https://127.0.0.1:3000",
        "http://gray.localhost:3000",
        "https://gray.localhost:3000",
        "http://gray.localhost",
        "https://gray.localhost",
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

    return sorted(default_origins)


ALLOWED_ORIGINS = _build_allowed_origins()

TITLE_GREETING_PATTERN = re.compile(r"\b(?:hi|hey|hello|hola|sup|yo|what'?s up)\b", re.IGNORECASE)
TITLE_DISTRESS_PATTERN = re.compile(r"\b(?:help|emergency|urgent|kill|danger|panic|scared)\b", re.IGNORECASE)
TITLE_STATUS_PATTERN = re.compile(r"\b(?:how are you|how do you feel)\b", re.IGNORECASE)
TITLE_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "in", "on", "at", "with", "for", "to", "of",
    "about", "is", "are", "was", "were", "be", "am", "i", "me", "my", "you", "your",
}


def _fallback_title_from_message(message: str) -> str:
    trimmed = " ".join((message or "").strip().split())
    if not trimmed:
        return "New Chat"

    if TITLE_GREETING_PATTERN.search(trimmed):
        return "Quick Greeting"
    if TITLE_STATUS_PATTERN.search(trimmed):
        return "Status Check-In"
    if TITLE_DISTRESS_PATTERN.search(trimmed):
        return "Urgent Help Request"

    tokens = re.findall(r"[A-Za-z0-9']+", trimmed)
    keywords = [token for token in tokens if token.lower() not in TITLE_STOPWORDS]
    if not keywords:
        keywords = tokens
    candidate = " ".join(keywords[:6]).strip() or trimmed
    candidate = candidate.title()
    if len(candidate) <= 48:
        return candidate
    return f"{candidate[:45].rstrip()}…"

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
    sqlalchemy.Column("email", sqlalchemy.String, unique=True, index=True),
    sqlalchemy.Column("full_name", sqlalchemy.String),
    sqlalchemy.Column("profile_picture_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String, default="user"),
    sqlalchemy.Column("initials", sqlalchemy.String),
    sqlalchemy.Column("personalization_nickname", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_occupation", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_about", sqlalchemy.Text, nullable=True),
    sqlalchemy.Column("personalization_custom_instructions", sqlalchemy.Text, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

chat_sessions = sqlalchemy.Table(
    "chat_sessions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("title", sqlalchemy.String),
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
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
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

def _ensure_plan_columns(engine: sqlalchemy.engine.Engine) -> None:
    def ensure(table_name: str, column_name: str, ddl: str) -> None:
        inspector = sqlalchemy.inspect(engine)
        existing = {column["name"] for column in inspector.get_columns(table_name)}
        if column_name in existing:
            return

        # Clean up the old buggy runs that created a column literally named "VARCHAR".
        if "VARCHAR" in existing:
            engine.execute(
                sqlalchemy.text(f"ALTER TABLE {table_name} RENAME COLUMN VARCHAR TO {column_name}")
            )
            inspector = sqlalchemy.inspect(engine)
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            if column_name in existing:
                return

        engine.execute(
            sqlalchemy.text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}")
        )

    ensure("plans", "deadline", "VARCHAR")
    ensure("plans", "schedule_slot", "VARCHAR")

def _ensure_user_personalization_columns(engine: sqlalchemy.engine.Engine) -> None:
    inspector = sqlalchemy.inspect(engine)
    existing = {column["name"] for column in inspector.get_columns("users")}
    columns: Dict[str, str] = {
        "personalization_nickname": "VARCHAR",
        "personalization_occupation": "VARCHAR",
        "personalization_about": "TEXT",
        "personalization_custom_instructions": "TEXT",
    }
    for column_name, ddl in columns.items():
        if column_name not in existing:
            engine.execute(sqlalchemy.text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))

_engine_kwargs: Dict[str, Any] = {}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

_engine = sqlalchemy.create_engine(DATABASE_URL, **_engine_kwargs)
metadata.create_all(_engine)
_ensure_plan_columns(_engine)
_ensure_user_personalization_columns(_engine)
_engine.dispose()

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

# Proactive notifications
proactive_notifications = sqlalchemy.Table(
    "proactive_notifications",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("type", sqlalchemy.String),  # 'daily_checkin', 'weekly_review', etc.
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

# API Key Management
class APIKeyBase(BaseModel):
    service: str
    api_key: str

class APIKeyCreate(APIKeyBase):
    user_id: int

class APIKey(APIKeyBase):
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Check-in Preferences
class CheckinPreferencesBase(BaseModel):
    timezone: str
    schedule: Optional[Dict[str, Any]] = None
    enabled: bool = True

class CheckinPreferencesCreate(CheckinPreferencesBase):
    user_id: int

class CheckinPreferences(CheckinPreferencesBase):
    user_id: int
    updated_at: Optional[datetime] = None
    proactive_state: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

# Reminders
class ReminderBase(BaseModel):
    message: str
    remind_at: datetime
    channel_id: int

class ReminderCreate(ReminderBase):
    user_id: int
    server_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class Reminder(ReminderBase):
    id: str
    user_id: int
    server_id: Optional[int] = None
    status: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    profile_picture_url: Optional[str] = None
    role: str = "user"
    personalization_nickname: Optional[str] = None
    personalization_occupation: Optional[str] = None
    personalization_about: Optional[str] = None
    personalization_custom_instructions: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: Optional[str] = None
    personalization_nickname: Optional[str] = None
    personalization_occupation: Optional[str] = None
    personalization_about: Optional[str] = None
    personalization_custom_instructions: Optional[str] = None

class User(UserBase):
    id: int
    initials: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatSessionBase(BaseModel):
    title: str

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

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
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CalendarEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime

class CalendarEventCreate(CalendarEventBase):
    calendar_id: Optional[int] = None

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    calendar_id: Optional[int] = None

class CalendarEvent(CalendarEventBase):
    id: int
    user_id: int
    calendar_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class PlanBase(BaseModel):
    label: str
    completed: bool = False
    deadline: Optional[str] = None
    schedule_slot: Optional[str] = None

class PlanCreate(PlanBase):
    pass

class Plan(PlanBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

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
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Proactive Notification Models
class ProactiveNotificationBase(BaseModel):
    type: str
    title: str
    message: str
    metadata: Optional[Dict[str, Any]] = None
    due_at: Optional[datetime] = None

class ProactiveNotificationCreate(ProactiveNotificationBase):
    pass

class ProactiveNotification(ProactiveNotificationBase):
    id: int
    user_id: int
    sent_at: datetime
    read_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PlanUpdate(BaseModel):
    label: Optional[str] = None
    completed: Optional[bool] = None
    deadline: Optional[str] = None
    schedule_slot: Optional[str] = None

class HabitBase(BaseModel):
    label: str
    streak_label: str
    previous_label: str

class HabitCreate(HabitBase):
    pass

class Habit(HabitBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class HabitUpdate(BaseModel):
    label: Optional[str] = None
    streak_label: Optional[str] = None
    previous_label: Optional[str] = None


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
    date_key: constr(pattern=r"^\d{4}-\d{2}-\d{2}$")
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

# AI Chat models
class GeminiAttachment(BaseModel):
    name: str
    uri: str
    mime_type: str
    display_name: Optional[str] = None
    size_bytes: Optional[int] = None


class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    text: str
    attachments: Optional[List[GeminiAttachment]] = None

class ChatSessionCreate(BaseModel):
    title: str
    user_id: int

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: int
    context: Optional[str] = None
    system_prompt: Optional[str] = None
    attachments: Optional[List[GeminiAttachment]] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str


class ConversationSummary(BaseModel):
    id: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    user_id: Optional[int] = None


class ConversationUsageResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    conversation_id: str
    message_count: int
    conversation_tokens: int
    limit: int
    provider: str
    model_name: Optional[str] = None
    model_label: Optional[str] = None


class ChatTitleRequest(BaseModel):
    message: str


class ChatTitleResponse(BaseModel):
    title: str


class GeminiFile(BaseModel):
    name: str
    display_name: Optional[str] = None
    mime_type: Optional[str] = None
    uri: Optional[str] = None
    download_uri: Optional[str] = None
    size_bytes: Optional[int] = None
    state: Optional[str] = None
    create_time: Optional[str] = None
    update_time: Optional[str] = None

# Gemini AI and Supabase setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Gemini
def _canonical_model_name(name: Optional[str], default: str) -> str:
    candidate = (name or "").strip() or default
    return candidate.split("models/", 1)[-1] if "models/" in candidate else candidate


SELECTED_GEMINI_MODEL_NAME = _canonical_model_name(
    os.getenv("GEMINI_MODEL_NAME") or os.getenv("GEMINI_MODEL"),
    "gemini-2.5-flash",
)
GEMINI_TITLE_MODEL_NAME = _canonical_model_name(
    os.getenv("GEMINI_TITLE_MODEL_NAME") or os.getenv("GEMINI_TITLE_MODEL"),
    "gemini-2.5-flash-lite",
)

GEMINI_CONTEXT_LIMITS: Dict[str, int] = {
    "gemini-2.5-pro": 2_097_152,
    "gemini-2.5-pro-exp": 2_097_152,
    "gemini-2.5-flash": 1_048_576,
    "gemini-2.5-flash-8b": 1_048_576,
    "gemini-2.5-flash-lite": 1_048_576,
    "gemini-2.0-flash": 1_048_576,
    "gemini-2.0-flash-lite": 1_048_576,
    "gemini-1.5-flash": 1_048_576,
    "gemini-1.5-flash-8b": 1_048_576,
    "gemini-1.5-pro": 2_097_152,
    "gemini-1.0-pro": 32_768,
    "gemini-1.0-pro-latest": 32_768,
    "gemini-flash-latest": 1_048_576,
    "gemini-flash-lite-latest": 1_048_576,
    "gemini-pro": 32_768,
    "gemini-pro-vision": 32_768,
}

def _resolve_gemini_limit(model_name: Optional[str], *, force_refresh: bool = False) -> int:
    candidate = _canonical_model_name(model_name, SELECTED_GEMINI_MODEL_NAME)
    cache_key = ("gemini", candidate)
    if not force_refresh and cache_key in CONTEXT_LIMIT_CACHE:
        return CONTEXT_LIMIT_CACHE[cache_key]

    mapped = GEMINI_CONTEXT_LIMITS.get(candidate)
    if mapped is not None:
        CONTEXT_LIMIT_CACHE[cache_key] = mapped
        return mapped

    prefixed = f"models/{candidate}"
    mapped_prefixed = GEMINI_CONTEXT_LIMITS.get(prefixed)
    if mapped_prefixed is not None:
        CONTEXT_LIMIT_CACHE[cache_key] = mapped_prefixed
        return mapped_prefixed

    CONTEXT_LIMIT_CACHE[cache_key] = DEFAULT_CONTEXT_TOKEN_LIMIT
    return DEFAULT_CONTEXT_TOKEN_LIMIT


def _update_context_limit_from_model(model_name: Optional[str]) -> None:
    if not model_name:
        return
    limit = _resolve_gemini_limit(model_name, force_refresh=True)
    if limit and limit != DEFAULT_CONTEXT_TOKEN_LIMIT:
        print(f"Detected context token limit for {model_name}: {limit}")


def _resolve_max_output_tokens(default: int = 600) -> int:
    raw = os.getenv("GEMINI_MAX_OUTPUT_TOKENS")
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


DEFAULT_MAX_OUTPUT_TOKENS = _resolve_max_output_tokens()
GEMINI_GENERATION_CONFIG: Optional[Dict[str, Any]] = (
    {"max_output_tokens": DEFAULT_MAX_OUTPUT_TOKENS} if DEFAULT_MAX_OUTPUT_TOKENS > 0 else None
)


class _LegacyGenAIModelsProxy:
    def __init__(self, module):
        self._module = module
        self._cache: Dict[str, Any] = {}

    def _get_model(self, model_name: str):
        key = model_name or SELECTED_GEMINI_MODEL_NAME
        cached = self._cache.get(key)
        if cached is None:
            cached = self._module.GenerativeModel(key)
            self._cache[key] = cached
        return cached

    def generate_content(self, *, model: str, contents, stream: bool = False):
        generator = self._get_model(model)
        return generator.generate_content(contents=contents, stream=stream)

    def generate_content_stream(self, *, model: str, contents):
        return self.generate_content(model=model, contents=contents, stream=True)


class _LegacyGenAIFilesProxy:
    def __init__(self, module):
        self._module = module

    def upload(self, *, file: str, display_name: Optional[str] = None, mime_type: Optional[str] = None):
        kwargs: Dict[str, Any] = {"path": file}
        if display_name:
            kwargs["display_name"] = display_name
        if mime_type:
            kwargs["mime_type"] = mime_type
        return self._module.upload_file(**kwargs)

    def get(self, name: str):
        return self._module.get_file(name=name)


class _LegacyGenAIClient:
    def __init__(self, module, api_key: str):
        module.configure(api_key=api_key)
        self.models = _LegacyGenAIModelsProxy(module)
        self.files = _LegacyGenAIFilesProxy(module)


def _build_generation_kwargs(
    contents: List[Dict[str, Any]],
    *,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    kwargs: Dict[str, Any] = {"model": model_name or SELECTED_GEMINI_MODEL_NAME, "contents": contents}
    if (
        GEMINI_GENERATION_CONFIG
        and genai_client is not None
        and not isinstance(genai_client, _LegacyGenAIClient)
    ):
        kwargs["generation_config"] = dict(GEMINI_GENERATION_CONFIG)
    return kwargs


genai_client = None
if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        if genai is not None and hasattr(genai, "Client"):
            genai_client = genai.Client(api_key=GEMINI_API_KEY)
            print(f"Google GenAI client initialized for {SELECTED_GEMINI_MODEL_NAME}")
        elif legacy_genai is not None:
            genai_client = _LegacyGenAIClient(legacy_genai, GEMINI_API_KEY)
            print(
                "google-genai package not available; using compatibility shim over google-generativeai."
            )
        else:
            print("Warning: No Google GenAI client available; responses will be simulated.")
        if genai_client:
            _update_context_limit_from_model(SELECTED_GEMINI_MODEL_NAME)
    except Exception as error:  # pragma: no cover - best effort logging
        genai_client = None
        print(f"Failed to initialize Google GenAI client: {error}")
else:  # pragma: no cover - configuration dependent
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY not configured. AI responses will be simulated.")

# Initialize Supabase with robust error handling
_supabase_timeout_seconds = float(os.getenv("SUPABASE_TIMEOUT_SECONDS", "5"))
supabase_service = None

# Initialize proactive system background task
_proactive_tasks: Dict[str, asyncio.Task] = {}
_proactive_backoff_until = datetime.min.replace(tzinfo=dt_timezone.utc)
_remote_failure_count = 0

if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    try:
        supabase_service = SupabaseDatabaseService(
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_KEY
        )
        if supabase_service.supabase:
            print("Supabase service initialized successfully with robust error handling")
        else:
            print("Warning: Supabase service initialized but client is unavailable")
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase service: {e}")
        print("Conversation history will not be persisted.")
else:
    print("Warning: Supabase credentials not configured. Conversation history will not be persisted.")

# Keep backward compatibility - create a simple supabase client if needed
# (but we'll use the service for all operations)
supabase = supabase_service.supabase if supabase_service else None
SUPABASE_CONVERSATIONS_ENABLED = supabase_service is not None and supabase_service.supabase is not None
_NETWORK_FAILURE_MARKERS = (
    "timeout",
    "timed out",
    "dns",
    "name or service not known",
    "temporary failure",
    "connection refused",
    "network is unreachable",
    "getaddrinfo",
    "host unreachable",
    "tls handshake",
)


def _conversation_store_available() -> bool:
    """Check if the conversation store is available and operational."""
    return (
        SUPABASE_CONVERSATIONS_ENABLED
        and supabase_service is not None
        and supabase_service.supabase is not None
    )


def _is_valid_uuid(value: Optional[str]) -> bool:
    """Return True when the provided string is a valid UUID."""
    if not isinstance(value, str):
        return False
    candidate = value.strip()
    if not candidate:
        return False
    try:
        uuid_lib.UUID(candidate)
        return True
    except (ValueError, AttributeError):
        return False


def _should_use_conversation_store(conversation_id: Optional[str]) -> bool:
    """Only use Supabase when the store is available and the ID is a UUID."""
    return _conversation_store_available() and _is_valid_uuid(conversation_id)


LOCAL_CONVERSATION_STORE: Dict[str, List[Dict[str, Any]]] = {}
LOCAL_CONVERSATION_LOCK = asyncio.Lock()
LOCAL_CONVERSATION_METADATA: Dict[str, Dict[str, Any]] = {}
LOCAL_CONVERSATION_METADATA_LOCK = asyncio.Lock()


async def _cache_local_conversation_history(conversation_id: str, history: List[Dict[str, Any]]) -> None:
    """Replace the in-memory history cache for a conversation."""
    async with LOCAL_CONVERSATION_LOCK:
        LOCAL_CONVERSATION_STORE[conversation_id] = list(history)


async def _append_local_conversation_message(conversation_id: str, message: Dict[str, Any]) -> None:
    """Append a message to the in-memory history cache."""
    async with LOCAL_CONVERSATION_LOCK:
        history = LOCAL_CONVERSATION_STORE.setdefault(conversation_id, [])
        history.append(message)


async def _touch_local_conversation_metadata(
    conversation_id: str,
    *,
    title: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Ensure a local conversation metadata record exists and return its latest snapshot."""
    now_iso = datetime.utcnow().isoformat()
    async with LOCAL_CONVERSATION_METADATA_LOCK:
        entry = LOCAL_CONVERSATION_METADATA.get(conversation_id)
        if not entry:
            entry = {
                "id": conversation_id,
                "title": title or "New Chat",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            if user_id is not None:
                entry["user_id"] = user_id
            LOCAL_CONVERSATION_METADATA[conversation_id] = entry
            return dict(entry)

        if title is not None:
            entry["title"] = title
        if user_id is not None:
            entry["user_id"] = user_id
        entry["updated_at"] = now_iso
        return dict(entry)


async def _get_local_conversation_metadata(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Return a copy of the local metadata record if it exists."""
    async with LOCAL_CONVERSATION_METADATA_LOCK:
        entry = LOCAL_CONVERSATION_METADATA.get(conversation_id)
        return dict(entry) if entry else None


async def _load_user_conversations(user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    """Return recent conversations for a user, falling back gracefully when unavailable."""
    if not _conversation_store_available():
        return []

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.table("conversations")
                .select("id,title,created_at,updated_at")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(max(1, min(limit, 500)))
                .execute()
            ),
            timeout=_supabase_timeout_seconds,
        )
        data = result.data or []
        conversations: List[Dict[str, Any]] = []
        for record in data:
            conversation_id = record.get("id")
            if not conversation_id:
                continue
            created_at = record.get("created_at") or datetime.utcnow().isoformat()
            updated_at = record.get("updated_at") or created_at
            conversations.append(
                {
                    "id": conversation_id,
                    "title": record.get("title"),
                    "created_at": created_at,
                    "updated_at": updated_at,
                }
            )
        return conversations
    except asyncio.TimeoutError:
        _handle_conversation_store_error("Error listing user conversations (timeout)", None)
        return []
    except Exception as error:
        _handle_conversation_store_error("Error listing user conversations", error)
        return []


def _disable_conversation_store(reason: str) -> None:
    """Disable conversation storage with a clear reason."""
    global SUPABASE_CONVERSATIONS_ENABLED
    if SUPABASE_CONVERSATIONS_ENABLED:
        SUPABASE_CONVERSATIONS_ENABLED = False
        print(f"Conversation storage disabled: {reason}")


def _handle_conversation_store_error(context: str, error: Optional[Exception]) -> None:
    """Handle conversation store errors with graceful degradation."""
    if not supabase_service:
        print(f"{context}: Supabase service unavailable")
        return

    if error:
        code, message = supabase_service._parse_api_error(error)
        details = message or str(error)
    else:
        code, details = None, ""

    combined_details = details or ""
    print(f"{context}: {combined_details or 'No additional details'}")

    # Check for missing table error (PGRST205)
    normalized_context = f"{context} {combined_details}".lower()
    if code == "PGRST205" or "could not find the table" in normalized_context:
        _disable_conversation_store("Supabase 'conversations' table missing; suppressing further requests.")
        return

    if any(marker in normalized_context for marker in _NETWORK_FAILURE_MARKERS):
        _disable_conversation_store("Supabase appears unreachable; using in-memory conversation storage.")


async def _ensure_conversation_title(conversation_id: str, user_message: str) -> None:
    """Ensure a conversation has a descriptive title derived from the first user prompt."""
    if not _should_use_conversation_store(conversation_id):
        return

    trimmed = " ".join((user_message or "").strip().split())
    if not trimmed:
        return

    def _fetch_existing_title() -> str:
        result = (
            supabase.table("conversations")
            .select("title")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return str(result.data[0].get("title") or "").strip()
        return ""

    try:
        existing_title = await asyncio.wait_for(
            asyncio.to_thread(_fetch_existing_title),
            timeout=_supabase_timeout_seconds,
        )
    except asyncio.TimeoutError:
        _handle_conversation_store_error("Error fetching conversation title (timeout)", None)
        return
    except Exception as error:  # pragma: no cover - best effort logging
        _handle_conversation_store_error("Error fetching conversation title", error)
        return

    if existing_title and existing_title.lower() != "new chat":
        return

    suggested_title = await generate_chat_title_suggestion(trimmed)
    next_title = suggested_title or _fallback_title_from_message(trimmed)
    if not next_title or next_title == existing_title:
        return

    def _persist_new_title() -> None:
        supabase.table("conversations").update(
            {"title": next_title, "updated_at": datetime.utcnow().isoformat()}
        ).eq("id", conversation_id).execute()

    try:
        await asyncio.wait_for(
            asyncio.to_thread(_persist_new_title),
            timeout=_supabase_timeout_seconds,
        )
    except asyncio.TimeoutError:
        _handle_conversation_store_error("Error updating conversation title (timeout)", None)
    except Exception as error:  # pragma: no cover - best effort logging
        _handle_conversation_store_error("Error updating conversation title", error)


def _schedule_conversation_title_update(conversation_id: str, user_message: str) -> None:
    """Fire-and-forget wrapper so title generation never blocks the main response."""
    trimmed = (user_message or "").strip()
    if not trimmed or not _conversation_store_available():
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    async def _runner():
        try:
            await _ensure_conversation_title(conversation_id, trimmed)
        except Exception as error:  # pragma: no cover - resilience
            _handle_conversation_store_error("Conversation title task error", error)

    loop.create_task(_runner())


def _workspace_memory_root() -> Optional[Path]:
    fallback_env = os.getenv("GRAY_WORKSPACE_MEMORY_PATH")
    candidates: List[Path] = []
    if fallback_env:
        candidates.append(Path(fallback_env))
    identity_env = os.getenv("GRAY_IDENTITY_PATH")
    if identity_env:
        identity_path = Path(identity_env)
        if identity_path.is_dir():
            candidates.insert(0, identity_path)
        else:
            return identity_path
    backend_local = Path(__file__).resolve().parent / "workspace_memory"
    repo_local = Path(__file__).resolve().parent.parent / "grayai" / "workspace_memory"
    candidates.extend([backend_local, repo_local])
    for candidate in candidates:
        if candidate.exists():
            if candidate.is_dir():
                candidate_file = candidate / "assistant_identity.json"
                if candidate_file.exists():
                    return candidate_file
            elif candidate.name.endswith(".json"):
                return candidate
    for candidate in candidates:
        if candidate.is_dir():
            return candidate / "assistant_identity.json"
    return None

def _clean_env_value(value: Optional[Any]) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
    else:
        stripped = str(value).strip()
    return stripped or None


def _infer_identity_from_env() -> Tuple[str, Optional[str], Optional[str]]:
    provider_env = _clean_env_value(os.getenv("GRAY_DEFAULT_PROVIDER"))
    model_env = _clean_env_value(os.getenv("GRAY_DEFAULT_MODEL_NAME") or os.getenv("GRAY_DEFAULT_MODEL"))
    label_env = _clean_env_value(os.getenv("GRAY_DEFAULT_MODEL_LABEL"))

    if provider_env:
        provider = provider_env.lower()
        if provider in ("default", "gray", "builtin"):
            provider = "gemini"
        return provider, model_env, label_env

    if _clean_env_value(os.getenv("OPENROUTER_API_KEY")):
        model = _clean_env_value(os.getenv("OPENROUTER_DEFAULT_MODEL"))
        return "openrouter", model, None

    if _clean_env_value(os.getenv("ANTHROPIC_API_KEY")):
        model = _clean_env_value(os.getenv("ANTHROPIC_DEFAULT_MODEL"))
        return "anthropic", model, None

    if _clean_env_value(os.getenv("OPENAI_API_KEY")) or _clean_env_value(os.getenv("AZURE_OPENAI_API_KEY")):
        model = _clean_env_value(os.getenv("OPENAI_DEFAULT_MODEL") or os.getenv("AZURE_OPENAI_DEPLOYMENT"))
        return "openai", model, None

    if _clean_env_value(os.getenv("NVIDIA_API_KEY")) or _clean_env_value(os.getenv("NVIDIA_NIM_API_KEY")):
        model = _clean_env_value(os.getenv("NVIDIA_DEFAULT_MODEL"))
        return "nvidia", model, None

    if GEMINI_API_KEY:
        return "gemini", SELECTED_GEMINI_MODEL_NAME, None

    return "unknown", None, None


def _load_identity_configuration() -> Tuple[str, Optional[str], Optional[str]]:
    path = _workspace_memory_root()
    fallback_provider, fallback_model, fallback_label = _infer_identity_from_env()
    if not path:
        return fallback_provider, fallback_model, fallback_label

    try:
        stat = path.stat()
    except FileNotFoundError:
        return fallback_provider, fallback_model, fallback_label

    cache_path = IDENTITY_CACHE.get("path")
    cache_mtime = IDENTITY_CACHE.get("mtime")
    if cache_path == path and isinstance(cache_mtime, float) and abs(cache_mtime - stat.st_mtime) < 1e-6:
        cached = IDENTITY_CACHE.get("value")
        if isinstance(cached, tuple) and len(cached) == 3:
            return cached  # type: ignore[return-value]

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Warning: unable to read identity store {path}: {error}")
        return fallback_provider, fallback_model, fallback_label

    identity: Optional[Dict[str, Any]] = None
    if isinstance(raw, dict):
        maybe_global = raw.get("global")
        if isinstance(maybe_global, dict):
            identity = maybe_global
        else:
            for value in raw.values():
                if isinstance(value, dict):
                    identity = value
                    break

    if not identity:
        result = (fallback_provider, fallback_model, fallback_label)
    else:
        provider = _clean_env_value(identity.get("provider")) or fallback_provider or "unknown"
        provider = provider.lower()
        model_name = _clean_env_value(identity.get("model_name")) or fallback_model
        model_label = _clean_env_value(identity.get("model_label")) or fallback_label
        result = (provider, model_name, model_label)

    IDENTITY_CACHE["path"] = path
    IDENTITY_CACHE["mtime"] = float(stat.st_mtime)
    IDENTITY_CACHE["value"] = result
    return result


def _normalize_model_key(model_name: Optional[str]) -> Optional[str]:
    if not model_name:
        return None
    normalized = model_name.strip().lower()
    if not normalized:
        return None
    if normalized.startswith("openrouter/"):
        normalized = normalized.split("/", 1)[1]
    if ":" in normalized:
        normalized = normalized.split(":", 1)[0]
    return normalized


def _lookup_limit_by_prefix(model_name: Optional[str], mapping: Dict[str, int]) -> Optional[int]:
    normalized = _normalize_model_key(model_name)
    if not normalized:
        return None
    for prefix, value in mapping.items():
        if normalized == prefix or normalized.startswith(prefix):
            return value
    return None


OPENAI_CONTEXT_LIMITS: Dict[str, int] = {
    "gpt-4o-mini": 128_000,
    "gpt-4o": 128_000,
    "gpt-4.1-mini": 128_000,
    "gpt-4.1": 128_000,
    "gpt-4.1-nano": 128_000,
    "gpt-4-turbo": 128_000,
    "gpt-4-turbo-preview": 128_000,
    "gpt-4-32k": 32_768,
    "gpt-4": 8_192,
    "gpt-3.5-turbo-16k": 16_384,
    "gpt-3.5-turbo": 16_384,
    "gpt-3.5": 16_384,
    "o1-mini": 128_000,
    "o1-preview": 128_000,
    "o3-mini": 128_000,
    "text-davinci-003": 4_097,
}


OPENROUTER_CONTEXT_LIMITS: Dict[str, int] = {
    "anthropic/claude-3.5": 200_000,
    "anthropic/claude-3-opus": 200_000,
    "anthropic/claude-3-sonnet": 200_000,
    "anthropic/claude-3-haiku": 200_000,
    "anthropic/claude-2.1": 200_000,
    "google/gemini-1.5-pro": 1_000_000,
    "google/gemini-1.5-flash": 1_000_000,
    "google/gemini-1.5": 1_000_000,
    "google/gemini-pro": 64_000,
    "mistralai/mistral-large": 128_000,
    "mistralai/mistral-medium": 64_000,
    "mistralai/mistral-small": 32_768,
    "meta-llama/llama-3.1": 8_192,
    "meta-llama/llama-3": 8_192,
    "meta-llama/llama-2": 4_096,
    "openai/gpt-4o": 128_000,
    "openai/gpt-4o-mini": 128_000,
    "openai/gpt-4-turbo": 128_000,
    "cohere/command-r+": 128_000,
    "cohere/command-r": 128_000,
    "x-ai/grok": 131_072,
    "qwen/qwen2.5": 131_072,
    "qwen/qwen2": 128_000,
}


NVIDIA_NIM_CONTEXT_LIMITS: Dict[str, int] = {
    "meta/llama-3.1": 8_192,
    "meta/llama-3": 8_192,
    "meta/llama3": 8_192,
    "meta/llama-2": 4_096,
    "mistral": 32_768,
    "mixtral": 32_768,
    "phi-3": 8_192,
}


def _resolve_openai_limit(model_name: Optional[str]) -> int:
    resolved = _lookup_limit_by_prefix(model_name, OPENAI_CONTEXT_LIMITS)
    return resolved if resolved is not None else DEFAULT_CONTEXT_TOKEN_LIMIT


def _resolve_openrouter_limit(model_name: Optional[str]) -> int:
    resolved = _lookup_limit_by_prefix(model_name, OPENROUTER_CONTEXT_LIMITS)
    if resolved is not None:
        return resolved
    normalized = _normalize_model_key(model_name) or ""
    if "claude" in normalized:
        return 200_000
    if "gemini-1.5" in normalized:
        return 1_000_000
    if "gemini" in normalized:
        return 64_000
    if "gpt-4o" in normalized or "gpt-4" in normalized:
        return 128_000
    if "llama" in normalized:
        return 8_192
    if "mistral" in normalized or "mixtral" in normalized:
        return 32_768
    if "qwen" in normalized:
        return 131_072
    if "command" in normalized:
        return 128_000
    if "grok" in normalized:
        return 131_072
    return DEFAULT_CONTEXT_TOKEN_LIMIT


def _resolve_nvidia_limit(model_name: Optional[str]) -> int:
    resolved = _lookup_limit_by_prefix(model_name, NVIDIA_NIM_CONTEXT_LIMITS)
    if resolved is not None:
        return resolved
    normalized = _normalize_model_key(model_name) or ""
    if "llama" in normalized:
        return 8_192
    if "mistral" in normalized or "mixtral" in normalized:
        return 32_768
    return DEFAULT_CONTEXT_TOKEN_LIMIT


def resolve_context_limit_info() -> Tuple[str, Optional[str], Optional[str], int]:
    provider, model_name, model_label = _load_identity_configuration()
    normalized_provider = (provider or "unknown").lower()
    if normalized_provider in ("default", "gray", "builtin"):
        normalized_provider = "gemini"

    if normalized_provider == "gemini":
        limit = _resolve_gemini_limit(model_name)
    elif normalized_provider == "openai":
        limit = _resolve_openai_limit(model_name)
    elif normalized_provider == "openrouter":
        limit = _resolve_openrouter_limit(model_name)
    elif normalized_provider == "anthropic":
        limit = _resolve_openrouter_limit(model_name)
    elif normalized_provider in ("nvidia", "nvidia_nim"):
        limit = _resolve_nvidia_limit(model_name)
    else:
        limit = DEFAULT_CONTEXT_TOKEN_LIMIT

    return normalized_provider, model_name, model_label, limit


def _estimate_tokens(text: Optional[str]) -> int:
    if not text:
        return 0
    if _TOKEN_ENCODER:
        try:
            return len(_TOKEN_ENCODER.encode(text))
        except Exception:
            pass
    normalized = text.strip()
    if not normalized:
        return 0
    return max(1, len(normalized) // 4)


def _compute_conversation_usage(messages: List[Dict[str, Any]]) -> Dict[str, int]:
    total_tokens = 0
    for entry in messages:
        if not isinstance(entry, dict):
            continue
        text = entry.get("text") or entry.get("content") or ""
        total_tokens += _estimate_tokens(str(text))
        attachments = entry.get("attachments")
        if isinstance(attachments, list):
            for attachment in attachments:
                if not isinstance(attachment, dict):
                    continue
                display_name = attachment.get("display_name") or attachment.get("name") or ""
                if display_name:
                    # Attachments contribute minimally; scale down their impact.
                    total_tokens += max(0, _estimate_tokens(str(display_name)) // 10)
    return {
        "message_count": len(messages),
        "conversation_tokens": total_tokens,
    }


async def _load_conversation_history(conversation_id: str) -> List[Dict[str, Any]]:
    if not conversation_id:
        return []

    if _should_use_conversation_store(conversation_id) and supabase:
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: supabase.table("conversations").select("history").eq("id", conversation_id).execute()
                ),
                timeout=_supabase_timeout_seconds,
            )
            if result.data:
                history = result.data[0].get("history") or []
                if isinstance(history, list):
                    await _cache_local_conversation_history(conversation_id, history)
                    return history
                if isinstance(history, str):
                    try:
                        parsed = json.loads(history)
                        if isinstance(parsed, list):
                            await _cache_local_conversation_history(conversation_id, parsed)
                            return parsed
                    except json.JSONDecodeError:
                        pass
        except asyncio.TimeoutError as timeout_error:
            _handle_conversation_store_error("Warning: conversation history fetch timed out", timeout_error)
        except Exception as supabase_error:
            _handle_conversation_store_error("Error getting conversation history", supabase_error)

    async with LOCAL_CONVERSATION_LOCK:
        return list(LOCAL_CONVERSATION_STORE.get(conversation_id, []))


def _build_supabase_database_dsn() -> Optional[str]:
    """Construct a PostgreSQL DSN for direct Supabase access when needed."""
    direct_candidates = [
        os.getenv("SUPABASE_DB_URL"),
        os.getenv("SUPABASE_CONNECTION_STRING"),
        os.getenv("SUPABASE_POSTGRES_URL"),
        os.getenv("POSTGRES_URL"),
        os.getenv("DATABASE_URL_SUPABASE"),
    ]

    for candidate in direct_candidates:
        if candidate and candidate.startswith("postgres"):
            return candidate

    user = (
        os.getenv("SUPABASE_DB_USER")
        or os.getenv("POSTGRES_USER")
        or os.getenv("SUPABASE_USER")
        or os.getenv("user")
    )
    password = (
        os.getenv("SUPABASE_DB_PASSWORD")
        or os.getenv("POSTGRES_PASSWORD")
        or os.getenv("SUPABASE_PASSWORD")
        or os.getenv("password")
    )
    host = (
        os.getenv("SUPABASE_DB_HOST")
        or os.getenv("POSTGRES_HOST")
        or os.getenv("SUPABASE_HOST")
        or os.getenv("host")
    )
    port = (
        os.getenv("SUPABASE_DB_PORT")
        or os.getenv("POSTGRES_PORT")
        or os.getenv("SUPABASE_PORT")
        or os.getenv("port")
        or "5432"
    )
    dbname = (
        os.getenv("SUPABASE_DB_NAME")
        or os.getenv("POSTGRES_DB")
        or os.getenv("SUPABASE_DB")
        or os.getenv("dbname")
        or "postgres"
    )

    if user and password and host:
        return f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{dbname}"
    return None


def _ensure_conversations_table() -> None:
    """Ensure the Supabase conversations table exists, creating it if needed."""
    if not _conversation_store_available():
        return

    global SUPABASE_CONVERSATIONS_ENABLED

    # First, see if the table is already accessible via PostgREST
    try:
        supabase_service.supabase.table("conversations").select("id").limit(1).execute()
        SUPABASE_CONVERSATIONS_ENABLED = True
        return
    except Exception as error:
        code, message = supabase_service._parse_api_error(error)
        normalized = (message or str(error) or "").lower()
        if code != "PGRST205" and "could not find the table" not in normalized:
            # Table exists but request failed for another reason (e.g., RLS), so bail out.
            print(f"Warning: Unable to verify Supabase conversations table: {message or error}")
            return

    dsn = _build_supabase_database_dsn()
    if not dsn:
        print("Warning: Supabase database connection details missing; cannot auto-create conversations table.")
        return

    try:
        import psycopg2
    except ImportError:
        print("Warning: psycopg2 not installed; cannot auto-create Supabase conversations table.")
        return

    try:
        with psycopg2.connect(dsn) as connection:
            with connection.cursor() as cursor:
                try:
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
                except Exception as extension_error:
                    print(f"Warning: Unable to ensure pgcrypto extension: {extension_error}")
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS public.conversations (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id BIGINT NULL,
                        server_id BIGINT NULL,
                        channel_id BIGINT NULL,
                        title TEXT NULL,
                        history JSONB NOT NULL DEFAULT '[]'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_conversations_created_at
                    ON public.conversations (created_at DESC)
                    """
                )
                cursor.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_conversations_user_server
                    ON public.conversations (user_id, server_id)
                    """
                )
        print("Supabase conversations table ensured.")
        SUPABASE_CONVERSATIONS_ENABLED = True
    except Exception as creation_error:
        print(f"Warning: Failed to ensure Supabase conversations table: {creation_error}")
        return

    # Verify again through the Supabase REST layer; PostgREST caches schema,
    # so the table may take a moment to appear. We still attempt once to confirm.
    try:
        supabase_service.supabase.table("conversations").select("id").limit(1).execute()
        print("Supabase conversations table verified via PostgREST.")
    except Exception as verify_error:
        code, message = supabase_service._parse_api_error(verify_error)
        print(f"Warning: Conversations table verification after creation failed: {message or verify_error}")


if os.getenv("SUPABASE_AUTO_CREATE_CONVERSATIONS", "true").lower() not in {"false", "0", "no"}:
    _ensure_conversations_table()


# FastAPI app
app = FastAPI(title="User Profile API with AI Chat", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Database dependency
async def get_database():
    await database.connect()
    try:
        yield database
    finally:
        await database.disconnect()

# Helper functions
def generate_initials(full_name: str) -> str:
    """Generate initials from full name."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1:
        return parts[0][:2].upper()
    return "U"


async def persist_upload_file(upload_file: UploadFile) -> str:
    """Persist an uploaded file to a temporary path with size validation."""
    suffix = ""
    if upload_file.filename:
        suffix = Path(upload_file.filename).suffix

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    written = 0
    try:
        while True:
            chunk = await upload_file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_GEMINI_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds {MAX_GEMINI_UPLOAD_MB} MB limit.",
                )
            temp_file.write(chunk)
        return temp_file.name
    except Exception:
        temp_path = temp_file.name
        temp_file.close()
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise
    finally:
        temp_file.close()


def wait_for_gemini_file_ready(file_resource):
    """Poll the Gemini API until the uploaded file is ACTIVE."""
    target_name = getattr(file_resource, "name", None)
    if not target_name:
        return file_resource

    start_time = time.time()
    while True:
        if not genai_client or not GEMINI_API_KEY:
            raise RuntimeError("Gemini client is not available.")
        current = genai_client.files.get(name=target_name)
        state = getattr(current, "state", None)
        state_name = getattr(state, "name", None) if hasattr(state, "name") else state
        if isinstance(state_name, str):
            state_name = state_name.upper()

        if state_name == "ACTIVE":
            return current
        if state_name == "FAILED":
            raise RuntimeError("Gemini file processing failed.")

        elapsed = time.time() - start_time
        if elapsed >= GEMINI_FILE_POLL_TIMEOUT:
            raise TimeoutError("Timed out waiting for Gemini file to finish processing.")
        time.sleep(GEMINI_FILE_POLL_INTERVAL)


def upload_file_and_wait(path: str, display_name: Optional[str], mime_type: Optional[str]):
    """Upload a file to Gemini and wait for processing to complete."""
    if not genai_client or not GEMINI_API_KEY:
        raise RuntimeError("Gemini client is not available.")

    upload_kwargs: Dict[str, Any] = {"file": path}
    if display_name:
        upload_kwargs["display_name"] = display_name
    if mime_type:
        upload_kwargs["mime_type"] = mime_type

    uploaded = genai_client.files.upload(**upload_kwargs)
    state = getattr(uploaded, "state", None)
    state_name = getattr(state, "name", None) if hasattr(state, "name") else state
    if isinstance(state_name, str) and state_name.upper() == "ACTIVE":
        return uploaded
    return wait_for_gemini_file_ready(uploaded)


def serialize_gemini_file(file_obj: Any) -> GeminiFile:
    """Convert a google.generativeai File into a serializable schema."""

    def _to_int(value: Any) -> Optional[int]:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _to_str(value: Any) -> Optional[str]:
        if isinstance(value, datetime):
            return value.isoformat()
        if value is None:
            return None
        return str(value)

    state = getattr(file_obj, "state", None)
    state_name = getattr(state, "name", None) if hasattr(state, "name") else state
    if isinstance(state_name, str):
        state_name = state_name.upper()

    return GeminiFile(
        name=getattr(file_obj, "name", ""),
        display_name=getattr(file_obj, "display_name", None),
        mime_type=getattr(file_obj, "mime_type", None),
        uri=getattr(file_obj, "uri", None),
        download_uri=getattr(file_obj, "download_uri", None),
        size_bytes=_to_int(
            getattr(file_obj, "size_bytes", None)
            or getattr(file_obj, "sizeBytes", None)
        ),
        state=state_name,
        create_time=_to_str(
            getattr(file_obj, "create_time", None)
            or getattr(file_obj, "createTime", None)
        ),
        update_time=_to_str(
            getattr(file_obj, "update_time", None)
            or getattr(file_obj, "updateTime", None)
        ),
    )


def _timestamp_ms_to_datetime(timestamp_ms: Optional[int]) -> datetime:
    if timestamp_ms is None:
        return datetime.utcnow()
    try:
        normalized = datetime.fromtimestamp(int(timestamp_ms) / 1000, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        normalized = datetime.utcnow().replace(tzinfo=timezone.utc)
    return normalized.replace(tzinfo=None)


def _datetime_to_ms(value: Optional[datetime]) -> int:
    base = value or datetime.utcnow()
    if base.tzinfo is None:
        aware = base.replace(tzinfo=timezone.utc)
    else:
        aware = base.astimezone(timezone.utc)
    return int(aware.timestamp() * 1000)


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
    rows = await db.fetch_all(
        proactivity_logs.select()
        .where(proactivity_logs.c.user_id == user_id)
        .order_by(proactivity_logs.c.activity_date.desc())
    )

    qualifying_days: List[date] = []
    seen: set[date] = set()

    for row in rows:
        if row["score"] is not None and row["score"] < 70:
            continue
        day = _coerce_activity_day(row["activity_date"])
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
    query = user_streaks.select().where(user_streaks.c.user_id == user_id)
    streak = await db.fetch_one(query)
    if not streak:
        # Create new streak record with explicit timestamps
        from datetime import datetime
        now = datetime.utcnow()
        create_query = user_streaks.insert().values(
            user_id=user_id,
            current_streak=0,
            last_activity_date=None,
            created_at=now,
            updated_at=now
        )
        streak_id = await db.execute(create_query)
        select_query = user_streaks.select().where(user_streaks.c.id == streak_id)
        streak = await db.fetch_one(select_query)
    return streak

async def update_user_streak(user_id: int, db: databases.Database):
    """Update user streak based on daily activity"""
    from datetime import datetime, date

    today = datetime.utcnow().date()
    streak = await get_or_create_user_streak(user_id, db)

    # Check if last activity was yesterday
    if streak['last_activity_date']:
        last_activity = streak['last_activity_date'].date()
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

    # Update streak record
    update_query = user_streaks.update().where(
        user_streaks.c.user_id == user_id
    ).values(
        current_streak=new_streak,
        last_activity_date=datetime.utcnow()
    )
    await db.execute(update_query)

    # Return updated streak
    select_query = user_streaks.select().where(user_streaks.c.user_id == user_id)
    updated_streak = await db.fetch_one(select_query)
    return updated_streak

# API Routes

@app.get("/")
async def root():
    return {"message": "User Profile API with AI Chat"}

# AI Chat helper functions
async def get_or_create_conversation(conversation_id: Optional[str], user_id: int) -> str:
    """Get existing conversation or create new one with robust error handling."""
    if conversation_id and _should_use_conversation_store(conversation_id):
        try:
            # Check if conversation exists
            # Use asyncio.wait_for to prevent hanging
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: supabase.table("conversations")
                    .select("id, history, user_id")
                    .eq("id", conversation_id)
                    .execute()
                ),
                timeout=_supabase_timeout_seconds
            )
            if result.data:
                record = result.data[0]
                if user_id and not record.get("user_id"):
                    try:
                        await asyncio.wait_for(
                            asyncio.to_thread(
                                lambda: supabase.table("conversations")
                                .update({"user_id": user_id})
                                .eq("id", conversation_id)
                                .execute()
                            ),
                            timeout=_supabase_timeout_seconds,
                        )
                    except Exception as attach_error:
                        _handle_conversation_store_error("Error assigning user to conversation", attach_error)
                return conversation_id
        except asyncio.TimeoutError:
            _handle_conversation_store_error("Error checking conversation (timeout)", None)
        except Exception as error:
            _handle_conversation_store_error("Error checking conversation", error)

    if _conversation_store_available():
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: supabase.table("conversations").insert({
                        "title": "New Chat",
                        "history": [],
                        "user_id": user_id,
                    }).execute()
                ),
                timeout=_supabase_timeout_seconds
            )
            if result.data:
                return result.data[0]["id"]
        except asyncio.TimeoutError:
            _handle_conversation_store_error("Error creating conversation (timeout)", None)
        except Exception as error:
            _handle_conversation_store_error("Error creating conversation", error)

    # Fallback: return a mock ID
    import uuid
    candidate_id = conversation_id or str(uuid.uuid4())
    async with LOCAL_CONVERSATION_LOCK:
        LOCAL_CONVERSATION_STORE.setdefault(candidate_id, [])
    await _touch_local_conversation_metadata(candidate_id, title="New Chat", user_id=user_id)
    return candidate_id

async def save_conversation_message(conversation_id: str, message: Dict[str, Any]):
    """Save message to conversation history with timeout protection."""
    async def _append_locally() -> None:
        await _append_local_conversation_message(conversation_id, message)
        await _touch_local_conversation_metadata(conversation_id)

    if not _should_use_conversation_store(conversation_id):
        await _append_locally()
        return

    try:
        # Get current history with timeout
        result = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.table("conversations").select("history").eq("id", conversation_id).execute()
            ),
            timeout=_supabase_timeout_seconds
        )
        if result.data:
            history = result.data[0]["history"] or []
            history.append(message)
            timestamp = datetime.utcnow().isoformat()

            # Update conversation with timeout
            await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: supabase.table("conversations").update({
                        "history": history,
                        "updated_at": timestamp
                    }).eq("id", conversation_id).execute()
                ),
                timeout=_supabase_timeout_seconds
            )
            await _cache_local_conversation_history(conversation_id, history)
        else:
            await _append_locally()
    except asyncio.TimeoutError:
        _handle_conversation_store_error("Error saving message (timeout)", None)
        await _append_locally()
    except Exception as error:
        _handle_conversation_store_error("Error saving message", error)
        await _append_locally()


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
    """Generate a concise chat title using Gemini Flash Lite."""
    trimmed = (message or "").strip()
    if not trimmed:
        return None
    if not GEMINI_API_KEY or not genai_client:
        return None

    prompt = (
        "Generate a concise yet descriptive chat title summarizing the following user query. "
        "Respond with Title Case, avoid quotes or trailing punctuation, and aim for 4-10 words "
        "when it helps clarity (never exceed 12 words). Favor specific key concepts over generic greetings.\n\n"
        f"User query:\n{trimmed}"
    )

    try:
        def _run_generation():
            return genai_client.models.generate_content(
                model=GEMINI_TITLE_MODEL_NAME,
                contents=[prompt],
            )

        response = await asyncio.to_thread(_run_generation)
        text_response = _extract_response_text(response)

        cleaned = " ".join(text_response.strip().split())
        if not cleaned:
            return None

        first_line = cleaned.split("\n", 1)[0].strip()
        normalized = first_line.strip('"').strip("'")
        normalized = normalized.rstrip(".")
        if not normalized:
            return None
        # Cap overly long results to keep sidebar tidy
        return normalized[:80].strip()
    except Exception as error:  # pragma: no cover - best effort logging
        print(f"Gemini title generation error: {error}")
        return None


def _prepare_gemini_contents(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    attachments: Optional[List[GeminiAttachment]] = None,
) -> List[Dict[str, Any]]:
    """Build the Gemini content payload shared by streaming and non-streaming calls."""
    history: List[Dict[str, Any]] = list((conversation_history or [])[-10:])
    include_current = True
    if history:
        last_entry = history[-1]
        if last_entry.get("role") == "user" and last_entry.get("text") == message:
            include_current = False
            if attachments and not last_entry.get("attachments"):
                last_entry["attachments"] = [
                    attachment.dict(exclude_none=True) for attachment in attachments
                ]
    if include_current:
        history.append(
            {
                "role": "user",
                "text": message,
                "attachments": [
                    attachment.dict(exclude_none=True) for attachment in attachments
                ]
                if attachments
                else None,
            }
        )

    def build_parts(entry: Dict[str, Any]) -> List[Dict[str, Any]]:
        parts: List[Dict[str, Any]] = []
        for attachment in entry.get("attachments") or []:
            if not attachment:
                continue
            if isinstance(attachment, dict):
                uri = attachment.get("uri")
                mime_type = attachment.get("mime_type")
            else:
                uri = getattr(attachment, "uri", None)
                mime_type = getattr(attachment, "mime_type", None)
            if uri and mime_type:
                parts.append(
                    {
                        "file_data": {
                            "file_uri": uri,
                            "mime_type": mime_type,
                        }
                    }
                )
        text = entry.get("text")
        if text:
            parts.append({"text": text})
        return parts

    contents: List[Dict[str, Any]] = []
    system_parts: List[str] = []
    if system_prompt:
        trimmed_prompt = system_prompt.strip()
        if trimmed_prompt:
            system_parts.append(trimmed_prompt)
    if workspace_context:
        trimmed_context = workspace_context.strip()
        if trimmed_context:
            system_parts.append(f"Workspace context:\n{trimmed_context}")
    if system_parts:
        contents.append(
            {
                "role": "user",
                "parts": [{"text": "\n\n".join(system_parts)}],
            }
        )

    for entry in history:
        parts = build_parts(entry)
        if not parts:
            continue
        role = "user" if entry.get("role") == "user" else "model"
        contents.append({"role": role, "parts": parts})

    if not contents:
        contents.append({"role": "user", "parts": [{"text": message}]})

    return contents


def _extract_response_text(candidate: Any) -> str:
    """Extract text from a Gemini response or chunk."""
    if not candidate:
        return ""

    if isinstance(candidate, str):
        return candidate

    text_attr = getattr(candidate, "text", None)
    if isinstance(text_attr, str) and text_attr.strip():
        return text_attr

    content = getattr(candidate, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if parts:
        texts = [
            getattr(part, "text", None)
            for part in parts
            if getattr(part, "text", None)
        ]
        if texts:
            return "\n".join(texts)

    candidates = getattr(candidate, "candidates", None) or []
    for entry in candidates:
        entry_content = getattr(entry, "content", None)
        entry_parts = getattr(entry_content, "parts", None) if entry_content else None
        if not entry_parts:
            continue
        texts = [
            getattr(part, "text", None)
            for part in entry_parts
            if getattr(part, "text", None)
        ]
        if texts:
            return "\n".join(texts)
    return ""


async def stream_ai_response(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    attachments: Optional[List[GeminiAttachment]] = None,
) -> AsyncGenerator[Tuple[str, str], None]:
    """Stream Gemini response chunks, falling back to the legacy flow if streaming fails."""
    if genai_client and GEMINI_API_KEY:
        try:
            contents = _prepare_gemini_contents(
                message,
                conversation_history,
                workspace_context,
                system_prompt,
                attachments,
            )
            loop = asyncio.get_running_loop()
            queue: asyncio.Queue[Tuple[str, Any]] = asyncio.Queue()
            stop_event = threading.Event()

            def push(item: Tuple[str, Any]):
                asyncio.run_coroutine_threadsafe(queue.put(item), loop)

            def worker():
                try:
                    stream_callable = getattr(
                        getattr(genai_client, "models", None),
                        "generate_content_stream",
                        None,
                    )
                    generation_kwargs = _build_generation_kwargs(contents)
                    if callable(stream_callable):
                        response_stream = stream_callable(
                            **generation_kwargs,
                        )
                    else:
                        stream_kwargs = dict(generation_kwargs)
                        stream_kwargs["stream"] = True
                        response_stream = genai_client.models.generate_content(**stream_kwargs)
                    aggregated = ""
                    for chunk in response_stream:
                        if stop_event.is_set():
                            break
                        delta = _extract_response_text(chunk)
                        if not delta:
                            continue
                        aggregated += delta
                        for piece in _chunk_response_text(delta):
                            if piece:
                                push(("delta", piece))
                    if not stop_event.is_set():
                        push(("final", aggregated))
                except Exception as worker_error:
                    push(("error", worker_error))
                finally:
                    push(("stop", ""))

            threading.Thread(target=worker, daemon=True).start()

            while True:
                kind, payload = await queue.get()
                if kind == "delta":
                    yield ("delta", payload)
                elif kind == "final":
                    yield ("final", payload)
                elif kind == "error":
                    raise payload
                elif kind == "stop":
                    break
            return
        except Exception as streaming_error:
            print(f"Gemini streaming error: {streaming_error}")

    fallback_response = await generate_ai_response(
        message,
        conversation_history=conversation_history,
        workspace_context=workspace_context,
        system_prompt=system_prompt,
        attachments=attachments,
    )
    visible = _extract_ai_section(fallback_response)
    for fragment in _chunk_response_text(visible):
        if fragment:
            yield ("delta", fragment)
    yield ("final", fallback_response)


async def generate_ai_response(
    message: str,
    conversation_history: List[Dict[str, Any]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    attachments: Optional[List[GeminiAttachment]] = None,
) -> str:
    """Generate AI response using Gemini or fallback"""
    if genai_client and GEMINI_API_KEY:
        try:
            contents = _prepare_gemini_contents(
                message,
                conversation_history,
                workspace_context,
                system_prompt,
                attachments,
            )
            def _run_generation():
                generation_kwargs = _build_generation_kwargs(contents)
                response = genai_client.models.generate_content(**generation_kwargs)
                return _extract_response_text(response)

            extracted = await asyncio.to_thread(_run_generation)
            if extracted:
                return extracted
        except Exception as e:
            print(f"Gemini API error: {e}")

    # Fallback response
    fallback_options = [
        (
            "Reviewing the latest message to choose a helpful follow-up.",
            "That's an interesting point! Could you tell me more about what you're thinking?",
        ),
        (
            "Considering next steps the user might appreciate.",
            "I appreciate you sharing that. Let me think about how I can best help you.",
        ),
        (
            "Looking for the most useful direction to take the conversation.",
            "Thanks for your message! What would you like to explore further?",
        ),
        (
            "Assessing what resources or clarification might support the user.",
            "I understand. How can I assist you with this topic?",
        ),
        (
            "Gathering my thoughts to provide a concise suggestion.",
            "That's a great question! Here's what comes to mind...",
        ),
    ]
    import random
    thinking, reply_text = random.choice(fallback_options)
    return _format_structured_ai_reply(message, thinking, reply_text)


AI_SECTION_PATTERN = re.compile(r"ai:\s*(.*)$", re.IGNORECASE | re.DOTALL)
TOKEN_SPLIT_REGEX = re.compile(r"(\s+)")


def _extract_ai_section(structured_text: str) -> str:
    """Extract the AI-visible section from a structured response."""
    if not structured_text:
        return ""
    match = AI_SECTION_PATTERN.search(structured_text)
    if match:
        return match.group(1)
    return structured_text


def _chunk_response_text(text: str, max_chunk_size: int = 48):
    """Yield small chunks from the response text to simulate token-level streaming."""
    if not text:
        return

    for fragment in TOKEN_SPLIT_REGEX.split(text):
        if not fragment:
            continue
        if fragment.isspace():
            yield fragment
            continue
        start = 0
        while start < len(fragment):
            yield fragment[start:start + max_chunk_size]
            start += max_chunk_size


def _sse_event(event: str, payload: Dict[str, Any]) -> str:
    """Serialize an SSE event."""
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


# Gemini file endpoints
@app.post("/api/files/upload", response_model=GeminiFile)
async def upload_media_file(
    file: UploadFile = File(...),
    display_name: Optional[str] = Form(None),
):
    """Upload a media file to Gemini and return the processed metadata."""
    if not GEMINI_API_KEY or genai_client is None:
        raise HTTPException(status_code=400, detail="Gemini API key is not configured.")

    temp_path = await persist_upload_file(file)
    try:
        processed_file = await asyncio.to_thread(
            upload_file_and_wait,
            temp_path,
            display_name or file.filename,
            file.content_type,
        )
    except HTTPException:
        raise
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - best effort logging
        raise HTTPException(status_code=500, detail=f"Gemini upload failed: {exc}") from exc
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass

    return serialize_gemini_file(processed_file)


# AI Chat endpoints
@app.post("/api/chat/title", response_model=ChatTitleResponse)
async def create_chat_title(request: ChatTitleRequest):
    """Generate a chat title suggestion using Gemini Flash Lite."""
    suggestion: Optional[str] = None
    try:
        suggestion = await generate_chat_title_suggestion(request.message)
    except Exception as error:  # pragma: no cover - best effort logging
        print(f"Title generation error: {error}")
    if suggestion:
        return ChatTitleResponse(title=suggestion)
    return ChatTitleResponse(title=_fallback_title_from_message(request.message))


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest, db: databases.Database = Depends(get_database)):
    """Send a message to AI and get a response"""
    try:
        # Get or create conversation
        conversation_id = await get_or_create_conversation(request.conversation_id, request.user_id)

        # Save user message
        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": request.message
        }
        if request.attachments:
            user_message_payload["attachments"] = [
                attachment.dict(exclude_none=True) for attachment in request.attachments
            ]

        await save_conversation_message(conversation_id, user_message_payload)
        _schedule_conversation_title_update(conversation_id, request.message)

        # Get conversation history for context
        conversation_history = []
        if _should_use_conversation_store(conversation_id):
            try:
                result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
                if result.data:
                    conversation_history = result.data[0]["history"] or []
            except Exception as error:
                _handle_conversation_store_error("Error getting conversation history", error)
        elif conversation_id:
            async with LOCAL_CONVERSATION_LOCK:
                conversation_history = list(LOCAL_CONVERSATION_STORE.get(conversation_id, []))

        # Generate AI response
        ai_response = await generate_ai_response(
            request.message,
            conversation_history,
            request.context,
            request.system_prompt,
            request.attachments,
        )

        # Save AI response
        await save_conversation_message(conversation_id, {
            "role": "model",
            "text": ai_response
        })

        # Update user streak for daily activity
        await update_user_streak(request.user_id, db)

        return ChatResponse(response=ai_response, conversation_id=conversation_id)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/api/chat/stream")
async def chat_with_ai_stream(request: ChatRequest, db: databases.Database = Depends(get_database)):
    """Stream an AI response token-by-token using Server-Sent Events."""
    try:
        conversation_id = await get_or_create_conversation(request.conversation_id, request.user_id)

        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": request.message,
        }
        if request.attachments:
            user_message_payload["attachments"] = [
                attachment.dict(exclude_none=True) for attachment in request.attachments
            ]

        await save_conversation_message(conversation_id, user_message_payload)
        _schedule_conversation_title_update(conversation_id, request.message)

        conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id)

        async def event_stream() -> AsyncGenerator[str, None]:
            try:
                accumulated_visible = ""
                final_response: Optional[str] = None
                async for kind, payload in stream_ai_response(
                    request.message,
                    conversation_history,
                    request.context,
                    request.system_prompt,
                    request.attachments,
                ):
                    if kind == "delta":
                        if not payload:
                            continue
                        accumulated_visible += payload
                        yield _sse_event("token", {"delta": payload})
                        if STREAMING_TOKEN_DELAY:
                            await asyncio.sleep(STREAMING_TOKEN_DELAY)
                        else:
                            await asyncio.sleep(0)
                    elif kind == "final":
                        if payload:
                            final_response = payload

                if final_response is None:
                    final_response = accumulated_visible

                await save_conversation_message(
                    conversation_id,
                    {
                        "role": "model",
                        "text": final_response,
                    },
                )

                await update_user_streak(request.user_id, db)

                yield _sse_event(
                    "end",
                    {
                        "conversation_id": conversation_id,
                        "response": final_response,
                    },
                )
            except Exception as stream_error:  # pragma: no cover - best effort logging
                yield _sse_event("error", {"message": str(stream_error)})

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
        return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
    except Exception as error:
        async def error_stream() -> AsyncGenerator[str, None]:
            yield _sse_event("error", {"message": str(error)})

        return StreamingResponse(error_stream(), status_code=500, media_type="text/event-stream")

@app.get("/api/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation history with robust error handling."""
    try:
        return await _load_conversation_history(conversation_id)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(error)}")


@app.get("/api/conversation/{conversation_id}/usage", response_model=ConversationUsageResponse)
async def get_conversation_usage(conversation_id: str):
    """Return token usage statistics for a conversation."""
    try:
        history = await _load_conversation_history(conversation_id)
        usage = _compute_conversation_usage(history)
        provider, model_name, model_label, limit = resolve_context_limit_info()
        return ConversationUsageResponse(
            conversation_id=conversation_id,
            message_count=usage["message_count"],
            conversation_tokens=usage["conversation_tokens"],
            limit=limit,
            provider=provider,
            model_name=model_name,
            model_label=model_label,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error computing conversation usage: {str(error)}")


@app.get("/users/{user_id}/conversations", response_model=List[ConversationSummary])
async def get_user_conversations(user_id: int, limit: int = 100):
    """Return recent conversations for the specified user."""
    try:
        return await _load_user_conversations(user_id, limit)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching conversations: {str(error)}")


@app.patch("/api/conversation/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(conversation_id: str, update: ConversationUpdate):
    """Update conversation metadata such as title or ownership."""
    if not _conversation_store_available() or not _is_valid_uuid(conversation_id):
        local_record = await _touch_local_conversation_metadata(
            conversation_id,
            title=update.title,
            user_id=update.user_id,
        )
        return {
            "id": local_record.get("id", conversation_id),
            "title": local_record.get("title") or update.title or "New Chat",
            "created_at": local_record.get("created_at") or datetime.utcnow().isoformat(),
            "updated_at": local_record.get("updated_at") or datetime.utcnow().isoformat(),
        }

    payload: Dict[str, Any] = {}
    if update.title is not None:
        payload["title"] = update.title
    if update.user_id is not None:
        payload["user_id"] = update.user_id

    # Always bump the timestamp when we change metadata
    payload["updated_at"] = datetime.utcnow().isoformat()

    try:
        await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.table("conversations")
                .update(payload)
                .eq("id", conversation_id)
                .execute()
            ),
            timeout=_supabase_timeout_seconds,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Conversation update timed out")
    except Exception as error:
        _handle_conversation_store_error("Error updating conversation metadata", error)
        raise HTTPException(status_code=500, detail="Failed to update conversation metadata")

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                lambda: supabase.table("conversations")
                .select("id,title,created_at,updated_at")
                .eq("id", conversation_id)
                .limit(1)
                .execute()
            ),
            timeout=_supabase_timeout_seconds,
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Conversation not found")
        record = result.data[0]
        return {
            "id": record.get("id"),
            "title": record.get("title"),
            "created_at": record.get("created_at") or datetime.utcnow().isoformat(),
            "updated_at": record.get("updated_at") or datetime.utcnow().isoformat(),
        }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Conversation lookup timed out")
    except HTTPException:
        raise
    except Exception as error:
        _handle_conversation_store_error("Error fetching updated conversation", error)
        raise HTTPException(status_code=500, detail="Failed to load updated conversation metadata")


@app.post("/api/conversation")
async def create_conversation(request: ChatSessionCreate):
    """Create a new conversation with robust error handling."""
    try:
        if not _conversation_store_available():
            import uuid
            fallback_id = str(uuid.uuid4())
            await _touch_local_conversation_metadata(fallback_id, title=request.title, user_id=request.user_id)
            return {"id": fallback_id, "title": request.title, "history": []}

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    lambda: supabase.table("conversations").insert({
                        "title": request.title,
                        "history": []
                    }).execute()
                ),
                timeout=_supabase_timeout_seconds
            )

            if result.data:
                return result.data[0]
            else:
                raise HTTPException(status_code=500, detail="Failed to create conversation")
        except asyncio.TimeoutError:
            _handle_conversation_store_error("Warning: Conversation creation timed out", None)
            import uuid
            fallback_id = str(uuid.uuid4())
            await _touch_local_conversation_metadata(fallback_id, title=request.title, user_id=request.user_id)
            return {"id": fallback_id, "title": request.title, "history": []}
        except Exception as supabase_error:
            # Handle missing table gracefully
            _handle_conversation_store_error("Warning: Conversations table not found or inaccessible", supabase_error)
            import uuid
            fallback_id = str(uuid.uuid4())
            await _touch_local_conversation_metadata(fallback_id, title=request.title, user_id=request.user_id)
            return {"id": fallback_id, "title": request.title, "history": []}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(e)}")

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
        initials=initials,
        personalization_nickname=user.personalization_nickname,
        personalization_occupation=user.personalization_occupation,
        personalization_about=user.personalization_about,
        personalization_custom_instructions=user.personalization_custom_instructions,
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

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int, db: databases.Database = Depends(get_database)):
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/email/{email}", response_model=User)
async def get_user_by_email(email: str, db: databases.Database = Depends(get_database)):
    query = users.select().where(users.c.email == email)
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

@app.get("/users/{user_id}/chat-sessions", response_model=List[ChatSession])
async def get_user_chat_sessions(user_id: int, db: databases.Database = Depends(get_database)):
    query = chat_sessions.select().where(chat_sessions.c.user_id == user_id).order_by(chat_sessions.c.updated_at.desc())
    return await db.fetch_all(query)

@app.post("/users/{user_id}/chat-sessions", response_model=ChatSession, status_code=status.HTTP_201_CREATED)
async def create_chat_session(user_id: int, session: ChatSessionCreate, db: databases.Database = Depends(get_database)):
    query = chat_sessions.insert().values(
        user_id=user_id,
        title=session.title
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
async def get_user_plans(user_id: int, db: databases.Database = Depends(get_database)):
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/plans", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(user_id: int, plan: PlanCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    plan_id = await db.execute(
        plans.insert().values(
            user_id=user_id,
            label=plan.label,
            completed=plan.completed,
            deadline=plan.deadline,
            schedule_slot=plan.schedule_slot,
            created_at=now,
            updated_at=now,
        )
    )
    query = plans.select().where(plans.c.id == plan_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/plans/{plan_id}", response_model=Plan)
async def update_plan(user_id: int, plan_id: int, plan_update: PlanUpdate, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(
        plans.select().where(
            (plans.c.id == plan_id) & (plans.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = plan_update.dict(exclude_unset=True)
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
    # Check if plan exists and belongs to user
    query = plans.select().where(
        (plans.c.id == plan_id) & (plans.c.user_id == user_id)
    )
    existing = await db.fetch_one(query)

    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Delete the plan
    delete_query = plans.delete().where(
        (plans.c.id == plan_id) & (plans.c.user_id == user_id)
    )
    await db.execute(delete_query)
    return None

@app.get("/users/{user_id}/habits", response_model=List[Habit])
async def get_user_habits(user_id: int, db: databases.Database = Depends(get_database)):
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/habits", response_model=Habit, status_code=status.HTTP_201_CREATED)
async def create_habit(user_id: int, habit: HabitCreate, db: databases.Database = Depends(get_database)):
    now = datetime.utcnow()
    habit_id = await db.execute(
        habits.insert().values(
            user_id=user_id,
            label=habit.label,
            streak_label=habit.streak_label,
            previous_label=habit.previous_label,
            created_at=now,
            updated_at=now,
        )
    )
    query = habits.select().where(habits.c.id == habit_id)
    return await db.fetch_one(query)

@app.patch("/users/{user_id}/habits/{habit_id}", response_model=Habit)
async def update_habit(user_id: int, habit_id: int, habit_update: HabitUpdate, db: databases.Database = Depends(get_database)):
    existing = await db.fetch_one(
        habits.select().where(
            (habits.c.id == habit_id) & (habits.c.user_id == user_id)
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")

    update_data = habit_update.dict(exclude_unset=True)
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
    # Check if habit exists and belongs to user
    query = habits.select().where(
        (habits.c.id == habit_id) & (habits.c.user_id == user_id)
    )
    existing = await db.fetch_one(query)

    if not existing:
        raise HTTPException(status_code=404, detail="Habit not found")

    # Delete the habit
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
async def get_user_calendar_events(user_id: int, db: databases.Database = Depends(get_database)):
    # Fixed query to avoid calendar_id column references
    query = calendar_events.select().where(calendar_events.c.user_id == user_id).order_by(calendar_events.c.start_time)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/calendar-events", response_model=CalendarEvent, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(user_id: int, event: CalendarEventCreate, db: databases.Database = Depends(get_database)):
    query = calendar_events.insert().values(
        user_id=user_id,
        calendar_id=event.calendar_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time
    )
    event_id = await db.execute(query)

    # Fetch the created event to get the auto-generated created_at value
    fetch_query = calendar_events.select().where(calendar_events.c.id == event_id)
    created_event = await db.fetch_one(fetch_query)

    return created_event

@app.patch("/users/{user_id}/calendar-events/{event_id}", response_model=CalendarEvent)
async def update_calendar_event(user_id: int, event_id: int, event: CalendarEventUpdate, db: databases.Database = Depends(get_database)):
    # Build dynamic update query
    update_values = {}
    if event.title is not None:
        update_values["title"] = event.title
    if event.description is not None:
        update_values["description"] = event.description
    if event.start_time is not None:
        update_values["start_time"] = event.start_time
    if event.end_time is not None:
        update_values["end_time"] = event.end_time
    if event.calendar_id is not None:
        update_values["calendar_id"] = event.calendar_id

    query = calendar_events.update().where(
        calendar_events.c.id == event_id,
        calendar_events.c.user_id == user_id
    ).values(**update_values)

    await db.execute(query)

    # Fetch the updated event
    fetch_query = calendar_events.select().where(calendar_events.c.id == event_id)
    updated_event = await db.fetch_one(fetch_query)

    return updated_event

@app.delete("/users/{user_id}/calendar-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(user_id: int, event_id: int, db: databases.Database = Depends(get_database)):
    query = calendar_events.delete().where(
        calendar_events.c.id == event_id,
        calendar_events.c.user_id == user_id
    )
    await db.execute(query)
    return None

# Dashboard API endpoints
@app.get("/users/{user_id}/dashboard/pulses", response_model=List[DashboardPulse])
async def list_dashboard_pulses(
    user_id: int,
    limit: int = MAX_DASHBOARD_PULSE_HISTORY,
    db: databases.Database = Depends(get_database),
):
    safe_limit = max(1, min(limit, MAX_DASHBOARD_PULSE_HISTORY))
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
    return {**proactivity.dict(), "id": log_id, "user_id": user_id}

@app.post("/users/{user_id}/proactivity/daily-checkin", response_model=ProactivityLog)
async def daily_proactivity_checkin(
    user_id: int,
    checkin: DailyCheckIn,
    db: databases.Database = Depends(get_database)
):
    """Daily proactivity check-in - creates or updates today's proactivity log"""
    from datetime import datetime
    from sqlalchemy import func

    today = datetime.utcnow().date()

    # Check if there's already a log for today
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

# Proactive Notification Endpoints

@app.get("/users/{user_id}/notifications", response_model=List[ProactiveNotification])
async def get_user_notifications(
    user_id: int,
    unread_only: bool = False,
    limit: int = 50,
    db: databases.Database = Depends(get_database)
):
    """Get proactive notifications for a user"""
    query = proactive_notifications.select().where(
        proactive_notifications.c.user_id == user_id
    )

    if unread_only:
        query = query.where(proactive_notifications.c.read_at.is_(None))

    query = query.order_by(
        proactive_notifications.c.sent_at.desc()
    ).limit(limit)

    results = await db.fetch_all(query)

    notifications = []
    for result in results:
        notifications.append({
            "id": result.id,
            "user_id": result.user_id,
            "type": result.type,
            "title": result.title,
            "message": result.message,
            "metadata": result.metadata,
            "due_at": result.due_at,
            "sent_at": result.sent_at,
            "read_at": result.read_at,
            "completed_at": result.completed_at,
            "created_at": result.created_at
        })

    return notifications

@app.post("/users/{user_id}/notifications/{notification_id}/read", response_model=dict)
async def mark_notification_read(
    user_id: int,
    notification_id: int,
    db: databases.Database = Depends(get_database)
):
    """Mark a notification as read"""
    query = proactive_notifications.update().where(
        (proactive_notifications.c.id == notification_id) &
        (proactive_notifications.c.user_id == user_id)
    ).values(
        read_at=datetime.utcnow()
    )

    await db.execute(query)
    return {"status": "success", "notification_id": notification_id}

@app.post("/users/{user_id}/notifications/{notification_id}/complete", response_model=dict)
async def mark_notification_complete(
    user_id: int,
    notification_id: int,
    db: databases.Database = Depends(get_database)
):
    """Mark a notification as completed"""
    query = proactive_notifications.update().where(
        (proactive_notifications.c.id == notification_id) &
        (proactive_notifications.c.user_id == user_id)
    ).values(
        completed_at=datetime.utcnow()
    )

    await db.execute(query)
    return {"status": "success", "notification_id": notification_id}

@app.post("/users/{user_id}/notifications/{notification_id}/dismiss", response_model=dict)
async def dismiss_notification(
    user_id: int,
    notification_id: int,
    db: databases.Database = Depends(get_database)
):
    """Dismiss a notification (mark as read without completing)"""
    query = proactive_notifications.update().where(
        (proactive_notifications.c.id == notification_id) &
        (proactive_notifications.c.user_id == user_id)
    ).values(
        read_at=datetime.utcnow()
    )

    await db.execute(query)
    return {"status": "success", "notification_id": notification_id}

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

# API Key Management Endpoints
@app.post("/users/{user_id}/api-keys", response_model=APIKey, status_code=status.HTTP_201_CREATED)
async def store_api_key(user_id: int, api_key: APIKeyCreate, db: databases.Database = Depends(get_database)):
    """Store a user's API key for a specific service."""
    if api_key.user_id != user_id:
        raise HTTPException(status_code=400, detail="User ID mismatch")

    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        result = await supabase_service.store_user_api_key(user_id, api_key.service, api_key.api_key)
        if result:
            return APIKey(user_id=user_id, service=api_key.service, api_key=api_key.api_key, created_at=datetime.utcnow())
        raise HTTPException(status_code=500, detail="Failed to store API key")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error storing API key: {str(e)}")

@app.get("/users/{user_id}/api-keys/{service}")
async def get_api_key(user_id: int, service: str):
    """Get a user's API key for a specific service."""
    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        api_key = await supabase_service.get_user_api_key(user_id, service)
        if api_key:
            return {"user_id": user_id, "service": service, "api_key": api_key}
        raise HTTPException(status_code=404, detail="API key not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving API key: {str(e)}")

# Check-in Preferences Endpoints
@app.post("/users/{user_id}/checkin-preferences", response_model=CheckinPreferences)
async def store_checkin_preferences(user_id: int, prefs: CheckinPreferencesCreate, db: databases.Database = Depends(get_database)):
    """Store user's check-in preferences with timezone and schedule."""
    if prefs.user_id != user_id:
        raise HTTPException(status_code=400, detail="User ID mismatch")

    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        result = await supabase_service.store_checkin_preferences(
            user_id,
            prefs.timezone,
            schedule=prefs.schedule,
            enabled=prefs.enabled
        )

        if result is None:
            raise HTTPException(status_code=500, detail="Failed to store check-in preferences")

        # Return updated preferences
        return CheckinPreferences(
            user_id=user_id,
            timezone=prefs.timezone,
            schedule=prefs.schedule,
            enabled=prefs.enabled
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error storing check-in preferences: {str(e)}")

@app.get("/users/{user_id}/checkin-preferences", response_model=Optional[CheckinPreferences])
async def get_checkin_preferences(user_id: int):
    """Get user's check-in preferences."""
    if not supabase_service:
        return None

    try:
        prefs = await supabase_service.get_checkin_preferences(user_id)
        if prefs:
            return CheckinPreferences(
                user_id=user_id,
                timezone=prefs.get("timezone", "UTC"),
                schedule=prefs.get("schedule"),
                enabled=prefs.get("enabled", True),
                updated_at=prefs.get("updated_at"),
                proactive_state=prefs.get("proactive_state")
            )
        return None
    except Exception as e:
        print(f"Error retrieving check-in preferences: {e}")
        return None

# Reminder System Endpoints
@app.post("/users/{user_id}/reminders", response_model=Reminder)
async def create_reminder(
    user_id: int,
    reminder: ReminderCreate,
    db: databases.Database = Depends(get_database)
):
    """Create a new reminder."""
    if reminder.user_id != user_id:
        raise HTTPException(status_code=400, detail="User ID mismatch")

    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        reminder_id = str(uuid_lib.uuid4())

        result = await supabase_service.create_reminder(
            reminder_id=reminder_id,
            user_id=user_id,
            server_id=reminder.server_id,
            channel_id=reminder.channel_id,
            remind_at=reminder.remind_at,
            message=reminder.message,
            metadata=reminder.metadata
        )

        if result:
            return Reminder(
                id=reminder_id,
                user_id=user_id,
                server_id=reminder.server_id,
                channel_id=reminder.channel_id,
                message=reminder.message,
                remind_at=reminder.remind_at,
                status="pending",
                metadata=reminder.metadata,
                created_at=datetime.utcnow()
            )
        raise HTTPException(status_code=500, detail="Failed to create reminder")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating reminder: {str(e)}")

@app.get("/users/{user_id}/reminders/pending", response_model=List[dict])
async def get_pending_reminders(user_id: int):
    """Get user's pending reminders."""
    if not supabase_service:
        return []

    try:
        reminders = await _fetch_pending_reminders(limit=100)
        return [r for r in reminders if int(r.get("user_id", 0)) == user_id]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching reminders: {str(e)}")

@app.delete("/users/{user_id}/reminders/{reminder_id}")
async def delete_reminder(user_id: int, reminder_id: str):
    """Delete a reminder."""
    if not supabase_service:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        result = await supabase_service.delete_reminder(reminder_id)
        if result:
            return {"status": "deleted"}
        raise HTTPException(status_code=404, detail="Reminder not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting reminder: {str(e)}")

# Proactivity State Endpoints
@app.get("/users/{user_id}/proactive-state", response_model=dict)
async def get_proactive_state(user_id: int):
    """Get user's proactive state (last daily briefing, weekly review, etc.)."""
    try:
        state = await _load_proactive_state(user_id)
        return state or {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading proactive state: {str(e)}")

@app.post("/users/{user_id}/proactive-state", response_model=dict)
async def update_proactive_state(user_id: int, state: dict):
    """Update user's proactive state."""
    try:
        await _store_proactive_state(user_id, state)
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating proactive state: {str(e)}")

# Web Search Endpoints
@app.post("/search")
async def web_search(query: str, service: Optional[str] = None, num_results: int = 10):
    """Perform web search using user's API key or fallback."""
    if not query or len(query.strip()) == 0:
        raise HTTPException(status_code=400, detail="Search query is required")

    try:
        # Determine which search service to use
        search_service = service or os.getenv("DEFAULT_SEARCH_SERVICE", "tavily")
        search_results = []

        if search_service == "tavily":
            # Try to get Tavily API key from user or environment
            api_key = os.getenv("TAVILY_API_KEY")
            if not api_key:
                raise HTTPException(status_code=503, detail="Search service API key not configured")

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "query": query,
                        "api_key": api_key,
                        "search_depth": "advanced",
                        "include_answer": True,
                        "include_images": False,
                        "include_raw_content": False,
                        "max_results": num_results,
                    },
                )

                if response.status_code != 200:
                    raise HTTPException(status_code=500, detail="Search service error")

                data = response.json()
                search_results = [
                    {
                        "title": result.get("title", ""),
                        "url": result.get("url", ""),
                        "snippet": result.get("content", ""),
                        "published_date": result.get("published_date"),
                    }
                    for result in data.get("results", [])
                ]

                if data.get("answer"):
                    search_results.insert(0, {
                        "title": "AI Answer",
                        "url": "",
                        "snippet": data["answer"],
                        "published_date": None,
                    })

        elif search_service == "serpapi":
            api_key = os.getenv("SERPAPI_API_KEY")
            if not api_key:
                raise HTTPException(status_code=503, detail="SERPAPI API key not configured")

            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {
                    "engine": "google",
                    "q": query,
                    "api_key": api_key,
                    "num": num_results,
                }
                response = await client.get("https://serpapi.com/search.json", params=params)

                if response.status_code != 200:
                    raise HTTPException(status_code=500, detail="Search service error")

                data = response.json()
                search_results = [
                    {
                        "title": result.get("title", ""),
                        "url": result.get("link", ""),
                        "snippet": result.get("snippet", ""),
                        "published_date": result.get("rich_snippet", {}).get("top", {}).get("detected_extensions", [None])[0],
                    }
                    for result in data.get("organic_results", [])
                ]

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported search service: {search_service}")

        return {
            "query": query,
            "service": search_service,
            "results": search_results,
            "total": len(search_results),
        }

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Search request timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# Proactivity helper functions
def _contains_keyword(text: str, keywords: tuple[str, ...], *, cutoff: float = 0.82) -> bool:
    """Check if text contains keywords with fuzzy matching."""
    import re
    from difflib import SequenceMatcher

    lowered = text.lower()
    for keyword in keywords:
        if keyword in lowered:
            return True

    _TOKEN_PATTERN = re.compile(r"[a-z]+", re.IGNORECASE)
    tokens = _TOKEN_PATTERN.findall(lowered)
    if not tokens:
        return False

    for token in tokens:
        for keyword in keywords:
            if abs(len(token) - len(keyword)) > 3:
                continue
            similarity = SequenceMatcher(None, token, keyword).ratio()
            if similarity >= cutoff:
                return True
    return False


async def _load_proactive_state(user_id: int) -> dict:
    """Load proactive state from Supabase or fallback."""
    if not supabase_service:
        return {}

    try:
        return await supabase_service.get_proactive_state(user_id)
    except Exception as exc:
        print(f"Failed to load proactive state for user {user_id}: {exc}")
        return {}


async def _store_proactive_state(user_id: int, state: dict) -> bool:
    """Store proactive state to Supabase or fallback."""
    if not supabase_service:
        return False

    try:
        return await supabase_service.store_proactive_state(user_id, state)
    except Exception as exc:
        print(f"Failed to store proactive state for user {user_id}: {exc}")
        return False


async def _fetch_pending_reminders(before: Optional[datetime] = None, limit: int = 200) -> list[dict]:
    """Fetch pending reminders with timeout protection."""
    if not supabase_service:
        return []

    try:
        return await supabase_service.fetch_pending_reminders(before=before, limit=limit)
    except Exception as exc:
        print(f"Failed to fetch pending reminders: {exc}")
        return []


async def _update_reminder_status(reminder_id: str, status: str, **extra) -> Optional[bool]:
    """Update reminder status."""
    if not supabase_service:
        return None

    try:
        return await supabase_service.update_reminder_status(reminder_id, status, **extra)
    except Exception as exc:
        print(f"Failed to update reminder {reminder_id}: {exc}")
        return None


async def _record_proactive_event(guild_id: int, event: dict) -> bool:
    """Record a proactive event for resilience."""
    if not supabase_service:
        return False

    try:
        return await supabase_service.record_proactive_event(guild_id, event)
    except Exception as exc:
        print(f"Failed to record proactive event: {exc}")
        return False


async def _poll_proactive_reminders():
    """Background task to poll and process pending reminders."""
    global _proactive_backoff_until, _remote_failure_count

    while True:
        try:
            now = datetime.now(dt_timezone.utc)

            # Check if we're in backoff mode
            if now < _proactive_backoff_until:
                await asyncio.sleep(60)
                continue

            # Fetch pending reminders
            reminders = await _fetch_pending_reminders(before=now, limit=50)

            if not reminders:
                await asyncio.sleep(45)
                continue

            # Process each reminder
            for reminder in reminders:
                try:
                    reminder_id = reminder.get("id")
                    user_id = int(reminder.get("user_id", 0))
                    channel_id = int(reminder.get("channel_id", 0))
                    message = reminder.get("message", "")
                    metadata = reminder.get("metadata", {})

                    if not all([reminder_id, user_id, channel_id, message]):
                        continue

                    # Mark as sent
                    await _update_reminder_status(reminder_id, "sent", sent_at=now.isoformat())

                    # Record proactive event
                    if user_id:
                        event = {
                            "type": "reminder",
                            "user_id": user_id,
                            "channel_id": channel_id,
                            "message": message,
                            "timestamp": now.isoformat(),
                            "reminder_id": reminder_id,
                        }
                        await _record_proactive_event(user_id, event)

                    print(f"Processed reminder {reminder_id} for user {user_id}")

                except Exception as exc:
                    print(f"Error processing reminder {reminder.get('id', 'unknown')}: {exc}")

            # Reset failure count on success
            _remote_failure_count = 0
            _proactive_backoff_until = datetime.min.replace(tzinfo=dt_timezone.utc)

        except Exception as exc:
            print(f"Error in proactive reminder poller: {exc}")
            _remote_failure_count += 1

            # Exponential backoff on repeated failures
            if _remote_failure_count >= 5:
                backoff_minutes = min(2 ** (_remote_failure_count - 5), 30)
                _proactive_backoff_until = now + timedelta(minutes=backoff_minutes)
                print(f"Entering backoff mode for {backoff_minutes} minutes")

        await asyncio.sleep(45)

# Proactive Notification Background Service
_async_proactive_task = None

async def _proactive_notification_worker():
    """Background worker that checks for and creates proactive notifications"""
    print("[ProactiveNotificationWorker] Starting proactive notification worker")

    while True:
        try:
            await _check_and_create_proactive_notifications()
        except Exception as exc:
            print(f"[ProactiveNotificationWorker] Error: {exc}")

        # Check every 60 seconds
        await asyncio.sleep(60)

async def _check_and_create_proactive_notifications():
    """Check for users who need proactive notifications and create them with AI-powered messages"""
    try:
        # Get all users with proactivity configured
        db = database
        await db.connect()

        # Get users who have set up proactivity
        query = sqlalchemy.text("""
            SELECT DISTINCT dp.user_id, dp.proactivity, dp.date_key, dp.plans, dp.habits, dp.timestamp
            FROM dashboard_pulses dp
            WHERE dp.proactivity IS NOT NULL
            AND dp.proactivity != '{}'
        """)

        results = await db.fetch_all(query)

        now = datetime.utcnow()
        ai_generator = AIMessageGenerator()

        for row in results:
            user_id = row["user_id"]
            proactivity = row["proactivity"]
            date_key = row["date_key"]
            plans = row["plans"] or []
            habits = row["habits"] or []
            pulse_timestamp = row["timestamp"]

            if not proactivity or "time" not in proactivity:
                continue

            # Check if it's time for a daily check-in
            time_str = proactivity.get("time", "09:00 AM")
            cadence = proactivity.get("cadence", "Daily")
            timezone_str = "UTC+07:00"  # Asia/Jakarta is UTC+7, could be made configurable

            # Parse time string like "09:00 AM" to get just the hour for checking
            # For now, we'll send check-ins if the user has Daily/Frequent cadence configured

            # Check if we already sent a daily check-in today
            existing_daily = await db.fetch_one(
                proactive_notifications.select().where(
                    (proactive_notifications.c.user_id == user_id) &
                    (proactive_notifications.c.type == "daily_checkin") &
                    (proactive_notifications.c.sent_at >= now.replace(hour=0, minute=0, second=0, microsecond=0))
                )
            )

            if not existing_daily and cadence in ["Daily", "Frequent"]:
                # Create AI-powered daily check-in notification
                dashboard_pulse = {
                    "date_key": date_key,
                    "plans": plans,
                    "habits": habits
                }

                try:
                    title, message = await ai_generator.generate_daily_briefing(
                        user_id=user_id,
                        dashboard_pulse=dashboard_pulse,
                        proactivity=proactivity,
                        timezone_str=timezone_str
                    )

                    await db.execute(
                        proactive_notifications.insert().values(
                            user_id=user_id,
                            type="daily_checkin",
                            title=title,
                            message=message,
                            metadata={"date_key": date_key, "cadence": cadence, "time": time_str, "plans_count": len(plans), "habits_count": len(habits)},
                            sent_at=now
                        )
                    )
                    print(f"[ProactiveNotificationWorker] Created AI daily check-in for user {user_id}")

                except Exception as e:
                    print(f"[ProactiveNotificationWorker] Failed to create AI check-in for user {user_id}: {e}")

            # Check if we should send a weekly review (Sundays)
            should_weekly = await ai_generator.should_send_weekly_review(proactive_notifications, user_id, db)
            if should_weekly:
                # Get recent pulses for the week
                week_ago = now - timedelta(days=7)
                recent_pulses_query = sqlalchemy.text("""
                    SELECT dp.plans, dp.habits
                    FROM dashboard_pulses dp
                    WHERE dp.user_id = :user_id
                    AND dp.timestamp >= :week_ago
                    ORDER BY dp.timestamp ASC
                """)
                recent_pulses_results = await db.fetch_all(
                    recent_pulses_query,
                    values={"user_id": user_id, "week_ago": week_ago}
                )
                recent_pulses = [
                    {"plans": r["plans"] or [], "habits": r["habits"] or []}
                    for r in recent_pulses_results
                ]

                try:
                    title, message = await ai_generator.generate_weekly_review(
                        user_id=user_id,
                        recent_pulses=recent_pulses,
                        proactivity=proactivity
                    )

                    await db.execute(
                        proactive_notifications.insert().values(
                            user_id=user_id,
                            type="weekly_review",
                            title=title,
                            message=message,
                            metadata={"week": f"{now.year}-W{now.isocalendar().week:02d}", "pulses_count": len(recent_pulses)},
                            sent_at=now
                        )
                    )
                    print(f"[ProactiveNotificationWorker] Created AI weekly review for user {user_id}")

                except Exception as e:
                    print(f"[ProactiveNotificationWorker] Failed to create weekly review for user {user_id}: {e}")

            # Check if we should send a habit nudge
            try:
                days_since = (now - pulse_timestamp.replace(tzinfo=None)).days
                if days_since >= 3:  # 3+ days since last check-in
                    # Check for unchecked habits
                    unchecked_habits = [
                        h for h in habits
                        if isinstance(h, dict) and h.get("status") not in ["checked", "completed"]
                    ]

                    if unchecked_habits:
                        # Check if we already sent a nudge recently
                        two_days_ago = now - timedelta(days=2)
                        existing_nudge = await db.fetch_one(
                            proactive_notifications.select().where(
                                (proactive_notifications.c.user_id == user_id) &
                                (proactive_notifications.c.type == "habit_nudge") &
                                (proactive_notifications.c.sent_at >= two_days_ago)
                            )
                        )

                        if not existing_nudge:
                            habit = unchecked_habits[0]  # Pick the first unchecked habit
                            title, message = await ai_generator.generate_habit_nudge(
                                user_id=user_id,
                                habit_name=habit.get("name", "your habit"),
                                days_since=days_since
                            )

                            await db.execute(
                                proactive_notifications.insert().values(
                                    user_id=user_id,
                                    type="habit_nudge",
                                    title=title,
                                    message=message,
                                    metadata={
                                        "habit_name": habit.get("name"),
                                        "days_since": days_since
                                    },
                                    sent_at=now
                                )
                            )
                            print(f"[ProactiveNotificationWorker] Created habit nudge for user {user_id}")

            except Exception as e:
                print(f"[ProactiveNotificationWorker] Failed to create habit nudge for user {user_id}: {e}")

        await db.disconnect()

    except Exception as exc:
        print(f"[ProactiveNotificationWorker] Error checking notifications: {exc}")


@app.on_event("startup")
async def startup_proactive_service():
    """Start the proactive notification background service"""
    global _async_proactive_task
    print("[ProactiveNotificationWorker] Starting proactive notification service...")
    _async_proactive_task = asyncio.create_task(_proactive_notification_worker())

@app.on_event("shutdown")
async def shutdown_proactive_service():
    """Stop the proactive notification background service"""
    global _async_proactive_task
    if _async_proactive_task:
        _async_proactive_task.cancel()
        try:
            await _async_proactive_task
        except asyncio.CancelledError:
            pass
        print("[ProactiveNotificationWorker] Stopped proactive notification service")

if __name__ == "__main__":
    import uvicorn

    # Start proactive reminder poller
    print("Starting proactive reminder poller...")
    proactive_task = asyncio.create_task(_poll_proactive_reminders())

    uvicorn.run(app, host="0.0.0.0", port=8000)
