"""
OpenRouter Streaming Handler

Handles streaming responses from OpenRouter with full tool execution support.
"""
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from google.genai import types

api_logger = logging.getLogger("backend.api")

# Import helpers
try:
    from backend.core.function_call_helpers import format_tool_results_for_context
    from backend.core.ai_utils import materialize_structured_reminders
except ImportError:
    from core.function_call_helpers import format_tool_results_for_context  # type: ignore
    from core.ai_utils import materialize_structured_reminders  # type: ignore



async def stream_openrouter_response(
    openrouter_service,
    message: str,
    conversation_history: List[Dict[str, Any]],
    workspace_context: Optional[str],
    system_prompt: Optional[str],
    time_context: Optional[str],
    model: Optional[str],
    tool_list: List[types.Tool],
    search_enabled: bool,
    reasoning_mode: bool,
    media_attachments: List[Any],
    history_token_budget: int,
    user_id: int,
    needs_structured_tools: bool,
    is_onboarding_tool: bool,
    response_format: Optional[Dict[str, Any]],
    provider_routing: Optional[Dict[str, Any]],
    # Tool execution function passed in to avoid circular imports
    execute_function_call_fn,
    db,
    user_timezone: Optional[str],
    # Hybrid flow data
    hybrid_tool_results: Optional[List[Dict[str, Any]]] = None,
    hybrid_tool_cards: Optional[List[Dict[str, Any]]] = None,
    # Usage tracking
    usage_tracker_cls=None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Stream response from OpenRouter with multi-turn tool handling.
    
    Yields tuples of (event_type, data) where event_type is one of:
    - "delta": Text chunk to stream
    - "final": Final response with metadata
    - "reminders": Reminder/plan/habit cards
    - "usage": Usage statistics
    - "error": Error message
    """
    if not openrouter_service.available:
        error_msg = "OpenRouter service is currently unavailable. Please try again later."
        yield ("delta", error_msg)
        yield ("final", {"text": error_msg, "grounding_metadata": None})
        return
    
    t0_provider = time.perf_counter()
    
    # Apply hybrid tool results to workspace context if provided
    hybrid_workspace_context = workspace_context
    if hybrid_tool_results:
        tool_context = format_tool_results_for_context(hybrid_tool_results)
        if tool_context:
            hybrid_workspace_context = "\n\n".join(filter(None, [
                workspace_context,
                tool_context,
            ]))
        # Clear tool_list for hybrid mode - tools already executed
        tool_list = []
    
    # Emit pre-executed tool cards
    if hybrid_tool_cards:
        for card in hybrid_tool_cards:
            yield ("reminders", [card])
    
    # Multi-turn loop for tool handling
    current_history = list(conversation_history) if conversation_history else []
    max_tool_turns = 5 if not hybrid_tool_results else 1
    yielded_any_tokens = False
    total_accumulated = ""
    current_message = message
    
    for turn in range(max_tool_turns + 1):
        accumulated = ""
        t0_first_token = time.perf_counter()
        got_first_token = False
        
        # Native tool call accumulator
        pending_tool_calls: Dict[int, Dict[str, Any]] = {}
        reasoning_started = False
        
        # Build system prompt with tool instructions if needed
        run_system_prompt = system_prompt
        if needs_structured_tools and tool_list:
            run_system_prompt = (run_system_prompt or "") + "\n\n" + (
                "TOOLS REQUIRED:\n"
                "- When the user asks to create/update/delete a plan, habit, or reminder, you MUST call the appropriate tool.\n"
                "- Do NOT claim 'reminders set', 'scheduled', or similar unless you actually invoked the tool and it succeeded.\n"
                "- If the user intent is ambiguous, ask a clarifying question before calling tools."
            )
        
        if search_enabled:
            # Track web search cost ($10/K = $0.01 per search)
            if usage_tracker_cls and user_id and db:
                try:
                    tracker = usage_tracker_cls(db)
                    await tracker.track_cost(user_id, 0.01, "web_search")
                except Exception as e:
                    api_logger.warning(f"Failed to track search cost: {e}")
            
            run_system_prompt = (run_system_prompt or "") + "\n\nYou have access to Google Search. You must use it for current events, news, or factual queries where your knowledge might be outdated."
        
        # Stream from OpenRouter
        async for chunk in openrouter_service.stream(
            current_message,
            current_history,
            hybrid_workspace_context,
            run_system_prompt,
            time_context,
            model,
            include_usage=True,
            response_format=response_format,
            tools=tool_list,
            tool_choice="auto",
            plugins=[{"id": "web", "max_results": 5}] if search_enabled else None,
            reasoning_mode=reasoning_mode,
            attachments=media_attachments,
            history_token_budget=history_token_budget,
            provider_routing=provider_routing,
        ):
            if isinstance(chunk, dict):
                # Handle usage statistics
                if "usage" in chunk:
                    yield ("usage", chunk["usage"])
                    continue
                
                # Handle native streaming tool calls
                if "tool_calls" in chunk:
                    for tc in chunk["tool_calls"]:
                        idx = tc.get("index", 0)
                        if idx not in pending_tool_calls:
                            pending_tool_calls[idx] = {"name": "", "arguments": [], "id": ""}
                        
                        if tc.get("id"):
                            pending_tool_calls[idx]["id"] = tc["id"]
                        
                        func = tc.get("function", {})
                        if func.get("name"):
                            pending_tool_calls[idx]["name"] = func["name"]
                        if func.get("arguments"):
                            pending_tool_calls[idx]["arguments"].append(func["arguments"])
                
                # Handle reasoning content
                if "reasoning" in chunk:
                    reasoning_content = chunk["reasoning"]
                    if reasoning_content:
                        if not reasoning_started:
                            reasoning_started = True
                            yield ("delta", "<thinking>")
                        yield ("delta", reasoning_content)
                        continue
                
                # Handle text content
                if "text" in chunk:
                    text = chunk["text"]
                    if reasoning_started and not accumulated:
                        yield ("delta", "</thinking>\n")
                        reasoning_started = False
                    
                    if text:
                        if not got_first_token:
                            got_first_token = True
                            ttft = (time.perf_counter() - t0_first_token) * 1000
                            if ttft > 200:
                                api_logger.info(f"[Timing] OpenRouter TTFT: {ttft:.0f}ms")
                        accumulated += text
                        yielded_any_tokens = True
                        yield ("delta", text)
            
            elif isinstance(chunk, str):
                if not got_first_token:
                    got_first_token = True
                    ttft = (time.perf_counter() - t0_first_token) * 1000
                    if ttft > 200:
                        api_logger.info(f"[Timing] OpenRouter TTFT: {ttft:.0f}ms")
                accumulated += chunk
                yielded_any_tokens = True
                yield ("delta", chunk)
        
        # Close reasoning tags if still open
        if reasoning_started:
            yield ("delta", "</thinking>\n")
        
        # Process tool calls if any
        if pending_tool_calls:
            for idx, tc in sorted(pending_tool_calls.items()):
                tool_name = tc["name"]
                tool_args_str = "".join(tc["arguments"])
                
                if not tool_name:
                    continue
                
                try:
                    tool_args = json.loads(tool_args_str) if tool_args_str else {}
                except json.JSONDecodeError:
                    tool_args = {}
                
                api_logger.info(
                    f"[OpenRouter] Executing tool: {tool_name}",
                    extra={"user_id": user_id, "tool": tool_name}
                )
                
                # Create a FunctionCall compatible object
                gemini_fc = types.FunctionCall(name=tool_name, args=tool_args)
                
                try:
                    tool_result = await execute_function_call_fn(
                        gemini_fc, user_id, db, user_timezone=user_timezone
                    )
                    
                    # Emit tool cards
                    if isinstance(tool_result, dict) and tool_result.get("type") in {
                        "gray.reminder", "gray.plan", "gray.habit"
                    }:
                        yield ("reminders", [tool_result])
                    
                    # Add to history for multi-turn
                    current_history.append({"role": "assistant", "text": accumulated})
                    current_history.append({
                        "role": "tool",
                        "tool_name": tool_name,
                        "tool_result": tool_result,
                    })
                    
                except Exception as tool_error:
                    api_logger.error(f"Tool execution failed: {tool_name}: {tool_error}", exc_info=True)
                    current_history.append({"role": "assistant", "text": accumulated})
                    current_history.append({
                        "role": "tool",
                        "tool_name": tool_name,
                        "error": str(tool_error),
                    })
            
            total_accumulated += accumulated
            current_message = ""
            continue  # Next turn
        
        # No tool calls - done
        total_accumulated += accumulated
        break
    
    # Final response
    if response_format:
        text, structured_reminders = materialize_structured_reminders(total_accumulated)
        yield ("final", {
            "text": text,
            "grounding_metadata": None,
            "reminders": structured_reminders if structured_reminders else None
        })
    else:
        if yielded_any_tokens and not total_accumulated.strip():
            total_accumulated = "Done."
            yield ("delta", total_accumulated)
        yield ("final", {"text": total_accumulated, "grounding_metadata": None})
