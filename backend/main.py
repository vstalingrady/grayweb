import logging
import math
import socket
import ipaddress
import asyncio
import sqlite3
from dateutil import parser as date_parser
from fastapi import FastAPI, HTTPException, Depends, status, File, Form, Query, UploadFile, Response, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any, AsyncGenerator, Tuple, Union, Iterable, Set, Mapping
import databases
import sqlalchemy
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo

# Time helpers (avoid datetime.utcnow() deprecation)
try:
    from backend.time_utils import utcnow, utcnow_aware
except Exception:  # When running with backend/ on sys.path directly (tests)
    from time_utils import utcnow, utcnow_aware  # type: ignore
import os
import json
import statistics
from asyncio import TimeoutError, wait_for, sleep
from contextlib import asynccontextmanager
import re
import time
import hmac
import hashlib
import shutil
import subprocess
from dotenv import load_dotenv
from supabase import Client
import psycopg2
# Support both package and module import contexts
try:
    from backend.supabase_utils import (
        create_supabase_client,
        create_supabase_service_client,
        resolve_supabase_credentials,
    )  # type: ignore
except Exception:  # When running with backend/ on sys.path directly (tests)
    from supabase_utils import (
        create_supabase_client,
        create_supabase_service_client,
        resolve_supabase_credentials,
    )  # type: ignore
try:
    from backend.core import conversation_store
    from backend.core.conversation_store import (
        configure_conversation_store,
        get_or_create_conversation,
        save_conversation_message,
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
except Exception:  # When running with backend/ on sys.path directly (tests)
    from core import conversation_store  # type: ignore
    from core.conversation_store import (  # type: ignore
        configure_conversation_store,
        get_or_create_conversation,
        save_conversation_message,
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
try:
    from backend.core.chat_history import (
        normalize_conversation_history,
        load_thread_history,
        overwrite_thread_history,
        normalize_conversation_title,
        apply_conversation_update,
        update_conversation_title,
    )
except Exception:
    from core.chat_history import (  # type: ignore
        normalize_conversation_history,
        load_thread_history,
        overwrite_thread_history,
        normalize_conversation_title,
        apply_conversation_update,
        update_conversation_title,
    )

# File handling utilities (extracted from main.py)
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
        sanitize_filename as _sanitize_filename,
        normalize_mime as _normalize_mime,
        sniff_mime_type as _sniff_mime_type,
        reject_if_suspicious as _reject_if_suspicious,
        scan_file_for_malware as _scan_file_for_malware,
        ensure_storage_path as _ensure_storage_path,
        resolve_storage_path_from_record as _resolve_storage_path_from_record,
        persist_upload_file as _persist_upload_file,
    )
except ImportError:
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
        sanitize_filename as _sanitize_filename,
        normalize_mime as _normalize_mime,
        sniff_mime_type as _sniff_mime_type,
        reject_if_suspicious as _reject_if_suspicious,
        scan_file_for_malware as _scan_file_for_malware,
        ensure_storage_path as _ensure_storage_path,
        resolve_storage_path_from_record as _resolve_storage_path_from_record,
        persist_upload_file as _persist_upload_file,
    )

# SQLite migration helpers (extracted from main.py)
try:
    from backend.core.sqlite_helpers import (
        ensure_sqlite_columns as _ensure_sqlite_columns,
        ensure_sqlite_table as _ensure_sqlite_table,
        ensure_sqlite_index as _ensure_sqlite_index,
        drop_sqlite_table as _drop_sqlite_table,
        rebuild_sqlite_table_without_columns as _rebuild_sqlite_table_without_columns,
    )
except ImportError:
    from core.sqlite_helpers import (  # type: ignore
        ensure_sqlite_columns as _ensure_sqlite_columns,
        ensure_sqlite_table as _ensure_sqlite_table,
        ensure_sqlite_index as _ensure_sqlite_index,
        drop_sqlite_table as _drop_sqlite_table,
        rebuild_sqlite_table_without_columns as _rebuild_sqlite_table_without_columns,
    )

# Prompt loading utilities (extracted from main.py)
try:
    from backend.core.prompt_utils import (
        load_prompt_from_file,
        load_prompt_from_json,
        normalize_prompt_locale as _normalize_prompt_locale,
        prompt_locale_from_request as _prompt_locale_from_request,
    )
except ImportError:
    from core.prompt_utils import (  # type: ignore
        load_prompt_from_file,
        load_prompt_from_json,
        normalize_prompt_locale as _normalize_prompt_locale,
        prompt_locale_from_request as _prompt_locale_from_request,
    )

# CORS utilities (extracted from main.py)
try:
    from backend.core.cors_utils import (
        IS_PRODUCTION,
        DEFAULT_DEV_ORIGIN_PORTS,
        LOCAL_NETWORK_ORIGIN_PATTERN,
        split_env_list as _split_env_list,
        origin_variants as _origin_variants,
        local_network_origins as _local_network_origins,
        local_network_origin_regex as _local_network_origin_regex,
        build_allowed_origins as _build_allowed_origins,
    )
except ImportError:
    from core.cors_utils import (  # type: ignore
        IS_PRODUCTION,
        DEFAULT_DEV_ORIGIN_PORTS,
        LOCAL_NETWORK_ORIGIN_PATTERN,
        split_env_list as _split_env_list,
        origin_variants as _origin_variants,
        local_network_origins as _local_network_origins,
        local_network_origin_regex as _local_network_origin_regex,
        build_allowed_origins as _build_allowed_origins,
    )

# Cache utilities (extracted from main.py)
try:
    from backend.core.cache import (
        TTLCache,
        AsyncTTLCache,
        USER_CACHE,
        CONVERSATION_OWNER_CACHE,
        CONVERSATION_HISTORY_CACHE,
    )
except ImportError:
    from core.cache import (  # type: ignore
        TTLCache,
        AsyncTTLCache,
        USER_CACHE,
        CONVERSATION_OWNER_CACHE,
        CONVERSATION_HISTORY_CACHE,
    )

# Message detection utilities (extracted from main.py)
try:
    from backend.core.message_detection import (
        REMINDER_KEYWORDS as _REMINDER_KEYWORDS,
        TOOL_TRIGGER_KEYWORDS as _TOOL_TRIGGER_KEYWORDS,
        needs_structured_tools as _needs_structured_tools,
        should_request_structured_reminders as _should_request_structured_reminders,
        should_use_web_search as _should_use_web_search,
        should_enable_search as _should_enable_search,
    )
except ImportError:
    from core.message_detection import (  # type: ignore
        REMINDER_KEYWORDS as _REMINDER_KEYWORDS,
        TOOL_TRIGGER_KEYWORDS as _TOOL_TRIGGER_KEYWORDS,
        needs_structured_tools as _needs_structured_tools,
        should_request_structured_reminders as _should_request_structured_reminders,
        should_use_web_search as _should_use_web_search,
        should_enable_search as _should_enable_search,
    )

# Serialization utilities (extracted from main.py)
try:
    from backend.core.serializers import (
        row_get as _row_get,
        parse_json_field as _parse_json_field,
        serialize_reminder_row as _serialize_reminder_row,
        serialize_habit_record as _serialize_habit_record,
        serialize_proactivity_notification as _serialize_proactivity_notification,
        serialize_context_cache as _serialize_context_cache,
        normalize_plan_items as _normalize_plan_items,
        normalize_habit_items as _normalize_habit_items,
        normalize_proactivity as _normalize_proactivity,
        datetime_to_ms as _datetime_to_ms,
        parse_iso_timestamp as _parse_iso_timestamp,
        DEFAULT_DASHBOARD_PROACTIVITY,
    )
except ImportError:
    from core.serializers import (  # type: ignore
        row_get as _row_get,
        parse_json_field as _parse_json_field,
        serialize_reminder_row as _serialize_reminder_row,
        serialize_habit_record as _serialize_habit_record,
        serialize_proactivity_notification as _serialize_proactivity_notification,
        serialize_context_cache as _serialize_context_cache,
        normalize_plan_items as _normalize_plan_items,
        normalize_habit_items as _normalize_habit_items,
        normalize_proactivity as _normalize_proactivity,
        datetime_to_ms as _datetime_to_ms,
        parse_iso_timestamp as _parse_iso_timestamp,
        DEFAULT_DASHBOARD_PROACTIVITY,
    )

# AI utilities (extracted from main.py)
try:
    from backend.core.ai_utils import (
        prefers_gemini_model as _prefers_gemini_model,
        candidate_text as _candidate_text,
        candidate_thought as _candidate_thought,
        candidate_grounding_payload as _candidate_grounding_payload,
        merge_extra_contents as _merge_extra_contents,
        materialize_structured_reminders as _materialize_structured_reminders,
        clean_title as _clean_title,
        fallback_title_from_message as _fallback_title_from_message,
    )
except ImportError:
    from core.ai_utils import (  # type: ignore
        prefers_gemini_model as _prefers_gemini_model,
        candidate_text as _candidate_text,
        candidate_thought as _candidate_thought,
        candidate_grounding_payload as _candidate_grounding_payload,
        merge_extra_contents as _merge_extra_contents,
        materialize_structured_reminders as _materialize_structured_reminders,
        clean_title as _clean_title,
        fallback_title_from_message as _fallback_title_from_message,
    )

# Tool handlers (extracted from main.py)
try:
    from backend.core.tool_handlers import (
        set_reminder_scheduler as _set_tool_reminder_scheduler,
        parse_iso_datetime as _parse_iso_datetime,
        normalize_remind_at as _normalize_remind_at,
        parse_remind_at as _parse_remind_at,
        build_reminder_payload as _build_reminder_payload,
        list_calendar_events as _list_calendar_events,
        create_calendar_event as _create_calendar_event,
        update_calendar_event as _update_calendar_event,
        delete_calendar_event as _delete_calendar_event,
        list_plans_tool as _list_plans_tool,
        list_habits_tool as _list_habits_tool,
        list_reminders_tool as _list_reminders_tool,
        get_workspace_state_tool as _get_workspace_state_tool,
        create_reminder_tool as _create_reminder_tool,
        update_reminder_tool as _update_reminder_tool,
        delete_reminder_tool as _delete_reminder_tool,
        delete_latest_reminder_tool as _delete_latest_reminder_tool,
    )
except ImportError:
    from core.tool_handlers import (  # type: ignore
        set_reminder_scheduler as _set_tool_reminder_scheduler,
        parse_iso_datetime as _parse_iso_datetime,
        normalize_remind_at as _normalize_remind_at,
        parse_remind_at as _parse_remind_at,
        build_reminder_payload as _build_reminder_payload,
        list_calendar_events as _list_calendar_events,
        create_calendar_event as _create_calendar_event,
        update_calendar_event as _update_calendar_event,
        delete_calendar_event as _delete_calendar_event,
        list_plans_tool as _list_plans_tool,
        list_habits_tool as _list_habits_tool,
        list_reminders_tool as _list_reminders_tool,
        get_workspace_state_tool as _get_workspace_state_tool,
        create_reminder_tool as _create_reminder_tool,
        update_reminder_tool as _update_reminder_tool,
        delete_reminder_tool as _delete_reminder_tool,
        delete_latest_reminder_tool as _delete_latest_reminder_tool,
    )

# Entity reminder operations (extracted from main.py)
try:
    from backend.core.entity_reminders import (
        set_reminder_scheduler as _set_entity_reminder_scheduler,
        get_pending_entity_reminder_map as _get_pending_entity_reminder_map,
        delete_pending_entity_reminders as _delete_pending_entity_reminders,
        delete_all_entity_reminders as _delete_all_entity_reminders,
        upsert_entity_reminder as _upsert_entity_reminder,
    )
except ImportError:
    from core.entity_reminders import (  # type: ignore
        set_reminder_scheduler as _set_entity_reminder_scheduler,
        get_pending_entity_reminder_map as _get_pending_entity_reminder_map,
        delete_pending_entity_reminders as _delete_pending_entity_reminders,
        delete_all_entity_reminders as _delete_all_entity_reminders,
        upsert_entity_reminder as _upsert_entity_reminder,
    )

# Workspace tool handlers (extracted from main.py)
try:
    from backend.core.workspace_tools import (
        set_reminder_scheduler as _set_workspace_reminder_scheduler,
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
    )
except ImportError:
    from core.workspace_tools import (  # type: ignore
        set_reminder_scheduler as _set_workspace_reminder_scheduler,
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
    )

from uuid import UUID, uuid4
from pathlib import Path
from urllib.parse import urlparse


# NODE_ENV, ENVIRONMENT, IS_PRODUCTION now imported from core.cors_utils

# Enhanced logging imports
try:
    from backend.logging_config import (
        setup_logging, create_logger, set_request_context, clear_request_context,
        RequestLoggingMiddleware, log_performance, log_database_query, log_api_call,
        get_log_level
    )
except ImportError:
    from logging_config import (
        setup_logging, create_logger, set_request_context, clear_request_context,
        RequestLoggingMiddleware, log_performance, log_database_query, log_api_call,
        get_log_level
    )

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
    from google.genai import types
    from backend.gemini_client import GeminiAttachment, GeminiService
    from backend.openrouter_client import OpenRouterService
    from backend.usage_tracker import UsageTracker, UsageLimitExceeded
except ImportError:
    from google_calendar import (
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
    from gemini_client import GeminiAttachment, GeminiService
    from openrouter_client import OpenRouterService
    from usage_tracker import UsageTracker, UsageLimitExceeded
try:
    from backend.calendar_tools import CALENDAR_TOOLS
    from backend.calendar_context import build_calendar_context
except ImportError:
    from calendar_tools import CALENDAR_TOOLS
    from calendar_context import build_calendar_context
try:
    from backend.onboarding_tools import ONBOARDING_TOOLS
    from backend.plan_tools import PLAN_TOOLS
except ImportError:
    from onboarding_tools import ONBOARDING_TOOLS
    from plan_tools import PLAN_TOOLS

try:
    from backend.ai_message_generator import AIMessageGenerator
    from backend.proactivity_engine import (
        ProactivityEngine,
        ProactivityRealtimeBroker,
        ProactivitySchedulerManager,
    )
except ImportError:
    from ai_message_generator import AIMessageGenerator
    from proactivity_engine import (
        ProactivityEngine,
        ProactivityRealtimeBroker,
        ProactivitySchedulerManager,
    )

try:
    from backend.model_access import coerce_model_for_tier
except ImportError:
    from model_access import coerce_model_for_tier

try:
    from backend.tier_utils import normalize_plan_tier
except ImportError:
    from tier_utils import normalize_plan_tier  # type: ignore

# Pydantic models
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
    from backend.models.user import serialize_user_row as _serialize_user_row
except ImportError:
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
    from models.user import serialize_user_row as _serialize_user_row  # type: ignore

# Authentication module
try:
    from backend.auth import (
        get_current_user,
        get_current_user_optional,
        require_same_user,
        require_admin,
        invalidate_user_cache,
        invalidate_user_cache_redis,
    )
except ImportError:
    from auth import (  # type: ignore
        get_current_user,
        get_current_user_optional,
        require_same_user,
        require_admin,
        invalidate_user_cache,
        invalidate_user_cache_redis,
    )

# Security utilities
try:
    from backend.security_utils import sanitize_for_logging
except ImportError:
    from security_utils import sanitize_for_logging

# Database module
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
    )
except ImportError:
    from database import (
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
    )

try:
    from backend.core.rate_limit import (
        limiter,
        DEFAULT_RATE_LIMIT,
        RateLimitExceeded,
        _rate_limit_exceeded_handler,
    )
except Exception:
    from core.rate_limit import (  # type: ignore
        limiter,
        DEFAULT_RATE_LIMIT,
        RateLimitExceeded,
        _rate_limit_exceeded_handler,
    )

try:
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
except Exception:
    from api.chat_models import (  # type: ignore
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
try:
    from backend.payment_utils import create_core_api_transaction, verify_notification_signature
except ImportError:
    from payment_utils import create_core_api_transaction, verify_notification_signature

try:
    from backend.database import transactions
except ImportError:
    from database import transactions

try:
    from backend.paddle_routes import router as paddle_router
except ImportError:
    from paddle_routes import router as paddle_router

# Use centralized environment detection
try:
    from backend.env_utils import ROOT_DIR
except ImportError:
    from env_utils import ROOT_DIR

# Environment helpers (extracted from main.py)
try:
    from backend.core.env_helpers import (
        float_env as _float_env,
        int_env as _int_env,
        is_valid_uuid as _is_valid_uuid,
        timestamp_ms_to_datetime as _timestamp_ms_to_datetime,
        datetime_to_ms as _datetime_to_ms,
        timezone_from_time_context as _timezone_from_time_context,
        ensure_datetime_value as _ensure_datetime_value,
    )
except ImportError:
    from core.env_helpers import (  # type: ignore
        float_env as _float_env,
        int_env as _int_env,
        is_valid_uuid as _is_valid_uuid,
        timestamp_ms_to_datetime as _timestamp_ms_to_datetime,
        datetime_to_ms as _datetime_to_ms,
        timezone_from_time_context as _timezone_from_time_context,
        ensure_datetime_value as _ensure_datetime_value,
    )

# Dashboard helpers (extracted from main.py)
try:
    from backend.core.dashboard_helpers import (
        serialize_dashboard_pulse_record as _serialize_dashboard_pulse_record,
        carry_forward_dashboard_entries as _carry_forward_dashboard_entries,
        coerce_activity_day as _coerce_activity_day,
    )
except ImportError:
    from core.dashboard_helpers import (  # type: ignore
        serialize_dashboard_pulse_record as _serialize_dashboard_pulse_record,
        carry_forward_dashboard_entries as _carry_forward_dashboard_entries,
        coerce_activity_day as _coerce_activity_day,
    )

# Log utilities (extracted from main.py)
try:
    from backend.core.log_utils import payload_log_summary as _payload_log_summary
except ImportError:
    from core.log_utils import payload_log_summary as _payload_log_summary  # type: ignore

# General conversation handlers (extracted from main.py)
try:
    from backend.core.general_conversation import (
        load_general_conversation_history as _load_general_conversation_history,
        insert_general_conversation_message as _insert_general_conversation_message,
        replace_general_conversation_history as _replace_general_conversation_history,
        delete_general_conversation_history as _delete_general_conversation_history,
        ensure_user_data_record as _ensure_user_data_record,
    )
except ImportError:
    from core.general_conversation import (  # type: ignore
        load_general_conversation_history as _load_general_conversation_history,
        insert_general_conversation_message as _insert_general_conversation_message,
        replace_general_conversation_history as _replace_general_conversation_history,
        delete_general_conversation_history as _delete_general_conversation_history,
        ensure_user_data_record as _ensure_user_data_record,
    )

# Onboarding handler (extracted from main.py)
try:
    from backend.core.onboarding_handler import complete_onboarding as _complete_onboarding
except ImportError:
    from core.onboarding_handler import complete_onboarding as _complete_onboarding  # type: ignore

# Title generator (extracted from main.py)
try:
    from backend.core.title_generator import generate_chat_title_inline as _generate_chat_title_inline
except ImportError:
    from core.title_generator import generate_chat_title_inline as _generate_chat_title_inline  # type: ignore

# Media attachments (extracted from main.py)
try:
    from backend.core.media_attachments import (
        resolve_media_attachments as _resolve_media_attachments,
        generate_image_descriptions as _generate_image_descriptions,
    )
except ImportError:
    from core.media_attachments import (  # type: ignore
        resolve_media_attachments as _resolve_media_attachments,
        generate_image_descriptions as _generate_image_descriptions,
    )

load_dotenv(ROOT_DIR / ".env")


SUPABASE_POOLER_HOST = os.getenv("SUPABASE_POOLER_HOST", "aws-1-ap-south-1.pooler.supabase.com")
SUPABASE_POOLER_PORT = int(os.getenv("SUPABASE_POOLER_PORT", "6543"))

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


# _float_env, _int_env are now imported from core.env_helpers


# load_prompt_from_file, load_prompt_from_json, _normalize_prompt_locale, _prompt_locale_from_request
# are now imported from core.prompt_utils

AI_PROVIDER = (os.getenv("AI_PROVIDER") or "openrouter").strip().lower()
# Default lite tier provider - using OpenRouter for all models
LITE_TIER_PROVIDER = (os.getenv("LITE_TIER_PROVIDER") or "openrouter").strip().lower()
OPENROUTER_FALLBACK_MODEL = os.getenv("OPENROUTER_FALLBACK_MODEL", "anthropic/claude-sonnet-4.5")

# Conversation memory/context limits (tokens) by plan tier.
# "64,000 token memory" refers to tokens of conversation history included as context.
TIER_CONVERSATION_TOKEN_LIMITS: Dict[str, int] = {
    "scout": 65_536,
    "voyager": 2_000_000,
    "pioneer": 2_000_000,
}


def tier_conversation_token_limit(plan_tier: Optional[str]) -> int:
    normalized = normalize_plan_tier(plan_tier)
    return TIER_CONVERSATION_TOKEN_LIMITS.get(normalized, TIER_CONVERSATION_TOKEN_LIMITS["scout"])


GEMINI_SERVICE = GeminiService()
OPENROUTER_SERVICE = OpenRouterService()
# GROQ_SERVICE removed - using OpenRouter for all models
VALIDATE_GEMINI_ON_STARTUP = os.getenv("VALIDATE_GEMINI_ON_STARTUP", "true").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}

AI_MESSAGE_GENERATOR = AIMessageGenerator()

# File upload constants (CLAMAV_*, MEDIA_UPLOAD_*, IMAGE_MIME_TYPES, etc.)
# are imported from core.file_utils. Ensure upload directory exists:
MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# File utility functions (_sanitize_filename, _normalize_mime, _sniff_mime_type, _reject_if_suspicious,
# _scan_file_for_malware, _ensure_storage_path, _resolve_storage_path_from_record, _persist_upload_file)
# are now imported from core.file_utils


SEARCH_TOOL = types.Tool(
    google_search=types.GoogleSearch(),
)

# URL Context Tool - allows AI to fetch and analyze content from URLs
URL_CONTEXT_TOOL = types.Tool(
    url_context=types.UrlContext(),
)


# PLAN_TOOLS not included by default - added conditionally based on message intent
# CALENDAR_TOOLS removed from default - tool definitions add ~2s latency to OpenRouter
# This prevents the LLM from calling get_workspace_state on simple casual messages
DEFAULT_CHAT_TOOLS = [SEARCH_TOOL]

PROMPTS_DIR = ROOT_DIR / "backend" / "prompts"
GLOBAL_SYSTEM_PROMPTS_PATH = ROOT_DIR / "public" / "system-prompts.json"
ONBOARDING_PROMPT_PATH = PROMPTS_DIR / "onboarding.txt"



# SQLite helper functions (_ensure_sqlite_columns, _ensure_sqlite_table, _ensure_sqlite_index,
# _drop_sqlite_table, _rebuild_sqlite_table_without_columns) are now imported from core.sqlite_helpers


