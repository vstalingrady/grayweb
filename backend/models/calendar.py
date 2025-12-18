"""Calendar-related Pydantic models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CalendarBase(BaseModel):
    """Base calendar model."""
    label: str
    color: str
    is_visible: bool = True


class CalendarCreate(CalendarBase):
    """Model for creating a new calendar."""
    pass


class CalendarUpdate(BaseModel):
    """Model for updating calendar fields."""
    label: Optional[str] = None
    color: Optional[str] = None
    is_visible: Optional[bool] = None


class Calendar(CalendarBase):
    """Complete calendar model with database fields."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CalendarEventBase(BaseModel):
    """Base calendar event model."""
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    calendar_id: Optional[int] = None
    color: Optional[str] = None
    reminder_minutes_before: Optional[int] = None
    entry_type: str = "event"
    is_completed: bool = False
    recurrence: Optional[str] = None
    habit_id: Optional[int] = None
    reminder_at: Optional[datetime] = None


class CalendarEventCreate(CalendarEventBase):
    """Model for creating a new calendar event."""
    pass


class CalendarEventUpdate(BaseModel):
    """Model for updating calendar event fields."""
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    calendar_id: Optional[int] = None
    color: Optional[str] = None
    reminder_minutes_before: Optional[int] = None
    entry_type: Optional[str] = None
    is_completed: Optional[bool] = None
    recurrence: Optional[str] = None
    habit_id: Optional[int] = None
    reminder_at: Optional[datetime] = None


class CalendarEvent(CalendarEventBase):
    """Complete calendar event model with database fields."""
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
