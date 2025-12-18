"""
Centralized imports used by `backend/main.py`.

`backend/main.py` is intentionally kept stable; this module provides a small,
explicit import surface so the main module doesn't need dozens of inline import
blocks. Keep this file lightweight and only export what `backend/main.py`
imports.
"""

from __future__ import annotations

# `backend/main.py` imports this module while it is still initializing, so the
# partially-initialized main module will already be present in `sys.modules`.
import sys

# Time utilities
from backend.time_utils import utcnow, utcnow_aware

# Supabase utilities
from backend.supabase_utils import (
    create_supabase_client,
    create_supabase_service_client,
    resolve_supabase_credentials,
)

# Conversation store
from backend.core import conversation_store
from backend.core.conversation_store import (
    CONVERSATION_OWNER_CACHE,
    GENERAL_CONVERSATION_PREFIX,
    _conversation_store_available,
    _general_conversation_user_id,
    _handle_conversation_store_error,
    append_to_conversation_cache,
    cache_conversation_history,
    configure_conversation_store,
    delete_supabase_user_records,
    get_cached_user,
    invalidate_conversation_cache,
)

# Chat history
from backend.core.chat_history import (
    apply_conversation_update,
    load_thread_history,
    normalize_conversation_history,
    normalize_conversation_title,
    overwrite_thread_history,
    update_conversation_title,
)

# File utilities
from backend.core.file_utils import MEDIA_UPLOAD_DIR, MEDIA_UPLOAD_ROOT, sanitize_filename

# Prompt utilities
from backend.core.prompt_utils import (
    load_prompt_from_file,
    load_prompt_from_json,
    normalize_prompt_locale,
    prompt_locale_from_request as _prompt_locale_from_request,
)

# CORS utilities
from backend.core.cors_utils import IS_PRODUCTION, build_allowed_origins, local_network_origin_regex

# Cache utilities
from backend.core.cache import (
    AsyncTTLCache,
    CONVERSATION_HISTORY_CACHE,
    TTLCache,
    USER_CACHE,
    context_cache_contents,
    load_context_cache,
)

# Message detection helpers
from backend.core.message_detection import (
    needs_structured_tools,
    extract_urls_from_message,
    should_enable_search,
    should_request_structured_reminders,
    should_use_web_search,
)

# Serializers
from backend.core.serializers import (
    datetime_to_ms,
    parse_json_field,
    row_get,
    serialize_habit_record,
    serialize_reminder_row,
)

# AI utilities
from backend.core.ai_utils import (
    candidate_grounding_payload,
    candidate_text,
    candidate_thought,
    fallback_title_from_message,
    materialize_structured_reminders,
    merge_extra_contents,
)

from backend.core.calendar_tools import (
    create_calendar_event,
    delete_calendar_event,
    list_calendar_events,
    update_calendar_event,
)
from backend.core.tool_utils import (
    parse_iso_datetime,
    normalize_remind_at,
    parse_remind_at,
    build_reminder_payload,
)

# Entity reminders
from backend.core.entity_reminders import (
    set_reminder_scheduler as set_entity_reminder_scheduler,
)

# Workspace tools
from backend.core.workspace_tools import (
    create_habit_tool,
    create_plan_tool,
    create_reminder_tool,
    delete_habit_tool,
    delete_latest_reminder_tool,
    delete_plan_tool,
    delete_reminder_tool,
    get_workspace_state_tool,
    list_habits_tool,
    list_plans_tool,
    list_reminders_tool,
    set_reminder_scheduler as set_workspace_reminder_scheduler,
    update_habit_tool,
    update_plan_tool,
    update_reminder_tool,
)
from backend.core.stream_handlers.context import build_maps_tool_and_config

# General conversation
try:
    from backend.core.general_conversation import (
        load_general_conversation_history as _load_general_conversation_history,
        insert_general_conversation_message as _insert_general_conversation_message,
        delete_general_conversation_history as _delete_general_conversation_history,
    )
except ImportError:
    from core.general_conversation import (
        load_general_conversation_history as _load_general_conversation_history,
        insert_general_conversation_message as _insert_general_conversation_message,
        delete_general_conversation_history as _delete_general_conversation_history,
    )

# Conversation manager core utilities
try:
    from backend.core.conversation_manager import (
        load_conversation_history as _load_conversation_history,
        get_or_create_conversation,
        save_conversation_message,
    )
except ImportError:
    from core.conversation_manager import (
        load_conversation_history as _load_conversation_history,
        get_or_create_conversation,
        save_conversation_message,
    )

# Env Helpers
try:
    from backend.core.env_helpers import (
        is_valid_uuid as _is_valid_uuid,
        timezone_from_time_context as _timezone_from_time_context,
    )
