import logging
import math
import socket
import asyncio
import sqlite3
from fastapi import FastAPI, HTTPException, Depends, status, File, Form, Query, UploadFile, Response, Request, BackgroundTasks
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
import statistics
from asyncio import TimeoutError, wait_for, sleep
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
from uuid import UUID, uuid4
from pathlib import Path
from urllib.parse import urlparse

# Environment flags used across CORS and rate limiting defaults
NODE_ENV = os.getenv("NODE_ENV", "").strip().lower()
ENVIRONMENT = os.getenv("ENVIRONMENT", "").strip().lower()
IS_PRODUCTION = NODE_ENV == "production" or ENVIRONMENT == "production"

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
    from backend.file_search import FileSearchService
except ImportError:
    from calendar_tools import CALENDAR_TOOLS
    from file_search import FileSearchService
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

# Authentication module
try:
    from backend.auth import get_current_user, get_current_user_optional, require_same_user, require_admin, invalidate_user_cache
except ImportError:
    from auth import get_current_user, get_current_user_optional, require_same_user, require_admin, invalidate_user_cache

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
        file_search_stores,
        media_uploads,
        context_cache,
        proactive_notifications,
        google_calendar_credentials,
        user_data,
        general_chat_messages,
        user_streaks,
        reminders,
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
        file_search_stores,
        media_uploads,
        context_cache,
        proactive_notifications,
        google_calendar_credentials,
        user_data,
        general_chat_messages,
        user_streaks,
        reminders,
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

ROOT_DIR = Path(__file__).resolve().parent.parent
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
    """Load a plain-text prompt from disk, falling back to the provided default."""
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


def load_prompt_from_json(path: Path, key: str, fallback: str = "") -> str:
    """
    Load a prompt string from a JSON config file, using a dotted key path like
    "chat" or "proactivity.daily". Raises RuntimeError if prompt can't be loaded.
    
    The fallback parameter is DEPRECATED and ignored.
    """
    raw = path.read_text(encoding="utf-8")
    data: Any = json.loads(raw)
    value: Any = data
    for segment in key.split("."):
        if not isinstance(value, dict) or segment not in value:
            raise RuntimeError(f"Prompt key '{key}' not found in {path}")
        value = value[segment]
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise RuntimeError(f"Prompt key '{key}' is empty in {path}")



AI_PROVIDER = (os.getenv("AI_PROVIDER") or "openrouter").strip().lower()
# Default lite tier provider - using OpenRouter for all models
LITE_TIER_PROVIDER = (os.getenv("LITE_TIER_PROVIDER") or "openrouter").strip().lower()
OPENROUTER_FALLBACK_MODEL = os.getenv("OPENROUTER_FALLBACK_MODEL", "anthropic/claude-sonnet-4.5")

GEMINI_SERVICE = GeminiService()
OPENROUTER_SERVICE = OpenRouterService()
# GROQ_SERVICE removed - using OpenRouter for all models
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

CLAMAV_SCAN_ENABLED = os.getenv("ENABLE_CLAMAV_SCAN", "false").strip().lower() in {"1", "true", "yes", "on"}
CLAMAV_SCAN_BINARY = (
    os.getenv("CLAMAV_SCAN_BINARY")
    or shutil.which("clamdscan")
    or shutil.which("clamscan")
)
CLAMAV_SCAN_TIMEOUT = _int_env("CLAMAV_SCAN_TIMEOUT_SECONDS", 30)


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
MEDIA_UPLOAD_ROOT = MEDIA_UPLOAD_DIR.resolve()
if MEDIA_UPLOAD_ROOT.is_symlink():
    raise RuntimeError("MEDIA_UPLOAD_DIR must not be a symlink.")

UPLOAD_READ_CHUNK_SIZE = 1024 * 1024
MAX_MEDIA_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_BACKGROUND_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # Keep parity with chat uploads

IMAGE_MIME_TYPES: Set[str] = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
}
DOCUMENT_MIME_TYPES: Set[str] = {
    "application/pdf",
}
CHAT_UPLOAD_MIME_TYPES: Set[str] = IMAGE_MIME_TYPES | DOCUMENT_MIME_TYPES
BACKGROUND_UPLOAD_MIME_TYPES: Set[str] = IMAGE_MIME_TYPES

IMAGE_EXTENSIONS: Set[str] = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
}
CHAT_UPLOAD_EXTENSIONS: Set[str] = IMAGE_EXTENSIONS | {".pdf"}
BACKGROUND_UPLOAD_EXTENSIONS: Set[str] = IMAGE_EXTENSIONS

MIME_EXTENSION_MAP: Dict[str, Set[str]] = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/jpg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/gif": {".gif"},
    "image/webp": {".webp"},
    "image/bmp": {".bmp"},
    "application/pdf": {".pdf"},
}

SUSPICIOUS_PATTERNS = (b"<script", b"javascript:", b"onerror=", b"<?php", b"#!/")

# Optional base URL for serving uploaded media (e.g., CDN or site URL)
STORAGE_BASE_URL = os.getenv("STORAGE_BASE_URL") or None


def _sanitize_filename(filename: Optional[str]) -> str:
  candidate = (filename or "upload").strip()
  candidate = Path(candidate).name
  candidate = re.sub(r"[^A-Za-z0-9._-]", "_", candidate)
  while ".." in candidate:
    candidate = candidate.replace("..", "")
  if not candidate or candidate.startswith("."):
    candidate = "upload"
  return candidate[:255]


def _normalize_mime(mime: Optional[str]) -> str:
  if not mime:
    return ""
  normalized = mime.split(";")[0].strip().lower()
  if normalized == "image/jpg":
    return "image/jpeg"
  return normalized


def _sniff_mime_type(file_start: bytes) -> Optional[str]:
  if file_start[:4] == b"%PDF":
    return "application/pdf"
  if file_start[:4] == b"\x89PNG":
    return "image/png"
  if file_start[:2] == b"\xff\xd8":
    return "image/jpeg"
  if file_start[:6] in (b"GIF87a", b"GIF89a"):
    return "image/gif"
  if file_start[:4] == b"RIFF" and file_start[8:12] == b"WEBP":
    return "image/webp"
  if file_start[:2] == b"BM":
    return "image/bmp"
  lowered = file_start.lower()
  if lowered.lstrip().startswith(b"<svg"):
    return "image/svg+xml"
  return None


def _reject_if_suspicious(chunk: bytes) -> None:
  lowered = chunk.lower()
  for pattern in SUSPICIOUS_PATTERNS:
    if pattern in lowered:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="File contains suspicious or executable content.",
      )


def _scan_file_for_malware(storage_path: Path) -> None:
  if not CLAMAV_SCAN_ENABLED or not CLAMAV_SCAN_BINARY:
    return

  try:
    result = subprocess.run(
        [CLAMAV_SCAN_BINARY, "--no-summary", str(storage_path)],
        capture_output=True,
        text=True,
        timeout=CLAMAV_SCAN_TIMEOUT,
        check=False,
    )
  except FileNotFoundError:
    return
  except subprocess.TimeoutExpired:
    storage_path.unlink(missing_ok=True)
    raise HTTPException(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        detail="Antivirus scan timed out.",
    )

  if result.returncode == 0:
    return

  storage_path.unlink(missing_ok=True)

  if result.returncode == 1:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Upload failed antivirus scan.",
    )

  file_logger.warning(
      "Antivirus scan failed",
      extra={
          "event_type": "upload_scan_error",
          "path": str(storage_path),
          "stdout": result.stdout,
          "stderr": result.stderr,
          "returncode": result.returncode,
      },
  )
  raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail="Failed to scan file for malware.",
  )


def _ensure_storage_path(storage_name: str) -> Path:
  candidate = MEDIA_UPLOAD_ROOT / storage_name
  resolved_candidate = candidate.resolve()
  if not resolved_candidate.is_relative_to(MEDIA_UPLOAD_ROOT):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid storage target.",
    )
  if resolved_candidate.is_dir():
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid storage path.",
    )
  return resolved_candidate


def _resolve_storage_path_from_record(raw_path: str) -> Path:
  if not raw_path:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Attachment path is missing.",
    )
  candidate = Path(raw_path)
  if candidate.is_absolute():
    resolved = candidate.resolve()
  else:
    resolved = (MEDIA_UPLOAD_ROOT / candidate).resolve()
  if not resolved.is_relative_to(MEDIA_UPLOAD_ROOT):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Attachment path is invalid.",
    )
  if resolved.is_symlink():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Attachment file is no longer available.",
    )
  return resolved


async def _persist_upload_file(
    file: UploadFile,
    *,
    allowed_mime_types: Set[str],
    allowed_extensions: Set[str],
    max_size_bytes: int,
) -> Tuple[Path, str, int, str, str]:
  content_type = _normalize_mime(file.content_type)
  if not content_type or content_type not in allowed_mime_types:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported or missing content type.",
    )

  sanitized_name = _sanitize_filename(file.filename)
  extension = Path(sanitized_name).suffix.lower()
  if extension not in allowed_extensions:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid file extension: {extension or 'none provided'}",
    )

  storage_name = f"{uuid4().hex}{extension}"
  storage_path = _ensure_storage_path(storage_name)

  first_chunk = await file.read(UPLOAD_READ_CHUNK_SIZE)
  if not first_chunk:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Uploaded file is empty.",
    )

  sniffed_type = _normalize_mime(_sniff_mime_type(first_chunk))
  resolved_mime = content_type
  if sniffed_type:
    if sniffed_type not in allowed_mime_types:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="File content type is not allowed.",
      )
    expected_exts = MIME_EXTENSION_MAP.get(sniffed_type)
    if expected_exts and extension not in expected_exts:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="File extension does not match content.",
      )
    if content_type and content_type != sniffed_type:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Declared content type does not match file contents.",
      )
    resolved_mime = sniffed_type

  _reject_if_suspicious(first_chunk[:4096])

  bytes_written = 0
  inspect_remaining = max(0, 4096 - len(first_chunk))
  try:
    with storage_path.open("wb") as buffer:
      if len(first_chunk) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {max_size_bytes // (1024 * 1024)}MB.",
        )
      buffer.write(first_chunk)
      bytes_written += len(first_chunk)

      while True:
        chunk = await file.read(UPLOAD_READ_CHUNK_SIZE)
        if not chunk:
          break
        if bytes_written + len(chunk) > max_size_bytes:
          raise HTTPException(
              status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
              detail=f"File too large. Maximum size is {max_size_bytes // (1024 * 1024)}MB.",
          )
        if inspect_remaining > 0:
          _reject_if_suspicious(chunk[:inspect_remaining])
          inspect_remaining = max(0, inspect_remaining - len(chunk))
        buffer.write(chunk)
        bytes_written += len(chunk)
  except HTTPException:
    storage_path.unlink(missing_ok=True)
    raise
  except Exception as error:
    storage_path.unlink(missing_ok=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to store upload: {error}",
    ) from error
  finally:
    try:
      await file.close()
    except Exception:
      pass

  _scan_file_for_malware(storage_path)

  return storage_path, resolved_mime, bytes_written, sanitized_name, storage_name

SEARCH_TOOL = types.Tool(
    google_search=types.GoogleSearch(),
)

# URL Context Tool - allows AI to fetch and analyze content from URLs
URL_CONTEXT_TOOL = types.Tool(
    url_context=types.UrlContext(),
)

# Pattern to extract URLs from messages (excludes localhost/internal URLs)
URL_EXTRACTION_PATTERN = re.compile(r'https?://[^\s<>"{}|\\^`\[\]\(\)]+')
URL_CONTEXT_MODEL = "models/gemini-flash-lite-latest"  # Fast model for URL fetching

def _extract_urls_from_message(message: str) -> List[str]:
    """Extract URLs from a message for URL context processing.
    
    Returns up to 20 URLs (API limit), filtered to exclude internal/localhost URLs.
    """
    if not message:
        return []
    
    urls = URL_EXTRACTION_PATTERN.findall(message)
    # Filter out internal/localhost URLs
    filtered = [
        url for url in urls 
        if not any(x in url.lower() for x in ['localhost', '127.0.0.1', '0.0.0.0'])
    ]
    # API supports up to 20 URLs per request
    return filtered[:20]

# PLAN_TOOLS not included by default - added conditionally based on message intent
# CALENDAR_TOOLS removed from default - tool definitions add ~2s latency to OpenRouter
# This prevents the LLM from calling get_workspace_state on simple casual messages
DEFAULT_CHAT_TOOLS = [SEARCH_TOOL]

PROMPTS_DIR = ROOT_DIR / "backend" / "prompts"
GLOBAL_SYSTEM_PROMPTS_PATH = ROOT_DIR / "public" / "system-prompts.json"
ONBOARDING_PROMPT_PATH = PROMPTS_DIR / "onboarding.txt"


def _ensure_sqlite_columns(
    table: str,
    columns: List[Tuple[str, str, Optional[str]]],
    backfill_nulls: Optional[Dict[str, str]] = None,
) -> None:
    """
    Add missing columns to a SQLite table.

    Args:
        table: Table name
        columns: List of (column_name, column_type, default_value) tuples
        backfill_nulls: Optional dict of {column: default_value} for NULL backfill
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(f"PRAGMA table_info({table})")
            existing = {row[1] for row in cursor.fetchall()}
            added = False
            for col_name, col_type, default in columns:
                if col_name not in existing:
                    default_clause = f" DEFAULT {default}" if default is not None else ""
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}{default_clause}")
                    added = True
            if added:
                conn.commit()
            # Backfill NULLs if specified
            if backfill_nulls:
                updates = ", ".join(f"{col} = COALESCE({col}, {val})" for col, val in backfill_nulls.items())
                conn.execute(f"UPDATE {table} SET {updates}")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite migration failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def _ensure_sqlite_table(table: str, create_sql: str) -> None:
    """Create a SQLite table if it doesn't exist."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                conn.execute(create_sql)
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite table creation failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def _ensure_sqlite_index(table: str, index_name: str, column: str) -> None:
    """Create a SQLite index if it doesn't exist."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            # Check if table exists first
            cursor = conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                app_logger.info(f"Skipping index check; {table} table does not exist")
                return
            cursor = conn.execute(f"PRAGMA index_list({table})")
            indices = {row[1] for row in cursor.fetchall()}
            if index_name not in indices:
                app_logger.info(f"Creating missing index {index_name} on {table}.{column}")
                conn.execute(f"CREATE INDEX {index_name} ON {table} ({column})")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite index creation failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


# Run all SQLite migrations using the unified helpers
_ensure_sqlite_columns("users", [
    ("auth_user_id", "TEXT", None),
    ("has_seen_general_chat", "BOOLEAN", "0"),
    ("maps_enabled", "BOOLEAN", "0"),
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
    ("preferred_model", "TEXT", None),
], backfill_nulls={
    "has_seen_general_chat": "0",
    "maps_enabled": "0",
    "daily_token_usage": "0",
    "monthly_cost_usage": "0",
    "weekly_cost_usage": "0",
    "six_hour_cost_usage": "0",
    "daily_gemini_pro_usage": "0",
})

_ensure_sqlite_columns("user_data", [
    ("profile", "JSON", None),
    ("context", "JSON", None),
    ("metadata", "JSON", None),
    ("workspace_context", "TEXT", None),
])

_ensure_sqlite_table("general_chat_messages", """
    CREATE TABLE general_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_data_id INTEGER,
        role VARCHAR,
        content VARCHAR,
        grounding_metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
