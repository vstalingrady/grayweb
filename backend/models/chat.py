"""Chat and Media Pydantic models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ChatSessionBase(BaseModel):
    """Base chat session model."""
    title: str


class ChatSessionCreate(ChatSessionBase):
    """Model for creating a new chat session."""
    pass


class ChatSession(ChatSessionBase):
    """Complete chat session model with database fields."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceBackground(BaseModel):
    """Workspace background configuration."""
    slug: str
    label: str
    preview_css: str
    backdrop_css: str
    description: Optional[str] = None
    id: Optional[int] = None


class ContextCacheBase(BaseModel):
    """Base context cache model."""
    label: Optional[str] = None
    conversation_id: Optional[str] = None
    content: str


class ContextCache(ContextCacheBase):
    """Complete context cache model with database fields."""
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MediaUploadBase(BaseModel):
    """Base media upload model."""
    filename: str
    mime_type: str
    size: int


class MediaUpload(MediaUploadBase):
    """Complete media upload model with database fields."""
    id: int
    user_id: int
    created_at: datetime
    public_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ChatAttachment(BaseModel):
    """Chat attachment reference."""
    id: int
