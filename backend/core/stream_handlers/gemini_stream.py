"""
Gemini Streaming Handler

Handles streaming responses from Gemini with multi-turn tool execution.
"""
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Set, Tuple

from google.genai import types

api_logger = logging.getLogger("backend.api")

# Import helpers
from backend.core.ai_utils import materialize_structured_reminders as _materialize_structured_reminders
from backend.core.ai_utils import candidate_text as _candidate_text
from backend.core.ai_utils import candidate_thought as _candidate_thought
from backend.core.ai_utils import candidate_grounding_payload as _candidate_grounding_payload
from backend.core.function_call_helpers import build_function_call_contents as _build_function_call_contents
from backend.core.ai_config import REMINDER_FUNCTION_NAMES

# Set of mutating tool names - only execute once per turn
SINGLE_CALL_PER_TURN = {
    "create_reminder",
    "update_reminder",
    "delete_reminder",
    "delete_latest_reminder",
    "create_plan",
    "update_plan",
    "delete_plan",
    "create_habit",
    "update_habit",
    "delete_habit",
}


async def stream_gemini_response(
    gemini_service,
    message: str,
    conversation_history: List[Dict[str, Any]],
    workspace_context: Optional[str],
    system_prompt: Optional[str],
    time_context: Optional[str],
    model: Optional[str],
    tool_list: List[types.Tool],
    tool_config: Optional[types.ToolConfig],
    reasoning_mode: bool,
    media_attachments: List[Any],
    cached_contents: Optional[List[types.Content]],
    history_token_budget: Optional[int],
    user_id: int,
    response_format: Optional[Dict[str, Any]],
    execute_function_call_fn: Callable,
    db,
    user_timezone: Optional[str],
    usage_tracker_cls = None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Stream response from Gemini with multi-turn tool execution.
    
    Yields tuples of (event_type, data) where event_type is one of:
    - "delta": Text chunk to stream
    - "final": Final response with metadata  
    - "reminders": Reminder/plan/habit cards
    - "error": Error message
    
    Args:
        gemini_service: GeminiService instance
        message: User message
        conversation_history: Normalized conversation history
        workspace_context: Workspace context string
        system_prompt: System prompt
        time_context: Time context string
        model: Model name
        tool_list: List of Gemini tools
        tool_config: Tool configuration
        reasoning_mode: Whether reasoning mode is enabled
        media_attachments: Media attachments
        cached_contents: Cached context contents
        history_token_budget: Token budget for history
        user_id: User ID
        response_format: Response format (for structured output)
        execute_function_call_fn: Function to execute tool calls
        db: Database connection
        user_timezone: User timezone
        usage_tracker_cls: UsageTracker class for tracking usage
    """
    if not gemini_service.available:
        error_msg = "Gemini service is currently unavailable."
        yield ("delta", error_msg)
        yield ("final", {"text": error_msg, "grounding_metadata": None})
        return

    grounding_metadata: Optional[Dict[str, Any]] = None
    
    # Initialize loop variables
    current_history = list(conversation_history) if conversation_history else []
    intermediate_history: List[types.Content] = []
    
    # Multi-turn limit
    max_tool_turns = 5
    previous_turns_text = ""
    
    try:
        for turn in range(max_tool_turns + 1):
            accumulated = ""
            final_usage = None
            tool_calls_in_this_turn: List[types.FunctionCall] = []
            
            # Prepare extra contents for this turn
            current_extra_contents = []
            if cached_contents:
                current_extra_contents.extend(cached_contents)
            if intermediate_history:
                current_extra_contents.extend(intermediate_history)
            
            # Buffer for text-based tool call interception
            text_buffer = ""
            is_buffering_text = False
            
            # Stream from Gemini
            async for chunk in gemini_service.stream(
                message if turn == 0 else "",  # Only send message on first turn
                current_history,
                workspace_context,
                system_prompt,
                time_context,
                model,
                attachments=media_attachments if turn == 0 else None,
                extra_contents=current_extra_contents,
                tools=tool_list,
                tool_config=tool_config,
                reasoning_mode=reasoning_mode,
                history_token_budget=history_token_budget,
            ):
                if chunk.usage_metadata:
                    final_usage = chunk.usage_metadata
                
                candidate = chunk.candidates[0] if chunk.candidates else None
                parts = getattr(candidate, "content", None)
                parts_list = getattr(parts, "parts", None) if parts else None
                
                if candidate:
                    payload = _candidate_grounding_payload(candidate)
                    if payload:
                        grounding_metadata = payload
                    
                    # Extract thinking content
                    is_gemini_3_model = model and "gemini-3" in model.lower()
                    if reasoning_mode or is_gemini_3_model:
                        thought_content = _candidate_thought(candidate)
                        if thought_content and not accumulated.startswith("<thinking>"):
                            thinking_wrapper = f"<thinking>{thought_content}</thinking>\n"
                            accumulated = thinking_wrapper + accumulated
                            yield ("delta", thinking_wrapper)
                
                # Suppress text if function calls present
                suppress_text = False
                if parts_list:
                    suppress_text = any(getattr(part, "function_call", None) for part in parts_list)
                
                if not suppress_text and candidate:
                    text_fragment = _candidate_text(candidate)
                    
                    # Buffering for text-based tool interception
                    if "```" in text_fragment or is_buffering_text:
                        is_buffering_text = True
                        text_buffer += text_fragment
                        
                        # Check for end of code block
                        if text_buffer.count("```") >= 2:
                            # Try to intercept JSON tool calls
                            try:
                                match = re.search(
                                    r"```(?:javascript|json)?\s*(\{[\s\S]*?\})\s*```",
                                    text_buffer, re.IGNORECASE
                                )
                                if not match:
                                    match = re.search(r"```\s*(\{[\s\S]*?\})\s*```", text_buffer, re.IGNORECASE)
                                
                                if match:
                                    json_str = match.group(1)
                                    tool_data = json.loads(json_str)
                                    
                                    if isinstance(tool_data, dict) and tool_data.get("tool") in REMINDER_FUNCTION_NAMES:
                                        tool_name = tool_data.get("tool")
                                        tool_params = tool_data.get("params") or {}
                                        
                                        api_logger.info(f"Intercepted text tool call: {tool_name}")
                                        
                                        gemini_fc = types.FunctionCall(name=tool_name, args=tool_params)
                                        tool_result = await execute_function_call_fn(
                                            gemini_fc, user_id, db, user_timezone=user_timezone
                                        )
                                        
                                        if isinstance(tool_result, dict) and tool_result.get("type") in {
                                            "gray.reminder", "gray.plan", "gray.habit"
                                        }:
                                            yield ("reminders", [tool_result])
                                        
                                        # Remove code block from buffer
                                        start, end = match.span()
                                        pre_text = text_buffer[:start]
                                        post_text = text_buffer[end:]
                                        
                                        if pre_text:
                                            accumulated += pre_text
                                            yield ("delta", pre_text)
                                        
                                        text_buffer = post_text
                                        is_buffering_text = "```" in text_buffer
                                        
                                        if not is_buffering_text and text_buffer:
                                            accumulated += text_buffer
                                            yield ("delta", text_buffer)
                                            text_buffer = ""
                                        
                                        continue
                            except Exception:
                                pass  # Parse failed, treat as normal text
                            
                            # Flush buffer if 2+ backticks and no match
                            if text_buffer.count("```") >= 2:
                                accumulated += text_buffer
                                yield ("delta", text_buffer)
                                text_buffer = ""
                                is_buffering_text = False
                        
                        # Safety: flush if buffer too large
                        elif len(text_buffer) > 2000:
                            accumulated += text_buffer
                            yield ("delta", text_buffer)
                            text_buffer = ""
                            is_buffering_text = False
                        
                        continue
                    
                    # Normal text
                    accumulated += text_fragment
                    if text_fragment:
                        yield ("delta", text_fragment)
                
                # Collect function calls
                if parts_list:
                    for part in parts_list:
                        if getattr(part, "function_call", None):
                            tool_calls_in_this_turn.append(part.function_call)
            
            # End of stream - flush remaining buffer
            if text_buffer:
                accumulated += text_buffer
                yield ("delta", text_buffer)
            
            # No tool calls - we're done
            if not tool_calls_in_this_turn:
                if final_usage and user_id is not None and db is not None and usage_tracker_cls:
                    tracker = usage_tracker_cls(db)
                    await tracker.track_usage(
                        user_id,
                        final_usage.prompt_token_count or 0,
                        final_usage.candidates_token_count or 0,
                        model=model
                    )
                
                # Clean up structured reminders if needed
                final_reminders = None
                if response_format:
                    accumulated, final_reminders = _materialize_structured_reminders(accumulated)
                
                final_payload = {
                    "text": previous_turns_text + (accumulated or ""),
                    "grounding_metadata": grounding_metadata,
                    "reminders": final_reminders
                }
                yield ("final", final_payload)
                return
            
            # Handle tool calls
            model_parts = []
            if accumulated:
                model_parts.append(types.Part.from_text(text=accumulated))
            
            # Accumulate text for next turns
            if response_format:
                text, _ = _materialize_structured_reminders(accumulated)
                previous_turns_text += text
            else:
                previous_turns_text += accumulated
            
            # Deduplicate mutating tool calls
            deduped_tool_calls: List[types.FunctionCall] = []
            seen_tool_names: Set[str] = set()
            for fc in tool_calls_in_this_turn:
                if fc.name in SINGLE_CALL_PER_TURN:
                    if fc.name in seen_tool_names:
                        api_logger.info(f"Skipping duplicate {fc.name}", extra={"user_id": user_id})
                        continue
                    seen_tool_names.add(fc.name)
                deduped_tool_calls.append(fc)
            
            for fc in deduped_tool_calls:
                model_parts.append(types.Part.from_function_call(name=fc.name, args=fc.args or {}))
            
            # Add model turn to history
            intermediate_history.append(types.Content(role="model", parts=model_parts))
            
            # Execute tools
            for fc in deduped_tool_calls:
                tool_result = {}
                try:
                    tool_result = await execute_function_call_fn(fc, user_id, db, user_timezone=user_timezone)
                    
                    if isinstance(tool_result, dict) and tool_result.get("type") in {
                        "gray.reminder", "gray.plan", "gray.habit"
                    }:
                        api_logger.info(f"Yielding reminder: {tool_result.get('type')}")
                        yield ("reminders", [tool_result])
                        
                except Exception as e:
                    tool_result = {"error": str(e)}
                    api_logger.error(f"Tool {fc.name} failed: {e}", exc_info=True)
                    
                finally:
                    intermediate_history.extend(_build_function_call_contents(fc, tool_result))
                    yield ("delta", "")
            
            # Loop continues for next turn
            
    except Exception as gemini_error:  # pragma: no cover
        api_logger.error(f"Gemini streaming failed: {gemini_error}", exc_info=True)
        raise
