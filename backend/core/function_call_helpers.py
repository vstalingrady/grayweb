"""Function call helper functions.

Utilities for building and processing Gemini function call contents.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from google.genai import types

# Lazy imports
_types_module = None


def _get_types():
    """Get google.genai types module."""
    global _types_module
    if _types_module is None:
        from google.genai import types
        _types_module = types
    return _types_module


def build_function_call_contents(
    function_call: "types.FunctionCall",
    result: Dict[str, Any],
) -> List["types.Content"]:
    """Build Content list for a function call and its response."""
    types = _get_types()
    return [
        types.Content(
            role="model",
            parts=[types.Part.from_function_call(name=function_call.name, args=function_call.args or {})],
        ),
        types.Content(
            role="user",
            parts=[types.Part.from_function_response(name=function_call.name, response=result)],
        ),
    ]


def extract_function_call(response: "types.GenerateContentResponse") -> Optional["types.FunctionCall"]:
    """Extract the first function call from a response, if any."""
    calls = response.function_calls
    if calls:
        return calls[0]
    return None


def format_tool_results_for_context(tool_results: List[Dict[str, Any]]) -> str:
    """Format tool execution results as context for the response model."""
    if not tool_results:
        return ""
    
    parts = ["[Tool execution results - use these to inform your response:]"]
    for tr in tool_results:
        tool_name = tr.get("tool_name", "unknown")
        if "error" in tr:
            parts.append(f"- {tool_name}: Error - {tr['error']}")
        else:
            result = tr.get("result", {})
            # Summarize the result based on type
            if isinstance(result, dict):
                result_type = result.get("type", "")
                if result_type == "gray.reminder":
                    parts.append(f"- {tool_name}: Created reminder '{result.get('label', '')}' for {result.get('remind_at', 'unknown time')}")
                elif result_type == "gray.plan":
                    parts.append(f"- {tool_name}: Created plan '{result.get('label', '')}'")
                elif result_type == "gray.habit":
                    parts.append(f"- {tool_name}: Created habit '{result.get('label', '')}'")
                elif result.get("status") == "success":
                    parts.append(f"- {tool_name}: Success")
                else:
                    parts.append(f"- {tool_name}: Completed successfully")
            else:
                parts.append(f"- {tool_name}: {str(result)[:100]}")
    
    return "\n".join(parts)
