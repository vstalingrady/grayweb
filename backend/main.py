from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple
import databases
import sqlalchemy
from datetime import datetime
import os
import json
import asyncio
import threading
import tempfile
import time
import re
from dotenv import load_dotenv
import google.generativeai as genai
from supabase import create_client, Client
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
STREAMING_TOKEN_DELAY = max(0.0, _float_env("GRAY_STREAMING_TOKEN_DELAY_SECONDS", 0.045))

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

def _fallback_title_from_message(message: str) -> str:
    trimmed = (message or "").strip()
    if not trimmed:
        return "New Chat"
    if len(trimmed) <= 48:
        return trimmed
    return f"{trimmed[:45].rstrip()}…"

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

    class Config:
        orm_mode = True

class ChatSessionBase(BaseModel):
    title: str

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

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

    class Config:
        orm_mode = True

class HabitUpdate(BaseModel):
    label: Optional[str] = None
    streak_label: Optional[str] = None
    previous_label: Optional[str] = None

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
if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    genai.configure(api_key=GEMINI_API_KEY)
    try:
        # Use gemini-flash-latest for normal use as specified
        gemini_model = genai.GenerativeModel('models/gemini-flash-latest')
        print("Gemini AI initialized successfully with models/gemini-flash-latest")
    except Exception as e:
        print(f"Failed to initialize models/gemini-flash-latest, trying fallback model: {e}")
        try:
            # Use gemini-flash-lite-latest for fallback as specified
            gemini_model = genai.GenerativeModel('models/gemini-flash-lite-latest')
            print("Gemini AI initialized successfully with models/gemini-flash-lite-latest (fallback)")
        except Exception as e2:
            print(f"Failed to initialize fallback model: {e2}")
            gemini_model = None
    try:
        gemini_title_model = genai.GenerativeModel('models/gemini-flash-lite-latest')
        print("Gemini title model initialized with models/gemini-flash-lite-latest")
    except Exception as title_error:
        print(f"Failed to initialize title model: {title_error}")
        gemini_title_model = gemini_model
else:
    gemini_model = None
    gemini_title_model = None
    print("Warning: GEMINI_API_KEY not configured. AI responses will be simulated.")

# Initialize Supabase
if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Supabase client initialized successfully")
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
        current = genai.get_file(target_name)
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
    upload_kwargs: Dict[str, Any] = {"path": path}
    if display_name:
        upload_kwargs["display_name"] = display_name
    if mime_type:
        upload_kwargs["mime_type"] = mime_type

    uploaded = genai.upload_file(**upload_kwargs)
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
    """Get existing conversation or create new one"""
    if conversation_id and _conversation_store_available():
        try:
            # Check if conversation exists
            result = supabase.table("conversations").select("id, history").eq("id", conversation_id).execute()
            if result.data:
                return conversation_id
        except Exception as error:
            _handle_conversation_store_error("Error checking conversation", error)

    if _conversation_store_available():
        try:
            result = supabase.table("conversations").insert({
                "title": "New Conversation",
                "history": []
            }).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as error:
            _handle_conversation_store_error("Error creating conversation", error)

    # Fallback: return a mock ID
    import uuid
    candidate_id = conversation_id or str(uuid.uuid4())
    async with LOCAL_CONVERSATION_LOCK:
        LOCAL_CONVERSATION_STORE.setdefault(candidate_id, [])
    return candidate_id

