"""
Provider Routing Module

Handles AI provider selection and model routing logic.
Extracted from main.py to reduce duplication between stream_ai_response and generate_ai_response.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

try:
    from google.genai import types
except ImportError:
    types = None  # type: ignore

try:
    from backend.core.ai_config import (
        AI_PROVIDER,
        REMINDER_MODEL,
        OPENROUTER_LITE_MODEL,
        GEMINI_DEFAULT_MODEL,
        GEMINI_LIGHT_MODEL,
        GEMINI_PRO_MODEL,
    )
except ImportError:
    from core.ai_config import (  # type: ignore
        AI_PROVIDER,
        REMINDER_MODEL,
        OPENROUTER_LITE_MODEL,
        GEMINI_DEFAULT_MODEL,
        GEMINI_LIGHT_MODEL,
        GEMINI_PRO_MODEL,
    )

try:
    from backend.core.ai_utils import prefers_gemini_model
except ImportError:
    from core.ai_utils import prefers_gemini_model  # type: ignore

api_logger = logging.getLogger("backend.api")

# Tier aliases that map to specific providers
TIER_ALIASES = {"lite", "gray-lite", "pro", "gray-pro"}
PIONEER_ALIAS = "pioneer"
DEFAULT_PIONEER_MODEL = "anthropic/claude-sonnet-4.5"


class ProviderRoutingResult:
    """Result of provider routing decision."""
    
    def __init__(
        self,
        provider: str,
        model: Optional[str],
        is_tier_alias: bool = False,
        needs_gemini_for_tools: bool = False,
    ):
        self.provider = provider
        self.model = model
        self.is_tier_alias = is_tier_alias
        self.needs_gemini_for_tools = needs_gemini_for_tools


def determine_provider_and_model(
    model: Optional[str],
    openrouter_available: bool,
    gemini_available: bool,
    gemini_default_model: Optional[str] = None,
    needs_structured_tools: bool = False,
    is_onboarding_tool: bool = False,
    maps_enabled: bool = False,
) -> ProviderRoutingResult:
    """
    Determine the AI provider and model based on request parameters.
    
    Args:
        model: The requested model string
        openrouter_available: Whether OpenRouter service is available
        gemini_available: Whether Gemini service is available
        gemini_default_model: Default Gemini model from service
        needs_structured_tools: Whether structured tools (reminders, plans) are needed
        is_onboarding_tool: Whether onboarding tool is being used
        maps_enabled: Whether Google Maps integration is enabled
        
    Returns:
        ProviderRoutingResult with provider and model information
    """
    explicit_model = (model or "").strip()
    normalized_model = explicit_model.lower()
    is_tier_alias = normalized_model in TIER_ALIASES
    
    provider: Optional[str] = None
    result_model = model
    
    # 1. Respect explicit tier aliases first
    if normalized_model in TIER_ALIASES:
        # Lite/Pro tier routing: use OpenRouter with Grok 4.1 Fast
        if openrouter_available:
            provider = "openrouter"
            result_model = OPENROUTER_LITE_MODEL
        else:
            provider = "gemini"
            result_model = GEMINI_LIGHT_MODEL
            
    elif normalized_model == PIONEER_ALIAS:
        # Pioneer tier is a direct OpenRouter passthrough
        if openrouter_available:
            provider = "openrouter"
            # Keep the model as-is if it contains a slash (specific model ID)
            if "/" not in explicit_model:
                result_model = DEFAULT_PIONEER_MODEL
        else:
            provider = "gemini"
            result_model = GEMINI_LIGHT_MODEL
            
    elif normalized_model.startswith("models/") or normalized_model.startswith("gemini"):
        provider = "gemini"
        
    elif normalized_model.startswith("openrouter") or "/" in normalized_model:
        # Any model with a slash routes through OpenRouter
        provider = "openrouter"
    
    # 2. Handle tool routing
    needs_gemini_for_tools = False
    if needs_structured_tools or is_onboarding_tool:
        if provider == "openrouter":
            pass  # OpenRouter will handle tools directly
        elif provider == "gemini":
            pass  # Already Gemini
        else:
            # No provider set yet, fallback to Gemini
            provider = "gemini"
            if not is_tier_alias:
                result_model = REMINDER_MODEL if needs_structured_tools else gemini_default_model
            needs_gemini_for_tools = True
    elif not provider:
        # Default to Gemini for fastest streaming
        provider = "gemini"
    
    # 3. Maps grounding requires Gemini
    if maps_enabled:
        provider = "gemini"
    
    return ProviderRoutingResult(
        provider=provider or "gemini",
        model=result_model,
        is_tier_alias=is_tier_alias,
        needs_gemini_for_tools=needs_gemini_for_tools,
    )


def prepare_tool_list(
    base_tools: Optional[List[Any]],
    search_enabled: bool,
    search_tool: Any,
    needs_structured_tools: bool,
    is_onboarding_tool: bool,
    plan_tools: List[Any],
    calendar_tools: List[Any],
    maps_tools: List[Any],
) -> List[Any]:
    """
    Prepare the final tool list based on request configuration.
    
    Args:
        base_tools: Base tools list (or None to use defaults)
        search_enabled: Whether search is enabled
        search_tool: The search tool instance
        needs_structured_tools: Whether structured tools are needed
        is_onboarding_tool: Whether onboarding is active
        plan_tools: Plan/habit/reminder tools
        calendar_tools: Calendar tools
        maps_tools: Maps tools
        
    Returns:
        Final list of tools to pass to the provider
    """
    if base_tools is not None:
        tools = list(base_tools)
    else:
        tools = [search_tool] if search_enabled and search_tool else []
        
    # Add maps tools
    tools.extend(maps_tools)
    
    # Add structured tools only when needed (and not during onboarding)
    if needs_structured_tools and not is_onboarding_tool:
        tools.extend(plan_tools)
        tools.extend(calendar_tools)
        
    return tools


def consolidate_gemini_tools(tool_list: List[Any]) -> List[Any]:
    """
    Consolidate Gemini tools into a single Tool object.
    
    Gemini works best when function declarations are consolidated into
    a single Tool object rather than multiple separate tools.
    
    Args:
        tool_list: List of Tool objects
        
    Returns:
        Consolidated list with a single Tool containing all components
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
    
    # Only consolidate if we have any components
    if all_declarations or search_instance or url_context_instance or maps_instance:
        consolidated_tool_kwargs = {}
        if all_declarations:
            consolidated_tool_kwargs['function_declarations'] = all_declarations
        if search_instance:
            consolidated_tool_kwargs['google_search'] = search_instance
        if url_context_instance:
            consolidated_tool_kwargs['url_context'] = url_context_instance
        if maps_instance:
            consolidated_tool_kwargs['google_maps'] = maps_instance
            
        return [types.Tool(**consolidated_tool_kwargs)]
    
    return tool_list


