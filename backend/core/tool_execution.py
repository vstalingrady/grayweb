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
    try:
        from backend.core import calendar_tools
    except ImportError:
        import core.calendar_tools as calendar_tools  # type: ignore
    return calendar_tools

def _get_workspace_tools_module():
    try:
        from backend.core import workspace_tools
    except ImportError:
        import core.workspace_tools as workspace_tools  # type: ignore
    return workspace_tools

def _get_proactivity_helpers():
    try:
        from backend.core import proactivity_helpers
    except ImportError:
        import core.proactivity_helpers as proactivity_helpers  # type: ignore
    return proactivity_helpers

def _get_onboarding_handler():
    try:
        from backend.core import onboarding_handler
    except ImportError:
        import core.onboarding_handler as onboarding_handler  # type: ignore
    return onboarding_handler


def get_tool_handlers(
    user_timezone: Optional[str] = None,
    proactivity_scheduler: Any = None
) -> Dict[str, Any]:
    """Return a dictionary of tool name -> handler function."""
    calendar = _get_calendar_tools_module()
    workspace = _get_workspace_tools_module()
    pro_helpers = _get_proactivity_helpers()
    onboarding = _get_onboarding_handler()
    
    return {
        "fetch_proactivity_summary": lambda u, a, d: pro_helpers.fetch_proactivity_summary(u, a.get("info_type"), d),
        "list_calendar_events": calendar.list_calendar_events,
        "create_calendar_event": calendar.create_calendar_event,
        "update_calendar_event": calendar.update_calendar_event,
        "delete_calendar_event": calendar.delete_calendar_event,
        "complete_onboarding": lambda u, a, d: onboarding.complete_onboarding(
            u, a, d, user_timezone=user_timezone, proactivity_scheduler=proactivity_scheduler
        ),
        "list_plans": workspace.list_plans_tool,
        "create_plan": workspace.create_plan_tool,
        "update_plan": workspace.update_plan_tool,
        "delete_plan": workspace.delete_plan_tool,
        "list_habits": workspace.list_habits_tool,
        "create_habit": workspace.create_habit_tool,
        "update_habit": workspace.update_habit_tool,
        "delete_habit": workspace.delete_habit_tool,
        "list_reminders": workspace.list_reminders_tool,
        "create_reminder": workspace.create_reminder_tool,
        "update_reminder": workspace.update_reminder_tool,
        "delete_reminder": workspace.delete_reminder_tool,
        "delete_latest_reminder": workspace.delete_latest_reminder_tool,
        "get_workspace_state": workspace.get_workspace_state_tool,
    }


async def execute_function_call(
    function_call: Any,  # google.genai.types.FunctionCall
    user_id: int,
    db: databases.Database,
    user_timezone: Optional[str] = None,
    proactivity_scheduler: Any = None
) -> Dict[str, Any]:
    """Execute a single function call from the AI."""
    handlers = get_tool_handlers(user_timezone, proactivity_scheduler)
    handler = handlers.get(function_call.name)
    if not handler:
        raise HTTPException(status_code=501, detail=f"Unsupported function: {function_call.name}")

    args = function_call.args or {}
    return await handler(user_id, args, db)
