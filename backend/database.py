import asyncio
import contextlib
import os
import sys
import time
import weakref
import databases
import sqlalchemy
from pathlib import Path
from typing import Any, Dict
from dotenv import load_dotenv
from datetime import datetime
import logging

# Use centralized environment detection
from backend.env_utils import ROOT_DIR, IN_DOCKER

if "pytest" in sys.modules:
    # Tests should not inherit NODE_ENV/ENVIRONMENT from a developer's local .env.
    os.environ.setdefault("NODE_ENV", "test")
    os.environ.setdefault("ENVIRONMENT", "test")
    # The repo's default `.env` uses `DB_MODE=local` and sets `LOCAL_DATABASE_URL`.
    # Most tests set `DATABASE_URL` directly and expect it to take precedence.
    os.environ.setdefault("DB_MODE", "remote")

load_dotenv(ROOT_DIR / ".env")


def _normalize_sqlite_url(url: str) -> str:
    """Return an absolute sqlite URL so relative paths work from any cwd."""
    if not url.startswith("sqlite:///"):
        return url
    path = url.replace("sqlite:///", "", 1)
    path_obj = Path(path)
    if not path_obj.is_absolute():
        path_obj = (ROOT_DIR / path_obj).resolve()
    try:
        path_obj.parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        # Best-effort; directory may be managed externally.
        pass
    return f"sqlite:///{path_obj}"


def _select_database_url() -> str:
    """
    Choose the fastest available database for app data.

    Priority (unless DB_MODE overrides):
    1) DATABASE_URL (env override / CLI)
    2) LOCAL_DATABASE_URL (fast local)
    3) SQLITE_DB_PATH (Docker volume mount)
    4) Fallback to local data/users.db (gitignored)
    """
    db_mode = (os.getenv("DB_MODE") or "").lower()
    primary_url = os.getenv("DATABASE_URL")
    local_url = os.getenv("LOCAL_DATABASE_URL")
    
    # Support Docker volume mount via SQLITE_DB_PATH
    sqlite_path = os.getenv("SQLITE_DB_PATH")
    
    # Docker uses /app/data, local uses project_root/data/users.db (gitignored)
    if IN_DOCKER:
         default_fallback = f"sqlite:///{sqlite_path}" if sqlite_path else "sqlite:///data/users.db"
    else:
         default_fallback = f"sqlite:///{sqlite_path}" if sqlite_path else f"sqlite:///{ROOT_DIR}/data/users.db"

    candidates: list[str] = []
    if db_mode == "remote":
        candidates = [primary_url, local_url, default_fallback]
    elif db_mode == "local":
        candidates = [local_url, primary_url, default_fallback]
    else:
        candidates = [primary_url, local_url, default_fallback]

    for candidate in candidates:
        if not candidate:
            continue
        value = candidate.strip()
        if not value:
            continue
        if value.startswith("sqlite"):
            return _normalize_sqlite_url(value)

    logger = logging.getLogger("backend.database")
    logger.error(
        "No SQLite database URL configured; refusing to use non-SQLite DATABASE_URL.",
        extra={"event_type": "database_url_invalid", "db_mode": db_mode},
    )
    raise RuntimeError(
        "SQLite is the only supported database. Set LOCAL_DATABASE_URL or SQLITE_DB_PATH "
        "(and remove DATABASE_URL if it points to Postgres)."
    )


DATABASE_URL = _select_database_url()
try:
    selected_path = DATABASE_URL.replace("sqlite:///", "", 1) if DATABASE_URL.startswith("sqlite:///") else ""
    selected_path_obj = Path(selected_path)
    if not selected_path_obj.is_absolute():
        selected_path_obj = (ROOT_DIR / selected_path_obj).resolve()
    backend_dir = (ROOT_DIR / "backend").resolve()
    if backend_dir in selected_path_obj.parents:
        logging.getLogger("backend.database").warning(
            "SQLite DB is located under the repo's backend/ directory; move it to data/ (gitignored) or outside the repo",
            extra={"event_type": "fallback_activation", "fallback": "db_path_inside_repo", "db_path": str(selected_path_obj)},
        )