""")

_ensure_sqlite_index("user_chat_messages", "ix_user_chat_messages_thread_id", "thread_id")


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
OPENROUTER_LITE_MODEL = "x-ai/grok-4.1-fast"
GEMINI_DEFAULT_MODEL = os.getenv("GEMINI_DEFAULT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_LIGHT_MODEL = os.getenv("GEMINI_LIGHT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_PRO_MODEL = os.getenv("GEMINI_PRO_MODEL", "models/gemini-3-pro-preview")
REMINDER_FUNCTION_NAMES = (
    "create_reminder",
    "add_reminder",
    "update_reminder",
    "delete_reminder",
    "delete_latest_reminder",
    "list_reminders",
    "complete_onboarding",
)

# Shared keyword sets for tool/reminder detection
REMINDER_KEYWORDS = frozenset({
    "reminder", "remind", "ping", "nudge", "notify", "timer", "alarm", "alert",
    "goal", "plan", "habit", "schedule", "deadline", "due", "task", "todo",
})

TOOL_TRIGGER_KEYWORDS = REMINDER_KEYWORDS | frozenset({
    "meeting", "appointment", "call", "checkin", "check-in", "check in",
    "sync", "standup", "doctor", "dentist", "gym", "workout", "project", "routine",
    "at", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    # Time expressions to catch conversational follow-ups like "in 2 hours"
    "pm", "am", "hour", "hours", "minute", "minutes", "oclock", "o'clock",
})


def _needs_structured_tools(message: str) -> bool:
    """Check if message likely requires tool execution (reminders, calendar, etc).
    
    Uses word boundary matching to avoid false positives like 'at' matching 'cat'.
    """
    import re
    normalized = (message or "").lower()
    if not normalized:
        return False
    # Use word boundaries to match whole words only
    for kw in TOOL_TRIGGER_KEYWORDS:
        if re.search(rf'\b{re.escape(kw)}\b', normalized):
            return True
    return False


def _should_request_structured_reminders(message: str) -> bool:
    """Check if message specifically relates to reminder functionality.
    
    Uses word boundary matching to avoid false positives.
    """
    import re
    normalized = (message or "").lower()
    if not normalized:
        return False
    for kw in REMINDER_KEYWORDS:
        if re.search(rf'\b{re.escape(kw)}\b', normalized):
            return True
    return False


def _should_enable_search(message: str) -> bool:
    """Check if message implies a need for web search.
    
    Uses word boundary matching for specific keywords to avoid over-triggering.
    """
    import re
    keywords = {
        "search", "google", "find", "latest", "news", 
        "weather", "who", "what", "when", "where"
    }
    normalized = (message or "").lower()
    if not normalized:
        return False
        
    for kw in keywords:
        if re.search(rf'\\b{re.escape(kw)}\\b', normalized):
            return True
            
    return False


def _split_env_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _prefers_gemini_model(normalized_model: str) -> bool:
    """
    Determine if the requested model should route to Gemini.

    The frontend passes tier labels like "lite" and "pro" that we map to concrete
    Gemini models inside GeminiService. Treat those as Gemini hints so we don't
    accidentally send them to OpenRouter.
    """
    if not normalized_model:
        return False
    if normalized_model.startswith("models/") or normalized_model.startswith("gemini"):
        return True
    return normalized_model in {
        "pro",
        "gray-pro",
    }


def _materialize_structured_reminders(raw_text: str) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Attempt to parse a structured reminder payload of the form:
    { "message": "...", "reminders": [ { ...gray.reminder... } ] }
    OR a direct gray.reminder payload (single or list).
    Returns (text, reminders) where reminders is None on failure.
    """
    try:
        payload = json.loads(raw_text)
    except Exception:
        return raw_text, None

    # Handle list of gray.reminders
    if isinstance(payload, list):
        if payload and isinstance(payload[0], dict) and payload[0].get("type") == "gray.reminder":
            return "", payload
        return raw_text, None

    if not isinstance(payload, dict):
        return raw_text, None

    # Handle direct gray.reminder payload (single)
    if payload.get("type") == "gray.reminder":
        return "", [payload]

    message = payload.get("message")
    reminders = payload.get("reminders")
    if not isinstance(message, str):
        return raw_text, None
    if reminders is not None and not isinstance(reminders, list):
        return message, None
    return message, reminders if isinstance(reminders, list) else None


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
    # Security: Do not automatically allow other devices on the local network
    return set()


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

    # In production, do not include default localhost origins unless explicitly allowed
    if IS_PRODUCTION:
        default_origins = set()

    candidate_env_vars = [
        os.getenv("NEXT_PUBLIC_SITE_URL"),
        os.getenv("SITE_URL"),
        os.getenv("NEXT_PUBLIC_AUTH_REDIRECT"),
        os.getenv("FRONTEND_URL"),
    ]

    for candidate in candidate_env_vars:
        for variant in _origin_variants(candidate or ""):
            default_origins.add(variant)

    if not IS_PRODUCTION:
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
    # Security: Do not allow wildcard local network matching
    return None


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

if IS_PRODUCTION and not ALLOWED_ORIGINS and not ALLOWED_ORIGIN_REGEX:
    app_logger.error(
        "CORS misconfigured for production: no allowed origins found; set SITE_URL/NEXT_PUBLIC_SITE_URL or CORS_ALLOW_ORIGINS."
    )
    raise RuntimeError("CORS configuration missing in production")

