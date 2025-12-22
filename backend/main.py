# Backend entry point - Triggering reload for API fixes
from importlib.util import find_spec

import logging
import asyncio
from fastapi import FastAPI, HTTPException, Depends, status, Query, Response, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple, Union
import databases
import sqlalchemy
from datetime import datetime, timezone, date, timedelta

# Time helpers (avoid datetime.utcnow() deprecation)
import os
import json
from asyncio import TimeoutError, wait_for, sleep
from contextlib import asynccontextmanager
import re
import time
from dotenv import load_dotenv
from supabase import Client

from backend.core.app_setup import lifespan
from backend.core.tool_execution import get_tool_handlers as _get_tool_handlers, execute_function_call as _execute_function_call
from backend.core.ai_service import stream_ai_response as _stream_ai_response, generate_ai_response as _generate_ai_response, generate_chat_starter as _ai_generate_chat_starter

from backend.compat_imports import (
    utcnow, utcnow_aware,
    create_supabase_client,
    create_supabase_service_client,
    resolve_supabase_credentials,
    conversation_store,
    configure_conversation_store,
    get_cached_user,
    cache_conversation_history,
    append_to_conversation_cache,
    invalidate_conversation_cache,
    delete_supabase_user_records,
    CONVERSATION_OWNER_CACHE,
    GENERAL_CONVERSATION_PREFIX,
    _conversation_store_available,
    _handle_conversation_store_error,
    _general_conversation_user_id,
    _load_general_conversation_history,
    _insert_general_conversation_message,
    _delete_general_conversation_history,
    _load_conversation_history,
    get_or_create_conversation,
    save_conversation_message,
    _is_valid_uuid,
    _timezone_from_time_context,
    normalize_conversation_history,
    normalize_conversation_title,
    apply_conversation_update,
    update_conversation_title,
    MEDIA_UPLOAD_DIR,
    MEDIA_UPLOAD_ROOT,
    sanitize_filename as _sanitize_filename,
    load_prompt_from_file,
    load_prompt_from_json,
    normalize_prompt_locale as _normalize_prompt_locale,
    _prompt_locale_from_request,
    IS_PRODUCTION,
    local_network_origin_regex as _local_network_origin_regex,
    build_allowed_origins as _build_allowed_origins,
    TTLCache,
    AsyncTTLCache,
    USER_CACHE,
    CONVERSATION_HISTORY_CACHE,
    load_context_cache as _load_context_cache,
    context_cache_contents as _context_cache_contents,
    needs_structured_tools as _needs_structured_tools,
    should_request_structured_reminders as _should_request_structured_reminders,
    should_use_web_search as _should_use_web_search,
    extract_urls_from_message as _extract_urls_from_message,
    row_get as _row_get,
    parse_json_field as _parse_json_field,
    serialize_reminder_row as _serialize_reminder_row,
    serialize_habit_record as _serialize_habit_record,
    datetime_to_ms as _datetime_to_ms,
    candidate_text as _candidate_text,
    candidate_thought as _candidate_thought,
    candidate_grounding_payload as _candidate_grounding_payload,
    merge_extra_contents as _merge_extra_contents,
    materialize_structured_reminders as _materialize_structured_reminders,
    fallback_title_from_message as _fallback_title_from_message,
    list_calendar_events as _list_calendar_events,
    create_calendar_event as _create_calendar_event,
    update_calendar_event as _update_calendar_event,
    delete_calendar_event as _delete_calendar_event,
    build_maps_tool_and_config as _build_maps_tool_and_config,
    set_entity_reminder_scheduler as _set_entity_reminder_scheduler,
    set_workspace_reminder_scheduler as _set_workspace_reminder_scheduler,
    list_plans_tool as _list_plans_tool,
    create_plan_tool as _create_plan_tool,
    update_plan_tool as _update_plan_tool,
    delete_plan_tool as _delete_plan_tool,
    list_habits_tool as _list_habits_tool,
    create_habit_tool as _create_habit_tool,
    update_habit_tool as _update_habit_tool,
    delete_habit_tool as _delete_habit_tool,
    list_reminders_tool as _list_reminders_tool,
    create_reminder_tool as _create_reminder_tool,
    update_reminder_tool as _update_reminder_tool,
    delete_reminder_tool as _delete_reminder_tool,
    delete_latest_reminder_tool as _delete_latest_reminder_tool,
    get_workspace_state_tool as _get_workspace_state_tool,
    normalize_plan_items as _normalize_plan_items,
    normalize_habit_items as _normalize_habit_items,
    normalize_proactivity as _normalize_proactivity,
    normalize_plan_tier,
    coerce_model_for_tier,
)

