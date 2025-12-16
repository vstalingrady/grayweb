"""Reminder Pydantic models."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


class ReminderBase(BaseModel):
    """Base reminder model."""
    label: str
    remind_at: datetime
    description: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    delivery_mode: Optional[str] = None
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    color: Optional[str] = None


class ReminderCreate(ReminderBase):
    """Model for creating a new reminder."""
    pass


class ReminderUpdate(BaseModel):
    """Model for updating reminder fields."""
    label: Optional[str] = None
    description: Optional[str] = None
    remind_at: Optional[datetime] = None
    status: Optional[str] = None
    delivery_mode: Optional[str] = None
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
