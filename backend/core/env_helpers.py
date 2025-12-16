"""
Environment and utility helper functions.

Extracted from main.py to improve modularity.
"""
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from dateutil import parser as date_parser


# ==============================================================================
# Environment Variable Parsing
# ==============================================================================


def float_env(var_name: str, default: float) -> float:
    """Parse a float value from an environment variable."""
    try:
        return float(os.getenv(var_name, default))
    except (TypeError, ValueError):
        return default


def int_env(var_name: str, default: int) -> int:
    """Parse an integer value from an environment variable."""
    try:
        value = os.getenv(var_name)
        if value is None or value.strip() == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


# ==============================================================================
# UUID Validation
# ==============================================================================


def is_valid_uuid(val: Optional[Any]) -> bool:
    """Safely validate UUID strings without raising on None or non-string values."""
    if not isinstance(val, str) or not val:
        return False
    try:
        uuid_obj = UUID(val)
        return str(uuid_obj) == val
    except (ValueError, TypeError, AttributeError):
        return False


# ==============================================================================
# Timestamp Conversion
# ==============================================================================


def _get_utcnow() -> datetime:
    """Get current UTC time as naive datetime (for compatibility)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_utcnow_aware() -> datetime:
    """Get current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


def timestamp_ms_to_datetime(timestamp_ms: Optional[int]) -> datetime:
    """Convert a millisecond timestamp to a naive UTC datetime."""
    if timestamp_ms is None:
        return _get_utcnow()
    try:
        normalized = datetime.fromtimestamp(int(timestamp_ms) / 1000, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        normalized = _get_utcnow_aware()
    return normalized.replace(tzinfo=None)


def datetime_to_ms(value: Optional[datetime]) -> int:
    """Convert a datetime (or ISO string) to milliseconds since epoch."""
    base: datetime
    if isinstance(value, datetime):
        base = value
    elif isinstance(value, str):
        candidate = value.strip()
        if candidate:
            try:
                # Use dateutil for robust parsing of various formats (ISO, space-separated, etc.)
                base = date_parser.parse(candidate)
            except (ValueError, TypeError):
                # Fallback to current time if parsing fails completely
                base = _get_utcnow()
        else:
            base = _get_utcnow()
    else:
        base = _get_utcnow()
    if base.tzinfo is None:
        aware = base.replace(tzinfo=timezone.utc)
    else:
        aware = base.astimezone(timezone.utc)
    return int(aware.timestamp() * 1000)


# ==============================================================================
# Timezone Utilities
# ==============================================================================


def timezone_from_time_context(time_context: str) -> Tuple[Optional[str], Any]:
    """Extract timezone information from a time_context string.
    
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


def ensure_datetime_value(value: Any) -> Optional[datetime]:
    """Normalize a datetime-like value to a naive UTC datetime for comparisons.
    
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


# Backwards compatibility aliases (with underscore prefix for internal use)
_float_env = float_env
_int_env = int_env
_is_valid_uuid = is_valid_uuid
_timestamp_ms_to_datetime = timestamp_ms_to_datetime
_datetime_to_ms = datetime_to_ms
_timezone_from_time_context = timezone_from_time_context
_ensure_datetime_value = ensure_datetime_value