# Run all SQLite migrations using the unified helpers
_ensure_sqlite_columns("users", [
    ("auth_user_id", "TEXT", None),
    ("subscription_expires_at", "DATETIME", None),
    ("paddle_customer_id", "TEXT", None),
    ("paddle_subscription_id", "TEXT", None),
    ("has_seen_general_chat", "BOOLEAN", "0"),
    ("maps_enabled", "BOOLEAN", "0"),
    ("improve_model_for_everyone", "BOOLEAN", "0"),
    ("daily_token_usage", "INTEGER", "0"),
    ("monthly_cost_usage", "REAL", "0"),
    ("weekly_cost_usage", "REAL", "0"),
    ("six_hour_cost_usage", "REAL", "0"),
    ("last_daily_reset", "TEXT", None),
    ("last_monthly_reset", "TEXT", None),
    ("last_weekly_reset", "TEXT", None),
    ("last_six_hour_reset", "TEXT", None),
    ("daily_gemini_pro_usage", "INTEGER", "0"),
    ("last_daily_gemini_pro_reset", "TEXT", None),
    ("workspace_background_id", "TEXT", None),
    ("personalization_show_calendar", "BOOLEAN", "1"),
    ("personalization_system_prompt_override", "TEXT", None),
    ("preferred_model", "TEXT", None),
    ("theme_mode", "TEXT", None),
    ("ui_locale", "TEXT", None),
    ("preferred_response_language", "TEXT", None),
    ("notification_preferences", "TEXT", None),
    ("conversation_memory_enabled", "BOOLEAN", "1"),
    ("auto_web_search_enabled", "BOOLEAN", "0"),
    ("visible_model_ids", "TEXT", None),
], backfill_nulls={
    "has_seen_general_chat": "0",
    "maps_enabled": "0",
    "improve_model_for_everyone": "0",
    "daily_token_usage": "0",
    "monthly_cost_usage": "0",
    "weekly_cost_usage": "0",
    "six_hour_cost_usage": "0",
    "daily_gemini_pro_usage": "0",
    "conversation_memory_enabled": "1",
    "auto_web_search_enabled": "0",
})

_ensure_sqlite_columns("user_data", [
    ("profile", "JSON", None),
    ("context", "JSON", None),
    ("metadata", "JSON", None),
    ("workspace_context", "TEXT", None),
    ("long_term_memory", "TEXT", None),
])

_ensure_sqlite_table("general_chat_messages", """
    CREATE TABLE general_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_data_id INTEGER,
        role VARCHAR,
        content VARCHAR,
        grounding_metadata JSON,
        reminders JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
""")

# Archive table for rolling memory compression (local-only).
_ensure_sqlite_table("archived_chat_messages", """
    CREATE TABLE archived_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_data_id INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        grounding_metadata JSON,
        attachments JSON,
        reminders JSON,
        original_created_at DATETIME,
        archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        compression_batch_id TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
""")

# Ensure reminders column exists for existing general_chat_messages tables
_ensure_sqlite_columns("general_chat_messages", [
    ("reminders", "JSON", None),
])

_ensure_sqlite_index("archived_chat_messages", "ix_archived_chat_messages_user_id", "user_id")
_ensure_sqlite_index("user_chat_messages", "ix_user_chat_messages_thread_id", "thread_id")

# Ensure transactions table has billing_cycle column (added for payment billing cycle tracking)
_ensure_sqlite_columns("transactions", [
    ("billing_cycle", "VARCHAR", None),
    ("subscription_starts_at", "DATETIME", None),
    ("subscription_ends_at", "DATETIME", None),
    ("paddle_transaction_id", "TEXT", None),
])


# database and metadata imported from backend.database


STREAMING_TOKEN_DELAY = max(0.0, _float_env("GRAY_STREAMING_TOKEN_DELAY_SECONDS", 0.0))

DEFAULT_DEV_ORIGIN_PORTS = (3000, 5173)

REMINDER_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "gray_reminder_payload",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "User-facing reply text."},
                "reminders": {
                    "type": "array",
                    "description": "List of reminder payloads to render and execute.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": ["gray.reminder"]},
                            "source": {"type": "string", "enum": ["native/backend"]},
                            "status": {"type": "string", "enum": ["created", "updated", "completed", "deleted"]},
                            "entity": {"type": "string", "enum": ["plan", "habit", "reminder"]},
                            "data": {
                                "type": "object",
                                "additionalProperties": True,
                            },
                        },
                        "required": ["type", "source", "status", "entity", "data"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["message", "reminders"],
            "additionalProperties": False,
        },
    },
}

REMINDER_MODEL = os.getenv("REMINDER_MODEL", "models/gemini-flash-lite-latest")
GROK_TOOL_MODEL = os.getenv("GROK_TOOL_MODEL", "x-ai/grok-4.1-fast")
GROK_DEFAULT_MODEL = os.getenv("GROK_DEFAULT_MODEL", OPENROUTER_SERVICE.lite_model if OPENROUTER_SERVICE else "x-ai/grok-4.1-fast")
# GROQ_LITE_MODEL removed - using OpenRouter for lite tier
# Hardcoded to x-ai/grok-4.1-fast - don't use env var for now
OPENROUTER_LITE_MODEL = os.getenv("OPENROUTER_LITE_MODEL", "x-ai/grok-4.1-fast")
GEMINI_DEFAULT_MODEL = os.getenv("GEMINI_DEFAULT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_LIGHT_MODEL = os.getenv("GEMINI_LIGHT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_PRO_MODEL = os.getenv("GEMINI_PRO_MODEL", "models/gemini-3-pro-preview")
REMINDER_FUNCTION_NAMES = (
    "create_plan",
    "update_plan",
    "delete_plan",
    "create_habit",
    "update_habit",
    "delete_habit",
    "create_reminder",
    "add_reminder",
    "update_reminder",
    "delete_reminder",
    "delete_latest_reminder",
    "list_reminders",
    "complete_onboarding",
)

# Message detection keywords and functions (REMINDER_KEYWORDS, TOOL_TRIGGER_KEYWORDS,
# _needs_structured_tools, _should_request_structured_reminders, _should_enable_search,
# _should_use_web_search) are now imported from core.message_detection

# Use imported versions with consistent naming
REMINDER_KEYWORDS = _REMINDER_KEYWORDS
TOOL_TRIGGER_KEYWORDS = _TOOL_TRIGGER_KEYWORDS

# CORS utility functions (_split_env_list, _origin_variants, _local_network_origins,
# _build_allowed_origins, _local_network_origin_regex) are now imported from core.cors_utils

# AI utility functions (_prefers_gemini_model, _materialize_structured_reminders,
# _candidate_text, _candidate_thought, _candidate_grounding_payload, _merge_extra_contents,
# _clean_title, _fallback_title_from_message) are now imported from core.ai_utils

# Serialization functions (_row_get, _parse_json_field, _serialize_reminder_row,
# _serialize_habit_record, _normalize_plan_items, _normalize_habit_items, 
# _normalize_proactivity, _datetime_to_ms, _parse_iso_timestamp, _serialize_proactivity_notification,
# _serialize_context_cache) are now imported from core.serializers

ALLOWED_ORIGIN_REGEX = _local_network_origin_regex()

ALLOWED_ORIGINS = _build_allowed_origins()

if IS_PRODUCTION and not ALLOWED_ORIGINS and not ALLOWED_ORIGIN_REGEX:
    app_logger.error(
        "CORS misconfigured for production: no allowed origins found; set SITE_URL/NEXT_PUBLIC_SITE_URL or CORS_ALLOW_ORIGINS."
    )
    raise RuntimeError("CORS configuration missing in production")


MAX_DASHBOARD_PULSE_HISTORY = 30
DEFAULT_DASHBOARD_PROACTIVITY = {
    "id": "proactivity-default",
    "label": "Check-ins",
    "description": "Daily sync nudges for squad channels.",
    "cadence": "Daily",
    "time": "09:00 AM",
}

# Database tables
# users table imported from backend.database

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





plans = sqlalchemy.Table(
    "plans",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("completed", sqlalchemy.Boolean, default=False),
    sqlalchemy.Column("deadline", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("schedule_slot", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("color", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    extend_existing=True,
)

habits = sqlalchemy.Table(
    "habits",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("label", sqlalchemy.String),
    sqlalchemy.Column("previous_label", sqlalchemy.String),
    sqlalchemy.Column("description", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    extend_existing=True,
)




# Proactivity tracking







# Context caching for long context reuse


DEFAULT_WORKSPACE_BACKGROUNDS: List[Dict[str, Any]] = []

# Proactive notifications




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

# Supabase setup (Auth only - conversation store is now strictly local SQLite/Postgres)
SUPABASE_URL, SUPABASE_KEY, SUPABASE_KEY_SOURCE = resolve_supabase_credentials()

# Initialize Supabase using unified helper (Auth only)
supabase: Optional[Client] = None
supabase_admin: Optional[Client] = None
SUPABASE_ADMIN_KEY_SOURCE: Optional[str] = None
if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL != "your_supabase_url_here":
    supabase = create_supabase_client()
    supabase_admin, SUPABASE_ADMIN_KEY_SOURCE = create_supabase_service_client()

# Note: Conversation store is now strictly local (SQLite/Postgres).
# We no longer configure the conversation store with Supabase clients for data.


_USER_DATA_CACHE: Dict[int, int] = {}


# _conversation_store_available, _handle_conversation_store_error, _general_conversation_user_id
# are now imported directly from core.conversation_store


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
    try:
        from backend.database import user_chat_threads, database
    except ImportError:
        from database import user_chat_threads, database

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
        except Exception:
            # If local lookup fails, fall through to Supabase check / lenient path.
            pass
    else:
        # Non-UUID IDs are treated as local-only; require the current user context.
        require_same_user(current_user["id"], current_user)
        return

    # Fallback: check Supabase ownership only if the conversation store is enabled.
    if not _conversation_store_available():
        return
        
    # NOTE: Functionality to check Supabase for ownership has been removed as we are strictly local-only now.
    return


# General conversation functions (_load_general_conversation_history,
# _insert_general_conversation_message, _replace_general_conversation_history,
# _ensure_user_data_record) are now imported from core.general_conversation

# Utility functions imported from core modules


async def _should_enable_reminder_tools_semantic(message: str) -> bool:
    """
    Use a lightweight model to semantically classify whether a message is asking
    for a concrete reminder / plan / habit / timer / alarm that should be stored
    and scheduled, rather than relying only on surface keywords.
    """
    trimmed = (message or "").strip()
    if not trimmed:
        return False

    system_prompt = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "intent_classification",
        "Reply with exactly one word: REMINDERS or NONE."
    )

    text = ""

    # Use OpenRouter with lite model for semantic classification
    if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
        try:
            text = await OPENROUTER_SERVICE.generate(
                trimmed,
                conversation_history=None,
                workspace_context=None,
                system_prompt=system_prompt,
                time_context=None,
                model=OPENROUTER_LITE_MODEL,
                include_usage=False,
                response_format=None,
                tools=None,
                tool_choice=None,
            )
        except Exception as error:  # pragma: no cover - best effort logging
            api_logger.warning(
                "Semantic reminder classifier (OpenRouter lite) failed; falling back to keyword heuristics",
                extra={"event_type": "reminder_classifier_error", "error": str(error), "provider": "openrouter"},
            )
            text = ""

    normalized = (text or "").strip().upper()
    if not normalized:
        return False
    first_token = normalized.split()[0]
    return first_token == "REMINDERS"


# _ensure_datetime_value is now imported from core.env_helpers


async def _maybe_enrich_actions_with_reminder_time(
    actions: List[Dict[str, Any]],
    message: str,
    time_context: str,
) -> None:
    """
    Best-effort enrichment for reminder actions when the model only provides
    relative timing (e.g. "in 30 minutes").

    Mutates the ``actions`` list in-place, setting ``time_iso`` and ``description``
    when they are missing.
    """
    # Derive a "now" anchor from the provided time_context, falling back to UTC now.
    base_time: datetime
    match = re.search(r"ISO timestamp:\s*([0-9T:\.\-:+Z]+)", time_context or "")
    if match:
        base_time = _ensure_datetime_value(match.group(1)) or utcnow()
    else:
        base_time = utcnow()

    normalized_message = (message or "").lower()
    relative_match = re.search(
        r"\bin\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b",
        normalized_message,
    )

    delta: Optional[timedelta] = None
    if relative_match:
        amount = int(relative_match.group(1))
        unit = relative_match.group(2)
        if unit.startswith("hour") or unit.startswith("hr"):
            delta = timedelta(hours=amount)
        else:
            delta = timedelta(minutes=amount)

    if not delta:
        # If we cannot confidently parse a relative offset, leave actions unchanged.
        return

    target_time = base_time + delta
    iso_value = target_time.replace(tzinfo=timezone.utc).isoformat()

    for action in actions:
        # Only fill in missing times; do not overwrite explicit model outputs.
        if not action.get("time_iso"):
            action["time_iso"] = iso_value
        if not action.get("description"):
            action["description"] = message.strip() or action.get("label") or "Reminder"


async def _create_reminders_from_actions(
    db: databases.Database,
    user_id: int,
    actions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Persist reminder-style actions into the local database.

    For each action:
      - Create a plan row (if one does not already exist).
      - Create a corresponding reminder row, or reschedule the latest one
        that matches the same label/entity for this user.

    Returns a list of operation payloads shaped as:
      { "operation": "created" | "rescheduled", "reminder": { ...row... } }
    """
    global reminder_scheduler
    results: List[Dict[str, Any]] = []
    now = utcnow()

    for action in actions:
        label = (action.get("label") or "Reminder").strip()
        entity = (action.get("entity") or "plan").strip().lower()
        time_iso = action.get("time_iso")
        remind_at = _ensure_datetime_value(time_iso)
        if remind_at is None:
            # If no time is available, skip this action rather than creating a broken reminder.
            continue

        description = action.get("description")
        schedule_slot = action.get("schedule_slot")

        # Find the most recent existing reminder for this user/label/entity.
        existing_reminder = await db.fetch_one(
            reminders.select()
            .where(
                (reminders.c.user_id == user_id)
                & (reminders.c.label == label)
                & (reminders.c.entity_type == entity)
            )
            .order_by(reminders.c.created_at.desc(), reminders.c.id.desc())
        )

        if existing_reminder:
            # `databases` returns a Record, which supports dict-style access but
            # not `.get()`. Normalize once for safe optional lookups.
            existing_record = dict(existing_reminder)
            reminder_id = existing_record["id"]
            plan_id = existing_record.get("entity_id")

            # Ensure there is an associated plan row so the dashboard can reflect the reminder.
            if plan_id is None:
                plan_id = await db.execute(
                    plans.insert().values(
                        user_id=user_id,
                        label=label,
                        completed=False,
                        deadline=time_iso,
                        schedule_slot=schedule_slot,
                        description=description,
                        created_at=now,
                        updated_at=now,
                    )
                )

            # Reschedule existing reminder and update its linkage to the plan.
            await db.execute(
                reminders.update()
                .where(
                    (reminders.c.id == reminder_id)
                    & (reminders.c.user_id == user_id)
                )
                .values(
                    remind_at=remind_at,
                    description=description,
                    entity_type=entity,
                    entity_id=plan_id,
                    updated_at=now,
                )
            )

            # Keep the plan's deadline aligned with the new reminder time.
            await db.execute(
                plans.update()
                .where(
                    (plans.c.id == plan_id)
                    & (plans.c.user_id == user_id)
                )
                .values(
                    deadline=time_iso,
                    updated_at=now,
                )
            )

            row = await db.fetch_one(
                reminders.select().where(reminders.c.id == reminder_id)
            )
            try:
                if reminder_scheduler is not None:
                    await reminder_scheduler.refresh_job(
                        user_id=user_id,
                        reminder_id=int(reminder_id),
                        remind_at=remind_at,
                    )
            except Exception as exc:  # pragma: no cover
                api_logger.warning(
                    "Failed to reschedule reminder job",
                    extra={
                        "event_type": "reminder_schedule_failed",
                        "user_id": user_id,
                        "reminder_id": reminder_id,
                        "error": str(exc),
                    },
                )
            results.append(
                {
                    "operation": "rescheduled",
                    "reminder": _serialize_reminder_row(row) if row is not None else None,
                }
            )
        else:
            # Create a new plan row for this reminder.
            plan_id = await db.execute(
                plans.insert().values(
                    user_id=user_id,
                    label=label,
                    completed=False,
                    deadline=time_iso,
                    schedule_slot=schedule_slot,
                    description=description,
                    created_at=now,
                    updated_at=now,
                )
            )

            # Create the corresponding reminder row.
            reminder_id = await db.execute(
                reminders.insert().values(
                    user_id=user_id,
                    entity_type=entity,
                    entity_id=plan_id,
                    delivery_mode="plan",
                    label=label,
                    description=description,
                    summary=description,
                    remind_at=remind_at,
                    status="pending",
                    metadata=None,
                    created_at=now,
                    updated_at=now,
                    delivered_at=None,
                )
            )
            row = await db.fetch_one(
                reminders.select().where(reminders.c.id == reminder_id)
            )
            try:
                if reminder_scheduler is not None:
                    await reminder_scheduler.refresh_job(
                        user_id=user_id,
                        reminder_id=int(reminder_id),
                        remind_at=remind_at,
                    )
            except Exception as exc:  # pragma: no cover
                api_logger.warning(
                    "Failed to schedule reminder job",
                    extra={
                        "event_type": "reminder_schedule_failed",
                        "user_id": user_id,
                        "reminder_id": reminder_id,
                        "error": str(exc),
                    },
                )
            results.append(
                {
                    "operation": "created",
                    "reminder": _serialize_reminder_row(row) if row is not None else None,
                }
            )

    return results


# _is_valid_uuid is now imported from core.env_helpers



# FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Centralized startup/shutdown without deprecated on_event hooks."""
    await _connect_database()
    await _run_basic_migrations()
    await _ensure_paddle_columns()
    await _initialize_proactivity_engine()
    await _validate_gemini_api_key_on_startup()
    try:
        yield
    finally:
        await _disconnect_database()

async def _ensure_paddle_columns():
    """Ensure Paddle columns exist in SQLite."""
    try:
        # Check users table
        api_logger.info("Checking for Paddle columns...")
        query = "PRAGMA table_info(users)"
        columns = await database.fetch_all(query)
        col_names = [col["name"] for col in columns]

        if "paddle_customer_id" not in col_names:
            api_logger.info("Adding paddle_customer_id to users")
            await database.execute("ALTER TABLE users ADD COLUMN paddle_customer_id TEXT")
            await database.execute("CREATE INDEX ix_users_paddle_customer_id ON users (paddle_customer_id)")
        
        if "paddle_subscription_id" not in col_names:
            api_logger.info("Adding paddle_subscription_id to users")
            await database.execute("ALTER TABLE users ADD COLUMN paddle_subscription_id TEXT")
            await database.execute("CREATE INDEX ix_users_paddle_subscription_id ON users (paddle_subscription_id)")

        # Check transactions table
        query = "PRAGMA table_info(transactions)"
        columns = await database.fetch_all(query)
        col_names = [col["name"] for col in columns]
        
        if "paddle_transaction_id" not in col_names:
            api_logger.info("Adding paddle_transaction_id to transactions")
            await database.execute("ALTER TABLE transactions ADD COLUMN paddle_transaction_id TEXT")
            await database.execute("CREATE UNIQUE INDEX ix_transactions_paddle_transaction_id ON transactions (paddle_transaction_id)")

    except Exception as e:
        api_logger.error(f"Failed to ensure Paddle columns: {e}")



app = FastAPI(title="User Profile API with AI Chat", version="1.0.0", lifespan=lifespan)

# Mount media upload directory to serve files statically
# This allows access to uploaded images via /uploads/<filename>
if MEDIA_UPLOAD_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=MEDIA_UPLOAD_DIR), name="uploads")
app.include_router(paddle_router)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Strict-Transport-Security (HSTS) - Force HTTPS for 1 year
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # X-Frame-Options - Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # X-Content-Type-Options - Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # X-XSS-Protection - Enable browser XSS filter
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Referrer-Policy - Control referrer information
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions-Policy - Restrict browser features
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Content-Security-Policy (CSP) - Prevent XSS and injection attacks
    # Note: This is a restrictive policy. Adjust based on your frontend needs.
    csp_directives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://apis.google.com https://accounts.google.com",
        "frame-src 'self' https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
    ]
    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
    
    return response

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Structured error handlers
try:
    from error_handlers import register_error_handlers
    register_error_handlers(app)
except ImportError:
    pass  # Optional module

# Middleware
app.add_middleware(RequestLoggingMiddleware, logger=api_logger)

# Caching headers middleware
try:
    from caching_headers import caching_middleware
    @app.middleware("http")
    async def add_caching_headers(request, call_next):
        return await caching_middleware(request, call_next)
except ImportError:
    pass  # Optional module



# Mount API routers
try:
    from backend.api.chat import router as chat_router
except Exception:  # pragma: no cover
    from api.chat import router as chat_router  # type: ignore

app.include_router(chat_router)

# Health check endpoints
try:
    from backend.health_check import router as health_router
except ImportError:
    from health_check import router as health_router

app.include_router(health_router)

# Plans and Habits routes
try:
    from backend.api.plans import router as plans_router
except ImportError:
    from api.plans import router as plans_router  # type: ignore

app.include_router(plans_router)

# Calendar routes
try:
    from backend.api.calendars import router as calendars_router
except ImportError:
    from api.calendars import router as calendars_router  # type: ignore

app.include_router(calendars_router)

# Reminder routes
try:
    from backend.api.reminders import router as reminders_router
except ImportError:
    from api.reminders import router as reminders_router  # type: ignore

app.include_router(reminders_router)

# Dashboard routes
try:
    from backend.api.dashboard import router as dashboard_router
except ImportError:
    from api.dashboard import router as dashboard_router  # type: ignore

app.include_router(dashboard_router)

# Payment routes (Midtrans)
try:
    from backend.api.payments import router as payments_router
except ImportError:
    from api.payments import router as payments_router  # type: ignore

app.include_router(payments_router)

# Proactivity routes
try:
    from backend.api.proactivity import router as proactivity_router
except ImportError:
    from api.proactivity import router as proactivity_router  # type: ignore

app.include_router(proactivity_router)

# Initialize audit logger with database
try:
    from backend.audit_logger import init_audit_logger
except ImportError:
    from audit_logger import init_audit_logger

# Global proactivity services
proactivity_engine: Optional[ProactivityEngine] = None
proactivity_scheduler: Optional[ProactivitySchedulerManager] = None
proactivity_realtime_broker = ProactivityRealtimeBroker()
reminder_scheduler: Optional["ReminderSchedulerManager"] = None

try:
    from backend.reminder_scheduler import ReminderSchedulerManager
except Exception:  # pragma: no cover
    try:
        from reminder_scheduler import ReminderSchedulerManager  # type: ignore
    except Exception:  # pragma: no cover
        ReminderSchedulerManager = None  # type: ignore



async def _connect_database():
    """Connect to the database on startup."""
    try:
        await database.connect()
        # Enable WAL mode for SQLite to improve concurrency
        db_url_str = str(database.url)
        if "sqlite" in db_url_str:
            await database.fetch_val("PRAGMA journal_mode=WAL;")
            await database.execute("PRAGMA synchronous=NORMAL;")
        # Initialize audit logger with database
        init_audit_logger(database)
    except Exception as e:
        db_logger.error(f"Database connection failed: {e}", exc_info=True)
        raise



async def _run_basic_migrations():
    """Ensure critical SQLite columns exist."""
    _drop_sqlite_table("user_streaks")
    _rebuild_sqlite_table_without_columns("habits", {"streak_label", "streak_id"})
    _ensure_sqlite_index("habits", "ix_habits_user_id", "user_id")

    _ensure_sqlite_columns(
        "users",
        [
            ("visible_model_ids", "TEXT", "NULL"),
            ("personalization_location", "TEXT", "NULL"),
            ("personalization_time_zone", "TEXT", "NULL"),
            ("personalization_system_prompt_override", "TEXT", "NULL"),
            ("theme_mode", "TEXT", "NULL"),
            ("ui_locale", "TEXT", "NULL"),
            ("preferred_response_language", "TEXT", "NULL"),
            ("notification_preferences", "TEXT", "NULL"),
            ("conversation_memory_enabled", "BOOLEAN", "1"),
            ("auto_web_search_enabled", "BOOLEAN", "0"),
        ],
    )
    if DATABASE_URL.startswith("postgres"):
        try:
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS visible_model_ids JSONB"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_location TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_time_zone TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_system_prompt_override TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_mode TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_locale TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_response_language TEXT"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS conversation_memory_enabled BOOLEAN DEFAULT TRUE"
            )
            await database.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_web_search_enabled BOOLEAN DEFAULT FALSE"
            )
        except Exception as exc:  # pragma: no cover - best effort migration
            app_logger.warning(
                "Postgres migration failed",
                extra={"event_type": "postgres_migration_error", "table": "users", "error": str(exc)},
            )
    _ensure_sqlite_columns(
        "user_chat_messages",
        [
            # Older local DBs did not include reminders; missing columns break SELECT *.
            ("reminders", "TEXT", "NULL"),
        ],
    )
    _ensure_sqlite_columns(
        "general_chat_messages",
        [
            # Older local DBs did not include reminders; missing columns break SELECT *.
            ("reminders", "TEXT", "NULL"),
        ],
    )
    _ensure_sqlite_columns(
        "reminders",
        [
            ("label", "TEXT", "''"),
            ("remind_at", "TIMESTAMP", "CURRENT_TIMESTAMP"),
            ("status", "TEXT", "'pending'"),
            ("description", "TEXT", "NULL"),
            ("summary", "TEXT", "NULL"),
            ("entity_type", "TEXT", "NULL"),
            ("entity_id", "INTEGER", "NULL"),
            ("delivery_mode", "TEXT", "NULL"),
            ("metadata", "TEXT", "NULL"),
            ("delivered_at", "TIMESTAMP", "NULL"),
        ]
    )


