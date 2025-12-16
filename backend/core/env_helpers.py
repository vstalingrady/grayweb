"""
Environment and utility helper functions.

Extracted from main.py to improve modularity.
"""
import os
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

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


# Backwards compatibility aliases (with underscore prefix for internal use)
_float_env = float_env
_int_env = int_env
_is_valid_uuid = is_valid_uuid
_timestamp_ms_to_datetime = timestamp_ms_to_datetime
_datetime_to_ms = datetime_to_ms
