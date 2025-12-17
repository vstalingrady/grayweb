"""
AI Configuration and Constants

Centralized configuration for AI providers, models, tools, and response formats.
Extracted from main.py for better modularity.
"""
import os
from pathlib import Path
from typing import Dict, List, Optional, Any

# Google GenAI types
try:
    from google.genai import types
except ImportError:
    types = None  # type: ignore

# Path setup
ROOT_DIR = Path(__file__).parent.parent.parent

# --- Provider & Model Configuration ---

AI_PROVIDER = (os.getenv("AI_PROVIDER") or "openrouter").strip().lower()
LITE_TIER_PROVIDER = (os.getenv("LITE_TIER_PROVIDER") or "openrouter").strip().lower()

# Model identifiers
REMINDER_MODEL = os.getenv("REMINDER_MODEL", "models/gemini-flash-lite-latest")
GROK_TOOL_MODEL = os.getenv("GROK_TOOL_MODEL", "x-ai/grok-4.1-fast")
OPENROUTER_LITE_MODEL = os.getenv("OPENROUTER_LITE_MODEL", "x-ai/grok-4.1-fast")
GEMINI_DEFAULT_MODEL = os.getenv("GEMINI_DEFAULT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_LIGHT_MODEL = os.getenv("GEMINI_LIGHT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_PRO_MODEL = os.getenv("GEMINI_PRO_MODEL", "models/gemini-3-pro-preview")

# Validation flag
VALIDATE_GEMINI_ON_STARTUP = os.getenv("VALIDATE_GEMINI_ON_STARTUP", "true").strip().lower() not in {
    "0", "false", "no", "off",
}


# --- Tier Configuration ---

# Conversation memory/context limits (tokens) by plan tier.
# "64,000 token memory" refers to tokens of conversation history included as context.
TIER_CONVERSATION_TOKEN_LIMITS: Dict[str, int] = {
    "scout": 65_536,
    "voyager": 2_000_000,
    "pioneer": 2_000_000,
}


def tier_conversation_token_limit(plan_tier: Optional[str], normalize_fn=None) -> int:
    """Get token limit for a plan tier.
    
    Args:
        plan_tier: The plan tier name
        normalize_fn: Optional function to normalize tier name (e.g., normalize_plan_tier)
    """
    if normalize_fn:
        normalized = normalize_fn(plan_tier)
    else:
        normalized = (plan_tier or "scout").lower()
    return TIER_CONVERSATION_TOKEN_LIMITS.get(normalized, TIER_CONVERSATION_TOKEN_LIMITS["scout"])


# --- Function Names (for tool detection) ---

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


# --- Response Format Schemas ---

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


# --- Tool Definitions ---
# These are lazily initialized since they require google.genai types

_SEARCH_TOOL = None
_URL_CONTEXT_TOOL = None
_DEFAULT_CHAT_TOOLS = None


def get_search_tool():
    """Get the Google Search tool instance."""
    global _SEARCH_TOOL
    if _SEARCH_TOOL is None and types is not None:
        _SEARCH_TOOL = types.Tool(google_search=types.GoogleSearch())
    return _SEARCH_TOOL


def get_url_context_tool():
    """Get the URL Context tool instance."""
    global _URL_CONTEXT_TOOL
    if _URL_CONTEXT_TOOL is None and types is not None:
        _URL_CONTEXT_TOOL = types.Tool(url_context=types.UrlContext())
    return _URL_CONTEXT_TOOL


def get_default_chat_tools():
    """Get the default chat tools list."""
    global _DEFAULT_CHAT_TOOLS
    if _DEFAULT_CHAT_TOOLS is None:
        search = get_search_tool()
        _DEFAULT_CHAT_TOOLS = [search] if search else []
    return _DEFAULT_CHAT_TOOLS


# --- Prompt Paths ---

PROMPTS_DIR = ROOT_DIR / "backend" / "prompts"
GLOBAL_SYSTEM_PROMPTS_PATH = ROOT_DIR / "public" / "system-prompts.json"
ONBOARDING_PROMPT_PATH = PROMPTS_DIR / "onboarding.txt"


# --- Streaming Configuration ---

def get_streaming_token_delay() -> float:
    """Get the configured streaming token delay in seconds."""
    try:
        val = float(os.getenv("GRAY_STREAMING_TOKEN_DELAY_SECONDS", "0.0"))
        return max(0.0, val)
    except (ValueError, TypeError):
        return 0.0


STREAMING_TOKEN_DELAY = get_streaming_token_delay()


# --- Dashboard Defaults ---

MAX_DASHBOARD_PULSE_HISTORY = 30
DEFAULT_DASHBOARD_PROACTIVITY = {
    "id": "proactivity-default",
    "label": "Check-ins",
    "description": "Daily sync nudges for squad channels.",
    "cadence": "Daily",
    "time": "09:00 AM",
}

DEFAULT_WORKSPACE_BACKGROUNDS: List[Dict[str, Any]] = []


# --- Single-call-per-turn tool names (to prevent duplicates) ---

SINGLE_CALL_PER_TURN_TOOLS = {
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
