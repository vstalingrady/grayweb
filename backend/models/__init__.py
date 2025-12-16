"""
Pydantic models package for Gray backend.

This module contains all Pydantic schema definitions used across the API.
"""

from backend.models.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UsageStatus,
    User,
)
from backend.models.calendar import (
    CalendarBase,
    CalendarCreate,
    CalendarUpdate,
    Calendar,
    CalendarEventBase,
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEvent,
)
from backend.models.plan import (
    PlanBase,
    PlanCreate,
    PlanUpdate,
    Plan,
    HabitBase,
    HabitCreate,
    HabitUpdate,
    Habit,
)
from backend.models.reminder import (
    ReminderBase,
    ReminderCreate,
    ReminderUpdate,
)
from backend.models.proactivity import (
    ProactivitySettings,
    ProactivitySettingsUpdate,
    ProactivityLogBase,
    ProactivityLogCreate,
    ProactivityLog,
    DailyCheckIn,
    ProactivityNotification,
    DashboardPulsePlanItem,
    DashboardPulseHabitItem,
    DashboardPulseProactivity,
    DashboardPulseBase,
    DashboardPulseCreate,
    DashboardPulseUpdate,
    DashboardPulse,
    DashboardProactivitySummary,
    DashboardSummary,
)
from backend.models.chat import (
    ChatSessionBase,
    ChatSessionCreate,
    ChatSession,
    WorkspaceBackground,
    ContextCacheBase,
    ContextCache,
    MediaUploadBase,
    MediaUpload,
    ChatAttachment,
)
from backend.models.payment import (
    PaymentRequest,
    PaymentChargeResponse,
    MidtransNotification,
)

__all__ = [
    # User models
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UsageStatus",
    "User",
    # Calendar models
    "CalendarBase",
    "CalendarCreate",
    "CalendarUpdate",
    "Calendar",
    "CalendarEventBase",
    "CalendarEventCreate",
    "CalendarEventUpdate",
    "CalendarEvent",
    # Plan models
    "PlanBase",
    "PlanCreate",
    "PlanUpdate",
    "Plan",
    "HabitBase",
    "HabitCreate",
    "HabitUpdate",
    "Habit",
    # Reminder models
    "ReminderBase",
    "ReminderCreate",
    "ReminderUpdate",
    # Proactivity models
    "ProactivitySettings",
    "ProactivitySettingsUpdate",
    "ProactivityLogBase",
    "ProactivityLogCreate",
    "ProactivityLog",
    "DailyCheckIn",
    "ProactivityNotification",
    "DashboardPulsePlanItem",
    "DashboardPulseHabitItem",
    "DashboardPulseProactivity",
    "DashboardPulseBase",
    "DashboardPulseCreate",
    "DashboardPulseUpdate",
    "DashboardPulse",
    "DashboardProactivitySummary",
    "DashboardSummary",
    # Chat models
    "ChatSessionBase",
    "ChatSessionCreate",
    "ChatSession",
    "WorkspaceBackground",
    "ContextCacheBase",
    "ContextCache",
    "MediaUploadBase",
    "MediaUpload",
    "ChatAttachment",
    # Payment models
    "PaymentRequest",
    "PaymentChargeResponse",
    "MidtransNotification",
]
