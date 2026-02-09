"""
OpenRouter Streaming Handler

Handles streaming responses from OpenRouter with full tool execution support.
"""
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx
from google.genai import types

api_logger = logging.getLogger("backend.api")

# Import helpers
from backend.core.ai_utils import materialize_structured_reminders, openrouter_annotations_to_grounding, validate_json_text_against_schema


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


def _normalize_search_query(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.strip().split())
    if not normalized:
        return None
    if len(normalized) > 180:
        return normalized[:177].rstrip() + "..."
    return normalized


def _extract_search_query(tool_name: str, tool_args: Any) -> Optional[str]:
    """Best-effort extraction of user-visible search query text from tool args."""
    normalized_name = (tool_name or "").strip().lower()
    if not normalized_name:
        return None
    if "search" not in normalized_name and "web" not in normalized_name:
        return None
    candidate_keys = (
        "query",
        "queries",
        "q",
        "search",
        "search_query",
        "searchQuery",
        "search_term",
        "searchTerm",
        "query_text",
        "queryText",
        "keywords",
        "keyword",
        "terms",
        "question",
        "topic",
        "text",
        "prompt",
        "input",
        "value",
        "request",
        "params",
        "arguments",
    )

    def _pull(value: Any) -> Optional[str]:
        normalized = _normalize_search_query(value)
        if normalized:
            return normalized
        if isinstance(value, list):
            for item in value:
                normalized_item = _normalize_search_query(item)
                if normalized_item:
                    return normalized_item
                if isinstance(item, dict):
                    nested = _pull(item)
                    if nested:
                        return nested
        if isinstance(value, dict):
            for key in candidate_keys:
                if key in value:
                    nested = _pull(value.get(key))
                    if nested:
                        return nested
            for nested_value in value.values():
                nested = _pull(nested_value)
                if nested:
                    return nested
        if isinstance(value, str):
            for pattern in (
                r'"(?:query|q|search_query|searchQuery|search_term|searchTerm|keywords|text|prompt|question|topic|input)"\s*:\s*"([^"]+)"',
                r"'(?:query|q|search_query|searchQuery|search_term|searchTerm|keywords|text|prompt|question|topic|input)'\s*:\s*'([^']+)'",
            ):
                match = re.search(pattern, value, flags=re.IGNORECASE)
                if match:
                    extracted = _normalize_search_query(match.group(1))
                    if extracted:
                        return extracted
        return None

    if isinstance(tool_args, dict):
        for key in candidate_keys:
            if key in tool_args:
                direct = _pull(tool_args.get(key))
                if direct:
                    return direct

    return _pull(tool_args)


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
    user: Optional[str] = None,
    response_format: Optional[Dict[str, Any]] = None,
    response_schema: Optional[Dict[str, Any]] = None,
    provider_routing: Optional[Dict[str, Any]] = None,
    web_search_plugin: Optional[List[Dict[str, Any]]] = None,
    web_search_options: Optional[Dict[str, Any]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    execute_function_call_fn=None,
    db=None,
    user_timezone: Optional[str] = None,
    plan_tier: Optional[str] = None,
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
        web_search_plugin=web_search_plugin,
        web_search_options=web_search_options,
        reasoning_mode=reasoning_mode,
        media_attachments=media_attachments,
        history_token_budget=history_token_budget,
        user_id=user_id,
        user=user,
        needs_structured_tools=needs_structured_tools,
        is_onboarding_tool=is_onboarding_tool,
        response_format=response_format,
        response_schema=response_schema,
        provider_routing=provider_routing,
        execute_function_call_fn=execute_function_call_fn,
        db=db,
        user_timezone=user_timezone,
        plan_tier=plan_tier,
        usage_tracker_cls=usage_tracker_cls,
        extra_headers=extra_headers,
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
    user: Optional[str] = None,
    response_format: Optional[Dict[str, Any]] = None,
    response_schema: Optional[Dict[str, Any]] = None,
    provider_routing: Optional[Dict[str, Any]] = None,
    web_search_plugin: Optional[List[Dict[str, Any]]] = None,
    web_search_options: Optional[Dict[str, Any]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    # Tool execution function passed in to avoid circular imports
    execute_function_call_fn=None,
    db=None,
    user_timezone: Optional[str] = None,
    plan_tier: Optional[str] = None,
    # Usage tracking
    usage_tracker_cls=None,
) -> AsyncGenerator[Tuple[str, Any], None]:
    """Stream response from OpenRouter with multi-turn tool handling.
    
    Yields tuples of (event_type, data) where event_type is one of:
    - "delta": Text chunk to stream
    - "final": Final response with metadata
    - "reminders": Reminder/plan/habit cards
    - "usage": Usage statistics
    - "tool_status": Tool execution lifecycle events
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
    
    # Multi-turn loop for tool handling
    current_history = list(conversation_history) if conversation_history else []
    max_tool_turns = 5
    yielded_any_tokens = False
    total_accumulated = ""
    current_message = message
    annotations_accumulated: List[Dict[str, Any]] = []
    executed_search_queries: List[str] = []

    def _remember_search_query(query: Optional[str]) -> None:
        normalized = _normalize_search_query(query)
        if not normalized:
            return
        if normalized in executed_search_queries:
            return
        executed_search_queries.append(normalized)

    def _resolve_fallback_search_query() -> Optional[str]:
        if isinstance(current_message, str):
            normalized_current = _normalize_search_query(current_message)
            if normalized_current:
                return normalized_current
        for entry in reversed(current_history):
            if not isinstance(entry, dict):
                continue
            role = str(entry.get("role") or "").strip().lower()
            if role != "user":
                continue
            text = entry.get("text")
            if isinstance(text, str):
                normalized_text = _normalize_search_query(text)
                if normalized_text:
                    return normalized_text
        return None
    
    for turn in range(max_tool_turns + 1):
        accumulated = ""
        t0_first_token = time.perf_counter()
        got_first_token = False
        turn_usage: Optional[Dict[str, Any]] = None
        assistant_text_emitted = False

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
        try:
            async for chunk in openrouter_service.stream(
                current_message,
                current_history,
                workspace_context,
                run_system_prompt,
                time_context,
                model,
                include_usage=True,
                response_format=response_format,
                tools=tool_list,
                tool_choice="auto",
                plugins=web_search_plugin if search_enabled else None,
                web_search_options=web_search_options if search_enabled else None,
                reasoning_mode=reasoning_mode,
                attachments=media_attachments,
                history_token_budget=history_token_budget,
                provider_routing=provider_routing,
                user=user,
                extra_headers=extra_headers,
            ):
                if isinstance(chunk, dict):
                    # Handle usage statistics
                    if "usage" in chunk:
                        turn_usage = chunk["usage"]
                        yield ("usage", chunk["usage"])
                        continue

                    if "annotations" in chunk and isinstance(chunk.get("annotations"), list):
                        annotations_accumulated.extend(
                            [a for a in chunk["annotations"] if isinstance(a, dict)]
                        )
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
                            # Keep reasoning contiguous. If visible answer text has already started,
                            # drop late reasoning fragments to avoid interleaved blocks.
                            if assistant_text_emitted:
                                continue
                            if not reasoning_started:
                                reasoning_started = True
                                yield ("delta", "<thinking>")
                            reasoning_buffer += reasoning_content
                            yield ("delta", reasoning_content)
                            continue
                    
                    # Handle encrypted reasoning indicator
                    if chunk_type == "reasoning_active":
                        if assistant_text_emitted:
                            continue
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
                                            assistant_text_emitted = True
                                        
                                        accumulated += tool_buffer
                                        tool_buffer = ""
                                        is_collecting_tool = False
                                        continue
                                
                                if len(tool_buffer) > 20 and not is_collecting_tool:
                                    yield ("delta", tool_buffer)
                                    yielded_any_tokens = True
                                    assistant_text_emitted = True
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
                                assistant_text_emitted = True
                                yield ("delta", text)
                
                elif isinstance(chunk, str):
                    if not got_first_token:
                        got_first_token = True
                        ttft = (time.perf_counter() - t0_first_token) * 1000
                        if ttft > 200:
                            api_logger.info(f"[Timing] OpenRouter TTFT: {ttft:.0f}ms")
                    accumulated += chunk
                    yielded_any_tokens = True
                    assistant_text_emitted = True
                    yield ("delta", chunk)
        except httpx.HTTPStatusError as stream_error:
            status_code = getattr(getattr(stream_error, "response", None), "status_code", None)
            if isinstance(status_code, int) and status_code >= 500:
                api_logger.warning(
                    "OpenRouter stream failed with provider 5xx; attempting non-stream recovery",
                    extra={"status_code": status_code, "turn": turn, "user_id": user_id},
                )
                recovered_text = ""
                try:
                    recovery = await openrouter_service.generate(
                        current_message or "Continue.",
                        current_history,
                        workspace_context,
                        run_system_prompt,
                        time_context,
                        model,
                        attachments=media_attachments,
                        include_usage=False,
                        response_format=response_format,
                        tools=tool_list,
                        tool_choice="auto",
                        plugins=None,
                        provider_routing=provider_routing,
                        web_search_options=None,
                        return_metadata=False,
                        history_token_budget=history_token_budget,
                        user=user,
                        extra_headers=extra_headers,
                    )
                    recovered_text = recovery if isinstance(recovery, str) else ""
                except Exception as recovery_error:
                    api_logger.error(
                        "OpenRouter non-stream recovery failed after stream 5xx",
                        extra={
                            "status_code": status_code,
                            "turn": turn,
                            "user_id": user_id,
                            "error": str(recovery_error),
                        },
                    )
                if recovered_text.strip():
                    if reasoning_started:
                        yield ("delta", "</thinking>\n")
                        reasoning_started = False
                    accumulated += recovered_text
                    yielded_any_tokens = True
                    assistant_text_emitted = True
                    yield ("delta", recovered_text)
                elif turn == 0:
                    fallback_text = (
                        "I hit a temporary provider issue while generating your response. "
                        "Please try again in a few seconds."
                    )
                    if reasoning_started:
                        yield ("delta", "</thinking>\n")
                        reasoning_started = False
                    accumulated += fallback_text
                    yielded_any_tokens = True
                    assistant_text_emitted = True
                    yield ("delta", fallback_text)
                else:
                    raise stream_error
            else:
                raise

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
                tool_call = types.FunctionCall(name=tool_name, args=tool_args)

                # Emit tool status so the client can show UI feedback while the tool runs.
                tool_status_payload: Dict[str, Any] = {"name": tool_name, "status": "start"}
                search_query = _extract_search_query(tool_name, tool_args)
                if not search_query and (("search" in tool_name.lower()) or ("web" in tool_name.lower())):
                    search_query = _resolve_fallback_search_query()
                if search_query:
                    _remember_search_query(search_query)
                    tool_status_payload["query"] = search_query
                yield ("tool_status", tool_status_payload)

                try:
                    tool_result = await execute_function_call_fn(
                        tool_call, user_id, db, user_timezone=user_timezone, plan_tier=plan_tier
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
                finally:
                    yield ("tool_status", {"name": tool_name, "status": "end"})

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
    grounding_metadata = openrouter_annotations_to_grounding(annotations_accumulated)
    if executed_search_queries:
        if grounding_metadata is None:
            grounding_metadata = {}
        existing_queries = grounding_metadata.get("web_search_queries")
        merged_queries: List[str] = []
        if isinstance(existing_queries, list):
            for existing in existing_queries:
                normalized_existing = _normalize_search_query(existing)
                if normalized_existing and normalized_existing not in merged_queries:
                    merged_queries.append(normalized_existing)
        for query in executed_search_queries:
            if query not in merged_queries:
                merged_queries.append(query)
        if merged_queries:
            grounding_metadata["web_search_queries"] = merged_queries
    final_text = total_accumulated

    if response_format:
        final_text, structured_reminders = materialize_structured_reminders(final_text)
        if response_schema:
            is_valid, error = validate_json_text_against_schema(final_text, response_schema)
            if not is_valid:
                api_logger.warning(
                    f"OpenRouter JSON validation failed: {error}",
                    extra={"event_type": "openrouter_json_validation_failed", "error": error},
                )
                repair_prompt = (
                    "Fix the following JSON so it matches the provided schema. "
                    "Return ONLY valid JSON that conforms to the schema.\n\n"
                    f"Schema:\n{json.dumps(response_schema)}\n\nJSON:\n{final_text}"
                )
                repaired = await openrouter_service.generate(
                    repair_prompt,
                    conversation_history=None,
                    workspace_context=None,
                    system_prompt="You are a JSON repair assistant.",
                    time_context=None,
                    model=resolved_model,
                    response_format=response_format,
                    provider_routing=provider_routing,
                    return_metadata=False,
                )
                if isinstance(repaired, str) and repaired.strip():
                    final_text = repaired
        yield ("final", {
            "text": final_text,
            "grounding_metadata": grounding_metadata,
            "reminders": structured_reminders if structured_reminders else None
        })
    else:
        if not final_text.strip():
            if executed_search_queries:
                final_text = (
                    "I couldn't find enough signal from that search. "
                    "Try rephrasing with a bit more detail, or ask me to recall from memory."
                )
            else:
                final_text = "I couldn't generate a complete reply just now. Please try again."
            yield ("delta", final_text)
        yield ("final", {"text": final_text, "grounding_metadata": grounding_metadata})
