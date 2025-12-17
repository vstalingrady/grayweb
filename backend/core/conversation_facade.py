"""Unified facade for all conversation-related helpers.

This module provides a single import point for conversation operations,
eliminating the need for repeated tuple destructuring in API routes.

Usage:
    from backend.core.conversation_facade import (
        require_conversation_owner,
        load_conversation_history,
        save_conversation_message,
        # ... etc
    )
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    import databases

# ============================================================================
# Re-exports from existing core modules (already extracted)
# ============================================================================

# From conversation_manager
from backend.core.conversation_manager import (
    save_conversation_message,
    get_or_create_conversation,
    load_conversation_history,
)

# From chat_history
from backend.core.chat_history import (
    normalize_conversation_history,
    overwrite_thread_history,
    apply_conversation_update,
    _is_valid_uuid as is_valid_uuid,
)

# From conversation_store
from backend.core.conversation_store import (
    _general_conversation_user_id as general_conversation_user_id,
    invalidate_conversation_cache,
)

# From general_conversation
from backend.core.general_conversation import (
    delete_general_conversation_history,
    replace_general_conversation_history,
)

# ============================================================================
# Lazy imports to avoid circular dependencies
# ============================================================================

_database = None
_app_logger = None
_GEMINI_SERVICE = None
_OPENROUTER_SERVICE = None
_chat_sessions = None
_tier_conversation_token_limit = None


def _get_database():
    """Lazily get database connection."""
    global _database
    if _database is None:
        from backend.database import database
        _database = database
    return _database


def _get_logger():
    """Lazily get app logger."""
    global _app_logger
    if _app_logger is None:
        from backend.logging_config import create_logger
        _app_logger = create_logger("backend.core.conversation_facade")
    return _app_logger


def _get_gemini_service():
    """Lazily get Gemini service singleton."""
    global _GEMINI_SERVICE
    if _GEMINI_SERVICE is None:
        from backend.gemini_client import GeminiService
        _GEMINI_SERVICE = GeminiService()
    return _GEMINI_SERVICE


def _get_openrouter_service():
    """Lazily get OpenRouter service singleton."""
    global _OPENROUTER_SERVICE
    if _OPENROUTER_SERVICE is None:
        from backend.openrouter_client import OpenRouterService
        _OPENROUTER_SERVICE = OpenRouterService()
    return _OPENROUTER_SERVICE


def _get_chat_sessions():
    """Lazily get chat_sessions table."""
    global _chat_sessions
    if _chat_sessions is None:
        from backend.database import chat_sessions
        _chat_sessions = chat_sessions
    return _chat_sessions


def _get_tier_conversation_token_limit():
    """Lazily get tier token limit function."""
    global _tier_conversation_token_limit
    if _tier_conversation_token_limit is None:
        from backend.main import tier_conversation_token_limit
        _tier_conversation_token_limit = tier_conversation_token_limit
    return _tier_conversation_token_limit


# ============================================================================
# Properties for lazy access (backwards compatible with direct attribute access)
# ============================================================================

class _LazyServices:
    """Lazy loader for services to avoid circular imports."""
    
    @property
    def database(self):
        return _get_database()
    
    @property
    def app_logger(self):
        return _get_logger()
    
    @property
    def GEMINI_SERVICE(self):
        return _get_gemini_service()
    
    @property
    def OPENROUTER_SERVICE(self):
        return _get_openrouter_service()
    
    @property
    def chat_sessions(self):
        return _get_chat_sessions()
    
    @property
    def tier_conversation_token_limit(self):
        return _get_tier_conversation_token_limit()


# Singleton for lazy services
services = _LazyServices()

# Direct exports for convenience
database = property(lambda self: _get_database())
app_logger = property(lambda self: _get_logger())


# ============================================================================
# Functions that need to be moved from main.py
# ============================================================================

async def require_conversation_owner(conversation_id: str, current_user: Dict[str, Any]) -> None:
    """Verify user owns the conversation. Raises HTTPException if not."""
    from fastapi import HTTPException, status
    from backend.database import user_chat_threads
    from backend.auth import require_same_user
    from backend.core.cache import ConversationOwnerCache
    
    CONVERSATION_OWNER_CACHE = ConversationOwnerCache()
    database = _get_database()
    logger = _get_logger()
    
    def _row_get(row, key):
        try:
            return row[key]
        except (KeyError, TypeError):
            return getattr(row, key, None)
    
    # Check cache first
    cached_owner = CONVERSATION_OWNER_CACHE.get(conversation_id)
    if cached_owner is not None:
        if cached_owner != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own conversations",
            )
        return
    
    if is_valid_uuid(conversation_id):
        try:
            local_row = await database.fetch_one(
                user_chat_threads.select().where(user_chat_threads.c.id == conversation_id)
            )
            if local_row:
                owner = _row_get(local_row, "user_identifier")
                if owner is not None:
                    CONVERSATION_OWNER_CACHE.set(conversation_id, int(owner))
                    if str(owner) != str(current_user["id"]):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You can only access your own conversations",
                        )
                    return
        except Exception as e:
            logger.warning(
                f"Conversation ownership check failed for {conversation_id}: {e}",
                extra={"conversation_id": conversation_id, "user_id": current_user.get("id"), "error": str(e)}
            )
    else:
        # Non-UUID IDs are treated as local-only; require the current user context.
        require_same_user(current_user["id"], current_user)
        return


def handle_conversation_store_error(context: str, error: Exception) -> None:
    """Log conversation store errors with context."""
    logger = _get_logger()
    logger.error(f"{context}: {error}", extra={"error": str(error)})


# ============================================================================
# Exports for backwards compatibility
# ============================================================================

__all__ = [
    # From conversation_manager
    "save_conversation_message",
    "get_or_create_conversation",
    "overwrite_thread_history",
    "apply_conversation_update",
    # From chat_history
    "normalize_conversation_history",
    "load_conversation_history",
    # From conversation_store
    "general_conversation_user_id",
    "is_valid_uuid",
    "invalidate_conversation_cache",
    # From general_conversation
    "delete_general_conversation_history",
    "replace_general_conversation_history",
    # New in facade
    "require_conversation_owner",
    "handle_conversation_store_error",
    # Lazy services
    "services",
]
