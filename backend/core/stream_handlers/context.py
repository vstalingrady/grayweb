"""
Stream Context for AI Response Generation

Contains shared helpers for AI response generation context/routing.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from backend.core.ai_config import OPENROUTER_LITE_MODEL

# Tier aliases for model routing
TIER_ALIASES = {"lite", "gray-lite", "pro", "gray-pro"}
PIONEER_ALIAS = "pioneer"
DEFAULT_PIONEER_MODEL = "anthropic/claude-sonnet-4.5"


@dataclass
class StreamContext:
    """All context needed for streaming an AI response."""
    # Core message/history
    message: str
    conversation_history: List[Dict[str, Any]]
    history_token_budget: int
    
    # Prompts and context
    system_prompt: Optional[str]
    workspace_context: Optional[str]
    time_context: Optional[str]
    
    # Provider selection
    provider: str  # "openrouter"
    model: Optional[str]
    
    # Tools configuration
    tool_list: List[Any] = field(default_factory=list)
    tool_config: Optional[Any] = None
    needs_structured_tools: bool = False
    is_onboarding_tool: bool = False
    
    # Feature flags
    search_enabled: bool = True
    reasoning_mode: bool = False
    reminders_enabled: bool = False
    
    # Media
    media_attachments: List[Any] = field(default_factory=list)
    
    # User context
    user_id: int = 0
    user_timezone: Optional[str] = None
    plan_tier: Optional[str] = None
    
    # Cache
    cached_contents: Optional[List[Any]] = None
    
    # Response format (for structured responses)
    response_format: Optional[Dict[str, Any]] = None
    
    # Provider routing hints
    provider_routing: Optional[Dict[str, Any]] = None
    
    # Grounding metadata (populated during streaming)
    grounding_metadata: Optional[Dict[str, Any]] = None
    
    # Tier alias flag
    explicit_model_is_tier_alias: bool = False


def build_intent_window_text(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]]
) -> str:
    """
    Build a text window for intent detection from message and recent history.
    
    Uses the last 4 conversation turns to detect follow-up intent like
    "12 pm" after "set a reminder".
    """
    intent_window = (message or "")
    if conversation_history:
        for entry in conversation_history[-4:]:
            if not isinstance(entry, dict):
                continue
            text = entry.get("text") or ""
            if text:
                intent_window += f"\n{text}"
    return intent_window


def determine_provider_and_model(
    model: Optional[str],
    openrouter_available: bool,
    needs_structured_tools: bool,
    is_onboarding_tool: bool,
) -> Tuple[str, Optional[str], bool]:
    """
    Determine the AI provider and model based on request parameters.

    OpenRouter is the only provider; Gemini models are accessed through OpenRouter.
    """
    explicit_model = (model or "").strip()
    normalized_model = explicit_model.lower()
    explicit_model_is_tier_alias = normalized_model in TIER_ALIASES

    provider = "openrouter"
    result_model = model

    # Tier aliases -> OpenRouter lite tier
    if normalized_model in TIER_ALIASES:
        result_model = OPENROUTER_LITE_MODEL
    elif normalized_model == PIONEER_ALIAS:
        if "/" not in explicit_model:
            result_model = DEFAULT_PIONEER_MODEL
    elif normalized_model.startswith("models/"):
        # Normalize legacy Gemini-style model ids to OpenRouter ids.
        stripped = explicit_model.replace("models/", "", 1)
        result_model = stripped if "/" in stripped else f"google/{stripped}"
    elif normalized_model.startswith("gemini"):
        # Allow shorthand Gemini ids; OpenRouter mapping handles canonicalization.
        result_model = explicit_model

    if not openrouter_available:
        # Keep provider as OpenRouter; the caller will surface availability errors.
        provider = "openrouter"

    # Structured tools no longer switch providers; OpenRouter handles tool calls.
    _ = (needs_structured_tools, is_onboarding_tool)

    return provider, result_model, explicit_model_is_tier_alias
