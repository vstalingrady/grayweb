"""
Prompt loading utilities for system prompts and AI configurations.

Extracted from main.py to reduce its size and improve modularity.
"""
import json
from pathlib import Path
from typing import Any, Optional

from fastapi import Request

# Enhanced logging imports
from backend.logging_config import create_logger

app_logger = create_logger("backend.prompts")


def normalize_prompt_locale(locale: Optional[str]) -> str:
    """Normalize a locale string to a simple language code."""
    normalized = (locale or "").strip().lower()
    if not normalized:
        return "en"
    return normalized.split("-")[0]


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


def load_prompt_from_json(path: Path, key: str, fallback: str = "", locale: Optional[str] = None) -> str:
    """
    Load a prompt string from a JSON config file, using a dotted key path like
    "chat" or "proactivity.daily". Raises RuntimeError if prompt can't be loaded.
    
    If the key is missing/empty and a fallback is provided, the fallback is returned.
    """
    fallback_value = (fallback or "").strip()
    try:
        raw = path.read_text(encoding="utf-8")
        data: Any = json.loads(raw)
    except FileNotFoundError:
        if fallback_value:
            app_logger.warning(
                "Prompt file missing; using fallback",
                extra={"prompt_path": str(path), "prompt_key": key},
            )
            return fallback_value
        raise
    except Exception as exc:
        if fallback_value:
            app_logger.warning(
                "Failed to load prompt JSON; using fallback",
                extra={"prompt_path": str(path), "prompt_key": key, "error": str(exc)},
            )
            return fallback_value
        raise
    value: Any = data
    for segment in key.split("."):
        if not isinstance(value, dict) or segment not in value:
            if fallback_value:
                app_logger.warning(
                    "Prompt key missing; using fallback",
                    extra={"prompt_path": str(path), "prompt_key": key},
                )
                return fallback_value
            raise RuntimeError(f"Prompt key '{key}' not found in {path}")
        value = value[segment]
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, dict):
        normalized_locale = normalize_prompt_locale(locale)
        candidate = value.get(normalized_locale)
        if not isinstance(candidate, str) or not candidate.strip():
            candidate = value.get("en")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    if fallback_value:
        app_logger.warning(
            "Prompt key empty; using fallback",
            extra={"prompt_path": str(path), "prompt_key": key},
        )
        return fallback_value
    raise RuntimeError(f"Prompt key '{key}' is empty in {path}")


def prompt_locale_from_request(request: Request) -> str:
    """Extract and normalize locale from HTTP Accept-Language header."""
    header_value = (request.headers.get("accept-language") or "").strip()
    if not header_value:
        return "en"
    first = header_value.split(",")[0].strip()
    if not first:
        return "en"
    return normalize_prompt_locale(first)


# Backwards compatibility aliases (with underscore prefix for internal use)
_normalize_prompt_locale = normalize_prompt_locale
_prompt_locale_from_request = prompt_locale_from_request
