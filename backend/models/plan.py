"""Plan and Habit Pydantic models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PlanBase(BaseModel):
    """Base plan model."""
    label: str
    completed: bool = False
    deadline: Optional[str] = None
    schedule_slot: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    reminder_at: Optional[datetime] = None


class PlanCreate(PlanBase):
    """Model for creating a new plan."""
    pass


class PlanUpdate(BaseModel):
    """Model for updating plan fields."""
    label: Optional[str] = None
    completed: Optional[bool] = None
    deadline: Optional[str] = None
    schedule_slot: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    reminder_at: Optional[datetime] = None


class Plan(PlanBase):
    """Complete plan model with database fields."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HabitBase(BaseModel):
    """Base habit model."""
    label: str
    previous_label: str
    description: Optional[str] = None
    reminder_at: Optional[datetime] = None


class HabitCreate(HabitBase):
    """Model for creating a new habit."""
    pass


class HabitUpdate(BaseModel):
    """Model for updating habit fields."""
    label: Optional[str] = None
    previous_label: Optional[str] = None
    description: Optional[str] = None
    reminder_at: Optional[datetime] = None


class Habit(HabitBase):
    """Complete habit model with database fields."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
