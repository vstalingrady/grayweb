"""
Upload API routes.

This router handles file upload endpoints for media (images, PDFs, etc.).
"""

from pathlib import Path
from typing import Any, Dict, List

import databases
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse

from backend.auth import get_current_user

from backend.database import get_database, media_uploads

from backend.core.file_utils import (
    CHAT_UPLOAD_MIME_TYPES,
    CHAT_UPLOAD_EXTENSIONS,
    MAX_MEDIA_UPLOAD_SIZE_BYTES,
    MEDIA_UPLOAD_ROOT,
    STORAGE_BASE_URL,
    persist_upload_file as _persist_upload_file,
    resolve_storage_path_from_record as _resolve_storage_path_from_record,
)

from backend.time_utils import utcnow

from backend.models import MediaUpload

router = APIRouter(tags=["uploads"])


@router.post("/api/uploads", response_model=MediaUpload)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Upload an image or PDF for later chat use."""
    user_id = current_user["id"]

    storage_path, mime_type, size, sanitized_name, storage_name = await _persist_upload_file(
        file,
        allowed_mime_types=CHAT_UPLOAD_MIME_TYPES,
        allowed_extensions=CHAT_UPLOAD_EXTENSIONS,
        max_size_bytes=MAX_MEDIA_UPLOAD_SIZE_BYTES,
    )

    try:
        storage_path_for_db = storage_path.relative_to(MEDIA_UPLOAD_ROOT)
    except ValueError:
        storage_path_for_db = Path(storage_name)

    now = utcnow()
    query = media_uploads.insert().values(
        user_id=user_id,
        filename=sanitized_name,
        mime_type=mime_type,
        size=size,
        storage_path=str(storage_path_for_db),
        created_at=now,
    )
    try:
        media_record_id = await db.execute(query)
    except Exception as exc:
        storage_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist upload metadata.",
        ) from exc

    public_url: str | None
    if STORAGE_BASE_URL:
        public_url = f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"
    else:
        public_url = f"/api/uploads/{media_record_id}/file"

    return MediaUpload(
        id=media_record_id,
        user_id=user_id,
        filename=sanitized_name,
        mime_type=mime_type,
        size=size,
        created_at=now,
        public_url=public_url,
    )


@router.get("/api/uploads", response_model=List[MediaUpload])
async def list_user_uploads(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List all uploads for the current user."""
    user_id = current_user["id"]
    query = (
        media_uploads.select()
        .where(media_uploads.c.user_id == user_id)
        .order_by(media_uploads.c.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    records = await db.fetch_all(query)
    
    result = []
    stale_upload_ids: List[int] = []
    for record in records:
        record_id = int(record["id"])
        try:
            storage_path = _resolve_storage_path_from_record(record["storage_path"])
            if not storage_path.exists():
                stale_upload_ids.append(record_id)
                continue
        except HTTPException:
            stale_upload_ids.append(record_id)
            continue

        public_url = None
        if STORAGE_BASE_URL and record["storage_path"]:
            storage_name = Path(record["storage_path"]).name
            public_url = f"{STORAGE_BASE_URL.rstrip('/')}/{storage_name}"
        else:
            public_url = f"/api/uploads/{record_id}/file"
        
        result.append(MediaUpload(
            id=record_id,
            user_id=record["user_id"],
            filename=record["filename"],
            mime_type=record["mime_type"],
            size=record["size"],
            created_at=record["created_at"],
            public_url=public_url,
        ))

    if stale_upload_ids:
        await db.execute(
            media_uploads.delete().where(
                (media_uploads.c.user_id == user_id)
                & (media_uploads.c.id.in_(stale_upload_ids))
            )
        )
    
    return result


@router.get("/api/uploads/{upload_id}/file")
async def get_upload_file(
    request: Request,
    upload_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: databases.Database = Depends(get_database),
):
    """Serve an uploaded file via same-origin cookies (works when STORAGE_BASE_URL is unset)."""
    user_id = current_user["id"]
    record = await db.fetch_one(
        media_uploads.select().where(
            (media_uploads.c.id == upload_id) & (media_uploads.c.user_id == user_id)
        )
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    storage_path = _resolve_storage_path_from_record(record["storage_path"])
    if not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Upload no longer available.")

    filename = record["filename"] or "upload"
    mime_type = record["mime_type"] or "application/octet-stream"
    headers = {
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Content-Type-Options": "nosniff",
    }
    return FileResponse(
        path=str(storage_path),
        media_type=mime_type,
        filename=filename,
        headers=headers,
    )
