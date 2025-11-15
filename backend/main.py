import socket
from fastapi import FastAPI, HTTPException, Depends, status, File, Form, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, validator
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple, Union, Iterable, Set, Mapping
import databases
import sqlalchemy
from datetime import datetime, timezone, date
import os
import json
import asyncio
import re
import time
from dotenv import load_dotenv
from supabase import create_client, Client
from uuid import UUID, uuid4
from pathlib import Path
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
from backend.file_search import FileSearchService

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


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


AI_PROVIDER = (os.getenv("AI_PROVIDER") or "gemini").strip().lower()

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

DEFAULT_CHAT_TOOLS = [SEARCH_TOOL]

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
database = databases.Database(DATABASE_URL)
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
    sqlalchemy.Column("email", sqlalchemy.String, unique=True, index=True),
    sqlalchemy.Column("full_name", sqlalchemy.String),
    sqlalchemy.Column("profile_picture_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("role", sqlalchemy.String, default="user"),
    sqlalchemy.Column("initials", sqlalchemy.String),
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

DEFAULT_WORKSPACE_BACKGROUNDS: List[Dict[str, Any]] = [
    {
        "slug": "orbiter",
        "label": "Orbiter",
        "description": "STS-84 orbit glow.",
        "preview_css": "linear-gradient(140deg, rgba(12, 18, 32, 0.88), rgba(24, 54, 92, 0.82))",
        "backdrop_css": "linear-gradient(155deg, rgba(4, 6, 10, 0.96), rgba(18, 28, 52, 0.92))",
    },
    {
        "slug": "orbit-walk",
        "label": "Orbit Walk",
        "description": "Quiet focus at zero-g.",
        "preview_css": "linear-gradient(135deg, rgba(8, 12, 22, 0.92), rgba(16, 28, 54, 0.88))",
        "backdrop_css": "linear-gradient(160deg, rgba(3, 5, 9, 0.96), rgba(12, 20, 38, 0.94))",
    },
]

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

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: Optional[str] = None

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
    pass

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

PROACTIVITY_SETTINGS_STORE: Dict[int, ProactivitySettings] = {}

DEFAULT_PROACTIVITY_SETTINGS = ProactivitySettings(
    id="proactivity-default",
    label="Check-ins",
    description="Daily sync nudges for squad channels.",
    cadence="Daily",
    time="09:00",
    times=["09:00"],
    channels=["assistant"],
    timezone="UTC",
)

class PlanBase(BaseModel):
    label: str
    completed: bool = False

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

    model_config = ConfigDict(from_attributes=True)

class PlanUpdate(BaseModel):
    label: Optional[str] = None
    completed: Optional[bool] = None

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
    should_generate_title: bool = False

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    grounding_metadata: Optional[Dict[str, Any]] = None
    title: Optional[str] = None


class ChatTitleRequest(BaseModel):
    message: str


class ChatTitleResponse(BaseModel):
    title: str

# Supabase setup
def _resolve_supabase_key() -> Tuple[Optional[str], Optional[str]]:
    """Return the first configured Supabase key and the env var it came from."""
    candidate_names = [
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_KEY",
        "SUPABASE_ANON_KEY",
    ]
    for name in candidate_names:
        value = os.getenv(name)
        if value and value.strip() and "your_supabase_key_here" not in value.lower():
            normalized = value.strip()
            if name != "SUPABASE_KEY":
                os.environ["SUPABASE_KEY"] = normalized
            return normalized, name
    return None, None


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY, SUPABASE_KEY_SOURCE = _resolve_supabase_key()

# Initialize Supabase
if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        source_label = SUPABASE_KEY_SOURCE or "SUPABASE_KEY"
        print(f"Supabase client initialized successfully (source: {source_label}).")
        if SUPABASE_KEY_SOURCE == "SUPABASE_ANON_KEY":
            print("Warning: Using SUPABASE_ANON_KEY may limit write operations; configure a service-role key for full functionality.")
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
        print("Conversation history will not be persisted.")
        supabase = None
else:
    supabase = None
    print("Warning: Supabase credentials not configured. Conversation history will not be persisted.")

SUPABASE_CONVERSATIONS_ENABLED = supabase is not None


def _conversation_store_available() -> bool:
    return supabase is not None and SUPABASE_CONVERSATIONS_ENABLED


LOCAL_CONVERSATION_STORE: Dict[str, List[Dict[str, Any]]] = {}
LOCAL_CONVERSATION_METADATA: Dict[str, Dict[str, Any]] = {}
LOCAL_CONVERSATION_LOCK = asyncio.Lock()


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
        _disable_conversation_store("Supabase 'conversations' table missing; suppressing further requests.")
    elif "permission denied" in normalized or "insufficient privilege" in normalized or "not authorized" in normalized:
        _disable_conversation_store("Supabase conversation access denied; suppressing further requests.")


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


@app.on_event("startup")
async def _validate_gemini_api_key_on_startup():
    if AI_PROVIDER != "gemini" or not VALIDATE_GEMINI_ON_STARTUP:
        return

    if not GEMINI_SERVICE.available:
        print("[Gemini] Validation skipped; no API key configured.")
        return

    print("[Gemini] Validating API key before accepting requests...")
    try:
        await GEMINI_SERVICE.validate_connection()
        print("[Gemini] Validation succeeded.")
    except Exception as exc:  # pragma: no cover - best effort logging
        print(f"[Gemini] Validation failed: {exc}")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
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
    "confident about the summary."
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
    for entry in history:
        raw_role = entry.get("role")
        if not raw_role:
            continue
        role = "model" if raw_role == "assistant" else raw_role
        if role not in {"user", "model"}:
            continue
        normalized.append(
            {
                "role": role,
                "text": entry.get("text") or "",
            }
        )
    return normalized


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
    query = (
        dashboard_pulses.select()
        .where(dashboard_pulses.c.user_id == user_id)
        .order_by(dashboard_pulses.c.date_key.desc())
        .limit(3)
    )
    rows = await db.fetch_all(query)
    plan_labels: List[str] = []
    habit_labels: List[str] = []
    for row in rows:
        for plan in _row_get(row, "plans") or []:
            label = str(plan.get("label") or "").strip()
            if label:
                plan_labels.append(label)
        for habit in _row_get(row, "habits") or []:
            label = str(habit.get("label") or "").strip()
            if label:
                habit_labels.append(label)

    plan_labels = plan_labels[:6]
    habit_labels = habit_labels[:6]

    cursor_date = rows[0]["date_key"] if rows else None

    summary_parts = []
    if plan_labels:
        summary_parts.append(f"{len(plan_labels)} recent plans (e.g. {plan_labels[:2]})")
    if habit_labels:
        summary_parts.append(f"{len(habit_labels)} habit check-ins (e.g. {habit_labels[:2]})")
    if not summary_parts:
        summary_parts.append("No recorded plan or habit data yet.")

    return {
        "summary": " | ".join(summary_parts),
        "focus": info_type or "general",
        "plans": plan_labels,
        "habits": habit_labels,
        "latest_date": cursor_date,
    }


async def _execute_function_call(
    function_call: types.FunctionCall,
    user_id: int,
    db: databases.Database,
) -> Dict[str, Any]:
    handler = {
        "fetch_proactivity_summary": _fetch_proactivity_summary,
    }.get(function_call.name)
    if not handler:
        raise HTTPException(status_code=501, detail=f"Unsupported function: {function_call.name}")

    args = function_call.args or {}
    info_type = args.get("info_type")
    return await handler(user_id, info_type, db)


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
async def get_or_create_conversation(
    conversation_id: Optional[str],
    user_id: int,
    *,
    title: Optional[str] = None,
) -> str:
    """Get existing conversation or create new one"""
    valid_id = conversation_id if _is_valid_uuid(conversation_id) else None
    if valid_id and _conversation_store_available():
        try:
            # Check if conversation exists and belongs to this user
            result = (
                supabase.table("conversations")
                .select("id, history")
                .eq("id", valid_id)
                .eq("user_id", user_id)
                .execute()
            )
            if result.data:
                return valid_id
        except Exception as error:
            _handle_conversation_store_error("Error checking conversation", error)

    if _conversation_store_available():
        try:
            result = supabase.table("conversations").insert({
                "title": title or "New Conversation",
                "history": [],
                "user_id": user_id,
            }).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as error:
            _handle_conversation_store_error("Error creating conversation", error)

    # Fallback: return a mock ID
    candidate_id = conversation_id or str(uuid4())
    now_iso = datetime.utcnow().isoformat() + "Z"
    async with LOCAL_CONVERSATION_LOCK:
        LOCAL_CONVERSATION_STORE.setdefault(candidate_id, [])
        metadata = LOCAL_CONVERSATION_METADATA.setdefault(
            candidate_id,
            {
                "id": candidate_id,
                "title": title or "New Conversation",
                "user_id": user_id,
                "created_at": now_iso,
                "updated_at": now_iso,
            },
        )
        if title:
            metadata["title"] = title
        metadata["user_id"] = user_id
        metadata.setdefault("created_at", now_iso)
        metadata["updated_at"] = now_iso
    return candidate_id

async def save_conversation_message(conversation_id: str, message: Dict[str, Any]):
    """Save message to conversation history"""
    if not _conversation_store_available() or not _is_valid_uuid(conversation_id):
        async with LOCAL_CONVERSATION_LOCK:
            history = LOCAL_CONVERSATION_STORE.setdefault(conversation_id, [])
            history.append(message)
        return

    try:
        # Get current history
        result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
        if result.data:
            history = result.data[0]["history"] or []
            history.append(message)

            # Update conversation
            supabase.table("conversations").update({
                "history": history
            }).eq("id", conversation_id).execute()
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
    should_generate_title: bool = False,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Yield token chunks using the configured AI provider."""
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
    tool_list = [*DEFAULT_CHAT_TOOLS, *maps_tools]
    grounding_metadata: Optional[Dict[str, Any]] = None
    if GEMINI_SERVICE.available:
        try:
            accumulated = ""
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
            ):
                text_fragment = chunk.text or ""
                if chunk.candidates:
                    candidate = chunk.candidates[0]
                    if candidate.grounding_metadata:
                        grounding_metadata = candidate.grounding_metadata.model_dump(exclude_none=True)
                accumulated += text_fragment
                if text_fragment:
                    yield ("delta", text_fragment)
            final_payload = {"text": accumulated, "grounding_metadata": grounding_metadata}
            if accumulated:
                yield ("final", final_payload)
                return
            raise RuntimeError("AI response was empty")
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
    should_generate_title: bool = False,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Generate a structured response using the configured AI provider."""
    conversation_history = _normalize_conversation_history(conversation_history)
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
    tool_list = [*DEFAULT_CHAT_TOOLS, *maps_tools]
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
            )
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
                )
                if response.candidates:
                    candidate = response.candidates[0]
                    if candidate.grounding_metadata:
                        grounding_metadata = candidate.grounding_metadata.model_dump(exclude_none=True)
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
        await asyncio.sleep(2)
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
    try:
        # Generate a title for the chat session
        title_request = ChatTitleRequest(message=request.message)
        title_response = await create_chat_title(title_request)
        session_title = title_response.title

        # Create chat session
        now = datetime.utcnow()
        chat_session_query = chat_sessions.insert().values(
            user_id=request.user_id,
            title=session_title,
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

        # Save user message to local conversation store
        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": request.message
        }

        await save_conversation_message(conversation_id, user_message_payload)

        # Get conversation history for context
        conversation_history: List[Dict[str, Any]] = []
        if _conversation_store_available() and _is_valid_uuid(conversation_id):
            try:
                result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
                if result.data:
                    conversation_history = result.data[0]["history"] or []
            except Exception as error:
                _handle_conversation_store_error("Error getting conversation history", error)
                conversation_history = []
        else:
            async with LOCAL_CONVERSATION_LOCK:
                conversation_history = list(LOCAL_CONVERSATION_STORE.get(conversation_id) or [])

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
            should_generate_title=request.should_generate_title,
        )

        # Save AI response
        await save_conversation_message(conversation_id, {
            "role": "model",
            "text": ai_response
        })

        # Update user streak for daily activity
        await update_user_streak(request.user_id, db)

        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id,
            grounding_metadata=grounding_metadata,
            title=session_title,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/api/chat/stream")
