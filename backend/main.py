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
        load_context_cache as _load_context_cache,
        context_cache_contents as _context_cache_contents,
    )
except ImportError:
    from core.cache import (  # type: ignore
        TTLCache,
        AsyncTTLCache,
        USER_CACHE,
        CONVERSATION_OWNER_CACHE,
        CONVERSATION_HISTORY_CACHE,
        load_context_cache as _load_context_cache,
        context_cache_contents as _context_cache_contents,
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
        build_maps_tool_and_config as _build_maps_tool_and_config,
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
        build_maps_tool_and_config as _build_maps_tool_and_config,
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

# Conversation manager (extracted from main.py)
try:
    from backend.core.conversation_manager import (
        load_conversation_history as _load_conversation_history,
        get_or_create_conversation,
        save_conversation_message,
    )
except ImportError:
    from core.conversation_manager import (  # type: ignore
        load_conversation_history as _load_conversation_history,
        get_or_create_conversation,
        save_conversation_message,
    )

# Proactivity helpers (extracted from main.py)
try:
    from backend.core.proactivity_helpers import fetch_proactivity_summary as _fetch_proactivity_summary
except ImportError:
    from core.proactivity_helpers import fetch_proactivity_summary as _fetch_proactivity_summary  # type: ignore

# Chat starter helpers (extracted from main.py)
try:
    from backend.core.chat_starter_helpers import (
        sse_event as _sse_event,
        starter_profile_context as _starter_profile_context,
        starter_fallback_message as _starter_fallback_message,
        build_starter_prompt as _build_starter_prompt,
    )
except ImportError:
    from core.chat_starter_helpers import (  # type: ignore
        sse_event as _sse_event,
        starter_profile_context as _starter_profile_context,
        starter_fallback_message as _starter_fallback_message,
        build_starter_prompt as _build_starter_prompt,
    )

load_dotenv(ROOT_DIR / ".env")

# Function call helpers (extracted from main.py)
try:
    from backend.core.function_call_helpers import (
        build_function_call_contents as _build_function_call_contents,
        extract_function_call as _extract_function_call,
        format_tool_results_for_context as _format_tool_results_for_context,
    )
except ImportError:
    from core.function_call_helpers import (  # type: ignore
        build_function_call_contents as _build_function_call_contents,
        extract_function_call as _extract_function_call,
        format_tool_results_for_context as _format_tool_results_for_context,
    )

# Hybrid stream handlers (extracted from main.py)
try:
    from backend.core.stream_handlers.hybrid import (
        fetch_url_context_with_gemini as _fetch_url_context_with_gemini_hybrid,
        execute_tools_with_gemini_flash as _execute_tools_with_gemini_flash_hybrid,
        has_onboarding_tool as _has_onboarding_tool_hybrid,
    )
    from backend.core.stream_handlers.openrouter import stream_openrouter_response
    from backend.core.stream_handlers.gemini_stream import stream_gemini_response
    from backend.core.stream_handlers.context import (
        build_intent_window_text,
        determine_provider_and_model as _determine_provider_and_model,
        build_workspace_with_cache,
        build_effective_system_prompt,
        consolidate_gemini_tools,
        add_url_context_tool_if_needed,
        add_maps_tool_if_needed,
    )
except ImportError:
    from core.stream_handlers.hybrid import (  # type: ignore
        fetch_url_context_with_gemini as _fetch_url_context_with_gemini_hybrid,
        execute_tools_with_gemini_flash as _execute_tools_with_gemini_flash_hybrid,
        has_onboarding_tool as _has_onboarding_tool_hybrid,
    )
    from core.stream_handlers.openrouter import stream_openrouter_response  # type: ignore
    from core.stream_handlers.gemini_stream import stream_gemini_response  # type: ignore
    from core.stream_handlers.context import (  # type: ignore
        build_intent_window_text,
        determine_provider_and_model as _determine_provider_and_model,
        build_workspace_with_cache,
        build_effective_system_prompt,
        consolidate_gemini_tools,
        add_url_context_tool_if_needed,
        add_maps_tool_if_needed,
    )


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


# AI Configuration imports (centralized in core.ai_config)
try:
    from backend.core.ai_config import (
        AI_PROVIDER,
        LITE_TIER_PROVIDER,
        REMINDER_MODEL,
        GROK_TOOL_MODEL,
        OPENROUTER_LITE_MODEL,
        GEMINI_DEFAULT_MODEL,
        GEMINI_LIGHT_MODEL,
        GEMINI_PRO_MODEL,
        VALIDATE_GEMINI_ON_STARTUP,
        TIER_CONVERSATION_TOKEN_LIMITS,
        tier_conversation_token_limit as _tier_conversation_token_limit_base,
        REMINDER_FUNCTION_NAMES,
        REMINDER_RESPONSE_FORMAT,
        get_search_tool,
        get_url_context_tool,
        get_default_chat_tools,
        PROMPTS_DIR,
        GLOBAL_SYSTEM_PROMPTS_PATH,
        ONBOARDING_PROMPT_PATH,
        STREAMING_TOKEN_DELAY,
        MAX_DASHBOARD_PULSE_HISTORY,
        DEFAULT_DASHBOARD_PROACTIVITY,
        DEFAULT_WORKSPACE_BACKGROUNDS,
        SINGLE_CALL_PER_TURN_TOOLS,
    )
except ImportError:
    from core.ai_config import (  # type: ignore
        AI_PROVIDER,
        LITE_TIER_PROVIDER,
        REMINDER_MODEL,
        GROK_TOOL_MODEL,
        OPENROUTER_LITE_MODEL,
        GEMINI_DEFAULT_MODEL,
        GEMINI_LIGHT_MODEL,
        GEMINI_PRO_MODEL,
        VALIDATE_GEMINI_ON_STARTUP,
        TIER_CONVERSATION_TOKEN_LIMITS,
        tier_conversation_token_limit as _tier_conversation_token_limit_base,
        REMINDER_FUNCTION_NAMES,
        REMINDER_RESPONSE_FORMAT,
        get_search_tool,
        get_url_context_tool,
        get_default_chat_tools,
        PROMPTS_DIR,
        GLOBAL_SYSTEM_PROMPTS_PATH,
        ONBOARDING_PROMPT_PATH,
        STREAMING_TOKEN_DELAY,
        MAX_DASHBOARD_PULSE_HISTORY,
        DEFAULT_DASHBOARD_PROACTIVITY,
        DEFAULT_WORKSPACE_BACKGROUNDS,
        SINGLE_CALL_PER_TURN_TOOLS,
    )




# tier_conversation_token_limit wrapper that uses normalize_plan_tier
def tier_conversation_token_limit(plan_tier: Optional[str]) -> int:
    return _tier_conversation_token_limit_base(plan_tier, normalize_fn=normalize_plan_tier)


GEMINI_SERVICE = GeminiService()
OPENROUTER_SERVICE = OpenRouterService()
# GROQ_SERVICE removed - using OpenRouter for all models
# VALIDATE_GEMINI_ON_STARTUP imported from core.ai_config

AI_MESSAGE_GENERATOR = AIMessageGenerator()

# File upload constants (CLAMAV_*, MEDIA_UPLOAD_*, IMAGE_MIME_TYPES, etc.)
# are imported from core.file_utils. Ensure upload directory exists:
MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# Tool definitions - use lazy getters from ai_config
SEARCH_TOOL = get_search_tool()
URL_CONTEXT_TOOL = get_url_context_tool()
DEFAULT_CHAT_TOOLS = get_default_chat_tools()

# PROMPTS_DIR, GLOBAL_SYSTEM_PROMPTS_PATH, ONBOARDING_PROMPT_PATH imported from core.ai_config



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


# GROK_DEFAULT_MODEL depends on OPENROUTER_SERVICE instance
GROK_DEFAULT_MODEL = OPENROUTER_SERVICE.lite_model if OPENROUTER_SERVICE else "x-ai/grok-4.1-fast"

DEFAULT_DEV_ORIGIN_PORTS = (3000, 5173)

# Message detection keywords and functions are imported from core.message_detection
REMINDER_KEYWORDS = _REMINDER_KEYWORDS
TOOL_TRIGGER_KEYWORDS = _TOOL_TRIGGER_KEYWORDS

# CORS, AI, and serialization utilities are imported from:
# - core.cors_utils, core.ai_utils, core.serializers


ALLOWED_ORIGIN_REGEX = _local_network_origin_regex()

ALLOWED_ORIGINS = _build_allowed_origins()

if IS_PRODUCTION and not ALLOWED_ORIGINS and not ALLOWED_ORIGIN_REGEX:
    app_logger.error(
        "CORS misconfigured for production: no allowed origins found; set SITE_URL/NEXT_PUBLIC_SITE_URL or CORS_ALLOW_ORIGINS."
    )
    raise RuntimeError("CORS configuration missing in production")



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
# DEFAULT_WORKSPACE_BACKGROUNDS imported from core.ai_config

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

# Users routes
try:
    from backend.api.users import router as users_router
except ImportError:
    from api.users import router as users_router  # type: ignore

app.include_router(users_router)

# Conversations routes
try:
    from backend.api.conversations import router as conversations_router
except ImportError:
    from api.conversations import router as conversations_router  # type: ignore

app.include_router(conversations_router)

# Analytics routes
try:
    from backend.api.analytics import router as analytics_router
except ImportError:
    from api.analytics import router as analytics_router  # type: ignore

app.include_router(analytics_router)

# Uploads routes
try:
    from backend.api.uploads import router as uploads_router
except ImportError:
    from api.uploads import router as uploads_router  # type: ignore

app.include_router(uploads_router)

# Context Cache routes
try:
    from backend.api.context_cache import router as context_cache_router
except ImportError:
    from api.context_cache import router as context_cache_router  # type: ignore

app.include_router(context_cache_router)

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



def _get_tool_handlers(user_timezone: Optional[str] = None) -> Dict[str, Any]:
    """Return a dictionary of tool name -> handler function.
    
    This is shared between _execute_function_call and stream_ai_response
    to avoid code duplication.
    """
    return {
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
    }


async def _execute_function_call(
    function_call: types.FunctionCall,
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
) -> Dict[str, Any]:
    handlers = _get_tool_handlers(user_timezone)
    handler = handlers.get(function_call.name)
    if not handler:
        raise HTTPException(status_code=501, detail=f"Unsupported function: {function_call.name}")

    args = function_call.args or {}
    return await handler(user_id, args, db)


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
    # Uses the current message plus a short window of recent history.
    intent_window_text = build_intent_window_text(message, conversation_history)


    request_structured_reminders = _should_request_structured_reminders(intent_window_text)
    needs_structured_tools = reminders_enabled or request_structured_reminders or _needs_structured_tools(intent_window_text)

    # Enable structured tools if keyword heuristics triggered
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
    is_onboarding_tool = _has_onboarding_tool_hybrid(tools)

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
    else:
        # Default to Gemini for fastest streaming
        provider = "gemini"


    # --- Google Maps Grounding Integration ---
    # If maps enabled, force Gemini provider (OpenRouter doesn't support Maps)
    if maps_enabled:
        provider = "gemini"
        tools = add_maps_tool_if_needed(tools, maps_enabled)

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
                    url_content, url_metadata = await _fetch_url_context_with_gemini_hybrid(
                        GEMINI_SERVICE, message, message_urls, workspace_with_cache, time_context
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
                    hybrid_tool_results, hybrid_tool_cards, onboarding_done = await _execute_tools_with_gemini_flash_hybrid(
                        GEMINI_SERVICE,
                        _execute_function_call,
                        message,
                        conversation_history,
                        tool_list,
                        hybrid_system_prompt,
                        time_context,
                        workspace_with_cache,
                        user_id,
                        db,
                        user_timezone,
                        history_token_budget,
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
                        tool_handlers = _get_tool_handlers(user_timezone)
                        
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
                    f"OpenRouter streaming failed: {type(openrouter_error).__name__}: {openrouter_error}",
                    extra={
                        "event_type": "ai_provider_error",
                        "provider": provider,
                        "error": str(openrouter_error),
                    },
                    exc_info=True,
                )
                yield ("error", {"message": "AI service encountered an error. Please try again."})
                return


    # URL Context: Add URL context tool when URLs are detected in the message
    message_urls = _extract_urls_from_message(message)
    if provider == "gemini" and message_urls:
        tool_list = add_url_context_tool_if_needed(tool_list or [], message_urls, URL_CONTEXT_TOOL)

    # Gemini-specific tool list adjustment (consolidating)
    if provider == "gemini" and tool_list:
        tool_list = consolidate_gemini_tools(tool_list)


    
    grounding_metadata: Optional[Dict[str, Any]] = None
    # Only invoke Gemini when it is the selected provider
    if provider == "gemini" and GEMINI_SERVICE.available:
        async for event_type, data in stream_gemini_response(
            gemini_service=GEMINI_SERVICE,
            message=message,
            conversation_history=conversation_history,
            workspace_context=workspace_with_cache,
            system_prompt=effective_system_prompt,
            time_context=time_context,
            model=model,
            tool_list=tool_list,
            tool_config=effective_tool_config,
            reasoning_mode=reasoning_mode,
            media_attachments=media_attachments,
            cached_contents=cached_contents,
            history_token_budget=history_token_budget,
            user_id=user_id,
            response_format=response_format,
            execute_function_call_fn=_execute_function_call,
            db=db,
            user_timezone=user_timezone,
            usage_tracker_cls=UsageTracker,
        ):
            yield (event_type, data)
        return

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

    # Determine whether this turn is part of a reminder/plan/habit flow.
    intent_window_text = build_intent_window_text(message, conversation_history)

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
    is_onboarding_tool = _has_onboarding_tool_hybrid(tools)

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
            except Exception as openrouter_error:
                api_logger.error(
                    f"OpenRouter generation failed: {type(openrouter_error).__name__}: {openrouter_error}",
                    extra={
                        "event_type": "ai_provider_error",
                        "provider": provider,
                        "error": str(openrouter_error),
                    },
                    exc_info=True,
                )
                raise  # Propagate the error instead of falling back


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
        tool_list = consolidate_gemini_tools(tool_list)

    
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
        trimmed = (payload.message or "").strip()
        suggestion = _fallback_title_from_message(trimmed) if trimmed else None
    except Exception as error:  # pragma: no cover - best effort logging
        print(f"Title generation error: {error}")
    if suggestion:
        return ChatTitleResponse(title=suggestion)
    return ChatTitleResponse(title=_fallback_title_from_message(payload.message))


# Context cache endpoints are now in backend/api/context_cache.py

# Upload endpoints are now in backend/api/uploads.py

async def chat_endpoint(

    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
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


# Conversation endpoints are now in backend/api/conversations.py

# User endpoints are now in backend/api/users.py

# Plans and Habits routes are now in backend/api/plans.py

# Dashboard routes are now in backend/api/dashboard.py

# Payment routes are now in backend/api/payments.py

# Proactivity routes are now in backend/api/proactivity.py

# Calendar event routes are now in backend/api/calendars.py

