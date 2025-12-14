from typing import Any, Dict

import databases
from fastapi import APIRouter, BackgroundTasks, Depends, Request

try:
    from backend.auth import get_current_user
except Exception:  # pragma: no cover - test / direct execution
    from auth import get_current_user  # type: ignore

try:
    from backend.database import database
except Exception:  # pragma: no cover
    from database import database  # type: ignore

try:
    from backend.api.chat_models import (
        ChatRequest,
        ChatResponse,
        ChatStarterRequest,
        ChatStarterResponse,
        ChatTitleRequest,
        ChatTitleResponse,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationUpdateRequest,
        ConversationHistoryPayload,
    )
except Exception:  # pragma: no cover - test / direct execution
    from api.chat_models import (  # type: ignore
        ChatRequest,
        ChatResponse,
        ChatStarterRequest,
        ChatStarterResponse,
        ChatTitleRequest,
        ChatTitleResponse,
        MessageCreateRequest,
        ConversationCreateRequest,
        ConversationUpdateRequest,
        ConversationHistoryPayload,
    )

try:
    from backend.core.rate_limit import limiter
except Exception:  # pragma: no cover
    from core.rate_limit import limiter  # type: ignore


# Lazy import helper for backend_main to avoid circular dependency and Docker compatibility
def _get_backend_main():
    try:
        from backend import main as backend_main
    except ImportError:
        import main as backend_main  # type: ignore
    return backend_main


router = APIRouter()


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
    backend_main = _get_backend_main()
    return await backend_main.generate_chat_starter(request, payload, current_user)


@router.post("/api/chat/title", response_model=ChatTitleResponse)
@limiter.limit("30/minute")
async def chat_title_route(
    request: Request,
    payload: ChatTitleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatTitleResponse:
    backend_main = _get_backend_main()
    return await backend_main.create_chat_title(request, payload, current_user)


@router.post("/api/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_route(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(_get_db),
) -> ChatResponse:
    backend_main = _get_backend_main()
    return await backend_main.chat_endpoint(
        request,
        chat_request,
        background_tasks,
        current_user,
        db,
    )


@router.post("/api/chat/stream")
@limiter.limit("120/minute")
async def chat_stream_route(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(_get_db),
):
    backend_main = _get_backend_main()
    return await backend_main.chat_stream(
        request,
        chat_request,
        background_tasks,
        current_user,
        db,
    )


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

