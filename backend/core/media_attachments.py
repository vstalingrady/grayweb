"""Media attachment utilities.

Handles resolving and processing media attachments for chat messages.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional, TYPE_CHECKING

from fastapi import HTTPException, status

if TYPE_CHECKING:
    import databases

# Lazy imports
_database_module = None
_logger = None
_gemini_service = None


def _get_media_uploads():
    """Get media_uploads table."""
    global _database_module
    if _database_module is None:
        from backend.database import media_uploads
        _database_module = {"media_uploads": media_uploads}
    return _database_module["media_uploads"]


def _get_logger():
    """Get API logger."""
    global _logger
    if _logger is None:
        from backend.logging_config import create_logger
        _logger = create_logger("backend.media")
    return _logger


def _resolve_storage_path_from_record(path_str: str) -> Path:
    """Resolve storage path from record."""
    from backend.core.file_utils import resolve_storage_path_from_record
    return resolve_storage_path_from_record(path_str)


def _candidate_text(candidate):
    """Extract text from candidate."""
    from backend.core.ai_utils import candidate_text
    return candidate_text(candidate)


# Type alias for GeminiAttachment - will be passed in
class GeminiAttachment:
    """Simple attachment wrapper."""
    def __init__(self, data: bytes, mime_type: str, filename: str = None):
        self.data = data
        self.mime_type = mime_type  
        self.filename = filename


class ChatAttachment:
    """Chat attachment spec."""
    def __init__(self, id: int):
        self.id = id


async def resolve_media_attachments(
    db: "databases.Database",
    attachment_specs: Optional[List[ChatAttachment]],
    user_id: int,
    *,
    gemini_attachment_class=None,
) -> List:
    """Resolve attachment specs to actual file data.
    
    Args:
        db: Database connection
        attachment_specs: List of attachment specifications with IDs
        user_id: User ID for ownership verification
        gemini_attachment_class: Optional class to use for attachments
        
    Returns:
        List of resolved attachments with file data
    """
    if not attachment_specs:
        return []

    attachment_ids = [attachment.id for attachment in attachment_specs]
    if not attachment_ids:
        return []

    media_uploads = _get_media_uploads()
    
    query = media_uploads.select().where(
        (media_uploads.c.id.in_(attachment_ids))
        & (media_uploads.c.user_id == user_id)
    )
    rows = await db.fetch_all(query)
    records = {row["id"]: row for row in rows}

    missing = [str(attachment_id) for attachment_id in attachment_ids if attachment_id not in records]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment(s) not found: {', '.join(missing)}",
        )

    # Use provided class or default
    AttachmentClass = gemini_attachment_class or GeminiAttachment
    
    attachments = []
    for attachment_id in attachment_ids:
        record = records[attachment_id]
        storage_path_value = record["storage_path"]
        storage_path = _resolve_storage_path_from_record(str(storage_path_value))
        if not storage_path.exists():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Attachment file is no longer available.",
            )
        try:
            data = storage_path.read_bytes()
        except OSError as error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read attachment: {error}",
            ) from error

        attachments.append(
            AttachmentClass(
                data=data,
                mime_type=record["mime_type"],
                filename=record["filename"],
            )
        )

    return attachments


async def generate_image_descriptions(
    attachments: List,
    *,
    gemini_service=None,
    gemini_light_model: str = "models/gemini-flash-lite-latest",
) -> str:
    """Generate text descriptions of images using Gemini Flash Lite.
    
    This is used when sending messages to non-vision models (like DeepSeek)
    so they can understand what images the user sent.
    
    Args:
        attachments: List of attachment objects with data and mime_type
        gemini_service: Optional pre-configured Gemini service
        gemini_light_model: Model to use for descriptions
        
    Returns:
        A formatted string with image descriptions, or empty string if no images
    """
    logger = _get_logger()
    
    # Get Gemini service
    if gemini_service is None:
        from backend.gemini_client import GeminiService
        gemini_service = GeminiService()
    
    if not attachments or not gemini_service.available:
        return ""
    
    # Filter to only image attachments
    image_attachments = [
        a for a in attachments 
        if hasattr(a, 'mime_type') and a.mime_type and a.mime_type.startswith("image/")
    ]
    if not image_attachments:
        return ""
    
    descriptions = []
    for i, attachment in enumerate(image_attachments, 1):
        try:
            response = await gemini_service.generate(
                message="1. Describe this image in 1-2 sentences. 2. If there is ANY text in the image, transcribe it verbatim. Format: [Description]: <text> [Transcription]: <text>",
                conversation_history=None,
                workspace_context=None,
                system_prompt="You are an image analysis assistant. Always separate your response into Description and Transcription sections. If no text is visible, write 'None' for Transcription.",
                time_context=None,
                model=gemini_light_model,
                attachments=[attachment],
            )
            
            if response.candidates:
                text = _candidate_text(response.candidates[0])
                if text:
                    filename = getattr(attachment, 'filename', None) or f"Image {i}"
                    descriptions.append(f"[{filename} Analysis]:\n{text.strip()}")
                    logger.info(
                        f"Generated image description for {filename}",
                        extra={"event_type": "image_description_generated", "image_filename": filename}
                    )
        except Exception as e:
            logger.warning(
                f"Failed to generate image description: {e}",
                extra={"event_type": "image_description_error", "error": str(e)}
            )
            continue
    
    if descriptions:
        header = "[User attached images - descriptions for context]"
        footer = "[End of image descriptions]"
        return f"{header}\n" + "\n".join(descriptions) + f"\n{footer}\n\n"
    return ""
