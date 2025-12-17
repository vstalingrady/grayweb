# backend/compat_imports.py
"""
Centralized imports that handle both package and module import contexts.

This eliminates the need for try/except blocks in each file when running
from different contexts (e.g., tests vs production).
"""

import sys
from pathlib import Path

# Ensure backend directory is properly on the path
_backend_dir = Path(__file__).parent
_parent_dir = _backend_dir.parent
if str(_parent_dir) not in sys.path:
    sys.path.insert(0, str(_parent_dir))
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))


def _try_import(package_path: str, fallback_path: str):
    """
    Try importing from package path first, fall back to module path.
    Returns the imported module.
    """
    import importlib
    try:
        return importlib.import_module(package_path)
    except ImportError:
        return importlib.import_module(fallback_path)


# ============================================================================
# Time Utilities
# ============================================================================
try:
    from backend.time_utils import utcnow, utcnow_aware
except (ImportError, ModuleNotFoundError):
    from time_utils import utcnow, utcnow_aware  # type: ignore


# ============================================================================
# Supabase Utilities
# ============================================================================
try:
    from backend.supabase_utils import (
        create_supabase_client,
        create_supabase_service_client,
        resolve_supabase_credentials,
    )
except (ImportError, ModuleNotFoundError):
    from supabase_utils import (  # type: ignore
        create_supabase_client,
        create_supabase_service_client,
        resolve_supabase_credentials,
    )


# ============================================================================
# Core - Conversation Store
# ============================================================================
try:
    from backend.core import conversation_store
    from backend.core.conversation_store import (
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
    )
except (ImportError, ModuleNotFoundError):
    from core import conversation_store  # type: ignore
    from core.conversation_store import (  # type: ignore
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
    )


# ============================================================================
# Core - Chat History
# ============================================================================
try:
    from backend.core.chat_history import (
        normalize_conversation_history,
        load_thread_history,
        overwrite_thread_history,
        normalize_conversation_title,
        apply_conversation_update,
        update_conversation_title,
    )
except (ImportError, ModuleNotFoundError):
    from core.chat_history import (  # type: ignore
        normalize_conversation_history,
        load_thread_history,
        overwrite_thread_history,
        normalize_conversation_title,
        apply_conversation_update,
        update_conversation_title,
    )


# ============================================================================
# Core - File Utilities
# ============================================================================
try:
    from backend.core.file_utils import (
        MEDIA_UPLOAD_DIR,
        MEDIA_UPLOAD_ROOT,
        UPLOAD_READ_CHUNK_SIZE,
        MAX_MEDIA_UPLOAD_SIZE_BYTES,
        MAX_BACKGROUND_UPLOAD_SIZE_BYTES,
        IMAGE_MIME_TYPES,
        DOCUMENT_MIME_TYPES,
        CHAT_UPLOAD_MIME_TYPES,
        BACKGROUND_UPLOAD_MIME_TYPES,
        IMAGE_EXTENSIONS,
        CHAT_UPLOAD_EXTENSIONS,
        BACKGROUND_UPLOAD_EXTENSIONS,
        MIME_EXTENSION_MAP,
        STORAGE_BASE_URL,
        CLAMAV_SCAN_ENABLED,
        CLAMAV_SCAN_BINARY,
        CLAMAV_SCAN_TIMEOUT,
        sanitize_filename,
        normalize_mime,
        sniff_mime_type,
        reject_if_suspicious,
        scan_file_for_malware,
        ensure_storage_path,
        resolve_storage_path_from_record,
        persist_upload_file,
    )
