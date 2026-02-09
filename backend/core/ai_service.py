"""Core AI response generation and streaming logic.

Extracted from main.py to handle the heavy lifting of AI interactions.
"""
from __future__ import annotations

import time
import asyncio
import json
import os
from typing import Any, Dict, List, Optional, Tuple, AsyncGenerator, TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    import databases

from backend.logging_config import create_logger
from backend.usage_tracker import UsageTracker, UsageLimitExceeded
from backend.openrouter_client import OpenRouterService
from backend.calendar_context import build_calendar_context
from backend.calendar_tools import CALENDAR_TOOLS
from backend.plan_tools import PLAN_TOOLS
from backend.tier_utils import normalize_plan_tier
from backend.core.ai_config import (
    get_default_chat_tools,
    tier_conversation_token_limit as _tier_conversation_token_limit,
)
from backend.core.ai_utils import (
    materialize_structured_reminders,
    fallback_title_from_message,
    openrouter_annotations_to_grounding,
    validate_json_text_against_schema,
)
from backend.core.cache import load_context_cache as _load_context_cache, context_cache_contents as _context_cache_contents
from backend.core.chat_history import normalize_conversation_history
from backend.core.message_detection import (
    should_expose_structured_tools as _should_expose_structured_tools,
    extract_urls_from_message as _extract_urls_from_message,
)
from backend.core.media_attachments import (
    resolve_media_attachments as _resolve_media_attachments,
    generate_image_descriptions as _generate_image_descriptions,
)
from backend.core.serializers import row_get as _row_get
from backend.core.stream_handlers.context import (
    build_intent_window_text,
    determine_provider_and_model,
)
from backend.core.stream_handlers.openrouter import stream_openrouter_response
from backend.core.tool_execution import execute_function_call as _execute_function_call
from backend.supermemory import (
    SUPERMEMORY_SERVICE,
    SupermemoryOverrides,
    supermemory_force_enabled,
    supermemory_force_overrides,
    supermemory_force_plan_tier,
)
from backend.supermemory_tools import SUPERMEMORY_TOOLS

OPENROUTER_SERVICE = OpenRouterService()
DEFAULT_CHAT_TOOLS = get_default_chat_tools()
SEARCH_TOOL = None

DEFAULT_HISTORY_TAIL_TURNS = 8
DEFAULT_RECALL_EVERY_N = 1
DEFAULT_RECALL_MIN_PROMPT_CHARS = 0
WEB_SEARCH_RUNTIME_NOTE = (
    "You have access to web search. Use it for current events, news, and factual queries where your knowledge may be outdated. "
    "Keep search queries concise and user-facing. Never expose chain-of-thought or <thinking> tags in the final answer. "
    "Do not claim that you cannot browse or that your knowledge is cutoff when web search is available."
)


def _get_history_tail_turns() -> int:
    raw = os.getenv("GRAY_HISTORY_TAIL_TURNS")
    if raw is None or raw.strip() == "":
        return DEFAULT_HISTORY_TAIL_TURNS
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return DEFAULT_HISTORY_TAIL_TURNS


def _history_tail_force_enabled() -> bool:
    raw = os.getenv("GRAY_HISTORY_TAIL_FORCE")
    if raw is None:
        return True
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _get_recall_every_n() -> int:
    raw = os.getenv("GRAY_SUPERMEMORY_RECALL_EVERY_N")
    if raw is None or raw.strip() == "":
        return DEFAULT_RECALL_EVERY_N
    try:
        return int(raw)
    except (TypeError, ValueError):
        return DEFAULT_RECALL_EVERY_N


def _get_recall_min_prompt_chars() -> int:
    raw = os.getenv("GRAY_SUPERMEMORY_MIN_PROMPT_CHARS")
    if raw is None or raw.strip() == "":
        return DEFAULT_RECALL_MIN_PROMPT_CHARS
    try:
        return int(raw)
    except (TypeError, ValueError):
        return DEFAULT_RECALL_MIN_PROMPT_CHARS