async def _disconnect_database():
    """Disconnect from the database on shutdown."""
    try:
        if proactivity_scheduler:
            await proactivity_scheduler.shutdown(timeout=10.0)
            app_logger.info("Proactivity scheduler shut down", extra={
                "event_type": "proactivity_scheduler_shutdown"
            })
    except Exception as e:
        app_logger.warning(
            f"Proactivity scheduler shutdown failed: {e}",
            exc_info=True,
            extra={"event_type": "proactivity_scheduler_shutdown_failed", "error": str(e)},
        )

    try:
        global reminder_scheduler
        if reminder_scheduler is not None:
            await reminder_scheduler.shutdown(timeout=10.0)
            app_logger.info("Reminder scheduler shut down", extra={"event_type": "reminder_scheduler_shutdown"})
    except Exception as e:  # pragma: no cover
        app_logger.warning(
            f"Reminder scheduler shutdown failed: {e}",
            exc_info=True,
            extra={"event_type": "reminder_scheduler_shutdown_failed", "error": str(e)},
        )

    try:
        await wait_for(database.disconnect(), timeout=10.0)
        db_logger.info("Database connection closed via shutdown event", extra={
            "event_type": "database_disconnected_shutdown"
        })
    except TimeoutError:
        db_logger.warning(
            "Timed out disconnecting database; asyncpg pool may still be closing",
            extra={"event_type": "database_disconnection_timeout"},
        )
    except Exception as e:
        db_logger.error(
            f"Database disconnection failed on shutdown: {e}",
            exc_info=True,
            extra={
                "event_type": "database_disconnection_failed_shutdown",
                "error": str(e),
            },
        )

async def _initialize_proactivity_engine():
    """Initialize the hybrid proactivity engine + scheduler."""
    global proactivity_engine, proactivity_scheduler, reminder_scheduler

    try:
        proactivity_engine = ProactivityEngine(
            database,
            proactivity_realtime_broker,
            AI_MESSAGE_GENERATOR,
        )
        proactivity_scheduler = ProactivitySchedulerManager(proactivity_engine)
        await proactivity_scheduler.start()

        if ReminderSchedulerManager is not None:
            reminder_scheduler = ReminderSchedulerManager(proactivity_engine, database)
            await reminder_scheduler.start()
    except Exception as e:
        app_logger.error(
            f"Failed to initialize proactivity engine: {e}",
            exc_info=True,
            extra={
                "event_type": "proactivity_engine_init_error",
                "error": str(e),
            },
        )


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


async def _validate_gemini_api_key_on_startup():
    # Skip validation if not using Gemini or validation disabled
    if AI_PROVIDER != "gemini" or not VALIDATE_GEMINI_ON_STARTUP:
        return

    if not GEMINI_SERVICE.available:
        app_logger.warning("Gemini validation skipped; no API key configured", extra={
            "event_type": "gemini_validation_skipped",
            "reason": "no_api_key"
        })
        return

    app_logger.debug("Validating Gemini API key...")

    try:
        await GEMINI_SERVICE.validate_connection()
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


def _is_localhost_request(request: Request) -> bool:
    """
    Best-effort helper for gating local-only endpoints.

    Security: In production, always return False. Loopback detection is unreliable
    behind reverse proxies (where the backend may see 127.0.0.1 for all traffic),
    and forwarded headers / Host are client-controlled unless explicitly validated.
    """
    if IS_PRODUCTION:
        return False

    def _parse_ip(value: str) -> Optional[ipaddress.IPv4Address | ipaddress.IPv6Address]:
        try:
            return ipaddress.ip_address(value)
        except ValueError:
            return None

    try:
        client_host = (request.client.host or "").lower() if request.client else ""
    except Exception:
        client_host = ""

    if client_host in {"127.0.0.1", "::1", "localhost"}:
        return True

    client_ip = _parse_ip(client_host)
    return bool(client_ip and client_ip.is_loopback)


@app.get("/dev/analytics/summary")
async def dev_analytics_summary(
    request: Request,
    db: databases.Database = Depends(get_database),
):
    token = (os.getenv("DEV_ANALYTICS_TOKEN") or "").strip()
    provided = (request.headers.get("x-dev-analytics-token") or "").strip()
    token_ok = bool(token) and hmac.compare_digest(token, provided)

    is_localhost = _is_localhost_request(request)
    if IS_PRODUCTION and not is_localhost and not token_ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not is_localhost and not token_ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    try:
        from backend.database import user_chat_threads, user_chat_messages, transactions  # type: ignore
    except Exception:
        from database import user_chat_threads, user_chat_messages, transactions  # type: ignore

    tables: Dict[str, sqlalchemy.Table] = {
        "users": users,
        "user_data": user_data,
        "user_chat_threads": user_chat_threads,
        "user_chat_messages": user_chat_messages,
        "general_chat_messages": general_chat_messages,
        "reminders": reminders,
        "plans": plans,
        "habits": habits,
        "calendars": calendars,
        "calendar_events": calendar_events,
        "dashboard_pulses": dashboard_pulses,
        "transactions": transactions,
        "proactivity_settings": proactivity_settings,
        "proactivity_logs": proactivity_logs,
        "proactivity_push_subscriptions": proactivity_push_subscriptions,
        "proactive_notifications": proactive_notifications,
        "context_cache": context_cache,
        "media_uploads": media_uploads,
        "google_calendar_credentials": google_calendar_credentials,
    }

    counts: Dict[str, Optional[int]] = {}
    for name, table in tables.items():
        try:
            counts[name] = int(
                await db.fetch_val(sqlalchemy.select(sqlalchemy.func.count()).select_from(table))  # type: ignore[arg-type]
            )
        except Exception:
            counts[name] = None

    sqlite_path: Optional[str] = None
    sqlite_size_bytes: Optional[int] = None
    if isinstance(DATABASE_URL, str) and DATABASE_URL.startswith("sqlite:///"):
        sqlite_path = DATABASE_URL.replace("sqlite:///", "", 1)
        try:
            sqlite_size_bytes = os.path.getsize(sqlite_path)
        except OSError:
            sqlite_size_bytes = None

    # ========== USER GROWTH METRICS ==========
    user_growth: Dict[str, Any] = {}
    try:
        total_users = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
        )
        user_growth["total_users"] = int(total_users) if total_users else 0
    except Exception:
        user_growth["total_users"] = 0

    # Plan tier distribution
    try:
        plan_distribution: Dict[str, int] = {"scout": 0, "voyager": 0, "pioneer": 0, "none": 0}
        rows = await db.fetch_all(
            sqlalchemy.select(users.c.plan_tier, sqlalchemy.func.count().label("cnt"))
            .group_by(users.c.plan_tier)
        )
        for row in rows:
            tier = (row["plan_tier"] or "").lower().strip()
            if tier in plan_distribution:
                plan_distribution[tier] = int(row["cnt"])
            else:
                plan_distribution["none"] += int(row["cnt"])
        user_growth["plan_distribution"] = plan_distribution
    except Exception:
        user_growth["plan_distribution"] = {"scout": 0, "voyager": 0, "pioneer": 0, "none": 0}

    # New signups in last 7 days and 30 days
    try:
        now = utcnow_aware()
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        
        new_7d = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
            .where(users.c.created_at >= seven_days_ago)
        )
        new_30d = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
            .where(users.c.created_at >= thirty_days_ago)
        )
        user_growth["new_7d"] = int(new_7d) if new_7d else 0
        user_growth["new_30d"] = int(new_30d) if new_30d else 0
    except Exception:
        user_growth["new_7d"] = 0
        user_growth["new_30d"] = 0

    # ========== ENGAGEMENT METRICS ==========
    engagement: Dict[str, Any] = {}
    try:
        now = utcnow_aware()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)

        # DAU from general_chat_messages
        dau_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(general_chat_messages.c.created_at >= today_start)
        )
        # DAU from user_chat_messages (thread-based)
        dau_threads = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(user_chat_threads.c.user_identifier)))
            .select_from(
                user_chat_messages.join(user_chat_threads, user_chat_messages.c.thread_id == user_chat_threads.c.id)
            )
            .where(user_chat_messages.c.created_at >= today_start)
        )
        engagement["dau"] = max(int(dau_general or 0), int(dau_threads or 0))

        # WAU
        wau_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(general_chat_messages.c.created_at >= week_start)
        )
        engagement["wau"] = int(wau_general or 0)

        # MAU
        mau_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(general_chat_messages.c.created_at >= month_start)
        )
        engagement["mau"] = int(mau_general or 0)

        # Total messages
        total_general = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(general_chat_messages)
        )
        total_threads = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(user_chat_messages)
        )
        engagement["total_general_messages"] = int(total_general or 0)
        engagement["total_thread_messages"] = int(total_threads or 0)

        # Average messages per user
        active_users = engagement["mau"] if engagement["mau"] > 0 else 1
        engagement["avg_messages_per_user"] = round(
            (engagement["total_general_messages"] + engagement["total_thread_messages"]) / active_users, 1
        )
    except Exception:
        engagement = {
            "dau": 0, "wau": 0, "mau": 0,
            "total_general_messages": 0, "total_thread_messages": 0,
            "avg_messages_per_user": 0.0
        }

    # ========== FEATURE ADOPTION METRICS ==========
    feature_adoption: Dict[str, Any] = {}
    try:
        # Users with plans
        users_with_plans = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(plans.c.user_id)))
        )
        feature_adoption["users_with_plans"] = int(users_with_plans or 0)

        # Users with habits
        users_with_habits = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(habits.c.user_id)))
        )
        feature_adoption["users_with_habits"] = int(users_with_habits or 0)

        # Active reminders (pending status)
        active_reminders = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(reminders)
            .where(reminders.c.status == "pending")
        )
        feature_adoption["active_reminders"] = int(active_reminders or 0)

        # Calendar events
        calendar_event_count = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(calendar_events)
        )
        feature_adoption["calendar_events"] = int(calendar_event_count or 0)

        # Push subscriptions
        push_subs = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count()).select_from(proactivity_push_subscriptions)
        )
        feature_adoption["push_subscriptions"] = int(push_subs or 0)
    except Exception:
        feature_adoption = {
            "users_with_plans": 0, "users_with_habits": 0,
            "active_reminders": 0, "calendar_events": 0, "push_subscriptions": 0
        }

    # ========== RETENTION METRICS ==========
    retention: Dict[str, Any] = {}
    try:
        today_str = utcnow_aware().strftime("%Y-%m-%d")
        active_today = await db.fetch_val(
            sqlalchemy.select(sqlalchemy.func.count(sqlalchemy.distinct(general_chat_messages.c.user_id)))
            .where(sqlalchemy.func.date(general_chat_messages.c.created_at) == today_str)
        )
        retention["active_today"] = int(active_today or 0)
    except Exception:
        retention = {"active_today": 0}

    # ========== REVENUE METRICS ==========
    revenue: Dict[str, Any] = {}
    try:
        # Transactions by status
        by_status: Dict[str, int] = {}
        status_rows = await db.fetch_all(
            sqlalchemy.select(transactions.c.status, sqlalchemy.func.count().label("cnt"))
            .group_by(transactions.c.status)
        )
        for row in status_rows:
            by_status[row["status"] or "unknown"] = int(row["cnt"])
        revenue["by_status"] = by_status

        # Revenue by plan (settlement only)
        by_plan: Dict[str, float] = {}
        plan_rows = await db.fetch_all(
            sqlalchemy.select(transactions.c.plan_tier, sqlalchemy.func.sum(transactions.c.amount).label("total"))
            .where(transactions.c.status == "settlement")
            .group_by(transactions.c.plan_tier)
        )
        for row in plan_rows:
            by_plan[row["plan_tier"] or "unknown"] = float(row["total"] or 0)
        revenue["by_plan"] = by_plan

        # Conversion rate
        total_transactions = sum(by_status.values())
        settled = by_status.get("settlement", 0)
        revenue["conversion_rate"] = round(settled / total_transactions, 3) if total_transactions > 0 else 0.0
    except Exception:
        revenue = {"by_status": {}, "by_plan": {}, "conversion_rate": 0.0}

    return {
        "generated_at": utcnow_aware().isoformat(),
        "database_url": DATABASE_URL,
        "sqlite_path": sqlite_path,
        "sqlite_size_bytes": sqlite_size_bytes,
        "counts": counts,
        "user_growth": user_growth,
        "engagement": engagement,
        "feature_adoption": feature_adoption,
        "retention": retention,
        "revenue": revenue,
    }

# Helper functions


# _timestamp_ms_to_datetime, _datetime_to_ms are now imported from core.env_helpers


# Serialization, AI utils, and web search detection functions are now imported from core modules

# _gemini_web_search_summary removed (dead code - never called)


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

    retrieval_config = None
    if maps_latitude is not None and maps_longitude is not None:
        retrieval_config = types.RetrievalConfig(
            lat_lng=types.LatLng(latitude=maps_latitude, longitude=maps_longitude)
        )

    tool_config = types.ToolConfig(
        retrieval_config=retrieval_config,
        function_calling_config=types.FunctionCallingConfig(
            mode=types.FunctionCallingConfigMode.NONE
        ),
    )

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




# _generate_chat_title_inline is now imported from core.title_generator

# Helper functions extracted to core modules: _merge_extra_contents (ai_utils), normalize_conversation_history (chat_history)


async def _load_conversation_history(conversation_id: str, user_id: int) -> List[Dict[str, Any]]:
  """Load a conversation's messages.

  General-chat IDs are handled via the local general_chat_messages store;
  thread conversations delegate to the shared chat_history module.
  """
  general_user_id = _general_conversation_user_id(conversation_id)
  if general_user_id is not None:
    # Enforce ownership for general chat
    if general_user_id != user_id:
        app_logger.warning(
            f"Access denied for general chat: user {user_id} tried to access {conversation_id}",
            extra={"event_type": "security_violation_general_chat"}
        )
        return []
    return await _load_general_conversation_history(general_user_id)

  # Thread conversations handled by shared chat_history module.
  return await load_thread_history(conversation_id, user_id)


async def _fetch_proactivity_summary(user_id: int, info_type: Optional[str], db: databases.Database) -> Dict[str, Any]:
    """
    Build a lightweight proactivity summary based only on the current plans and habits
    stored for this user, not on any local dashboard snapshots.

    This avoids leaking or double-counting historical/local data and keeps the
    assistant's view aligned with the canonical per-user records.
    """
    plan_labels: List[str] = []
    # Supabase data loading for proactivity summary removed.
    # Relying on local data fallbacks below.

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


# Calendar event handlers (_list_calendar_events, _create_calendar_event,
# _update_calendar_event, _delete_calendar_event) are now imported from core.tool_handlers

# _complete_onboarding is now imported from core.onboarding_handler