except ImportError:
    from core.env_helpers import (
        is_valid_uuid as _is_valid_uuid,
        timezone_from_time_context as _timezone_from_time_context,
    )

# Dashboard Helpers (missing ones)
try:
    from backend.core.dashboard_helpers import (
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
    )
except ImportError:
    from core.dashboard_helpers import (
        normalize_plan_items,
        normalize_habit_items,
        normalize_proactivity,
    )

# Tier utilities
try:
    from backend.tier_utils import normalize_plan_tier
except ImportError:
    from tier_utils import normalize_plan_tier # type: ignore

# Model access
try:
    from backend.model_access import coerce_model_for_tier
except ImportError:
    from model_access import coerce_model_for_tier # type: ignore

# Proactivity and Reminder classes
from backend.proactivity_engine import ProactivityEngine, ProactivitySchedulerManager
try:
    from backend.reminder_scheduler import ReminderSchedulerManager
except ImportError:
    from reminder_scheduler import ReminderSchedulerManager # type: ignore

for _main_module_name in ("main", "backend.main"):
    _main_module = sys.modules.get(_main_module_name)
    if _main_module is not None and not hasattr(_main_module, "_should_enable_search"):
        setattr(_main_module, "_should_enable_search", should_enable_search)

__all__ = [
    # Time utilities
    "utcnow",
    "utcnow_aware",
    # Supabase utilities
    "create_supabase_client",
    "create_supabase_service_client",
    "resolve_supabase_credentials",
    # Conversation store
    "conversation_store",
    "configure_conversation_store",
    "get_cached_user",
    "cache_conversation_history",
    "append_to_conversation_cache",
    "invalidate_conversation_cache",
    "delete_supabase_user_records",
    "CONVERSATION_OWNER_CACHE",
    "GENERAL_CONVERSATION_PREFIX",
    "_conversation_store_available",
    "_handle_conversation_store_error",
    "_general_conversation_user_id",
    # Chat history
    "normalize_conversation_history",
    "load_thread_history",
    "overwrite_thread_history",
    "normalize_conversation_title",
    "apply_conversation_update",
    "update_conversation_title",
    # File utilities
    "MEDIA_UPLOAD_DIR",
    "MEDIA_UPLOAD_ROOT",
    "sanitize_filename",
    # Prompt utilities
    "load_prompt_from_file",
    "load_prompt_from_json",
    "normalize_prompt_locale",
    "_prompt_locale_from_request",
    # CORS utilities
    "IS_PRODUCTION",
    "local_network_origin_regex",
    "build_allowed_origins",
    # Cache utilities
    "TTLCache",
    "AsyncTTLCache",
    "USER_CACHE",
    "CONVERSATION_HISTORY_CACHE",
    "load_context_cache",
    "context_cache_contents",
    # Message detection helpers
    "needs_structured_tools",
    "should_request_structured_reminders",
    "should_use_web_search",
    "should_enable_search",
    "extract_urls_from_message",
    # Serializers
    "row_get",
    "parse_json_field",
    "serialize_reminder_row",
    "serialize_habit_record",
    "datetime_to_ms",
    # AI utilities
    "candidate_text",
    "candidate_thought",
    "candidate_grounding_payload",
    "merge_extra_contents",
    "materialize_structured_reminders",
    "fallback_title_from_message",
    # Tool handlers
    "set_tool_reminder_scheduler",
    "list_calendar_events",
    "create_calendar_event",
    "update_calendar_event",
    "delete_calendar_event",
    "build_maps_tool_and_config",
    # Entity reminders
    "set_entity_reminder_scheduler",
    # Workspace tools
    "set_workspace_reminder_scheduler",
    "list_plans_tool",
    "create_plan_tool",
    "update_plan_tool",
    "delete_plan_tool",
    "list_habits_tool",
    "create_habit_tool",
    "update_habit_tool",
    "delete_habit_tool",
    "list_reminders_tool",
    "create_reminder_tool",
    "update_reminder_tool",
    "delete_reminder_tool",
    "delete_latest_reminder_tool",
    "get_workspace_state_tool",
    "_load_general_conversation_history",
    "_insert_general_conversation_message",
    "_delete_general_conversation_history",
    "_load_conversation_history",
    "get_or_create_conversation",
    "save_conversation_message",
    "_is_valid_uuid",
    "_timezone_from_time_context",
    "normalize_plan_items",
    "normalize_habit_items",
    "normalize_proactivity",
    "normalize_plan_tier",
    "coerce_model_for_tier",
    "ProactivityEngine",
    "ProactivitySchedulerManager",
    "ReminderSchedulerManager",
]