def _fallback_title_from_message(message: str) -> str:
    trimmed = (message or "").strip()
    if not trimmed:
        return "New Chat"
    if len(trimmed) <= 30:
        return trimmed
    return f"{trimmed[:27].rstrip()}…"

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
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("title", sqlalchemy.String),
    sqlalchemy.Column("scope", sqlalchemy.String, default="thread"),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
    sqlalchemy.Column("updated_at", sqlalchemy.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
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




# Proactivity tracking







# Context caching for long context reuse


DEFAULT_WORKSPACE_BACKGROUNDS: List[Dict[str, Any]] = []

# Proactive notifications




google_calendar_states = sqlalchemy.Table(
    "google_calendar_states",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, index=True),
    sqlalchemy.Column("state_token", sqlalchemy.String, unique=True, nullable=False),
    sqlalchemy.Column("user_id", sqlalchemy.ForeignKey("users.id")),
    sqlalchemy.Column("nonce", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("redirect_uri", sqlalchemy.String, nullable=False),
    sqlalchemy.Column("expires_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("consumed_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, default=datetime.utcnow),
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
    personalization_system_prompt_override: Optional[str] = None
    personalization_show_calendar: Optional[bool] = True
    auth_user_id: Optional[str] = None  # Link to Supabase Auth UUID
    daily_token_usage: Optional[int] = 0
    monthly_cost_usage: Optional[float] = 0.0
    weekly_cost_usage: Optional[float] = 0.0
    six_hour_cost_usage: Optional[float] = 0.0
    preferred_model: Optional[str] = None

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
    personalization_system_prompt_override: Optional[str] = None
    personalization_show_calendar: Optional[bool] = None
    preferred_model: Optional[str] = None

class UsageStatus(BaseModel):
    tier: str
    monthly_usage: float
    monthly_limit: float
    is_monthly_limit_reached: bool
    next_monthly_reset: str
    six_hour_usage: float
    six_hour_limit: float
    is_six_hour_limit_reached: bool
    next_six_hour_reset: str

class User(UserBase):
    id: int
    initials: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    usage_status: Optional[UsageStatus] = None

    model_config = ConfigDict(from_attributes=True)


def _serialize_user_row(row: Mapping[str, Any]) -> Dict[str, Any]:
    """Normalize DB user rows for Pydantic response models."""
    user_dict = dict(row)
    if user_dict.get("auth_user_id") is not None:
        user_dict["auth_user_id"] = str(user_dict["auth_user_id"])
    return user_dict

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


class ProactivitySettingsUpdate(BaseModel):
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
    public_url: Optional[str] = None

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

# --- Payment Models ---
class PaymentRequest(BaseModel):
    plan_tier: str  # "voyager" or "pioneer"
    payment_type: str = "gopay" # gopay, bank_transfer, credit_card
    bank: Optional[str] = None # bca, bni, bri (required if payment_type is bank_transfer)
    token_id: Optional[str] = None # required if payment_type is credit_card

class PaymentChargeResponse(BaseModel):
    order_id: str
    status: str
    actions: Optional[List[Dict[str, Any]]] = None
    qr_code_url: Optional[str] = None
    deeplink_url: Optional[str] = None
    va_numbers: Optional[List[Dict[str, Any]]] = None
    redirect_url: Optional[str] = None # for 3DS


class MidtransNotification(BaseModel):
    transaction_time: str
    transaction_status: str
    transaction_id: str
    status_message: str
    status_code: str
    signature_key: str
    payment_type: str
    order_id: str
    merchant_id: str
    gross_amount: str
    fraud_status: str
    currency: str
    # Bank transfer specific
    va_numbers: Optional[List[Dict[str, Any]]] = None
    payment_amounts: Optional[List[Dict[str, Any]]] = None
    
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


# Removed _ensure_supabase_chat_tables helper as Supabase data usage is deprecated.

# Supabase setup
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


# =============================================================================
# Data storage configuration: Supabase is used for auth only.
# Plans, habits, reminders, and other user data are stored locally (SQLite/Postgres).
# To re-enable Supabase data storage, set supabase_data = supabase
supabase_data: Optional[Client] = None  # Disabled - use local storage only


_USER_DATA_CACHE: Dict[int, int] = {}
_USER_TIMEZONE_CACHE: Dict[int, Optional[str]] = {}


def _conversation_store_available() -> bool:
  return conversation_store._conversation_store_available()


def _disable_conversation_store(reason: str) -> None:
  conversation_store._disable_conversation_store(reason)


def _handle_conversation_store_error(context: str, error: Exception) -> None:
  conversation_store._handle_conversation_store_error(context, error)


def _handle_supabase_table_error(context: str, error: Exception) -> None:
    details = getattr(error, "message", None) or str(error)
    print(f"{context}: {details}")


def _general_conversation_user_id(conversation_id: Optional[str]) -> Optional[int]:
    return conversation_store._general_conversation_user_id(conversation_id)


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


async def _load_general_conversation_history(user_id: int) -> List[Dict[str, Any]]:
    # Only load from SQLite
    try:
        query = general_chat_messages.select().where(general_chat_messages.c.user_id == user_id).order_by(general_chat_messages.c.created_at.desc()).limit(100)
        rows = await database.fetch_all(query)
        
        local_history = []
        for row in reversed(rows):
            entry = {
                "role": row["role"],
                "text": row["content"],
            }
            if row["grounding_metadata"]:
                entry["grounding_metadata"] = _parse_json_field(row["grounding_metadata"]) if isinstance(row["grounding_metadata"], str) else row["grounding_metadata"]
            
            if row["created_at"]:
                entry["timestamp"] = int(row["created_at"].replace(tzinfo=timezone.utc).timestamp() * 1000)
            
            local_history.append(entry)
            
        return local_history
    except Exception as error:
        app_logger.error(
            "Failed to load general chat history from SQLite",
            extra={"event_type": "sqlite_history_load_error", "error": str(error)},
        )
        return []


async def _insert_general_conversation_message(
    *,
    user_id: int,
    role: str,
    text: str,
    grounding_metadata: Optional[Any] = None,
    attachments: Optional[Any] = None,
) -> Optional[int]:
    app_logger.debug(
        f"Inserting general chat message for user {user_id}, role={role}, text_len={len(text)}",
        extra={"event_type": "general_message_insert_start", "user_id": user_id, "role": role}
    )
    user_data_id = await _ensure_user_data_record(user_id)

    # Insert into SQLite
    try:
        effective_user_data_id = user_data_id if user_data_id is not None else user_id
        now = datetime.utcnow()
        query = """
            INSERT INTO general_chat_messages (user_id, user_data_id, role, content, grounding_metadata, created_at)
            VALUES (:user_id, :user_data_id, :role, :content, :grounding_metadata, :created_at)
        """
        values = {
            "user_id": user_id,
            "user_data_id": effective_user_data_id,
            "role": role,
            "content": text,
            "grounding_metadata": json.dumps(grounding_metadata) if grounding_metadata else None,
            "created_at": now.isoformat(),
        }
        result = await database.execute(query, values)
        app_logger.info(
            f"Successfully saved general chat message for user {user_id}, role={role}, id={result}",
            extra={"event_type": "general_message_insert_success", "user_id": user_id, "role": role, "message_id": result}
        )
        return result
    except Exception as error:
        app_logger.error(
            "Error saving general conversation message (SQLite)",
            extra={"event_type": "sqlite_message_insert_error", "error": str(error), "user_id": user_id},
        )
        return None


async def _replace_general_conversation_history(user_id: int, history: List[Dict[str, Any]]) -> None:
    app_logger.info(f"Replacing general history for user {user_id}", extra={"event_type": "general_history_replace_start", "history_length": len(history)})
    user_data_id = await _ensure_user_data_record(user_id)

    # Replace in SQLite
    try:
        # Delete existing
        await database.execute(
            general_chat_messages.delete().where(general_chat_messages.c.user_id == user_id)
        )
        # Insert new
        if history:
            effective_user_data_id = user_data_id if user_data_id is not None else user_id
            values_list = []
            for entry in history:
                values_list.append({
                    "user_id": user_id,
                    "user_data_id": effective_user_data_id,
                    "role": entry.get("role"),
                    "content": entry.get("text") or "",
                    "grounding_metadata": json.dumps(entry.get("grounding_metadata")) if entry.get("grounding_metadata") else None,
                    "created_at": datetime.utcnow(),
                })

            if values_list:
                # SQLite has a 999-parameter limit; chunk to avoid "too many SQL variables"
                query = general_chat_messages.insert()
                chunk_size = 150  # 150 * 5 columns = 750 params (< 999)
                for i in range(0, len(values_list), chunk_size):
                    chunk = values_list[i:i + chunk_size]
                    await database.execute_many(query, chunk)
    except Exception as error:
        app_logger.error(
            "Error replacing general conversation history (SQLite)",
            exc_info=error,
            extra={
                "event_type": "sqlite_history_replace_error",
                "error": str(error),
                "history_length": len(history) if history else 0,
            },
        )

    # 3. Invalidate Redis cache for General conversation
    try:
        from chat_cache import invalidate_conversation_cache
        import asyncio
        general_conv_id = f"general:{user_id}"
        asyncio.create_task(invalidate_conversation_cache(general_conv_id))
    except ImportError:
        pass  # Redis cache module not available


def _delete_general_conversation_history(user_id: int) -> None:
    # Local only; Supabase deletion no longer supported directly.
    pass


def _delete_supabase_user_records(user_id: int) -> None:
    """
    Backwards-compatible wrapper that delegates to the shared conversation_store
    implementation. Kept here so callers in main.py do not need to change.
    """
    delete_supabase_user_records(user_id)


async def _ensure_user_data_record(user_identifier: int) -> Optional[int]:
    """Return the user_data.id for the provided identifier, creating it if needed."""
    if user_identifier is None:
        return None

    # Import here to avoid circular dependency
    try:
        from backend.database import user_data, database
    except ImportError:
        from database import user_data, database

    cached = _USER_DATA_CACHE.get(user_identifier)
    if cached is not None:
        # Ensure the cached record still exists (e.g., after DB resets)
        existing_cached = await database.fetch_one(user_data.select().where(user_data.c.id == cached))
        if existing_cached:
            return cached
        _USER_DATA_CACHE.pop(user_identifier, None)

    try:
        # Try to fetch existing record
        query = user_data.select().where(user_data.c.user_identifier == user_identifier)
        row = await database.fetch_one(query)
        
        if row:
            user_data_id = row["id"]
            _USER_DATA_CACHE[user_identifier] = user_data_id
            return user_data_id
            
        # Create new record
        insert_query = user_data.insert().values(
            user_identifier=user_identifier,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        user_data_id = await database.execute(insert_query)
        
        if user_data_id:
            _USER_DATA_CACHE[user_identifier] = user_data_id
            return user_data_id
            
    except Exception as error:
        app_logger.error(f"Error ensuring user data record: {error}", extra={"event_type": "user_data_ensure_failed"})
        return None
    
    return None
    return None


# Removed _resolve_supabase_user_data_id and _require_supabase_user_data_id.


# Removed _ensure_supabase_thread_exists as Supabase data usage is deprecated.


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
            "error": str(e),
            **_payload_log_summary(candidate)
        })
        return None


def _payload_log_summary(payload: Any) -> Dict[str, Any]:
    """Summarize potentially sensitive payloads for safe logging."""
    if payload is None:
        return {"payload_present": False}
    if isinstance(payload, dict):
        return {
            "payload_present": True,
            "payload_keys": sorted(str(key) for key in payload.keys()),
            "payload_size": len(payload),
        }
    if isinstance(payload, list):
        return {"payload_present": True, "payload_size": len(payload)}
    if isinstance(payload, str):
        return {"payload_present": True, "payload_length": len(payload)}
    return {"payload_present": True, "payload_type": type(payload).__name__}


def _fetch_supabase_proactivity_settings(user_id: int) -> Optional[ProactivitySettings]:
    # Supabase is now auth-only. Data is stored in local SQLite.
    return None


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
    # Supabase is now auth-only. Data is stored in local SQLite.
    pass


def _timezone_from_time_context(time_context: str) -> Tuple[Optional[str], Optional[timezone]]:
    """
    Extract timezone information from a time_context string.
    Expected format: "... (timezone: Region/City, UTC+HH:MM) ..."
    Returns (timezone_label, timezone_object) or (None, timezone.utc)
    """
    if not time_context:
        return None, timezone.utc
        
    match = re.search(r"\(timezone:\s*([^,]+),", time_context)
    if match:
        tz_label = match.group(1).strip()
        try:
            # Try to load the timezone using zoneinfo
            tz = ZoneInfo(tz_label)
            return tz_label, tz
        except Exception:
            pass
            
    # Fallback/default
    return None, timezone.utc


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


def _ensure_datetime_value(value: Any) -> Optional[datetime]:
    """
    Normalize a datetime-like value to a naive UTC datetime for comparisons.
    Accepts datetime instances or ISO 8601 strings (with or without a trailing 'Z').
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            # Support a trailing 'Z' suffix as UTC.
            if text.endswith("Z"):
                dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(text)
        except Exception:
            # Best-effort fallback: drop subseconds/timezone if present.
            try:
                dt = datetime.fromisoformat(text.split(".")[0])
            except Exception as exc:
                raise ValueError(f"Unsupported datetime value: {value}") from exc
    else:
        raise TypeError(f"Unsupported datetime type: {type(value)!r}")

    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


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
        base_time = _ensure_datetime_value(match.group(1)) or datetime.utcnow()
    else:
        base_time = datetime.utcnow()

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
    results: List[Dict[str, Any]] = []
    now = datetime.utcnow()

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
            reminder_id = existing_reminder["id"]
            plan_id = existing_reminder.get("entity_id")

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
            results.append(
                {
                    "operation": "created",
                    "reminder": _serialize_reminder_row(row) if row is not None else None,
                }
            )

    return results


def _is_valid_uuid(val: Optional[Any]) -> bool:
    """Safely validate UUID strings without raising on None or non-string values."""
    if not isinstance(val, str) or not val:
        return False
    try:
        uuid_obj = UUID(val)
        return str(uuid_obj) == val
    except (ValueError, TypeError, AttributeError):
        return False



# FastAPI app
app = FastAPI(title="User Profile API with AI Chat", version="1.0.0")

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

# Initialize audit logger with database
try:
    from backend.audit_logger import init_audit_logger
except ImportError:
    from audit_logger import init_audit_logger

# Global proactivity services
proactivity_engine: Optional[ProactivityEngine] = None
proactivity_scheduler: Optional[ProactivitySchedulerManager] = None
proactivity_realtime_broker = ProactivityRealtimeBroker()



@app.on_event("startup")
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



@app.on_event("startup")
async def _run_basic_migrations():
    """Ensure critical SQLite columns exist."""
    _ensure_sqlite_columns(
        "user_streaks",
        [
            ("longest_streak", "INTEGER", "0"),
        ]
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
        ]
    )


@app.on_event("shutdown")
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

@app.on_event("startup")
async def _initialize_proactivity_engine():
    """Initialize the hybrid proactivity engine + scheduler."""
    global proactivity_engine, proactivity_scheduler

    try:
        proactivity_engine = ProactivityEngine(
            database,
            proactivity_realtime_broker,
            AI_MESSAGE_GENERATOR,
        )
        proactivity_scheduler = ProactivitySchedulerManager(proactivity_engine)
        await proactivity_scheduler.start()
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


def _parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.replace(tzinfo=None)


def _resolve_log_paths() -> Dict[str, Path]:
    candidates = [
        Path(__file__).resolve().parent / "logs",
        ROOT_DIR / "logs",
    ]
    for candidate in candidates:
        if candidate.exists():
            return {
                "app": candidate / "app.log",
                "error": candidate / "error.log",
            }
    fallback = ROOT_DIR / "logs"
    return {
        "app": fallback / "app.log",
        "error": fallback / "error.log",
    }


def _iter_log_entries(path: Path) -> Iterable[Dict[str, Any]]:
    if not path.exists():
        return
    try:
        with path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                raw = raw_line.strip()
                if not raw:
                    continue
                try:
                    parsed = json.loads(raw)
                except Exception:
                    continue
                if isinstance(parsed, dict):
                    yield parsed
    except FileNotFoundError:
        return


def _percentile(values: List[float], percentile: float) -> Optional[float]:
    if not values:
        return None
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (percentile / 100)
    floor_index = math.floor(k)
    ceil_index = math.ceil(k)
    if floor_index == ceil_index:
        return sorted_vals[int(k)]
    return sorted_vals[floor_index] + (sorted_vals[ceil_index] - sorted_vals[floor_index]) * (k - floor_index)


def _collect_latency_stats(since: Optional[datetime] = None) -> Dict[str, Any]:
    log_paths = _resolve_log_paths()
    app_log_path = log_paths["app"]
    latencies: List[float] = []
    for entry in _iter_log_entries(app_log_path):
        timestamp = _parse_iso_timestamp(entry.get("timestamp"))
        if since and timestamp and timestamp < since:
            continue
        if entry.get("event_type") == "chat_request_complete":
            total_ms = entry.get("total_time_ms")
            if isinstance(total_ms, (int, float)):
                latencies.append(float(total_ms))

    if not latencies:
        return {
            "count": 0,
            "p50_ms": None,
            "p95_ms": None,
            "under_5s_ratio": None,
            "log_path": str(app_log_path),
            "sample_since": since.isoformat() if since else None,
        }

    p50 = statistics.median(latencies)
    p95 = _percentile(latencies, 95)
    under_five_seconds = len([value for value in latencies if value <= 5000])

    return {
        "count": len(latencies),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2) if p95 is not None else None,
        "under_5s_ratio": round(under_five_seconds / len(latencies), 3),
        "log_path": str(app_log_path),
        "sample_since": since.isoformat() if since else None,
    }


def _count_error_entries(since: Optional[datetime] = None) -> Dict[str, Any]:
    log_paths = _resolve_log_paths()
    app_log_path = log_paths["app"]
    error_log_path = log_paths["error"]

    def _within_window(ts: Optional[datetime]) -> bool:
        if since is None:
            return True
        if ts is None:
            return True
        return ts >= since

    error_log_entries = 0
    error_log_client_server = 0
    for entry in _iter_log_entries(error_log_path):
        timestamp = _parse_iso_timestamp(entry.get("timestamp"))
        if not _within_window(timestamp):
            continue
        error_log_entries += 1
        status_code = entry.get("status_code") or entry.get("status")
        message = str(entry.get("message") or "")
        if isinstance(status_code, int) and status_code >= 400:
            error_log_client_server += 1
        elif " 400" in message or " 500" in message or "400 Bad Request" in message or "500" in message:
            error_log_client_server += 1

    http_error_entries = 0
    for entry in _iter_log_entries(app_log_path):
        timestamp = _parse_iso_timestamp(entry.get("timestamp"))
        if not _within_window(timestamp):
            continue
        status_code = entry.get("status_code") or entry.get("status")
        if isinstance(status_code, int) and status_code >= 400:
            http_error_entries += 1

    return {
        "since": since.isoformat() if since else None,
        "error_log_entries": error_log_entries,
        "client_server_like_errors": error_log_client_server + http_error_entries,
        "http_error_entries": http_error_entries,
        "app_log_path": str(app_log_path),
        "error_log_path": str(error_log_path),
    }


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


def _coerce_streak_label_value(*, streak_days: Any = None, streak_label: Any = None) -> str:
    """Force streak labels to a numeric string (e.g., '3') to keep bot outputs consistent."""

    def _parse_candidate(value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            trimmed = value.strip()
            if not trimmed:
                return None
            match = re.search(r"-?\d+", trimmed)
            if match:
                try:
                    return int(match.group(0))
                except ValueError:
                    return None
        return None

    for candidate in (streak_days, streak_label):
        parsed = _parse_candidate(candidate)
        if parsed is not None:
            return str(max(parsed, 0))
    return "0"


def _serialize_habit_record(record: Any) -> Dict[str, Any]:
    """Ensure habits always have string labels for response models."""
    if record is None:
        return {}
    if not isinstance(record, dict):
        try:
            record = dict(record)
        except Exception:
            return {}

    def _as_str(value: Any) -> str:
        if value is None:
            return ""
        return str(value)

    return {
        "id": record.get("id"),
        "user_id": record.get("user_id"),
        "label": _as_str(record.get("label")),
        "streak_label": _as_str(record.get("streak_label")),
        "previous_label": _as_str(record.get("previous_label")),
        "description": record.get("description"),
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
    }


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


def _candidate_text(candidate: Any) -> str:
    """Join all non-thought text parts from a Gemini candidate.
    
    Excludes parts with thought=True so they can be handled separately
    by _candidate_thought and displayed in the thinking UI.
    """
    content = getattr(candidate, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return ""
    # Exclude thought parts - they're handled separately for the thinking UI
    return "".join(
        getattr(part, "text", "") 
        for part in parts 
        if getattr(part, "text", None) and not getattr(part, "thought", False)
    )


def _candidate_thought(candidate: Any) -> Optional[str]:
    """Extract thinking/thought content from a Gemini candidate when reasoning mode is used.
    
    Per Gemini API docs: parts with thought=True contain the thought summary text.
    The 'thought' attribute is a boolean flag, and the actual text is in 'text'.
    """
    content = getattr(candidate, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return None
    thoughts = []
    for part in parts:
        # Check for 'thought' boolean attribute (Gemini thinking mode)
        # When thought=True, the text in this part is the thought summary
        is_thought = getattr(part, "thought", False)
        text = getattr(part, "text", None)
        if is_thought and text:
            thoughts.append(str(text))
        
    return "\n".join(thoughts) if thoughts else None


async def _should_use_web_search(message: str, model: Optional[str]) -> bool:
    """
    Use lightweight local heuristics to decide whether this message likely
    needs up-to-date information from the public web.

    Uses local keyword matching for fast classification without network calls.
    """
    trimmed = (message or "").strip()
    if not trimmed:
        return False

    normalized = trimmed.lower()

    # Obvious "live data" phrases – news, markets, prices, weather, etc.
    live_keywords = [
        "breaking news",
        "latest news",
        "recent news",
        "current events",
        "today's news",
        "stock price",
        "stock prices",
        "stock market",
        "crypto price",
        "bitcoin price",
        "btc price",
        "eth price",
        "exchange rate",
        "currency rate",
        "interest rate",
        "inflation rate",
        "weather",
        "forecast",
        "temperature today",
        "traffic",
        "flight status",
        "train status",
        "nba score",
        "nfl score",
        "soccer score",
        "game score",
        "release date",
        "new version",
        "new update",
        "patch notes",
    ]
    if any(keyword in normalized for keyword in live_keywords):
        return True

    # Generic recency cues ("today", "right now", "this week", etc.).
    recency_tokens = [
        "today",
        "right now",
        "currently",
        "this week",
        "this month",
        "this year",
        "latest",
        "recent",
        "up to date",
        "up-to-date",
    ]
    if any(token in normalized for token in recency_tokens):
        return True

    # Questions explicitly about something "happening" now.
    if "what's happening" in normalized or "whats happening" in normalized:
        return True

    # Simple year-based heuristic: questions that mention a near-future or
    # current year along with "news" or "update" are likely live.
    if re.search(r"\b(202[3-9]|203[0-9])\b", normalized) and any(
        phrase in normalized for phrase in ("news", "update", "updates", "trending")
    ):
        return True

    return False


async def _gemini_web_search_summary(
    question: str,
    workspace_context: Optional[str],
    time_context: Optional[str],
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Use Gemini Flash Lite + Google Search to build a concise web summary."""
    if not GEMINI_SERVICE or not GEMINI_SERVICE.available:
        return "", None

    summary_system_prompt = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "web_search_summary",
        "Summarize the key facts from the search results."
    )

    try:
        response = await GEMINI_SERVICE.generate(
            question,
            conversation_history=None,
            workspace_context=workspace_context,
            system_prompt=summary_system_prompt,
            time_context=time_context,
            model=GEMINI_LIGHT_MODEL,
            attachments=None,
            extra_contents=None,
            response_schema=None,
            response_mime_type=None,
            tools=[SEARCH_TOOL],
            tool_config=None,
            reasoning_mode=False,
        )
    except Exception as error:  # pragma: no cover - best effort logging
        api_logger.warning(
            "Gemini web search summary failed; continuing without web context",
            extra={"event_type": "gemini_web_search_error", "error": str(error)},
        )
        return "", None

    if not response.candidates:
        return "", None

    candidate = response.candidates[0]
    summary_text = _candidate_text(candidate)
    grounding = _candidate_grounding_payload(candidate)
    return summary_text.strip(), grounding


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


SYSTEM_PROMPT_PATH = GLOBAL_SYSTEM_PROMPTS_PATH


async def _generate_chat_title_async(
    conversation_id: str,
    message: str,
    response_text: str,
) -> None:
    """
    Generate a concise title for the conversation using a lightweight model
    in the background, then update the database.
    """
    if not GEMINI_SERVICE or not GEMINI_SERVICE.available:
        return

    # Load prompt from JSON or fallback
    prompt_template = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "title_generation",
        "Analyze the following conversation and generate a concise, descriptive title (under 25 characters, 3-5 words max). Output ONLY the title text, no tags or quotes."
    )

    # Construct a minimal transcript for the title model
    transcript = f"User: {message}\nAssistant: {response_text}"
    
    try:
        # Use the configured light model (e.g. Gemini Flash Lite)
        response = await GEMINI_SERVICE.generate(
            message=f"{prompt_template}\n\n{transcript}",
            conversation_history=None,
            workspace_context=None,
            system_prompt=load_prompt_from_json(
                GLOBAL_SYSTEM_PROMPTS_PATH,
                "title_generation",
                "Generate a concise title.",
            ),
            time_context=None,
            model=GEMINI_LIGHT_MODEL,
        )
        
        # Extract and clean title
        if response and response.candidates:
            raw_title = _candidate_text(response.candidates[0]).strip()
            # Remove any accidental quotes or tags
            clean_title = re.sub(r'^["\']|["\']$', '', raw_title)
            clean_title = re.sub(r'<[^>]+>', '', clean_title).strip()
            
            if clean_title:
                await _update_conversation_title(conversation_id, clean_title)

    except Exception as e:
        api_logger.warning(
            f"Background title generation failed for {conversation_id}: {e}",
            extra={"event_type": "title_generation_error"}
        )


