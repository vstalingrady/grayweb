from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatAttachment(BaseModel):
    id: int


class ChatMessage(BaseModel):
    role: str  # 'user' or 'model'
    text: str


class ConversationCreateRequest(BaseModel):
    title: str
    user_id: int


class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    user_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: int
    context: Optional[str] = None
    time_context: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    attachments: Optional[List[ChatAttachment]] = None
    response_json_schema: Optional[Dict[str, Any]] = None
    response_mime_type: Optional[str] = None
    context_cache_id: Optional[int] = None
    maps_enabled: bool = False
    maps_latitude: Optional[float] = None
    maps_longitude: Optional[float] = None
    maps_widget: bool = False
    web_search_enabled: bool = False  # Disabled by default - adds ~7s latency to OpenRouter
    should_generate_title: bool = False
    reasoning_mode: bool = False
    reminders_enabled: bool = False
    timezone: Optional[str] = None
    conversation_memory_enabled: bool = True
    # Bring-your-own-key: map of provider id -> API key
    # e.g. {"openrouter": "sk-or-...", "anthropic": "sk-ant-..."}
    user_api_keys: Optional[Dict[str, str]] = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    message_id: Optional[int] = None
    grounding_metadata: Optional[Dict[str, Any]] = None
    title: Optional[str] = None


class ChatStarterRequest(BaseModel):
    user_id: int
    name: Optional[str] = None
    nickname: Optional[str] = None
    occupation: Optional[str] = None
    about: Optional[str] = None
    custom_instructions: Optional[str] = None
    workspace_context: Optional[str] = None
    system_prompt: Optional[str] = None
    time_context: Optional[str] = None


class ChatStarterResponse(BaseModel):
    message: str
    used_fallback: bool = False


class ChatTitleRequest(BaseModel):
    message: str


class ChatTitleResponse(BaseModel):
    title: str


class MessageCreateRequest(BaseModel):
    role: str
    text: str
    user_id: Optional[int] = None


class ConversationHistoryPayload(BaseModel):
    messages: List[Dict[str, Any]]
