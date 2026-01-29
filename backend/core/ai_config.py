"""
AI Configuration and Constants

Centralized configuration for AI providers, models, tools, and response formats.
Extracted from main.py for better modularity.
"""
import os
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable

# Path setup
ROOT_DIR = Path(__file__).parent.parent.parent

# --- Provider & Model Configuration ---

AI_PROVIDER = "openrouter"

# Model identifiers
GROK_TOOL_MODEL = os.getenv("GROK_TOOL_MODEL", "x-ai/grok-4.1-fast")
OPENROUTER_LITE_MODEL = os.getenv("OPENROUTER_LITE_MODEL", "xiaomi/mimo-v2-flash:free")


# --- Tier Configuration ---

# Conversation memory/context limits (tokens) by plan tier.
# "64,000 token memory" refers to tokens of conversation history included as context.
TIER_CONVERSATION_TOKEN_LIMITS: Dict[str, int] = {
    "scout": 65_536,
    "pathfinder": 256_000,
    "voyager": 524_288,
    "pioneer": 524_288,
}


def tier_conversation_token_limit(
    plan_tier: Optional[str],
    normalize_fn=None,
    model_id: Optional[str] = None,
    model_limit_fn: Optional[Callable[[str], int]] = None,
) -> int:
    """Get token limit for a plan tier.

    Args:
        plan_tier: The plan tier name
        normalize_fn: Optional function to normalize tier name (e.g., normalize_plan_tier)
        model_id: Optional model ID to derive model-specific limits
        model_limit_fn: Optional function to resolve a model context limit
    """
    if normalize_fn:
        normalized = normalize_fn(plan_tier)
    else:
        normalized = (plan_tier or "scout").lower()

    base_limit = TIER_CONVERSATION_TOKEN_LIMITS.get(normalized, TIER_CONVERSATION_TOKEN_LIMITS["scout"])
    if normalized not in ("voyager", "pioneer"):
        return base_limit
    if not model_id or not model_limit_fn:
        return base_limit
    try:
        model_limit = int(model_limit_fn(model_id))
    except (TypeError, ValueError):
        return base_limit
    if model_limit <= 0:
        return base_limit
    return model_limit


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

_DEFAULT_CHAT_TOOLS = None


def get_default_chat_tools():
    """Get the default chat tools list."""
    global _DEFAULT_CHAT_TOOLS
    if _DEFAULT_CHAT_TOOLS is None:
        _DEFAULT_CHAT_TOOLS = []
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
