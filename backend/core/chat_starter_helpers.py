"""Chat starter helper functions.

Utilities for generating AI-authored chat starter greetings.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, TYPE_CHECKING

if TYPE_CHECKING:
    from backend.models import ChatStarterRequest

# Lazy imports
_load_prompt_fn = None
_prompts_path = None


def _get_load_prompt():
    """Get prompt loading function."""
    global _load_prompt_fn, _prompts_path
    if _load_prompt_fn is None:
        try:
            from backend.core.prompt_utils import load_prompt_from_json
            from backend.main import GLOBAL_SYSTEM_PROMPTS_PATH
        except ImportError:
            from core.prompt_utils import load_prompt_from_json
            from main import GLOBAL_SYSTEM_PROMPTS_PATH
        _load_prompt_fn = load_prompt_from_json
        _prompts_path = GLOBAL_SYSTEM_PROMPTS_PATH
    return _load_prompt_fn, _prompts_path


def sse_event(event: str, payload: Dict[str, Any]) -> str:
    """Serialize an SSE event."""
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def starter_profile_context(payload: "ChatStarterRequest") -> str:
    """Build profile context string from chat starter request."""
    lines: List[str] = []
    if payload.nickname and payload.nickname.strip():
        lines.append(f"Preferred name: {payload.nickname.strip()}")
    elif payload.name and payload.name.strip():
        lines.append(f"Name: {payload.name.strip()}")
    if payload.occupation and payload.occupation.strip():
        lines.append(f"Occupation: {payload.occupation.strip()}")
    if payload.about and payload.about.strip():
        lines.append(f"About: {payload.about.strip()}")
    if payload.custom_instructions and payload.custom_instructions.strip():
        lines.append(f"Tone guidance: {payload.custom_instructions.strip()}")
    return "\n".join(lines)


def starter_fallback_message(payload: "ChatStarterRequest") -> str:
    """Generate fallback greeting when AI generation fails."""
    preferred = (payload.nickname or payload.name or "there").strip() or "there"
    return (
        f"Hey {preferred}. I'm Gray. What's the main thing you're trying to move forward right now?"
    )


def build_starter_prompt(payload: "ChatStarterRequest", profile_context: str, prompt_locale: str) -> str:
    """Build the prompt for generating a chat starter greeting."""
    load_prompt_from_json, prompts_path = _get_load_prompt()
    base_prompt = load_prompt_from_json(
        prompts_path,
        "starter",
        "You are Gray. Write a warm, engaging greeting to start the conversation.",
        locale=prompt_locale,
    )
    prompt_parts = [base_prompt]
    if profile_context:
        prompt_parts.append(f"Profile hints:\n{profile_context}")
    return "\n\n".join(part for part in prompt_parts if part.strip())
