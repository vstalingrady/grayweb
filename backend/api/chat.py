import asyncio
import time
from uuid import uuid4
from typing import Any, Dict, List, Optional, AsyncGenerator

import databases
from fastapi import APIRouter, BackgroundTasks, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse

try:
    from backend.auth import get_current_user, require_same_user
    from backend.database import database, get_database
    from backend.logging_config import create_logger, set_request_context, clear_request_context
    from backend.api.chat_models import (
        ChatRequest, ChatResponse, ChatStarterRequest, ChatStarterResponse,
        ChatTitleRequest, ChatTitleResponse, MessageCreateRequest,
        ConversationCreateRequest, ConversationUpdateRequest, ConversationHistoryPayload,
    )
    from backend.core.ai_config import (
        AI_PROVIDER,
        GEMINI_DEFAULT_MODEL,
        GLOBAL_SYSTEM_PROMPTS_PATH,
        get_default_chat_tools,
    )
    from backend.core.rate_limit import limiter
    from backend.core.ai_service import (
        stream_ai_response as _stream_ai_response,
        generate_ai_response as _generate_ai_response,
        generate_chat_starter as _ai_generate_chat_starter
    )
    from backend.compat_imports import (
        utcnow,
        get_cached_user,
        _general_conversation_user_id,
        _load_conversation_history,
        save_conversation_message,
        get_or_create_conversation,
        _prompt_locale_from_request,
        fallback_title_from_message as _fallback_title_from_message,
        _is_valid_uuid,
        update_conversation_title,
        load_prompt_from_json,
        row_get as _row_get,
        normalize_plan_tier,
        coerce_model_for_tier,
        _timezone_from_time_context,
    )
    from backend.core.chat_starter_helpers import sse_event as _sse_event
    from backend.core.title_generator import generate_chat_title_inline as _generate_chat_title_inline
except ImportError:
    from auth import get_current_user, require_same_user  # type: ignore
    from database import database, get_database  # type: ignore
    from logging_config import create_logger, set_request_context, clear_request_context  # type: ignore
    from api.chat_models import (  # type: ignore
        ChatRequest, ChatResponse, ChatStarterRequest, ChatStarterResponse,
        ChatTitleRequest, ChatTitleResponse, MessageCreateRequest,
        ConversationCreateRequest, ConversationUpdateRequest, ConversationHistoryPayload,
    )
    from core.rate_limit import limiter  # type: ignore
    from core.ai_service import (  # type: ignore
        stream_ai_response as _stream_ai_response,
        generate_ai_response as _generate_ai_response,
        generate_chat_starter as _ai_generate_chat_starter
    )
    from compat_imports import (  # type: ignore
        utcnow, utcnow_aware,
        get_cached_user,
        _general_conversation_user_id,
        _insert_general_conversation_message,
        _load_general_conversation_history,
        _load_conversation_history,
        save_conversation_message,
        get_or_create_conversation,
        _prompt_locale_from_request,
        _fallback_title_from_message,
        _is_valid_uuid,
        update_conversation_title,
        load_prompt_from_json,
        _row_get,
        normalize_plan_tier,
        coerce_model_for_tier,
        _timezone_from_time_context,
    )
    from core.chat_starter_helpers import sse_event as _sse_event  # type: ignore
    from core.title_generator import generate_chat_title_inline as _generate_chat_title_inline  # type: ignore

api_logger = create_logger("api.chat")

router = APIRouter(tags=["chat"])


async def _get_db() -> databases.Database:
    # Database connections are managed globally via startup/shutdown hooks.
    return database


