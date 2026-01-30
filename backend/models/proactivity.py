"""Proactivity and Dashboard Pydantic models."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.core.serializers import DEFAULT_DASHBOARD_PROACTIVITY


def utcnow_aware() -> datetime:
    """Return current UTC time with timezone info."""
    return datetime.now(timezone.utc)


class ProactivitySettings(BaseModel):
    """Proactivity settings model."""
    id: Optional[Union[str, int]] = None
    label: Optional[str] = None
    description: Optional[str] = None
    cadence: Optional[str] = None
    time: Optional[str] = None
    times: Optional[List[str]] = None
    channels: Optional[List[str]] = None
    timezone: Optional[str] = None
    message_length: Optional[str] = None


class ProactivitySettingsUpdate(BaseModel):
    """Model for updating proactivity settings."""
    id: Optional[Union[str, int]] = None
    label: Optional[str] = None
    description: Optional[str] = None
    cadence: Optional[str] = None
    time: Optional[str] = None
    times: Optional[List[str]] = None
    channels: Optional[List[str]] = None
    timezone: Optional[str] = None
    message_length: Optional[str] = None


class ProactivityLogBase(BaseModel):
    """Base proactivity log model."""
    activity_date: datetime
    tasks_completed: int = 0
    total_tasks: int = 0
    score: int = 0
    notes: Optional[str] = None


class ProactivityLogCreate(ProactivityLogBase):
    """Model for creating a proactivity log."""
    pass


class DailyCheckIn(BaseModel):
    """Daily check-in model."""
    tasks_completed: int
    total_tasks: int
    notes: Optional[str] = None


class ProactivityLog(ProactivityLogBase):
    """Complete proactivity log model with database fields."""
    id: int
    user_id: int
    activity_date: datetime
    tasks_completed: int
    total_tasks: int
    score: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProactivityNotification(BaseModel):
    """Proactivity notification model."""
    id: int
    user_id: int
    type: str
    title: str
    message: str
    metadata: Optional[Dict[str, Any]] = None
    due_at: Optional[datetime] = None
    sent_at: datetime
    read_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class DashboardPulsePlanItem(BaseModel):
    """Dashboard pulse plan item."""
    id: Union[str, int]
    label: str
    completed: bool = False


class DashboardPulseHabitItem(BaseModel):
    """Dashboard pulse habit item."""
    id: Union[str, int]
    label: str
    previous_label: Optional[str] = None
    completed: bool = False


class DashboardPulseProactivity(BaseModel):
    """Dashboard pulse proactivity settings."""
    id: Union[str, int] = Field(default=DEFAULT_DASHBOARD_PROACTIVITY["id"])
    label: str = Field(default=DEFAULT_DASHBOARD_PROACTIVITY["label"])
    description: Optional[str] = Field(default=DEFAULT_DASHBOARD_PROACTIVITY.get("description"))
    cadence: str = Field(default=DEFAULT_DASHBOARD_PROACTIVITY["cadence"])
    time: str = Field(default=DEFAULT_DASHBOARD_PROACTIVITY["time"])


class DashboardPulseBase(BaseModel):
    """Base dashboard pulse model."""
    date_key: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    timestamp: Optional[int] = Field(default=None, validate_default=True)
    plans: List[DashboardPulsePlanItem] = []
    habits: List[DashboardPulseHabitItem] = []
    proactivity: DashboardPulseProactivity

    @field_validator("proactivity", mode="before")
    @classmethod
    def _validate_proactivity(cls, value):
        from backend.core.serializers import normalize_proactivity
        if isinstance(value, dict):
            # If it's already a dict but missing keys, normalize it
            return normalize_proactivity(value)
        return normalize_proactivity({})

    @field_validator("timestamp", mode="before")
    @classmethod
    def _validate_timestamp(cls, value):
        if value is None:
            return int(utcnow_aware().timestamp() * 1000)
        if isinstance(value, datetime):
            return int(value.replace(tzinfo=timezone.utc).timestamp() * 1000)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value.strip():
            try:
                return int(float(value))
            except ValueError as exc:
                raise ValueError("timestamp must be milliseconds since epoch") from exc
        raise ValueError("timestamp must be milliseconds since epoch")


class DashboardPulseCreate(DashboardPulseBase):
    """Model for creating a dashboard pulse."""
    carry_forward: bool = False


class DashboardPulseUpdate(BaseModel):
    """Model for updating dashboard pulse."""
    timestamp: Optional[int] = None
    plans: Optional[List[DashboardPulsePlanItem]] = None
    habits: Optional[List[DashboardPulseHabitItem]] = None
    proactivity: Optional[DashboardPulseProactivity] = None


class DashboardPulse(DashboardPulseBase):
    """Complete dashboard pulse model with database fields."""
    id: int
    user_id: int
    timestamp: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardProactivitySummary(BaseModel):
    """Dashboard proactivity summary."""
    logs: List[ProactivityLog] = Field(default_factory=list)


class DashboardSummary(BaseModel):
    """Dashboard summary model."""
    today: Optional[DashboardPulse] = None
    recent: List[DashboardPulse] = Field(default_factory=list)
    pulses: List[DashboardPulse] = Field(default_factory=list)
    proactivity: DashboardProactivitySummary = Field(default_factory=DashboardProactivitySummary)