from uuid import UUID, uuid4
from pathlib import Path
from urllib.parse import urlparse

from backend.logging_config import (
    setup_logging, create_logger, set_request_context, clear_request_context,
    RequestLoggingMiddleware, log_performance, log_database_query, log_api_call,
    get_log_level,
)

from backend.google_calendar import (
    GoogleCalendarCredentials,
    GoogleCalendarInfo,
    GoogleCalendarEvent,
    GoogleAuthRequest,
    GoogleAuthCallbackRequest,
    GoogleAuthResponse,
    get_google_auth_url,
    decode_state_token,
    exchange_code_for_tokens,
    get_google_calendar_service,
    list_google_calendars,
    list_google_events,
    create_google_event,
    encrypt_refresh_token,
    decrypt_refresh_token,
)
from google.genai import types
from backend.gemini_client import GeminiAttachment, GeminiService
from backend.openrouter_client import OpenRouterService
from backend.usage_tracker import UsageTracker, UsageLimitExceeded
from backend.calendar_tools import CALENDAR_TOOLS
from backend.calendar_context import build_calendar_context
from backend.onboarding_tools import ONBOARDING_TOOLS
from backend.plan_tools import PLAN_TOOLS
from backend.ai_message_generator import AIMessageGenerator
from backend.proactivity_engine import (
    ProactivityEngine,
    ProactivityRealtimeBroker,
    ProactivitySchedulerManager,
)
from backend.model_access import coerce_model_for_tier
from backend.tier_utils import normalize_plan_tier

# Pydantic models
from backend.models import (
    UserBase, UserCreate, UserUpdate, UsageStatus, User,
    CalendarBase, CalendarCreate, CalendarUpdate, Calendar,
    CalendarEventBase, CalendarEventCreate, CalendarEventUpdate, CalendarEvent,
    PlanBase, PlanCreate, PlanUpdate, Plan,
    HabitBase, HabitCreate, HabitUpdate, Habit,
    ReminderBase, ReminderCreate, ReminderUpdate,
    ProactivitySettings, ProactivitySettingsUpdate,
    ProactivityLogBase, ProactivityLogCreate, ProactivityLog, DailyCheckIn,
    ProactivityNotification,
    DashboardPulsePlanItem, DashboardPulseHabitItem, DashboardPulseProactivity,
    DashboardPulseBase, DashboardPulseCreate, DashboardPulseUpdate, DashboardPulse,
    DashboardProactivitySummary, DashboardSummary,
    ChatSessionBase, ChatSessionCreate, ChatSession,
    WorkspaceBackground, ContextCacheBase, ContextCache,
    MediaUploadBase, MediaUpload, ChatAttachment,
    PaymentRequest, PaymentChargeResponse, MidtransNotification,
)
from backend.models.user import serialize_user_row as _serialize_user_row

# Authentication module
from backend.auth import (
    get_current_user,
    get_current_user_optional,
    require_same_user,
    require_admin,
    invalidate_user_cache,
    invalidate_user_cache_redis,
)

# Security utilities
from backend.security_utils import sanitize_for_logging

# Database module
from backend.database import (
    database,
    metadata,
    users,
    DATABASE_URL,
    calendars,
    calendar_events,
    dashboard_pulses,
    proactivity_settings,
    proactivity_push_subscriptions,
    proactivity_logs,
    media_uploads,
    context_cache,
    proactive_notifications,
    google_calendar_credentials,
    user_data,
    general_chat_messages,
    archived_chat_messages,
    user_chat_threads,
    user_chat_messages,
    reminders,
    plans,
    habits,
    chat_sessions,
    google_calendar_states,
)

