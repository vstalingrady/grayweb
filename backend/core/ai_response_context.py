"""
AI Response Context Helpers

Shared utility functions for stream_ai_response and generate_ai_response.
Consolidates duplicated context building, tool preparation, and limit checking.
"""
from typing import Any, Dict, List, Optional, Tuple
import time
import logging

import databases

# Get logger from parent module
api_logger = logging.getLogger("gray.api")


async def load_context_cache(
    context_cache_id: Optional[int],
    user_id: int,
    db: "databases.Database",
    load_cache_fn,
    cache_contents_fn,
    row_get_fn,
) -> Tuple[Optional[Any], Optional[str]]:
    """
    Load context cache and return (cached_contents, cache_text_block).
    
    Args:
        context_cache_id: Optional cache ID
        user_id: User ID for cache lookup
        db: Database connection
        load_cache_fn: Function to load cache (_load_context_cache)
        cache_contents_fn: Function to get contents (_context_cache_contents)
        row_get_fn: Function to get row fields (_row_get)
    
    Returns:
        Tuple of (cached_contents for OpenRouter, cache_text_block for context)
    """
    if not context_cache_id:
        return None, None
    
    cache_record = await load_cache_fn(context_cache_id, user_id, db)
    cached_contents = cache_contents_fn(cache_record)
    cache_text = row_get_fn(cache_record, "content")
    
    cache_text_block = None
    if isinstance(cache_text, str) and cache_text.strip():
        cache_text_block = f"Context cache:\n{cache_text.strip()}"
    
    return cached_contents, cache_text_block


async def build_workspace_context(
    workspace_context: Optional[str],
    cache_text_block: Optional[str],
    user_id: int,
    db: "databases.Database",
    user_timezone: Optional[str],
    time_context: Optional[str],
    calendar_context_fn,
) -> str:
    """
    Build workspace context including cache and calendar.
    
    Args:
        workspace_context: Base workspace context
        cache_text_block: Optional cache text to include
        user_id: User ID
        db: Database connection
        user_timezone: User's timezone
        time_context: Time context string
        calendar_context_fn: Function to build calendar context
    
    Returns:
        Combined workspace context string
    """
    # Start with workspace + cache
    result = workspace_context
    if cache_text_block:
        result = "\n\n".join(filter(None, [workspace_context, cache_text_block]))
    
    # Add calendar context
    try:
        calendar_block = await calendar_context_fn(
            user_id=user_id,
            db=db,
            user_timezone=user_timezone,
            time_context=time_context,
        )
    except Exception as error:
        api_logger.debug(
            f"Failed to build calendar context for user {user_id}: {error}",
            extra={"event_type": "calendar_context_error", "user_id": user_id, "error": str(error)},
        )
        calendar_block = None
    
    if calendar_block:
        result = "\n\n".join(filter(None, [result, calendar_block]))
    
    return result


def prepare_tool_list(
    tools: Optional[List[Any]],
    default_chat_tools: List[Any],
    search_tool: Any,
    plan_tools: List[Any],
    calendar_tools: List[Any],
    search_enabled: bool,
    needs_structured_tools: bool,
    is_onboarding_tool: bool,
) -> List[Any]:
    """
    Prepare the tool list for AI providers.
    
    Args:
        tools: Explicit tools passed by caller
        default_chat_tools: Default tools to use
        search_tool: Search tool (to filter if disabled)
        plan_tools: Plan/reminder tools
        calendar_tools: Calendar tools
        search_enabled: Whether search is enabled
        needs_structured_tools: Whether structured tools are needed
        is_onboarding_tool: Whether in onboarding mode
    
    Returns:
        Prepared list of tools
    """
    if tools is not None:
        base_tools = tools
    else:
        base_tools = default_chat_tools
        if not search_enabled:
            base_tools = [t for t in base_tools if t != search_tool]
    
    # Common tool list
    tool_list = [*base_tools]
    
    # Add structured tools when needed (but not for onboarding)
    if needs_structured_tools and not is_onboarding_tool:
        tool_list = [*tool_list, *plan_tools, *calendar_tools]
    
    return tool_list


def build_effective_system_prompt(
    system_prompt: Optional[str],
    reminders_enabled: bool,
) -> str:
    """
    Build effective system prompt with capability notes.
    
    Args:
        system_prompt: Base system prompt
        reminders_enabled: Whether reminders are enabled
    
    Returns:
        Modified system prompt with capability notes
    """
    result = system_prompt
    if not reminders_enabled:
        note = (
            "CAPABILITY NOTE:\n"
            "- Reminders & plans are disabled for this session unless explicitly enabled.\n"
            "- Do not claim that you scheduled/set reminders or created plans/habits.\n"
            "- If the user wants reminders/plans, ask them to enable the Reminders & Plans toggle."
        )
        result = (result or "") + "\n\n" + note
    return result


async def resolve_media_with_timing(
    db: "databases.Database",
    attachments: Optional[List[Any]],
    user_id: int,
    resolve_fn,
) -> List[Any]:
    """
    Resolve media attachments with timing logging.
    
    Args:
        db: Database connection
        attachments: List of attachments
        user_id: User ID
        resolve_fn: Function to resolve attachments
    
    Returns:
        List of resolved media attachments
    """
    t0 = time.perf_counter()
    media_attachments = await resolve_fn(db, attachments, user_id)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    if elapsed_ms > 50:
        api_logger.info(f"[Timing] Media attachments: {elapsed_ms:.1f}ms")
    return media_attachments


# Capability note constant for reuse
REMINDERS_DISABLED_NOTE = (
    "CAPABILITY NOTE:\n"
    "- Reminders & plans are disabled for this session unless explicitly enabled.\n"
    "- Do not claim that you scheduled/set reminders or created plans/habits.\n"
    "- If the user wants reminders/plans, ask them to enable the Reminders & Plans toggle."
)
