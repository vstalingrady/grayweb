"""
Log analysis and parsing utilities.

Extracted from main.py to improve modularity.
"""
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

# Determine ROOT_DIR
ROOT_DIR = Path(__file__).resolve().parent.parent


# ==============================================================================
# Payload Logging Utilities
# ==============================================================================


def payload_log_summary(payload: Any) -> Dict[str, Any]:
    """Summarize potentially sensitive payloads for safe logging.
    
    Returns a dictionary with payload metadata without exposing actual content.
    """
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


# Backwards compatibility alias
_payload_log_summary = payload_log_summary


# ==============================================================================
# Timestamp Parsing
# ==============================================================================


def parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 timestamp string to a naive UTC datetime."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.replace(tzinfo=None)


def resolve_log_paths() -> Dict[str, Path]:
    """Find the log directory and return paths to app.log and error.log."""
    candidates = [
        Path(__file__).resolve().parent.parent / "logs",
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


def iter_log_entries(path: Path) -> Iterable[Dict[str, Any]]:
    """Iterate over JSON log entries in a log file."""
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
                except json.JSONDecodeError:
                    continue
                if isinstance(parsed, dict):
                    yield parsed
    except FileNotFoundError:
        return


def percentile(values: List[float], pct: float) -> Optional[float]:
    """Calculate the given percentile of a list of values."""
    if not values:
        return None
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (pct / 100)
    floor_index = math.floor(k)
    ceil_index = math.ceil(k)
    if floor_index == ceil_index:
        return sorted_vals[int(k)]
    return sorted_vals[floor_index] + (sorted_vals[ceil_index] - sorted_vals[floor_index]) * (k - floor_index)


def collect_latency_stats(since: Optional[datetime] = None) -> Dict[str, Any]:
    """Collect latency statistics from chat_request_complete log entries."""
    log_paths = resolve_log_paths()
    app_log_path = log_paths["app"]
    latencies: List[float] = []
    
    for entry in iter_log_entries(app_log_path):
        timestamp = parse_iso_timestamp(entry.get("timestamp"))
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
    p95 = percentile(latencies, 95)
    under_five_seconds = len([value for value in latencies if value <= 5000])

    return {
        "count": len(latencies),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2) if p95 is not None else None,
        "under_5s_ratio": round(under_five_seconds / len(latencies), 3),
        "log_path": str(app_log_path),
        "sample_since": since.isoformat() if since else None,
    }


def count_error_entries(since: Optional[datetime] = None) -> Dict[str, Any]:
    """Count error entries from app.log and error.log."""
    log_paths = resolve_log_paths()
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
    for entry in iter_log_entries(error_log_path):
        timestamp = parse_iso_timestamp(entry.get("timestamp"))
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
    for entry in iter_log_entries(app_log_path):
        timestamp = parse_iso_timestamp(entry.get("timestamp"))
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