except (ImportError, ModuleNotFoundError):
    from core.file_utils import (  # type: ignore
        MEDIA_UPLOAD_DIR,
        MEDIA_UPLOAD_ROOT,
        UPLOAD_READ_CHUNK_SIZE,
        MAX_MEDIA_UPLOAD_SIZE_BYTES,
        MAX_BACKGROUND_UPLOAD_SIZE_BYTES,
        IMAGE_MIME_TYPES,
        DOCUMENT_MIME_TYPES,
        CHAT_UPLOAD_MIME_TYPES,
        BACKGROUND_UPLOAD_MIME_TYPES,
        IMAGE_EXTENSIONS,
        CHAT_UPLOAD_EXTENSIONS,
        BACKGROUND_UPLOAD_EXTENSIONS,
        MIME_EXTENSION_MAP,
        STORAGE_BASE_URL,
        CLAMAV_SCAN_ENABLED,
        CLAMAV_SCAN_BINARY,
        CLAMAV_SCAN_TIMEOUT,
        sanitize_filename,
        normalize_mime,
        sniff_mime_type,
        reject_if_suspicious,
        scan_file_for_malware,
        ensure_storage_path,
        resolve_storage_path_from_record,
        persist_upload_file,
    )


# ============================================================================
# Core - SQLite Helpers
# ============================================================================
try:
    from backend.core.sqlite_helpers import (
        ensure_sqlite_columns,
        ensure_sqlite_table,
        ensure_sqlite_index,
        drop_sqlite_table,
        rebuild_sqlite_table_without_columns,
    )
except (ImportError, ModuleNotFoundError):
    from core.sqlite_helpers import (  # type: ignore
        ensure_sqlite_columns,
        ensure_sqlite_table,
        ensure_sqlite_index,
        drop_sqlite_table,
        rebuild_sqlite_table_without_columns,
    )


# ============================================================================
# Core - Prompt Utilities
# ============================================================================
try:
    from backend.core.prompt_utils import (
        load_prompt_from_file,
        load_prompt_from_json,
        normalize_prompt_locale,
        prompt_locale_from_request,
    )
except (ImportError, ModuleNotFoundError):
    from core.prompt_utils import (  # type: ignore
        load_prompt_from_file,
        load_prompt_from_json,
        normalize_prompt_locale,
        prompt_locale_from_request,
    )


# ============================================================================
# Core - CORS Utilities
# ============================================================================
try:
    from backend.core.cors_utils import (
        IS_PRODUCTION,
        DEFAULT_DEV_ORIGIN_PORTS,
        LOCAL_NETWORK_ORIGIN_PATTERN,
        split_env_list,
        origin_variants,
        local_network_origins,
        local_network_origin_regex,
        build_allowed_origins,
    )
except (ImportError, ModuleNotFoundError):
    from core.cors_utils import (  # type: ignore
        IS_PRODUCTION,
        DEFAULT_DEV_ORIGIN_PORTS,
        LOCAL_NETWORK_ORIGIN_PATTERN,
        split_env_list,
        origin_variants,
        local_network_origins,
        local_network_origin_regex,
        build_allowed_origins,
    )


# ============================================================================
# Core - Cache
# ============================================================================
try:
    from backend.core.cache import (
        TTLCache,
        AsyncTTLCache,
        USER_CACHE,
        CONVERSATION_OWNER_CACHE as CONVERSATION_OWNER_CACHE_FROM_CACHE,
        CONVERSATION_HISTORY_CACHE,
        load_context_cache,
        context_cache_contents,
    )
except (ImportError, ModuleNotFoundError):
    from core.cache import (  # type: ignore
        TTLCache,
        AsyncTTLCache,
        USER_CACHE,
        CONVERSATION_OWNER_CACHE as CONVERSATION_OWNER_CACHE_FROM_CACHE,
        CONVERSATION_HISTORY_CACHE,
        load_context_cache,
        context_cache_contents,
    )


# ============================================================================
# Core - Message Detection
# ============================================================================
try:
    from backend.core.message_detection import (
        REMINDER_KEYWORDS,
        TOOL_TRIGGER_KEYWORDS,
        needs_structured_tools,
        should_request_structured_reminders,
        should_use_web_search,
        should_enable_search,
    )
except (ImportError, ModuleNotFoundError):
    from core.message_detection import (  # type: ignore
        REMINDER_KEYWORDS,
        TOOL_TRIGGER_KEYWORDS,
        needs_structured_tools,
        should_request_structured_reminders,
        should_use_web_search,
        should_enable_search,
    )


