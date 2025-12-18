"""
Stream Context for AI Response Generation

Contains the StreamContext dataclass and helper functions for preparing
all the state needed for streaming AI responses from OpenRouter or Gemini.

This consolidates ~260 lines of duplicated setup logic that was shared
between stream_ai_response and generate_ai_response.
"""
import logging
from dataclasses import dataclass, field
from importlib.util import find_spec
from typing import Any, Dict, List, Optional, Tuple

if find_spec("google.genai") is not None:
    from google.genai import types
else:
    types = None  # type: ignore

from backend.core.ai_config import (
    AI_PROVIDER,
    REMINDER_MODEL,
    OPENROUTER_LITE_MODEL,
    GEMINI_LIGHT_MODEL,
)

api_logger = logging.getLogger("backend.api")

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
    provider: str  # "openrouter" or "gemini"
    model: Optional[str]
    
    # Tools configuration
    tool_list: List[Any] = field(default_factory=list)
    tool_config: Optional[Any] = None
    needs_structured_tools: bool = False
    is_onboarding_tool: bool = False
    
    # Feature flags
    search_enabled: bool = True
    maps_enabled: bool = False
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
    gemini_default_model: Optional[str],
    needs_structured_tools: bool,
    is_onboarding_tool: bool,
    maps_enabled: bool,
) -> Tuple[str, Optional[str], bool]:
    """
    Determine the AI provider and model based on request parameters.
    
    Returns:
        Tuple of (provider, model, explicit_model_is_tier_alias)
    """
    explicit_model = (model or "").strip()
    normalized_model = explicit_model.lower()
    explicit_model_is_tier_alias = normalized_model in TIER_ALIASES
    
    provider: Optional[str] = None
    result_model = model
    
    # 1. Respect explicit tier aliases first
    if normalized_model in TIER_ALIASES:
        if openrouter_available:
            provider = "openrouter"
            result_model = OPENROUTER_LITE_MODEL
        else:
            provider = "gemini"
            result_model = GEMINI_LIGHT_MODEL
            
    elif normalized_model == PIONEER_ALIAS:
        if openrouter_available:
            provider = "openrouter"
            if "/" not in explicit_model:
                result_model = DEFAULT_PIONEER_MODEL
        else:
            provider = "gemini"
            result_model = GEMINI_LIGHT_MODEL
            
    elif normalized_model.startswith("models/") or normalized_model.startswith("gemini"):
        provider = "gemini"
        
    elif normalized_model.startswith("openrouter") or "/" in normalized_model:
        provider = "openrouter"
    
    # 2. Handle tool routing
    if needs_structured_tools or is_onboarding_tool:
        if provider in ("openrouter", "gemini"):
            pass  # Keep existing provider
        else:
            provider = "gemini"
            if not explicit_model_is_tier_alias:
                result_model = REMINDER_MODEL if needs_structured_tools else gemini_default_model
    elif not provider:
        provider = "gemini"
    
    # 3. Maps grounding requires Gemini
    if maps_enabled:
        provider = "gemini"
    
    return provider or "gemini", result_model, explicit_model_is_tier_alias


def add_maps_tool_if_needed(
    tools: Optional[List[Any]],
    maps_enabled: bool,
) -> Optional[List[Any]]:
    """Add Google Maps tool if maps are enabled and not already present."""
    if not maps_enabled or types is None:
        return tools
    
    result = list(tools) if tools else []
    
    has_maps = any(
        hasattr(t, "google_maps") and t.google_maps
        for t in result
    )
    
    if not has_maps:
        result.append(types.Tool(google_maps=types.GoogleMaps()))
    
    return result


def build_workspace_with_cache(
    workspace_context: Optional[str],
    cache_text: Optional[str],
    calendar_context: Optional[str],
) -> str:
    """Combine workspace, cache, and calendar context into a single string."""
    parts = [workspace_context]
    
    if cache_text and cache_text.strip():
        parts.append(f"Context cache:\n{cache_text.strip()}")
    
    if calendar_context:
        parts.append(calendar_context)
    
    return "\n\n".join(filter(None, parts))


def build_effective_system_prompt(
    base_prompt: Optional[str],
    reminders_enabled: bool,
    needs_structured_tools: bool = False,
    tool_list: Optional[List[Any]] = None,
    search_enabled: bool = True,
) -> str:
    """
    Build the final system prompt with capability notes.
    
    Adds conditional sections for:
    - Reminders disabled note
    - Tool usage instructions
    - Search capability note
    """
    prompt = base_prompt or ""
    
    # Add reminders capability note if disabled
    if not reminders_enabled:
        prompt += "\n\n" + (
            "CAPABILITY NOTE:\n"
            "- Reminders & plans are disabled for this session unless explicitly enabled.\n"
            "- Do not claim that you scheduled/set reminders or created plans/habits.\n"
            "- If the user wants reminders/plans, ask them to enable the Reminders & Plans toggle."
        )
    
    # No longer adding tool instructions to system prompt - tools work better without explicit instructions
    
    # Add search capability note
    if search_enabled:
        prompt += "\n\nYou have access to Google Search. You must use it for current events, news, or factual queries where your knowledge might be outdated."
    
    return prompt


def consolidate_gemini_tools(tool_list: List[Any]) -> List[Any]:
    """
    Consolidate Gemini tools into a single Tool object.
    
    Gemini performs better when all function declarations, search, URL context,
    and maps are bundled into a single Tool object.
    """
    if not tool_list or types is None:
        return tool_list
    
    all_declarations = []
    search_instance = None
    url_context_instance = None
    maps_instance = None
    
    for t in tool_list:
        if hasattr(t, 'function_declarations') and t.function_declarations:
            all_declarations.extend(t.function_declarations)
        if hasattr(t, 'google_search') and t.google_search:
            search_instance = t.google_search
        if hasattr(t, 'url_context') and t.url_context:
            url_context_instance = t.url_context
        if hasattr(t, 'google_maps') and t.google_maps:
            maps_instance = t.google_maps
    
    if all_declarations or search_instance or url_context_instance or maps_instance:
        kwargs = {}
        if all_declarations:
            kwargs['function_declarations'] = all_declarations
        if search_instance:
            kwargs['google_search'] = search_instance
        if url_context_instance:
            kwargs['url_context'] = url_context_instance
        if maps_instance:
            kwargs['google_maps'] = maps_instance
        return [types.Tool(**kwargs)]
    
    return tool_list


def add_url_context_tool_if_needed(
    tool_list: List[Any],
    message_urls: List[str],
    url_context_tool: Any,
) -> List[Any]:
    """Add URL context tool if URLs are detected and tool not already present."""
    if not message_urls or not url_context_tool:
        return tool_list
    
    result = list(tool_list) if tool_list else []
    
    has_url_context = any(
        hasattr(t, 'url_context') and t.url_context is not None
        for t in result
    )
    
    if not has_url_context:
        result.append(url_context_tool)
        api_logger.info(
            f"[URL Context] Adding URL context tool for {len(message_urls)} URLs",
            extra={"event_type": "url_context_tool_added", "url_count": len(message_urls)}
        )
    
    return result


def build_maps_tool_and_config(
    maps_enabled: bool,
    maps_latitude: Optional[float],
    maps_longitude: Optional[float],
    maps_widget: bool,
) -> Tuple[List[Any], Optional[Any]]:
    """Build Google Maps tool and config for Gemini."""
    if not maps_enabled:
        return [], None

    if find_spec("google.genai") is None:
        return [], None
    from google.genai import types

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
            mode="NONE" # Use string literal for flexibility
        ),
    )

    return [tool], tool_config