except Exception:
    pass

database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

_PYTEST_TICKER_TASKS: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Task]" = weakref.WeakKeyDictionary()


async def _pytest_event_loop_ticker() -> None:
    """
    Keep the event loop from sleeping indefinitely under pytest.

    In some environments, `aiosqlite`/`databases` can wedge if the loop is idle and
    the self-pipe wakeup gets dropped; a small periodic timer prevents hangs.
    """
    try:
        while True:
            await asyncio.sleep(0.05)
    except asyncio.CancelledError:
        return


_database_connect = database.connect
_database_disconnect = database.disconnect


async def _connect_with_pytest_ticker(*args, **kwargs):  # type: ignore[no-untyped-def]
    await _database_connect(*args, **kwargs)
    if "pytest" not in sys.modules:
        return
    if not DATABASE_URL.startswith("sqlite"):
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = _PYTEST_TICKER_TASKS.get(loop)
    if task is None or task.done():
        _PYTEST_TICKER_TASKS[loop] = loop.create_task(_pytest_event_loop_ticker())


async def _disconnect_with_pytest_ticker(*args, **kwargs):  # type: ignore[no-untyped-def]
    if "pytest" in sys.modules and DATABASE_URL.startswith("sqlite"):
        with contextlib.suppress(RuntimeError):
            loop = asyncio.get_running_loop()
            task = _PYTEST_TICKER_TASKS.pop(loop, None)
            if task is not None and not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
    await _database_disconnect(*args, **kwargs)


database.connect = _connect_with_pytest_ticker  # type: ignore[method-assign]
database.disconnect = _disconnect_with_pytest_ticker  # type: ignore[method-assign]

# ---------------------------------------------------------------------------
# Database query instrumentation (slow queries, errors)
# ---------------------------------------------------------------------------

from backend.logging_config import create_logger, request_id as _request_id_ctx, user_id as _user_id_ctx

_db_logger = create_logger("backend.database.queries")
_DB_SLOW_QUERY_MS = float(os.getenv("DB_SLOW_QUERY_MS") or os.getenv("DISCORD_SLOW_QUERY_MS") or "500")

_db_execute = database.execute
_db_execute_many = database.execute_many
_db_fetch_one = database.fetch_one
_db_fetch_all = database.fetch_all
_db_fetch_val = database.fetch_val


def _query_preview(query: Any) -> str:
    text = str(query or "")
    text = " ".join(text.split())
    if len(text) > 240:
        return text[:240] + "..."
    return text


def _log_db_event(*, level: int, message: str, extra: Dict[str, Any]) -> None:
    extra_with_context = dict(extra)
    req = _request_id_ctx.get()
    usr = _user_id_ctx.get()
    if req:
        extra_with_context.setdefault("request_id", req)
    if usr:
        extra_with_context.setdefault("user_id", usr)
    _db_logger.log(level, message, extra=extra_with_context)


async def _instrument_call(method: str, query: Any, values: Any, coro):  # type: ignore[no-untyped-def]
    t0 = time.perf_counter()
    try:
        result = await coro
        return result
    except Exception as exc:
        duration_ms = (time.perf_counter() - t0) * 1000.0
        _log_db_event(
            level=logging.ERROR,
            message="Database operation failed",
            extra={
                "event_type": "db_query_error",
                "method": method,
                "duration_ms": round(duration_ms, 2),
                "query_preview": _query_preview(query),
                "error": str(exc),
            },
        )
        raise
    finally:
        duration_ms = (time.perf_counter() - t0) * 1000.0
        if duration_ms >= _DB_SLOW_QUERY_MS:
            _log_db_event(
                level=logging.WARNING,
                message="Slow database query",
                extra={
                    "event_type": "db_slow_query",
                    "method": method,
                    "duration_ms": round(duration_ms, 2),
                    "threshold_ms": _DB_SLOW_QUERY_MS,
                    "query_preview": _query_preview(query),
                },
            )


