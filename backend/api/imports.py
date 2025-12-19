from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from backend.auth import get_current_user
from backend.database import context_cache, get_database
from backend.logging_config import create_logger
from backend.time_utils import utcnow
from backend.core.chatgpt_import import extract_chatgpt_memory_from_zip

router = APIRouter(tags=["imports"])

api_logger = create_logger("backend.api.imports")


@router.post("/api/imports/chatgpt", status_code=status.HTTP_201_CREATED)
async def import_chatgpt_memory(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Import a ChatGPT export and store a memory summary in context_cache."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip ChatGPT export.")

    try:
        summary = extract_chatgpt_memory_from_zip(file.file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        api_logger.error("ChatGPT import failed", exc_info=exc)
        raise HTTPException(status_code=500, detail="Failed to import ChatGPT export.") from exc

    label = f"ChatGPT import {utcnow().date().isoformat()}"
    record_id = await db.execute(
        context_cache.insert().values(
            user_id=current_user["id"],
            label=label,
            content=summary.summary,
            created_at=utcnow(),
        )
    )

    return {
        "context_cache_id": record_id,
        "label": label,
        "summary_preview": summary.summary,
        "conversation_count": summary.conversation_count,
        "message_count": summary.message_count,
        "user_message_count": summary.user_message_count,
        "fact_count": summary.fact_count,
        "title_count": summary.title_count,
    }