from backend.core.rate_limit import (
    limiter,
    DEFAULT_RATE_LIMIT,
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)

from backend.api.chat_models import (
    ChatAttachment,
    ChatMessage,
    ConversationCreateRequest,
    ConversationUpdateRequest,
    ChatRequest,
    ChatResponse,
    ChatStarterRequest,
    ChatStarterResponse,
    ChatTitleRequest,
    ChatTitleResponse,
    MessageCreateRequest,
    ConversationHistoryPayload,
)

# Payment imports
from backend.payment_utils import create_core_api_transaction, verify_notification_signature

from backend.database import transactions


# Use centralized environment detection
from backend.env_utils import ROOT_DIR

from backend.core.env_helpers import (
    float_env as _float_env,
    int_env as _int_env,
    is_valid_uuid as _is_valid_uuid,
    timestamp_ms_to_datetime as _timestamp_ms_to_datetime,
    datetime_to_ms as _datetime_to_ms,
    timezone_from_time_context as _timezone_from_time_context,
    ensure_datetime_value as _ensure_datetime_value,
)

from backend.core.dashboard_helpers import (
    serialize_dashboard_pulse_record as _serialize_dashboard_pulse_record,
    carry_forward_dashboard_entries as _carry_forward_dashboard_entries,
)

from backend.core.log_utils import payload_log_summary as _payload_log_summary

from backend.core.general_conversation import (
    load_general_conversation_history as _load_general_conversation_history,
    insert_general_conversation_message as _insert_general_conversation_message,
    replace_general_conversation_history as _replace_general_conversation_history,
    delete_general_conversation_history as _delete_general_conversation_history,
    ensure_user_data_record as _ensure_user_data_record,
)

from backend.core.onboarding_handler import complete_onboarding as _complete_onboarding

from backend.core.title_generator import generate_chat_title_inline as _generate_chat_title_inline

from backend.core.media_attachments import (
    resolve_media_attachments as _resolve_media_attachments,
    generate_image_descriptions as _generate_image_descriptions,
)

from backend.core.conversation_manager import (
    load_conversation_history as _load_conversation_history,
    get_or_create_conversation,
    save_conversation_message,
)

from backend.core.proactivity_helpers import fetch_proactivity_summary as _fetch_proactivity_summary

from backend.core.chat_context_helpers import prepare_chat_context as _prepare_chat_context

from backend.core.chat_starter_helpers import (
    sse_event as _sse_event,
    starter_profile_context as _starter_profile_context,
    starter_fallback_message as _starter_fallback_message,
    build_starter_prompt as _build_starter_prompt,
)

load_dotenv(ROOT_DIR / ".env")

from backend.core.function_call_helpers import (
    build_function_call_contents as _build_function_call_contents,
    extract_function_call as _extract_function_call,
    format_tool_results_for_context as _format_tool_results_for_context,
)

from backend.core.stream_handlers.hybrid import (
    fetch_url_context_with_gemini as _fetch_url_context_with_gemini_hybrid,
    execute_tools_with_gemini_flash as _execute_tools_with_gemini_flash_hybrid,
    has_onboarding_tool as _has_onboarding_tool_hybrid,
)
from backend.core.stream_handlers.gemini_stream import stream_gemini_response
from backend.core.stream_handlers.openrouter import stream_openrouter_response
from backend.core.stream_handlers.context import (
    build_intent_window_text,
    consolidate_gemini_tools,
    add_url_context_tool_if_needed,
    add_maps_tool_if_needed,
    determine_provider_and_model,
)

# AI Response context helpers (extracted shared logic)
from backend.core.ai_response_context import (
    load_context_cache as _load_context_cache_helper,
    build_workspace_context as _build_workspace_context,
    prepare_tool_list as _prepare_tool_list,
    build_effective_system_prompt as _build_effective_system_prompt,
    resolve_media_with_timing as _resolve_media_with_timing,
    REMINDERS_DISABLED_NOTE,
)