async def _generate_chat_title_inline(
    message: str,
    response_text: str,
) -> Optional[str]:
    """
    Generate a concise title for the conversation using a lightweight model.
    Returns the generated title or None if generation fails.
    This is called inline (blocking) so the SSE end event can include the title.
    """
    if not GEMINI_SERVICE or not GEMINI_SERVICE.available:
        return None

    # Load prompt from JSON or fallback
    prompt_template = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "title_generation",
        "Analyze the following conversation and generate a concise, descriptive title (under 25 characters, 3-5 words max). Output ONLY the title text, no tags or quotes."
    )

    # Construct a minimal transcript for the title model
    transcript = f"User: {message}\nAssistant: {response_text}"
    
    try:
        # Use the configured light model (e.g. Gemini Flash Lite)
        response = await GEMINI_SERVICE.generate(
            message=f"{prompt_template}\n\n{transcript}",
            conversation_history=None,
            workspace_context=None,
            system_prompt=load_prompt_from_json(
                GLOBAL_SYSTEM_PROMPTS_PATH,
                "title_generation",
                "Generate a concise title.",
            ),
            time_context=None,
            model=GEMINI_LIGHT_MODEL,
        )
        
        # Extract and clean title
        if response and response.candidates:
            raw_title = _candidate_text(response.candidates[0]).strip()
            # Remove any accidental quotes or tags
            clean_title = re.sub(r'^["\']|["\']$', '', raw_title)
            clean_title = re.sub(r'<[^>]+>', '', clean_title).strip()
            
            if clean_title:
                return clean_title

    except Exception as e:
        api_logger.warning(
            f"Inline title generation failed: {e}",
            extra={"event_type": "title_generation_error"}
        )

    return None


def _merge_extra_contents(*lists: Optional[List[types.Content]]) -> Optional[List[types.Content]]:
  merged: List[types.Content] = []
  for candidate in lists:
    if candidate:
      merged.extend(candidate)
  return merged or None


