"""
Chat stream context preparation helpers.

This module extracts common setup logic from the chat_stream endpoint
to reduce complexity and improve testability.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from backend.core.prompt_utils import load_prompt_from_json
from backend.core.ai_config import GLOBAL_SYSTEM_PROMPTS_PATH
from backend.onboarding_tools import ONBOARDING_TOOLS
from backend.plan_tools import PLAN_TOOLS


def has_personalization(value: Optional[str]) -> bool:
    """Check if a personalization value is set and non-empty."""
    if value is None:
        return False
    return bool(str(value).strip())


def check_needs_personalization(
    user_record: Optional[Dict[str, Any]],
    user_nickname: Optional[str],
    user_occupation: Optional[str],
    user_about: Optional[str],
) -> bool:
    """
    Check if the user needs to complete personalization.
    Returns True if any of nickname, occupation, or about is missing.
    """
    if not user_record:
        return False
    return (
        not has_personalization(user_nickname)
        or not has_personalization(user_occupation)
        or not has_personalization(user_about)
    )


def resolve_system_prompt(
    is_onboarding: bool,
    client_system_prompt: Optional[str],
    prompt_locale: str,
) -> str:
    """
    Resolve the effective system prompt based on onboarding state and client input.
    
    Returns the appropriate system prompt string.
    """
    onboarding_prompt = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "onboarding",
        locale=prompt_locale,
    )
    default_prompt = load_prompt_from_json(
        GLOBAL_SYSTEM_PROMPTS_PATH,
        "chat",
        locale=prompt_locale,
    )
    
    if is_onboarding:
        return onboarding_prompt
    elif client_system_prompt:
        client_prompt = client_system_prompt.strip()
        # Check if client already includes base persona
        base_signatures = ("You are Gray", "Anda adalah Gray")
        if any(sig in client_prompt for sig in base_signatures):
            return client_prompt
        else:
            # Prepend base persona
            return f"{default_prompt}\n\n{client_prompt}"
    else:
        return default_prompt


def substitute_date_placeholder(prompt: Optional[str]) -> Optional[str]:
    """Replace {{date}} placeholder with current date."""
    if prompt and "{{date}}" in prompt:
        return prompt.replace("{{date}}", datetime.now().strftime("%Y-%m-%d"))
    return prompt


def inject_known_personalization(
    system_prompt: str,
    user_nickname: Optional[str],
    user_occupation: Optional[str],
    user_about: Optional[str],
) -> str:
    """
    Inject already-saved personalization fields into the system prompt
    during onboarding so the AI doesn't ask for them again.
    """
    known_lines: List[str] = []
    if has_personalization(user_nickname):
        known_lines.append(f"- preferred name: {str(user_nickname).strip()}")
    if has_personalization(user_occupation):
        known_lines.append(f"- occupation/focus: {str(user_occupation).strip()}")
    if has_personalization(user_about):
        known_lines.append(f"- about blurb: {str(user_about).strip()}")
    
    if known_lines:
        return "\n\n".join([
            (system_prompt or "").strip(),
            "Already saved (persisted across chats):",
            "\n".join(known_lines),
            "Do NOT ask again for any field listed above. If the user provides any new or corrected onboarding details, call `complete_onboarding` immediately (it can be called multiple times).",
        ]).strip()
    
    return system_prompt


def prepare_onboarding_tools() -> List[Dict[str, Any]]:
    """Return the tool list for onboarding mode."""
    return list(ONBOARDING_TOOLS) + list(PLAN_TOOLS)


def check_wants_onboarding(message: str) -> bool:
    """Check if the user's message indicates they want to start onboarding."""
    raw = (message or "").strip().lower()
    return "ready to start" in raw or "start onboarding" in raw


class ChatContextResult:
    """Result of prepare_chat_context containing all resolved values."""
    
    def __init__(
        self,
        effective_system_prompt: str,
        effective_message: str,
        tool_list: Optional[List[Dict[str, Any]]],
        is_onboarding: bool,
        force_onboarding_mode: bool,
    ):
        self.effective_system_prompt = effective_system_prompt
        self.effective_message = effective_message
        self.tool_list = tool_list
        self.is_onboarding = is_onboarding
        self.force_onboarding_mode = force_onboarding_mode


def prepare_chat_context(
    user_record: Optional[Dict[str, Any]],
    user_has_seen_general: bool,
    user_nickname: Optional[str],
    user_occupation: Optional[str],
    user_about: Optional[str],
    message: str,
    client_system_prompt: Optional[str],
    prompt_locale: str,
) -> ChatContextResult:
    """
    Prepare the chat context including system prompt resolution and onboarding handling.
    
    This consolidates ~100 lines of logic from chat_stream into a single function.
    """
    # Check if user needs personalization
    needs_personalization = check_needs_personalization(
        user_record, user_nickname, user_occupation, user_about
    )
    
    # Force onboarding for brand-new users
    force_onboarding_mode = bool(user_record and not user_has_seen_general)
    
    # User is in onboarding if any personalization is missing
    is_onboarding = bool(needs_personalization)
    
    # Resolve system prompt
    effective_system_prompt = resolve_system_prompt(
        is_onboarding, client_system_prompt, prompt_locale
    )
    
    # Initialize values
    effective_message = message
    tool_list: Optional[List[Dict[str, Any]]] = None
    
    # Set up onboarding tools if needed
    if is_onboarding:
        tool_list = prepare_onboarding_tools()
    
    # Check for explicit onboarding request
    wants_onboarding = check_wants_onboarding(message)
    
    # Force onboarding settings if needed
    if force_onboarding_mode or (user_record and wants_onboarding and needs_personalization):
        onboarding_prompt = load_prompt_from_json(
            GLOBAL_SYSTEM_PROMPTS_PATH,
            "onboarding",
            locale=prompt_locale,
        )
        effective_system_prompt = onboarding_prompt
        tool_list = prepare_onboarding_tools()
        
        if not message or not message.strip():
            effective_message = ""
    
    # Substitute date placeholder
    effective_system_prompt = substitute_date_placeholder(effective_system_prompt) or ""
    
    # Inject known personalization during onboarding
    if is_onboarding or force_onboarding_mode:
        effective_system_prompt = inject_known_personalization(
            effective_system_prompt,
            user_nickname,
            user_occupation,
            user_about,
        )
    
    return ChatContextResult(
        effective_system_prompt=effective_system_prompt,
        effective_message=effective_message,
        tool_list=tool_list,
        is_onboarding=is_onboarding,
        force_onboarding_mode=force_onboarding_mode,
    )
