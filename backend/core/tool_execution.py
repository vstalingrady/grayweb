"""Tool execution logic for AI-invoked operations.

This module consolidates the mapping of AI tool names to their backend handlers
and provides a unified execution interface.
"""
from __future__ import annotations

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
        "list_habits": lambda u, a, d, _pt=None: workspace.list_habits_tool(u, a, d),
        "create_habit": lambda u, a, d, _pt=None: workspace.create_habit_tool(u, a, d),
        "update_habit": lambda u, a, d, _pt=None: workspace.update_habit_tool(u, a, d),
        "delete_habit": lambda u, a, d, _pt=None: workspace.delete_habit_tool(u, a, d),
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
    handlers = get_tool_handlers(user_timezone, proactivity_scheduler)
    handler = handlers.get(function_call.name)
    if not handler:
        raise HTTPException(status_code=501, detail=f"Unsupported function: {function_call.name}")

    args = function_call.args or {}
    return await handler(user_id, args, db, plan_tier)
