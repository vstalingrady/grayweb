"""Tool execution logic for AI-invoked operations.

This module consolidates the mapping of AI tool names to their backend handlers
and provides a unified execution interface.
"""
from __future__ import annotations

import inspect
from typing import Any, Dict, Optional, TYPE_CHECKING
from fastapi import HTTPException

if TYPE_CHECKING:
    import databases

# Lazy imports to avoid circular dependencies
def _get_calendar_tools_module():
    from backend.core import calendar_tools
    return calendar_tools

def _get_workspace_tools_module():
    from backend.core import workspace_tools
    return workspace_tools

def _get_proactivity_helpers():
    from backend.core import proactivity_helpers
    return proactivity_helpers

def _get_onboarding_handler():
    from backend.core import onboarding_handler
    return onboarding_handler

def _get_supermemory_handlers():
    from backend.core import supermemory_handlers
    return supermemory_handlers


def _extract_search_query_from_args(args: Any) -> str:
    if not isinstance(args, dict):
        return ""
    for key in ("query", "q", "search", "search_query", "searchQuery"):
        value = args.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    queries = args.get("queries")
    if isinstance(queries, list):
        for item in queries:
            if isinstance(item, str) and item.strip():
                return item.strip()
    return ""


def _normalize_tool_name(name: Any) -> str:
    if not isinstance(name, str):
        return ""
    return name.strip().lower()


def _make_web_search_no_results_handler(source: str):
    async def _handler(_u: int, args: Dict[str, Any], _d: Any, _pt: Optional[str] = None) -> Dict[str, Any]:
        return {
            "query": _extract_search_query_from_args(args),
            "status": "provider_managed",
            "message": "Search execution is handled by the provider plugin.",
            "source": source,
        }

    return _handler


def _build_unsupported_web_search_payload(function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "query": _extract_search_query_from_args(args),
        "status": "provider_managed",
        "message": "Search execution is handled by the provider plugin.",
        "source": function_name,
    }


def get_tool_handlers(
    user_timezone: Optional[str] = None,
    proactivity_scheduler: Any = None
) -> Dict[str, Any]:
    """Return a dictionary of tool name -> handler function."""
    calendar = _get_calendar_tools_module()
    workspace = _get_workspace_tools_module()
    pro_helpers = _get_proactivity_helpers()
    onboarding = _get_onboarding_handler()
    supermemory = _get_supermemory_handlers()
    
    return {
        "fetch_proactivity_summary": lambda u, a, d, _pt=None: pro_helpers.fetch_proactivity_summary(u, a.get("info_type"), d),
        "list_calendar_events": lambda u, a, d, _pt=None: calendar.list_calendar_events(u, a, d),
        "create_calendar_event": lambda u, a, d, _pt=None: calendar.create_calendar_event(u, a, d),
        "update_calendar_event": lambda u, a, d, _pt=None: calendar.update_calendar_event(u, a, d),
        "delete_calendar_event": lambda u, a, d, _pt=None: calendar.delete_calendar_event(u, a, d),
        "complete_onboarding": lambda u, a, d, _pt=None: onboarding.complete_onboarding(
            u, a, d, user_timezone=user_timezone, proactivity_scheduler=proactivity_scheduler
        ),
        "list_plans": lambda u, a, d, _pt=None: workspace.list_plans_tool(u, a, d),
        "create_plan": lambda u, a, d, _pt=None: workspace.create_plan_tool(u, a, d),
        "update_plan": lambda u, a, d, _pt=None: workspace.update_plan_tool(u, a, d),
        "delete_plan": lambda u, a, d, _pt=None: workspace.delete_plan_tool(u, a, d),
        "list_reminders": lambda u, a, d, _pt=None: workspace.list_reminders_tool(u, a, d),
        "create_reminder": lambda u, a, d, _pt=None: workspace.create_reminder_tool(u, a, d),
        "update_reminder": lambda u, a, d, _pt=None: workspace.update_reminder_tool(u, a, d),
        "delete_reminder": lambda u, a, d, _pt=None: workspace.delete_reminder_tool(u, a, d),
        "delete_latest_reminder": lambda u, a, d, _pt=None: workspace.delete_latest_reminder_tool(u, a, d),
        "get_workspace_state": lambda u, a, d, _pt=None: workspace.get_workspace_state_tool(u, a, d),
        "supermemory_store": lambda u, a, d, pt=None: supermemory.supermemory_store_tool(u, a, d, plan_tier=pt),
        "supermemory_search": lambda u, a, d, pt=None: supermemory.supermemory_search_tool(u, a, d, plan_tier=pt),
        "supermemory_forget": lambda u, a, d, pt=None: supermemory.supermemory_forget_tool(u, a, d, plan_tier=pt),
        "supermemory_profile": lambda u, a, d, pt=None: supermemory.supermemory_profile_tool(u, a, d, plan_tier=pt),
        # OpenRouter/provider web-search tool names (plugin compatibility shims).
        "default_web_search": _make_web_search_no_results_handler("default_web_search"),
        "default-web-search": _make_web_search_no_results_handler("default-web-search"),
        "web_search": _make_web_search_no_results_handler("web_search"),
        "web-search": _make_web_search_no_results_handler("web-search"),
        "web": _make_web_search_no_results_handler("web"),
        "search": _make_web_search_no_results_handler("search"),
        "tavily_search": _make_web_search_no_results_handler("tavily_search"),
        "tavily-search": _make_web_search_no_results_handler("tavily-search"),
        "mshtools-web_search": _make_web_search_no_results_handler("mshtools-web_search"),
        "mshtools_web_search": _make_web_search_no_results_handler("mshtools_web_search"),
        "browser.search": _make_web_search_no_results_handler("browser.search"),
        "openrouter.search": _make_web_search_no_results_handler("openrouter.search"),
    }


async def execute_function_call(
    function_call: Any,  # google.genai.types.FunctionCall
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
    proactivity_scheduler: Any = None,
    plan_tier: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute a single function call from the AI."""
    args = function_call.args or {}
    raw_name = function_call.name or ""
    normalized_name = _normalize_tool_name(raw_name)
    handlers = get_tool_handlers(user_timezone, proactivity_scheduler)
    handler = handlers.get(raw_name) or handlers.get(normalized_name)
    if not handler and normalized_name:
        handler = (
            handlers.get(normalized_name.replace("-", "_"))
            or handlers.get(normalized_name.replace("_", "-"))
            or handlers.get(normalized_name.replace("/", "."))
        )
    if not handler:
        if normalized_name and ("search" in normalized_name or "web" in normalized_name):
            return _build_unsupported_web_search_payload(raw_name, args)
        raise HTTPException(status_code=501, detail=f"Unsupported function: {raw_name}")

    result = handler(user_id, args, db, plan_tier)
    if inspect.isawaitable(result):
        return await result
    return result
