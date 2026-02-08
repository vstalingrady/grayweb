import asyncio
import re
import time
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, Dict, List, Optional, AsyncGenerator

import databases
from fastapi import APIRouter, BackgroundTasks, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse

from backend.auth import get_current_user, require_same_user
from backend.database import database, get_database
from backend.logging_config import create_logger, set_request_context, clear_request_context
from backend.core.async_utils import create_logged_task
from backend.api.chat_models import (
    ChatRequest, ChatResponse, ChatStarterRequest, ChatStarterResponse,
    ChatTitleRequest, ChatTitleResponse, MessageCreateRequest,
    ConversationCreateRequest, ConversationUpdateRequest, ConversationHistoryPayload,
)
from backend.core.ai_config import (
    AI_PROVIDER,
    GLOBAL_SYSTEM_PROMPTS_PATH,
    get_default_chat_tools,
)
from backend.core.rate_limit import limiter
from backend.core.ai_service import (
    stream_ai_response as _stream_ai_response,
    generate_ai_response as _generate_ai_response,
    generate_chat_starter as _ai_generate_chat_starter,
)
from backend.compat_imports import (
    utcnow,
    get_cached_user,
    _general_conversation_user_id,
    _insert_general_conversation_message,
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
from backend.onboarding_tools import ONBOARDING_TOOLS
from backend.core.chat_starter_helpers import sse_event as _sse_event
from backend.core.title_generator import generate_chat_title_inline as _generate_chat_title_inline
from backend.core.media_attachments import resolve_attachment_metadata
from backend.core.message_detection import should_enable_search
from backend.core.streaks import (
    append_streak_context,
    build_engagement_context,
    count_ignored_proactivity,
    compute_inactivity_days,
    load_last_user_message_at,
    update_user_streak,
)
from backend.supermemory import (
    SUPERMEMORY_SERVICE,
    detect_memory_category,
    parse_supermemory_overrides,
    supermemory_force_enabled,
    supermemory_force_overrides,
    supermemory_force_plan_tier,
)

api_logger = create_logger("api.chat")

router = APIRouter(tags=["chat"])

CUSTOM_INSTRUCTIONS_HEADER = "CUSTOM INSTRUCTIONS FROM USER (SOURCE OF TRUTH)"
FOLLOW_UP_PRONOUN_PATTERN = re.compile(r"\b(him|her|them|that|this|it)\b", re.IGNORECASE)
FOLLOW_UP_REFERENTIAL_PATTERN = re.compile(
    r"\b("
    r"him|her|them|that|this|it|those|these|"
    r"other\s+half|the\s+other\s+half|other\s+part|the\s+rest|rest\s+of\s+(?:it|that|them)|"
    r"other\s+side|remaining\s+(?:half|part|pieces?|details?)|what\s+about\s+(?:that|it|him|her|them|the\s+rest|the\s+other)"
    r")\b",
    re.IGNORECASE,
)
LOW_INFORMATION_SEARCH_TURN_PATTERN = re.compile(
    r"^\s*(?:search|search\s+please|pls\s+search|please\s+search|google\s+it|look\s+it\s+up)\s*$",
    re.IGNORECASE,
)
FOLLOW_UP_CONTEXT_KEYWORDS = (
    "news",
    "file",
    "files",
    "report",
    "reports",
    "document",
    "documents",
    "release",
    "update",
    "updates",
    "investigation",
    "case",
    "price",
    "weather",
    "score",
    "election",
    "policy",
    "court",
)
WEB_ACCESS_DISCLAIMER_PATTERN = re.compile(
    r"(?:\bi\s+(?:don['’]t|do not)\s+have\s+(?:real[\s-]?time|live)\s+access\b|"
    r"\bi\s+(?:can['’]t|cannot)\s+browse\b|"
    r"\bmy\s+knowledge\s+has\s+(?:a\s+)?cutoff\b|"
    r"\bknowledge\s+cutoff\b)",
    re.IGNORECASE,
)


def _is_low_information_search_turn(text: str) -> bool:
    normalized = (text or "").strip().lower()
    if not normalized:
        return True
    if LOW_INFORMATION_SEARCH_TURN_PATTERN.match(normalized):
        return True
    words = normalized.split()
    if len(words) <= 3 and any(token in normalized for token in ("search", "google", "lookup", "look up")):
        return True
    return False


def _has_web_grounding(metadata: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(metadata, dict):
        return False

    queries = metadata.get("web_search_queries") or metadata.get("webSearchQueries")
    if isinstance(queries, list) and any(isinstance(item, str) and item.strip() for item in queries):
        return True

    chunks = metadata.get("grounding_chunks") or metadata.get("groundingChunks")
    if isinstance(chunks, list):
        for chunk in chunks:
            if isinstance(chunk, dict) and (chunk.get("web") or chunk.get("retrieved_context") or chunk.get("retrievedContext")):
                return True

    search_entry = metadata.get("search_entry_point") or metadata.get("searchEntryPoint")
    if isinstance(search_entry, dict) and search_entry:
        return True

    return False


def _strip_incorrect_web_access_disclaimer(
    text: str,
    *,
    search_enabled: bool,
    grounding_metadata: Optional[Dict[str, Any]],
) -> str:
    if not search_enabled or not text or not _has_web_grounding(grounding_metadata):
        return text

    paragraphs = [segment.strip() for segment in re.split(r"\n{2,}", text) if segment.strip()]
    if not paragraphs:
        return text

    cleaned_paragraphs = [segment for segment in paragraphs if not WEB_ACCESS_DISCLAIMER_PATTERN.search(segment)]
    if cleaned_paragraphs:
        return "\n\n".join(cleaned_paragraphs)

    return text

def _resolve_conversation_memory_enabled(
    user_record: Optional[Dict[str, Any]],
    request_value: Optional[bool],
) -> bool:
    record_value = _row_get(user_record, "conversation_memory_enabled") if user_record else None
    if record_value is False:
        return False
    if isinstance(request_value, bool):
        return request_value
    return True


def _resolve_web_search_enabled(
    chat_request: ChatRequest,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
) -> bool:
    mode = getattr(chat_request, "web_search_mode", None)
    if mode == "on":
        return True
    if mode == "off":
        return False
    if mode == "auto":
        # In auto mode, allow either side to opt-in:
        # - frontend hint can proactively enable search
        # - backend heuristics can still enable it even when the frontend hint is false
        client_hint = bool(getattr(chat_request, "web_search_enabled", False))
        server_decision = should_enable_search(chat_request.message, conversation_history=conversation_history)
        return client_hint or server_decision
    return bool(chat_request.web_search_enabled)


def _normalize_general_conversation_id(
    requested_conversation_id: Optional[str],
    authenticated_user_id: int,
) -> Optional[str]:
    """Prevent clients from targeting another user's general conversation id."""
    general_user_id = _general_conversation_user_id(requested_conversation_id)
    if general_user_id is None:
        return requested_conversation_id
    if general_user_id == authenticated_user_id:
        return requested_conversation_id
    api_logger.warning(
        "Rejected mismatched general conversation id",
        extra={
            "event_type": "security_violation_general_chat_id_mismatch",
            "requested_conversation_id": requested_conversation_id,
            "authenticated_user_id": authenticated_user_id,
            "requested_user_id": general_user_id,
        },
    )
    return f"general:{authenticated_user_id}"


def _build_effective_web_search_prompt(
    chat_request: ChatRequest,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    base_prompt = (chat_request.web_search_prompt or "").strip()
    guidance = (
        "Use concise, user-focused web search queries. "
        "For follow-up prompts with pronouns or vague referential phrases (e.g. other half/the rest/what about that), "
        "resolve the referent from recent user context "
        "before searching. Rewrite follow-up queries with the resolved entity/topic explicitly included. "
        "Never run standalone generic queries such as 'other half', 'the rest', or 'what about him'. "
        "Keep the user domain intact; do not reinterpret ambiguous words into unrelated domains. "
        "For factual claims or rumor/verification style questions, if confidence is not high, run one targeted web search before concluding. "
        "If the referent is still ambiguous, ask one clarifying question instead of broad generic searches. "
        "Do not claim you cannot browse or that your knowledge is cutoff when web search is enabled."
    )
    if not conversation_history:
        return f"{base_prompt}\n\n{guidance}" if base_prompt else guidance

    recent_user_context: Optional[str] = None
    fallback_user_context: Optional[str] = None
    recent_candidates: List[str] = []
    for entry in reversed(conversation_history[-10:]):
        if not isinstance(entry, dict):
            continue
        if (entry.get("role") or "").strip().lower() != "user":
            continue
        text = (entry.get("text") or "").strip()
        if text and text != (chat_request.message or "").strip():
            recent_candidates.append(text)

    for candidate in recent_candidates:
        if _is_low_information_search_turn(candidate):
            continue
        if fallback_user_context is None:
            fallback_user_context = candidate
        lowered_candidate = candidate.lower()
        if any(keyword in lowered_candidate for keyword in FOLLOW_UP_CONTEXT_KEYWORDS):
            recent_user_context = candidate
            break
        if len(lowered_candidate.split()) >= 6:
            recent_user_context = candidate
            break

    if recent_user_context is None:
        recent_user_context = fallback_user_context

    prompt_parts: List[str] = []
    if base_prompt:
        prompt_parts.append(base_prompt)
    prompt_parts.append(guidance)
    follow_up_message = chat_request.message or ""
    if recent_user_context and (
        FOLLOW_UP_PRONOUN_PATTERN.search(follow_up_message)
        or FOLLOW_UP_REFERENTIAL_PATTERN.search(follow_up_message)
    ):
        prompt_parts.append(f"Recent user context to anchor follow-up search: {recent_user_context[:220]}")
    return "\n\n".join(prompt_parts)

def _append_custom_instructions(
    system_prompt: Optional[str],
    user_record: Optional[Dict[str, Any]],
) -> Optional[str]:
    if not user_record:
        return system_prompt
    custom_instructions = _row_get(user_record, "personalization_custom_instructions")
    if not isinstance(custom_instructions, str):
        return system_prompt
    trimmed = custom_instructions.strip()
    if not trimmed:
        return system_prompt
    if system_prompt and CUSTOM_INSTRUCTIONS_HEADER in system_prompt:
        return system_prompt
    block = f"{CUSTOM_INSTRUCTIONS_HEADER}\n{trimmed}"
    if system_prompt and system_prompt.strip():
        return f"{system_prompt}\n\n{block}"
    return block


_SUPERMEMORY_COMMANDS = {"remember", "recall", "forget", "profile", "wipe"}


def _parse_supermemory_command(message: Optional[str]) -> Optional[Dict[str, str]]:
    if not message:
        return None
    trimmed = message.strip()
    if not trimmed.startswith("/"):
        return None
    parts = trimmed.split(maxsplit=1)
    command = parts[0].lstrip("/").lower()
    if command not in _SUPERMEMORY_COMMANDS:
        return None
    args = parts[1] if len(parts) > 1 else ""
    return {"command": command, "args": args}


def _parse_supermemory_overrides(
    chat_request: ChatRequest,
    user_record: Optional[Dict[str, Any]] = None,
):
    def _resolve(field: str, user_key: str):
        value = getattr(chat_request, field)
        if value is None and user_record is not None:
            return _row_get(user_record, user_key)
        return value

    return parse_supermemory_overrides(
        auto_recall=_resolve("supermemory_auto_recall", "supermemory_auto_recall"),
        auto_capture=_resolve("supermemory_auto_capture", "supermemory_auto_capture"),
        capture_mode=_resolve("supermemory_capture_mode", "supermemory_capture_mode"),
        max_recall_results=_resolve("supermemory_max_recall_results", "supermemory_max_recall_results"),
        profile_frequency=_resolve("supermemory_profile_frequency", "supermemory_profile_frequency"),
    )


def _format_profile_sections(profile: Dict[str, Any]) -> str:
    static_facts = profile.get("static") or []
    dynamic_facts = profile.get("dynamic") or []
    sections: List[str] = []
    if static_facts:
        sections.append("## User Profile (Persistent)\n" + "\n".join(f"- {f}" for f in static_facts))
    if dynamic_facts:
        sections.append("## Recent Context\n" + "\n".join(f"- {f}" for f in dynamic_facts))
    return "\n\n".join(sections)


async def _handle_supermemory_command(
    *,
    command: str,
    args: str,
    user_id: int,
    plan_tier: Optional[str],
    conversation_memory_enabled: bool,
) -> str:
    if not conversation_memory_enabled:
        return "Conversation memory is disabled. Enable it in settings to use memory commands."
    if not SUPERMEMORY_SERVICE.available:
        return "Long-term memory is not configured."
    policy = SUPERMEMORY_SERVICE.policy_for_tier(plan_tier)
    if not policy.enabled:
        return "Long-term memory is not available for your plan."

    if command == "remember":
        text = (args or "").strip()
        if not text:
            return "Usage: /remember <text to remember>"
        category = detect_memory_category(text)
        metadata = {
            "type": category,
            "source": "gray_command",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        result = await SUPERMEMORY_SERVICE.store_memory(
            user_id=user_id,
            content=text,
            metadata=metadata,
            plan_tier=plan_tier,
        )
        if not result:
            return "Failed to save memory. Please try again."
        preview = text[:60] + ("..." if len(text) > 60 else "")
        return f'Remembered: "{preview}"'

    if command == "recall":
        query = (args or "").strip()
        if not query:
            return "Usage: /recall <search query>"
        results = await SUPERMEMORY_SERVICE.search_memories(
            user_id=user_id,
            query=query,
            limit=5,
            plan_tier=plan_tier,
        )
        if not results:
            return f'No memories found for: "{query}"'
        lines = []
        for idx, result in enumerate(results, start=1):
            score = ""
            similarity = result.get("similarity")
            if isinstance(similarity, (int, float)):
                score = f" ({round(similarity * 100)}%)"
            memory_text = result.get("memory") or ""
            lines.append(f"{idx}. {memory_text}{score}")
        return f"Found {len(results)} memories:\n\n" + "\n".join(lines)

    if command == "forget":
        query = (args or "").strip()
        if not query:
            return "Usage: /forget <memory to forget>"
        result = await SUPERMEMORY_SERVICE.forget_by_query(
            user_id=user_id,
            query=query,
            plan_tier=plan_tier,
        )
        return result.get("message") or "Memory forgotten."

    if command == "profile":
        query = (args or "").strip() or None
        profile = await SUPERMEMORY_SERVICE.get_profile(
            user_id=user_id,
            query=query,
            plan_tier=plan_tier,
        )
        if not profile:
            return "No profile information available yet."
        formatted = _format_profile_sections(profile)
        return formatted or "No profile information available yet."

    if command == "wipe":
        confirm = (args or "").strip().lower()
        if confirm not in {"confirm", "yes", "y"}:
            return "This will delete all memories. Run /wipe confirm to continue."
        result = await SUPERMEMORY_SERVICE.wipe_all(
            user_id=user_id,
            plan_tier=plan_tier,
        )
        deleted = result.get("deletedCount", 0)
        if deleted:
            return f"Wiped {deleted} memories."
        return "No memories to wipe."

    return "Unsupported memory command."


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
        "message_length": len(chat_request.message or ""),
        "conversation_id": chat_request.conversation_id,
        "model": chat_request.model,
        "correlation_id": correlation_id
    })
    effective_message = chat_request.message or ""

    # Initialize tools (currently unused in non-streaming endpoint, but required by generate_ai_response)
    tool_list = None
    conversation_memory_enabled = _resolve_conversation_memory_enabled(
        current_user,
        chat_request.conversation_memory_enabled,
    )
    supermemory_overrides = _parse_supermemory_overrides(chat_request, current_user)
    force_supermemory = supermemory_force_enabled()
    if force_supermemory:
        supermemory_overrides = supermemory_force_overrides(supermemory_overrides)

    try:
        # Generate a title for the chat session (only if requested)
        session_title = _fallback_title_from_message(effective_message)

        # Determine conversation_id (general conversations bypass thread creation).
        requested_conversation_id = _normalize_general_conversation_id(
            chat_request.conversation_id,
            authenticated_user_id,
        )
        chat_request.conversation_id = requested_conversation_id
        general_user_id = _general_conversation_user_id(requested_conversation_id)
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        if general_user_id is not None:
            conversation_id = requested_conversation_id
        else:
            conversation_id = await get_or_create_conversation(
                requested_conversation_id if valid_requested_conversation_id else None,
                chat_request.user_id,
                title=session_title,
            )

        # Get conversation history for context
        t0_history = time.perf_counter()
        conversation_history: List[Dict[str, Any]] = await _load_conversation_history(conversation_id, chat_request.user_id)
        api_logger.debug(
            "Loaded conversation history",
            extra={
                "event_type": "chat_history_loaded",
                "user_id": chat_request.user_id,
                "conversation_id": conversation_id,
                "count": len(conversation_history),
                "duration_ms": int((time.perf_counter() - t0_history) * 1000),
            },
        )

        # For thread conversations, inject General chat context as background memory.
        is_general_conversation = _general_conversation_user_id(conversation_id) is not None
        if not is_general_conversation:
            try:
                t0_general = time.perf_counter()
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
                api_logger.debug(
                    "Loaded general chat history",
                    extra={
                        "event_type": "general_history_loaded",
                        "user_id": chat_request.user_id,
                        "count": len(general_history),
                        "duration_ms": int((time.perf_counter() - t0_general) * 1000),
                    },
                )
            except Exception as e:
                api_logger.debug(f"Could not load general context: {e}", extra={"user_id": chat_request.user_id})

        prior_last_message_at = await load_last_user_message_at(db, chat_request.user_id)
        if not effective_message.strip() and not conversation_history and not (chat_request.attachments or []):
            effective_message = "Let's get started."

        # Save user message to local conversation store (after capturing prior history),
        # but avoid writing an identical message twice in a row (e.g., when a fallback
        # request replays the same prompt after a streaming failure).
        attachment_metadata: Optional[List[Dict[str, Any]]] = None
        if chat_request.attachments:
            attachment_metadata = await resolve_attachment_metadata(
                db,
                chat_request.attachments,
                chat_request.user_id,
            )

        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": effective_message,
            "attachments": attachment_metadata or None,
        }
        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and _row_get(last_history_entry, "role") in {"user", "assistant", "model"}
            and (_row_get(last_history_entry, "text") or "") == effective_message
        )
        if is_general_conversation:
             # General chat messages are not handled by save_conversation_message
             # We must manually insert them using the general chat persistence logic
             if should_persist_user:
                 t0_persist = time.perf_counter()
                 await _insert_general_conversation_message(
                     user_id=authenticated_user_id,
                     role="user",
                     text=effective_message,
                     attachments=attachment_metadata or None,
                 )
                 api_logger.debug(
                     "Persisted general user message",
                     extra={
                         "event_type": "general_message_persisted",
                         "user_id": authenticated_user_id,
                         "duration_ms": int((time.perf_counter() - t0_persist) * 1000),
                     },
                 )
        elif should_persist_user:
            t0_persist = time.perf_counter()
            await save_conversation_message(conversation_id, user_message_payload, user_id=chat_request.user_id)
            api_logger.debug(
                "Persisted thread user message",
                extra={
                    "event_type": "thread_message_persisted",
                    "user_id": chat_request.user_id,
                    "conversation_id": conversation_id,
                    "duration_ms": int((time.perf_counter() - t0_persist) * 1000),
                },
            )

        streak_info = await update_user_streak(
            db,
            chat_request.user_id,
            timezone_label=chat_request.timezone,
        )
        inactivity_days, last_message_date = compute_inactivity_days(
            prior_last_message_at,
            now_utc=utcnow(),
            timezone_label=chat_request.timezone,
        )
        ignored_pings = await count_ignored_proactivity(db, chat_request.user_id)
        engagement_context = build_engagement_context(
            streak_info.get("streak_count") if streak_info else None,
            streak_info.get("streak_last_date") if streak_info else None,
            inactivity_days,
            last_message_date,
            ignored_pings,
        )
        effective_time_context = append_streak_context(chat_request.time_context, engagement_context)

        # Enforce tier restrictions
        # Pathfinder, Voyager, and Pioneer users can use reasoning mode.
        normalized_tier = normalize_plan_tier(
            _row_get(current_user, "plan_tier"),
            _row_get(current_user, "role"),
            _row_get(current_user, "subscription_expires_at")
        )
        memory_enabled = conversation_memory_enabled or force_supermemory
        memory_plan_tier = supermemory_force_plan_tier(normalized_tier)

        # If user requested reasoning but is not eligible, disable it silently (or we could raise 403)
        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("pathfinder", "voyager", "pioneer"):
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

        effective_system_prompt = _append_custom_instructions(chat_request.system_prompt, current_user)

        supermemory_command = _parse_supermemory_command(effective_message)
        if supermemory_command:
            command_response = await _handle_supermemory_command(
                command=supermemory_command["command"],
                args=supermemory_command["args"],
                user_id=authenticated_user_id,
                plan_tier=memory_plan_tier,
                conversation_memory_enabled=memory_enabled,
            )
            assistant_message_payload = {"role": "model", "text": command_response}
            assistant_message_id = None
            if is_general_conversation:
                assistant_message_id = await _insert_general_conversation_message(
                    user_id=authenticated_user_id,
                    role="model",
                    text=command_response,
                )
            else:
                assistant_message_id = await save_conversation_message(
                    conversation_id,
                    assistant_message_payload,
                    user_id=authenticated_user_id,
                )
            clear_request_context()
            return ChatResponse(
                response=command_response,
                conversation_id=conversation_id,
                grounding_metadata=None,
                title=session_title,
                message_id=assistant_message_id,
            )

        search_enabled = _resolve_web_search_enabled(chat_request, conversation_history=conversation_history)
        effective_web_search_prompt = _build_effective_web_search_prompt(
            chat_request,
            conversation_history=conversation_history,
        ) if search_enabled else None

        # Generate AI response
        ai_response, grounding_metadata = await _generate_ai_response(
            effective_message,
            conversation_history,
            chat_request.context,
            effective_system_prompt,
            effective_time_context,
            effective_model,
            chat_request.attachments,
            chat_request.user_id,
            db,
            conversation_id=conversation_id,
            response_schema=chat_request.response_json_schema,
            response_mime_type=chat_request.response_mime_type,
            context_cache_id=chat_request.context_cache_id,
            search_enabled=search_enabled,
            web_search_engine=chat_request.web_search_engine,
            web_search_max_results=chat_request.web_search_max_results,
            web_search_prompt=effective_web_search_prompt,
            web_search_context_size=chat_request.web_search_context_size,
            should_generate_title=chat_request.should_generate_title,
            reasoning_mode=effective_reasoning_mode,
            reminders_enabled=chat_request.reminders_enabled,
            tools=tool_list,
            user_timezone=chat_request.timezone,
            plan_tier=normalized_tier,
            conversation_memory_enabled=memory_enabled,
            provider_routing=chat_request.provider_routing,
            supermemory_overrides=supermemory_overrides,
        )
        ai_response = _strip_incorrect_web_access_disclaimer(
            ai_response,
            search_enabled=search_enabled,
            grounding_metadata=grounding_metadata,
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

        if memory_enabled and SUPERMEMORY_SERVICE.available:
            create_logged_task(
                SUPERMEMORY_SERVICE.capture_turn(
                    user_id=authenticated_user_id,
                    user_message=effective_message,
                    assistant_message=ai_response,
                    conversation_id=conversation_id,
                    plan_tier=memory_plan_tier,
                    overrides=supermemory_overrides,
                ),
                logger=api_logger,
                name="chat.supermemory_capture",
            )

        # Generate title inline so it's returned with the response.
        # This adds ~100-300ms latency but only on first message of new conversations.
        final_title = session_title
        if chat_request.should_generate_title:
            try:
                generated_title = await _generate_chat_title_inline(
                    effective_message,
                    ai_response,
                    prompt_locale=prompt_locale,
                    user_id=authenticated_user_id,
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
        raise HTTPException(status_code=500, detail="Chat error.")


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
    authenticated_user_id = current_user["id"]
    chat_request.user_id = authenticated_user_id
    start_time = utcnow()
    prompt_locale = _prompt_locale_from_request(request)

    # Set request context for logging
    correlation_id = str(uuid4())
    set_request_context(correlation_id, str(chat_request.user_id)[:8])

    api_logger.info("Chat stream request received", extra={
        "event_type": "chat_stream_request_start",
        "user_id": chat_request.user_id,
        "message_length": len(chat_request.message or ""),
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
        requested_conversation_id = _normalize_general_conversation_id(
            chat_request.conversation_id,
            authenticated_user_id,
        )
        chat_request.conversation_id = requested_conversation_id
        general_user_id = _general_conversation_user_id(requested_conversation_id)
        valid_requested_conversation_id = _is_valid_uuid(requested_conversation_id)
        conv_task: Optional[asyncio.Task] = None
        conversation_id: Optional[str] = None
        if general_user_id is not None:
            conversation_id = requested_conversation_id
        else:
            conv_task = asyncio.create_task(
                get_or_create_conversation(
                    requested_conversation_id if valid_requested_conversation_id else None,
                    chat_request.user_id,
                    title=session_title,
                )
            )

        # 5. Resolve System Prompt & Tier (Concurrent with User Fetch)
        user_record = await user_task
        user_plan_tier = _row_get(user_record, "plan_tier") or "scout"
        conversation_memory_enabled = _resolve_conversation_memory_enabled(
            user_record,
            chat_request.conversation_memory_enabled,
        )
        supermemory_overrides = _parse_supermemory_overrides(chat_request, user_record)
        force_supermemory = supermemory_force_enabled()
        if force_supermemory:
            supermemory_overrides = supermemory_force_overrides(supermemory_overrides)
        
        # Check if onboarding is truly complete based on personalization fields
        # This is more robust than just checking the boolean flag which might be stale
        has_nickname = bool(_row_get(user_record, "personalization_nickname"))
        has_occupation = bool(_row_get(user_record, "personalization_occupation"))
        has_about = bool(_row_get(user_record, "personalization_about"))
        
        # Profile is considered "minimal" if at least nickname and one other field is present
        is_profile_minimal = has_nickname and (has_occupation or has_about)
        is_onboarding_completed = _row_get(user_record, "onboarding_completed") is True
        
        # [AUTO-SYNC] If profile is complete (nickname, occupation, about) but flag is False, 
        # sync it to the DB now to avoid further onboarding loops.
        if not is_onboarding_completed and has_nickname and has_occupation and has_about:
            async def _sync_onboarding_status():
                try:
                    from backend.database import database as db, users
                    from backend.time_utils import utcnow
                    from backend.core.cache import USER_CACHE
                    from backend.auth import invalidate_user_cache, invalidate_user_cache_redis
                    
                    await db.execute(
                        users.update().where(users.c.id == chat_request.user_id).values(
                            onboarding_completed=True,
                            has_seen_general_chat=True,
                            updated_at=utcnow()
                        )
                    )
                    await USER_CACHE.invalidate_global(f"user_{chat_request.user_id}")
                    
                    user_email = _row_get(user_record, "email")
                    if user_email:
                        normalized_email = user_email.strip().lower()
                        invalidate_user_cache(normalized_email)
                        await invalidate_user_cache_redis(normalized_email)
                        
                    api_logger.info("Auto-synced onboarding_completed=True", extra={"user_id": chat_request.user_id})
                except Exception as e:
                    api_logger.error(f"Failed to auto-sync onboarding status: {e}", extra={"user_id": chat_request.user_id})

            create_logged_task(_sync_onboarding_status(), logger=api_logger, name="chat.auto_sync_onboarding")
            is_onboarding_completed = True # Update local state for this request

        # Only force onboarding prompt if explicitly requested or if profile is totally empty
        force_onboarding_mode = chat_request.system_prompt == "onboarding"
        should_use_onboarding_prompt = force_onboarding_mode or (not is_onboarding_completed and not is_profile_minimal)

        effective_system_prompt = chat_request.system_prompt
        if should_use_onboarding_prompt:
            effective_system_prompt = ONBOARDING_SYSTEM_PROMPT
        elif not effective_system_prompt:
             effective_system_prompt = DEFAULT_SYSTEM_PROMPT
        effective_system_prompt = _append_custom_instructions(effective_system_prompt, user_record)

        # Determine Tool List (Parallel)
        tool_list = get_default_chat_tools()
        # Always provide onboarding tool if onboarding isn't fully completed, even if using default prompt
        if force_onboarding_mode or not is_onboarding_completed:
            # Add onboarding tools so the AI can call complete_onboarding whenever user provides info
            tool_list = (tool_list or []) + ONBOARDING_TOOLS

        # Infer timezone from time_context if not explicitly provided
        if not chat_request.timezone and chat_request.time_context:
            tz_label, _ = _timezone_from_time_context(chat_request.time_context)
            if tz_label:
                chat_request.timezone = tz_label

        # Await conversation ID
        if conv_task:
            t0_conv = time.perf_counter()
            conversation_id = await conv_task
            api_logger.debug(
                "Resolved conversation id",
                extra={
                    "event_type": "conversation_resolved",
                    "user_id": chat_request.user_id,
                    "conversation_id": conversation_id,
                    "duration_ms": int((time.perf_counter() - t0_conv) * 1000),
                },
            )
        t1_conv = time.perf_counter()
        api_logger.info(f"Conversation setup time: {(t1_conv - t0_conv)*1000:.2f}ms", extra={"user_id": chat_request.user_id})

        conversation_history: List[Dict[str, Any]] = []
        if conversation_id:
            t0_history = time.perf_counter()
            conversation_history = await _load_conversation_history(conversation_id, chat_request.user_id)
            api_logger.debug(
                "Loaded conversation history (stream)",
                extra={
                    "event_type": "chat_history_loaded_stream",
                    "user_id": chat_request.user_id,
                    "conversation_id": conversation_id,
                    "count": len(conversation_history),
                    "duration_ms": int((time.perf_counter() - t0_history) * 1000),
                },
            )

        prior_last_message_at = await load_last_user_message_at(db, chat_request.user_id)

        # Avoid sending an empty payload to the AI provider
        if not (effective_message or "").strip() and not conversation_history and not (chat_request.attachments or []):
            effective_message = "Let's get started."

        attachment_metadata: Optional[List[Dict[str, Any]]] = None
        if chat_request.attachments:
            attachment_metadata = await resolve_attachment_metadata(
                db,
                chat_request.attachments,
                chat_request.user_id,
            )

        user_message_payload: Dict[str, Any] = {
            "role": "user",
            "text": effective_message,
            "attachments": attachment_metadata or None,
        }

        last_history_entry: Optional[Dict[str, Any]] = conversation_history[-1] if conversation_history else None
        should_persist_user = not (
            last_history_entry
            and _row_get(last_history_entry, "role") in {"user", "assistant", "model"}
            and (_row_get(last_history_entry, "text") or "") == effective_message
        )
        if should_persist_user:
            # IMPORTANT: Await user message persistence to avoid race conditions.
            # If this runs asynchronously, the next request might load history before
            # this message is persisted, causing the AI to not see conversation context.
            try:
                general_user_id = _general_conversation_user_id(conversation_id)
                if general_user_id is not None:
                    t0_persist = time.perf_counter()
                    await _insert_general_conversation_message(
                        user_id=general_user_id,
                        role="user",
                        text=effective_message,
                        attachments=attachment_metadata or None,
                    )
                    api_logger.debug(
                        "Persisted general user message (stream)",
                        extra={
                            "event_type": "general_message_persisted_stream",
                            "user_id": general_user_id,
                            "duration_ms": int((time.perf_counter() - t0_persist) * 1000),
                        },
                    )
                else:
                    t0_persist = time.perf_counter()
                    await save_conversation_message(
                        conversation_id,
                        user_message_payload,
                        user_id=chat_request.user_id,
                    )
                    api_logger.debug(
                        "Persisted thread user message (stream)",
                        extra={
                            "event_type": "thread_message_persisted_stream",
                            "user_id": chat_request.user_id,
                            "conversation_id": conversation_id,
                            "duration_ms": int((time.perf_counter() - t0_persist) * 1000),
                        },
                    )
            except Exception as e:
                api_logger.error(f"Failed to persist user message: {e}", extra={"user_id": chat_request.user_id})

        streak_info = await update_user_streak(
            db,
            chat_request.user_id,
            timezone_label=chat_request.timezone,
        )
        inactivity_days, last_message_date = compute_inactivity_days(
            prior_last_message_at,
            now_utc=utcnow(),
            timezone_label=chat_request.timezone,
        )
        ignored_pings = await count_ignored_proactivity(db, chat_request.user_id)
        engagement_context = build_engagement_context(
            streak_info.get("streak_count") if streak_info else None,
            streak_info.get("streak_last_date") if streak_info else None,
            inactivity_days,
            last_message_date,
            ignored_pings,
        )
        effective_time_context = append_streak_context(chat_request.time_context, engagement_context)

        # Enforce tier restrictions for streaming
        normalized_tier = normalize_plan_tier(
            user_plan_tier,
            _row_get(user_record, "role"),
            _row_get(user_record, "subscription_expires_at")
        )
        memory_enabled = conversation_memory_enabled or force_supermemory
        memory_plan_tier = supermemory_force_plan_tier(normalized_tier)

        effective_model, model_coerced = coerce_model_for_tier(chat_request.model, normalized_tier)
        effective_reasoning_mode = chat_request.reasoning_mode
        if effective_reasoning_mode and normalized_tier not in ("pathfinder", "voyager", "pioneer"):
            effective_reasoning_mode = False

        supermemory_command = _parse_supermemory_command(effective_message)
        if supermemory_command:
            command_response = await _handle_supermemory_command(
                command=supermemory_command["command"],
                args=supermemory_command["args"],
                user_id=chat_request.user_id,
                plan_tier=memory_plan_tier,
                conversation_memory_enabled=memory_enabled,
            )

            async def event_stream() -> AsyncGenerator[str, None]:
                yield ":streaming-start\n\n"
                try:
                    if conversation_id:
                        general_user_id = _general_conversation_user_id(conversation_id)
                        if general_user_id is not None:
                            await _insert_general_conversation_message(
                                user_id=general_user_id,
                                role="model",
                                text=command_response,
                            )
                        else:
                            await save_conversation_message(
                                conversation_id,
                                {"role": "model", "text": command_response},
                                user_id=chat_request.user_id,
                            )
                    yield _sse_event("token", {"delta": command_response})
                    end_payload: Dict[str, Any] = {
                        "conversation_id": conversation_id,
                        "response": command_response,
                        "title": session_title,
                    }
                    yield _sse_event("end", end_payload)
                except Exception as stream_error:
                    api_logger.error(f"Supermemory command stream error: {stream_error}", exc_info=True)
                    yield _sse_event("error", {"message": str(stream_error)})

            headers = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
            clear_request_context()
            return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)

        search_enabled = _resolve_web_search_enabled(chat_request, conversation_history=conversation_history)
        effective_web_search_prompt = _build_effective_web_search_prompt(
            chat_request,
            conversation_history=conversation_history,
        ) if search_enabled else None

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
                    time_context=effective_time_context,
                    model=effective_model,
                    attachments=chat_request.attachments,
                    conversation_id=conversation_id,
                    context_cache_id=chat_request.context_cache_id,
                    search_enabled=search_enabled,
                    web_search_engine=chat_request.web_search_engine,
                    web_search_max_results=chat_request.web_search_max_results,
                    web_search_prompt=effective_web_search_prompt,
                    web_search_context_size=chat_request.web_search_context_size,
                    should_generate_title=chat_request.should_generate_title,
                    reasoning_mode=effective_reasoning_mode,
                    reminders_enabled=chat_request.reminders_enabled,
                    tools=tool_list,
                    plan_tier=normalized_tier,
                    conversation_memory_enabled=memory_enabled,
                    response_schema=chat_request.response_json_schema,
                    response_mime_type=chat_request.response_mime_type,
                    provider_routing=chat_request.provider_routing,
                    supermemory_overrides=supermemory_overrides,
                ):
                    if kind == "delta":
                        if not payload:
                            continue
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        accumulated_chunks.append(payload)
                        yield _sse_event("token", {"delta": payload})
                    elif kind == "tool_status":
                        yield _sse_event("tool_status", payload)
                    elif kind == "tool_card":
                        yield _sse_event("tool_card", payload)
                    elif kind == "reminders":
                        yield _sse_event("reminders", {"reminders": payload})
                    elif kind == "usage":
                        yield _sse_event("usage", {"usage": payload})
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
                final_response = _strip_incorrect_web_access_disclaimer(
                    final_response,
                    search_enabled=search_enabled,
                    grounding_metadata=grounding_metadata_payload,
                )
                
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

                # Persist before ending the stream so the next request sees this reply.
                try:
                    await _finalize_chat(conversation_id, chat_request.user_id, final_response, grounding_metadata_payload)
                except Exception as finalize_error:
                    api_logger.error(
                        "Streaming finalize failed; continuing without persistence",
                        extra={
                            "user_id": chat_request.user_id,
                            "conversation_id": conversation_id,
                            "error": str(finalize_error),
                        },
                    )

                if memory_enabled and SUPERMEMORY_SERVICE.available:
                    create_logged_task(
                        SUPERMEMORY_SERVICE.capture_turn(
                            user_id=chat_request.user_id,
                            user_message=effective_message,
                            assistant_message=final_response,
                            conversation_id=conversation_id,
                            plan_tier=memory_plan_tier,
                            overrides=supermemory_overrides,
                        ),
                        logger=api_logger,
                        name="chat_stream.supermemory_capture",
                    )

                final_title = session_title
                if chat_request.should_generate_title:
                    try:
                        generated_title = await _generate_chat_title_inline(
                            effective_message,
                            final_response,
                            prompt_locale=prompt_locale,
                            user_id=chat_request.user_id,
                        )
                        if generated_title:
                            final_title = generated_title
                            background_tasks.add_task(update_conversation_title, conversation_id, generated_title)
                    except Exception as title_error:
                        api_logger.warning(
                            "Title generation failed: %s",
                            title_error,
                            exc_info=True,
                            extra={"user_id": chat_request.user_id, "conversation_id": conversation_id},
                        )

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
                yield _sse_event("error", {"message": "Chat stream failed."})

        headers = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        clear_request_context()
        return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
    except Exception as error:
        api_logger.error(f"Chat stream failed: {error}", exc_info=True)
        clear_request_context()
        raise HTTPException(status_code=500, detail="Chat stream error.")