async def chat_with_ai_stream(request: ChatRequest, db: databases.Database = Depends(get_database)):
    """Stream an AI response token-by-token using Server-Sent Events."""
    try:
        # Generate a title for the chat session
        title_request = ChatTitleRequest(message=request.message)
        title_response = await create_chat_title(title_request)
        session_title = title_response.title

        # Create chat session
        now = datetime.utcnow()
        chat_session_query = chat_sessions.insert().values(
            user_id=request.user_id,
            title=session_title,
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

        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": request.message,
        }

        await save_conversation_message(conversation_id, user_message_payload)

        conversation_history: List[Dict[str, Any]] = []
        if _conversation_store_available() and _is_valid_uuid(conversation_id):
            try:
                result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
                if result.data:
                    conversation_history = result.data[0]["history"] or []
            except Exception as supabase_error:  # pragma: no cover - logging
                _handle_conversation_store_error("Error getting conversation history", supabase_error)
        elif conversation_id:
            async with LOCAL_CONVERSATION_LOCK:
                conversation_history = list(LOCAL_CONVERSATION_STORE.get(conversation_id, []))

        async def event_stream() -> AsyncGenerator[str, None]:
            start_time = time.perf_counter()
            first_token_time: Optional[float] = None
            try:
                accumulated_visible = ""
                final_response: Optional[str] = None
                grounding_metadata_payload: Optional[Dict[str, Any]] = None
                async for kind, payload in stream_ai_response(
                    request.message,
                    conversation_history,
                    request.context,
                    request.system_prompt,
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
                    should_generate_title=request.should_generate_title,
                ):
                    if kind == "delta":
                        if not payload:
                            continue
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        accumulated_visible += payload
                        yield _sse_event("token", {"delta": payload})
                        if STREAMING_TOKEN_DELAY:
                            await asyncio.sleep(STREAMING_TOKEN_DELAY)
                        else:
                            await asyncio.sleep(0)
                    elif kind == "final":
                        if isinstance(payload, dict):
                            final_response = payload.get("text") or accumulated_visible
                            grounding_metadata_payload = payload.get("grounding_metadata")
                        elif payload:
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
        return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
    except Exception as error:
        async def error_stream() -> AsyncGenerator[str, None]:
            yield _sse_event("error", {"message": str(error)})

        return StreamingResponse(error_stream(), status_code=500, media_type="text/event-stream")