# Initialize enhanced logging system
app_logger = setup_logging(
    log_level=get_log_level(),
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

app_logger.info(f"Backend starting (env={os.getenv('ENVIRONMENT', 'development')}, provider={os.getenv('AI_PROVIDER', 'openrouter')})")

# AI Configuration imports (centralized in core.ai_config)
from backend.core.ai_config import (
    AI_PROVIDER,
    GEMINI_DEFAULT_MODEL,
    VALIDATE_GEMINI_ON_STARTUP,
    tier_conversation_token_limit as _tier_conversation_token_limit_base,
    get_search_tool,
    get_url_context_tool,
    get_default_chat_tools,
    GLOBAL_SYSTEM_PROMPTS_PATH,
)

# tier_conversation_token_limit wrapper that uses normalize_plan_tier
def tier_conversation_token_limit(plan_tier: Optional[str]) -> int:
    return _tier_conversation_token_limit_base(plan_tier, normalize_fn=normalize_plan_tier)

GEMINI_SERVICE = GeminiService()
OPENROUTER_SERVICE = OpenRouterService()

AI_MESSAGE_GENERATOR = AIMessageGenerator()

MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SEARCH_TOOL = get_search_tool()
URL_CONTEXT_TOOL = get_url_context_tool()
DEFAULT_CHAT_TOOLS = get_default_chat_tools()

from backend.core.migrations import run_startup_migrations as _run_startup_migrations
# Note: _run_startup_migrations is called in lifespan(), not at import time


ALLOWED_ORIGIN_REGEX = _local_network_origin_regex()

ALLOWED_ORIGINS = _build_allowed_origins()

if IS_PRODUCTION and not ALLOWED_ORIGINS and not ALLOWED_ORIGIN_REGEX:
    app_logger.error(
        "CORS misconfigured for production: no allowed origins found; set SITE_URL/NEXT_PUBLIC_SITE_URL or CORS_ALLOW_ORIGINS."
    )
    raise RuntimeError("CORS configuration missing in production")

SUPABASE_URL, SUPABASE_KEY, SUPABASE_KEY_SOURCE = resolve_supabase_credentials()

supabase: Optional[Client] = None
supabase_admin: Optional[Client] = None
SUPABASE_ADMIN_KEY_SOURCE: Optional[str] = None
if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    supabase = create_supabase_client()
    supabase_admin, SUPABASE_ADMIN_KEY_SOURCE = create_supabase_service_client()

# Note: Conversation store is now strictly local (SQLite/Postgres).
# We no longer configure the conversation store with Supabase clients for data.


# Stub functions for admin metrics (not yet implemented)
async def _require_conversation_owner(conversation_id: str, current_user: Dict[str, Any]) -> None:
    """Ensure the authenticated user owns the conversation being accessed."""
    general_user_id = _general_conversation_user_id(conversation_id)
    if general_user_id is not None:
        require_same_user(general_user_id, current_user)
        return

    cached_owner = CONVERSATION_OWNER_CACHE.get(conversation_id)
    if cached_owner is not None:
        if str(cached_owner) != str(current_user["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own conversations",
            )
        return

    # Prefer the local conversation store first; this matches how we persist threads.
    from backend.database import user_chat_threads, database

    if _is_valid_uuid(conversation_id):
        try:
            local_row = await database.fetch_one(
                user_chat_threads.select().where(user_chat_threads.c.id == conversation_id)
            )
            if local_row:
                owner = _row_get(local_row, "user_identifier")
                if owner is not None:
                    CONVERSATION_OWNER_CACHE.set(conversation_id, int(owner))
                    if str(owner) != str(current_user["id"]):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You can only access your own conversations",
                        )
                    return
        except Exception as e:
            # Log database lookup failures - don't silently fail security checks
            api_logger.warning(
                f"Conversation ownership check failed for {conversation_id}: {e}",
                extra={"conversation_id": conversation_id, "user_id": _row_get(current_user, "id"), "error": str(e)}
            )
    else:
        # Non-UUID IDs are treated as local-only; require the current user context.
        require_same_user(current_user["id"], current_user)
        return

    # NOTE: Supabase ownership check removed - now strictly local-only.

# Reminder enrichment helpers (extracted to core/reminder_enrichment.py)
from backend.core.reminder_enrichment import (
    maybe_enrich_actions_with_reminder_time as _maybe_enrich_actions_with_reminder_time,
    create_reminders_from_actions as _create_reminders_from_actions_base,
)

async def _create_reminders_from_actions(
    db: databases.Database,
    user_id: int,
    actions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Wrapper that passes the global reminder_scheduler."""
    global reminder_scheduler
    return await _create_reminders_from_actions_base(db, user_id, actions, reminder_scheduler)


# FastAPI app
# FastAPI app (lifespan extracted to core/app_setup.py)





app = FastAPI(title="User Profile API with AI Chat", version="1.0.0", lifespan=lifespan)

# Mount media upload directory to serve files statically (dev-only by default).
public_uploads_env = os.getenv("ENABLE_PUBLIC_UPLOADS", "").strip().lower()
if public_uploads_env:
    allow_public_uploads = public_uploads_env in ("1", "true", "yes", "on")
else:
    allow_public_uploads = not IS_PRODUCTION

if allow_public_uploads and MEDIA_UPLOAD_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=MEDIA_UPLOAD_DIR), name="uploads")

# Security Headers Middleware (extracted to core/security_middleware.py)
from backend.core.security_middleware import add_security_headers
app.middleware("http")(add_security_headers)


# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Structured error handlers
if find_spec("backend.error_handlers") is not None:
    from backend.error_handlers import register_error_handlers

    register_error_handlers(app)

# Middleware
app.add_middleware(RequestLoggingMiddleware, logger=api_logger)

# Caching headers middleware
if find_spec("backend.caching_headers") is not None:
    from backend.caching_headers import caching_middleware

    @app.middleware("http")
    async def add_caching_headers(request, call_next):
        return await caching_middleware(request, call_next)

# Mount API routers
from backend.api.chat import router as chat_router

app.include_router(chat_router)

from backend.api.admin import router as admin_router

app.include_router(admin_router)

# Health check endpoints
from backend.health_check import router as health_router

app.include_router(health_router)

# Plans and Habits routes
from backend.api.plans import router as plans_router

app.include_router(plans_router)

# Calendar routes
from backend.api.calendars import router as calendars_router

app.include_router(calendars_router)

# Google Calendar routes
from backend.api.google_calendar import router as google_calendar_router

app.include_router(google_calendar_router)

# Reminder routes
from backend.api.reminders import router as reminders_router

app.include_router(reminders_router)

# Dashboard routes
from backend.api.dashboard import router as dashboard_router

app.include_router(dashboard_router)

# Payment routes (Midtrans)
from backend.api.payments import router as payments_router

app.include_router(payments_router)

# Proactivity routes
from backend.api.proactivity import router as proactivity_router

app.include_router(proactivity_router)

# Users routes
from backend.api.users import router as users_router

app.include_router(users_router)

# Hiring routes
from backend.api.hire import router as hire_router

app.include_router(hire_router)

# Conversations routes
from backend.api.conversations import router as conversations_router

app.include_router(conversations_router)

# Analytics routes
from backend.api.analytics import router as analytics_router

app.include_router(analytics_router)

# Uploads routes
from backend.api.uploads import router as uploads_router

app.include_router(uploads_router)

# Context Cache routes
from backend.api.context_cache import router as context_cache_router

app.include_router(context_cache_router)

# Import routes
from backend.api.imports import router as imports_router

app.include_router(imports_router)

# Initialize audit logger with database

from backend.audit_logger import init_audit_logger

# Global proactivity services
proactivity_engine: Optional[ProactivityEngine] = None
proactivity_scheduler: Optional[ProactivitySchedulerManager] = None
proactivity_realtime_broker = ProactivityRealtimeBroker()
reminder_scheduler: Optional["ReminderSchedulerManager"] = None

from backend.reminder_scheduler import ReminderSchedulerManager

# Lifespan and database management extracted to core/app_setup.py

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Database dependency
async def get_database():
    """
    Dependency to get the database connection.
    Connection is managed globally by startup/shutdown events.
    """
    yield database


# Tool execution logic moved to core/tool_execution.py

# API Routes

@app.get("/")
async def root():
    return {"message": "User Profile API with AI Chat"}