@router.post("/api/chat/starter", response_model=ChatStarterResponse)
@limiter.limit("30/minute")
async def chat_starter_route(
    request: Request,
    payload: ChatStarterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatStarterResponse:
    """Return an AI-authored greeting using the modular AI service."""
    require_same_user(payload.user_id, current_user)
    message, used_fallback = await _ai_generate_chat_starter(
        user_id=payload.user_id,
        workspace_context=payload.workspace_context,
        system_prompt=payload.system_prompt,
        time_context=payload.time_context,
        user_nickname=payload.nickname,
        user_about=payload.about,
        user_name=payload.name,
        user_occupation=payload.occupation,
        custom_instructions=payload.custom_instructions,
        prompt_locale=_prompt_locale_from_request(request)
    )
    return ChatStarterResponse(message=message, used_fallback=used_fallback)


@router.post("/api/chat/title", response_model=ChatTitleResponse)
@limiter.limit("30/minute")
async def chat_title_route(
    request: Request,
    payload: ChatTitleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatTitleResponse:
    """Generate a chat title suggestion."""
    _ = current_user
    title = _fallback_title_from_message(payload.message)
    return ChatTitleResponse(title=title)


@router.post("/api/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_route(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
) -> ChatResponse:
    """Send a message to AI and get a response"""
    # Force the request user to the authenticated user to avoid mismatches from stale client state.
    authenticated_user_id = current_user["id"]
    chat_request.user_id = authenticated_user_id
    prompt_locale = _prompt_locale_from_request(request)

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(chat_request.user_id)[:8])

    api_logger.info("Chat request received", extra={
        "event_type": "chat_request_start",
        "user_id": chat_request.user_id,
        "message_length": len(chat_request.message),
        "conversation_id": chat_request.conversation_id,
        "model": chat_request.model,
        "correlation_id": correlation_id
    })

    # Initialize tools (currently unused in non-streaming endpoint, but required by generate_ai_response)
    tool_list = None

    try:
        # Generate a title for the chat session (only if requested)
        session_title = _fallback_title_from_message(chat_request.message)

        # Determine conversation_id
        requested_conversation_id = chat_request.conversation_id
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        if requested_conversation_id and not valid_requested_conversation_id:
            conversation_id = requested_conversation_id
        else:
            conversation_id = await get_or_create_conversation(
                requested_conversation_id if valid_requested_conversation_id else None,
                chat_request.user_id,
                title=session_title,
            )

        # Get conversation history for context
        conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id, chat_request.user_id)

        # For thread conversations, inject General chat context as background memory.
        is_general_conversation = _general_conversation_user_id(conversation_id) is not None
        if not is_general_conversation:
            try:
                general_history = await _load_general_conversation_history(chat_request.user_id)
                if general_history:
                    recent_general = general_history[-10:]
                    if recent_general:
                        general_context_marker = {
                            "role": "user",
                            "text": "[CONTEXT FROM GENERAL CHAT - This is background context from the user's main conversation area. Use this to maintain continuity and remember what the user has discussed previously.]"
                        }
                        general_context_end = {
                            "role": "model",
                            "text": "[I understand and will remember this context while responding in this thread.]"
                        }
                        conversation_history = [general_context_marker] + recent_general + [general_context_end] + conversation_history
            except Exception as e:
                api_logger.debug(f"Could not load general context: {e}", extra={"user_id": chat_request.user_id})

        # Save user message to local conversation store (after capturing prior history),
        # but avoid writing an identical message twice in a row (e.g., when a fallback
        # request replays the same prompt after a streaming failure).
        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": chat_request.message
        }
        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and last_history_entry.get("role") in {"user", "assistant", "model"}
            and (last_history_entry.get("text") or "") == chat_request.message
        )
        if is_general_conversation:
             # General chat messages are not handled by save_conversation_message
             # We must manually insert them using the general chat persistence logic
             if should_persist_user:
                 await _insert_general_conversation_message(
                     user_id=authenticated_user_id,
                     role="user",
                     text=chat_request.message
                 )
        elif should_persist_user:
            await save_conversation_message(conversation_id, user_message_payload, user_id=chat_request.user_id)

        # Enforce tier restrictions
        # Only Voyager and Pioneer users can use reasoning mode.
        normalized_tier = normalize_plan_tier(
            current_user.get("plan_tier"),
            current_user.get("role"),
            current_user.get("subscription_expires_at")
        )

        # If user requested reasoning but is not eligible, disable it silently (or we could raise 403)
        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            api_logger.info(f"Disabling reasoning mode for user {chat_request.user_id} (tier: {normalized_tier})")
            effective_reasoning_mode = False

        effective_model, model_coerced = coerce_model_for_tier(chat_request.model, normalized_tier)
        if model_coerced:
            api_logger.info(
                "Coerced requested model for user tier",
                extra={
                    "event_type": "model_coerced",
                    "user_id": chat_request.user_id,
                    "plan_tier": normalized_tier,
                    "requested_model": chat_request.model,
                    "effective_model": effective_model,
                },
            )

        # Generate AI response
        ai_response, grounding_metadata = await _generate_ai_response(
            chat_request.message,
            conversation_history,
            chat_request.context,
            chat_request.system_prompt,
            chat_request.time_context,
            effective_model,
            chat_request.attachments,
            chat_request.user_id,
            db,
            response_schema=chat_request.response_json_schema,
            response_mime_type=chat_request.response_mime_type,
            context_cache_id=chat_request.context_cache_id,
            maps_enabled=chat_request.maps_enabled,
            maps_latitude=chat_request.maps_latitude,
            maps_longitude=chat_request.maps_longitude,
            maps_widget=chat_request.maps_widget,
            search_enabled=chat_request.web_search_enabled,
            should_generate_title=chat_request.should_generate_title,
            reasoning_mode=effective_reasoning_mode,
            tools=tool_list,
            user_timezone=chat_request.timezone,
            plan_tier=normalized_tier,
        )

        # Save AI response (including grounding metadata for downstream UI)
        assistant_message_payload: Dict[str, Any] = {
            "role": "model",
            "text": ai_response,
        }
        if grounding_metadata:
            assistant_message_payload["grounding_metadata"] = grounding_metadata
        assistant_message_id = None
        if is_general_conversation:
            # General Chat persistence
            assistant_message_id = await _insert_general_conversation_message(
                 user_id=authenticated_user_id,
                 role="model",
                 text=ai_response,
                 grounding_metadata=grounding_metadata
            )
        else:
             # Regular thread persistence
             assistant_message_id = await save_conversation_message(conversation_id, assistant_message_payload, user_id=authenticated_user_id)

        # Generate title inline so it's returned with the response.
        # This adds ~100-300ms latency but only on first message of new conversations.
        final_title = session_title
        if chat_request.should_generate_title:
            try:
                generated_title = await _generate_chat_title_inline(
                    chat_request.message,
                    ai_response,
                    prompt_locale=prompt_locale,
                )
                if generated_title:
                    final_title = generated_title
                    # Store in DB in background (non-blocking)
                    background_tasks.add_task(
                        update_conversation_title,
                        conversation_id,
                        generated_title,
                    )
            except Exception as title_error:
                api_logger.warning(
                    f"Inline title generation failed: {title_error}",
                    extra={"event_type": "title_generation_error"}
                )
                # Fall back to session_title, already set above

        clear_request_context()
        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id,
            grounding_metadata=grounding_metadata,
            title=final_title,
            message_id=assistant_message_id,
        )

    except Exception as e:
        api_logger.error(f"CHAT_ERROR_DEBUG: Chat endpoint failed: {e}", exc_info=True, extra={"user_id": chat_request.user_id})
        clear_request_context()
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


