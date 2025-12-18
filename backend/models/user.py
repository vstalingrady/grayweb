"""User-related Pydantic models."""

from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional

import logging
from pydantic import BaseModel, ConfigDict, EmailStr

logger = logging.getLogger("backend.models.user")


class UsageStatus(BaseModel):
    """Usage tracking status for a user."""
    tier: str
    monthly_usage: float
    monthly_limit: float
    is_monthly_limit_reached: bool
    next_monthly_reset: str
    six_hour_usage: float
    six_hour_limit: float
    is_six_hour_limit_reached: bool
    next_six_hour_reset: str


class UserBase(BaseModel):
    """Base user model with all user fields."""
    email: EmailStr
    full_name: str
    profile_picture_url: Optional[str] = None
    role: str = "user"
    plan_tier: Optional[str] = None
    workspace_background_id: Optional[str] = None
    maps_enabled: Optional[bool] = False
    improve_model_for_everyone: Optional[bool] = False
    has_seen_general_chat: Optional[bool] = False
    personalization_nickname: Optional[str] = None
    personalization_occupation: Optional[str] = None
    personalization_about: Optional[str] = None
    personalization_custom_instructions: Optional[str] = None
    personalization_system_prompt_override: Optional[str] = None
    personalization_show_calendar: Optional[bool] = True
    personalization_location: Optional[str] = None
    personalization_time_zone: Optional[str] = None
    auth_user_id: Optional[str] = None
    daily_token_usage: Optional[int] = 0
    monthly_cost_usage: Optional[float] = 0.0
    weekly_cost_usage: Optional[float] = 0.0
    six_hour_cost_usage: Optional[float] = 0.0
    preferred_model: Optional[str] = None
    visible_model_ids: Optional[List[str]] = None
    theme_mode: Optional[str] = None
    ui_locale: Optional[str] = None
    preferred_response_language: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    conversation_memory_enabled: Optional[bool] = True
    auto_web_search_enabled: Optional[bool] = False


class UserCreate(UserBase):
    """Model for creating a new user."""
    pass


class UserUpdate(BaseModel):
    """Model for updating user fields."""
    full_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    role: Optional[str] = None
    plan_tier: Optional[str] = None
    workspace_background_id: Optional[str] = None
    maps_enabled: Optional[bool] = None
    improve_model_for_everyone: Optional[bool] = None
    has_seen_general_chat: Optional[bool] = None
    personalization_nickname: Optional[str] = None
    personalization_occupation: Optional[str] = None
    personalization_about: Optional[str] = None
    personalization_custom_instructions: Optional[str] = None
    personalization_system_prompt_override: Optional[str] = None
    personalization_show_calendar: Optional[bool] = None
    personalization_location: Optional[str] = None
    personalization_time_zone: Optional[str] = None
    preferred_model: Optional[str] = None
    visible_model_ids: Optional[List[str]] = None
    theme_mode: Optional[str] = None
    ui_locale: Optional[str] = None
    preferred_response_language: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    conversation_memory_enabled: Optional[bool] = None
    auto_web_search_enabled: Optional[bool] = None


class User(UserBase):
    """Complete user model with database fields."""
    id: int
    initials: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    usage_status: Optional[UsageStatus] = None

    model_config = ConfigDict(from_attributes=True)


def serialize_user_row(row: Mapping[str, Any]) -> Dict[str, Any]:
    """Normalize DB user rows for Pydantic response models."""
    import json
    
    user_dict = dict(row)
    if user_dict.get("auth_user_id") is not None:
        user_dict["auth_user_id"] = str(user_dict["auth_user_id"])
    
    # Parse JSON fields that SQLite might return as strings
    if isinstance(user_dict.get("visible_model_ids"), str):
        try:
            user_dict["visible_model_ids"] = json.loads(user_dict["visible_model_ids"])
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning(
                "Failed to parse visible_model_ids JSON; leaving as-is",
                extra={
                    "event_type": "fallback_activation",
                    "fallback": "user_visible_model_ids_json_invalid",
                    "user_id": user_dict.get("id"),
                    "error": str(exc),
                },
            )

    if isinstance(user_dict.get("notification_preferences"), str):
        try:
            user_dict["notification_preferences"] = json.loads(user_dict["notification_preferences"])
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning(
                "Failed to parse notification_preferences JSON; leaving as-is",
                extra={
                    "event_type": "fallback_activation",
                    "fallback": "user_notification_preferences_json_invalid",
                    "user_id": user_dict.get("id"),
                    "error": str(exc),
                },
            )

    return user_dict