def _count_user_turns(history: Optional[List[Dict[str, Any]]]) -> int:
    if not history:
        return 0
    return sum(1 for entry in history if entry.get("role") == "user")


def _should_request_supermemory_recall(
    message: str,
    history: Optional[List[Dict[str, Any]]],
) -> bool:
    trimmed = (message or "").strip()
    if not trimmed:
        return False

    min_chars = max(0, _get_recall_min_prompt_chars())
    if min_chars > 0 and len(trimmed) < min_chars:
        return False

    every_n = _get_recall_every_n()
    if every_n <= 1:
        return True

    turn_index = _count_user_turns(history) + 1
    return turn_index % every_n == 0


def _trim_history_by_turns(
    history: Optional[List[Dict[str, Any]]],
    max_turns: int,
) -> List[Dict[str, Any]]:
    if not history or max_turns <= 0:
        return []
    user_turns = 0
    start_idx = 0
    for idx in range(len(history) - 1, -1, -1):
        if history[idx].get("role") == "user":
            user_turns += 1
            if user_turns >= max_turns:
                start_idx = idx
                break
    if user_turns < max_turns:
        return history
    return history[start_idx:]


def _should_trim_history(
    *,
    conversation_memory_enabled: bool,
    plan_tier: Optional[str],
    supermemory_overrides: Optional[SupermemoryOverrides],
) -> bool:
    if _history_tail_force_enabled():
        return True
    if not conversation_memory_enabled or not SUPERMEMORY_SERVICE.available:
        return False
    policy = SUPERMEMORY_SERVICE.policy_for_tier(plan_tier)
    if not policy.enabled:
        return False
    if supermemory_overrides is not None:
        policy = SUPERMEMORY_SERVICE._apply_overrides(policy, supermemory_overrides)
    return policy.auto_recall


def _resolve_moltbot_headers(
    conversation_id: Optional[str],
    user_id: Optional[int],
) -> Optional[Dict[str, str]]:
    provider = (os.getenv("AI_PROVIDER") or "openrouter").strip().lower()
    if provider != "moltbot":
        return None
    agent_id = (os.getenv("MOLTBOT_AGENT_ID") or "main").strip().lower() or "main"
    if conversation_id:
        main_key = f"gray:{conversation_id}"
    elif user_id is not None:
        main_key = f"gray-user:{user_id}"
    else:
        main_key = "gray"
    session_key = f"agent:{agent_id}:{main_key}"
    return {
        "X-Gray-Session-Key": session_key,
        "X-Gray-Agent-Id": agent_id,
    }


def _resolve_openrouter_user(user_id: Optional[int]) -> Optional[str]:
    if user_id is None:
        return None
    return f"gray-user:{user_id}"


def _get_api_logger():
    return create_logger("backend.api")


def _has_onboarding_tool(tools: Optional[List[Any]]) -> bool:
    """Check if the tools list contains the complete_onboarding function."""
    if not tools:
        return False
    for tool in tools:
        declarations = getattr(tool, "function_declarations", None)
        if not declarations:
            continue
        for declaration in declarations:
            if getattr(declaration, "name", None) == "complete_onboarding":
                return True
    return False

def _build_openrouter_response_format(
    response_schema: Optional[Dict[str, Any]],
    response_mime_type: Optional[str],
) -> Optional[Dict[str, Any]]:
    if response_mime_type and response_mime_type != "application/json":
        return None
    if response_schema and isinstance(response_schema, dict):
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "response",
                "schema": response_schema,
                "strict": True,
            },
        }
    if response_mime_type == "application/json":
        return {"type": "json_object"}
    return None


def _extract_openrouter_usage_counts(usage: Optional[Dict[str, Any]]) -> Tuple[int, int, int]:
    if not isinstance(usage, dict):
        return 0, 0, 0
    prompt_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    cached_tokens = int(usage.get("cached_tokens") or usage.get("cache_read_input_tokens") or 0)
    details = usage.get("prompt_tokens_details") or usage.get("input_tokens_details")
    if isinstance(details, dict):
        cached_tokens = max(cached_tokens, int(details.get("cached_tokens") or 0))
    return prompt_tokens, completion_tokens, cached_tokens


