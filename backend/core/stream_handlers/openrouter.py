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
from backend.core.function_call_helpers import format_tool_results_for_context
from backend.core.ai_utils import materialize_structured_reminders


def _coerce_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _extract_usage_counts(usage: Dict[str, Any]) -> Tuple[int, int, int]:
    prompt_tokens = _coerce_int(usage.get("prompt_tokens") or usage.get("input_tokens"))
    completion_tokens = _coerce_int(usage.get("completion_tokens") or usage.get("output_tokens"))
    cached_tokens = _coerce_int(usage.get("cached_tokens") or usage.get("cache_read_input_tokens"))

    details = usage.get("prompt_tokens_details") or usage.get("input_tokens_details")
    if isinstance(details, dict):
        cached_tokens = max(cached_tokens, _coerce_int(details.get("cached_tokens")))

    return prompt_tokens, completion_tokens, cached_tokens


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
    response_format: Optional[Dict[str, Any]] = None,
    provider_routing: Optional[Dict[str, Any]] = None,
    execute_function_call_fn=None,
    db=None,
    user_timezone: Optional[str] = None,
    hybrid_tool_results: Optional[List[Dict[str, Any]]] = None,
    hybrid_tool_cards: Optional[List[Dict[str, Any]]] = None,
    usage_tracker_cls=None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Wrapper for _stream_openrouter_response_impl to maintain compatibility."""
    async for event in _stream_openrouter_response_impl(
        openrouter_service=openrouter_service,
        message=message,
        conversation_history=conversation_history,
        workspace_context=workspace_context,
        system_prompt=system_prompt,
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
        response_format=response_format,
        provider_routing=provider_routing,
        execute_function_call_fn=execute_function_call_fn,
        db=db,
        user_timezone=user_timezone,
        hybrid_tool_results=hybrid_tool_results,
        hybrid_tool_cards=hybrid_tool_cards,
        usage_tracker_cls=usage_tracker_cls,
    ):
        yield event


async def _stream_openrouter_response_impl(
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
    response_format: Optional[Dict[str, Any]] = None,
    provider_routing: Optional[Dict[str, Any]] = None,
    # Tool execution function passed in to avoid circular imports
    execute_function_call_fn=None,
    db=None,
    user_timezone: Optional[str] = None,
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
    - "onboarding_complete": Signals that complete_onboarding was executed successfully
    """
    if not openrouter_service.available:
        error_msg = "OpenRouter service is currently unavailable. Please try again later."
        yield ("delta", error_msg)
        yield ("final", {"text": error_msg, "grounding_metadata": None})
        return
    
    t0_provider = time.perf_counter()
    resolved_model = model
    if hasattr(openrouter_service, "_resolve_model"):
        try:
            resolved_model = openrouter_service._resolve_model(model, reasoning_mode=reasoning_mode)
        except Exception:
            resolved_model = model
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_cached_tokens = 0
    
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
        turn_usage: Optional[Dict[str, Any]] = None
        
        # Native tool call accumulator
        pending_tool_calls: Dict[int, Dict[str, Any]] = {}
        reasoning_started = False
        reasoning_buffer = ""
        
        # Legacy text-based tool detection for onboarding
        tool_buffer = ""
        is_collecting_tool = False
        intercepted_legacy_tool_call = False
        
        # Build system prompt - no longer adding tool instructions as they're redundant
        run_system_prompt = system_prompt
        
        if search_enabled:
            # Track web search cost ($10/K = $0.01 per search)
            if usage_tracker_cls and user_id and db:
                try:
                    tracker = usage_tracker_cls(db)
                    await tracker.track_cost(user_id, 0.01, "web_search")
                except Exception as e:
                    api_logger.warning(f"Failed to track search cost: {e}")
            # Search guidance is injected into runtime context to keep the system prompt stable for caching.
        
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
                    turn_usage = chunk["usage"]
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
                chunk_type = chunk.get("type")
                if chunk_type == "reasoning":
                    reasoning_content = chunk.get("content")
                    if reasoning_content:
                        if not reasoning_started:
                            reasoning_started = True
                            yield ("delta", "<thinking>")
                        reasoning_buffer += reasoning_content
                        yield ("delta", reasoning_content)
                        continue
                
                # Handle encrypted reasoning indicator
                if chunk_type == "reasoning_active":
                    if not reasoning_started:
                        reasoning_started = True
                        yield ("delta", "<thinking>")
                    continue
                
                # Handle text content
                if "text" in chunk:
                    text = chunk["text"]
                    if reasoning_started and not accumulated:
                        yield ("delta", "</thinking>\n")
                        reasoning_started = False
                    
                    if text:
                        # Legacy text-based tool detection for onboarding
                        if is_onboarding_tool and not pending_tool_calls:
                            tool_buffer += text
                            
                            if "```json" in tool_buffer or (tool_buffer.strip().startswith("{") and "tool" in tool_buffer):
                                is_collecting_tool = True
                            
                            if is_collecting_tool:
                                if "```" in tool_buffer.split("```json")[-1] or "}" in tool_buffer:
                                    try:
                                        json_match = re.search(r"```(?:javascript|json)?\s*({.*?})\s*```", tool_buffer, re.DOTALL)
                                        if not json_match:
                                            json_match = re.search(r"({.*\"tool\":\s*\"complete_onboarding\".*})", tool_buffer, re.DOTALL)
                                        
                                        if json_match:
                                            json_str = json_match.group(1)
                                            tool_data = json.loads(json_str)
                                            
                                            if tool_data.get("tool") == "complete_onboarding":
                                                api_logger.info(f"Intercepted OpenRouter onboarding tool call (text-based) for user {user_id}")
                                                tool_args = tool_data.get("params") or tool_data.get("arguments") or tool_data
                                                pending_tool_calls[0] = {
                                                    "name": "complete_onboarding",
                                                    "arguments": [json.dumps(tool_args)],
                                                    "id": "legacy_onboarding_call"
                                                }
                                                tool_buffer = ""
                                                is_collecting_tool = False
                                                intercepted_legacy_tool_call = True
                                                break
                                    except Exception as e:
                                        api_logger.warning(f"Failed to parse intercepted tool JSON: {e}")
                                        yield ("delta", tool_buffer)
                                        yielded_any_tokens = True
                                    
                                    accumulated += tool_buffer
                                    tool_buffer = ""
                                    is_collecting_tool = False
                                    continue
                            
                            if len(tool_buffer) > 20 and not is_collecting_tool:
                                yield ("delta", tool_buffer)
                                yielded_any_tokens = True
                                accumulated += tool_buffer
                                tool_buffer = ""
                        else:
                            # Normal streaming
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

        if turn_usage:
            prompt_tokens, completion_tokens, cached_tokens = _extract_usage_counts(turn_usage)
            total_prompt_tokens += prompt_tokens
            total_completion_tokens += completion_tokens
            total_cached_tokens += cached_tokens
        
        # Check for break due to legacy tool call interception
        if intercepted_legacy_tool_call:
            api_logger.info(f"Breaking stream loop for legacy tool call on turn {turn}")
        
        # Close reasoning tags if still open
        if reasoning_started:
            yield ("delta", "</thinking>\n")

        if reasoning_buffer and "<thinking>" not in accumulated.lower():
            accumulated = f"<thinking>{reasoning_buffer}</thinking>\n" + accumulated
        
        # Process tool calls if any
        if pending_tool_calls:
            normalized_calls = []
            for idx, tc in sorted(pending_tool_calls.items()):
                tool_name = tc["name"]
                tool_args_str = "".join(tc["arguments"])
                if not tool_name:
                    continue
                try:
                    tool_args = json.loads(tool_args_str) if tool_args_str else {}
                except json.JSONDecodeError:
                    tool_args = {}
                tool_call_id = tc.get("id") or f"tool_{turn}_{idx}"
                normalized_calls.append({
                    "idx": idx,
                    "name": tool_name,
                    "args_str": tool_args_str or "{}",
                    "args": tool_args,
                    "id": tool_call_id,
                })

            if normalized_calls:
                tool_calls = []
                for call in normalized_calls:
                    tool_calls.append({
                        "id": call["id"],
                        "type": "function",
                        "function": {
                            "name": call["name"],
                            "arguments": call["args_str"],
                        },
                    })
                current_history.append({
                    "role": "model",
                    "text": accumulated,
                    "tool_calls": tool_calls,
                })

            for call in normalized_calls:
                tool_name = call["name"]
                tool_args = call["args"]
                tool_call_id = call["id"]

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

                    # Signal onboarding completion if complete_onboarding succeeded
                    if tool_name == "complete_onboarding" and isinstance(tool_result, dict):
                        if tool_result.get("status") == "success":
                            yield ("onboarding_complete", tool_result)

                    try:
                        tool_content = json.dumps(tool_result)
                    except TypeError:
                        tool_content = json.dumps({"result": str(tool_result)})

                    # Add tool result to history for multi-turn
                    current_history.append({
                        "role": "tool",
                        "name": tool_name,
                        "tool_call_id": tool_call_id,
                        "content": tool_content,
                    })

                except Exception as tool_error:
                    api_logger.error(f"Tool execution failed: {tool_name}: {tool_error}", exc_info=True)
                    current_history.append({
                        "role": "tool",
                        "name": tool_name,
                        "tool_call_id": tool_call_id,
                        "content": json.dumps({"error": str(tool_error)}),
                    })

            total_accumulated += accumulated
            current_message = ""
            continue  # Next turn
        
        # No tool calls - done
        total_accumulated += accumulated
        break
    
    # Final response
    if usage_tracker_cls and user_id and db and (total_prompt_tokens or total_completion_tokens or total_cached_tokens):
        try:
            cached_tokens = min(total_cached_tokens, total_prompt_tokens)
            billable_prompt_tokens = max(total_prompt_tokens - cached_tokens, 0)
            
            # Log cache performance for monitoring
            cache_hit_rate = (cached_tokens / total_prompt_tokens * 100) if total_prompt_tokens > 0 else 0
            if cached_tokens > 0:
                api_logger.info(
                    f"[Cache] HIT: {cached_tokens:,} cached / {total_prompt_tokens:,} prompt tokens "
                    f"({cache_hit_rate:.1f}% cached) | model={resolved_model}",
                    extra={
                        "user_id": user_id,
                        "model": resolved_model,
                        "prompt_tokens": total_prompt_tokens,
                        "cached_tokens": cached_tokens,
                        "cache_hit_rate": cache_hit_rate,
                    }
                )
            
            tracker = usage_tracker_cls(db)
            await tracker.track_usage(
                user_id,
                billable_prompt_tokens,
                total_completion_tokens,
                cached_tokens=cached_tokens,
                model=resolved_model,
            )
        except Exception as error:
            api_logger.warning(f"Failed to track OpenRouter usage: {error}", extra={"user_id": user_id})
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