def add_url_context_tool(
    tool_list: List[Any],
    url_context_tool: Any,
    message_urls: List[str],
) -> List[Any]:
    """
    Add URL context tool if URLs are detected in the message.
    
    Args:
        tool_list: Current tool list
        url_context_tool: The URL context tool instance
        message_urls: List of URLs detected in the message
        
    Returns:
        Updated tool list with URL context tool if needed
    """
    if not message_urls or not url_context_tool:
        return tool_list
        
    tools = list(tool_list) if tool_list else []
    
    # Check if URL context tool is already in the list
    has_url_context = any(
        hasattr(t, 'url_context') and t.url_context is not None 
        for t in tools
    )
    
    if not has_url_context:
        tools.append(url_context_tool)
        api_logger.info(
            f"[URL Context] Adding URL context tool for {len(message_urls)} URLs",
            extra={"event_type": "url_context_tool_added", "url_count": len(message_urls)}
        )
        
    return tools


def add_maps_tool(
    tool_list: List[Any],
    maps_enabled: bool,
) -> List[Any]:
    """
    Add Google Maps tool if maps are enabled.
    
    Args:
        tool_list: Current tool list
        maps_enabled: Whether maps are enabled
        
    Returns:
        Updated tool list with maps tool if needed
    """
    if not maps_enabled or types is None:
        return tool_list
        
    tools = list(tool_list) if tool_list else []
    
    # Check if maps tool is already present
    has_maps_tool = any(
        hasattr(t, 'google_maps') and t.google_maps
        for t in tools
    )
    
    if not has_maps_tool:
        tools.append(types.Tool(google_maps=types.GoogleMaps()))
        
    return tools