def _normalize_conversation_history(history: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Thin wrapper around core.chat_history.normalize_conversation_history."""
    return normalize_conversation_history(history)


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

  safe_path = _resolve_storage_path_from_record(str(file_path))
  if not safe_path.exists():
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="File no longer available for search indexing.",
    )

  def _log_failure(suffix: str, error: Exception) -> None:
    print(f"[FileSearch] Failed to upload {safe_path.name} to {store_name}{suffix}: {error}")

  last_error: Optional[Exception] = None
  for chunking_config in (FILE_SEARCH_CHUNKING_CONFIG, None):
    try:
      operation = await FILE_SEARCH_SERVICE.upload_to_store(
          file_path=str(safe_path),
          store_name=store_name,
          display_name=display_name,
          chunking_config=chunking_config,
      )
      await _wait_for_operation(operation)
      return
    except Exception as error:  # pragma: no cover - best effort logging
      last_error = error
      # Try fallback config; suppress noisy duplicate logs
      continue

  if last_error:
    _log_failure(" (upload failed after retries)", last_error)


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


async def _list_plans_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    limit = args.get("limit")
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"plans": [dict(row) for row in rows]}


async def _list_habits_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    limit = args.get("limit")
    
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"habits": [_serialize_habit_record(row) for row in rows]}


async def _create_habit_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    label = args.get("label")
    if not label:
        return {"error": "label is required"}
    
    streak_value = _coerce_streak_label_value(
        streak_days=args.get("streak_days"),
        streak_label=args.get("streak_label"),
    )

    now = datetime.utcnow()
    base_values = {
        "user_id": user_id,
        "label": str(label),
        "description": args.get("description"),
        "streak_label": streak_value,
        "previous_label": args.get("previous_label") or "",
    }
    
    habit_id = await db.execute(
        habits.insert().values(
            **base_values,
            created_at=now,
            updated_at=now,
        )
    )
    created = await db.fetch_one(habits.select().where(habits.c.id == habit_id))
    return _build_reminder_payload(dict(created), user_id, "created", entity="habit")


async def _update_habit_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    habit_id = args.get("habit_id")
    if not habit_id:
        return {"error": "habit_id is required"}
    
    updates = {}
    if "label" in args:
        updates["label"] = args["label"]
    if "description" in args:
        updates["description"] = args["description"]
    if "streak_days" in args or "streak_label" in args:
        updates["streak_label"] = _coerce_streak_label_value(
            streak_days=args.get("streak_days"),
            streak_label=args.get("streak_label"),
        )
        
    if not updates:
        return {"status": "no_change", "message": "No updates provided."}
        
    now = datetime.utcnow()
    
    updates["updated_at"] = now
    await db.execute(
        habits.update()
        .where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
        .values(**updates)
    )
    return {"status": "success", "message": f"Habit {habit_id} updated."}


async def _delete_habit_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    habit_id = args.get("habit_id")
    if not habit_id:
        return {"error": "habit_id is required"}
        
    await db.execute(
        habits.delete().where((habits.c.id == habit_id) & (habits.c.user_id == user_id))
    )
    return {"status": "success", "message": f"Habit {habit_id} deleted."}



async def _create_reminder_tool(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
) -> Dict[str, Any]:
    label = args.get("label")
    remind_at_str = args.get("remind_at")
    description = args.get("description")
    
    if not label or not remind_at_str:
        raise HTTPException(status_code=400, detail="label and remind_at are required")
    
    # Parse remind_at as a simple ISO 8601 datetime string.
    try:
        remind_at_dt = datetime.fromisoformat(str(remind_at_str).replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid remind_at format, use ISO 8601.",
        )
    
    now = datetime.utcnow()
    
    base_data = {
        "user_id": user_id,
        "label": label,
        "description": description,
        "status": "pending",
        "delivery_mode": "reminder",
        "entity_type": "plan",
    }
    
    local_payload = {
        **base_data,
        "remind_at": remind_at_dt,
        "created_at": now,
        "updated_at": now,
    }
    query = reminders.insert().values(**local_payload)
    result = await db.execute(query)
    created_id = result
    created = await db.fetch_one(reminders.select().where(reminders.c.id == created_id))
    return _build_reminder_payload(dict(created), user_id, "created")


async def _update_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    reminder_id = args.get("reminder_id")
    if not reminder_id:
        raise HTTPException(status_code=400, detail="reminder_id is required")
    
    updates = {}
    if "label" in args:
        updates["label"] = args["label"]
    if "description" in args:
        updates["description"] = args["description"]
    if "status" in args:
        updates["status"] = args["status"]
    if "remind_at" in args:
        try:
            remind_at_dt = datetime.fromisoformat(args["remind_at"].replace("Z", "+00:00"))
            updates["remind_at"] = remind_at_dt
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid remind_at format")
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    query = (
        reminders.update()
        .where(reminders.c.id == reminder_id)
        .where(reminders.c.user_id == user_id)
        .values(**updates)
    )
    await db.execute(query)
    updated = await db.fetch_one(
        reminders.select().where(reminders.c.id == reminder_id)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _build_reminder_payload(dict(updated), user_id, "updated")


async def _delete_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    reminder_id = args.get("reminder_id")
    if not reminder_id:
        raise HTTPException(status_code=400, detail="reminder_id is required")
    
    reminder = await db.fetch_one(
        reminders.select()
        .where(reminders.c.id == reminder_id)
        .where(reminders.c.user_id == user_id)
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    query = (
        reminders.delete()
        .where(reminders.c.id == reminder_id)
        .where(reminders.c.user_id == user_id)
    )
    await db.execute(query)
    return _build_reminder_payload(dict(reminder), user_id, "deleted")


async def _delete_latest_reminder_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    """
    Delete the most recent reminder for the user, optionally filtering by a label substring or time window.
    Checks Supabase first, then falls back to local database.
    """
    label_substring = (args.get("label_substring") or "").strip()
    remind_before = args.get("remind_before")
    remind_after = args.get("remind_after")
    status_filter = (args.get("status") or "").strip()
    delete_all = args.get("delete_all", False)

    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

    before_dt = _parse_dt(remind_before)
    after_dt = _parse_dt(remind_after)

    # Fallback to local database
    query = reminders.select().where(reminders.c.user_id == user_id)

    if label_substring:
        query = query.where(reminders.c.label.ilike(f"%{label_substring}%"))

    if before_dt:
        query = query.where(reminders.c.remind_at <= before_dt)
    if after_dt:
        query = query.where(reminders.c.remind_at >= after_dt)

    if status_filter:
        query = query.where(reminders.c.status == status_filter)
    else:
        query = query.where(reminders.c.status.in_(["pending", "delivered"]))

    query = query.order_by(reminders.c.created_at.desc(), reminders.c.id.desc())
    
    if not delete_all:
        query = query.limit(1)

    records = await db.fetch_all(query)
    if not records:
        raise HTTPException(status_code=404, detail="No matching reminder found to delete.")

    deleted_messages = []
    for record in records:
        reminder_id = record["id"]
        reminder_label = record.get("label")
        reminder_time = record.get("remind_at")

        await db.execute(
            reminders.delete().where((reminders.c.id == reminder_id) & (reminders.c.user_id == user_id))
        )

        summary_parts = [f"Deleted reminder {reminder_id}"]
        if reminder_label:
            summary_parts.append(f'"{reminder_label}"')
        if isinstance(reminder_time, datetime):
            summary_parts.append(f"at {reminder_time.isoformat()}")
        deleted_messages.append(" ".join(summary_parts))

    if delete_all:
        return {"status": "success", "message": f"Deleted {len(records)} reminder(s)", "details": deleted_messages}
    return {"status": "success", "message": deleted_messages[0]}

def _build_reminder_payload(reminder: Dict[str, Any], user_id: int, status: str, entity: str = "plan") -> Dict[str, Any]:
    """Build a gray.reminder payload compatible with the frontend."""
    reminder_id = reminder.get("id")
    label = reminder.get("label", "Reminder")
    remind_at = reminder.get("remind_at") or reminder.get("deadline")
    description = reminder.get("description")
    
    # Convert remind_at to ISO string if it's a datetime
    time_iso = None
    if remind_at:
        if isinstance(remind_at, datetime):
            if remind_at.tzinfo is None:
                remind_at = remind_at.replace(tzinfo=timezone.utc)
            time_iso = remind_at.isoformat()
        elif isinstance(remind_at, str):
            time_iso = remind_at
    
    # Convert any remaining datetime objects in raw data to strings for JSON safety
    safe_raw = {}
    for k, v in reminder.items():
        if isinstance(v, (datetime, date)):
             safe_raw[k] = v.isoformat()
        else:
             safe_raw[k] = v

    return {
        "type": "gray.reminder",
        "source": "native/backend",
        "status": status,
        "entity": entity,
        "delivery_mode": reminder.get("delivery_mode", entity),
        "data": {
            "id": reminder_id,
            "user_id": user_id,
            "label": label,
            "time_iso": time_iso,
            "raw": safe_raw,
        },
    }



async def _list_reminders_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    status_filter = args.get("status")
    limit = args.get("limit")
    delivery_mode = args.get("delivery_mode")
    entity_type = args.get("entity_type")
    include_archived = bool(args.get("include_archived"))

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
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return {"reminders": [_serialize_reminder_row(row) for row in rows]}


async def _get_workspace_state_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    plan_limit = args.get("plan_limit") or None
    habit_limit = args.get("habit_limit") or None
    reminder_limit = args.get("reminder_limit") or None
    include_archived_reminders = bool(args.get("include_archived_reminders"))

    plans_payload = await _list_plans_tool(user_id, {"limit": plan_limit}, db)
    habits_payload = await _list_habits_tool(user_id, {"limit": habit_limit}, db)
    reminders_payload = await _list_reminders_tool(
        user_id,
        {
            "limit": reminder_limit,
            "include_archived": include_archived_reminders,
        },
        db,
    )

    plans_list = plans_payload.get("plans") or []
    habits_list = habits_payload.get("habits") or []
    reminders_list = reminders_payload.get("reminders") or []
    pending_reminders = [
        reminder for reminder in reminders_list if str(reminder.get("status", "")).lower() == "pending"
    ]

    summary_parts: List[str] = []
    summary_parts.append(f"{len(plans_list)} plans")
    summary_parts.append(f"{len(habits_list)} habits")
    summary_parts.append(f"{len(reminders_list)} reminders ({len(pending_reminders)} pending)")

    return {
        "summary": " | ".join(summary_parts),
        "plans": plans_list,
        "habits": habits_list,
        "reminders": reminders_list,
    }


async def _create_plan_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    label = args.get("label")
    if not label:
        return {"error": "label is required"}
    
    base_values = {
        "user_id": user_id,
        "label": label,
        "completed": False,
        "deadline": args.get("deadline"),
        "schedule_slot": args.get("schedule_slot"),
        "description": args.get("description"),
    }
    
    now = datetime.utcnow()
    plan_id = await db.execute(
        plans.insert().values(
            **base_values,
            created_at=now,
            updated_at=now,
        )
    )
    created = await db.fetch_one(plans.select().where(plans.c.id == plan_id))
    return _build_reminder_payload(dict(created), user_id, "created", entity="plan")


async def _update_plan_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    plan_id = args.get("plan_id")
    if not plan_id:
        return {"error": "plan_id is required"}
        
    updates = {}
    if "label" in args:
        updates["label"] = args["label"]
    if "description" in args:
        updates["description"] = args["description"]
    if "completed" in args:
        updates["completed"] = args["completed"]
    if "deadline" in args:
        updates["deadline"] = args["deadline"]
    if "schedule_slot" in args:
        updates["schedule_slot"] = args["schedule_slot"]
        
    if not updates:
        return {"status": "no_changes", "message": "No updates provided."}
        
    # Verify ownership locally
    check_query = plans.select().where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Plan not found or access denied."}

    updates["updated_at"] = datetime.utcnow()
    query = plans.update().where(plans.c.id == plan_id).values(**updates)
    await db.execute(query)
    return {"status": "success", "message": "Plan updated."}


async def _delete_plan_tool(user_id: int, args: Dict[str, Any], db: databases.Database) -> Dict[str, Any]:
    plan_id = args.get("plan_id")
    if not plan_id:
        return {"error": "plan_id is required"}
        
    # Verify ownership locally
    check_query = plans.select().where((plans.c.id == plan_id) & (plans.c.user_id == user_id))
    existing = await db.fetch_one(check_query)
    if not existing:
        return {"error": "Plan not found or access denied."}

    query = plans.delete().where(plans.c.id == plan_id)
    await db.execute(query)
    return {"status": "success", "message": "Plan deleted."}


async def _complete_onboarding(
    user_id: int,
    args: Dict[str, Any],
    db: databases.Database,
    *,
    user_timezone: Optional[str] = None,
) -> Dict[str, Any]:
    # Some providers wrap tool arguments (e.g. {"tool": "...", "arguments": {...}})
    # or use a "params" key. Normalize to the innermost argument dict.
    if isinstance(args, dict):
        nested = args.get("arguments") or args.get("params")
        if isinstance(nested, dict):
            args = nested

    def clean(value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    nickname = clean(args.get("nickname") or args.get("name"))
    occupation = clean(args.get("occupation"))
    # Accept multiple synonyms for the user's self-description so different
    # onboarding prompts / tool schemas still map correctly.
    about = clean(args.get("about") or args.get("about_you") or args.get("blurb"))
    core_blocker = clean(args.get("core_blocker"))

    # If the tool was invoked with no meaningful fields at all (e.g. a
    # malformed or empty arguments object), ignore it instead of marking
    # onboarding complete with a blank profile.
    if not any([nickname, occupation, about, core_blocker]):
        api_logger.warning(
            "complete_onboarding called without core fields; ignoring",
            extra={"event_type": "onboarding_tool_ignored", "user_id": user_id},
        )
        return {"status": "ignored", "message": "Onboarding tool called without any profile details."}

    about_parts: List[str] = []
    if about:
        about_parts.append(about)
    if core_blocker:
        about_parts.append(f"Core blocker: {core_blocker}")

    updates: Dict[str, Any] = {
        "has_seen_general_chat": True,
        "updated_at": datetime.utcnow(),
    }
    if nickname is not None:
        updates["personalization_nickname"] = nickname
    if occupation is not None:
        updates["personalization_occupation"] = occupation
    if about_parts:
        updates["personalization_about"] = "\n\n".join(about_parts)

    await db.execute(users.update().where(users.c.id == user_id).values(**updates))

    # Invalidate cache so the new has_seen_general_chat status is picked up immediately
    USER_CACHE.invalidate(f"user_{user_id}")
    
    # Also invalidate auth cache to prevent stale current_user in subsequent requests
    try:
        updated_user = await db.fetch_one(users.select().where(users.c.id == user_id))
        if updated_user and updated_user["auth_user_id"]:
            invalidate_user_cache(str(updated_user["auth_user_id"]))
    except Exception as exc:
        api_logger.warning(f"Failed to invalidate auth cache for user {user_id}: {exc}")

    # Optional: initialize proactivity settings from onboarding responses.
    def normalize_cadence(raw: Optional[str]) -> Optional[str]:
        if not raw:
            return None
        text = raw.strip().lower()
        if not text:
            return None
        if "frequent" in text or "3x" in text or "3 times" in text:
            return "frequent"
        if "daily" in text or "every day" in text or "weekly" in text or "once a week" in text:
            # Weekly is mapped to daily (weekly cadence removed)
            return "daily"
        if "manual" in text or "off" in text or "never" in text:
            return "manual"
        return "custom"

    raw_cadence = clean(args.get("proactivity_cadence") or args.get("cadence"))
    cadence = normalize_cadence(raw_cadence)
    if cadence:
        time_value = clean(
            args.get("proactivity_time")
            or args.get("proactivity_time_of_day")
            or args.get("checkin_time")
        )
        timezone = clean(args.get("proactivity_timezone")) or clean(user_timezone)

        # Default to a reasonable morning check-in if no time is provided and cadence is active.
        if cadence != "manual" and not time_value:
            time_value = "09:00"

        settings_payload: Dict[str, Any] = {
            "id": "proactivity-1",
            "label": "Check-ins",
            "description": "Onboarding check-ins",
            "cadence": cadence,
        }
        
        # Set check-in times based on cadence
        if cadence == "frequent":
            # Frequent: 9am, 15pm, 18pm
            settings_payload["times"] = ["09:00", "15:00", "18:00"]
        elif cadence == "daily":
            # Daily: 9am (or user-specified time)
            settings_payload["time"] = time_value or "09:00"
        elif time_value:
            # Custom or other cadences: use provided time
            settings_payload["time"] = time_value
            
        if timezone:
            settings_payload["timezone"] = timezone

        now = datetime.utcnow()
        try:
            existing = await db.fetch_one(
                proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
            )
            if existing:
                await db.execute(
                    proactivity_settings.update()
                    .where(proactivity_settings.c.user_id == user_id)
                    .values(payload=settings_payload, updated_at=now)
                )
            else:
                await db.execute(
                    proactivity_settings.insert().values(
                        user_id=user_id,
                        payload=settings_payload,
                        created_at=now,
                        updated_at=now,
                    )
                )
        except Exception as db_error:
            api_logger.error(
                f"Database error saving proactivity settings from onboarding: {db_error}",
                exc_info=True,
                extra={
                    "event_type": "proactivity_settings_onboarding_db_error",
                    "user_id": user_id,
                    "error": str(db_error),
                    **_payload_log_summary(settings_payload),
                },
            )
        else:
            try:
                _upsert_supabase_proactivity_settings(user_id, settings_payload)
            except Exception as supabase_error:
                api_logger.warning(
                    f"Failed to sync onboarding proactivity settings to Supabase: {supabase_error}",
                    extra={
                        "event_type": "proactivity_settings_onboarding_supabase_error",
                        "user_id": user_id,
                        "error": str(supabase_error),
                        **_payload_log_summary(settings_payload),
                    },
                )

            # Keep timezone cache and scheduler in sync with onboarding decisions.
            if timezone:
                _USER_TIMEZONE_CACHE[user_id] = timezone
            if proactivity_scheduler:
                try:
                    await proactivity_scheduler.refresh_jobs(user_id)
                except Exception as scheduler_error:
                    api_logger.warning(
                        f"Failed to refresh proactivity scheduler jobs after onboarding: {scheduler_error}",
                        extra={
                            "event_type": "proactivity_scheduler_onboarding_refresh_error",
                            "user_id": user_id,
                            "error": str(scheduler_error),
                        },
                    )

    return {"status": "success", "message": "Onboarding completed."}

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
                
                # Check if onboarding was completed
                if tool_name == "complete_onboarding":
                    onboarding_completed = True
                    break  # Don't continue after onboarding
                
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
        storage_path_value = record["storage_path"]
        storage_path = _resolve_storage_path_from_record(str(storage_path_value))
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


async def _generate_image_descriptions(
    attachments: List[GeminiAttachment],
) -> str:
    """Generate text descriptions of images using Gemini Flash Lite.
    
    This is used when sending messages to non-vision models (like DeepSeek)
    so they can understand what images the user sent.
    
    Args:
        attachments: List of GeminiAttachment objects with image data
        
    Returns:
        A formatted string with image descriptions, or empty string if no images
    """
    if not attachments or not GEMINI_SERVICE.available:
        return ""
    
    # Filter to only image attachments
    image_attachments = [
        a for a in attachments 
        if a.mime_type and a.mime_type.startswith("image/")
    ]
    if not image_attachments:
        return ""
    
    descriptions = []
    for i, attachment in enumerate(image_attachments, 1):
        try:
            # Use Gemini Flash Lite for fast, cheap description
            response = await GEMINI_SERVICE.generate(
                message="Describe this image in 2-3 sentences. Focus on the key visual elements, any text visible, and the overall context. Be concise but informative.",
                conversation_history=None,
                workspace_context=None,
                system_prompt="You are an image description assistant. Provide concise, accurate descriptions of images. Do not add any preamble like 'This image shows' - just describe what you see directly.",
                time_context=None,
                model=GEMINI_LIGHT_MODEL,
                attachments=[attachment],
            )
            
            if response.candidates:
                text = _candidate_text(response.candidates[0])
                if text:
                    filename = attachment.filename or f"Image {i}"
                    descriptions.append(f"[{filename}]: {text.strip()}")
                    api_logger.info(
                        f"Generated image description for {filename}",
                        extra={"event_type": "image_description_generated", "filename": filename}
                    )
        except Exception as e:
            api_logger.warning(
                f"Failed to generate image description: {e}",
                extra={"event_type": "image_description_error", "error": str(e)}
            )
            continue
    
    if descriptions:
        header = "[User attached images - descriptions for context]"
        footer = "[End of image descriptions]"
        return f"{header}\n" + "\n".join(descriptions) + f"\n{footer}\n\n"
    return ""


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
    try:
        query = (
            proactivity_logs.select()
            .where(proactivity_logs.c.user_id == user_id)
            .order_by(proactivity_logs.c.activity_date.desc())
        )
        rows = await db.fetch_all(query)
    except Exception as error:
        logger.error(f"Failed to fetch proactivity logs from SQLite for user {user_id}: {error}")
        return {"current_streak": 0, "best_streak": 0}

    qualifying_days: List[date] = []
    seen: set[date] = set()

    for row in rows:
        score = row["score"]
        activity_date_val = row["activity_date"]

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
async def _ensure_supabase_user_exists(user_id: int, db: databases.Database) -> bool:
    # Supabase is now auth-only. Data is stored in local SQLite.
    return True


async def get_or_create_user_streak(user_id: int, db: databases.Database) -> UserStreak:
    """Get existing user streak or create new one using local SQLite."""
    try:
        try:
            from backend.database import user_streaks
        except ImportError:
            from database import user_streaks

        query = user_streaks.select().where(user_streaks.c.user_id == user_id)
        row = await db.fetch_one(query)
        
        if row:
            return UserStreak(
                id=row["id"],
                user_id=row["user_id"],
                current_streak=row["current_streak"],
                last_activity_date=row["last_activity_date"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
            
        now = datetime.utcnow()
        insert_query = user_streaks.insert().values(
            user_id=user_id,
            current_streak=0,
            longest_streak=0,
            last_activity_date=None,
            created_at=now,
            updated_at=now,
        )
        streak_id = await db.execute(insert_query)
        
        return UserStreak(
            id=streak_id,
            user_id=user_id,
            current_streak=0,
            last_activity_date=None,
            created_at=now,
            updated_at=now,
        )
    except Exception as e:
        api_logger.error(f"Failed to get/create user streak for user {user_id}: {e}")
        now = datetime.utcnow()
        # Return transient fallback
        return UserStreak(
            id=0,
            user_id=user_id,
            current_streak=0,
            last_activity_date=None,
            created_at=now,
            updated_at=now
        )

async def update_user_streak(
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
):
    """Update user streak based on daily activity using local SQLite."""
    from datetime import datetime, date
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo  # type: ignore

    try:
        from backend.database import user_streaks
    except ImportError:
        from database import user_streaks

    # Use the client's reported timezone when available, falling back
    # to stored user preferences and finally UTC.
    timezone_name = user_timezone or await _resolve_user_timezone_for_streak(user_id, db)
    if timezone_name:
        try:
            # Only use valid timezone strings
            user_tz = ZoneInfo(timezone_name)
            today = datetime.utcnow().replace(tzinfo=timezone.utc).astimezone(user_tz).date()
        except Exception:
            today = datetime.utcnow().date()
    else:
        today = datetime.utcnow().date()

    query = user_streaks.select().where(user_streaks.c.user_id == user_id)
    row = await db.fetch_one(query)

    if not row:
        # Should persist now via SQLite
        await get_or_create_user_streak(user_id, db)
        row = await db.fetch_one(query)
        if not row:
             api_logger.error(f"Failed to ensure streak record for user {user_id}")
             # Return fake object to not crash
             now = datetime.utcnow()
             return {
                 "id": 0, "user_id": user_id, "current_streak": 1, 
                 "last_activity_date": today.isoformat(), 
                 "created_at": now, "updated_at": now
             }

    last_activity_date_str = row["last_activity_date"]
    current_streak = row["current_streak"] or 0
    longest_streak = row["longest_streak"] or 0
    
    last_activity = _coerce_activity_day(last_activity_date_str) if last_activity_date_str else None

    # Determine new streak
    new_streak = current_streak
    if last_activity == today:
        # Already credited today
        return dict(row)
    elif last_activity:
        yesterday = date.fromordinal(today.toordinal() - 1)
        if last_activity == yesterday:
            new_streak += 1
        else:
            new_streak = 1
    else:
        new_streak = 1

    now_ts = datetime.utcnow()
    # Update SQLite
    try:
        update_q = user_streaks.update().where(user_streaks.c.id == row["id"]).values(
            current_streak=new_streak,
            longest_streak=max(longest_streak, new_streak),
            last_activity_date=today.isoformat(),
            updated_at=now_ts
        )
        await db.execute(update_q)
        
        return {
            "id": row["id"],
            "user_id": user_id,
            "current_streak": new_streak,
            "longest_streak": max(longest_streak, new_streak),
            "last_activity_date": today.isoformat(),
            "created_at": row["created_at"],
            "updated_at": now_ts
        }
    except Exception as e:
        api_logger.error(f"Failed to update streak for user {user_id}: {e}")
        return dict(row)

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
    # Allow localhost access without auth for Next.js SSR
    client_host = request.client.host if request.client else None
    x_real_ip = request.headers.get("x-real-ip", "")
    x_forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    
    # Check if request originates from localhost (direct or through nginx)
    localhost_ips = ("127.0.0.1", "::1", "localhost")
    is_localhost = (
        client_host in localhost_ips or 
        x_real_ip in localhost_ips or 
        x_forwarded_for in localhost_ips
    )
    
    if not is_localhost:
        # External requests require admin authentication
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        require_admin(current_user)
    now = datetime.utcnow()
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
    now = datetime.utcnow()
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
          created_at=datetime.utcnow(),
      )
      message_id = await database.execute(insert_query)
      
      # Update thread timestamp
      update_query = (
          user_chat_threads.update()
          .where(user_chat_threads.c.id == conversation_id)
          .values(last_message_at=datetime.utcnow(), updated_at=datetime.utcnow())
      )
      await database.execute(update_query)
      _append_to_conversation_cache(
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


async def _update_conversation_title(conversation_id: str, title: str) -> None:
    """Compatibility wrapper around core.chat_history.update_conversation_title."""
    await update_conversation_title(conversation_id, title)


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
    file_search_enabled: bool = False,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    reminders_enabled: bool = False,
    tools: Optional[List[types.Tool]] = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Yield token chunks using the configured AI provider."""


    # Determine whether this turn is part of a reminder/plan/habit flow.
    # Look at the current message plus a short window of recent history so
    # follow-ups like "12 pm" after "set a reminder" still route through tools.
    intent_window_text = (message or "") or ""
    if conversation_history:
        try:
            normalized_history = _normalize_conversation_history(conversation_history)
            # Only look at the last few turns to avoid over-triggering.
            for entry in normalized_history[-4:]:
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
    if normalized_model in {"lite", "gray-lite"}:
        # Lite tier routing: use OpenRouter with Grok 4.1 Fast
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            provider = "openrouter"
            model = OPENROUTER_LITE_MODEL  # x-ai/grok-4.1-fast - always set for tier alias
        else:
            provider = "gemini"
            model = GEMINI_LIGHT_MODEL
    elif normalized_model in {"pro", "gray-pro"}:
        provider = "gemini"
        model = GEMINI_PRO_MODEL  # Always set the actual model path for tier alias
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
            model = GEMINI_PRO_MODEL
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

    effective_system_prompt = system_prompt

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
    file_search_tools = []
    if file_search_enabled:
        t0_fs = time.perf_counter()
        file_search_tools = await _build_file_search_tools(db, user_id)
        fs_ms = (time.perf_counter() - t0_fs) * 1000
        if fs_ms > 50:
            api_logger.info(f"[Timing] File search tools: {fs_ms:.1f}ms")

    if tools is not None:
        base_tools = tools
    else:
        base_tools = DEFAULT_CHAT_TOOLS
        if not search_enabled:
            base_tools = [t for t in base_tools if t != SEARCH_TOOL]
    
    # Common tool list
    tool_list = [*base_tools, *maps_tools, *file_search_tools]
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
            if media_attachments:
                api_logger.info(
                    "Generating image descriptions for OpenRouter model",
                    extra={"event_type": "ai_image_description_start", "provider": provider, "count": len(media_attachments)},
                )
                image_desc = await _generate_image_descriptions(media_attachments)
                if image_desc:
                    message = image_desc + message
                    api_logger.info(
                        f"Added image descriptions to message for OpenRouter",
                        extra={"event_type": "ai_image_description_added", "count": len(media_attachments)},
                    )
            

            
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
                    
                    # Execute tools with Gemini Flash
                    hybrid_tool_results, hybrid_tool_cards, onboarding_done = await _execute_tools_with_gemini_flash(
                        message,
                        conversation_history,
                        tool_list,
                        effective_system_prompt,
                        time_context,
                        workspace_with_cache,
                        user_id,
                        db,
                        user_timezone,
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
                    
                    # Buffer for detecting JSON tool calls (legacy text fallback for onboarding)
                    tool_buffer = ""
                    is_collecting_tool = False
                    
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
                    if search_enabled:
                        # Explicitly tell the model about the search capability so it knows to use it (via the plugin)
                        run_system_prompt = (run_system_prompt or "") + "\n\nYou have access to Google Search. You must use it for current events, news, or factual queries where your knowledge might be outdated."

                    async for chunk in OPENROUTER_SERVICE.stream(
                        current_message,
                        current_history,
                        hybrid_workspace_context,  # Uses tool results context when hybrid flow is active
                        run_system_prompt,
                        time_context,
                        model,
                        include_usage=False,
                        response_format=response_format,
                        tools=tool_list,
                        tool_choice="auto",
                        plugins=[{"id": "web", "max_results": 5}] if search_enabled else None,
                        reasoning_mode=reasoning_mode,
                    ):
                        if isinstance(chunk, dict):
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
                                                await _complete_onboarding(user_id, tool_args, db)
                                                confirmation = "\n\n---\nSaved. I'm set with your name, what you do, and your blurb—ready whenever you are."
                                                yield ("delta", confirmation)
                                                yield ("final", {"text": confirmation, "grounding_metadata": None})
                                                return
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
                                
                                # Yield reminder/plan/habit cards to frontend
                                if isinstance(tool_result, dict) and tool_result.get("type") in {"gray.reminder", "gray.plan", "gray.habit"}:
                                    yield ("reminders", [tool_result])
                                    yielded_any_tokens = True
                                elif tool_name == "complete_onboarding":
                                    confirmation = "\n\n---\nSaved. I'm set with your name, what you do, and your blurb—ready whenever you are."
                                    yield ("delta", confirmation)
                                    yield ("final", {"text": confirmation, "grounding_metadata": None})
                                    return
                                    
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
    file_search_tools = []
    if file_search_enabled:
         file_search_tools = await _build_file_search_tools(db, user_id)

    if tools is not None:
        base_tools = tools
    else:
        base_tools = DEFAULT_CHAT_TOOLS
        if not search_enabled:
            base_tools = [t for t in base_tools if t != SEARCH_TOOL]
    tool_list = [*base_tools, *maps_tools, *file_search_tools]
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


def _build_starter_prompt(payload: ChatStarterRequest, profile_context: str) -> str:
    base_prompt = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "starter",
        "You are Gray. Write a warm, engaging greeting to start the conversation.",
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
    profile_context = _starter_profile_context(payload)
    prompt = _build_starter_prompt(payload, profile_context)
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
@limiter.limit("10/minute")
async def create_file_search_store(
    request: Request,
    payload: FileSearchStoreCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _ = current_user  # Auth enforced via dependency
    _ensure_file_search_enabled()
    store = await FILE_SEARCH_SERVICE.create_store(payload.display_name)
    return {"name": store.name, "display_name": store.display_name}


@app.post("/api/file-search/upload", response_model=FileSearchUploadResponse)
@limiter.limit("10/minute")
async def upload_to_file_search_store(
    request: Request,
    store_name: str = Form(...),
    file: UploadFile = File(...),
    display_name: Optional[str] = Form(None),
    chunking_config: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _ = current_user  # Auth enforced via dependency
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
@limiter.limit("5/minute")
async def import_file_search(
    request: Request,
    payload: FileSearchImportPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    _ = current_user  # Auth enforced via dependency
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

  public_url = None
  if STORAGE_BASE_URL:
      public_url = f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"

  now = datetime.utcnow()
  query = media_uploads.insert().values(
      user_id=user_id,
      filename=sanitized_name,
      mime_type=mime_type,
      size=size,
      storage_path=str(storage_path_for_db),
      created_at=now,
  )
  media_record_id = await db.execute(query)
  if FILE_SEARCH_ENABLED and FILE_SEARCH_SERVICE:
      background_tasks.add_task(_background_file_search_upload, db, user_id, storage_path, sanitized_name)

  return MediaUpload(
      id=media_record_id,
      user_id=user_id,
      filename=sanitized_name,
      mime_type=mime_type,
      size=size,
      created_at=now,
      public_url=public_url,
  )

async def _background_file_search_upload(db: databases.Database, user_id: str, storage_path: Path, sanitized_name: str):
    """Helper to handle file search upload in background."""
    try:
        # We need to re-verify service availability in background context
        if not FILE_SEARCH_SERVICE:
            return
            
        store_name = await _ensure_user_file_search_store(db, user_id)
        if store_name:
            await _upload_file_search_document(store_name, storage_path, sanitized_name)
    except Exception as exc:
        file_logger.error(f"Background upload to file search failed: {exc}")


async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    """Send a message to AI and get a response"""
    # Force the request user to the authenticated user to avoid mismatches from stale client state.
    chat_request.user_id = current_user["id"]
    start_time = datetime.utcnow()

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
        now = datetime.utcnow()
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
        if should_persist_user:
            await save_conversation_message(conversation_id, user_message_payload, user_id=chat_request.user_id)

        # Enforce tier restrictions
        # Only Voyager and Pioneer users can use reasoning mode.
        plan_tier = current_user.get("plan_tier")
        normalized_tier = (plan_tier or "scout").lower()

        # If user requested reasoning but is not eligible, disable it silently (or we could raise 403)
        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            api_logger.info(f"Disabling reasoning mode for user {chat_request.user_id} (tier: {normalized_tier})")
            effective_reasoning_mode = False

        # Generate AI response
        ai_response, grounding_metadata = await generate_ai_response(
            chat_request.message,
            conversation_history,
            chat_request.context,
            chat_request.system_prompt,
            chat_request.time_context,
            chat_request.model,
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
            file_search_enabled=chat_request.file_search_enabled,
            should_generate_title=chat_request.should_generate_title,
            reasoning_mode=effective_reasoning_mode,
            tools=tool_list,
            user_timezone=chat_request.timezone,
        )

        # Save AI response (including grounding metadata for downstream UI)
        assistant_message_payload: Dict[str, Any] = {
            "role": "model",
            "text": ai_response,
        }
        if grounding_metadata:
            assistant_message_payload["grounding_metadata"] = grounding_metadata
        assistant_message_id = await save_conversation_message(conversation_id, assistant_message_payload, user_id=chat_request.user_id)

        # Generate title inline so it's returned with the response.
        # This adds ~100-300ms latency but only on first message of new conversations.
        final_title = session_title
        if chat_request.should_generate_title:
            try:
                generated_title = await _generate_chat_title_inline(
                    chat_request.message,
                    ai_response
                )
                if generated_title:
                    final_title = generated_title
                    # Store in DB in background (non-blocking)
                    background_tasks.add_task(
                        _update_conversation_title,
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


class AsyncTTLCache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self.cache = {}

    async def get(self, key: str, fetch_func):
        now = time.time()
        if key in self.cache:
            value, timestamp = self.cache[key]
            if now - timestamp < self.ttl_seconds:
                return value
        
        value = await fetch_func()
        self.cache[key] = (value, now)
        return value

    def clear(self):
        self.cache = {}

    def invalidate(self, key: str):
        if key in self.cache:
            del self.cache[key]

USER_CACHE = AsyncTTLCache(ttl_seconds=300)


class TTLCache:
  def __init__(self, ttl_seconds: int = 600, max_size: int = 256):
    self.ttl_seconds = ttl_seconds
    self.max_size = max_size
    self.cache: Dict[str, tuple[Any, float]] = {}

  def get(self, key: str):
    now = time.time()
    entry = self.cache.get(key)
    if not entry:
      return None
    value, ts = entry
    if now - ts > self.ttl_seconds:
      self.cache.pop(key, None)
      return None
    return value

  def set(self, key: str, value: Any) -> None:
    if len(self.cache) >= self.max_size:
      # Evict the oldest entry to keep memory bounded
      oldest = min(self.cache.items(), key=lambda item: item[1][1])[0]
      self.cache.pop(oldest, None)
    self.cache[key] = (value, time.time())

  def invalidate(self, key: str) -> None:
    self.cache.pop(key, None)

  def clear(self) -> None:
    self.cache.clear()


CONVERSATION_OWNER_CACHE = TTLCache(ttl_seconds=900, max_size=512)
CONVERSATION_HISTORY_CACHE = TTLCache(ttl_seconds=900, max_size=256)


async def _get_cached_user(user_id: int, db: databases.Database):
    async def fetch():
        return await db.fetch_one(users.select().where(users.c.id == user_id))
    
    return await USER_CACHE.get(f"user_{user_id}", fetch)


def _cache_conversation_history(conversation_id: str, user_id: Optional[int], history: List[Dict[str, Any]]) -> None:
  if user_id is not None:
    CONVERSATION_OWNER_CACHE.set(conversation_id, user_id)
  CONVERSATION_HISTORY_CACHE.set(conversation_id, history)


def _append_to_conversation_cache(conversation_id: str, user_id: Optional[int], message: Dict[str, Any]) -> None:
  cached_history = CONVERSATION_HISTORY_CACHE.get(conversation_id)
  if cached_history is None:
    return
  owner = CONVERSATION_OWNER_CACHE.get(conversation_id) or user_id
  if user_id is not None and owner is not None and owner != user_id:
    return
  normalized = {
    "role": message.get("role"),
    "text": message.get("text") or "",
    "grounding_metadata": message.get("grounding_metadata") or message.get("groundingMetadata"),
    "attachments": message.get("attachments"),
  }
  new_history = cached_history + [normalized]
  if owner is not None:
    CONVERSATION_OWNER_CACHE.set(conversation_id, owner)
  CONVERSATION_HISTORY_CACHE.set(conversation_id, new_history)


def _invalidate_conversation_cache(conversation_id: str) -> None:
  CONVERSATION_OWNER_CACHE.invalidate(conversation_id)
  CONVERSATION_HISTORY_CACHE.invalidate(conversation_id)


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
    start_time = datetime.utcnow()

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
        user_task = asyncio.create_task(_get_cached_user(chat_request.user_id, db))

        # 2. Prepare Session Title (Sync, fast)
        effective_message = chat_request.message
        session_title = _fallback_title_from_message(effective_message)

        # 4. Start Conversation Setup (Async)
        t0_conv = time.perf_counter()
        requested_conversation_id = chat_request.conversation_id
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

        if is_onboarding:
            # Ignore client-provided prompts during onboarding so the AI
            # reliably completes the profile setup flow (name, occupation, blurb, etc.)
            # before switching to the regular chat persona.
            effective_system_prompt = ONBOARDING_SYSTEM_PROMPT
        elif chat_request.system_prompt:
            # IMPORTANT: Always include the base expansive Gray persona.
            # The client may send personalization (user profile, nickname, custom instructions)
            # but the core "be thoughtful, detailed, engaging" persona should always be present.
            # Check if the client prompt already contains the base (to avoid duplication).
            client_prompt = chat_request.system_prompt.strip()
            base_signature = "You are Gray"  # Unique prefix from DEFAULT_SYSTEM_PROMPT
            if client_prompt.startswith(base_signature):
                # Client already sent the full prompt, use as-is
                effective_system_prompt = client_prompt
            else:
                # Client sent personalization only; prepend the base persona
                effective_system_prompt = f"{DEFAULT_SYSTEM_PROMPT}\n\n{client_prompt}"
        else:
            effective_system_prompt = DEFAULT_SYSTEM_PROMPT

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
            tool_list = list(ONBOARDING_TOOLS)

        raw_message = (effective_message or "").strip()
        wants_onboarding = (
            "ready to start" in raw_message.lower()
            or "start onboarding" in raw_message.lower()
        )

        # If force_onboarding_mode is active, or if explicitly requested and needed, enforce onboarding settings.
        if force_onboarding_mode or (user_record and wants_onboarding and needs_personalization):
            # Always use onboarding prompt and tools in onboarding mode
            effective_system_prompt = ONBOARDING_SYSTEM_PROMPT
            tool_list = list(ONBOARDING_TOOLS)
            
            # Force a capable model for onboarding tools (already handled by stream_ai_response based on tools)
            # effective_model = "models/gemini-flash-latest"
            
            # If this is the very first interaction (triggered by frontend with empty message usually)
            if not effective_message or not effective_message.strip():
                effective_message = ""
            
            api_logger.info(
                f"User {chat_request.user_id} is in onboarding flow (forced: {force_onboarding_mode})",
                extra={
                    "event_type": "onboarding_flow",
                    "requested": wants_onboarding,
                    "needs_personalization": needs_personalization,
                    "force_onboarding_mode": force_onboarding_mode
                },
            )

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
            api_logger.info(f"History load time: {(t1_hist - t0_hist)*1000:.2f}ms", extra={"user_id": chat_request.user_id, "conversation_id": conversation_id})

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
        plan_tier = user_plan_tier
        normalized_tier = (plan_tier or "scout").lower()

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
                    file_search_enabled=chat_request.file_search_enabled,
                    should_generate_title=chat_request.should_generate_title,
                    reasoning_mode=effective_reasoning_mode,
                    reminders_enabled=chat_request.reminders_enabled,
                    tools=tool_list,
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
                        )
                        if generated_title:
                            final_title = generated_title
                            # Store in DB in background (non-blocking)
                            background_tasks.add_task(
                                _update_conversation_title,
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
        total_time = (datetime.utcnow() - start_time).total_seconds() * 1000
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
        total_time = (datetime.utcnow() - start_time).total_seconds() * 1000
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

async def create_conversation(
    request: Request,
    payload: ConversationCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a new conversation"""
    try:
        require_same_user(payload.user_id, current_user)
        if not _conversation_store_available():
            # Fallback: return mock conversation
            import uuid
            return {
                "id": str(uuid.uuid4()),
                "title": payload.title,
                "history": [],
                "user_id": payload.user_id,
            }

        try:
            await _ensure_user_data_record(payload.user_id)
            supabase_user_data_id = await _require_supabase_user_data_id(payload.user_id)
            result = (
                supabase.table("user_chat_threads")
                .insert(
                    {
                        "title": payload.title or "New Conversation",
                        "user_identifier": payload.user_id,
                        "user_data_id": supabase_user_data_id,
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
                    .eq("user_identifier", payload.user_id)
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
                    "user_id": payload.user_id,
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
                "title": payload.title,
                "history": [],
                "user_id": payload.user_id,
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating conversation: {str(e)}")


async def _delete_general_conversation_history(user_id: int) -> None:
    # 1. Delete from Supabase
    if _conversation_store_available():
        try:
            supabase.table("general_chat_messages").delete().eq("user_id", user_id).execute()
        except Exception as error:
            _handle_conversation_store_error("Error deleting general conversation history (Supabase)", error)

    # 2. Delete from SQLite
    try:
        query = general_chat_messages.delete().where(general_chat_messages.c.user_id == user_id)
        await database.execute(query)
    except Exception as error:
        app_logger.error(
            "Error deleting general conversation history (SQLite)",
            extra={"event_type": "sqlite_history_delete_error", "error": str(error)},
        )

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
            _invalidate_conversation_cache(conversation_id)
            return

        if _is_valid_uuid(conversation_id):
            try:
                # Local SQLite deletion for threads
                # Note: Delete messages first due to FK constraint if not cascaded, though SQLAlchemy usually handles it or SQLite pragma
                # But to be safe:
                await database.execute(user_chat_messages.delete().where(user_chat_messages.c.thread_id == conversation_id))
                await database.execute(user_chat_threads.delete().where(user_chat_threads.c.id == conversation_id))
                
                # Also try deleting from legacy Supabase if credentials exist, just to be clean (optional)
                if supabase and _conversation_store_available():
                     try:
                        supabase.table("user_chat_threads").delete().eq("id", conversation_id).execute()
                     except Exception:
                        pass
            except Exception as error:
                _handle_conversation_store_error("Error deleting conversation", error)
        _invalidate_conversation_cache(conversation_id)
        # When storage is unavailable or the ID is not a UUID, there is nothing to delete.
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(error)}")


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
        normalized_history = _normalize_conversation_history(payload.messages)

        general_user_id = _general_conversation_user_id(conversation_id)
        if general_user_id is not None:
            await _replace_general_conversation_history(
                general_user_id, normalized_history
            )
            _invalidate_conversation_cache(conversation_id)
            return {
                "id": conversation_id,
                "message_count": len(normalized_history),
            }

        # Thread conversations delegate to the shared chat_history helper.
        result = await overwrite_thread_history(
            conversation_id, normalized_history, current_user["id"]
        )
        _invalidate_conversation_cache(conversation_id)
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

def _normalize_conversation_title(payload: ConversationUpdateRequest) -> str | None:
    """Compatibility wrapper that reuses core.chat_history logic."""
    return normalize_conversation_title(payload)


async def _apply_conversation_update(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    return await apply_conversation_update(conversation_id, payload, current_user)


async def update_conversation(
    request: Request,
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update conversation metadata such as its title."""
    return await _apply_conversation_update(conversation_id, payload, current_user)


async def update_conversation_metadata(
    request: Request,
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update metadata via POST for clients that cannot rely on PATCH."""
    return await _apply_conversation_update(conversation_id, payload, current_user)

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
                "provider": os.getenv("AI_PROVIDER", "openrouter"),
                "model_name": os.getenv("AI_MODEL_NAME", None),
                "model_label": os.getenv("AI_MODEL_NAME", None),
                "user_tier": "scout",
            }

        # Extract user_id from conversation to lookup tier
        user_id = None  # Initialize to avoid UnboundLocalError
        user_tier = "pioneer"  # Default everyone to Pioneer privileges
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
                    try:
                        conv_result = supabase.table("user_chat_threads").select("user_identifier").eq("id", conversation_id).single().execute()
                        if conv_result and conv_result.data:
                            user_id = conv_result.data.get("user_identifier")
                    except Exception:
                        # Conversation might not exist in Supabase yet, skip silently
                        pass
            
            # If we found a user_id, look up their tier
            if user_id:
                # Check if user_id is an int (SQLite/Postgres ID) or UUID (Supabase Auth ID)
                # The users table uses integer IDs for the primary key 'id'
                # If user_identifier is a string (UUID), we might need to query by auth_user_id
                
                try:
                    # Try querying by ID first (assuming it's the integer ID)
                    user_result = supabase.table("users").select("plan_tier").eq("id", user_id).single().execute()
                    
                    if user_result and user_result.data:
                        user_tier = (user_result.data.get("plan_tier") or "scout").lower()
                except Exception:
                    # User might not exist or query failed, use default tier
                    pass
                    
        except Exception as tier_error:
            app_logger.warning(f"Could not determine user tier for conversation {conversation_id}: {tier_error}")

        # Set context limits by tier
        # Note: Pioneer models may have lower limits based on specific model (e.g., Deepseek=256k)
        TIER_CONTEXT_LIMITS = {
            "scout": 65_536,        # 64k tokens
            "voyager": 2_000_000,   # 2M tokens (Gemini Pro context)
            "pioneer": 2_000_000,   # 2M tokens (varies by model - Grok 4.1 Fast has 2M)
        }
        
        tier_context_limit = TIER_CONTEXT_LIMITS.get(user_tier, TIER_CONTEXT_LIMITS["pioneer"])
        
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
    now = datetime.utcnow()
    
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

    update_data["updated_at"] = datetime.utcnow()

    query = users.update().where(users.c.id == user_id).values(**update_data)
    await db.execute(query)

    # Invalidate cache
    USER_CACHE.invalidate(f"user_{user_id}")
    if current_user_record:
        auth_user_id = current_user_record["auth_user_id"] if "auth_user_id" in current_user_record else None
        if auth_user_id:
            invalidate_user_cache(str(auth_user_id))

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
    require_same_user(user_id, current_user)
    existing = await db.fetch_one(users.select().where(users.c.id == user_id))
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    user_email = existing["email"]
    auth_user_id = existing["auth_user_id"] if "auth_user_id" in existing else None
    
    api_logger.info(f"Processing account deletion for user {user_id} ({user_email})", extra={"user_id": user_id, "email": user_email, "event_type": "account_deletion_start"})

    _delete_supabase_user_records(user_id)

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

@app.get("/users/{user_id}/calendars", response_model=List[Calendar])
async def get_user_calendars(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    query = calendars.select().where(calendars.c.user_id == user_id).order_by(calendars.c.created_at.desc())
    return await db.fetch_all(query)

@app.post("/users/{user_id}/chat-sessions", response_model=ChatSession, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    user_id: int,
    session: ChatSessionCreate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    query = chat_sessions.insert().values(
        user_id=user_id,
        title=session.title,
        scope="thread"
    )
    session_id = await db.execute(query)
    return {**session.dict(), "id": session_id, "user_id": user_id}



@app.post("/users/{user_id}/calendars", response_model=Calendar, status_code=status.HTTP_201_CREATED)
async def create_calendar(
    user_id: int,
    calendar: CalendarCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
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
async def update_calendar(
    user_id: int,
    calendar_id: int,
    calendar_update: CalendarUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
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
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    query = plans.select().where(plans.c.user_id == user_id).order_by(plans.c.created_at)
    if limit:
        query = query.limit(limit)
    return await db.fetch_all(query)

@app.post("/users/{user_id}/plans", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(
    user_id: int,
    plan: PlanCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    base_values = {
        "user_id": user_id,
        "label": plan.label,
        "completed": plan.completed,
        "deadline": plan.deadline,
        "schedule_slot": plan.schedule_slot,
        "description": plan.description,
    }

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
async def update_plan(
    user_id: int,
    plan_id: int,
    plan_update: PlanUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    update_data = plan_update.dict(exclude_unset=True)

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
async def delete_plan(
    user_id: int,
    plan_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    
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
async def get_habits(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: Optional[int] = Query(None, gt=0),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    query = habits.select().where(habits.c.user_id == user_id).order_by(habits.c.created_at)
    if limit:
        query = query.limit(limit)
    rows = await db.fetch_all(query)
    return [_serialize_habit_record(row) for row in rows]

@app.post("/users/{user_id}/habits", response_model=Habit, status_code=status.HTTP_201_CREATED)
async def create_habit(
    user_id: int,
    habit: HabitCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    base_values = {
        "user_id": user_id,
        "label": habit.label,
        "streak_label": habit.streak_label,
        "previous_label": habit.previous_label,
        "description": habit.description,
    }

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
async def update_habit(
    user_id: int,
    habit_id: int,
    habit_update: HabitUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    update_data = habit_update.dict(exclude_unset=True)

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
async def delete_habit(
    user_id: int,
    habit_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
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
async def get_user_streak(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    streak = await get_or_create_user_streak(user_id, db)
    return streak

@app.post("/users/{user_id}/streak", response_model=UserStreak)
async def touch_user_streak(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    return await update_user_streak(user_id, db)

@app.get("/users/{user_id}/calendar-events", response_model=List[CalendarEvent])
async def get_user_calendar_events(

    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: databases.Database = Depends(get_database)

):
    require_same_user(user_id, current_user)
    
    # Use local SQLite.
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
          if value.tzinfo is None:
              value = value.replace(tzinfo=timezone.utc)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    try:
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
        
        # Self-healing for SQLite: Auto-DELETE stale pending reminders
        if status_filter == "pending" and rows:
            now = datetime.utcnow()
            stale_threshold = now - timedelta(minutes=15)
            stale_ids = []
            filtered_rows = []
            for row in rows:
                try:
                    remind_at = row["remind_at"]
                    if isinstance(remind_at, str):
                        remind_at = datetime.fromisoformat(remind_at.replace("Z", "+00:00"))
                    # Ensure naive datetime for comparison
                    if remind_at is not None and hasattr(remind_at, 'tzinfo') and remind_at.tzinfo is not None:
                        remind_at = remind_at.replace(tzinfo=None)
                    
                    # Check if it's stale and hasn't been delivered
                    # Note: SQLite rows might not have 'delivered_at' populated if schema migration failed or old data
                    is_stale = remind_at is not None and remind_at < stale_threshold
                    if is_stale:
                        stale_ids.append(row["id"])
                    else:
                        filtered_rows.append(row)
                except (ValueError, TypeError) as e:
                    api_logger.warning(f"Skipping reminder due to date parsing error (SQLite self-healing): {e}", extra={"reminder_id": row["id"]})
                    filtered_rows.append(row) # Keep row if parsing fails but it's not stale
            
            if stale_ids:
                try:
                    api_logger.info(f"Auto-deleting {len(stale_ids)} stale reminders (SQLite)", extra={"user_id": user_id, "reminder_ids": stale_ids})
                    delete_query = reminders.delete().where(reminders.c.id.in_(stale_ids))
                    await db.execute(delete_query)
                    rows = filtered_rows
                except Exception as e:
                    api_logger.error(f"Failed to auto-delete stale reminders (SQLite): {e}", exc_info=True)
                    rows = filtered_rows # Ensure we still return non-deleted rows
            else:
                rows = filtered_rows

        return [_serialize_reminder_row(row) for row in rows]
    except Exception as e:
        api_logger.error(f"Failed to fetch reminders from local database: {e}", exc_info=True, extra={"user_id": user_id})
        raise HTTPException(status_code=500, detail="Failed to fetch reminders from local database.")


@app.post(
    "/users/{user_id}/reminders",
    response_model=Dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
async def create_user_reminder(
    user_id: int,
    payload: ReminderCreate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    api_logger.info(f"DELETE reminder request: user_id={user_id}, reminder_id={reminder_id}")
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    db: databases.Database = Depends(get_database),
):
    require_same_user(user_id, current_user)
    
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


@app.post("/users/{user_id}/calendar-events", response_model=CalendarEvent, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    user_id: int,
    event: CalendarEventCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    now = datetime.utcnow()
    # Supabase-first create.
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    update_data = event_update.dict(exclude_unset=True)

    sqlite_update_data: Dict[str, Any] = {}
    if update_data:
         # Filter out fields that don't exist on the local SQLite table
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    safe_limit = max(1, min(limit, MAX_DASHBOARD_PULSE_HISTORY))

    records: List[Any] = []
    # Prefer Supabase when available.
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
    request: Request,
    user_id: int,
    date_key: str,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    require_same_user(user_id, current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    existing: Any = None
    # Supabase-first lookup.
    # Local SQLite implementation
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    # Supabase-first delete.
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
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    require_same_user(user_id, current_user)
    pulse_records: List[Any] = []
    # Supabase-first for dashboard pulses.
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
        proactivity=DashboardProactivitySummary(logs=proactivity_logs_payload, streak=streak),
    )


# --- Payment Endpoints ---

@app.post("/api/payment/charge", response_model=PaymentChargeResponse)
async def create_payment_charge(
    request: PaymentRequest,
    user: User = Depends(get_current_user)
):
    """
    Create a transaction with Midtrans Core API.
    """
    # 1. Determine Amount & Item Details
    if request.plan_tier == "voyager":
        amount = 150000 # IDR
        item_name = "Gray Voyager Plan"
    elif request.plan_tier == "pioneer":
        amount = 300000 # IDR
        item_name = "Gray Pioneer Plan"
    else:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    item_details = [{
        "id": request.plan_tier,
        "price": amount,
        "quantity": 1,
        "name": item_name
    }]

    # 2. Customer Details
    customer_details = {
        "first_name": user.full_name.split(" ")[0] if user.full_name else "User",
        "last_name": " ".join(user.full_name.split(" ")[1:]) if user.full_name and " " in user.full_name else "",
        "email": user.email,
        # "phone": "08123456789" # Optional, if collected
    }

    # 3. Generate Order ID
    order_id = f"ORDER-{user.id}-{int(datetime.now().timestamp())}"

    # 4. Bank Transfer / Credit Card Args
    bank_args = None
    token_id = None
    
    if request.payment_type == "bank_transfer":
        if not request.bank:
            raise HTTPException(status_code=400, detail="Bank is required for bank_transfer")
        bank_args = {"bank": request.bank}
    elif request.payment_type == "credit_card":
        if not request.token_id:
             raise HTTPException(status_code=400, detail="Token ID is required for credit_card")
        token_id = request.token_id

    # 5. Create Transaction in Database (Pending)
    try:
        query = transactions.insert().values(
            user_id=user.id,
            order_id=order_id,
            amount=amount,
            status="pending",
            payment_type=request.payment_type,
            plan_tier=request.plan_tier,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        await database.execute(query)
    except Exception as e:
        app_logger.error(f"Database error creating transaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to create transaction record")

    # 6. Call Midtrans Core API
    try:
        response = create_core_api_transaction(
            order_id=order_id,
            amount=amount,
            item_details=item_details,
            customer_details=customer_details,
            payment_type=request.payment_type,
            bank_transfer_args=bank_args,
            token_id=token_id
        )
    except Exception as e:
        # Mark transaction as failure in DB?
        app_logger.error(f"Midtrans API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")

    # 7. Parse Response & Return
    # GoPay response has 'actions' (generate-qr-code, deeplink-redirect)
    # Bank transfer has 'va_numbers'
    # Credit Card has 'redirect_url' for 3DS
    
    actions = response.get("actions")
    qr_code_url = None
    deeplink_url = None
    redirect_url = response.get("redirect_url")
    
    if actions:
        for action in actions:
            if action["name"] == "generate-qr-code":
                qr_code_url = action["url"]
            elif action["name"] == "deeplink-redirect":
                deeplink_url = action["url"]

    return PaymentChargeResponse(
        order_id=order_id,
        status=response.get("transaction_status", "pending"),
        actions=actions,
        qr_code_url=qr_code_url,
        deeplink_url=deeplink_url,
        va_numbers=response.get("va_numbers"),
        redirect_url=redirect_url
    )


@app.post("/api/payment/notification")
async def handle_payment_notification(notification: MidtransNotification):
    """
    Handle Midtrans HTTP Notification (Webhook).
    """
    # Get audit logger
    try:
        from audit_logger import get_audit_logger, AuditAction
        audit = get_audit_logger()
    except ImportError:
        audit = None
    
    # 1. Verify Signature
    is_valid = verify_notification_signature(
        order_id=notification.order_id,
        status_code=notification.status_code,
        gross_amount=notification.gross_amount,
        signature_key=notification.signature_key
    )

    if not is_valid:
        app_logger.warning(f"Invalid payment signature for order {notification.order_id}")
        if audit:
            await audit.log(
                AuditAction.SUSPICIOUS_ACTIVITY,
                details={"order_id": notification.order_id, "reason": "invalid_signature"},
                severity="warning"
            )
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 2. Update Transaction Status
    status_mapping = {
        "capture": "success",
        "settlement": "success", 
        "pending": "pending",
        "deny": "failed",
        "expire": "expired",
        "cancel": "cancelled"
    }
    
    new_status = status_mapping.get(notification.transaction_status, "pending")
    
    # Check for credit card fraud
    if notification.transaction_status == "capture" and notification.fraud_status == "challenge":
        new_status = "challenge"

    try:
        # Update transaction
        query = transactions.update().where(
            transactions.c.order_id == notification.order_id
        ).values(
            status=new_status,
            updated_at=datetime.utcnow()
        )
        await database.execute(query)
        
        # 3. Provision Plan if Success
        if new_status == "success":
            # Fetch transaction to get user_id and plan_tier
            trans_query = transactions.select().where(transactions.c.order_id == notification.order_id)
            transaction = await database.fetch_one(trans_query)
            
            if transaction:
                user_id = transaction["user_id"]
                plan_tier = transaction["plan_tier"]
                
                # Update User Plan
                user_update = users.update().where(users.c.id == user_id).values(
                    plan_tier=plan_tier,
                    updated_at=datetime.utcnow()
                )
                await database.execute(user_update)
                
                app_logger.info(f" upgraded user {user_id} to {plan_tier} via order {notification.order_id}")
                
                # Audit log successful payment
                if audit:
                    await audit.log(
                        AuditAction.PAYMENT_SUCCESS,
                        user_id=user_id,
                        details={
                            "order_id": notification.order_id,
                            "plan_tier": plan_tier,
                            "gross_amount": notification.gross_amount
                        },
                        severity="info"
                    )
        elif new_status in ("failed", "deny", "expired", "cancelled"):
            # Audit log failed payment
            if audit:
                trans_query = transactions.select().where(transactions.c.order_id == notification.order_id)
                transaction = await database.fetch_one(trans_query)
                await audit.log(
                    AuditAction.PAYMENT_FAILED,
                    user_id=transaction["user_id"] if transaction else None,
                    details={
                        "order_id": notification.order_id,
                        "status": new_status,
                        "transaction_status": notification.transaction_status
                    },
                    severity="warning"
                )
        
    except Exception as e:
        app_logger.error(f"Error processing payment notification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    return {"status": "ok"}


# Proactivity API endpoints
@app.get("/users/{user_id}/proactivity", response_model=List[ProactivityLog])
async def get_user_proactivity(
    user_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get user's proactivity logs"""
    require_same_user(user_id, current_user)
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


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


async def get_user_from_query_token(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
) -> Optional[Dict[str, Any]]:
    """
    Get authenticated user from either query parameter token or Authorization header.
    This is needed for SSE endpoints where EventSource doesn't support custom headers.
    """
    # Try query parameter first (for SSE)
    if token:
        try:
            from backend.auth import verify_supabase_token
        except ImportError:
            from auth import verify_supabase_token
        
        try:
            payload = await verify_supabase_token(token)
            auth_user_id = payload.get("sub")
            if not auth_user_id:
                return None
            
            user = await database.fetch_one(users.select().where(users.c.auth_user_id == auth_user_id))
            email = payload.get("email")
            
            if not user and email:
                user = await database.fetch_one(users.select().where(users.c.email == email))
            
            return dict(user) if user else None
        except Exception:
            return None
    
    # Fallback to Authorization header
    if credentials:
        try:
            return await get_current_user(credentials)
        except HTTPException:
            return None
    
    return None


@app.post("/users/{user_id}/push/subscribe", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def subscribe_push_notifications(
    request: Request,
    user_id: int,
    subscription: PushSubscriptionCreate,
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_user_from_query_token),
):
    """Register a Web Push subscription for the user."""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    require_same_user(user_id, current_user)
    # Check if subscription already exists
    existing = await db.fetch_one(
        proactivity_push_subscriptions.select().where(
            proactivity_push_subscriptions.c.endpoint == subscription.endpoint
        )
    )
    
    if existing:
        # Update keys if needed, or just return success
        await db.execute(
            proactivity_push_subscriptions.update()
            .where(proactivity_push_subscriptions.c.id == existing.id)
            .values(
                p256dh=subscription.p256dh,
                auth=subscription.auth,
                updated_at=datetime.utcnow(),
            )
        )
        return {"status": "updated"}

    # Create new subscription
    await db.execute(
        proactivity_push_subscriptions.insert().values(
            user_id=user_id,
            endpoint=subscription.endpoint,
            p256dh=subscription.p256dh,
            auth=subscription.auth,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    return {"status": "created"}


@app.get("/users/{user_id}/proactivity/stream")
async def stream_user_proactivity(
    user_id: int,
    current_user: Optional[Dict[str, Any]] = Depends(get_user_from_query_token),
):
    """
    SSE endpoint used by /g so active sessions can trigger evaluations and get notified.
    """
    global proactivity_engine, proactivity_realtime_broker

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    require_same_user(user_id, current_user)
    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")

    queue = await proactivity_realtime_broker.register(user_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            yield _sse_event("ready", {"user_id": user_id})
            # For realtime sessions, respect the duplicate guard so reconnects
            # (e.g., on backend restarts) don't re-send the same ping each time.
            # We run this in the background so we don't block the yield of the "ready" event
            # or the loop entry.
            asyncio.create_task(proactivity_engine.dispatch_user_if_due(user_id, source="realtime"))

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


@app.get("/users/{user_id}/proactivity/status")
async def get_proactivity_status(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get the current configuration and status of proactivity for a user.
    """
    global proactivity_engine
    require_same_user(user_id, current_user)
    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")
    
    return await proactivity_engine.get_user_status(user_id)


@app.put("/users/{user_id}/proactivity/settings", response_model=ProactivitySettings)
async def update_proactivity_settings(
    user_id: int,
    settings_update: ProactivitySettingsUpdate,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Update a user's proactivity settings.
    """
    global proactivity_engine, proactivity_scheduler
    require_same_user(user_id, current_user)

    if not proactivity_engine:
        raise HTTPException(status_code=503, detail="Proactivity engine not initialized")
    if not proactivity_scheduler:
        raise HTTPException(status_code=503, detail="Proactivity scheduler not initialized")

    # Fetch existing settings or initialize a new payload
    existing_record = await db.fetch_one(
        proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
    )
    current_payload = proactivity_engine._deserialize_payload(existing_record.payload) if existing_record else {}

    # Apply updates from the request model
    updated_payload = current_payload.copy()
    if settings_update.cadence is not None:
        updated_payload["cadence"] = settings_update.cadence
    if settings_update.time is not None:
        updated_payload["time"] = settings_update.time
    if settings_update.times is not None:
        updated_payload["times"] = settings_update.times
    if settings_update.channels is not None:
        updated_payload["channels"] = settings_update.channels
    if settings_update.timezone is not None:
        updated_payload["timezone"] = settings_update.timezone

    # Ensure consistent data types for 'times' if both 'time' and 'times' are present
    if updated_payload.get("cadence", "").lower() == "daily" and updated_payload.get("time") and not updated_payload.get("times"):
        updated_payload["times"] = [updated_payload["time"]]
    elif updated_payload.get("cadence", "").lower() == "frequent" and updated_payload.get("times"):
        # Ensure 'time' is consistent with the first 'times' entry for old clients
        updated_payload["time"] = updated_payload["times"][0] if updated_payload["times"] else None
    
    now = datetime.utcnow()
    try:
        if existing_record:
            update_query = (
                proactivity_settings.update()
                .where(proactivity_settings.c.user_id == user_id)
                .values(payload=updated_payload, updated_at=now)
            )
            await db.execute(update_query)
        else:
            insert_query = proactivity_settings.insert().values(
                user_id=user_id,
                payload=updated_payload,
                created_at=now,
                updated_at=now,
            )
            await db.execute(insert_query)
    except Exception as db_error:
        api_logger.error(
            f"Database error saving proactivity settings for user {user_id}: {db_error}",
            exc_info=True,
            extra={
                "event_type": "proactivity_settings_db_error",
                "user_id": user_id,
                "error": str(db_error),
                **_payload_log_summary(updated_payload),
            },
        )
        raise HTTPException(status_code=500, detail="Failed to save proactivity settings")

    # Sync to Supabase if enabled
    try:
        _upsert_supabase_proactivity_settings(user_id, updated_payload)
    except Exception as supabase_error:
        api_logger.warning(
            f"Failed to sync proactivity settings to Supabase for user {user_id}: {supabase_error}",
            extra={
                "event_type": "proactivity_settings_supabase_error",
                "user_id": user_id,
                "error": str(supabase_error),
                **_payload_log_summary(updated_payload),
            },
        )

    # Refresh scheduler jobs
    try:
        await proactivity_scheduler.refresh_jobs(user_id)
    except Exception as scheduler_error:
        api_logger.warning(
            f"Failed to refresh proactivity scheduler jobs for user {user_id}: {scheduler_error}",
            extra={
                "event_type": "proactivity_scheduler_refresh_error",
                "user_id": user_id,
                "error": str(scheduler_error),
            },
        )
    
    # Return the newly saved settings, including the ID from the DB
    saved_settings = await db.fetch_one(
        proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
    )
    if not saved_settings:
        raise HTTPException(status_code=500, detail="Failed to retrieve saved proactivity settings")

    # Ensure the returned payload matches ProactivitySettings model
    return ProactivitySettings(
        id=str(saved_settings.id),
        label=updated_payload.get("label"),
        description=updated_payload.get("description"),
        cadence=updated_payload.get("cadence"),
        time=updated_payload.get("time"),
        times=updated_payload.get("times"),
        channels=updated_payload.get("channels"),
        timezone=updated_payload.get("timezone"),
    )


@app.post("/users/{user_id}/proactivity", response_model=ProactivityLog, status_code=status.HTTP_201_CREATED)
async def create_proactivity_log(
    user_id: int,
    proactivity: ProactivityLogCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
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
async def list_proactivity_deliveries(
    user_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Return recent proactivity deliveries for a user so the client can hydrate
    which time slots have already fired.
    """
    require_same_user(user_id, current_user)
    now = datetime.utcnow()
    since = now - timedelta(days=1)

    # Prefer Supabase for proactivity deliveries when available.
    if supabase:
        try:
            result = (
                supabase.table("proactive_state")
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
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
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Daily proactivity check-in - creates or updates today's proactivity log"""
    require_same_user(user_id, current_user)
    from datetime import datetime, time

    today = datetime.utcnow().date()
    
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
async def get_proactivity_streak(
    user_id: int,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get user's current proactivity streak"""
    require_same_user(user_id, current_user)
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
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[ProactivityNotification]:
    """Fetch proactivity notifications for a user."""
    require_same_user(user_id, current_user)
    # Prefer Supabase when available.
    if supabase:
        try:
            query = (
                supabase.table("proactive_state")
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
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ProactivityNotification:
    """Mark a notification as read and return the updated record."""
    require_same_user(user_id, current_user)
    # Prefer Supabase when available.
    if supabase:
        try:
            # Verify the notification belongs to the user.
            existing = (
                supabase.table("proactive_state")
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
                supabase.table("proactive_state")
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
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    supabase_settings = _fetch_supabase_proactivity_settings(user_id)
    if supabase_settings:
        settings_dump = supabase_settings.model_dump(exclude_none=True)
        api_logger.debug(
            f"Retrieved proactivity settings from Supabase for user {user_id}",
            extra={
                "event_type": "proactivity_settings_retrieved_supabase",
                "user_id": user_id,
                **_payload_log_summary(settings_dump)
            }
        )
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
    api_logger.debug(
        f"Retrieved proactivity settings payload from database for user {user_id}",
        extra={
            "event_type": "proactivity_settings_retrieved_db",
            "user_id": user_id,
            **_payload_log_summary(payload)
        }
    )
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
    request: Request,
    user_id: int,
    settings: ProactivitySettings,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
    payload = settings.model_dump(exclude_none=True)
    now = datetime.utcnow()

    api_logger.debug(
        f"Saving proactivity settings for user {user_id}",
        extra={
            "event_type": "proactivity_settings_save_start",
            "user_id": user_id,
            **_payload_log_summary(payload)
        }
    )

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
            await proactivity_scheduler.refresh_jobs(user_id)
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
  storage_path, mime_type, size, sanitized_name, storage_name = await _persist_upload_file(
      file,
      allowed_mime_types=BACKGROUND_UPLOAD_MIME_TYPES,
      allowed_extensions=BACKGROUND_UPLOAD_EXTENSIONS,
      max_size_bytes=MAX_BACKGROUND_UPLOAD_SIZE_BYTES,
  )

  asset_path = f"/uploads/{storage_name}"
  if STORAGE_BASE_URL:
    asset_path = f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"

  return {
      "filename": sanitized_name,
      "asset_path": asset_path,
      "content_type": mime_type,
      "size": size,
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
    refresh_token = decrypt_refresh_token(record_dict["refresh_token"]) if record_dict.get("refresh_token") else None
    return GoogleCalendarCredentials(
        user_id=record_dict["user_id"],
        access_token=record_dict["access_token"],
        refresh_token=refresh_token,
        token_uri=record_dict["token_uri"],
        client_id=record_dict["client_id"],
        client_secret=None,
        scopes=scopes,
        expires_at=record_dict.get("expires_at"),
        created_at=record_dict.get("created_at", datetime.utcnow()),
        updated_at=record_dict.get("updated_at", datetime.utcnow()),
    )


async def persist_google_calendar_state(db: databases.Database, state_token: str, state_payload: dict) -> None:
    """Persist OAuth state to enforce one-time use."""
    expires_ts = state_payload.get("exp")
    expires_at = datetime.utcfromtimestamp(expires_ts) if expires_ts else None

    if not isinstance(state_payload.get("user_id"), int):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state payload")
    if not isinstance(state_payload.get("nonce"), str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state payload")
    if not isinstance(state_payload.get("redirect_uri"), str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state payload")

    await db.execute(
        google_calendar_states.delete().where(google_calendar_states.c.state_token == state_token)
    )

    await db.execute(
        google_calendar_states.insert().values(
            state_token=state_token,
            user_id=state_payload.get("user_id"),
            nonce=state_payload.get("nonce"),
            redirect_uri=state_payload.get("redirect_uri"),
            expires_at=expires_at,
            created_at=datetime.utcnow(),
        )
    )


async def consume_google_calendar_state(
    db: databases.Database, state_token: str, state_payload: dict
) -> None:
    """Validate and mark the OAuth state as consumed to prevent replay."""
    record = await db.fetch_one(
        google_calendar_states.select().where(google_calendar_states.c.state_token == state_token)
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state is not recognized or has expired",
        )

    if record["consumed_at"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state already used")

    expires_at = record.get("expires_at")
    if expires_at and expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state has expired")

    if record.get("user_id") != state_payload.get("user_id") or record.get("nonce") != state_payload.get("nonce"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state mismatch")

    redirect_from_state = (state_payload.get("redirect_uri") or "").strip()
    if record.get("redirect_uri") != redirect_from_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state redirect mismatch")

    await db.execute(
        google_calendar_states
        .update()
        .where(google_calendar_states.c.id == record["id"])
        .values(consumed_at=datetime.utcnow())
    )


async def upsert_google_calendar_credentials(db: databases.Database, creds: GoogleCalendarCredentials) -> None:
    payload = {
        "user_id": creds.user_id,
        "access_token": creds.access_token,
        "refresh_token": encrypt_refresh_token(creds.refresh_token) if creds.refresh_token else None,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": None,
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
@limiter.limit("10/minute")
async def google_calendar_auth(
    request: Request,
    user_id: int,
    auth_request: GoogleAuthRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    try:
        """Generate Google Calendar authorization URL."""
        if auth_request.user_id and auth_request.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mismatched user identifier for Google Calendar auth request")
        auth = get_google_auth_url(user_id, auth_request.redirect_uri)
        state_payload = decode_state_token(auth.state)
        await persist_google_calendar_state(db, auth.state, state_payload)
        return auth
    except HTTPException as e:
        raise e

@app.post("/google-calendar/oauth/callback", status_code=status.HTTP_204_NO_CONTENT)
async def google_calendar_callback(
    request: GoogleAuthCallbackRequest,
    db: databases.Database = Depends(get_database),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Handle Google Calendar OAuth callback."""
    try:
        state_payload = decode_state_token(request.state)
        state_user_id = state_payload.get("user_id") if isinstance(state_payload, dict) else None
        if current_user is not None and state_user_id is not None:
            require_same_user(int(state_user_id), current_user)
        await consume_google_calendar_state(db, request.state, state_payload)
        credentials = await exchange_code_for_tokens(request.code, request.state, request.redirect_uri)
        await upsert_google_calendar_credentials(db, credentials)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException as e:
        raise e

@app.get("/users/{user_id}/google-calendars", response_model=List[GoogleCalendarInfo])
async def get_google_calendars(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
    """Get user's Google Calendars."""
    try:
        # Get user's Google Calendar credentials from database
        query = google_calendar_credentials.select().where(google_calendar_credentials.c.user_id == user_id)

        creds = map_google_credentials(stored_creds)
        service = await get_google_calendar_service(creds)
        calendars = await list_google_calendars(service)
        return calendars
    except HTTPException as e:
        raise e

@app.get("/users/{user_id}/google-calendars/{calendar_id}/events", response_model=List[GoogleCalendarEvent])
async def get_google_calendar_events(
    user_id: int,
    calendar_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    db: databases.Database = Depends(get_database)
):
    require_same_user(user_id, current_user)
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
async def create_google_calendar_event(
    user_id: int,
    calendar_id: str,
    event_data: dict,
    db: databases.Database = Depends(get_database),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    require_same_user(user_id, current_user)
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
@limiter.limit("5/minute")
async def trigger_proactivity_evaluation(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Manually trigger proactivity evaluation for all users.
    Returns a summary of actions taken.
    """
    global proactivity_engine

    require_admin(current_user)
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
@limiter.limit("5/minute")
async def trigger_proactivity_for_user(
    request: Request,
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Manually trigger proactivity message generation for a specific user.
    """
    global proactivity_engine

    require_same_user(user_id, current_user)
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
