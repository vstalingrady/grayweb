"""
File handling utilities for media uploads.

Extracted from main.py to reduce its size and improve modularity.
"""
import os
import re
from pathlib import Path
from typing import Dict, Optional, Set, Tuple
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

# Enhanced logging imports
try:
    from backend.logging_config import create_logger
except ImportError:
    from logging_config import create_logger

file_logger = create_logger("backend.files")


# -----------------------------------------------------------------------------
# Configuration constants
# -----------------------------------------------------------------------------

MEDIA_UPLOAD_DIR = Path(
    os.getenv("MEDIA_UPLOAD_DIR")
    or Path(__file__).resolve().parent.parent / "media_uploads"
)
MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_UPLOAD_ROOT = MEDIA_UPLOAD_DIR.resolve()
if MEDIA_UPLOAD_ROOT.is_symlink():
    raise RuntimeError("MEDIA_UPLOAD_DIR must not be a symlink.")

UPLOAD_READ_CHUNK_SIZE = 1024 * 1024
MAX_MEDIA_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_BACKGROUND_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # Keep parity with chat uploads

IMAGE_MIME_TYPES: Set[str] = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
}
DOCUMENT_MIME_TYPES: Set[str] = {
    "application/pdf",
}
CHAT_UPLOAD_MIME_TYPES: Set[str] = IMAGE_MIME_TYPES | DOCUMENT_MIME_TYPES
BACKGROUND_UPLOAD_MIME_TYPES: Set[str] = IMAGE_MIME_TYPES

IMAGE_EXTENSIONS: Set[str] = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
}
CHAT_UPLOAD_EXTENSIONS: Set[str] = IMAGE_EXTENSIONS | {".pdf"}
BACKGROUND_UPLOAD_EXTENSIONS: Set[str] = IMAGE_EXTENSIONS

MIME_EXTENSION_MAP: Dict[str, Set[str]] = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/jpg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/gif": {".gif"},
    "image/webp": {".webp"},
    "image/bmp": {".bmp"},
    "application/pdf": {".pdf"},
}

SUSPICIOUS_PATTERNS = (b"<script", b"javascript:", b"onerror=", b"<?php", b"#!/")

# Optional base URL for serving uploaded media (e.g., CDN or site URL)
STORAGE_BASE_URL = os.getenv("STORAGE_BASE_URL") or None


# -----------------------------------------------------------------------------
# Utility functions
# -----------------------------------------------------------------------------

def sanitize_filename(filename: Optional[str]) -> str:
    """Sanitize an uploaded filename for safe storage."""
    candidate = (filename or "upload").strip()
    candidate = Path(candidate).name
    candidate = re.sub(r"[^A-Za-z0-9._-]", "_", candidate)
    while ".." in candidate:
        candidate = candidate.replace("..", "")
    if not candidate or candidate.startswith("."):
        candidate = "upload"
    return candidate[:255]


def normalize_mime(mime: Optional[str]) -> str:
    """Normalize a MIME type string."""
    if not mime:
        return ""
    normalized = mime.split(";")[0].strip().lower()
    if normalized == "image/jpg":
        return "image/jpeg"
    return normalized


def sniff_mime_type(file_start: bytes) -> Optional[str]:
    """Detect MIME type from file content bytes."""
    if file_start[:4] == b"%PDF":
        return "application/pdf"
    if file_start[:4] == b"\x89PNG":
        return "image/png"
    if file_start[:2] == b"\xff\xd8":
        return "image/jpeg"
    if file_start[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if file_start[:4] == b"RIFF" and file_start[8:12] == b"WEBP":
        return "image/webp"
    if file_start[:2] == b"BM":
        return "image/bmp"
    lowered = file_start.lower()
    if lowered.lstrip().startswith(b"<svg"):
        return "image/svg+xml"
    return None


def reject_if_suspicious(chunk: bytes) -> None:
    """Raise HTTPException if chunk contains suspicious patterns."""
    lowered = chunk.lower()
    for pattern in SUSPICIOUS_PATTERNS:
        if pattern in lowered:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File contains suspicious or executable content.",
            )


def ensure_storage_path(storage_name: str) -> Path:
    """Validate and return a safe storage path."""
    candidate = MEDIA_UPLOAD_ROOT / storage_name
    resolved_candidate = candidate.resolve()
    if not resolved_candidate.is_relative_to(MEDIA_UPLOAD_ROOT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage target.",
        )
    if resolved_candidate.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage path.",
        )
    return resolved_candidate


def resolve_storage_path_from_record(raw_path: str) -> Path:
    """Resolve a storage path from a database record."""
    if not raw_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attachment path is missing.",
        )
    candidate = Path(raw_path)
    if candidate.is_absolute():
        resolved = candidate.resolve()
    else:
        resolved = (MEDIA_UPLOAD_ROOT / candidate).resolve()
    if not resolved.is_relative_to(MEDIA_UPLOAD_ROOT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attachment path is invalid.",
        )
    if resolved.is_symlink():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Attachment file is no longer available.",
        )
    return resolved


async def persist_upload_file(
    file: UploadFile,
    *,
    allowed_mime_types: Set[str],
    allowed_extensions: Set[str],
    max_size_bytes: int,
) -> Tuple[Path, str, int, str, str]:
    """
    Persist an uploaded file to disk with validation.
    
    Returns: (storage_path, resolved_mime, bytes_written, sanitized_name, storage_name)
    """
    content_type = normalize_mime(file.content_type)
    if not content_type or content_type not in allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or missing content type.",
        )

    sanitized_name = sanitize_filename(file.filename)
    extension = Path(sanitized_name).suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension: {extension or 'none provided'}",
        )

    storage_name = f"{uuid4().hex}{extension}"
    storage_path = ensure_storage_path(storage_name)

    first_chunk = await file.read(UPLOAD_READ_CHUNK_SIZE)
    if not first_chunk:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    sniffed_type = normalize_mime(sniff_mime_type(first_chunk))
    resolved_mime = content_type
    if sniffed_type:
        if sniffed_type not in allowed_mime_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content type is not allowed.",
            )
        expected_exts = MIME_EXTENSION_MAP.get(sniffed_type)
        if expected_exts and extension not in expected_exts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File extension does not match content.",
            )
        if content_type and content_type != sniffed_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Declared content type does not match file contents.",
            )
        resolved_mime = sniffed_type

    reject_if_suspicious(first_chunk[:4096])

    bytes_written = 0
    inspect_remaining = max(0, 4096 - len(first_chunk))
    try:
        with storage_path.open("wb") as buffer:
            if len(first_chunk) > max_size_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large. Maximum size is {max_size_bytes // (1024 * 1024)}MB.",
                )
            buffer.write(first_chunk)
            bytes_written += len(first_chunk)

            while True:
                chunk = await file.read(UPLOAD_READ_CHUNK_SIZE)
                if not chunk:
                    break
                if bytes_written + len(chunk) > max_size_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File too large. Maximum size is {max_size_bytes // (1024 * 1024)}MB.",
                    )
                if inspect_remaining > 0:
                    reject_if_suspicious(chunk[:inspect_remaining])
                    inspect_remaining = max(0, inspect_remaining - len(chunk))
                buffer.write(chunk)
                bytes_written += len(chunk)
    except HTTPException:
        storage_path.unlink(missing_ok=True)
        raise
    except Exception as error:
        storage_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store upload: {error}",
        ) from error
    finally:
        try:
            await file.close()
        except Exception:
            pass

    return storage_path, resolved_mime, bytes_written, sanitized_name, storage_name