# ============================================================================
# Core - Serializers
# ============================================================================
try:
    from backend.core.serializers import (
        row_get,
        parse_json_field,
        serialize_reminder_row,
        serialize_habit_record,
        serialize_proactivity_notification,
        serialize_context_cache,
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
        datetime_to_ms,
        parse_iso_timestamp,
        DEFAULT_DASHBOARD_PROACTIVITY,
    )
except (ImportError, ModuleNotFoundError):
    from core.serializers import (  # type: ignore
        row_get,
        parse_json_field,
        serialize_reminder_row,
        serialize_habit_record,
        serialize_proactivity_notification,
        serialize_context_cache,
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
        datetime_to_ms,
        parse_iso_timestamp,
        DEFAULT_DASHBOARD_PROACTIVITY,
    )


# ============================================================================
# Core - AI Utilities
# ============================================================================
try:
    from backend.core.ai_utils import (
        candidate_text,
        candidate_thought,
        candidate_grounding_payload,
        merge_extra_contents,
        materialize_structured_reminders,
        clean_title,
        fallback_title_from_message,
    )
except (ImportError, ModuleNotFoundError):
    from core.ai_utils import (  # type: ignore
        candidate_text,
        candidate_thought,
        candidate_grounding_payload,
        merge_extra_contents,
        materialize_structured_reminders,
        clean_title,
        fallback_title_from_message,
    )


# ============================================================================
# Core - Tool Handlers
# ============================================================================
try:
    from backend.core.tool_handlers import (
        set_reminder_scheduler as set_tool_reminder_scheduler,
        parse_iso_datetime,
        normalize_remind_at,
        parse_remind_at,
        build_reminder_payload,
        list_calendar_events,
        create_calendar_event,
        update_calendar_event,
        delete_calendar_event,
        build_maps_tool_and_config,
    )
except (ImportError, ModuleNotFoundError):
    from core.tool_handlers import (  # type: ignore
        set_reminder_scheduler as set_tool_reminder_scheduler,
        parse_iso_datetime,
        normalize_remind_at,
        parse_remind_at,
        build_reminder_payload,
        list_calendar_events,
        create_calendar_event,
        update_calendar_event,
        delete_calendar_event,
        build_maps_tool_and_config,
    )


# ============================================================================
# Core - Entity Reminders
# ============================================================================
try:
    from backend.core.entity_reminders import (
        set_reminder_scheduler as set_entity_reminder_scheduler,
        get_pending_entity_reminder_map,
        delete_pending_entity_reminders,
        delete_all_entity_reminders,
        upsert_entity_reminder,
    )
except (ImportError, ModuleNotFoundError):
    from core.entity_reminders import (  # type: ignore
        set_reminder_scheduler as set_entity_reminder_scheduler,
        get_pending_entity_reminder_map,
        delete_pending_entity_reminders,
        delete_all_entity_reminders,
        upsert_entity_reminder,
    )


# ============================================================================
# Core - Workspace Tools
# ============================================================================
try:
    from backend.core.workspace_tools import (
        set_reminder_scheduler as set_workspace_reminder_scheduler,
        list_plans_tool,
        create_plan_tool,
        update_plan_tool,
        delete_plan_tool,
        list_habits_tool,
        create_habit_tool,
        update_habit_tool,
        delete_habit_tool,
        list_reminders_tool,
        create_reminder_tool,
        update_reminder_tool,
        delete_reminder_tool,
        delete_latest_reminder_tool,
        get_workspace_state_tool,
    )
except (ImportError, ModuleNotFoundError):
    from core.workspace_tools import (  # type: ignore
        set_reminder_scheduler as set_workspace_reminder_scheduler,
        list_plans_tool,
        create_plan_tool,
        update_plan_tool,
        delete_plan_tool,
        list_habits_tool,
        create_habit_tool,
        update_habit_tool,
        delete_habit_tool,
        list_reminders_tool,
        create_reminder_tool,
        update_reminder_tool,
        delete_reminder_tool,
        delete_latest_reminder_tool,
        get_workspace_state_tool,
    )


