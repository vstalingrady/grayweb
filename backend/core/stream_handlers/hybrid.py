"""
Hybrid Flow Handler

Handles hybrid tool execution where Gemini Flash is used for fast tool execution,
and results are passed to OpenRouter for the final personality-rich response.

Also handles URL context fetching using Gemini's URL Context tool.
"""
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from google.genai import types

# Use inline constants to avoid circular imports
URL_CONTEXT_MODEL = os.getenv("URL_CONTEXT_MODEL", "models/gemini-flash-lite-latest")
GEMINI_FLASH_MODEL = "models/gemini-2.0-flash"

# URL Context Tool - allows AI to fetch and analyze content from URLs
URL_CONTEXT_TOOL = types.Tool(
    url_context=types.UrlContext(),
)

# Import helpers
from backend.core.function_call_helpers import (
    build_function_call_contents,
    extract_function_call,
)
from backend.core.ai_utils import candidate_text

api_logger = logging.getLogger("backend.api")


async def fetch_url_context_with_gemini(
    gemini_service,
    message: str,
    urls: List[str],
    workspace_context: Optional[str] = None,
    time_context: Optional[str] = None,
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Fetch URL content using Gemini with URL Context tool.
    
    This is used for the hybrid architecture: Gemini fetches URL content,
    which is then passed to any model (OpenRouter, Gemini Pro, etc.) as context.
    
    Args:
        gemini_service: The GeminiService instance
        message: The user's original message
        urls: List of URLs extracted from the message
        workspace_context: Optional workspace context
        time_context: Optional time context
        
    Returns:
        Tuple of (url_content_summary, url_context_metadata)
    """
    if not gemini_service or not gemini_service.available:
        return "", None
    
    if not urls:
        return "", None
    
    # Build a prompt that asks Gemini to fetch and summarize the URL content
    url_list = "\n".join(f"- {url}" for url in urls)
    system_prompt = (
        "You have access to the URL Context tool which can fetch content from URLs. "
        "Fetch the content from the provided URLs and provide a comprehensive summary "
        "of the relevant information. Include key facts, data, and context that would "
        "help answer the user's question."
    )
    
    context_prompt = f"The user is asking about content from these URLs:\n{url_list}\n\nUser message: {message}"
    
    try:
        api_logger.info(
            f"[URL Context] Fetching content from {len(urls)} URLs",
            extra={"event_type": "url_context_fetch_start", "url_count": len(urls)}
        )
        
        response = await gemini_service.generate(
            context_prompt,
            conversation_history=None,
            workspace_context=workspace_context,
            system_prompt=system_prompt,
            time_context=time_context,
            model=URL_CONTEXT_MODEL,
            attachments=None,
            extra_contents=None,
            response_schema=None,
            response_mime_type=None,
            tools=[URL_CONTEXT_TOOL],
            tool_config=None,
            reasoning_mode=False,
        )
        
        if not response.candidates:
            api_logger.warning(
                "[URL Context] No candidates in response",
                extra={"event_type": "url_context_no_candidates"}
            )
            return "", None
        
        candidate = response.candidates[0]
        url_content = candidate_text(candidate)
        
        # Extract URL context metadata if available
        url_metadata: Optional[Dict[str, Any]] = None
        if hasattr(candidate, 'url_context_metadata') and candidate.url_context_metadata:
            url_metadata = {
                "url_metadata": [
                    {
                        "retrieved_url": m.retrieved_url,
                        "url_retrieval_status": str(m.url_retrieval_status) if m.url_retrieval_status else None
                    }
                    for m in (candidate.url_context_metadata.url_metadata or [])
                ]
            }
        
        api_logger.info(
            f"[URL Context] Successfully fetched content ({len(url_content)} chars)",
            extra={
                "event_type": "url_context_fetch_success",
                "content_len": len(url_content),
                "url_count": len(urls)
            }
        )
        
        return url_content.strip(), url_metadata
        
    except Exception as error:
        api_logger.warning(
            f"[URL Context] Failed to fetch URL content: {error}",
            extra={"event_type": "url_context_fetch_error", "error": str(error)},
        )
        return "", None


async def execute_tools_with_gemini_flash(
    gemini_service,
    execute_function_call_fn,
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]],
    tool_list: List[types.Tool],
    system_prompt: Optional[str],
    time_context: Optional[str],
    workspace_context: Optional[str],
    user_id: int,
    db,  # databases.Database
    user_timezone: Optional[str] = None,
    history_token_budget: Optional[int] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], bool]:
    """Execute tools using Gemini Flash for speed, return results for hybrid flow.
    
    This is used when OpenRouter is the response model but we want fast tool execution.
    Gemini Flash handles the tool calling, then results are passed to OpenRouter for
    the final personality-rich response.
    
    Args:
        gemini_service: The GeminiService instance
        execute_function_call_fn: Function to execute tool calls
        message: User message
        conversation_history: Conversation history
        tool_list: List of available tools
        system_prompt: System prompt
        time_context: Time context
        workspace_context: Workspace context
        user_id: User ID
        db: Database connection
        user_timezone: User timezone
        history_token_budget: Token budget for history
        
    Returns:
        tool_results: List of {tool_name, result, args} for each executed tool
        tool_cards: List of reminder/plan/habit cards to emit to frontend
        onboarding_completed: True if complete_onboarding was called
    """
    if not gemini_service.available:
        return [], [], False
    
    tool_results: List[Dict[str, Any]] = []
    tool_cards: List[Dict[str, Any]] = []
    onboarding_completed = False
    
    try:
        # Initial generation with tools
        response = await gemini_service.generate(
            message,
            conversation_history,
            workspace_context,
            system_prompt,
            time_context,
            GEMINI_FLASH_MODEL,
            tools=tool_list,
            history_token_budget=history_token_budget,
        )
        
        # Loop to handle tool execution (max 3 iterations)
        extra_contents: Optional[List[types.Content]] = None
        for attempt in range(3):
            function_call = extract_function_call(response)
            if not function_call:
                break
            
            tool_name = function_call.name
            tool_args = function_call.args or {}
            
            api_logger.info(
                f"[Hybrid] Gemini Flash executing tool: {tool_name}",
                extra={"user_id": user_id, "tool": tool_name}
            )
            
            try:
                tool_result = await execute_function_call_fn(
                    function_call, user_id, db, user_timezone=user_timezone
                )
                tool_results.append({
                    "tool_name": tool_name,
                    "args": dict(tool_args),
                    "result": tool_result,
                })
                
                # Collect reminder/plan/habit cards for frontend
                if isinstance(tool_result, dict) and tool_result.get("type") in {
                    "gray.reminder", "gray.plan", "gray.habit"
                }:
                    tool_cards.append(tool_result)
                
                # Check if onboarding was completed (partial saves should not disable onboarding)
                if tool_name == "complete_onboarding" and isinstance(tool_result, dict):
                    onboarding_completed = onboarding_completed or tool_result.get("status") == "success"
                
                # Build contents for next iteration
                tool_contents = build_function_call_contents(function_call, tool_result)
                if extra_contents:
                    extra_contents.extend(tool_contents)
                else:
                    extra_contents = tool_contents
                
                # Generate again to see if more tools are needed
                response = await gemini_service.generate(
                    message,
                    conversation_history,
                    workspace_context,
                    system_prompt,
                    time_context,
                    GEMINI_FLASH_MODEL,
                    extra_contents=extra_contents,
                    tools=tool_list,
                    history_token_budget=history_token_budget,
                )
                
            except Exception as tool_error:
                api_logger.error(
                    f"[Hybrid] Tool execution failed: {tool_name}: {tool_error}",
                    exc_info=True
                )
                tool_results.append({
                    "tool_name": tool_name,
                    "args": dict(tool_args),
                    "error": str(tool_error),
                })
                break
    
    except Exception as gemini_error:
        api_logger.error(
            f"[Hybrid] Gemini Flash tool execution failed: {gemini_error}",
            exc_info=True,
            extra={"user_id": user_id}
        )
    
    return tool_results, tool_cards, onboarding_completed


def has_onboarding_tool(tools: Optional[List[types.Tool]]) -> bool:
    """Check if the tools list contains the complete_onboarding function."""
    if not tools:
        return False
    for t in tools:
        if t.function_declarations:
            for fd in t.function_declarations:
                if fd.name == "complete_onboarding":
                    return True
    return False