def _build_web_search_plugin(
    search_enabled: bool,
    engine: Optional[str],
    max_results: Optional[int],
    search_prompt: Optional[str],
) -> Optional[List[Dict[str, Any]]]:
    if not search_enabled:
        return None
    plugin: Dict[str, Any] = {"id": "web"}
    requested_engine = (engine or "").strip().lower()
    # OpenRouter accepts only specific values when engine is provided.
    # Leaving engine unset is the safest default routing path.
    if requested_engine == "exa":
        plugin["engine"] = "exa"
    if isinstance(max_results, int) and max_results > 0:
        plugin["max_results"] = max_results
    if search_prompt:
        plugin["search_prompt"] = search_prompt
    return [plugin]


def _build_web_search_options(search_context_size: Optional[str]) -> Optional[Dict[str, Any]]:
    if not search_context_size:
        return None
    normalized = search_context_size.strip().lower()
    if normalized not in {"low", "medium", "high"}:
        return None
    return {"search_context_size": normalized}


def _with_web_search_runtime_note(
    time_context: Optional[str],
    *,
    search_enabled: bool,
) -> Optional[str]:
    if not search_enabled:
        return time_context
    return "\n\n".join(filter(None, [time_context, WEB_SEARCH_RUNTIME_NOTE]))

def _get_deps():
    tier_conversation_token_limit = lambda plan_tier, model_id=None: _tier_conversation_token_limit(  # noqa: E731
        plan_tier,
        normalize_fn=normalize_plan_tier,
        model_id=model_id,
        model_limit_fn=OPENROUTER_SERVICE.get_model_context_limit if model_id else None,
    )

    return {
        "OPENROUTER_SERVICE": OPENROUTER_SERVICE,
        "UsageTracker": UsageTracker,
        "UsageLimitExceeded": UsageLimitExceeded,
        "normalize_conversation_history": normalize_conversation_history,
        "tier_conversation_token_limit": tier_conversation_token_limit,
        "build_intent_window_text": build_intent_window_text,
        "determine_provider_and_model": determine_provider_and_model,
        "build_calendar_context": build_calendar_context,
        "materialize_structured_reminders": materialize_structured_reminders,
        "fallback_title_from_message": fallback_title_from_message,
        "DEFAULT_CHAT_TOOLS": DEFAULT_CHAT_TOOLS,
        "SEARCH_TOOL": SEARCH_TOOL,
        "PLAN_TOOLS": PLAN_TOOLS,
        "CALENDAR_TOOLS": CALENDAR_TOOLS,
        "_should_expose_structured_tools": _should_expose_structured_tools,
        "_extract_urls_from_message": _extract_urls_from_message,
        "_resolve_media_attachments": _resolve_media_attachments,
        "_generate_image_descriptions": _generate_image_descriptions,
        "_has_onboarding_tool": _has_onboarding_tool,
        "stream_openrouter_response": stream_openrouter_response,
        "_execute_function_call": _execute_function_call,
        "_load_context_cache": _load_context_cache,
        "_context_cache_contents": _context_cache_contents,
        "_row_get": _row_get,
        "SUPERMEMORY_TOOLS": SUPERMEMORY_TOOLS,
    }

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
    conversation_id: Optional[str] = None,
    context_cache_id: Optional[int] = None,
    search_enabled: bool = True,
    web_search_engine: Optional[str] = None,
    web_search_max_results: Optional[int] = None,
    web_search_prompt: Optional[str] = None,
    web_search_context_size: Optional[str] = None,
    should_generate_title: bool = False,
    reasoning_mode: bool = False,
    reminders_enabled: bool = False,
    tools: Optional[List[Any]] = None,
    plan_tier: Optional[str] = None,
    conversation_memory_enabled: bool = True,
    provider_routing: Optional[Dict[str, Any]] = None,
    response_schema: Optional[Dict[str, Any]] = None,
    response_mime_type: Optional[str] = None,
    supermemory_overrides: Optional[SupermemoryOverrides] = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Yield token chunks using the configured AI provider."""
    deps = _get_deps()
    api_logger = _get_api_logger()
    extra_headers = _resolve_moltbot_headers(conversation_id, user_id)
    openrouter_user = _resolve_openrouter_user(user_id)
    
    conversation_history = deps["normalize_conversation_history"](conversation_history)
    memory_history = conversation_history
    memory_enabled = conversation_memory_enabled
    force_supermemory = supermemory_force_enabled() and memory_enabled
    memory_plan_tier = supermemory_force_plan_tier(plan_tier) if force_supermemory else plan_tier
    memory_overrides = (
        supermemory_force_overrides(supermemory_overrides)
        if force_supermemory
        else supermemory_overrides
    )
    if _should_trim_history(
        conversation_memory_enabled=memory_enabled,
        plan_tier=memory_plan_tier,
        supermemory_overrides=memory_overrides,
    ):
        conversation_history = _trim_history_by_turns(
            conversation_history,
            _get_history_tail_turns(),
        )
    normalized_tier = normalize_plan_tier(plan_tier)
    has_calendar_access = normalized_tier in ("voyager", "pioneer")

    # Determine whether this turn is part of a reminder/plan/habit flow.
    intent_window_text = deps["build_intent_window_text"](message, conversation_history)

    # Respect explicit search toggle from the client.
    is_onboarding_tool = deps["_has_onboarding_tool"](tools)
    needs_structured_tools = deps["_should_expose_structured_tools"](
        intent_window_text,
        reminders_enabled=reminders_enabled,
        is_onboarding_tool=is_onboarding_tool,
    )

    # Provider/model determination
    provider, model, _ = deps["determine_provider_and_model"](
        model=model,
        openrouter_available=bool(deps["OPENROUTER_SERVICE"] and deps["OPENROUTER_SERVICE"].available),
        needs_structured_tools=needs_structured_tools,
        is_onboarding_tool=is_onboarding_tool,
    )

    response_format = _build_openrouter_response_format(response_schema, response_mime_type)

    history_token_budget = deps["tier_conversation_token_limit"](plan_tier, model)

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

    memory_context: Optional[str] = None
    if (
        memory_enabled
        and user_id is not None
        and SUPERMEMORY_SERVICE.available
        and _should_request_supermemory_recall(message, memory_history)
    ):
        t0_recall = time.perf_counter()
        try:
            memory_context = await SUPERMEMORY_SERVICE.recall_context(
                user_id=user_id,
                prompt=message,
                conversation_history=memory_history,
                plan_tier=memory_plan_tier,
                overrides=memory_overrides,
            )
        except Exception as error:
            api_logger.debug("Supermemory recall failed: %s", error)
        finally:
            api_logger.debug(
                "Supermemory recall timing",
                extra={
                    "event_type": "supermemory_recall",
                    "user_id": user_id,
                    "duration_ms": int((time.perf_counter() - t0_recall) * 1000),
                    "context_len": len(memory_context or ""),
                },
            )

    # Initialize context
    runtime_context_parts: List[str] = []
    if provider == "openrouter" and isinstance(time_context, str) and time_context.strip():
        runtime_context_parts.append(time_context.strip())
    if provider == "openrouter" and search_enabled:
        runtime_context_parts.append(WEB_SEARCH_RUNTIME_NOTE)

    workspace_with_cache = workspace_context
    cache_record = None
    cached_contents = None
    if context_cache_id:
        cache_record = await deps["_load_context_cache"](context_cache_id, user_id, db)
        cache_text = deps["_row_get"](cache_record, "content")
        if isinstance(cache_text, str) and cache_text.strip():
            workspace_with_cache = "\n\n".join(filter(None, [workspace_context, f"Context cache:\n{cache_text.strip()}"]))
        cached_contents = deps["_context_cache_contents"](cache_record)

    if has_calendar_access:
        try:
            calendar_context_block = await deps["build_calendar_context"](
                user_id=user_id,
                db=db,
                user_timezone=user_timezone,
                time_context=time_context,
            )
            if calendar_context_block:
                if provider == "openrouter":
                    runtime_context_parts.append(calendar_context_block)
                else:
                    workspace_with_cache = "\n\n".join(filter(None, [workspace_with_cache, calendar_context_block]))
        except Exception as error:
            api_logger.debug(f"Failed to build calendar context: {error}")

    if memory_context:
        if provider == "openrouter":
            runtime_context_parts.append(memory_context)
        else:
            workspace_with_cache = "\n\n".join(filter(None, [workspace_with_cache, memory_context]))

    effective_system_prompt = system_prompt
    if not reminders_enabled:
        reminders_note = (
            "CAPABILITY NOTE:\n"
            "- Reminders & plans are disabled for this session unless explicitly enabled.\n"
        )
        if provider == "openrouter":
            runtime_context_parts.append(reminders_note)
        else:
            effective_system_prompt = (effective_system_prompt or "") + "\n\n" + reminders_note

    media_attachments = await deps["_resolve_media_attachments"](db, attachments, user_id)
    
    if tools is None:
        tools = deps["DEFAULT_CHAT_TOOLS"]
        if not search_enabled:
            tools = [t for t in tools if t != deps["SEARCH_TOOL"]]
    
    tool_list = [*tools]
    memory_policy = SUPERMEMORY_SERVICE.policy_for_tier(memory_plan_tier)
    if memory_enabled and SUPERMEMORY_SERVICE.available and memory_policy.enabled:
        tool_list = [*tool_list, *deps["SUPERMEMORY_TOOLS"]]
    if needs_structured_tools:
        tool_list = [*tool_list, *deps["PLAN_TOOLS"]]
        if has_calendar_access:
            tool_list = [*tool_list, *deps["CALENDAR_TOOLS"]]

    # Routing
    if provider == "openrouter":
        if (os.getenv("AI_PROVIDER") or "openrouter").strip().lower() == "moltbot":
            # Let Moltbot manage conversation history/memory; only send the current turn.
            conversation_history = []
        if not deps["OPENROUTER_SERVICE"].available:
            error_msg = "OpenRouter service is currently unavailable."
            yield ("delta", error_msg)
            yield ("final", {"text": error_msg, "grounding_metadata": None})
            return
        
        runtime_context = "\n\n".join(runtime_context_parts) if runtime_context_parts else None
        web_search_plugin = _build_web_search_plugin(
            search_enabled,
            web_search_engine,
            web_search_max_results,
            web_search_prompt,
        )
        web_search_options = _build_web_search_options(web_search_context_size) if search_enabled else None
        async for event_type, data in deps["stream_openrouter_response"](
            openrouter_service=deps["OPENROUTER_SERVICE"],
            message=message,
            conversation_history=conversation_history,
            workspace_context=workspace_with_cache,
            system_prompt=effective_system_prompt,
            time_context=runtime_context,
            model=model,
            tool_list=tool_list,
            search_enabled=search_enabled,
            reasoning_mode=reasoning_mode,
            media_attachments=media_attachments,
            history_token_budget=history_token_budget,
            user_id=user_id,
            user=openrouter_user,
            needs_structured_tools=needs_structured_tools,
            is_onboarding_tool=is_onboarding_tool,
            response_format=response_format,
            response_schema=response_schema,
            provider_routing=provider_routing,
            web_search_plugin=web_search_plugin,
            web_search_options=web_search_options,
            execute_function_call_fn=deps["_execute_function_call"],
            db=db,
            user_timezone=user_timezone,
            plan_tier=plan_tier,
            usage_tracker_cls=deps["UsageTracker"],
            extra_headers=extra_headers,
        ):
            yield (event_type, data)
        return

    raise RuntimeError("OpenRouter service unavailable")

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
    conversation_id: Optional[str] = None,
    context_cache_id: Optional[int] = None,
    *,
    search_enabled: bool = True,
    web_search_engine: Optional[str] = None,
    web_search_max_results: Optional[int] = None,
    web_search_prompt: Optional[str] = None,
    web_search_context_size: Optional[str] = None,
    tools: Optional[List[Any]] = None,
    plan_tier: Optional[str] = None,
    response_schema: Optional[Dict[str, Any]] = None,
    response_mime_type: Optional[str] = None,
    conversation_memory_enabled: bool = True,
    provider_routing: Optional[Dict[str, Any]] = None,
    supermemory_overrides: Optional[SupermemoryOverrides] = None,
    **kwargs,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Generate a non-streaming AI response."""
    deps = _get_deps()
    api_logger = _get_api_logger()
    extra_headers = _resolve_moltbot_headers(conversation_id, user_id)
    openrouter_user = _resolve_openrouter_user(user_id)
    
    # Simple implementation leveraging stream logic or provider direct calls
    # For brevity, typically we'd use provider_service.generate()
    # But often non-streaming is used for specific tasks like title generation.
    conversation_history = deps["normalize_conversation_history"](conversation_history)
    memory_history = conversation_history
    memory_enabled = conversation_memory_enabled
    force_supermemory = supermemory_force_enabled() and memory_enabled
    memory_plan_tier = supermemory_force_plan_tier(plan_tier) if force_supermemory else plan_tier
    memory_overrides = (
        supermemory_force_overrides(supermemory_overrides)
        if force_supermemory
        else supermemory_overrides
    )
    if _should_trim_history(
        conversation_memory_enabled=memory_enabled,
        plan_tier=memory_plan_tier,
        supermemory_overrides=memory_overrides,
    ):
        conversation_history = _trim_history_by_turns(
            conversation_history,
            _get_history_tail_turns(),
        )

    intent_window_text = deps["build_intent_window_text"](message, conversation_history)
    reminders_enabled = bool(kwargs.get("reminders_enabled", True))
    is_onboarding_tool = deps["_has_onboarding_tool"](tools)
    needs_structured_tools = deps["_should_expose_structured_tools"](
        intent_window_text,
        reminders_enabled=reminders_enabled,
        is_onboarding_tool=is_onboarding_tool,
    )

    provider, model, _ = deps["determine_provider_and_model"](
        model=model,
        openrouter_available=bool(deps["OPENROUTER_SERVICE"] and deps["OPENROUTER_SERVICE"].available),
        needs_structured_tools=needs_structured_tools,
        is_onboarding_tool=is_onboarding_tool,
    )
    history_token_budget = deps["tier_conversation_token_limit"](plan_tier, model)

    workspace_with_cache = workspace_context
    if context_cache_id and user_id is not None and db is not None:
        try:
            cache_record = await deps["_load_context_cache"](context_cache_id, user_id, db)
            cache_text = deps["_row_get"](cache_record, "content")
            if isinstance(cache_text, str) and cache_text.strip():
                workspace_with_cache = "\n\n".join(
                    filter(None, [workspace_context, f"Context cache:\n{cache_text.strip()}"])
                )
        except Exception as cache_error:
            api_logger.debug("Failed to load context cache: %s", cache_error)

    memory_context: Optional[str] = None
    if (
        memory_enabled
        and user_id is not None
        and SUPERMEMORY_SERVICE.available
        and _should_request_supermemory_recall(message, memory_history)
    ):
        t0_recall = time.perf_counter()
        try:
            memory_context = await SUPERMEMORY_SERVICE.recall_context(
                user_id=user_id,
                prompt=message,
                conversation_history=memory_history,
                plan_tier=memory_plan_tier,
                overrides=memory_overrides,
            )
        except Exception as error:
            api_logger.debug("Supermemory recall failed: %s", error)
        finally:
            api_logger.debug(
                "Supermemory recall timing",
                extra={
                    "event_type": "supermemory_recall",
                    "user_id": user_id,
                    "duration_ms": int((time.perf_counter() - t0_recall) * 1000),
                    "context_len": len(memory_context or ""),
                },
            )

    if memory_context:
        time_context = "\n\n".join(filter(None, [time_context, memory_context]))

    media_attachments: List[Any] = []
    if attachments and user_id is not None and db is not None:
        try:
            media_attachments = await deps["_resolve_media_attachments"](db, attachments, user_id)
        except Exception as error:
            api_logger.debug(f"Failed to resolve media attachments: {error}")
    
    response_format = _build_openrouter_response_format(response_schema, response_mime_type)

    if provider == "openrouter":
        if (os.getenv("AI_PROVIDER") or "openrouter").strip().lower() == "moltbot":
            conversation_history = []
        time_context = _with_web_search_runtime_note(
            time_context,
            search_enabled=search_enabled,
        )
        web_search_plugin = _build_web_search_plugin(
            search_enabled,
            web_search_engine,
            web_search_max_results,
            web_search_prompt,
        )
        web_search_options = _build_web_search_options(web_search_context_size) if search_enabled else None
        result = await deps["OPENROUTER_SERVICE"].generate(
            message,
            conversation_history,
            workspace_with_cache,
            system_prompt,
            time_context,
            model,
            attachments=media_attachments or None,
            plugins=web_search_plugin,
            response_format=response_format,
            provider_routing=provider_routing,
            web_search_options=web_search_options,
            return_metadata=True,
            history_token_budget=history_token_budget,
            user=openrouter_user,
            extra_headers=extra_headers,
        )

        if isinstance(result, tuple):
            text, metadata = result
        else:
            text, metadata = result, None

        if response_schema and response_format:
            is_valid, error = validate_json_text_against_schema(text, response_schema)
            if not is_valid:
                api_logger.warning(
                    f"OpenRouter JSON validation failed: {error}",
                    extra={"event_type": "openrouter_json_validation_failed", "error": error},
                )
                repair_prompt = (
                    "Fix the following JSON so it matches the provided schema. "
                    "Return ONLY valid JSON that conforms to the schema.\n\n"
                    f"Schema:\n{json.dumps(response_schema)}\n\nJSON:\n{text}"
                )
                repaired = await deps["OPENROUTER_SERVICE"].generate(
                    repair_prompt,
                    conversation_history=None,
                    workspace_context=None,
                    system_prompt="You are a JSON repair assistant.",
                    time_context=None,
                    model=model,
                    response_format=response_format,
                    provider_routing=provider_routing,
                    return_metadata=False,
                )
                if isinstance(repaired, str) and repaired.strip():
                    text = repaired

        grounding_metadata = openrouter_annotations_to_grounding((metadata or {}).get("annotations"))

        if metadata and metadata.get("usage") and user_id is not None and db is not None:
            prompt_tokens, completion_tokens, cached_tokens = _extract_openrouter_usage_counts(metadata.get("usage"))
            if prompt_tokens or completion_tokens or cached_tokens:
                tracker = deps["UsageTracker"](db)
                try:
                    billable_prompt_tokens = max(prompt_tokens - min(cached_tokens, prompt_tokens), 0)
                    await tracker.track_usage(
                        user_id,
                        billable_prompt_tokens,
                        completion_tokens,
                        cached_tokens=cached_tokens,
                        model=model,
                    )
                except Exception as usage_error:
                    api_logger.warning(f"Failed to track OpenRouter usage: {usage_error}", extra={"user_id": user_id})

        return text, grounding_metadata
    
    return "OpenRouter service unavailable", None

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
    
    from backend.core.chat_starter_helpers import (
        starter_profile_context,
        build_starter_prompt,
        starter_fallback_message,
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
            conversation_memory_enabled=False,
        )
        cleaned = (response_text or "").strip()
        if not cleaned:
            raise RuntimeError("Starter response was empty")
        return cleaned, False
    except Exception as error:
        api_logger.error(f"Chat starter generation failed: {error}", exc_info=True)
        return fallback_message, True
