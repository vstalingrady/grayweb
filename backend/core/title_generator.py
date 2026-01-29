"""Title generation utilities.

Extracted from main.py for better modularity.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

# Lazy-loaded dependencies
_openrouter_service = None
_logger = None

def _get_openrouter_service():
    """Lazily get OpenRouter service."""
    global _openrouter_service
    if _openrouter_service is None:
        from backend.openrouter_client import OpenRouterService
        _openrouter_service = OpenRouterService()
    return _openrouter_service


def _get_logger():
    """Lazily get logger."""
    global _logger
    if _logger is None:
        from backend.logging_config import create_logger
        _logger = create_logger("backend.title")
    return _logger


def _load_prompt_from_json(path, key, fallback, locale="en"):
    """Load prompt from JSON file."""
    from backend.core.prompt_utils import load_prompt_from_json
    return load_prompt_from_json(path, key, fallback, locale=locale)


def _clean_title(raw_title: str) -> Optional[str]:
    """Clean and normalize a generated title."""
    candidate = (raw_title or "").strip()
    if not candidate:
        return None
    candidate = re.sub(r'^["\'"]|["\'"]$', "", candidate).strip()
    candidate = re.sub(r"<[^>]+>", "", candidate).strip()
    candidate = re.sub(r"^title\s*:\s*", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"\s+", " ", candidate).strip()
    return candidate or None


async def generate_chat_title_inline(
    message: str,
    response_text: str,
    prompt_locale: str = "en",
    *,
    user_id: Optional[int] = None,
    openrouter_service=None,
    prompts_path=None,
) -> Optional[str]:
    """Generate a concise title for the conversation using a lightweight model.
    
    Returns the generated title or None if generation fails.
    This is called inline (blocking) so the SSE end event can include the title.
    
    Args:
        message: The user's message
        response_text: The assistant's response
        prompt_locale: Locale for prompt template
        openrouter_service: Optional pre-configured OpenRouter service
        prompts_path: Optional path to prompts JSON
        
    Returns:
        Generated title string or None
    """
    logger = _get_logger()
    
    # Use provided services or get defaults
    OPENROUTER_SERVICE = openrouter_service or _get_openrouter_service()
    
    # Get prompts path
    if prompts_path is None:
        ROOT_DIR = Path(__file__).resolve().parent.parent.parent
        prompts_path = ROOT_DIR / "public" / "system-prompts.json"
    
    # Load prompt from JSON or fallback
    prompt_template = _load_prompt_from_json(
        prompts_path,
        "title_generation",
        "Analyze the following conversation and generate a concise, descriptive title (under 25 characters, 3-5 words max). Output ONLY the title text, no tags or quotes.",
        locale=prompt_locale,
    )

    # Construct a minimal transcript for the title model
    transcript = f"User: {message}\nAssistant: {response_text}"
    
    try:
        if OPENROUTER_SERVICE and OPENROUTER_SERVICE.available:
            title_model = os.getenv("OPENROUTER_TITLE_MODEL", "google/gemini-3-flash-preview")

            raw_title = await OPENROUTER_SERVICE.generate(
                transcript,
                conversation_history=None,
                workspace_context=None,
                system_prompt=prompt_template,
                time_context=None,
                model=title_model,
                include_usage=False,
                response_format=None,
                tools=None,
                tool_choice=None,
                user=f"gray-user:{user_id}" if user_id is not None else None,
            )
            cleaned = _clean_title(raw_title)
            if cleaned:
                return cleaned

    except Exception as e:
        logger.warning(
            f"Inline title generation failed: {e}",
            extra={"event_type": "title_generation_error"}
        )
    return None