ONBOARDING_SYSTEM_PROMPT = load_prompt_from_json(
    GLOBAL_SYSTEM_PROMPTS_PATH,
    "onboarding",
    "You are Gray.",
)

DEFAULT_SYSTEM_PROMPT = load_prompt_from_json(
    GLOBAL_SYSTEM_PROMPTS_PATH,
    "chat",
    "You are Gray.",
)

@router.post("/api/chat/stream")
@limiter.limit("120/minute")
async def chat_stream_route(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Stream an AI response token-by-token using Server-Sent Events."""
    chat_request.user_id = current_user["id"]
    start_time = utcnow()
    prompt_locale = _prompt_locale_from_request(request)

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(chat_request.user_id)[:8])

    api_logger.info("Chat stream request received", extra={
        "event_type": "chat_stream_request_start",
        "user_id": chat_request.user_id,
        "message_length": len(chat_request.message),
        "conversation_id": chat_request.conversation_id,
        "model": chat_request.model,
        "correlation_id": correlation_id
    })

    try:
        # 1. Start User Lookup (Async + Cached)
        user_task = asyncio.create_task(get_cached_user(chat_request.user_id))

        # 2. Prepare Session Title (Sync, fast)
        effective_message = chat_request.message
        session_title = _fallback_title_from_message(effective_message)

        # 4. Start Conversation Setup (Async)
        t0_conv = time.perf_counter()
        requested_conversation_id = chat_request.conversation_id
        
        # FIX: If no conversation_id provided, default to General Chat format
        if not requested_conversation_id:
            requested_conversation_id = f"general:{chat_request.user_id}"
        
        conv_task = asyncio.create_task(get_or_create_conversation(
            requested_conversation_id if _is_valid_uuid(requested_conversation_id) else None,
            chat_request.user_id,
            title=session_title,
        ))

        # 5. Resolve System Prompt & Tier (Concurrent with User Fetch)
        user_record = await user_task
        user_plan_tier = _row_get(user_record, "plan_tier") or "scout"
        is_onboarding = _row_get(user_record, "onboarding_completed") is False
        force_onboarding_mode = chat_request.system_prompt == "onboarding"

        effective_system_prompt = chat_request.system_prompt
        if force_onboarding_mode:
            effective_system_prompt = ONBOARDING_SYSTEM_PROMPT
        elif not effective_system_prompt:
             effective_system_prompt = DEFAULT_SYSTEM_PROMPT

        # Determine Tool List (Parallel)
        tool_list = get_default_chat_tools()

        # Infer timezone from time_context if not explicitly provided
        if not chat_request.timezone and chat_request.time_context:
            tz_label, _ = _timezone_from_time_context(chat_request.time_context)
            if tz_label:
                chat_request.timezone = tz_label

        # Await conversation ID
        conversation_id = await conv_task
        t1_conv = time.perf_counter()
        api_logger.info(f"Conversation setup time: {(t1_conv - t0_conv)*1000:.2f}ms", extra={"user_id": chat_request.user_id})

        conversation_history: List[Dict[str, Any]] = []
        if conversation_id:
            conversation_history = await _load_conversation_history(conversation_id, chat_request.user_id)

        # Avoid sending an empty payload to the AI provider
        if not (effective_message or "").strip() and not conversation_history and not (chat_request.attachments or []):
            effective_message = "Let's get started."

        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": effective_message,
        }

        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and last_history_entry.get("role") in {"user", "assistant", "model"}
            and (last_history_entry.get("text") or "") == effective_message
        )
        if should_persist_user:
            # Make persistence non-blocking to improve time-to-first-token
            async def _persist_user_msg():
                try:
                    general_user_id = _general_conversation_user_id(conversation_id)
                    if general_user_id is not None:
                         await _insert_general_conversation_message(
                            user_id=general_user_id,
                            role="user",
                            text=effective_message,
                        )
                    else:
                        await save_conversation_message(
                            conversation_id,
                            user_message_payload,
                            user_id=chat_request.user_id,
                        )
                except Exception as e:
                    api_logger.error(f"Failed to persist user message: {e}", extra={"user_id": chat_request.user_id})

            asyncio.create_task(_persist_user_msg())

        # Enforce tier restrictions for streaming
        normalized_tier = normalize_plan_tier(
            user_plan_tier,
            _row_get(user_record, "role"),
            _row_get(user_record, "subscription_expires_at")
        )

        effective_model, model_coerced = coerce_model_for_tier(chat_request.model, normalized_tier)
        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("voyager", "pioneer"):
            effective_reasoning_mode = False

        async def event_stream() -> AsyncGenerator[str, None]:
            nonlocal session_title
            start_time_stream = time.perf_counter()
            first_token_time: Optional[float] = None

            yield ":streaming-start\n\n"
            try:
                accumulated_chunks: List[str] = []
                final_response: Optional[str] = None
                grounding_metadata_payload: Optional[Dict[str, Any]] = None
                
                async for kind, payload in _stream_ai_response(
                    effective_message,
                    conversation_history,
                    chat_request.context,
                    effective_system_prompt,
                    user_id=chat_request.user_id,
                    db=db,
                    user_timezone=chat_request.timezone,
                    time_context=chat_request.time_context,
                    model=effective_model,
                    attachments=chat_request.attachments,
                    context_cache_id=chat_request.context_cache_id,
                    maps_enabled=chat_request.maps_enabled,
                    maps_latitude=chat_request.maps_latitude,
                    maps_longitude=chat_request.maps_longitude,
                    maps_widget=chat_request.maps_widget,
                    search_enabled=chat_request.web_search_enabled,
                    should_generate_title=chat_request.should_generate_title,
                    reasoning_mode=effective_reasoning_mode,
                    reminders_enabled=chat_request.reminders_enabled,
                    tools=tool_list,
                    plan_tier=normalized_tier,
                ):
                    if kind == "delta":
                        if not payload:
                            continue
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        accumulated_chunks.append(payload)
                        yield _sse_event("token", {"delta": payload})
                    elif kind == "tool_card":
                        yield _sse_event("tool_card", payload)
                    elif kind == "reminders":
                        yield _sse_event("reminders", {"reminders": payload})
                    elif kind == "final":
                        reminders_payload = None
                        if isinstance(payload, dict):
                            final_response = payload.get("text") or "".join(accumulated_chunks)
                            grounding_metadata_payload = payload.get("grounding_metadata")
                            reminders_payload = payload.get("reminders")
                        elif payload:
                            final_response = payload

                if final_response is None:
                    final_response = "".join(accumulated_chunks)
                
                if reminders_payload:
                    yield _sse_event("reminders", {"reminders": reminders_payload})

                async def _finalize_chat(cid: str, uid: int, text: str, metadata: Optional[Dict[str, Any]]):
                    try:
                        general_user_id = _general_conversation_user_id(cid)
                        if general_user_id is not None:
                            await _insert_general_conversation_message(user_id=general_user_id, role="model", text=text, grounding_metadata=metadata)
                        else:
                            await save_conversation_message(cid, {"role": "model", "text": text, "grounding_metadata": metadata} if metadata else {"role": "model", "text": text}, user_id=uid)
                    except Exception as e:
                        api_logger.error(f"Failed to finalize chat: {e}", extra={"user_id": uid})

                background_tasks.add_task(_finalize_chat, conversation_id, chat_request.user_id, final_response, grounding_metadata_payload)

                final_title = session_title
                if chat_request.should_generate_title:
                    try:
                        generated_title = await _generate_chat_title_inline(effective_message, final_response, prompt_locale=prompt_locale)
                        if generated_title:
                            final_title = generated_title
                            background_tasks.add_task(update_conversation_title, conversation_id, generated_title)
                    except Exception: pass

                end_payload: Dict[str, Any] = {"conversation_id": conversation_id, "response": final_response, "title": final_title}
                if grounding_metadata_payload:
                    end_payload["grounding_metadata"] = grounding_metadata_payload
                
                final_time = time.perf_counter()
                timing_payload = {"total_ms": int((final_time - start_time_stream) * 1000)}
                if first_token_time:
                    timing_payload["first_token_ms"] = int((first_token_time - start_time_stream) * 1000)
                end_payload["timing"] = timing_payload
                yield _sse_event("end", end_payload)

            except asyncio.CancelledError:
                raise
            except Exception as stream_error:
                api_logger.error(f"Stream loop error: {stream_error}", exc_info=True)
                yield _sse_event("error", {"message": str(stream_error)})

        headers = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        clear_request_context()
        return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
    except Exception as error:
        api_logger.error(f"Chat stream failed: {error}", exc_info=True)
        clear_request_context()
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/api/conversation/{conversation_id}/messages")
@limiter.limit("60/minute")
async def create_conversation_message_route(
    request: Request,
    conversation_id: str,
    payload: MessageCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.create_conversation_message(
        request,
        conversation_id,
        payload,
        current_user,
    )


@router.get("/api/conversation/{conversation_id}")
@limiter.limit("120/minute")
async def get_conversation_route(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.get_conversation(
        request,
        conversation_id,
        current_user,
    )


@router.post("/api/conversation")
@limiter.limit("30/minute")
async def create_conversation_route(
    request: Request,
    payload: ConversationCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.create_conversation(request, payload, current_user)


@router.delete("/api/conversation/{conversation_id}", status_code=204)
@limiter.limit("20/minute")
async def delete_conversation_route(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.delete_conversation(
        request,
        conversation_id,
        current_user,
    )


@router.put("/api/conversation/{conversation_id}/history")
@limiter.limit("20/minute")
async def overwrite_conversation_history_route(
    request: Request,
    conversation_id: str,
    payload: ConversationHistoryPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.overwrite_conversation_history(
        request,
        conversation_id,
        payload,
        current_user,
    )


@router.patch("/api/conversation/{conversation_id}")
@limiter.limit("60/minute")
async def update_conversation_route(
    request: Request,
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.update_conversation(
        request,
        conversation_id,
        payload,
        current_user,
    )


@router.post("/api/conversation/{conversation_id}/metadata")
@limiter.limit("60/minute")
async def update_conversation_metadata_route(
    request: Request,
    conversation_id: str,
    payload: ConversationUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.update_conversation_metadata(
        request,
        conversation_id,
        payload,
        current_user,
    )


@router.get("/api/conversation/{conversation_id}/usage")
@limiter.limit("120/minute")
async def get_conversation_usage_route(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.get_conversation_usage(
        request,
        conversation_id,
        current_user,
    )


@router.post("/api/conversation/{conversation_id}/compress")
@limiter.limit("10/minute")
async def compress_conversation_route(
    request: Request,
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    backend_main = _get_backend_main()
    return await backend_main.compress_conversation(
        request,
        conversation_id,
        current_user,
    )