# ============================================================================
# Logging Configuration
# ============================================================================
try:
    from backend.logging_config import (
        setup_logging,
        create_logger,
        set_request_context,
        clear_request_context,
        RequestLoggingMiddleware,
        log_performance,
        log_database_query,
        log_api_call,
        get_log_level,
    )
except (ImportError, ModuleNotFoundError):
    from logging_config import (  # type: ignore
        setup_logging,
        create_logger,
        set_request_context,
        clear_request_context,
        RequestLoggingMiddleware,
        log_performance,
        log_database_query,
        log_api_call,
        get_log_level,
    )


# ============================================================================
# Google Calendar
# ============================================================================
try:
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
except (ImportError, ModuleNotFoundError):
    from google_calendar import (  # type: ignore
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


# ============================================================================
# AI Clients
# ============================================================================
try:
    from backend.gemini_client import GeminiAttachment, GeminiService
    from backend.openrouter_client import OpenRouterService
    from backend.usage_tracker import UsageTracker, UsageLimitExceeded
except (ImportError, ModuleNotFoundError):
    from gemini_client import GeminiAttachment, GeminiService  # type: ignore
    from openrouter_client import OpenRouterService  # type: ignore
    from usage_tracker import UsageTracker, UsageLimitExceeded  # type: ignore


# ============================================================================
# Calendar & Onboarding Tools
# ============================================================================
try:
    from backend.calendar_tools import CALENDAR_TOOLS
    from backend.calendar_context import build_calendar_context
except (ImportError, ModuleNotFoundError):
    from calendar_tools import CALENDAR_TOOLS  # type: ignore
    from calendar_context import build_calendar_context  # type: ignore

try:
    from backend.onboarding_tools import ONBOARDING_TOOLS
    from backend.plan_tools import PLAN_TOOLS
except (ImportError, ModuleNotFoundError):
    from onboarding_tools import ONBOARDING_TOOLS  # type: ignore
    from plan_tools import PLAN_TOOLS  # type: ignore


# ============================================================================
# AI Message Generator & Proactivity Engine
# ============================================================================
try:
    from backend.ai_message_generator import AIMessageGenerator
    from backend.proactivity_engine import (
        ProactivityEngine,
        ProactivityRealtimeBroker,
        ProactivitySchedulerManager,
    )
except (ImportError, ModuleNotFoundError):
    from ai_message_generator import AIMessageGenerator  # type: ignore
    from proactivity_engine import (  # type: ignore
        ProactivityEngine,
        ProactivityRealtimeBroker,
        ProactivitySchedulerManager,
    )


# ============================================================================
# Model Access & Tier Utilities
# ============================================================================
try:
    from backend.model_access import coerce_model_for_tier
except (ImportError, ModuleNotFoundError):
    from model_access import coerce_model_for_tier  # type: ignore

try:
    from backend.tier_utils import normalize_plan_tier
except (ImportError, ModuleNotFoundError):
    from tier_utils import normalize_plan_tier  # type: ignore


# ============================================================================
# Pydantic Models
# ============================================================================
try:
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
    from backend.models.user import serialize_user_row
except (ImportError, ModuleNotFoundError):
    from models import (  # type: ignore
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
    from models.user import serialize_user_row  # type: ignore


# ============================================================================
# Authentication
# ============================================================================
try:
    from backend.auth import (
        get_current_user,
        get_current_user_optional,
        require_same_user,
        require_admin,
        invalidate_user_cache,
        invalidate_user_cache_redis,
    )
except (ImportError, ModuleNotFoundError):
    from auth import (  # type: ignore
        get_current_user,
        get_current_user_optional,
        require_same_user,
        require_admin,
        invalidate_user_cache,
        invalidate_user_cache_redis,
    )


# ============================================================================
# Security Utilities
# ============================================================================
try:
    from backend.security_utils import sanitize_for_logging
except (ImportError, ModuleNotFoundError):
    from security_utils import sanitize_for_logging  # type: ignore


# ============================================================================
# Database
# ============================================================================
try:
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
        transactions,
    )
except (ImportError, ModuleNotFoundError):
    from database import (  # type: ignore
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
        transactions,
    )


# ============================================================================
# Rate Limiting
# ============================================================================
try:
    from backend.core.rate_limit import (
        limiter,
        DEFAULT_RATE_LIMIT,
        RateLimitExceeded,
        _rate_limit_exceeded_handler,
    )
except (ImportError, ModuleNotFoundError):
    from core.rate_limit import (  # type: ignore
        limiter,
        DEFAULT_RATE_LIMIT,
        RateLimitExceeded,
        _rate_limit_exceeded_handler,
    )


# ============================================================================
# API - Chat Models
# ============================================================================
try:
    from backend.api.chat_models import (
        ChatAttachment as ChatAttachmentModel,
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
except (ImportError, ModuleNotFoundError):
    from api.chat_models import (  # type: ignore
        ChatAttachment as ChatAttachmentModel,
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


# ============================================================================
# Payment Utilities
# ============================================================================
try:
    from backend.payment_utils import create_core_api_transaction, verify_notification_signature
except (ImportError, ModuleNotFoundError):
    from payment_utils import create_core_api_transaction, verify_notification_signature  # type: ignore

try:
    from backend.paddle_routes import router as paddle_router
except (ImportError, ModuleNotFoundError):
    from paddle_routes import router as paddle_router  # type: ignore


# ============================================================================
# Environment Utilities
# ============================================================================
try:
    from backend.env_utils import ROOT_DIR
except (ImportError, ModuleNotFoundError):
    from env_utils import ROOT_DIR  # type: ignore

try:
    from backend.core.env_helpers import (
        float_env,
        int_env,
        is_valid_uuid,
        timestamp_ms_to_datetime,
        datetime_to_ms as datetime_to_ms_env,
        timezone_from_time_context,
        ensure_datetime_value,
    )
except (ImportError, ModuleNotFoundError):
    from core.env_helpers import (  # type: ignore
        float_env,
        int_env,
        is_valid_uuid,
        timestamp_ms_to_datetime,
        datetime_to_ms as datetime_to_ms_env,
        timezone_from_time_context,
        ensure_datetime_value,
    )


# ============================================================================
# Core - Dashboard Helpers
# ============================================================================
try:
    from backend.core.dashboard_helpers import (
        serialize_dashboard_pulse_record,
        carry_forward_dashboard_entries,
        coerce_activity_day,
    )
except (ImportError, ModuleNotFoundError):
    from core.dashboard_helpers import (  # type: ignore
        serialize_dashboard_pulse_record,
        carry_forward_dashboard_entries,
        coerce_activity_day,
    )


# ============================================================================
# Core - Log Utilities
# ============================================================================
try:
    from backend.core.log_utils import payload_log_summary
except (ImportError, ModuleNotFoundError):
    from core.log_utils import payload_log_summary  # type: ignore


# ============================================================================
# Core - General Conversation
# ============================================================================
try:
    from backend.core.general_conversation import (
        load_general_conversation_history,
        insert_general_conversation_message,
        replace_general_conversation_history,
        delete_general_conversation_history,
        ensure_user_data_record,
    )
except (ImportError, ModuleNotFoundError):
    from core.general_conversation import (  # type: ignore
        load_general_conversation_history,
        insert_general_conversation_message,
        replace_general_conversation_history,
        delete_general_conversation_history,
        ensure_user_data_record,
    )


# ============================================================================
# Core - Onboarding Handler
# ============================================================================
try:
    from backend.core.onboarding_handler import complete_onboarding
except (ImportError, ModuleNotFoundError):
    from core.onboarding_handler import complete_onboarding  # type: ignore


# ============================================================================
# Core - Title Generator
# ============================================================================
try:
    from backend.core.title_generator import generate_chat_title_inline
except (ImportError, ModuleNotFoundError):
    from core.title_generator import generate_chat_title_inline  # type: ignore


# ============================================================================
# Core - Media Attachments
# ============================================================================
try:
    from backend.core.media_attachments import (
        resolve_media_attachments,
        generate_image_descriptions,
    )
except (ImportError, ModuleNotFoundError):
    from core.media_attachments import (  # type: ignore
        resolve_media_attachments,
        generate_image_descriptions,
    )


# ============================================================================
# Core - Conversation Manager
# ============================================================================
try:
    from backend.core.conversation_manager import (
        load_conversation_history,
        get_or_create_conversation,
        save_conversation_message,
    )
except (ImportError, ModuleNotFoundError):
    from core.conversation_manager import (  # type: ignore
        load_conversation_history,
        get_or_create_conversation,
        save_conversation_message,
    )


# ============================================================================
# Core - Proactivity Helpers
# ============================================================================
try:
    from backend.core.proactivity_helpers import fetch_proactivity_summary
except (ImportError, ModuleNotFoundError):
    from core.proactivity_helpers import fetch_proactivity_summary  # type: ignore


# ============================================================================
# Core - Chat Starter Helpers
# ============================================================================
try:
    from backend.core.chat_starter_helpers import (
        sse_event,
        starter_profile_context,
        starter_fallback_message,
        build_starter_prompt,
    )
except (ImportError, ModuleNotFoundError):
    from core.chat_starter_helpers import (  # type: ignore
        sse_event,
        starter_profile_context,
        starter_fallback_message,
        build_starter_prompt,
    )


# ============================================================================
# Core - Function Call Helpers
# ============================================================================
try:
    from backend.core.function_call_helpers import (
        build_function_call_contents,
        extract_function_call,
        format_tool_results_for_context,
    )
except (ImportError, ModuleNotFoundError):
    from core.function_call_helpers import (  # type: ignore
        build_function_call_contents,
        extract_function_call,
        format_tool_results_for_context,
    )


# ============================================================================
# Core - Stream Handlers
# ============================================================================
try:
    from backend.core.stream_handlers.hybrid import (
        fetch_url_context_with_gemini as fetch_url_context_with_gemini_hybrid,
        execute_tools_with_gemini_flash as execute_tools_with_gemini_flash_hybrid,
        has_onboarding_tool as has_onboarding_tool_hybrid,
    )
except (ImportError, ModuleNotFoundError):
    from core.stream_handlers.hybrid import (  # type: ignore
        fetch_url_context_with_gemini as fetch_url_context_with_gemini_hybrid,
        execute_tools_with_gemini_flash as execute_tools_with_gemini_flash_hybrid,
        has_onboarding_tool as has_onboarding_tool_hybrid,
    )

# URL extraction function (from text_utils or message_detection)
try:
    from backend.core.message_detection import extract_urls_from_message
except (ImportError, ModuleNotFoundError):
    from core.message_detection import extract_urls_from_message  # type: ignore

try:
    from backend.core.stream_handlers.openrouter import stream_openrouter_response
except (ImportError, ModuleNotFoundError):
    from core.stream_handlers.openrouter import stream_openrouter_response  # type: ignore

try:
    from backend.core.stream_handlers.gemini_stream import stream_gemini_response
except (ImportError, ModuleNotFoundError):
    from core.stream_handlers.gemini_stream import stream_gemini_response  # type: ignore

try:
    from backend.core.stream_handlers.context import (
        build_intent_window_text,
        consolidate_gemini_tools,
        add_url_context_tool_if_needed,
        add_maps_tool_if_needed,
        determine_provider_and_model,
    )
except (ImportError, ModuleNotFoundError):
    from core.stream_handlers.context import (  # type: ignore
        build_intent_window_text,
        consolidate_gemini_tools,
        add_url_context_tool_if_needed,
        add_maps_tool_if_needed,
        determine_provider_and_model,
    )


# ============================================================================
# Core - AI Response Context
# ============================================================================
try:
    from backend.core.ai_response_context import (
        load_context_cache as load_context_cache_helper,
        build_workspace_context,
        prepare_tool_list,
    )
except (ImportError, ModuleNotFoundError):
    from core.ai_response_context import (  # type: ignore
        load_context_cache as load_context_cache_helper,
        build_workspace_context,
        prepare_tool_list,
    )


# ============================================================================
# Core - AI Config
# ============================================================================
try:
    from backend.core.ai_config import (
        AI_PROVIDER,
        GEMINI_DEFAULT_MODEL,
        OPENROUTER_LITE_MODEL,
        GEMINI_LIGHT_MODEL,
        REMINDER_MODEL,
        VALIDATE_GEMINI_ON_STARTUP,
        tier_conversation_token_limit as tier_conversation_token_limit_base,
        REMINDER_FUNCTION_NAMES,
        REMINDER_RESPONSE_FORMAT,
        get_search_tool,
        get_url_context_tool,
        get_default_chat_tools,
        GLOBAL_SYSTEM_PROMPTS_PATH,
        SINGLE_CALL_PER_TURN_TOOLS,
    )
except (ImportError, ModuleNotFoundError):
    from core.ai_config import (  # type: ignore
        AI_PROVIDER,
        GEMINI_DEFAULT_MODEL,
        OPENROUTER_LITE_MODEL,
        GEMINI_LIGHT_MODEL,
        REMINDER_MODEL,
        VALIDATE_GEMINI_ON_STARTUP,
        tier_conversation_token_limit as tier_conversation_token_limit_base,
        REMINDER_FUNCTION_NAMES,
        REMINDER_RESPONSE_FORMAT,
        get_search_tool,
        get_url_context_tool,
        get_default_chat_tools,
        GLOBAL_SYSTEM_PROMPTS_PATH,
        SINGLE_CALL_PER_TURN_TOOLS,
    )


# ============================================================================
# Core - Reminder Enrichment
# ============================================================================
try:
    from backend.core.reminder_enrichment import (
        maybe_enrich_actions_with_reminder_time,
        create_reminders_from_actions as create_reminders_from_actions_base,
    )
except (ImportError, ModuleNotFoundError):
    from core.reminder_enrichment import (  # type: ignore
        maybe_enrich_actions_with_reminder_time,
        create_reminders_from_actions as create_reminders_from_actions_base,
    )


# ============================================================================
# Core - Migrations
# ============================================================================
try:
    from backend.core.migrations import (
        ensure_paddle_columns,
        run_basic_migrations,
    )
except (ImportError, ModuleNotFoundError):
    from core.migrations import (  # type: ignore
        ensure_paddle_columns,
        run_basic_migrations,
    )


# ============================================================================
# Reminder Scheduler
# ============================================================================
try:
    from backend.reminder_scheduler import ReminderSchedulerManager
except (ImportError, ModuleNotFoundError):
    try:
        from reminder_scheduler import ReminderSchedulerManager  # type: ignore
    except (ImportError, ModuleNotFoundError):
        ReminderSchedulerManager = None  # type: ignore


# ============================================================================
# Error Handlers
# ============================================================================
try:
    from backend.error_handlers import register_error_handlers
except (ImportError, ModuleNotFoundError):
    try:
        from error_handlers import register_error_handlers  # type: ignore
    except (ImportError, ModuleNotFoundError):
        register_error_handlers = None  # type: ignore


# ============================================================================
# Caching Headers Middleware
# ============================================================================
try:
    from backend.caching_headers import caching_middleware
except (ImportError, ModuleNotFoundError):
    try:
        from caching_headers import caching_middleware  # type: ignore
    except (ImportError, ModuleNotFoundError):
        caching_middleware = None  # type: ignore


# ============================================================================
# Audit Logger
# ============================================================================
try:
    from backend.audit_logger import init_audit_logger
except (ImportError, ModuleNotFoundError):
    from audit_logger import init_audit_logger  # type: ignore
