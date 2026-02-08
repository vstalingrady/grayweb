from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from backend.auth import get_current_user
from backend.database import context_cache, get_database
from backend.logging_config import create_logger
from backend.time_utils import utcnow
from backend.core.chatgpt_import import extract_chatgpt_memory_from_zip
from backend.compat_imports import row_get as _row_get
from backend.tier_utils import normalize_plan_tier
from backend.openrouter_client import OpenRouterService

router = APIRouter(tags=["imports"])

api_logger = create_logger("backend.api.imports")

def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


CHATGPT_IMPORT_COMPRESS = (os.getenv("CHATGPT_IMPORT_COMPRESS") or "true").strip().lower() not in {
    "0",
    "false",
    "no",
    "off",
}
CHATGPT_IMPORT_COMPRESS_MODEL = os.getenv("CHATGPT_IMPORT_COMPRESS_MODEL", "x-ai/grok-4.1-fast")
CHATGPT_IMPORT_COMPRESS_MAX_CHARS = _int_env("CHATGPT_IMPORT_COMPRESS_MAX_CHARS", 2000)
CHATGPT_IMPORT_MAX_UPLOAD_BYTES = _int_env("CHATGPT_IMPORT_MAX_UPLOAD_BYTES", 26_214_400)

_openrouter_service = None


def _get_openrouter_service() -> OpenRouterService:
    global _openrouter_service
    if _openrouter_service is None:
        _openrouter_service = OpenRouterService()
    return _openrouter_service


def _require_chatgpt_import_access(current_user) -> None:
    tier = normalize_plan_tier(
        _row_get(current_user, "plan_tier"),
        _row_get(current_user, "role"),
        _row_get(current_user, "subscription_expires_at"),
    )
    if tier not in ("voyager", "pioneer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ChatGPT import requires a Voyager or Pioneer plan.",
        )


def _safe_upload_size(file: UploadFile) -> int | None:
    size_attr = getattr(file, "size", None)
    if isinstance(size_attr, int) and size_attr >= 0:
        return size_attr
    try:
        stream = file.file
        stream.seek(0, os.SEEK_END)
        size = stream.tell()
        stream.seek(0)
        return size
    except Exception:
        try:
            file.file.seek(0)
        except Exception:
            pass
        return None


async def _compress_summary(summary_text: str) -> str:
    if not CHATGPT_IMPORT_COMPRESS or not summary_text:
        return summary_text
    service = _get_openrouter_service()
    if not service.available:
        api_logger.info("ChatGPT import compression skipped (OpenRouter not configured).")
        return summary_text
    prompt = (
        "Compress this ChatGPT export summary into a compact memory snapshot.\n"
        "Keep durable user facts, preferences, ongoing projects, constraints, and recurring topics.\n"
        "Drop filler and meta commentary. Keep short bullet lists when helpful.\n"
        f"Limit to {CHATGPT_IMPORT_COMPRESS_MAX_CHARS} characters or fewer.\n\n"
        "Summary:\n"
        f"{summary_text}"
    )
    try:
        compressed = await service.generate(
            message=prompt,
            model=CHATGPT_IMPORT_COMPRESS_MODEL,
        )
    except Exception as exc:
        api_logger.warning("ChatGPT import compression failed", exc_info=exc)
        return summary_text
    cleaned = (compressed or "").strip()
    if not cleaned:
        return summary_text
    if len(cleaned) > CHATGPT_IMPORT_COMPRESS_MAX_CHARS:
        cleaned = cleaned[:CHATGPT_IMPORT_COMPRESS_MAX_CHARS].rstrip() + "..."
    return cleaned


@router.post("/api/imports/chatgpt", status_code=status.HTTP_201_CREATED)
async def import_chatgpt_memory(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Import a ChatGPT export and store a memory summary in context_cache."""
    _require_chatgpt_import_access(current_user)
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip ChatGPT export.")
    upload_size = _safe_upload_size(file)
    if upload_size is not None and upload_size > CHATGPT_IMPORT_MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Upload too large. Max size is {CHATGPT_IMPORT_MAX_UPLOAD_BYTES} bytes.",
        )

    try:
        summary = extract_chatgpt_memory_from_zip(file.file)
        summary_text = await _compress_summary(summary.summary)
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
            content=summary_text,
            created_at=utcnow(),
        )
    )

    return {
        "context_cache_id": record_id,
        "label": label,
        "summary_preview": summary_text,
        "conversation_count": summary.conversation_count,
        "message_count": summary.message_count,
        "user_message_count": summary.user_message_count,
        "fact_count": summary.fact_count,
        "title_count": summary.title_count,
    }
