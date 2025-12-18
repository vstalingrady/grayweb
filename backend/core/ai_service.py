"""Core AI response generation and streaming logic.

Extracted from main.py to handle the heavy lifting of AI interactions.
"""
from __future__ import annotations

import time
import asyncio
from typing import Any, Dict, List, Optional, Tuple, AsyncGenerator, TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    import databases

# Global API logger
def _get_api_logger():
    try:
        from backend.logging_config import create_logger
    except ImportError:
        from logging_config import create_logger
    return create_logger("backend.api")

# Lazy imports for core functions
def _get_deps():
    try:
        from backend.main import (
            GEMINI_SERVICE,
            OPENROUTER_SERVICE,
            UsageTracker,
            UsageLimitExceeded,
            GEMINI_DEFAULT_MODEL,
        )
        from backend.compat_imports import (
            normalize_conversation_history,
            tier_conversation_token_limit,
            build_intent_window_text,
            determine_provider_and_model,
            add_maps_tool_if_needed,
            consolidate_gemini_tools,
            add_url_context_tool_if_needed,
            build_calendar_context,
            build_maps_tool_and_config,
            materialize_structured_reminders,
            fallback_title_from_message,
        )
        from backend.core.ai_config import (
            DEFAULT_CHAT_TOOLS,
            SEARCH_TOOL,
            PLAN_TOOLS,
            CALENDAR_TOOLS,
            URL_CONTEXT_TOOL,
        )
        from backend.core.message_detection import (
            needs_structured_tools as _needs_structured_tools,
            should_request_structured_reminders as _should_request_structured_reminders,
            should_enable_search as _should_enable_search,
            extract_urls_from_message as _extract_urls_from_message,
        )
        from backend.core.media_attachments import (
            resolve_media_attachments as _resolve_media_attachments,
            generate_image_descriptions as _generate_image_descriptions,
        )
        from backend.core.conversation_manager import (
            execute_tools_with_gemini_flash as _execute_tools_with_gemini_flash_hybrid,
            format_tool_results_for_context as _format_tool_results_for_context,
            has_onboarding_tool as _has_onboarding_tool_hybrid,
            fetch_url_context_with_gemini as _fetch_url_context_with_gemini_hybrid,
        )
        from backend.core.stream_handlers.openrouter import stream_openrouter_response
        from backend.core.stream_handlers.gemini import stream_gemini_response
        from backend.core.tool_execution import execute_function_call as _execute_function_call
        from backend.core.cache import (
            load_context_cache as _load_context_cache,
            context_cache_contents as _context_cache_contents,
        )
        from backend.core.serializers import row_get as _row_get
    except ImportError:
        # Fallback for local dev/different paths
        pass
    return locals()