async def _execute_instrumented(query, values=None):  # type: ignore[no-untyped-def]
    return await _instrument_call("execute", query, values, _db_execute(query, values))


async def _execute_many_instrumented(query, values=None):  # type: ignore[no-untyped-def]
    return await _instrument_call("execute_many", query, values, _db_execute_many(query, values))


async def _fetch_one_instrumented(query, values=None):  # type: ignore[no-untyped-def]
    return await _instrument_call("fetch_one", query, values, _db_fetch_one(query, values))


async def _fetch_all_instrumented(query, values=None):  # type: ignore[no-untyped-def]
    return await _instrument_call("fetch_all", query, values, _db_fetch_all(query, values))


async def _fetch_val_instrumented(query, values=None, column=0):  # type: ignore[no-untyped-def]
    return await _instrument_call("fetch_val", query, values, _db_fetch_val(query, values, column=column))


database.execute = _execute_instrumented  # type: ignore[method-assign]
database.execute_many = _execute_many_instrumented  # type: ignore[method-assign]
database.fetch_one = _fetch_one_instrumented  # type: ignore[method-assign]
database.fetch_all = _fetch_all_instrumented  # type: ignore[method-assign]
database.fetch_val = _fetch_val_instrumented  # type: ignore[method-assign]

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
    sqlalchemy.Column("personalization_system_prompt_override", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_show_calendar", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("personalization_location", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("personalization_time_zone", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("plan_tier", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("subscription_expires_at", sqlalchemy.DateTime, nullable=True),  # When subscription expires
    sqlalchemy.Column("gumroad_subscription_id", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("gumroad_license_key", sqlalchemy.String, nullable=True),
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
    sqlalchemy.Column("visible_model_ids", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("theme_mode", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("ui_locale", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("preferred_response_language", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("notification_preferences", sqlalchemy.JSON, nullable=True),
    sqlalchemy.Column("conversation_memory_enabled", sqlalchemy.Boolean, default=True),
    sqlalchemy.Column("auto_web_search_enabled", sqlalchemy.Boolean, default=False),
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
    sqlalchemy.Column("subscription_starts_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("subscription_ends_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("gumroad_sale_id", sqlalchemy.String, nullable=True),
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
    sqlalchemy.Column("profile", sqlalchemy.JSON, default=dict),
    sqlalchemy.Column("context", sqlalchemy.JSON, default=list),
    sqlalchemy.Column("metadata", sqlalchemy.JSON, default=dict),
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
    sqlalchemy.Column("context_snapshot", sqlalchemy.JSON, default=list),
    sqlalchemy.Column("metadata", sqlalchemy.JSON, default=dict),
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
    sqlalchemy.Column("plans", sqlalchemy.JSON, default=list),
    sqlalchemy.Column("habits", sqlalchemy.JSON, default=list),
    sqlalchemy.Column("proactivity", sqlalchemy.JSON, default=dict),
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
    sqlalchemy.Column("color", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("reminder_minutes_before", sqlalchemy.Integer, nullable=True),
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

# Plans and Habits tables
plans = sqlalchemy.Table(
    "plans",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("label", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("completed", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("deadline", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("schedule_slot", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("color", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

habits = sqlalchemy.Table(
    "habits",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, nullable=False, index=True),
    sqlalchemy.Column("label", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("completed", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("previous_label", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

# Chat session tables (consolidated from main.py)
chat_sessions = sqlalchemy.Table(
    "chat_sessions",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("title", sqlalchemy.String),
    sqlalchemy.Column("scope", sqlalchemy.String, default="thread"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    extend_existing=True,
)

# Google Calendar OAuth state storage (consolidated from main.py)
google_calendar_states = sqlalchemy.Table(
    "google_calendar_states",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("state_token", sqlalchemy.String, unique=True, nullable=False),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("nonce", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("redirect_uri", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("consumed_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    extend_existing=True,
)


# Database dependency for FastAPI routes
async def get_database():
    """
    Dependency to get the database connection.
    Connection is managed globally by startup/shutdown events.
    """
    yield database