async def save_conversation_message(conversation_id: str, message: Dict[str, Any]):
    """Save message to conversation history"""
    if not _conversation_store_available():
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
    """Generate a concise chat title using Gemini Flash Lite."""
    trimmed = (message or "").strip()
    if not trimmed:
        return None
    if not GEMINI_API_KEY or not gemini_title_model:
        return None

    prompt = (
        "Generate a concise yet descriptive chat title summarizing the following user query. "
        "Respond with Title Case, avoid quotes or trailing punctuation, and aim for 4-10 words "
        "when it helps clarity (never exceed 12 words). Favor specific key concepts over generic greetings.\n\n"
        f"User query:\n{trimmed}"
    )

    try:
        response = gemini_title_model.generate_content(prompt)
        text_response = getattr(response, "text", None) or ""
        if not text_response:
            candidates = getattr(response, "candidates", None) or []
            for candidate in candidates:
                content = getattr(candidate, "content", None)
                parts = getattr(content, "parts", None) if content else None
                if not parts:
                    continue
                text_parts = [
                    getattr(part, "text", None)
                    for part in parts
                    if getattr(part, "text", None)
                ]
                if text_parts:
                    text_response = " ".join(text_parts)
                    break

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
    text_attr = getattr(candidate, "text", None)
    if text_attr:
        return text_attr
    candidates = getattr(candidate, "candidates", None) or []
    for entry in candidates:
        content = getattr(entry, "content", None)
        parts = getattr(content, "parts", None) if content else None
        if not parts:
            continue
        texts = [
            getattr(part, "text", None)
            for part in parts
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
    if gemini_model and GEMINI_API_KEY:
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

            def push(item: Tuple[str, Any]):
                asyncio.run_coroutine_threadsafe(queue.put(item), loop)

            def worker():
                try:
                    response = gemini_model.generate_content(contents, stream=True)
                    for chunk in response:
                        delta = _extract_response_text(chunk)
                        if not delta:
                            continue
                        for piece in _chunk_response_text(delta):
                            if piece:
                                push(("delta", piece))
                    try:
                        response.resolve()
                    except Exception:
                        pass
                    final_text = _extract_response_text(response)
                    push(("final", final_text or ""))
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
    if gemini_model and GEMINI_API_KEY:
        try:
            contents = _prepare_gemini_contents(
                message,
                conversation_history,
                workspace_context,
                system_prompt,
                attachments,
            )
            response = gemini_model.generate_content(contents)
            extracted = _extract_response_text(response)
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
    if not GEMINI_API_KEY:
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

        # Get conversation history for context
        conversation_history = []
        if _conversation_store_available() and conversation_id:
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

        conversation_history: List[Dict[str, Any]] = []
        if _conversation_store_available() and conversation_id:
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
    """Get conversation history"""
    try:
        if not _conversation_store_available():
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
async def create_conversation(request: ChatSessionCreate):
    """Create a new conversation"""
    try:
        if not _conversation_store_available():
            # Fallback: return mock conversation
            import uuid
            return {"id": str(uuid.uuid4()), "title": request.title, "history": []}

        try:
            result = supabase.table("conversations").insert({
                "title": request.title,
                "history": []
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
            return {"id": str(uuid.uuid4()), "title": request.title, "history": []}

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
        created_at=now,
        updated_at=now
    )
    user_id = await db.execute(query)

    # Seed default calendars
    default_calendars = [
        {
            "label": "Operations",
            "color": "linear-gradient(135deg, #5b8def, #304ffe)",
            "is_visible": True,
        },
        {
            "label": "Team",
            "color": "linear-gradient(135deg, #ff7d9d, #ff14c6)",
            "is_visible": True,
        },
        {
            "label": "Personal",
            "color": "linear-gradient(135deg, #20d39c, #0c9f6f)",
            "is_visible": True,
        },
    ]

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

    # Seed default calendar events
    default_events = [
        {
            "title": "Builder cohort sync",
            "calendar_label": "Operations",
            "start": "2025-10-25T08:30:00",
            "end": "2025-10-25T09:15:00",
        },
        {
            "title": "Proactivity instrumentation review",
            "calendar_label": "Operations",
            "start": "2025-10-25T11:00:00",
            "end": "2025-10-25T12:00:00",
        },
        {
            "title": "Pulse QA slot",
            "calendar_label": "Operations",
            "start": "2025-10-25T15:30:00",
            "end": "2025-10-25T16:00:00",
        },
        {
            "title": "Alignment recap + journaling",
            "calendar_label": "Operations",
            "start": "2025-10-25T19:00:00",
            "end": "2025-10-25T19:45:00",
        },
        {
            "title": "Design review",
            "calendar_label": "Team",
            "start": "2025-10-24T11:00:00",
            "end": "2025-10-24T12:00:00",
        },
        {
            "title": "Run club",
            "calendar_label": "Personal",
            "start": "2025-10-23T07:30:00",
            "end": "2025-10-23T08:15:00",
        },
    ]

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
    # Fixed query to avoid calendar_id column references
    query = calendar_events.select().where(calendar_events.c.user_id == user_id).order_by(calendar_events.c.start_time)
    return await db.fetch_all(query)

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
    from datetime import datetime

    # Calculate streak (consecutive days with proactivity score >= 70)
    subquery = """
        SELECT activity_date, score
        FROM proactivity_logs
        WHERE user_id = :user_id
        AND score >= 70
        ORDER BY activity_date DESC
    """

    # Execute raw query to get qualifying days
    result = await db.fetch_all(subquery.replace(":user_id", str(user_id)))

    streak = 0
    current_date = None

    for row in result:
        # Parse the activity_date (it comes as a string from raw SQL)
        row_date = datetime.strptime(row.activity_date.split('.')[0], '%Y-%m-%dT%H:%M:%S').date() if isinstance(row.activity_date, str) else row.activity_date.date()

        if current_date is None or (row_date - current_date).days > 1:
            streak = 1
        current_date = row_date

    return {"current_streak": streak, "best_streak": streak}

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