async def _execute_function_call(
    function_call: types.FunctionCall,
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
) -> Dict[str, Any]:
    handler = {
        "fetch_proactivity_summary": lambda u, a, d: _fetch_proactivity_summary(u, a.get("info_type"), d),
        "list_calendar_events": lambda u, a, d: _list_calendar_events(u, a, d),
        "create_calendar_event": lambda u, a, d: _create_calendar_event(u, a, d),
        "update_calendar_event": lambda u, a, d: _update_calendar_event(u, a, d),
        "delete_calendar_event": lambda u, a, d: _delete_calendar_event(u, a, d),
        "complete_onboarding": lambda u, a, d: _complete_onboarding(u, a, d, user_timezone=user_timezone, proactivity_scheduler=proactivity_scheduler),
        "list_plans": lambda u, a, d: _list_plans_tool(u, a, d),
        "create_plan": lambda u, a, d: _create_plan_tool(u, a, d),
        "update_plan": lambda u, a, d: _update_plan_tool(u, a, d),
        "delete_plan": lambda u, a, d: _delete_plan_tool(u, a, d),
        "list_habits": lambda u, a, d: _list_habits_tool(u, a, d),
        "create_habit": lambda u, a, d: _create_habit_tool(u, a, d),
        "update_habit": lambda u, a, d: _update_habit_tool(u, a, d),
        "delete_habit": lambda u, a, d: _delete_habit_tool(u, a, d),
        "list_reminders": lambda u, a, d: _list_reminders_tool(u, a, d),
        "create_reminder": lambda u, a, d: _create_reminder_tool(u, a, d),
        "update_reminder": lambda u, a, d: _update_reminder_tool(u, a, d),
        "delete_reminder": lambda u, a, d: _delete_reminder_tool(u, a, d),
        "delete_latest_reminder": lambda u, a, d: _delete_latest_reminder_tool(u, a, d),
        "get_workspace_state": lambda u, a, d: _get_workspace_state_tool(u, a, d),
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


async def _fetch_url_context_with_gemini(
    message: str,
    urls: List[str],
    workspace_context: Optional[str] = None,
    time_context: Optional[str] = None,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Fetch URL content using Gemini with URL Context tool.
    
    This is used for the hybrid architecture: Gemini fetches URL content,
    which is then passed to any model (OpenRouter, Gemini Pro, etc.) as context.
    
    Args:
        message: The user's original message
        urls: List of URLs extracted from the message
        workspace_context: Optional workspace context
        time_context: Optional time context
        
    Returns:
        Tuple of (url_content_summary, url_context_metadata)
    """
    if not GEMINI_SERVICE or not GEMINI_SERVICE.available:
        return "", None
    
    if not urls:
        return "", None
    
    # Build a prompt that asks Gemini to fetch and summarize the URL content
    url_list = "\n".join(f"- {url}" for url in urls)
    system_prompt = (
        "You have access to the URL Context tool which can fetch content from URLs. "
        "Fetch the content from the provided URLs and provide a comprehensive summary "
        "of the relevant information. Include key facts, data, and context that would "
        "help answer the user's question."
    )
    
    context_prompt = f"The user is asking about content from these URLs:\n{url_list}\n\nUser message: {message}"
    
    try:
        api_logger.info(
            f"[URL Context] Fetching content from {len(urls)} URLs",
            extra={"event_type": "url_context_fetch_start", "url_count": len(urls)}
        )
        
        response = await GEMINI_SERVICE.generate(
            context_prompt,
            conversation_history=None,
            workspace_context=workspace_context,
            system_prompt=system_prompt,
            time_context=time_context,
            model=URL_CONTEXT_MODEL,
            attachments=None,
            extra_contents=None,
            response_schema=None,
            response_mime_type=None,
            tools=[URL_CONTEXT_TOOL],
            tool_config=None,
            reasoning_mode=False,
        )
        
        if not response.candidates:
            api_logger.warning(
                "[URL Context] No candidates in response",
                extra={"event_type": "url_context_no_candidates"}
            )
            return "", None
        
        candidate = response.candidates[0]
        url_content = _candidate_text(candidate)
        
        # Extract URL context metadata if available
        url_metadata: Optional[Dict[str, Any]] = None
        if hasattr(candidate, 'url_context_metadata') and candidate.url_context_metadata:
            url_metadata = {
                "url_metadata": [
                    {
                        "retrieved_url": m.retrieved_url,
                        "url_retrieval_status": str(m.url_retrieval_status) if m.url_retrieval_status else None
                    }
                    for m in (candidate.url_context_metadata.url_metadata or [])
                ]
            }
        
        api_logger.info(
            f"[URL Context] Successfully fetched content ({len(url_content)} chars)",
            extra={
                "event_type": "url_context_fetch_success",
                "content_len": len(url_content),
                "url_count": len(urls)
            }
        )
        
        return url_content.strip(), url_metadata
        
    except Exception as error:
        api_logger.warning(
            f"[URL Context] Failed to fetch URL content: {error}",
            extra={"event_type": "url_context_fetch_error", "error": str(error)},
        )
        return "", None

async def _execute_tools_with_gemini_flash(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]],
    tool_list: List[types.Tool],
    system_prompt: Optional[str],
    time_context: Optional[str],
    workspace_context: Optional[str],
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
    history_token_budget: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], bool]:
    """Execute tools using Gemini Flash for speed, return results for hybrid flow.
    
    This is used when OpenRouter is the response model but we want fast tool execution.
    Gemini Flash handles the tool calling, then results are passed to OpenRouter for
    the final personality-rich response.
    
    Returns:
        tool_results: List of {tool_name, result, args} for each executed tool
        tool_cards: List of reminder/plan/habit cards to emit to frontend
        onboarding_completed: True if complete_onboarding was called
    """
    if not GEMINI_SERVICE.available:
        return [], [], False
    
    GEMINI_FLASH_MODEL = "models/gemini-2.0-flash"
    tool_results: List[Dict[str, Any]] = []
    tool_cards: List[Dict[str, Any]] = []
    onboarding_completed = False
    
    try:
        # Initial generation with tools
        response = await GEMINI_SERVICE.generate(
            message,
            conversation_history,
            workspace_context,
            system_prompt,
            time_context,
            GEMINI_FLASH_MODEL,
            tools=tool_list,
            history_token_budget=history_token_budget,
        )
        
        # Loop to handle tool execution (max 3 iterations)
        extra_contents: Optional[List[types.Content]] = None
        for attempt in range(3):
            function_call = _extract_function_call(response)
            if not function_call:
                break
            
            tool_name = function_call.name
            tool_args = function_call.args or {}
            
            api_logger.info(
                f"[Hybrid] Gemini Flash executing tool: {tool_name}",
                extra={"user_id": user_id, "tool": tool_name}
            )
            
            try:
                tool_result = await _execute_function_call(
                    function_call, user_id, db, user_timezone=user_timezone
                )
                tool_results.append({
                    "tool_name": tool_name,
                    "args": dict(tool_args),
                    "result": tool_result,
                })
                
                # Collect reminder/plan/habit cards for frontend
                if isinstance(tool_result, dict) and tool_result.get("type") in {
                    "gray.reminder", "gray.plan", "gray.habit"
                }:
                    tool_cards.append(tool_result)
                
                # Check if onboarding was completed (partial saves should not disable onboarding)
                if tool_name == "complete_onboarding" and isinstance(tool_result, dict):
                    onboarding_completed = onboarding_completed or tool_result.get("status") == "success"
                
                # Build contents for next iteration
                tool_contents = _build_function_call_contents(function_call, tool_result)
                if extra_contents:
                    extra_contents.extend(tool_contents)
                else:
                    extra_contents = tool_contents
                
                # Generate again to see if more tools are needed
                response = await GEMINI_SERVICE.generate(
                    message,
                    conversation_history,
                    workspace_context,
                    system_prompt,
                    time_context,
                    GEMINI_FLASH_MODEL,
                    extra_contents=extra_contents,
                    tools=tool_list,
                    history_token_budget=history_token_budget,
                )
                
            except Exception as tool_error:
                api_logger.error(
                    f"[Hybrid] Tool execution failed: {tool_name}: {tool_error}",
                    exc_info=True
                )
                tool_results.append({
                    "tool_name": tool_name,
                    "args": dict(tool_args),
                    "error": str(tool_error),
                })
                break
    
    except Exception as gemini_error:
        api_logger.error(
            f"[Hybrid] Gemini Flash tool execution failed: {gemini_error}",
            exc_info=True,
            extra={"user_id": user_id}
        )
    
    return tool_results, tool_cards, onboarding_completed


def _format_tool_results_for_context(tool_results: List[Dict[str, Any]]) -> str:
    """Format tool execution results as context for the response model."""
    if not tool_results:
        return ""
    
    parts = ["[Tool execution results - use these to inform your response:]"]
    for tr in tool_results:
        tool_name = tr.get("tool_name", "unknown")
        if "error" in tr:
            parts.append(f"- {tool_name}: Error - {tr['error']}")
        else:
            result = tr.get("result", {})
            # Summarize the result based on type
            if isinstance(result, dict):
                result_type = result.get("type", "")
                if result_type == "gray.reminder":
                    parts.append(f"- {tool_name}: Created reminder '{result.get('label', '')}' for {result.get('remind_at', 'unknown time')}")
                elif result_type == "gray.plan":
                    parts.append(f"- {tool_name}: Created plan '{result.get('label', '')}'")
                elif result_type == "gray.habit":
                    parts.append(f"- {tool_name}: Created habit '{result.get('label', '')}'")
                elif result.get("status") == "success":
                    parts.append(f"- {tool_name}: Success")
                else:
                    # Generic result summary
                    parts.append(f"- {tool_name}: Completed successfully")
            else:
                parts.append(f"- {tool_name}: {str(result)[:100]}")
    
    return "\n".join(parts)

# _resolve_media_attachments and _generate_image_descriptions
# are now imported from core.media_attachments

# Dashboard helpers extracted to core.dashboard_helpers


# API Routes

@app.get("/")
async def root():
    return {"message": "User Profile API with AI Chat"}


@app.get("/admin/metrics")
async def get_admin_metrics(
    request: Request,
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Lightweight metrics for local admin use."""
    is_localhost = _is_localhost_request(request)

    # In production, localhost bypass is disabled (see _is_localhost_request).
    if current_user:
        require_admin(current_user)
    elif not is_localhost:
        raise HTTPException(status_code=401, detail="Authentication required")
    now = utcnow()
    start_of_today = datetime.combine(now.date(), datetime.min.time())

    total_users = await db.fetch_val(
        sqlalchemy.select(sqlalchemy.func.count()).select_from(users)
    )
    messages_today = await db.fetch_val(
        sqlalchemy.select(sqlalchemy.func.count())
        .select_from(general_chat_messages)
        .where(general_chat_messages.c.created_at >= start_of_today)
    )

    error_stats = _count_error_entries(since=start_of_today)
    latency_stats = _collect_latency_stats(since=now - timedelta(days=1))

    return {
        "generated_at": now.replace(tzinfo=timezone.utc).isoformat(),
        "totals": {"users": int(total_users or 0)},
        "messages": {"today": int(messages_today or 0)},
        "errors": error_stats,
        "latency": latency_stats,
        "manual_checks": {
            "stability_mobile_keyboard": "Confirm the mobile keyboard does not cover the chat input.",
            "onboarding_speed": "Verify signup finishes in under 60 seconds.",
        },
    }

# AI Chat helper functions
async def get_or_create_conversation(
  conversation_id: Optional[str],
  user_id: int,
  *,
  title: Optional[str] = None,
) -> str:
  """Get existing conversation or create a new one in Supabase."""
  # Import here to avoid circular dependency
  try:
      from backend.database import user_chat_threads, database
  except ImportError:
      from database import user_chat_threads, database

  valid_id = conversation_id if _is_valid_uuid(conversation_id) else None
  if valid_id:
    cached_owner = CONVERSATION_OWNER_CACHE.get(valid_id)
    if cached_owner == user_id:
      return valid_id
    try:
      # Check if conversation exists and belongs to this user
      query = user_chat_threads.select().where(
          (user_chat_threads.c.id == valid_id) & 
          (user_chat_threads.c.user_identifier == user_id)
      )
      row = await database.fetch_one(query)
      if row:
        CONVERSATION_OWNER_CACHE.set(valid_id, user_id)
        return valid_id
    except Exception as error:
      _handle_conversation_store_error("Error checking conversation", error)
      # Fallback or re-raise depending on strictness; here we re-raise to match original behavior
      raise HTTPException(status_code=503, detail="Conversation storage is not available.")

  user_data_id: Optional[int] = None
  try:
    user_data_id = await _ensure_user_data_record(user_id)
    if user_data_id is None:
      raise HTTPException(status_code=503, detail="User metadata storage is not available.")
    
    # Create new conversation
    import uuid
    new_id = str(uuid.uuid4())
    now = utcnow()
    insert_query = user_chat_threads.insert().values(
        id=new_id,
        title=title or "New Conversation",
        user_identifier=user_id,
        user_data_id=user_data_id,
        context_snapshot=[],
        metadata={},
        created_at=now,
        updated_at=now,
        last_message_at=now,
    )
    await database.execute(insert_query)
    CONVERSATION_OWNER_CACHE.set(new_id, user_id)
    return new_id

  except Exception as error:
    _handle_conversation_store_error("Error creating conversation", error)
    raise HTTPException(status_code=503, detail="Conversation storage is not available.")

  raise HTTPException(status_code=500, detail="Failed to create conversation.")


async def save_conversation_message(
  conversation_id: str,
  message: Dict[str, Any],
  *,
  user_id: Optional[int] = None,
) -> Optional[int]:
  """Persist a single message for a conversation."""
  # Import here to avoid circular dependency
  try:
      from backend.database import user_chat_messages, user_chat_threads, database
  except ImportError:
      from database import user_chat_messages, user_chat_threads, database

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
      return await _insert_general_conversation_message(
          user_id=general_user_id,
          role=role,
          text=text,
          grounding_metadata=grounding_metadata,
          attachments=message.get("attachments"),
      )

  # Regular thread message
  try:
      # Insert message
      insert_query = user_chat_messages.insert().values(
          thread_id=conversation_id,
          role=role,
          text=text,
          grounding_metadata=grounding_metadata,
          attachments=message.get("attachments"),
          created_at=utcnow(),
      )
      message_id = await database.execute(insert_query)
      
      # Update thread timestamp
      update_query = (
          user_chat_threads.update()
          .where(user_chat_threads.c.id == conversation_id)
          .values(last_message_at=utcnow(), updated_at=utcnow())
      )
      await database.execute(update_query)
      append_to_conversation_cache(
          conversation_id,
          user_id,
          {
              "role": role,
              "text": text,
              "grounding_metadata": grounding_metadata,
              "attachments": message.get("attachments"),
          },
      )
      return message_id
      
  except Exception as error:
      _handle_conversation_store_error("Error saving message", error)
      # Non-critical, log and continue
      app_logger.error(f"Failed to save message to thread {conversation_id}: {error}")


# _format_structured_ai_reply removed (dead code - never called)

async def generate_chat_title_suggestion(message: str) -> Optional[str]:
    """Generate a concise chat title locally."""
    trimmed = (message or "").strip()
    if not trimmed:
        return None
    return _fallback_title_from_message(trimmed)


# _update_conversation_title wrapper removed - use update_conversation_title directly


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
    user_timezone: Optional[str] = None,
    context_cache_id: Optional[int] = None,
    maps_enabled: bool = False,
    maps_latitude: Optional[float] = None,
    maps_longitude: Optional[float] = None,
    maps_widget: bool = False,
    search_enabled: bool = True,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    reminders_enabled: bool = False,
    tools: Optional[List[types.Tool]] = None,
    plan_tier: Optional[str] = None,
    provider_routing: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Yield token chunks using the configured AI provider."""

    conversation_history = normalize_conversation_history(conversation_history)
    history_token_budget = tier_conversation_token_limit(plan_tier)

    # Determine whether this turn is part of a reminder/plan/habit flow.
    # Look at the current message plus a short window of recent history so
    # follow-ups like "12 pm" after "set a reminder" still route through tools.
    intent_window_text = (message or "") or ""
    if conversation_history:
        try:
            # Only look at the last few turns to avoid over-triggering.
            for entry in conversation_history[-4:]:
                text = entry.get("text") or ""
                if text:
                    intent_window_text += f"\n{text}"
        except Exception:
            # If history normalization fails, fall back to current message only.
            pass

    request_structured_reminders = _should_request_structured_reminders(intent_window_text)
    needs_structured_tools = reminders_enabled or request_structured_reminders or _needs_structured_tools(intent_window_text)

    # Semantic fallback: if the simple keyword heuristics do not trigger,
    # ask Gemini to classify whether this message is actually a reminder/plan/timer request.
    # DISABLED for performance: This adds ~2s latency. Relying on keyword heuristics only.
    # if not needs_structured_tools:
    #     try:
    #         if await _should_enable_reminder_tools_semantic(message):
    #             needs_structured_tools = True
    #             request_structured_reminders = True
    #     except Exception as error:  # pragma: no cover - best effort logging
    #         api_logger.warning(
    #             "Semantic reminder routing failed; continuing with keyword heuristics",
    #             extra={"event_type": "reminder_semantic_routing_error", "error": str(error)},
    #         )
    if needs_structured_tools:
        request_structured_reminders = True

    # Auto-enable search based on heuristic if not explicitly requested
    if not search_enabled and _should_enable_search(message):
        api_logger.info(f"Auto-enabling search for message: {message[:50]}...")
        search_enabled = True

    explicit_model = (model or "").strip()
    normalized_model = explicit_model.lower()
    explicit_model_is_tier_alias = normalized_model in {"lite", "gray-lite", "pro", "gray-pro"}
    explicit_model_provided = bool(explicit_model) and not explicit_model_is_tier_alias
    provider: Optional[str] = None

    # Respect explicit tier aliases first
    if normalized_model in {"lite", "gray-lite", "pro", "gray-pro"}:
        # Lite tier routing: use OpenRouter with Grok 4.1 Fast
        # We now route "Pro" requests here too, effectively removing the Pro tier logic.
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
            model = OPENROUTER_LITE_MODEL  # x-ai/grok-4.1-fast - always set for tier alias
        else:
            provider = "gemini"
            model = GEMINI_LIGHT_MODEL
    elif normalized_model == "pioneer":
        # Pioneer tier is a direct OpenRouter passthrough - model ID should be already set
        # If only "pioneer" was passed without a specific model, default to a premium model
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
            # Keep the model as-is if it contains a slash (specific model ID), otherwise use default
            if "/" not in explicit_model:
                model = "anthropic/claude-sonnet-4.5"  # Default pioneer model
        else:
            provider = "gemini"
            model = GEMINI_LIGHT_MODEL # Fallback now uses Lite instead of Pro
    elif normalized_model.startswith("models/") or normalized_model.startswith("gemini"):
        provider = "gemini"
    elif normalized_model.startswith("openrouter") or "/" in normalized_model:
        # Any model with a slash (like x-ai/grok-4.1-fast) routes through OpenRouter
        provider = "openrouter"

    # Check for onboarding tools so we can route through a provider that supports
    # real function calling (Gemini) instead of relying on brittle JSON parsing.
    is_onboarding_tool = False
    if tools:
        for t in tools:
            if t.function_declarations:
                for fd in t.function_declarations:
                    if fd.name == "complete_onboarding":
                        is_onboarding_tool = True
                        break

    # Route based on chosen provider. If tool calls are present, OpenRouter should handle them.
    # The previous logic forcing Gemini for tools is being removed as OpenRouter
    # now supports a standardized tool calling interface.
    if needs_structured_tools or is_onboarding_tool:
        # Ensure tools are passed to OpenRouter if it's the selected provider
        if provider == "openrouter":
            pass # OpenRouter will handle tools directly
        elif provider == "gemini":
            # Provider is already Gemini from tier alias selection (pro/lite)
            # Keep the model that was set by the tier alias - don't override it
            pass
        else:
            # No provider set yet, fallback to Gemini with appropriate model
            provider = "gemini"
            # Only use REMINDER_MODEL if user didn't explicitly select a tier
            if not explicit_model_is_tier_alias:
                model = REMINDER_MODEL if needs_structured_tools else GEMINI_SERVICE.default_model
    elif provider:
        # provider was decided above based on explicit model hints
        pass
    elif normalized_model in {"grok", "grok-lite"} or normalized_model.startswith("openrouter"):
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
            if not model:
                model = OPENROUTER_FALLBACK_MODEL
    else:
        # Default to Gemini for fastest streaming rather than Grok free tier throttling.
        provider = "gemini"

    # --- Google Maps Grounding Integration ---
    # If the user has enabled maps (or we detected intent), we MUST use Gemini
    # because OpenRouter does not support Google Maps Grounding.
    if maps_enabled:
        provider = "gemini"
        
        # Ensure the Google Maps tool is in the tools list
        if tools is None:
            tools = []
        
        # Check if Google Maps is already in tools to avoid duplication
        has_maps_tool = False
        for t in tools:
            if hasattr(t, "google_maps") and t.google_maps:
                has_maps_tool = True
                break
        
        if not has_maps_tool:
            tools.append(types.Tool(google_maps=types.GoogleMaps()))

        # Configure retrieval with user location for "near me" queries
        if maps_latitude is not None and maps_longitude is not None:
             # Create retrieval config with user location
             # For now, we will rely on the semantic understanding of the location passed in the tool (if any)
             # or implicitly by the model knowing the user's location from the conversation context if we injected it.
             # However, the instruction was to follow the specific dictionary structure.
             # Since we are using the official Google GenAI SDK types, we should try to reuse them if possible.
             # But the SDK wrapper in `backend/main.py` (GeminiService) ultimately calls `genai.GenerativeModel`.
             
             # We will leave tool_config as None and rely on the Tool injection unless we are sure about the exact dict structure
             # that avoids the syntax error. The previous error was caused by unmatched braces in a comment block that wasn't commented.
             pass

    prefers_gemini = (
        AI_PROVIDER == "gemini"
        or _prefers_gemini_model(normalized_model)
    )

    # Check usage limits (now that we know the effective model)
    if user_id is not None and db is not None:
        t0_limits = time.perf_counter()
        tracker = UsageTracker(db)
        try:
            await tracker.check_limits(user_id, model=model)
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
        limits_ms = (time.perf_counter() - t0_limits) * 1000
        if limits_ms > 50:
            api_logger.info(f"[Timing] Usage limits check: {limits_ms:.1f}ms")

    # Initialize cached contents
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

    try:
        calendar_context_block = await build_calendar_context(
            user_id=user_id,
            db=db,
            user_timezone=user_timezone,
            time_context=time_context,
        )
    except Exception as error:  # pragma: no cover - best effort logging
        api_logger.debug(
            f"Failed to build calendar context for user {user_id}: {error}",
            extra={"event_type": "calendar_context_error", "user_id": user_id, "error": str(error)},
        )
        calendar_context_block = None

    if calendar_context_block:
        workspace_with_cache = "\n\n".join(filter(None, [workspace_with_cache, calendar_context_block]))

    effective_system_prompt = system_prompt
    if not reminders_enabled:
        effective_system_prompt = (effective_system_prompt or "") + "\n\n" + (
            "CAPABILITY NOTE:\n"
            "- Reminders & plans are disabled for this session unless explicitly enabled.\n"
            "- Do not claim that you scheduled/set reminders or created plans/habits.\n"
            "- If the user wants reminders/plans, ask them to enable the Reminders & Plans toggle."
        )

    # Prepare tools for all providers
    t0_media = time.perf_counter()
    media_attachments = await _resolve_media_attachments(db, attachments, user_id)
    media_ms = (time.perf_counter() - t0_media) * 1000
    if media_ms > 50:
        api_logger.info(f"[Timing] Media attachments: {media_ms:.1f}ms")
    
    maps_tools, maps_tool_config = _build_maps_tool_and_config(
        maps_enabled,
        maps_latitude,
        maps_longitude,
        maps_widget,
    )

    if tools is not None:
        base_tools = tools
    else:
        base_tools = DEFAULT_CHAT_TOOLS
        if not search_enabled:
            base_tools = [t for t in base_tools if t != SEARCH_TOOL]
    
    # Common tool list
    tool_list = [*base_tools, *maps_tools]
    # Add PLAN_TOOLS and CALENDAR_TOOLS only when message intent suggests scheduling operations
    # BUT skip for onboarding flow - it only needs complete_onboarding tool, extra tools add latency
    if needs_structured_tools and not is_onboarding_tool:
        tool_list = [*tool_list, *PLAN_TOOLS, *CALENDAR_TOOLS]
    effective_tool_config = maps_tool_config

    # Initialize response_format
    # If tools are available (which they are), disable legacy JSON mode to prefer tool use.
    # Exception: if we specifically need JSON mode for some reason, but for reminders/plans we now have tools.
    response_format = None
    
    # DEBUG: Log the final provider selection
    api_logger.info(
        f"Provider selected: {provider}, Model: {model}",
        extra={"event_type": "ai_provider_selection", "provider": provider, "model": model}
    )

    if provider == "openrouter":
        if not OPENROUTER_SERVICE.available:
            # Lite tier requires OpenRouter - fail if unavailable
            error_msg = "OpenRouter service is currently unavailable. Please try again later or switch to Pro tier."
            yield ("delta", error_msg)
            yield ("final", {"text": error_msg, "grounding_metadata": None})
            return
        else:

            # Generate image descriptions for OpenRouter (non-vision models like DeepSeek)
            # DISABLED: User requested direct model usage without Gemini fallback.
            # if media_attachments:
            #     api_logger.info(
            #         "Generating image descriptions for OpenRouter model",
            #         extra={"event_type": "ai_image_description_start", "provider": provider, "count": len(media_attachments)},
            #     )
            #     image_desc = await _generate_image_descriptions(media_attachments)
            #     if image_desc:
            #         message = image_desc + message
            #         api_logger.info(
            #             f"Added image descriptions to message for OpenRouter",
            #             extra={"event_type": "ai_image_description_added", "count": len(media_attachments)},
            #         )
            
            try:
                t0_provider = time.perf_counter()
                
                # HYBRID URL CONTEXT: When URLs are detected in the message,
                # use Gemini Flash Lite to fetch URL content, then pass to OpenRouter.
                message_urls = _extract_urls_from_message(message)
                if message_urls and GEMINI_SERVICE.available:
                    api_logger.info(
                        f"[URL Context] Detected {len(message_urls)} URLs, fetching with Gemini",
                        extra={"event_type": "url_context_hybrid_start", "url_count": len(message_urls)}
                    )
                    url_content, url_metadata = await _fetch_url_context_with_gemini(
                        message,
                        message_urls,
                        workspace_with_cache,
                        time_context,
                    )
                    if url_content:
                        # Inject URL content as context for OpenRouter
                        url_context_section = f"--- URL Content ---\n{url_content}\n--- End URL Content ---"
                        workspace_with_cache = "\n\n".join(filter(None, [
                            workspace_with_cache,
                            url_context_section,
                        ]))
                        api_logger.info(
                            "[URL Context] Injected URL content into workspace context",
                            extra={"event_type": "url_context_injected", "content_len": len(url_content)}
                        )
                
                # HYBRID FLOW: When structured tools are needed (reminders, plans, habits),
                # use Gemini Flash for fast tool execution, then OpenRouter for personality response.
                # Exception: onboarding flow stays native to preserve tool state handling.
                use_hybrid_tools = needs_structured_tools and not is_onboarding_tool and GEMINI_SERVICE.available
                
                hybrid_tool_results: List[Dict[str, Any]] = []
                hybrid_tool_cards: List[Dict[str, Any]] = []
                hybrid_workspace_context = workspace_with_cache
                
                if use_hybrid_tools:
                    api_logger.info(
                        "[Hybrid] Using Gemini Flash for tool execution",
                        extra={"user_id": user_id, "model": model}
                    )
                    
                    # Inject explicit tool usage instructions so the model knows to CALL the tools
                    tool_instruction = """
You have tools available and MUST use them when the user requests:
- create_plan: Use for plans/tasks AND reminders (reminders are plans with an optional `reminder_at`)
- create_habit: Use when user wants to track a recurring habit
- update_plan/update_habit: Use when user wants to modify existing items (including setting/clearing `reminder_at`)
- delete_plan/delete_habit: Use when user wants to remove items
- list_plans/list_habits/list_reminders: Use to look up existing items when needed

When the user asks for a reminder: create/update a plan for the actual event time, then ask how long before the start they want to be reminded, and set `reminder_at` (ISO 8601 with timezone offset).

CRITICAL: When the user asks to create/update a plan or habit, you MUST call the appropriate tool. Do not just describe what you would do - actually invoke the function."""
                    hybrid_system_prompt = (effective_system_prompt or "") + "\n\n" + tool_instruction
                    
                    # Execute tools with Gemini Flash
                    hybrid_tool_results, hybrid_tool_cards, onboarding_done = await _execute_tools_with_gemini_flash(
                        message,
                        conversation_history,
                        tool_list,
                        hybrid_system_prompt,
                        time_context,
                        workspace_with_cache,
                        user_id,
                        db,
                        user_timezone,
                        history_token_budget=history_token_budget,
                    )
                    
                    # Emit tool cards (reminders, plans, habits) to frontend
                    for card in hybrid_tool_cards:
                        yield ("reminders", [card])
                    
                    # If tools were executed, inject results into context for OpenRouter
                    if hybrid_tool_results:
                        tool_context = _format_tool_results_for_context(hybrid_tool_results)
                        if tool_context:
                            hybrid_workspace_context = "\n\n".join(filter(None, [
                                workspace_with_cache,
                                tool_context,
                            ]))
                        
                        api_logger.info(
                            f"[Hybrid] Tool execution complete: {len(hybrid_tool_results)} tools executed",
                            extra={"user_id": user_id, "tools": [tr["tool_name"] for tr in hybrid_tool_results]}
                        )
                    
                    # For hybrid mode, don't pass tools to OpenRouter (they're already executed)
                    # This ensures OpenRouter generates conversation, not tool calls
                    tool_list = []
                
                # Multi-turn loop for tool handling (standard OpenRouter flow when not using hybrid)
                current_history = list(conversation_history) if conversation_history else []
                max_tool_turns = 5 if not use_hybrid_tools else 1  # Only 1 turn when hybrid handled tools
                yielded_any_tokens = False
                total_accumulated = ""
                current_message = message
                
                for turn in range(max_tool_turns + 1):
                    accumulated = ""
                    t0_first_token = time.perf_counter()
                    got_first_token = False
                    onboarding_completed_this_turn = False
                    
                    # Buffer for detecting JSON tool calls (legacy text fallback for onboarding)
                    tool_buffer = ""
                    is_collecting_tool = False
                    intercepted_legacy_tool_call = False
                    
                    # Native tool call accumulator: index -> {name, arguments_parts, id}
                    pending_tool_calls = {}
                    # Track if we've started streaming reasoning content (to wrap in <thinking> tags once)
                    reasoning_started = False
                    # DEBUG: Log what we're sending to OpenRouter
                    has_plugins = search_enabled
                    num_tools = len(tool_list) if tool_list else 0
                    tool_names = []
                    if tool_list:
                        for t in tool_list:
                            if hasattr(t, 'function_declarations') and t.function_declarations:
                                for fd in t.function_declarations:
                                    tool_names.append(fd.name)
                            elif hasattr(t, 'google_search'):
                                tool_names.append('google_search')
                            elif hasattr(t, 'google_maps'):
                                tool_names.append('google_maps')
                    hist_len = len(current_history) if current_history else 0
                    api_logger.info(f"[OpenRouter Call] search_enabled={search_enabled}, tools={num_tools} ({tool_names}), history={hist_len}, model={model}, reasoning_mode={reasoning_mode}")

                    run_system_prompt = effective_system_prompt
                    if needs_structured_tools and tool_list:
                        run_system_prompt = (run_system_prompt or "") + "\n\n" + (
                            "TOOLS REQUIRED:\n"
                            "- When the user asks to create/update/delete a plan, habit, or reminder, you MUST call the appropriate tool.\n"
                            "- Do NOT claim 'reminders set', 'scheduled', or similar unless you actually invoked the tool and it succeeded.\n"
                            "- If the user intent is ambiguous, ask a clarifying question before calling tools."
                        )
                    if search_enabled:
                        # Track web search cost ($10/K = $0.01 per search)
                        # We charge if the search capability is enabled and passed to the provider
                        if user_id:
                            try:
                                tracker = UsageTracker(db)
                                await tracker.track_cost(user_id, 0.01, "web_search")
                            except Exception as e:
                                api_logger.warning(f"Failed to track search cost: {e}")

                        # Explicitly tell the model about the search capability so it knows to use it (via the plugin)
                        run_system_prompt = (run_system_prompt or "") + "\n\nYou have access to Google Search. You must use it for current events, news, or factual queries where your knowledge might be outdated."

                    async for chunk in OPENROUTER_SERVICE.stream(
                        current_message,
                        current_history,
                        hybrid_workspace_context,  # Uses tool results context when hybrid flow is active
                        run_system_prompt,
                        time_context,
                        model,
                        include_usage=True,
                        response_format=response_format,
                        tools=tool_list,
                        tool_choice="auto",
                        plugins=[{"id": "web", "max_results": 5}] if search_enabled else None,
                        reasoning_mode=reasoning_mode,
                        attachments=media_attachments,
                        history_token_budget=history_token_budget,
                        provider_routing=provider_routing,
                    ):
                        if isinstance(chunk, dict):
                            # Handle usage statistics
                            if "usage" in chunk:
                                yield ("usage", chunk["usage"])
                                continue
                                
                            # Handle native streaming tool calls
                            if "tool_calls" in chunk:
                                for tc in chunk["tool_calls"]:
                                    idx = tc.get("index", 0)
                                    if idx not in pending_tool_calls:
                                        pending_tool_calls[idx] = {"name": "", "arguments": [], "id": ""}
                                    
                                    if tc.get("id"):
                                        pending_tool_calls[idx]["id"] = tc["id"]
                                    
                                    func = tc.get("function", {})
                                    if func.get("name"):
                                        pending_tool_calls[idx]["name"] = func["name"]
                                    if func.get("arguments"):
                                        pending_tool_calls[idx]["arguments"].append(func["arguments"])
                            
                            # Handle reasoning chunks - stream as opening tag once, then content
                            if chunk.get("type") == "reasoning":
                                r_text = chunk.get("content", "")
                                if not reasoning_started:
                                    # First reasoning chunk - emit opening tag
                                    yield ("delta", "<thinking>")
                                    accumulated += "<thinking>"
                                    reasoning_started = True
                                # Stream the raw thinking content
                                accumulated += r_text
                                yield ("delta", r_text)
                                if not got_first_token:
                                    got_first_token = True
                                    first_token_ms = (time.perf_counter() - t0_first_token) * 1000
                                    api_logger.info(f"[Timing] First token: {first_token_ms:.0f}ms")
                                yielded_any_tokens = True
                            continue
                            
                        # Legacy text-based tool call detection for onboarding
                        if is_onboarding_tool and not pending_tool_calls:
                            tool_buffer += chunk
                            
                            if "```json" in tool_buffer or (tool_buffer.strip().startswith("{") and "tool" in tool_buffer):
                                is_collecting_tool = True
                            
                            if is_collecting_tool:
                                if "```" in tool_buffer.split("```json")[-1] or "}" in tool_buffer:
                                    try:
                                        json_match = re.search(r"```(?:javascript|json)?\s*({.*?})\s*```", tool_buffer, re.DOTALL)
                                        if not json_match:
                                            json_match = re.search(r"({.*\"tool\":\s*\"complete_onboarding\".*})", tool_buffer, re.DOTALL)
                                        
                                        if json_match:
                                            json_str = json_match.group(1)
                                            tool_data = json.loads(json_str)

                                            if tool_data.get("tool") == "complete_onboarding":
                                                api_logger.info(f"Intercepted OpenRouter onboarding tool call (text-based) for user {user_id}")
                                                tool_args = tool_data.get("params") or tool_data.get("arguments") or tool_data
                                                pending_tool_calls[0] = {
                                                    "name": "complete_onboarding",
                                                    "arguments_parts": [json.dumps(tool_args)],
                                                    "id": "legacy_onboarding_call"
                                                }
                                                tool_buffer = ""
                                                is_collecting_tool = False
                                                intercepted_legacy_tool_call = True
                                                break
                                    except Exception as e:
                                        api_logger.warning(f"Failed to parse intercepted tool JSON: {e}")
                                        yield ("delta", tool_buffer)
                                        yielded_any_tokens = True

                                    accumulated += tool_buffer
                                    tool_buffer = ""
                                    is_collecting_tool = False
                                    continue

                            if len(tool_buffer) > 20 and not is_collecting_tool:
                                yield ("delta", tool_buffer)
                                yielded_any_tokens = True
                                accumulated += tool_buffer
                                tool_buffer = ""
                        else:
                            # Normal streaming - close thinking tag if we were in reasoning mode
                            if reasoning_started:
                                yield ("delta", "</thinking>\n")
                                accumulated += "</thinking>\n"
                                reasoning_started = False  # Reset for potential future reasoning
                            accumulated += chunk
                            if chunk:
                                yield ("delta", chunk)
                                if not got_first_token:
                                    got_first_token = True
                                    first_token_ms = (time.perf_counter() - t0_first_token) * 1000
                                    api_logger.info(f"[Timing] First token: {first_token_ms:.0f}ms")
                                yielded_any_tokens = True
                    
                    if intercepted_legacy_tool_call:
                        # Stop streaming the provider response early; we'll execute the tool and
                        # then do a follow-up model call (same as native tool_calls flow).
                        api_logger.info(f"Breaking stream loop for legacy tool call on turn {turn}")
                        pass
                    
                    # Flush remaining buffer
                    if tool_buffer:
                        yield ("delta", tool_buffer)
                        yielded_any_tokens = True
                        accumulated += tool_buffer
                    
                    # Close thinking tag if stream ended while still in reasoning mode
                    if reasoning_started:
                        yield ("delta", "</thinking>\n")
                        accumulated += "</thinking>\n"
                        reasoning_started = False
                                
                    # Process any accumulated native tool calls
                    if pending_tool_calls:
                        tool_handlers = {
                            "fetch_proactivity_summary": lambda u, a, d: _fetch_proactivity_summary(u, a.get("info_type"), d),
                            "list_calendar_events": lambda u, a, d: _list_calendar_events(u, a, d),
                            "create_calendar_event": lambda u, a, d: _create_calendar_event(u, a, d),
                            "update_calendar_event": lambda u, a, d: _update_calendar_event(u, a, d),
                            "delete_calendar_event": lambda u, a, d: _delete_calendar_event(u, a, d),
                            "complete_onboarding": lambda u, a, d: _complete_onboarding(u, a, d, user_timezone=user_timezone),
                            "list_plans": lambda u, a, d: _list_plans_tool(u, a, d),
                            "create_plan": lambda u, a, d: _create_plan_tool(u, a, d),
                            "update_plan": lambda u, a, d: _update_plan_tool(u, a, d),
                            "delete_plan": lambda u, a, d: _delete_plan_tool(u, a, d),
                            "list_habits": lambda u, a, d: _list_habits_tool(u, a, d),
                            "create_habit": lambda u, a, d: _create_habit_tool(u, a, d),
                            "update_habit": lambda u, a, d: _update_habit_tool(u, a, d),
                            "delete_habit": lambda u, a, d: _delete_habit_tool(u, a, d),
                            "list_reminders": lambda u, a, d: _list_reminders_tool(u, a, d),
                            "create_reminder": lambda u, a, d: _create_reminder_tool(u, a, d),
                            "update_reminder": lambda u, a, d: _update_reminder_tool(u, a, d),
                            "delete_reminder": lambda u, a, d: _delete_reminder_tool(u, a, d),
                            "delete_latest_reminder": lambda u, a, d: _delete_latest_reminder_tool(u, a, d),
                            "get_workspace_state": lambda u, a, d: _get_workspace_state_tool(u, a, d),
                        }
                        
                        tool_results = []
                        for idx, call in pending_tool_calls.items():
                            tool_name = call.get("name")
                            handler = tool_handlers.get(tool_name)
                            
                            if not handler:
                                api_logger.warning(f"Unknown tool call from OpenRouter: {tool_name}")
                                tool_results.append({"tool": tool_name, "error": f"Unknown tool: {tool_name}", "call_id": call.get("id", "")})
                                continue
                            
                            api_logger.info(f"Executing OpenRouter tool call: {tool_name}")
                            try:
                                args_str = "".join(call["arguments"])
                                args = json.loads(args_str) if args_str.strip() else {}
                                tool_result = await handler(user_id, args, db)
                                tool_results.append({"tool": tool_name, "result": tool_result, "call_id": call.get("id", "")})
                                if tool_name == "complete_onboarding" and isinstance(tool_result, dict):
                                    onboarding_completed_this_turn = tool_result.get("status") == "success"
                                
                                # Yield reminder/plan/habit cards to frontend
                                if isinstance(tool_result, dict) and tool_result.get("type") in {"gray.reminder", "gray.plan", "gray.habit"}:
                                    yield ("reminders", [tool_result])
                                    yielded_any_tokens = True
                                    
                            except Exception as e:
                                api_logger.error(f"Failed to execute OpenRouter tool call {tool_name}: {e}", exc_info=True)
                                tool_results.append({"tool": tool_name, "error": str(e), "call_id": call.get("id", "")})
                        
                        # Skip follow-up call for read-only list tools (optimization)
                        # These just return data - no need for LLM to summarize
                        read_only_tools = {"list_calendar_events", "list_plans", "list_habits", "list_reminders", "fetch_proactivity_summary"}
                        all_read_only = all(tr.get("tool") in read_only_tools for tr in tool_results)
                        
                        if all_read_only:
                            # Just finish - the tool results were already yielded as cards/data
                            api_logger.info("Skipping follow-up call for read-only tools")
                            total_accumulated += accumulated
                            # If we have any text, yield it; otherwise yield a default acknowledgment
                            if accumulated.strip():
                                yield ("delta", accumulated)
                                yielded_any_tokens = True
                            elif not total_accumulated.strip():
                                # No text at all - give a minimal response so frontend doesn't show error
                                total_accumulated = "Here's what I found."
                                yield ("delta", total_accumulated)
                                yielded_any_tokens = True
                            break  # Exit loop, go to final response
                        
                        # Update history with tool call and results for next turn
                        current_history.append({
                            "role": "model",
                            "text": accumulated or "",
                            "tool_calls": [
                                {
                                    "id": call.get("id", f"call_{idx}"),
                                    "type": "function",
                                    "function": {
                                        "name": call.get("name"),
                                        "arguments": "".join(call.get("arguments", []))
                                    }
                                }
                                for idx, call in pending_tool_calls.items()
                            ]
                        })
                        
                        for tr in tool_results:
                            result_content = json.dumps(tr.get("result", tr.get("error", {})))
                            current_history.append({
                                "role": "tool",
                                "name": tr.get("tool"),
                                "tool_call_id": tr.get("call_id", ""),
                                "content": result_content
                            })

                        if onboarding_completed_this_turn:
                            try:
                                updated_user = await db.fetch_one(users.select().where(users.c.id == user_id))
                            except Exception:
                                updated_user = None

                            nickname = _row_get(updated_user, "personalization_nickname") if updated_user else None
                            occupation = _row_get(updated_user, "personalization_occupation") if updated_user else None
                            about = _row_get(updated_user, "personalization_about") if updated_user else None

                            profile_lines: List[str] = []
                            if nickname:
                                profile_lines.append(f"Preferred name: {nickname}")
                            if occupation:
                                profile_lines.append(f"Occupation/focus: {occupation}")
                            if about:
                                profile_lines.append(f"About: {about}")

                            profile_block = ""
                            if profile_lines:
                                profile_block = "User profile:\n- " + "\n- ".join(profile_lines)

                            effective_system_prompt = "\n\n".join(
                                p
                                for p in [
                                    DEFAULT_SYSTEM_PROMPT,
                                    profile_block,
                                    "Onboarding is complete. Continue naturally and respond to the user's last message.",
                                ]
                                if p
                            )

                            # Prevent re-triggering onboarding inside the same request.
                            is_onboarding_tool = False
                            tool_list = [
                                t
                                for t in tool_list
                                if not (
                                    getattr(t, "function_declarations", None)
                                    and any(fd.name == "complete_onboarding" for fd in t.function_declarations)
                                )
                            ]
                        
                        total_accumulated += accumulated
                        current_message = ""  # Empty message, rely on history
                        continue  # Loop back for model's response after tool execution
                    
                    # No tool calls - we're done with this turn
                    total_accumulated += accumulated
                    break
                
                # Final response
                if response_format:
                    text, structured_reminders = _materialize_structured_reminders(total_accumulated)
                    yield ("final", {
                        "text": text,
                        "grounding_metadata": None,
                        "reminders": structured_reminders if structured_reminders else None
                    })
                else:
                    if yielded_any_tokens and not total_accumulated.strip():
                        total_accumulated = "Done."
                        yield ("delta", total_accumulated)
                    yield ("final", {"text": total_accumulated, "grounding_metadata": None})
                return
                
            except Exception as openrouter_error:
                api_logger.error(
                    f"OpenRouter streaming failed ({type(openrouter_error).__name__}: {openrouter_error}); falling back to Gemini",
                    extra={
                        "event_type": "ai_provider_fallback",
                        "provider": provider,
                        "error": str(openrouter_error),
                    },
                    exc_info=True,
                )
                
                if yielded_any_tokens:
                    api_logger.warning(
                        "OpenRouter failed mid-stream after yielding tokens; cannot fall back cleanly",
                        extra={"event_type": "ai_fallback_aborted", "provider": provider},
                    )
                    yield ("error", {"message": "AI service encountered an error. Please try again."})
                    return

                provider = "gemini"
                if not model or not str(model).startswith("models/"):
                    model = GEMINI_LIGHT_MODEL

    # URL Context: Add URL context tool when URLs are detected in the message
    # This allows Gemini to fetch and analyze content from URLs
    message_urls = _extract_urls_from_message(message)
    if provider == "gemini" and message_urls:
        api_logger.info(
            f"[URL Context] Adding URL context tool for {len(message_urls)} URLs",
            extra={"event_type": "url_context_gemini_tool_add", "url_count": len(message_urls)}
        )
        if tool_list is None:
            tool_list = []
        # Check if URL context tool is already in the list
        has_url_context = any(
            hasattr(t, 'url_context') and t.url_context is not None 
            for t in tool_list
        )
        if not has_url_context:
            tool_list.append(URL_CONTEXT_TOOL)

    # Gemini-specific tool list adjustment (consolidating)
    if provider == "gemini" and tool_list:
        all_declarations = []
        search_instance = None
        url_context_instance = None
        
        for t in tool_list:
            if t.function_declarations:
                all_declarations.extend(t.function_declarations)
            if t.google_search:
                search_instance = t.google_search
            if hasattr(t, 'url_context') and t.url_context is not None:
                url_context_instance = t.url_context
        
        # Rebuild a single tool if we have any components
        if all_declarations or search_instance or url_context_instance:
            tool_list = [types.Tool(
                function_declarations=all_declarations if all_declarations else None,
                google_search=search_instance,
                url_context=url_context_instance
            )]

    
    grounding_metadata: Optional[Dict[str, Any]] = None
    # Only invoke Gemini when it is the selected provider (or when a previous
    # provider explicitly fell back by setting provider='gemini').
    if provider == "gemini" and GEMINI_SERVICE.available:
        try:
            # Initialize loop variables
            current_history = list(conversation_history) if conversation_history else []
            intermediate_history: List[types.Content] = []
            
            # We'll allow up to 5 turns of tool use to prevent infinite loops
            max_tool_turns = 5
            
            previous_turns_text = ""
            for turn in range(max_tool_turns + 1):
                accumulated = ""
                final_usage = None
                tool_calls_in_this_turn: List[types.FunctionCall] = []
                
                # Prepare extra contents for this turn
                # This includes the initial cached context (if any) plus any intermediate turns from tool usage
                current_extra_contents = []
                if cached_contents:
                    current_extra_contents.extend(cached_contents)
                if intermediate_history:
                    current_extra_contents.extend(intermediate_history)

                # Stream response from Gemini
                text_buffer = ""
                is_buffering_text = False
                async for chunk in GEMINI_SERVICE.stream(
                    message if turn == 0 else "", # Only send message on first turn, subsequent turns use history
                    current_history,
                    workspace_with_cache,
                    effective_system_prompt,
                    time_context,
                    model,
                    attachments=media_attachments if turn == 0 else None, # Attachments only on first turn
                    extra_contents=current_extra_contents,
                    tools=tool_list,
                    tool_config=effective_tool_config,
                    reasoning_mode=reasoning_mode,
                    history_token_budget=history_token_budget,
                ):
                    if chunk.usage_metadata:
                        final_usage = chunk.usage_metadata

                    candidate = chunk.candidates[0] if chunk.candidates else None
                    parts = getattr(candidate, "content", None)
                    parts_list = getattr(parts, "parts", None) if parts else None

                    if candidate:
                        payload = _candidate_grounding_payload(candidate)
                        if payload:
                            grounding_metadata = payload
                        
                        # Extract thinking content for Gemini 3 models (always think via include_thoughts) or when reasoning_mode is enabled
                        is_gemini_3_model = model and "gemini-3" in model.lower()
                        if reasoning_mode or is_gemini_3_model:
                            thought_content = _candidate_thought(candidate)
                            if thought_content and not accumulated.startswith("<thinking>"):
                                # Stream thinking content wrapped in <thinking> tags on first occurrence
                                thinking_wrapper = f"<thinking>{thought_content}</thinking>\n"
                                accumulated = thinking_wrapper + accumulated
                                yield ("delta", thinking_wrapper)
                    
                    suppress_text = False
                    if parts_list:
                        suppress_text = any(getattr(part, "function_call", None) for part in parts_list)

                    if not suppress_text and candidate:
                        text_fragment = _candidate_text(candidate)
                        
                        # --- Buffering Logic for Text Tool Call Interception ---
                        if "```" in text_fragment or is_buffering_text:
                            is_buffering_text = True
                            text_buffer += text_fragment
                            
                            # Check for end of code block (>= 2 sets of triple backticks)
                            if text_buffer.count("```") >= 2:
                                # Process possible tool call
                                try:
                                    # Look for JSON block: ```... { ... } ...```
                                    match = re.search(r"```(?:javascript|json)?\s*(\{[\s\S]*?\})\s*```", text_buffer, re.IGNORECASE)
                                    if not match:
                                        # Fallback: Try to find a JSON object that looks like a tool call even if the regex didn't match perfectly
                                        # or if it's just a raw JSON block inside the backticks
                                        match = re.search(r"```\s*(\{[\s\S]*?\})\s*```", text_buffer, re.IGNORECASE)
                                    
                                    if match:
                                        json_str = match.group(1)
                                        tool_data = json.loads(json_str)
                                        
                                        if isinstance(tool_data, dict) and tool_data.get("tool") in REMINDER_FUNCTION_NAMES:
                                            tool_name = tool_data.get("tool")
                                            tool_params = tool_data.get("params") or {}
                                            
                                            api_logger.info(f"Intercepted and suppressed text tool call in Gemini stream: {tool_name}")
                                            
                                            gemini_fc = types.FunctionCall(name=tool_name, args=tool_params)
                                            tool_result = await _execute_function_call(gemini_fc, user_id, db, user_timezone=user_timezone)
                                            
                                            if isinstance(tool_result, dict) and tool_result.get("type") in {"gray.reminder", "gray.plan", "gray.habit"}:
                                                yield ("reminders", [tool_result])
                                            
                                            # Remove the code block from buffer
                                            start, end = match.span()
                                            pre_text = text_buffer[:start]
                                            post_text = text_buffer[end:]
                                            
                                            if pre_text:
                                                accumulated += pre_text
                                                yield ("delta", pre_text)
                                            
                                            # Reset buffer to post_text and continue buffering if it has ```
                                            text_buffer = post_text
                                            is_buffering_text = "```" in text_buffer
                                            
                                            # If we are no longer buffering, flush
                                            if not is_buffering_text and text_buffer:
                                                accumulated += text_buffer
                                                yield ("delta", text_buffer)
                                                text_buffer = ""
                                            
                                            continue # Skip yielding text_fragment directly
                                except Exception:
                                    pass # Parse failed, treating as normal text
                                
                                # If we reached here, it wasn't a suppressed tool call. Flush buffer if it's getting too big or we are done buffering.
                                # Actually, if we have 2 backticks and didn't match, we should probably flush up to the second backtick?
                                # For simplicity, if we have >= 2 backticks and didn't match, we flush everything.
                                if text_buffer.count("```") >= 2:
                                    accumulated += text_buffer
                                    yield ("delta", text_buffer)
                                    text_buffer = ""
                                    is_buffering_text = False
                            
                            # Safety valve: if buffer gets too big without closing
                            elif len(text_buffer) > 2000:
                                accumulated += text_buffer
                                yield ("delta", text_buffer)
                                text_buffer = ""
                                is_buffering_text = False
                            
                            continue # Continue loop, don't yield text_fragment directly
                        
                        # Normal text content (no code block involved)
                        accumulated += text_fragment
                        if text_fragment:
                            yield ("delta", text_fragment)
                    
                    # Collect function calls
                    if parts_list:
                        for part in parts_list:
                            if getattr(part, "function_call", None):
                                tool_calls_in_this_turn.append(part.function_call)
                
                # End of stream for this turn.
                if text_buffer:
                    accumulated += text_buffer
                    yield ("delta", text_buffer)
                
                # If no tool calls, we are done.
                if not tool_calls_in_this_turn:
                    if final_usage and user_id is not None and db is not None:
                        tracker = UsageTracker(db)
                        await tracker.track_usage(
                            user_id,
                            final_usage.prompt_token_count or 0,
                            final_usage.candidates_token_count or 0,
                            model=model
                        )

                    # Clean up structured reminders from text if needed
                    final_reminders = None
                    if response_format:
                        accumulated, final_reminders = _materialize_structured_reminders(accumulated)

                    final_payload = {
                        "text": previous_turns_text + (accumulated or ""), 
                        "grounding_metadata": grounding_metadata,
                        "reminders": final_reminders
                    }
                    yield ("final", final_payload)
                    return

                # Handle tool calls
                # Construct the model's message with function calls
                model_parts = []
                if accumulated:
                    model_parts.append(types.Part.from_text(text=accumulated))
                    
                # Accumulate text for next turns
                # If we are using structured output, we should probably strip the JSON before accumulating
                # But typically tools and structured output don't mix in the same turn for Gemini unless we force it.
                # Just in case, if response_format is set, clean it.
                if response_format:
                    text, _ = _materialize_structured_reminders(accumulated)
                    previous_turns_text += text
                else:
                    previous_turns_text += accumulated

                # Enforce single execution per mutating tool per turn to avoid double inserts (e.g., reminders)
                SINGLE_CALL_PER_TURN = {
                    "create_reminder",
                    "update_reminder",
                    "delete_reminder",
                    "delete_latest_reminder",
                    "create_plan",
                    "update_plan",
                    "delete_plan",
                    "create_habit",
                    "update_habit",
                    "delete_habit",
                }
                deduped_tool_calls: List[types.FunctionCall] = []
                seen_tool_names: Set[str] = set()
                for fc in tool_calls_in_this_turn:
                    if fc.name in SINGLE_CALL_PER_TURN:
                        if fc.name in seen_tool_names:
                            api_logger.info(f"Skipping extra {fc.name} call in turn", extra={"user_id": user_id})
                            continue
                        seen_tool_names.add(fc.name)
                    deduped_tool_calls.append(fc)

                for fc in deduped_tool_calls:
                    model_parts.append(types.Part.from_function_call(name=fc.name, args=fc.args or {}))
                
                # Add the model's turn (text + tool calls) to intermediate history
                intermediate_history.append(types.Content(role="model", parts=model_parts))
                
                # Execute tools and add results
                for fc in deduped_tool_calls:
                    tool_result = {} # Initialize for each tool call
                    try:
                        tool_result = await _execute_function_call(fc, user_id, db, user_timezone=user_timezone)
                        
                        # Emit structured payloads (like reminders) directly to the client
                        # so the frontend can render them immediately.
                        if isinstance(tool_result, dict) and tool_result.get("type") in {"gray.reminder", "gray.plan", "gray.habit"}:
                            api_logger.info(f"Yielding reminders event for {tool_result.get('type')}")
                            yield ("reminders", [tool_result])
                            
                    except Exception as e:
                        tool_result = {"error": str(e)}
                        api_logger.error(f"Tool execution failed for {fc.name}: {e}", exc_info=True)
                        
                    finally:
                        # Append the tool's execution and its result to history
                        intermediate_history.extend(_build_function_call_contents(fc, tool_result))
                        # Yield a blank delta to ensure frontend gets a chance to process the card_event before more text.
                        yield ("delta", "")
                
                # Loop continues to next turn, where intermediate_history will be included in extra_contents
                
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
    user_timezone: Optional[str] = None,
    *,
    context_cache_id: Optional[int] = None,
    maps_enabled: bool = False,
    maps_latitude: Optional[float] = None,
    maps_longitude: Optional[float] = None,
    maps_widget: bool = False,
    search_enabled: bool = True,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    tools: Optional[List[types.Tool]] = None,
    plan_tier: Optional[str] = None,
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

    conversation_history = normalize_conversation_history(conversation_history)
    history_token_budget = tier_conversation_token_limit(plan_tier)
    if not (message or "").strip() and not conversation_history and not (attachments or []):
        message = "Let's get started."

    # Determine whether this turn is part of a reminder/plan/habit flow using
    # both the current message and a short window of recent history.
    intent_window_text = (message or "") or ""
    if conversation_history:
        for entry in conversation_history[-4:]:
            text = entry.get("text") or ""
            if text:
                intent_window_text += f"\n{text}"

    request_structured_reminders = _should_request_structured_reminders(intent_window_text)
    needs_structured_tools = request_structured_reminders or _needs_structured_tools(intent_window_text)
    if needs_structured_tools:
        request_structured_reminders = True

    explicit_model = (model or "").strip()
    normalized_model = explicit_model.lower()
    explicit_model_is_tier_alias = normalized_model in {"lite", "gray-lite", "pro", "gray-pro"}
    explicit_model_provided = bool(explicit_model) and not explicit_model_is_tier_alias

    # Determine initial provider preference based on AI_PROVIDER environment variable
    initial_provider = AI_PROVIDER.lower()
    provider: Optional[str] = None

    if needs_structured_tools or tools:
        # For plan / habit / reminder flows, force Gemini tool support so we
        # actually persist changes instead of hallucinating side effects.
        provider = "gemini"
        if not model:
            model = REMINDER_MODEL
    if provider is None and normalized_model in {"lite", "gray-lite"}:
        # Lite tier routing: use OpenRouter with Grok 4.1 Fast
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
            model = OPENROUTER_LITE_MODEL  # x-ai/grok-4.1-fast - always set for tier alias
        else:
            provider = "gemini"
            model = GEMINI_LIGHT_MODEL
    elif normalized_model.startswith("openrouter") or "/" in normalized_model:
        # Any model with a slash (like x-ai/grok-4.1-fast) routes through OpenRouter
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
        else:
            provider = "gemini"
            if not model:
                model = GEMINI_LIGHT_MODEL
    elif normalized_model in {"pro", "gray-pro"}:
        # Pro tier routes to Gemini with pro model
        provider = "gemini"
        model = GEMINI_PRO_MODEL  # Always set the actual model path for tier alias
    elif normalized_model == "pioneer":
        # Pioneer tier is a direct OpenRouter passthrough
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
            # Keep the model as-is if it contains a slash (specific model ID), otherwise use default
            if "/" not in explicit_model:
                model = "anthropic/claude-sonnet-4.5"  # Default pioneer model
        else:
            provider = "gemini"
            model = GEMINI_PRO_MODEL
    elif normalized_model.startswith("models/") or normalized_model.startswith("gemini") or initial_provider == "gemini":
        # Explicitly requested Gemini model or default AI_PROVIDER is Gemini
        provider = "gemini"
        if not model:
            model = GEMINI_DEFAULT_MODEL
    else:
        # Fallback to initial_provider if no other specific routing applies
        provider = initial_provider

    # Final check: if no provider was definitively set, default to Gemini
    if not provider:
        provider = "gemini"

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
    
    if user_id is not None and db is not None:
        try:
            calendar_context_block = await build_calendar_context(
                user_id=user_id,
                db=db,
                user_timezone=user_timezone,
                time_context=time_context,
            )
        except Exception as error:  # pragma: no cover - best effort logging
            api_logger.debug(
                f"Failed to build calendar context for user {user_id}: {error}",
                extra={"event_type": "calendar_context_error", "user_id": user_id, "error": str(error)},
            )
            calendar_context_block = None

        if calendar_context_block:
            workspace_with_cache = "\n\n".join(filter(None, [workspace_with_cache, calendar_context_block]))

    effective_system_prompt = system_prompt

    # Prepare tools and attachments for all providers
    attachment_payloads: List[GeminiAttachment] = []
    if attachments:
        if user_id is None or db is None:
            raise HTTPException(status_code=400, detail="User information is required for attachments.")
        attachment_payloads = await _resolve_media_attachments(db, attachments, user_id)

    tool_list: List[types.Tool] = []
    effective_tool_config: Optional[types.ToolConfig] = None
    
    maps_tools, maps_tool_config = _build_maps_tool_and_config(
        maps_enabled,
        maps_latitude,
        maps_longitude,
        maps_widget,
    )

    if tools is not None:
        base_tools = tools
    else:
        base_tools = DEFAULT_CHAT_TOOLS
        if not search_enabled:
            base_tools = [t for t in base_tools if t != SEARCH_TOOL]
    tool_list = [*base_tools, *maps_tools]
    # Add PLAN_TOOLS and CALENDAR_TOOLS only when message intent suggests scheduling operations
    # BUT skip for onboarding flow - it only needs complete_onboarding tool, extra tools add latency
    # Check for onboarding tools so we can route through a provider that supports
    # real function calling (Gemini) instead of relying on brittle JSON parsing.
    is_onboarding_tool = False
    if tools:
        for t in tools:
            if t.function_declarations:
                for fd in t.function_declarations:
                    if fd.name == "complete_onboarding":
                        is_onboarding_tool = True
                        break

    if needs_structured_tools and not is_onboarding_tool:
        tool_list = [*tool_list, *PLAN_TOOLS, *CALENDAR_TOOLS]
    effective_tool_config = maps_tool_config

    # Initialize response_format
    # If tools are available (which they are), disable legacy JSON mode to prefer tool use.
    # Exception: if we specifically want JSON mode for some reason, but for reminders/plans we now have tools.
    response_format = None

    if provider == "openrouter":
        if not OPENROUTER_SERVICE.available:
            api_logger.warning(
                "OpenRouter unavailable; falling back to Gemini",
                extra={"event_type": "ai_provider_unavailable", "provider": provider},
            )
            # Fall back to Gemini
            provider = "gemini"
            if not model or "/" in model:
                model = GEMINI_DEFAULT_MODEL
        else:
            # Generate image descriptions for OpenRouter (non-vision models like DeepSeek)
            effective_message = message
            if attachment_payloads:
                api_logger.info(
                    "Generating image descriptions for OpenRouter model (non-streaming)",
                    extra={"event_type": "ai_image_description_start", "provider": provider, "count": len(attachment_payloads)},
                )
                image_desc = await _generate_image_descriptions(attachment_payloads)
                if image_desc:
                    effective_message = image_desc + message
                    api_logger.info(
                        f"Added image descriptions to message for OpenRouter (non-streaming)",
                        extra={"event_type": "ai_image_description_added", "count": len(attachment_payloads)},
                    )
            try:
                # response_format initialized in outer scope
                grounding_metadata = None  # Initialize before potential use
                response_text = await OPENROUTER_SERVICE.generate(
                    effective_message,
                    conversation_history,
                    workspace_with_cache,
                    effective_system_prompt,
                    time_context,
                    model,
                    include_usage=False,
                    response_format=response_format,
                    history_token_budget=history_token_budget,
                )
                if response_format:
                    text, structured_reminders = _materialize_structured_reminders(response_text)
                    # Reminders sent separately, not embedded in text
                    response_text = text
                    # Return reminders in metadata for non-streaming responses
                    grounding_metadata = grounding_metadata or {}
                    if structured_reminders:
                        grounding_metadata["reminders"] = structured_reminders
                if not response_text:
                    raise RuntimeError("AI response was empty")
                return response_text, grounding_metadata
            except Exception as openrouter_error:  # pragma: no cover - best effort logging
                api_logger.error(
                    f"OpenRouter generation failed ({type(openrouter_error).__name__}: {openrouter_error}); falling back to Gemini",
                    extra={
                        "event_type": "ai_provider_fallback",
                        "provider": provider,
                        "error": str(openrouter_error),
                    },
                    exc_info=True,
                )
                # Fall back to Gemini
                provider = "gemini"
                if not model or "/" in model:
                    model = GEMINI_DEFAULT_MODEL

    # Ensure we have an explicit tool_config when tools are present
    # Keep function calling enabled so the model can return calls we execute manually
    if tool_list and not effective_tool_config:
        effective_tool_config = types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(
                mode=types.FunctionCallingConfigMode.AUTO
            )
        )

    # Gemini-specific tool list adjustment (consolidating)
    if provider == "gemini" and tool_list:
        all_declarations = []
        search_instance = None
        
        for t in tool_list:
            if t.function_declarations:
                all_declarations.extend(t.function_declarations)
            if t.google_search:
                search_instance = t.google_search
        
        # Rebuild a single tool if we have any components
        if all_declarations or search_instance:
            tool_list = [types.Tool(
                function_declarations=all_declarations if all_declarations else None,
                google_search=search_instance
            )]

    
    grounding_metadata: Optional[Dict[str, Any]] = None
    # Only invoke Gemini when it is the selected provider (or when a previous
    # provider explicitly fell back by setting provider='gemini').
    if provider == "gemini" and GEMINI_SERVICE.available:
        try:
            response = await GEMINI_SERVICE.generate(
                message,
                conversation_history,
                workspace_with_cache,
                effective_system_prompt,
                time_context,
                model,
                attachments=attachment_payloads,
                extra_contents=cached_contents,
                response_schema=response_schema,
                response_mime_type=response_mime_type,
                tools=tool_list,
                tool_config=effective_tool_config,
                reasoning_mode=reasoning_mode,
                history_token_budget=history_token_budget,
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
                            await _execute_function_call(part.function_call, user_id, db, user_timezone=user_timezone)
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
                tool_result = await _execute_function_call(function_call, user_id, db, user_timezone=user_timezone)
                tool_contents = _build_function_call_contents(function_call, tool_result)
                extra_payloads = _merge_extra_contents(
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
                    tool_config=effective_tool_config,
                    reasoning_mode=reasoning_mode,
                    history_token_budget=history_token_budget,
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
            final_text = _candidate_text(response.candidates[0]) if response.candidates else ""
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
    return (
        f"Hey {preferred}. I'm Gray. What's the main thing you're trying to move forward right now?"
    )


def _build_starter_prompt(payload: ChatStarterRequest, profile_context: str, prompt_locale: str) -> str:
    base_prompt = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "starter",
        "You are Gray. Write a warm, engaging greeting to start the conversation.",
        locale=prompt_locale,
    )
    prompt_parts = [base_prompt]
    if profile_context:
        prompt_parts.append(f"Profile hints:\n{profile_context}")
    return "\n\n".join(part for part in prompt_parts if part.strip())


async def generate_chat_starter(
    request: Request,
    payload: ChatStarterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatStarterResponse:
    """Return an AI-authored greeting for the General workspace."""
    require_same_user(payload.user_id, current_user)
    prompt_locale = _prompt_locale_from_request(request)
    profile_context = _starter_profile_context(payload)
    prompt = _build_starter_prompt(payload, profile_context, prompt_locale)
    fallback_message = _starter_fallback_message(payload)
    try:
        ai_logger.info(
            "Generating chat starter",
            extra={
                "event_type": "chat_starter_request",
                "user_id": payload.user_id,
                "has_profile_context": bool(profile_context),
            },
        )
        response_text, _ = await generate_ai_response(
            prompt,
            conversation_history=[],
            workspace_context=payload.workspace_context,
            system_prompt=payload.system_prompt,
            time_context=payload.time_context,
            model=None,
            attachments=None,
            user_id=payload.user_id,
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
                "event_type": "chat_starter_error",
                "user_id": payload.user_id,
            },
            exc_info=True,
        )
        return ChatStarterResponse(message=fallback_message, used_fallback=True)


# AI Chat endpoints
async def create_chat_title(
    request: Request,
    payload: ChatTitleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Generate a chat title suggestion using local heuristics."""
    _ = current_user  # Auth enforced via dependency
    suggestion: Optional[str] = None
    try:
        suggestion = await generate_chat_title_suggestion(payload.message)
    except Exception as error:  # pragma: no cover - best effort logging
        print(f"Title generation error: {error}")
    if suggestion:
        return ChatTitleResponse(title=suggestion)
    return ChatTitleResponse(title=_fallback_title_from_message(payload.message))


@app.post("/context-cache", response_model=ContextCache)
@limiter.limit("60/minute")
async def create_context_cache(
    request: Request,
    payload: ContextCacheBase,
    user_id: int = Query(..., description="ID of the user creating the context cache"),
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ContextCache:
    require_same_user(user_id, current_user)
    now = utcnow()
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
@limiter.limit("120/minute")
async def get_context_cache(
    request: Request,
    cache_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    record = await db.fetch_one(
        context_cache.select().where(context_cache.c.id == cache_id)
    )
    payload = _serialize_context_cache(record)
    if not payload:
        raise HTTPException(status_code=404, detail="Context cache not found.")
    require_same_user(payload["user_id"], current_user)
    return ContextCache(**payload)


@app.post("/api/uploads", response_model=MediaUpload)
@limiter.limit("5/minute")
async def upload_media(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
  """Upload an image or PDF for later chat use."""
  user_id = current_user["id"]

  storage_path, mime_type, size, sanitized_name, storage_name = await _persist_upload_file(
      file,
      allowed_mime_types=CHAT_UPLOAD_MIME_TYPES,
      allowed_extensions=CHAT_UPLOAD_EXTENSIONS,
      max_size_bytes=MAX_MEDIA_UPLOAD_SIZE_BYTES,
  )

  try:
      storage_path_for_db = storage_path.relative_to(MEDIA_UPLOAD_ROOT)
  except Exception:
      storage_path_for_db = Path(storage_name)

  now = utcnow()
  query = media_uploads.insert().values(
      user_id=user_id,
      filename=sanitized_name,
      mime_type=mime_type,
      size=size,
      storage_path=str(storage_path_for_db),
      created_at=now,
  )
  media_record_id = await db.execute(query)

  public_url: str | None
  if STORAGE_BASE_URL:
      public_url = f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"
  else:
      # Use the same-origin authenticated route so the Next.js frontend can load files
      # even when it only proxies `/api/*` to the backend.
      public_url = f"/api/uploads/{media_record_id}/file"

  return MediaUpload(
      id=media_record_id,
      user_id=user_id,
      filename=sanitized_name,
      mime_type=mime_type,
      size=size,
      created_at=now,
      public_url=public_url,
  )


@app.get("/api/uploads", response_model=List[MediaUpload])
@limiter.limit("30/minute")
async def list_user_uploads(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List all uploads for the current user."""
    user_id = current_user["id"]
    query = (
        media_uploads.select()
        .where(media_uploads.c.user_id == user_id)
        .order_by(media_uploads.c.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    records = await db.fetch_all(query)
    
    result = []
    for record in records:
        public_url = None
        if STORAGE_BASE_URL and record["storage_path"]:
            storage_name = Path(record["storage_path"]).name
            public_url = f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"
        else:
            public_url = f"/api/uploads/{record['id']}/file"
        
        result.append(MediaUpload(
            id=record["id"],
            user_id=record["user_id"],
            filename=record["filename"],
            mime_type=record["mime_type"],
            size=record["size"],
            created_at=record["created_at"],
            public_url=public_url,
        ))
    
    return result


@app.get("/api/uploads/{upload_id}/file")
@limiter.limit("30/minute")
async def get_upload_file(
    request: Request,
    upload_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Serve an uploaded file via same-origin cookies (works when STORAGE_BASE_URL is unset)."""
    user_id = current_user["id"]
    record = await db.fetch_one(
        media_uploads.select().where(
            (media_uploads.c.id == upload_id) & (media_uploads.c.user_id == user_id)
        )
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    storage_path = _resolve_storage_path_from_record(record["storage_path"])
    if not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Upload no longer available.")

    filename = record["filename"] or "upload"
    mime_type = record["mime_type"] or "application/octet-stream"
    return FileResponse(
        path=str(storage_path),
        media_type=mime_type,
        filename=filename,
        headers={"Cache-Control": "private, max-age=86400"},
    )

async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    """Send a message to AI and get a response"""
    """Send a message to AI and get a response"""
    # Force the request user to the authenticated user to avoid mismatches from stale client state.
    # We overwrite it instead of raising 403 to be more potentially resilient to frontend glitches,
    # as long as the action is performed as the authenticated user.
    chat_request.user_id = current_user["id"]
    
    # Use authenticated ID for consistency
    authenticated_user_id = current_user["id"]
    chat_request.user_id = authenticated_user_id
    prompt_locale = _prompt_locale_from_request(request)
    start_time = utcnow()

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(chat_request.user_id)[:8])

    api_logger.info("Chat request received", extra={
        "event_type": "chat_request_start",
        "user_id": chat_request.user_id,
        "message_length": len(chat_request.message),
        "conversation_id": chat_request.conversation_id,
        "model": chat_request.model,
        "correlation_id": correlation_id
    })

    # Initialize tools (currently unused in non-streaming endpoint, but required by generate_ai_response)
    tool_list = None

    try:
        # Generate a title for the chat session (only if requested)
        # We use a fast local fallback initially to avoid blocking the response.
        # The AI-generated title will be updated in the background if requested.
        session_title = _fallback_title_from_message(chat_request.message)

        # Create chat session
        now = utcnow()
        chat_session_query = chat_sessions.insert().values(
            user_id=chat_request.user_id,
            title=session_title,
            scope="thread",
            created_at=now,
            updated_at=now
        )
        session_id = await db.execute(chat_session_query)

        # Determine conversation_id, only using Supabase when provided ID is valid or unspecified
        requested_conversation_id = chat_request.conversation_id
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        if requested_conversation_id and not valid_requested_conversation_id:
            conversation_id = requested_conversation_id
        else:
            conversation_id = await get_or_create_conversation(
                requested_conversation_id if valid_requested_conversation_id else None,
                chat_request.user_id,
                title=session_title,
            )

        # Get conversation history for context
        conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id, chat_request.user_id)

        # For thread conversations, inject General chat context as background memory.
        is_general_conversation = _general_conversation_user_id(conversation_id) is not None
        if not is_general_conversation:
            try:
                general_history = await _load_general_conversation_history(chat_request.user_id)
                if general_history:
                    recent_general = general_history[-10:]
                    if recent_general:
                        general_context_marker = {
                            "role": "user",
                            "text": "[CONTEXT FROM GENERAL CHAT - This is background context from the user's main conversation area. Use this to maintain continuity and remember what the user has discussed previously.]"
                        }
                        general_context_end = {
                            "role": "model",
                            "text": "[I understand and will remember this context while responding in this thread.]"
                        }
                        conversation_history = [general_context_marker] + recent_general + [general_context_end] + conversation_history
            except Exception:
                pass  # Non-critical: continue without General context

        # Save user message to local conversation store (after capturing prior history),
        # but avoid writing an identical message twice in a row (e.g., when a fallback
        # request replays the same prompt after a streaming failure).
        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": chat_request.message
        }
        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and last_history_entry.get("role") in {"user", "assistant", "model"}
            and (last_history_entry.get("text") or "") == chat_request.message
        )
        if is_general_conversation:
             # General chat messages are not handled by save_conversation_message
             # We must manually insert them using the general chat persistence logic
             if should_persist_user:
                 await _insert_general_conversation_message(
                     user_id=authenticated_user_id,
                     role="user",
                     text=chat_request.message
                 )
        elif should_persist_user:
            await save_conversation_message(conversation_id, user_message_payload, user_id=chat_request.user_id)

        # Enforce tier restrictions
        # Only Voyager and Pioneer users can use reasoning mode.
        normalized_tier = normalize_plan_tier(
            current_user.get("plan_tier"),
            current_user.get("role"),
            current_user.get("subscription_expires_at")
        )

        # If user requested reasoning but is not eligible, disable it silently (or we could raise 403)
        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            api_logger.info(f"Disabling reasoning mode for user {chat_request.user_id} (tier: {normalized_tier})")
            effective_reasoning_mode = False

        effective_model, model_coerced = coerce_model_for_tier(chat_request.model, normalized_tier)
        if model_coerced:
            api_logger.info(
                "Coerced requested model for user tier",
                extra={
                    "event_type": "model_coerced",
                    "user_id": chat_request.user_id,
                    "plan_tier": normalized_tier,
                    "requested_model": chat_request.model,
                    "effective_model": effective_model,
                },
            )

        # Generate AI response
        ai_response, grounding_metadata = await generate_ai_response(
            chat_request.message,
            conversation_history,
            chat_request.context,
            chat_request.system_prompt,
            chat_request.time_context,
            effective_model,
            chat_request.attachments,
            chat_request.user_id,
            db,
            response_schema=chat_request.response_json_schema,
            response_mime_type=chat_request.response_mime_type,
            context_cache_id=chat_request.context_cache_id,
            maps_enabled=chat_request.maps_enabled,
            maps_latitude=chat_request.maps_latitude,
            maps_longitude=chat_request.maps_longitude,
            maps_widget=chat_request.maps_widget,
            search_enabled=chat_request.web_search_enabled,
            should_generate_title=chat_request.should_generate_title,
            reasoning_mode=effective_reasoning_mode,
            tools=tool_list,
            user_timezone=chat_request.timezone,
            plan_tier=normalized_tier,
        )

        # Save AI response (including grounding metadata for downstream UI)
        assistant_message_payload: Dict[str, Any] = {
            "role": "model",
            "text": ai_response,
        }
        if grounding_metadata:
            assistant_message_payload["grounding_metadata"] = grounding_metadata
        assistant_message_id = None
        if is_general_conversation:
            # General Chat persistence
            assistant_message_id = await _insert_general_conversation_message(
                 user_id=authenticated_user_id,
                 role="model",
                 text=ai_response,
                 grounding_metadata=grounding_metadata
            )
        else:
             # Regular thread persistence
             assistant_message_id = await save_conversation_message(conversation_id, assistant_message_payload, user_id=authenticated_user_id)

        # Generate title inline so it's returned with the response.
        # This adds ~100-300ms latency but only on first message of new conversations.
        final_title = session_title
        if chat_request.should_generate_title:
            try:
                generated_title = await _generate_chat_title_inline(
                    chat_request.message,
                    ai_response,
                    prompt_locale=prompt_locale,
                )
                if generated_title:
                    final_title = generated_title
                    # Store in DB in background (non-blocking)
                    background_tasks.add_task(
                        update_conversation_title,
                        conversation_id,
                        generated_title,
                    )
            except Exception as title_error:
                api_logger.warning(
                    f"Inline title generation failed: {title_error}",
                    extra={"event_type": "title_generation_error"}
                )
                # Fall back to session_title, already set above

        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id,
            grounding_metadata=grounding_metadata,
            title=final_title,
            message_id=assistant_message_id,
        )

    except Exception as e:
        api_logger.error(f"CHAT_ERROR_DEBUG: Chat endpoint failed: {e}", exc_info=True, extra={"user_id": chat_request.user_id})
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


ONBOARDING_SYSTEM_PROMPT = load_prompt_from_json(
    GLOBAL_SYSTEM_PROMPTS_PATH,
    "onboarding",
    "You are Gray.",
)

DEFAULT_SYSTEM_PROMPT_PATH = GLOBAL_SYSTEM_PROMPTS_PATH

DEFAULT_SYSTEM_PROMPT = load_prompt_from_json(
    DEFAULT_SYSTEM_PROMPT_PATH,
    "chat",
    "You are Gray.",
)

# Cache classes (AsyncTTLCache, TTLCache) and instances (USER_CACHE, CONVERSATION_OWNER_CACHE,
# CONVERSATION_HISTORY_CACHE) are now imported from core.cache

# _get_cached_user removed - use get_cached_user from core.conversation_store directly


# _cache_conversation_history, _append_to_conversation_cache, _invalidate_conversation_cache
# are now imported directly from core.conversation_store - removed duplicate implementations


@app.post("/api/chat/stream")
# Increase the stream limit to avoid throttling active typing sessions.
@limiter.limit("120/minute")
async def chat_stream(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    """Stream an AI response token-by-token using Server-Sent Events."""
    chat_request.user_id = current_user["id"]
    start_time = utcnow()
    prompt_locale = _prompt_locale_from_request(request)

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(chat_request.user_id)[:8])

    api_logger.info("Chat stream request received", extra={
        "event_type": "chat_stream_request_start",
        "user_id": chat_request.user_id,
        "message_length": len(chat_request.message),
        "conversation_id": chat_request.conversation_id,
        "model": chat_request.model,
        "correlation_id": correlation_id
    })

    try:
        # 1. Start User Lookup (Async + Cached)
        t0_user = time.perf_counter()
        user_task = asyncio.create_task(get_cached_user(chat_request.user_id))

        # 2. Prepare Session Title (Sync, fast)
        effective_message = chat_request.message
        session_title = _fallback_title_from_message(effective_message)

        # 4. Start Conversation Setup (Async)
        t0_conv = time.perf_counter()
        requested_conversation_id = chat_request.conversation_id
        
        # FIX: If no conversation_id provided, default to General Chat format
        # This prevents creating UUID threads when frontend hasn't loaded user yet
        if not requested_conversation_id:
            requested_conversation_id = f"general:{chat_request.user_id}"
        
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        
        async def _setup_conversation():
            if requested_conversation_id and not valid_requested_conversation_id:
                return requested_conversation_id
            else:
                return await get_or_create_conversation(
                    requested_conversation_id if valid_requested_conversation_id else None,
                    chat_request.user_id,
                    title=session_title,
                )
        
        conv_task = asyncio.create_task(_setup_conversation())

        # Await critical data
        user_record = await user_task
        t1_user = time.perf_counter()
        api_logger.info(f"User lookup time: {(t1_user - t0_user)*1000:.2f}ms", extra={"user_id": chat_request.user_id})

        user_has_seen_general = bool(_row_get(user_record, "has_seen_general_chat"))
        user_nickname = _row_get(user_record, "personalization_nickname")
        user_occupation = _row_get(user_record, "personalization_occupation")
        user_about = _row_get(user_record, "personalization_about")
        user_plan_tier = _row_get(user_record, "plan_tier")

        def _has_personalization(value: Optional[str]) -> bool:
            if value is None:
                return False
            return bool(str(value).strip())

        needs_personalization = bool(
            user_record
            and (
                not _has_personalization(user_nickname)
                or not _has_personalization(user_occupation)
                or not _has_personalization(user_about)
            )
        )

        # Enforce onboarding for brand-new users; allow regular tools once they've completed it.
        force_onboarding_mode = bool(user_record and not user_has_seen_general)

        # Handle Onboarding Logic
        # Determine which system prompt to use.
        # Treat the user as \"in onboarding\" while any explicit personalization
        # field (nickname, occupation, or about) is missing.
        is_onboarding = bool(needs_personalization)

        onboarding_system_prompt = load_prompt_from_json(
            GLOBAL_SYSTEM_PROMPTS_PATH,
            "onboarding",
            locale=prompt_locale,
        )
        default_system_prompt = load_prompt_from_json(
            GLOBAL_SYSTEM_PROMPTS_PATH,
            "chat",
            locale=prompt_locale,
        )

        if is_onboarding:
            # Ignore client-provided prompts during onboarding so the AI
            # reliably completes the profile setup flow (name, occupation, blurb, etc.)
            # before switching to the regular chat persona.
            effective_system_prompt = onboarding_system_prompt
        elif chat_request.system_prompt:
            # IMPORTANT: Always include the base expansive Gray persona.
            # The client may send personalization (user profile, nickname, custom instructions)
            # but the core "be thoughtful, detailed, engaging" persona should always be present.
            # Check if the client prompt already contains the base (to avoid duplication).
            client_prompt = chat_request.system_prompt.strip()
            # DEFAULT_SYSTEM_PROMPT now starts with "You are Gray", so we check for that signature.
            base_signatures = ("You are Gray", "Anda adalah Gray")
            if any(signature in client_prompt for signature in base_signatures):
                # Client already sent the full prompt, use as-is
                effective_system_prompt = client_prompt
            else:
                # Client sent personalization only; prepend the base persona
                effective_system_prompt = f"{default_system_prompt}\n\n{client_prompt}"
        else:
            effective_system_prompt = default_system_prompt

        # Replace {{date}} placeholder if present.
        if effective_system_prompt and "{{date}}" in effective_system_prompt:
            effective_system_prompt = effective_system_prompt.replace(
                "{{date}}",
                datetime.now().strftime("%Y-%m-%d"),
            )

        effective_model = chat_request.model
        tool_list: Optional[List[Dict[str, Any]]] = None

        # While the user is in onboarding, always expose the dedicated
        # onboarding tools (e.g., `complete_onboarding`) so the model can
        # actually persist profile data once it has all required fields.
        if is_onboarding:
            tool_list = list(ONBOARDING_TOOLS) + list(PLAN_TOOLS)

        raw_message = (effective_message or "").strip()
        wants_onboarding = (
            "ready to start" in raw_message.lower()
            or "start onboarding" in raw_message.lower()
        )

        # If force_onboarding_mode is active, or if explicitly requested and needed, enforce onboarding settings.
        if force_onboarding_mode or (user_record and wants_onboarding and needs_personalization):
            # Always use onboarding prompt and tools in onboarding mode.
            effective_system_prompt = onboarding_system_prompt
            tool_list = list(ONBOARDING_TOOLS) + list(PLAN_TOOLS)

            # If this is the very first interaction (triggered by frontend with empty message usually)
            if not effective_message or not effective_message.strip():
                effective_message = ""

            api_logger.info(
                f"User {chat_request.user_id} is in onboarding flow (forced: {force_onboarding_mode})",
                extra={
                    "event_type": "onboarding_flow",
                    "requested": wants_onboarding,
                    "needs_personalization": needs_personalization,
                    "force_onboarding_mode": force_onboarding_mode,
                },
            )

        # The forced onboarding branch can overwrite the system prompt after we already
        # performed template substitution, so run {{date}} substitution again.
        if effective_system_prompt and "{{date}}" in effective_system_prompt:
            effective_system_prompt = effective_system_prompt.replace(
                "{{date}}",
                datetime.now().strftime("%Y-%m-%d"),
            )

        # During onboarding, inject any already-saved profile fields into the system prompt
        # so onboarding continues seamlessly across separate chat threads.
        if is_onboarding or force_onboarding_mode:
            known_lines: List[str] = []
            if _has_personalization(user_nickname):
                known_lines.append(f"- preferred name: {str(user_nickname).strip()}")
            if _has_personalization(user_occupation):
                known_lines.append(f"- occupation/focus: {str(user_occupation).strip()}")
            if _has_personalization(user_about):
                known_lines.append(f"- about blurb: {str(user_about).strip()}")
            if known_lines:
                effective_system_prompt = "\n\n".join(
                    [
                        (effective_system_prompt or "").strip(),
                        "Already saved (persisted across chats):",
                        "\n".join(known_lines),
                        "Do NOT ask again for any field listed above. If the user provides any new or corrected onboarding details, call `complete_onboarding` immediately (it can be called multiple times).",
                    ]
                ).strip()

        # Infer timezone from time_context if not explicitly provided
        if not chat_request.timezone and chat_request.time_context:
            tz_label, _ = _timezone_from_time_context(chat_request.time_context)
            if tz_label:
                chat_request.timezone = tz_label

        # Await conversation ID
        conversation_id = await conv_task
        t1_conv = time.perf_counter()
        api_logger.info(f"Conversation setup time: {(t1_conv - t0_conv)*1000:.2f}ms", extra={"user_id": chat_request.user_id})

        conversation_history: List[Dict[str, Any]] = []
        if conversation_id:
            t0_hist = time.perf_counter()
            conversation_history = await _load_conversation_history(conversation_id, chat_request.user_id)
            t1_hist = time.perf_counter()
            api_logger.info(f"History load time: {(t1_hist - t0_hist)*1000:.2f}ms, loaded {len(conversation_history)} messages", extra={"user_id": chat_request.user_id, "conversation_id": conversation_id, "history_count": len(conversation_history)})

            # NOTE: Previously we injected General chat context into threads here.
            # Removed because: (1) adds ~2.5s latency, (2) threads should be independent contexts.

        # Avoid sending an empty payload to the AI provider (Gemini rejects requests with no contents).
        if not (effective_message or "").strip() and not conversation_history and not (chat_request.attachments or []):
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
            # Make persistence non-blocking to improve time-to-first-token
            async def _persist_user_msg():
                try:
                    general_user_id = _general_conversation_user_id(conversation_id)
                    if general_user_id is not None:
                         await _insert_general_conversation_message(
                            user_id=general_user_id,
                            role="user",
                            text=effective_message,
                        )
                    else:
                        await save_conversation_message(
                            conversation_id,
                            user_message_payload,
                            user_id=chat_request.user_id,
                        )
                except Exception as e:
                    api_logger.error(f"Failed to persist user message: {e}", extra={"user_id": chat_request.user_id})

            asyncio.create_task(_persist_user_msg())

        # Enforce tier restrictions for streaming
        # user_record was already fetched above
        normalized_tier = normalize_plan_tier(
            user_plan_tier,
            _row_get(user_record, "role"),
            _row_get(user_record, "subscription_expires_at")
        )

        effective_model, model_coerced = coerce_model_for_tier(effective_model, normalized_tier)
        if model_coerced:
            api_logger.info(
                "Coerced requested model for user tier",
                extra={
                    "event_type": "model_coerced",
                    "user_id": chat_request.user_id,
                    "plan_tier": normalized_tier,
                    "requested_model": chat_request.model,
                    "effective_model": effective_model,
                },
            )

        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            api_logger.info(f"Disabling reasoning mode for user {chat_request.user_id} (tier: {normalized_tier})")
            effective_reasoning_mode = False

        async def event_stream() -> AsyncGenerator[str, None]:
            nonlocal session_title
            start_time = time.perf_counter()
            first_token_time: Optional[float] = None

            # Send an immediate keep-alive to nudge proxies to flush the stream sooner.
            yield ":streaming-start\n\n"
            try:
                accumulated_visible = ""
                final_response: Optional[str] = None
                grounding_metadata_payload: Optional[Dict[str, Any]] = None
                
                t0_stream = time.perf_counter()
                api_logger.info(f"Starting stream_ai_response for {effective_model}", extra={"user_id": chat_request.user_id})
                
                async for kind, payload in stream_ai_response(
                    effective_message,
                    conversation_history,
                    chat_request.context,
                    effective_system_prompt,
                    user_id=chat_request.user_id,
                    db=db,
                    user_timezone=chat_request.timezone,
                    time_context=chat_request.time_context,
                    model=effective_model,
                    attachments=chat_request.attachments,
                    context_cache_id=chat_request.context_cache_id,
                    maps_enabled=chat_request.maps_enabled,
                    maps_latitude=chat_request.maps_latitude,
                    maps_longitude=chat_request.maps_longitude,
                    maps_widget=chat_request.maps_widget,
                    search_enabled=chat_request.web_search_enabled,
                    should_generate_title=chat_request.should_generate_title,
                    reasoning_mode=effective_reasoning_mode,
                    reminders_enabled=chat_request.reminders_enabled,
                    tools=tool_list,
                    plan_tier=normalized_tier,
                ):
                    if kind == "delta":
                        if not payload:
                            continue
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        accumulated_visible += payload
                        yield _sse_event("token", {"delta": payload})
                    elif kind == "tool_card":
                        yield _sse_event("tool_card", payload)
                    elif kind == "reminders":
                        yield _sse_event("reminders", {"reminders": payload})
                    elif kind == "final":
                        reminders_payload = None
                        if isinstance(payload, dict):
                            final_response = payload.get("text") or accumulated_visible
                            grounding_metadata_payload = payload.get("grounding_metadata")
                            reminders_payload = payload.get("reminders")
                        elif payload:
                            final_response = payload

                if final_response is None:
                    final_response = accumulated_visible
                
                # Send reminders as a separate SSE event if they exist
                if reminders_payload:
                    yield _sse_event("reminders", {"reminders": reminders_payload})

                async def _finalize_chat(
                    cid: str,
                    uid: int,
                    text: str,
                    metadata: Optional[Dict[str, Any]],
                ):
                    try:
                        # Save Assistant Message in background
                        # Check for General Chat ID format "general:123"
                        general_user_id = _general_conversation_user_id(cid)
                        
                        if general_user_id is not None:
                            # Use specialized helper for General Chat messages
                            await _insert_general_conversation_message(
                                user_id=general_user_id,
                                role="model",
                                text=text,
                                grounding_metadata=metadata,
                            )
                        else:
                            # Standard Thread persistence
                            payload: Dict[str, Any] = {"role": "model", "text": text}
                            if metadata:
                                payload["grounding_metadata"] = metadata
                            await save_conversation_message(cid, payload, user_id=uid)

                    except Exception as e:
                        api_logger.error(f"Failed to finalize chat (save message) in background: {e}", extra={"user_id": uid})

                # Offload message persistence to background (but NOT title generation)
                background_tasks.add_task(
                    _finalize_chat,
                    conversation_id,
                    chat_request.user_id,
                    final_response,
                    grounding_metadata_payload,
                )

                # Generate title inline so it's returned with the SSE end event.
                # This adds ~100-300ms latency but only on first message of new conversations.
                # The generated title is also stored in the DB in the background.
                final_title = session_title
                if chat_request.should_generate_title:
                    try:
                        generated_title = await _generate_chat_title_inline(
                            effective_message,
                            final_response,
                            prompt_locale=prompt_locale,
                        )
                        if generated_title:
                            final_title = generated_title
                            # Store in DB in background (non-blocking)
                            background_tasks.add_task(
                                update_conversation_title,
                                conversation_id,
                                generated_title,
                            )
                    except Exception as title_error:
                        api_logger.warning(
                            f"Inline title generation failed: {title_error}",
                            extra={"event_type": "title_generation_error"}
                        )
                        # Fall back to session_title, already set above

                end_payload: Dict[str, Any] = {
                    "conversation_id": conversation_id,
                    "response": final_response,
                    "title": final_title,
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
            except Exception as stream_error:
                api_logger.error(f"Stream loop error: {stream_error}", exc_info=True)
                # Still save any accumulated response, even on error
                if accumulated_visible:
                    try:
                        general_user_id = _general_conversation_user_id(conversation_id)
                        if general_user_id is not None:
                            await _insert_general_conversation_message(
                                user_id=general_user_id,
                                role="model",
                                text=accumulated_visible,
                            )
                        else:
                            await save_conversation_message(
                                conversation_id,
                                {"role": "model", "text": accumulated_visible},
                                user_id=chat_request.user_id,
                            )
                    except Exception as save_error:
                        api_logger.error(f"Failed to save partial response on error: {save_error}", extra={"user_id": chat_request.user_id})
                yield _sse_event("error", {"message": str(stream_error)})

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }

        # Log successful completion
        total_time = (utcnow() - start_time).total_seconds() * 1000
        api_logger.info("Chat request completed successfully", extra={
            "event_type": "chat_request_complete",
            "user_id": chat_request.user_id,
            "conversation_id": conversation_id,
            "total_time_ms": total_time,
            "response_length": len(final_response) if 'final_response' in locals() else 0,
            "correlation_id": correlation_id
        })

        clear_request_context()
        return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
    except Exception as error:
        total_time = (utcnow() - start_time).total_seconds() * 1000
        error_msg = str(error)
        api_logger.error(
            f"Chat stream request failed: {error_msg}",
            exc_info=True,
            extra={
                "event_type": "chat_stream_request_error",
                "user_id": chat_request.user_id,
                "error": error_msg,
                "total_time_ms": total_time,
                "correlation_id": correlation_id,
            },
        )

        async def error_stream() -> AsyncGenerator[str, None]:
            yield _sse_event("error", {"message": error_msg})

        clear_request_context()
        return StreamingResponse(error_stream(), status_code=500, media_type="text/event-stream")

@app.post("/api/conversation/{conversation_id}/message")
@limiter.limit("30/minute")
async def create_conversation_message(
    request: Request,
    conversation_id: str,
    payload: MessageCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Manually append a message to a conversation history."""
    try:
        await _require_conversation_owner(conversation_id, current_user)
        if payload.user_id is not None:
            require_same_user(payload.user_id, current_user)
        payload_dict = {
            "role": payload.role,
            "text": payload.text
        }
        await save_conversation_message(conversation_id, payload_dict, user_id=payload.user_id)
        
        # Invalidate cache since conversation changed
        try:
            from chat_cache import invalidate_conversation_cache
            await invalidate_conversation_cache(conversation_id)
        except Exception:
            pass  # Best effort cache invalidation
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving message: {str(e)}")

@app.get("/api/conversation/{conversation_id}")
@limiter.limit("60/minute")
async def get_conversation(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
  """Get conversation history with Redis caching."""
  try:
    await _require_conversation_owner(conversation_id, current_user)
    
    # Try Redis cache first
    try:
        from chat_cache import get_cached_messages, cache_messages
        cached = await get_cached_messages(conversation_id)
        if cached is not None:
            return cached
    except ImportError:
        pass  # Cache module not available
    
    # Fetch from database
    history = await _load_conversation_history(conversation_id, current_user["id"])
    
    # Cache the result
    try:
        from chat_cache import cache_messages
        if history and isinstance(history, (list, dict)):
            messages = history.get("messages", history) if isinstance(history, dict) else history
            await cache_messages(conversation_id, messages if isinstance(messages, list) else [])
    except Exception:
        pass  # Best effort caching
    
    return history
  except Exception as e:
    raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")

@app.post("/api/conversation")
@limiter.limit("30/minute")
async def create_conversation(
    request: Request,
    payload: ConversationCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a new conversation"""
    try:
        require_same_user(payload.user_id, current_user)
        conversation_id = await get_or_create_conversation(
            None, payload.user_id, title=payload.title
        )
        return {
            "id": conversation_id,
            "title": payload.title,
            "history": [],
            "user_id": payload.user_id,
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(error)}")

# _delete_general_conversation_history is now imported from core.general_conversation

@app.delete("/api/conversation/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_conversation(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a conversation and all of its stored messages.

    This is used by the frontend when a user deletes an entire chat.
    It mirrors the behavior of other conversation helpers by updating
    both Supabase (when available) and the in-memory fallback store.
    """
    try:
        await _require_conversation_owner(conversation_id, current_user)
        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None:
            await _delete_general_conversation_history(general_user_id)
            invalidate_conversation_cache(conversation_id)
            return

        if _is_valid_uuid(conversation_id):
            try:
                try:
                    from backend.database import user_chat_threads as _user_chat_threads, user_chat_messages as _user_chat_messages  # type: ignore
                except Exception:
                    from database import user_chat_threads as _user_chat_threads, user_chat_messages as _user_chat_messages  # type: ignore

                # Local SQLite deletion for threads
                # Note: Delete messages first due to FK constraint if not cascaded, though SQLAlchemy usually handles it or SQLite pragma
                # But to be safe:
                await database.execute(_user_chat_messages.delete().where(_user_chat_messages.c.thread_id == conversation_id))
                await database.execute(_user_chat_threads.delete().where(_user_chat_threads.c.id == conversation_id))
            except Exception as error:
                _handle_conversation_store_error("Error deleting conversation", error)
        invalidate_conversation_cache(conversation_id)
        # When storage is unavailable or the ID is not a UUID, there is nothing to delete.
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(error)}")


@app.delete("/users/{user_id}/conversations", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_all_conversations(
    request: Request,
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Delete all conversations and messages for a user.
    
    This clears:
    1. General chat history
    2. All named conversation threads and their messages
    """
    try:
        # Force the user_id to be the authenticated user's ID to prevent cross-account deletion
        user_id = current_user["id"]

        # 1. Delete General Chat History
        await _delete_general_conversation_history(user_id, db=db)
        invalidate_conversation_cache(f"general:{user_id}")

        # 2. Delete All Named Threads (and their messages)
        try:
            try:
                from backend.database import (
                    user_chat_threads as _user_chat_threads,
                    user_chat_messages as _user_chat_messages,
                )
            except Exception:
                from database import user_chat_threads as _user_chat_threads, user_chat_messages as _user_chat_messages

            # Step 2a: Get thread IDs
            query = _user_chat_threads.select().where(_user_chat_threads.c.user_identifier == user_id)
            rows = await db.fetch_all(query)
            thread_ids = [str(row["id"]) for row in rows]

            if thread_ids:
                # Step 2b: Delete messages for these threads
                await db.execute(_user_chat_messages.delete().where(_user_chat_messages.c.thread_id.in_(thread_ids)))

                # Step 2c: Delete the threads themselves
                await db.execute(_user_chat_threads.delete().where(_user_chat_threads.c.id.in_(thread_ids)))

                for thread_id in thread_ids:
                    invalidate_conversation_cache(thread_id)

        except Exception as db_error:
            app_logger.error(f"Error checking/deleting named threads: {db_error}")

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error deleting all conversations: {str(error)}")


async def _overwrite_conversation_history_logic(
    conversation_id: str,
    payload: ConversationHistoryPayload,
    current_user: Dict[str, Any],
):
    try:
        await _require_conversation_owner(conversation_id, current_user)
        app_logger.info(
            f"Overwriting history for conversation {conversation_id}",
            extra={
                "event_type": "history_overwrite_start",
                "message_count": len(payload.messages),
            },
        )
        normalized_history = normalize_conversation_history(payload.messages)

        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None:
            await _replace_general_conversation_history(
                general_user_id, normalized_history
            )
            invalidate_conversation_cache(conversation_id)
            return {
                "id": conversation_id,
                "message_count": len(normalized_history),
            }

        # Thread conversations delegate to the shared chat_history helper.
        result = await overwrite_thread_history(
            conversation_id, normalized_history, current_user["id"]
        )
        invalidate_conversation_cache(conversation_id)
        return result
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error overwriting conversation history: {str(error)}",
        )


@app.put("/api/conversation/{conversation_id}/history")
@limiter.limit("20/minute")
async def overwrite_conversation_history(
    request: Request,
    conversation_id: str,
    payload: ConversationHistoryPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Replace the full message history for a conversation.

    The frontend uses this when the user deletes individual messages so that
    server-side history matches the locally edited conversation.
    """
    return await _overwrite_conversation_history_logic(conversation_id, payload, current_user)

# _normalize_conversation_title and _apply_conversation_update wrappers removed
# Use normalize_conversation_title and apply_conversation_update directly from core.chat_history



@app.patch("/api/conversation/{conversation_id}/metadata")
@limiter.limit("30/minute")
async def update_conversation(
    request: Request,
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update conversation metadata such as its title."""
    return await apply_conversation_update(conversation_id, payload, current_user)


@app.post("/api/conversation/{conversation_id}/metadata")
@limiter.limit("30/minute")
async def update_conversation_metadata(
    request: Request,
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update metadata via POST for clients that cannot rely on PATCH."""
    return await apply_conversation_update(conversation_id, payload, current_user)

@app.get("/api/conversation/{conversation_id}/usage")
@limiter.limit("60/minute")
async def get_conversation_usage(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get conversation usage statistics"""
    try:
        await _require_conversation_owner(conversation_id, current_user)
        # Load the actual conversation history
        history = await _load_conversation_history(conversation_id, current_user["id"])
        
        # Count messages
        message_count = len(history)
        
        # Better token estimation: use tiktoken if available, otherwise rough estimate
        # We skip the external Gemini API call for speed, as it adds significant latency.
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

        # gemini_tokens = await _count_tokens_with_gemini(history)
        # if gemini_tokens is not None:
        #     total_tokens = gemini_tokens
        
        # Context limits are based on the owner's plan tier.
        # We already verified ownership via `_require_conversation_owner`, so `current_user`
        # is the single source of truth (avoids brittle conversation-id parsing / Supabase lookups).
        user_tier = normalize_plan_tier(
            current_user.get("plan_tier"),
            current_user.get("role"),
            current_user.get("subscription_expires_at")
        )

        tier_context_limit = tier_conversation_token_limit(user_tier)
        
        # Get provider info from environment
        provider = os.getenv("AI_PROVIDER", "openrouter")
        model_name = os.getenv("AI_MODEL_NAME", None)
        
        # For Pioneer tier, check model-specific context limit
        model_context_limit = tier_context_limit
        context_warning = None
        suggested_models = None
        
        if user_tier == "pioneer" and model_name:
            # Get model-specific limit from OpenRouter service
            model_context_limit = OPENROUTER_SERVICE.get_model_context_limit(model_name)
            
            # If conversation exceeds this model's limit, suggest alternatives
            if total_tokens > model_context_limit:
                # Find models with higher context limits
                higher_context_models = []
                for model_id, limit in OPENROUTER_SERVICE.MODEL_CONTEXT_LIMITS.items():
                    if limit > model_context_limit:
                        # Get a friendly name
                        friendly_name = model_id.split("/")[-1] if "/" in model_id else model_id
                        higher_context_models.append({
                            "model_id": model_id,
                            "name": friendly_name,
                            "context_limit": limit
                        })
                
                # Sort by context limit descending
                higher_context_models.sort(key=lambda x: x["context_limit"], reverse=True)
                
                if higher_context_models:
                    context_warning = f"This conversation ({total_tokens:,} tokens) exceeds {model_name}'s context limit ({model_context_limit:,} tokens). Consider switching models."
                    suggested_models = higher_context_models[:3]  # Top 3 suggestions
        
        return {
            "conversation_id": conversation_id,
            "message_count": message_count,
            "conversation_tokens": total_tokens,
            "limit": tier_context_limit,
            "model_limit": model_context_limit,
            "provider": provider,
            "model_name": model_name,
            "model_label": model_name,
            "user_tier": user_tier,
            "context_warning": context_warning,
            "suggested_models": suggested_models,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation usage: {str(e)}")

@app.post("/api/conversation/{conversation_id}/compress")
@limiter.limit("5/minute")
async def compress_conversation(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Compress a conversation by summarizing its history"""
    try:
        await _require_conversation_owner(conversation_id, current_user)
        # Load the current conversation history
        history = await _load_conversation_history(conversation_id, current_user["id"])
        
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
        
        # Use Gemini to generate summary (fallback to OpenRouter if unavailable)
        summary_text = ""
        if GEMINI_SERVICE.available:
            try:
                summary_response = await GEMINI_SERVICE.generate(
                    summary_prompt,
                    conversation_history=[],
                    workspace_context=None,
                    system_prompt=None,
                    time_context="UTC",
                    model=None,
                )
                summary_text = getattr(summary_response, "text", "") or ""
            except Exception as gemini_error:
                api_logger.warning(
                    "Gemini summary generation failed; skipping compression",
                    extra={"error": str(gemini_error)},
                )
        
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
        await _overwrite_conversation_history_logic(
            conversation_id,
            ConversationHistoryPayload(messages=compressed_history),
            current_user
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
@limiter.limit("10/minute")
async def create_user(request: Request, user: UserCreate, db: databases.Database = Depends(get_database)):
    initials = generate_initials(user.full_name)
    now = utcnow()
    
    # Enforce plan tier logic: default to "scout", hardcode "pioneer" for specific user.
    # We ignore the incoming user.plan_tier to prevent clients from setting it.
    assigned_plan_tier = "scout"
    if user.email.lower().strip() == "vstalingrady@gmail.com":
        assigned_plan_tier = "pioneer"

    query = users.insert().values(
        email=user.email.lower(),
        full_name=user.full_name,
        profile_picture_url=user.profile_picture_url,
        role=user.role,
        plan_tier=assigned_plan_tier,
        initials=initials,
        workspace_background_id=user.workspace_background_id,
        auth_user_id=user.auth_user_id,
        created_at=now,
        updated_at=now
    )
    user_id = await db.execute(query)

    return _serialize_user_row({
        **user.dict(),
        "id": user_id,
        "initials": initials,
        "created_at": now,
        "updated_at": now
    })

@app.get("/users/email/{email}", response_model=User)
async def get_user_by_email(
    email: str,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),  # SECURITY: Now required
):
    normalized_email = email.lower()
    current_email = str(current_user.get("email") or "").lower()
    
    # Users can only access their own data by email (admins can access any)
    if current_user.get("role") != "admin" and current_email != normalized_email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    query = users.select().where(sqlalchemy.func.lower(users.c.email) == normalized_email)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user_row(user)


@app.get("/users/{user_id}", response_model=User)
async def get_user(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    # Verify user can only access their own data
    # Force authenticated ID
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    query = users.select().where(users.c.id == user_id)
    user = await db.fetch_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Enrich with usage status
    tracker = UsageTracker(db)
    usage_status = await tracker.get_usage_status(user_id)
    
    # Convert Row to dict to allow modification
    user_dict = _serialize_user_row(user)
    user_dict["usage_status"] = usage_status
    
    return user_dict


@app.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    # Verify user can only update their own data
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    
    # Get current user
    query = users.select().where(users.c.id == user_id)
    current_user_record = await db.fetch_one(query)
    if not current_user_record:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    update_data = user_update.dict(exclude_unset=True)
    if "full_name" in update_data:
        update_data["initials"] = generate_initials(update_data["full_name"])

    if "visible_model_ids" in update_data:
        raw_visible_model_ids = update_data.get("visible_model_ids")
        if raw_visible_model_ids is None:
            update_data["visible_model_ids"] = None
        elif isinstance(raw_visible_model_ids, list):
            sanitized: List[str] = []
            seen: Set[str] = set()
            for value in raw_visible_model_ids:
                if not isinstance(value, str):
                    continue
                candidate = value.strip()
                if not candidate or len(candidate) > 128:
                    continue
                if candidate in seen:
                    continue
                seen.add(candidate)
                sanitized.append(candidate)
                if len(sanitized) >= 500:
                    break
            update_data["visible_model_ids"] = sanitized
        else:
            update_data.pop("visible_model_ids", None)

    # Normalize settings/preferences fields
    if "theme_mode" in update_data:
        raw_theme_mode = update_data.get("theme_mode")
        if raw_theme_mode is None:
            update_data["theme_mode"] = None
        elif isinstance(raw_theme_mode, str):
            normalized = raw_theme_mode.strip().lower()
            if normalized in {"light", "dark", "system"}:
                update_data["theme_mode"] = normalized
            else:
                update_data.pop("theme_mode", None)
        else:
            update_data.pop("theme_mode", None)

    if "ui_locale" in update_data:
        raw_ui_locale = update_data.get("ui_locale")
        if raw_ui_locale is None:
            update_data["ui_locale"] = None
        elif isinstance(raw_ui_locale, str):
            normalized = raw_ui_locale.strip().lower()
            if not normalized:
                update_data["ui_locale"] = None
            elif normalized in {"en", "id"}:
                update_data["ui_locale"] = normalized
            else:
                update_data.pop("ui_locale", None)
        else:
            update_data.pop("ui_locale", None)

    if "preferred_response_language" in update_data:
        raw_response_language = update_data.get("preferred_response_language")
        if raw_response_language is None:
            update_data["preferred_response_language"] = None
        elif isinstance(raw_response_language, str):
            normalized = raw_response_language.strip().lower()
            if not normalized:
                update_data["preferred_response_language"] = None
            elif normalized in {"auto", "en", "id"}:
                update_data["preferred_response_language"] = normalized
            else:
                update_data.pop("preferred_response_language", None)
        else:
            update_data.pop("preferred_response_language", None)

    if "notification_preferences" in update_data:
        raw_notification_prefs = update_data.get("notification_preferences")
        if raw_notification_prefs is None:
            update_data["notification_preferences"] = None
        elif isinstance(raw_notification_prefs, dict):
            defaults: Dict[str, bool] = {
                "device": False,
                "tasks": True,
                "proactivity": True,
                "calendarEvents": True,
            }
            sanitized = dict(defaults)
            for key in defaults.keys():
                value = raw_notification_prefs.get(key)
                if isinstance(value, bool):
                    sanitized[key] = value
            update_data["notification_preferences"] = sanitized
        else:
            update_data.pop("notification_preferences", None)

    for flag_field in ("conversation_memory_enabled", "auto_web_search_enabled"):
        if flag_field not in update_data:
            continue
        raw_value = update_data.get(flag_field)
        if raw_value is None:
            continue
        if not isinstance(raw_value, bool):
            update_data.pop(flag_field, None)

    # Normalize optional text fields
    for field_name, max_length in (
        ("personalization_system_prompt_override", 8000),
        ("personalization_location", 160),
        ("personalization_time_zone", 64),
    ):
        if field_name not in update_data:
            continue
        value = update_data.get(field_name)
        if value is None:
            continue
        if not isinstance(value, str):
            update_data.pop(field_name, None)
            continue
        normalized = value.strip()
        if not normalized:
            update_data[field_name] = None
            continue
        update_data[field_name] = normalized[:max_length]

    # Keep proactivity settings in sync when the user updates their time zone.
    if "personalization_time_zone" in update_data:
        try:
            record = await db.fetch_one(
                proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
            )
            if record:
                payload = _row_get(record, "payload")
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except Exception:
                        payload = None
                if isinstance(payload, dict):
                    next_tz = update_data.get("personalization_time_zone")
                    if next_tz:
                        payload["timezone"] = next_tz
                    else:
                        payload.pop("timezone", None)
                    await db.execute(
                        proactivity_settings.update()
                        .where(proactivity_settings.c.user_id == user_id)
                        .values(payload=payload, updated_at=utcnow())
                    )
        except Exception as exc:  # pragma: no cover - best effort sync
            api_logger.debug(
                "Failed to sync personalization_time_zone into proactivity settings",
                extra={"event_type": "user_timezone_sync_failed", "user_id": user_id, "error": str(exc)},
            )

    update_data["updated_at"] = utcnow()

    query = users.update().where(users.c.id == user_id).values(**update_data)
    await db.execute(query)

    # Invalidate cache
    USER_CACHE.invalidate(f"user_{user_id}")
    if current_user_record:
        auth_user_id = current_user_record["auth_user_id"] if "auth_user_id" in current_user_record else None
        if auth_user_id:
            auth_user_id_str = str(auth_user_id)
            invalidate_user_cache(auth_user_id_str)
            await invalidate_user_cache_redis(auth_user_id_str)

    # Return updated user
    query = users.select().where(users.c.id == user_id)
    updated = await db.fetch_one(query)
    return _serialize_user_row(updated)



@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    user_id: int,
    response: Response,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    existing = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    user_email = existing["email"]
    auth_user_id = existing["auth_user_id"] if "auth_user_id" in existing else None
    
    api_logger.info(f"Processing account deletion for user {user_id} ({user_email})", extra={"user_id": user_id, "email": user_email, "event_type": "account_deletion_start"})

    delete_supabase_user_records(user_id)

    # Delete from Supabase Auth using a service-role client when available
    admin_client = supabase_admin or supabase
    service_sources = {"SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"}
    anon_sources = {"SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"}

    if admin_client and (supabase_admin is not None or SUPABASE_KEY_SOURCE in service_sources):
        try:
            if auth_user_id:
                # Convert UUID to string if needed
                auth_user_id_str = str(auth_user_id) if auth_user_id else None
                admin_client.auth.admin.delete_user(auth_user_id_str)
                api_logger.info(f"Deleted Supabase Auth user {auth_user_id_str}", extra={"user_id": user_id, "auth_user_id": auth_user_id_str})
            else:
                # Fallback to email search only if auth_id is missing (legacy users)
                api_logger.warning(f"auth_user_id missing for user {user_id}, attempting fallback search by email", extra={"user_id": user_id})
                auth_users_response = admin_client.auth.admin.list_users()
                auth_users = getattr(auth_users_response, "users", []) or []
                
                found_id = None
                for auth_user in auth_users:
                     if hasattr(auth_user, "email") and auth_user.email == user_email:
                         found_id = auth_user.id
                         break
                
                if found_id:
                    admin_client.auth.admin.delete_user(found_id)
                    api_logger.info(f"Deleted Supabase Auth user {found_id} (via fallback)", extra={"user_id": user_id, "auth_user_id": found_id})
                else:
                    api_logger.warning(f"Could not find Supabase Auth user for email {user_email}", extra={"user_id": user_id})
        except Exception as e:
            api_logger.error(f"Failed to delete Supabase Auth user: {e}", extra={"user_id": user_id, "error": str(e)})




    elif admin_client and SUPABASE_KEY_SOURCE in anon_sources:
        api_logger.warning(
            "Supabase service-role key missing; skipped Supabase Auth deletion",
            extra={"user_id": user_id, "event_type": "account_deletion_skipped_auth"},
        )

    deletion_tables = [
        chat_sessions,
        calendar_events,
        calendars,
        plans,
        habits,
        reminders,
        dashboard_pulses,
        context_cache,
        media_uploads,
        proactivity_logs,
        proactivity_settings,
        proactive_notifications,
        google_calendar_credentials,
        proactivity_push_subscriptions,
    ]

    for table in deletion_tables:
        await db.execute(table.delete().where(table.c.user_id == user_id))

    # Delete from raw SQL tables
    try:
        await db.execute("DELETE FROM general_chat_messages WHERE user_id = :user_id", {"user_id": user_id})
    except Exception:
        # Table might not exist or other error, ignore
        pass

    await db.execute(users.delete().where(users.c.id == user_id))
    
    # Clear session cookies to prevent auth loop
    response.delete_cookie("sb-access-token", path="/", domain=None)
    response.delete_cookie("sb-refresh-token", path="/", domain=None)
    
    api_logger.info(f"User account {user_id} deleted successfully", extra={"user_id": user_id, "event_type": "account_deletion_complete"})

# Calendar, Calendar Events, and Reminder routes are now in:
# - backend/api/calendars.py
# - backend/api/reminders.py

@app.post("/users/{user_id}/chat-sessions", response_model=ChatSession, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    user_id: int,
    session: ChatSessionCreate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = current_user["id"]
    require_same_user(user_id, current_user)
    query = chat_sessions.insert().values(
        user_id=user_id,
        title=session.title,
        scope="thread"
    )
    session_id = await db.execute(query)
    return {**session.dict(), "id": session_id, "user_id": user_id}

# Plans and Habits routes are now in backend/api/plans.py

@app.get("/users/{user_id}/conversations", response_model=List[Dict[str, Any]])
async def list_user_conversations(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    db: databases.Database = Depends(get_database),
):
    # Force the user_id to be the authenticated user's ID to prevent cross-account leakage
    user_id = current_user["id"]
    
    # Query local SQLite database for chat threads
    try:
        try:
            from backend.database import user_chat_threads
        except ImportError:
            from database import user_chat_threads

        query = (
            user_chat_threads.select()
            .where(user_chat_threads.c.user_identifier == user_id)
            # Exclude General Chat conversations (format: "general:123")
            .where(~user_chat_threads.c.id.like("general:%"))
            .order_by(user_chat_threads.c.last_message_at.desc())
            .limit(limit)
        )
        rows = await db.fetch_all(query)
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            created_at = row["created_at"]
            updated_at = row["updated_at"]
            last_message_at = row["last_message_at"]
            
            # Convert datetime to ISO string if needed
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat() + "Z"
            if isinstance(updated_at, datetime):
                updated_at = updated_at.isoformat() + "Z"
            if isinstance(last_message_at, datetime):
                last_message_at = last_message_at.isoformat() + "Z"
            
            normalized.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "last_message_at": last_message_at,
                }
            )
        return normalized
    except Exception as error:
        api_logger.error(f"Failed to list conversations from local database: {error}", exc_info=True)
        return []


# Dashboard routes are now in backend/api/dashboard.py

# Payment routes are now in backend/api/payments.py


# Proactivity routes are now in backend/api/proactivity.py

# Calendar event routes are now in backend/api/calendars.py
