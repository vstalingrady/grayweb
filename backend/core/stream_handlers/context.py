"""
Stream Context for AI Response Generation

Contains the StreamContext dataclass that holds all the state needed
for streaming AI responses from either OpenRouter or Gemini.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from google.genai import types


@dataclass
class StreamContext:
    """All context needed for streaming an AI response."""
    # Core message/history
    message: str
    conversation_history: List[Dict[str, Any]]
    history_token_budget: int
    
    # Prompts and context
    system_prompt: Optional[str]
    workspace_context: Optional[str]
    time_context: Optional[str]
    
    # Provider selection
    provider: str  # "openrouter" or "gemini"
    model: Optional[str]
    
    # Tools configuration  
    tool_list: List[types.Tool]
    tool_config: Optional[types.ToolConfig]
    needs_structured_tools: bool
    is_onboarding_tool: bool
    
    # Feature flags
    search_enabled: bool
    maps_enabled: bool
    reasoning_mode: bool
    reminders_enabled: bool
    
    # Media
    media_attachments: List[Any]
    
    # User context
    user_id: int
    user_timezone: Optional[str]
    plan_tier: Optional[str]
    
    # Cache
    cached_contents: Optional[List[types.Content]] = None
    
    # Response format (for structured responses)
    response_format: Optional[Dict[str, Any]] = None
    
    # Provider routing hints
    provider_routing: Optional[Dict[str, Any]] = None
    
    # Grounding metadata (populated during streaming)
    grounding_metadata: Optional[Dict[str, Any]] = None


def build_intent_window_text(message: str, conversation_history: Optional[List[Dict[str, Any]]]) -> str:
    """Build a text window for intent detection from message and recent history."""
    intent_window = (message or "")
    if conversation_history:
        try:
            for entry in conversation_history[-4:]:
                text = entry.get("text") or ""
                if text:
                    intent_window += f"\n{text}"
        except Exception:
            pass
    return intent_window