@app.get("/api/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation history"""
    try:
        if not _conversation_store_available() or not _is_valid_uuid(conversation_id):
            async with LOCAL_CONVERSATION_LOCK:
                return list(LOCAL_CONVERSATION_STORE.get(conversation_id, []))

        try:
            result = supabase.table("conversations").select("history").eq("id", conversation_id).execute()
            if result.data:
                return result.data[0]["history"] or []
            return []
        except Exception as supabase_error:
            # Handle missing table gracefully
            _handle_conversation_store_error("Warning: Conversations table not found or inaccessible", supabase_error)
            return []

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
            result = supabase.table("conversations").insert({
                "title": request.title,
                "history": [],
                "user_id": request.user_id,
            }).execute()

            if result.data:
                return result.data[0]
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

    if _conversation_store_available() and _is_valid_uuid(conversation_id):
        update_values: Dict[str, Any] = {"updated_at": updated_at_iso}
        if normalized_title is not None:
            update_values["title"] = normalized_title
        if payload.user_id is not None:
            update_values["user_id"] = payload.user_id

        try:
            result = (
                supabase.table("conversations")
                .update(update_values)
                .eq("id", conversation_id)
                .select("id, title, created_at, updated_at")
                .execute()
            )
            rows = result.data or []
            if not rows:
                secondary = (
                    supabase.table("conversations")
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

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        except HTTPException:
            raise
        except Exception as error:
            _handle_conversation_store_error("Error updating conversation", error)
            # Fall back to local storage if possible

    now_iso = updated_at_iso
    async with LOCAL_CONVERSATION_LOCK:
        if (
            conversation_id not in LOCAL_CONVERSATION_STORE
            and conversation_id not in LOCAL_CONVERSATION_METADATA
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        metadata = LOCAL_CONVERSATION_METADATA.setdefault(
            conversation_id,
            {
                "id": conversation_id,
                "title": normalized_title or "New Conversation",
                "created_at": now_iso,
                "updated_at": now_iso,
            },
        )
        if normalized_title is not None:
            metadata["title"] = normalized_title
        if payload.user_id is not None:
            metadata["user_id"] = payload.user_id
        metadata.setdefault("created_at", now_iso)
        metadata["updated_at"] = now_iso

        return {
            "id": metadata["id"],
            "title": metadata.get("title"),
            "created_at": metadata.get("created_at"),
            "updated_at": metadata.get("updated_at"),
        }


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
        # For now, return mock usage data
        # TODO: Implement actual usage tracking based on conversation history
        return {
            "message_count": 0,
            "token_count": 0,
            "created_at": None,
            "last_updated": None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation usage: {str(e)}")

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
    query = calendar_events.select().where(calendar_events.c.user_id == user_id).order_by(calendar_events.c.start_time)
    rows = await db.fetch_all(query)
    now = datetime.utcnow()
    normalized = []
    for row in rows:
        record = dict(row)
        if record.get("created_at") is None:
            record["created_at"] = now
        normalized.append(record)
    return normalized


@app.get("/users/{user_id}/reminders", response_model=List[Dict[str, Any]])
async def list_user_reminders(
    user_id: int,
    limit: Optional[int] = Query(None, ge=1),
    status_filter: Optional[str] = None,
    include_archived: bool = Query(False),
):
    return []


@app.get("/users/{user_id}/conversations", response_model=List[Dict[str, Any]])
async def list_user_conversations(
    user_id: int,
    limit: int = Query(100, ge=1, le=500),
):
    if not _conversation_store_available():
        return []

    try:
        result = (
            supabase.table("conversations")
            .select("id, title, created_at, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
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
                }
            )
        return normalized
    except Exception as error:
        _handle_conversation_store_error("Warning: Conversations table not found or inaccessible", error)
        return []

@app.post("/users/{user_id}/calendar-events", response_model=CalendarEvent, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(user_id: int, event: CalendarEventCreate, db: databases.Database = Depends(get_database)):
    query = calendar_events.insert().values(
        user_id=user_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time
    )
    event_id = await db.execute(query)
    return {**event.dict(), "id": event_id, "user_id": user_id}


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


@app.get("/users/{user_id}/proactivity/settings", response_model=ProactivitySettings)
async def get_proactivity_settings_route(user_id: int):
    return PROACTIVITY_SETTINGS_STORE.get(user_id, DEFAULT_PROACTIVITY_SETTINGS)


@app.post("/users/{user_id}/proactivity/settings", response_model=ProactivitySettings)
async def update_proactivity_settings_route(user_id: int, settings: ProactivitySettings):
    PROACTIVITY_SETTINGS_STORE[user_id] = settings
    return settings


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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