async def stream_ai_response(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    model: Optional[str] = None,
    attachments: Optional[List[Any]] = None,
    *,
    user_id: int,
    db: Any,
    user_timezone: Optional[str] = None,
    context_cache_id: Optional[int] = None,
    maps_enabled: bool = False,
    maps_latitude: Optional[float] = None,
    maps_longitude: Optional[float] = None,
    maps_widget: bool = False,
    search_enabled: bool = True,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    reminders_enabled: bool = False,
    tools: Optional[List[Any]] = None,
    plan_tier: Optional[str] = None,
    provider_routing: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Yield token chunks using the configured AI provider."""
    deps = _get_deps()
    api_logger = _get_api_logger()
    
    conversation_history = deps["normalize_conversation_history"](conversation_history)
    history_token_budget = deps["tier_conversation_token_limit"](plan_tier)

    # Determine whether this turn is part of a reminder/plan/habit flow.
    intent_window_text = deps["build_intent_window_text"](message, conversation_history)

    request_structured_reminders = deps["_should_request_structured_reminders"](intent_window_text)
    needs_structured_tools = reminders_enabled or request_structured_reminders or deps["_needs_structured_tools"](intent_window_text)

    if needs_structured_tools:
        request_structured_reminders = True

    if not search_enabled and deps["_should_enable_search"](message):
        api_logger.info(f"Auto-enabling search for message: {message[:50]}...")
        search_enabled = True

    is_onboarding_tool = deps["_has_onboarding_tool_hybrid"](tools)

    # Provider/model determination
    provider, model, _ = deps["determine_provider_and_model"](
        model=model,
        openrouter_available=bool(deps["OPENROUTER_SERVICE"] and deps["OPENROUTER_SERVICE"].available),
        gemini_default_model=deps["GEMINI_SERVICE"].default_model if deps["GEMINI_SERVICE"] else deps["GEMINI_DEFAULT_MODEL"],
        needs_structured_tools=needs_structured_tools,
        is_onboarding_tool=is_onboarding_tool,
        maps_enabled=maps_enabled,
    )
    
    if maps_enabled:
        tools = deps["add_maps_tool_if_needed"](tools, maps_enabled)

    # Check usage limits
    if user_id is not None and db is not None:
        tracker = deps["UsageTracker"](db)
        try:
            await tracker.check_limits(user_id, model=model)
        except deps["UsageLimitExceeded"] as e:
            reset_msg = ""
            if e.next_reset_time:
                reset_msg = f"\n\nLimit resets at {e.next_reset_time.strftime('%Y-%m-%d %H:%M')} UTC."

            limit_msg = (
                f"**Usage Limit Reached**\n\n"
                f"I've hit the usage cap for your **{e.tier.capitalize()}** plan. {e.message}{reset_msg}\n\n"
                f"To keep chatting without interruption, consider upgrading to a higher tier, or wait for the limit to reset."
            )
            yield ("delta", limit_msg)
            yield ("final", {"text": limit_msg, "grounding_metadata": None})
            return

    # Initialize context
    workspace_with_cache = workspace_context
    if context_cache_id:
        cache_record = await deps["_load_context_cache"](context_cache_id, user_id, db)
        cache_text = deps["_row_get"](cache_record, "content")
        if isinstance(cache_text, str) and cache_text.strip():
            workspace_with_cache = "\n\n".join(filter(None, [workspace_context, f"Context cache:\n{cache_text.strip()}"]))

    try:
        calendar_context_block = await deps["build_calendar_context"](
            user_id=user_id,
            db=db,
            user_timezone=user_timezone,
            time_context=time_context,
        )
        if calendar_context_block:
            workspace_with_cache = "\n\n".join(filter(None, [workspace_with_cache, calendar_context_block]))
    except Exception as error:
        api_logger.debug(f"Failed to build calendar context: {error}")

    effective_system_prompt = system_prompt
    if not reminders_enabled:
        effective_system_prompt = (effective_system_prompt or "") + "\n\n" + (
            "CAPABILITY NOTE:\n"
            "- Reminders & plans are disabled for this session unless explicitly enabled.\n"
        )

    media_attachments = await deps["_resolve_media_attachments"](db, attachments, user_id)
    
    maps_tools, maps_tool_config = deps["build_maps_tool_and_config"](
        maps_enabled, maps_latitude, maps_longitude, maps_widget
    )

    if tools is None:
        tools = deps["DEFAULT_CHAT_TOOLS"]
        if not search_enabled:
            tools = [t for t in tools if t != deps["SEARCH_TOOL"]]
    
    tool_list = [*tools, *maps_tools]
    if needs_structured_tools and not is_onboarding_tool:
        tool_list = [*tool_list, *deps["PLAN_TOOLS"], *deps["CALENDAR_TOOLS"]]

    # Routing
    if provider == "openrouter":
        if not deps["OPENROUTER_SERVICE"].available:
            error_msg = "OpenRouter service is currently unavailable."
            yield ("delta", error_msg)
            yield ("final", {"text": error_msg, "grounding_metadata": None})
            return
        
        # Hybrid URL fetching
        message_urls = deps["_extract_urls_from_message"](message)
        if message_urls and deps["GEMINI_SERVICE"].available:
            url_content, _ = await deps["_fetch_url_context_with_gemini_hybrid"](
                deps["GEMINI_SERVICE"], message, message_urls, workspace_with_cache, time_context
            )
            if url_content:
                workspace_with_cache = "\n\n".join(filter(None, [
                    workspace_with_cache, f"--- URL Content ---\n{url_content}\n--- End URL Content ---"
                ]))

        # Hybrid tool execution
        use_hybrid_tools = needs_structured_tools and not is_onboarding_tool and deps["GEMINI_SERVICE"].available
        hybrid_tool_results = []
        if use_hybrid_tools:
            hybrid_tool_results, hybrid_tool_cards, _ = await deps["_execute_tools_with_gemini_flash_hybrid"](
                deps["GEMINI_SERVICE"], deps["_execute_function_call"], message, conversation_history,
                tool_list, (effective_system_prompt or "") + "\n\nTool Use Instructions...",
                time_context, workspace_with_cache, user_id, db, user_timezone, history_token_budget
            )
            for card in hybrid_tool_cards:
                yield ("reminders", [card])
            
            if hybrid_tool_results:
                tool_context = deps["_format_tool_results_for_context"](hybrid_tool_results)
                if tool_context:
                    workspace_with_cache = "\n\n".join(filter(None, [workspace_with_cache, tool_context]))
                tool_list = []

        async for event_type, data in deps["stream_openrouter_response"](
            openrouter_service=deps["OPENROUTER_SERVICE"],
            message=message,
            conversation_history=conversation_history,
            workspace_context=workspace_with_cache,
            system_prompt=effective_system_prompt,
            time_context=time_context,
            model=model,
            tool_list=tool_list,
            search_enabled=search_enabled,
            reasoning_mode=reasoning_mode,
            media_attachments=media_attachments,
            history_token_budget=history_token_budget,
            user_id=user_id,
            needs_structured_tools=needs_structured_tools,
            is_onboarding_tool=is_onboarding_tool,
            provider_routing=provider_routing,
            execute_function_call_fn=deps["_execute_function_call"],
            db=db,
            user_timezone=user_timezone,
            hybrid_tool_results=hybrid_tool_results if use_hybrid_tools else None,
            usage_tracker_cls=deps["UsageTracker"],
        ):
            yield (event_type, data)
        return

    # Gemini native streaming
    if provider == "gemini" and deps["GEMINI_SERVICE"].available:
        # URL Context
        message_urls = deps["_extract_urls_from_message"](message)
        if message_urls:
            tool_list = deps["add_url_context_tool_if_needed"](tool_list or [], message_urls, deps["URL_CONTEXT_TOOL"])
        
        if tool_list:
            tool_list = deps["consolidate_gemini_tools"](tool_list)

        async for event_type, data in deps["stream_gemini_response"](
            gemini_service=deps["GEMINI_SERVICE"],
            message=message,
            conversation_history=conversation_history,
            workspace_context=workspace_with_cache,
            system_prompt=effective_system_prompt,
            time_context=time_context,
            model=model,
            tool_list=tool_list,
            tool_config=maps_tool_config,
            reasoning_mode=reasoning_mode,
            media_attachments=media_attachments,
            history_token_budget=history_token_budget,
            user_id=user_id,
            execute_function_call_fn=deps["_execute_function_call"],
            db=db,
            user_timezone=user_timezone,
            usage_tracker_cls=deps["UsageTracker"],
        ):
            yield (event_type, data)
        return

    raise RuntimeError("AI service unavailable")

async def generate_ai_response(
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    model: Optional[str] = None,
    attachments: Optional[List[Any]] = None,
    user_id: Optional[int] = None,
    db: Optional[Any] = None,
    user_timezone: Optional[str] = None,
    *,
    maps_enabled: bool = False,
    maps_latitude: Optional[float] = None,
    maps_longitude: Optional[float] = None,
    maps_widget: bool = False,
    search_enabled: bool = True,
    tools: Optional[List[Any]] = None,
    plan_tier: Optional[str] = None,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Generate a non-streaming AI response."""
    deps = _get_deps()
    api_logger = _get_api_logger()
    
    # Simple implementation leveraging stream logic or provider direct calls
    # For brevity, typically we'd use provider_service.generate()
    # But often non-streaming is used for specific tasks like title generation.
    
    provider, model, _ = deps["determine_provider_and_model"](
        model=model,
        openrouter_available=bool(deps["OPENROUTER_SERVICE"] and deps["OPENROUTER_SERVICE"].available),
        gemini_default_model=deps["GEMINI_SERVICE"].default_model if deps["GEMINI_SERVICE"] else deps["GEMINI_DEFAULT_MODEL"],
    )
    
    if provider == "openrouter":
        return await deps["OPENROUTER_SERVICE"].generate(
            message, conversation_history, workspace_context, system_prompt, 
            time_context, model
        ), None
    
    if provider == "gemini":
        # Gemini non-streaming
        response = await deps["GEMINI_SERVICE"].generate_response(
            message, conversation_history, workspace_context, system_prompt,
            tools=tools, model=model
        )
        return response.text, None
        
    return "AI service unavailable", None

async def generate_chat_starter(
    user_id: int,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    user_nickname: Optional[str] = None,
    user_about: Optional[str] = None,
    user_name: Optional[str] = None,
    user_occupation: Optional[str] = None,
    custom_instructions: Optional[str] = None,
    prompt_locale: str = "en",
) -> Tuple[str, bool]:
    """Generate a персонализированное greeting for the user. Returns (message, used_fallback)."""
    deps = _get_deps()
    api_logger = _get_api_logger()
    
    # Mocking ChatStarterRequest fields for helper compatibility
    class SimplePayload:
        def __init__(self, **kwargs):
            self.user_id = kwargs.get("user_id")
            self.nickname = kwargs.get("user_nickname")
            self.about = kwargs.get("user_about")
            self.name = kwargs.get("user_name")
            self.occupation = kwargs.get("user_occupation")
            self.custom_instructions = kwargs.get("custom_instructions")
            self.workspace_context = kwargs.get("workspace_context")
            self.system_prompt = kwargs.get("system_prompt")
            self.time_context = kwargs.get("time_context")

    payload = SimplePayload(
        user_id=user_id,
        user_nickname=user_nickname,
        user_about=user_about,
        user_name=user_name,
        user_occupation=user_occupation,
        custom_instructions=custom_instructions,
        workspace_context=workspace_context,
        system_prompt=system_prompt,
        time_context=time_context
    )
    
    try:
        from backend.core.chat_starter_helpers import (
            starter_profile_context, 
            build_starter_prompt, 
            starter_fallback_message
        )
    except ImportError:
        from core.chat_starter_helpers import (
            starter_profile_context, 
            build_starter_prompt, 
            starter_fallback_message
        )
        
    profile_context = starter_profile_context(payload)
    prompt = build_starter_prompt(payload, profile_context, prompt_locale)
    fallback_message = starter_fallback_message(payload)
    
    try:
        api_logger.info("Generating chat starter", extra={"user_id": user_id})
        response_text, _ = await generate_ai_response(
            message=prompt,
            conversation_history=[],
            workspace_context=workspace_context,
            system_prompt=system_prompt,
            time_context=time_context,
            user_id=user_id,
            search_enabled=False,
        )
        cleaned = (response_text or "").strip()
        if not cleaned:
            raise RuntimeError("Starter response was empty")
        return cleaned, False
    except Exception as error:
        api_logger.error(f"Chat starter generation failed: {error}", exc_info=True)
        return fallback_message, True
