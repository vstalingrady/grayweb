"""Wrapper around the OpenRouter API for various LLM models."""

from __future__ import annotations

import os
import logging
import httpx
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from backend.token_utils import trim_history_by_token_budget
from backend.core.file_annotation_cache import (
    get_cached_pdf_text,
    store_cached_pdf_text,
    should_reuse_pdf_cache,
)
from backend.core.ai_utils import openrouter_annotations_to_grounding


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _trim(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    if not isinstance(text, str):
        try:
            text = str(text)
        except Exception:
            return None
    trimmed = text.strip()
    return trimmed if trimmed else None


def _normalize_mime_type(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _is_pdf_mime(mime_type: Optional[str]) -> bool:
    if not mime_type:
        return False
    normalized = _normalize_mime_type(mime_type)
    return normalized == "application/pdf" or normalized.endswith("/pdf") or normalized.endswith("+pdf")


def _has_pdf_attachments(attachments: Optional[List[Any]]) -> bool:
    if not attachments:
        return False
    for attachment in attachments:
        mime_type = getattr(attachment, "mime_type", None)
        if _is_pdf_mime(mime_type):
            return True
    return False


def _extract_annotations_from_message(message: Any) -> List[Dict[str, Any]]:
    annotations: List[Dict[str, Any]] = []
    if isinstance(message, dict):
        message_annotations = message.get("annotations")
        if isinstance(message_annotations, list):
            annotations.extend([a for a in message_annotations if isinstance(a, dict)])
        content = message.get("content")
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                part_annotations = part.get("annotations")
                if isinstance(part_annotations, list):
                    annotations.extend([a for a in part_annotations if isinstance(a, dict)])
    return annotations


def _extract_text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text") or item.get("content")
            if isinstance(text, str):
                parts.append(text)
        return "".join(parts)
    return ""


def _extract_annotations_from_delta(delta: Dict[str, Any], choice: Dict[str, Any]) -> List[Dict[str, Any]]:
    annotations: List[Dict[str, Any]] = []
    delta_annotations = delta.get("annotations")
    if isinstance(delta_annotations, list):
        annotations.extend([a for a in delta_annotations if isinstance(a, dict)])
    content = delta.get("content")
    if isinstance(content, list):
        for part in content:
            if not isinstance(part, dict):
                continue
            part_annotations = part.get("annotations")
            if isinstance(part_annotations, list):
                annotations.extend([a for a in part_annotations if isinstance(a, dict)])
    annotations.extend(_extract_annotations_from_message(choice.get("message")))
    return annotations


def _needs_pdf_parser(attachments: Optional[List[Any]]) -> bool:
    if not attachments:
        return False
    reuse_cache = should_reuse_pdf_cache()
    for attachment in attachments:
        mime_type = getattr(attachment, "mime_type", None)
        if not _is_pdf_mime(mime_type):
            continue
        if not reuse_cache:
            return True
        cache_key = getattr(attachment, "content_hash", None)
        cached_text = get_cached_pdf_text(cache_key)
        if not cached_text:
            return True
    return False


def _store_cached_pdf_text_from_grounding(
    grounding_metadata: Optional[Dict[str, Any]],
    attachments: Optional[List[Any]],
) -> None:
    if not grounding_metadata or not attachments:
        return
    chunks = grounding_metadata.get("grounding_chunks") or []
    if not chunks:
        return

    pdf_attachments = [
        a for a in attachments
        if _is_pdf_mime(getattr(a, "mime_type", None))
    ]
    if not pdf_attachments:
        return

    for chunk in chunks:
        retrieved = chunk.get("retrieved_context") if isinstance(chunk, dict) else None
        if not isinstance(retrieved, dict):
            continue
        text = retrieved.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        title = retrieved.get("document_name") or retrieved.get("title")
        title_normalized = str(title).strip().lower() if title else None

        matched = False
        for attachment in pdf_attachments:
            filename = (getattr(attachment, "filename", None) or "").strip().lower()
            if title_normalized and filename and title_normalized not in filename:
                continue
            cache_key = getattr(attachment, "content_hash", None)
            store_cached_pdf_text(cache_key, text)
            matched = True

        if not matched and len(pdf_attachments) == 1:
            cache_key = getattr(pdf_attachments[0], "content_hash", None)
            store_cached_pdf_text(cache_key, text)


class OpenRouterService:
    """Client for OpenRouter API supporting various LLM models."""

    # OpenRouter API endpoint
    BASE_URL = "https://openrouter.ai/api/v1"

    # Model mappings for Pioneer tier models (using real OpenRouter model IDs)
    # These are the default (non-reasoning) model variants
    MODEL_MAPPINGS = {
        # Anthropic models
        "claude-4": "anthropic/claude-sonnet-4",
        "claude-sonnet-4": "anthropic/claude-sonnet-4",
        "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
        "claude-opus-4.5": "anthropic/claude-opus-4.6",
        "claude-opus-4.6": "anthropic/claude-opus-4.6",
        "claude-haiku-4.5": "anthropic/claude-haiku-4.5",
        "claude-3.5": "anthropic/claude-3.5-sonnet",
        "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
        # OpenAI models (non-reasoning variants)
        "gpt-5.2": "openai/gpt-5.2-chat",  # Default to chat variant
        "gpt-5.2-chat": "openai/gpt-5.2-chat",
        "gpt-5.2-pro": "openai/gpt-5.2-pro",
        "gpt-4o": "openai/gpt-4o",
        "gpt-4-turbo": "openai/gpt-4-turbo",
        "gpt-4o-mini": "openai/gpt-4o-mini",
        # DeepSeek models
        "deepseek-v3": "deepseek/deepseek-chat",
        "deepseek-v3.2": "deepseek/deepseek-v3.2",
        "deepseek-v3.2-speciale": "deepseek/deepseek-v3.2-speciale",  # Always-reasoning variant
        "deepseek-r1": "deepseek/deepseek-r1",
        # Moonshot / Kimi models
        "kimi-k2": "moonshotai/kimi-k2-0905",  # Non-reasoning variant
        "kimi-k2-0905": "moonshotai/kimi-k2-0905",
        "kimi-k2.5": "moonshotai/kimi-k2.5",
        "moonshotai/kimi-k2.5": "moonshotai/kimi-k2.5",
        # xAI Grok models
        "grok-4": "x-ai/grok-4.1-fast",
        "grok-4.1": "x-ai/grok-4.1-fast",
        "grok-4.1-fast": "x-ai/grok-4.1-fast",
        "grok-3": "x-ai/grok-3",
        "grok-2": "x-ai/grok-2-1212",
        # Google Gemini models (via OpenRouter)
        "gemini-3-pro": "google/gemini-3-pro-preview",
        "gemini-3-flash": "google/gemini-3-flash-preview",
        # Default fallback
        "default": "anthropic/claude-sonnet-4.5",
    }

    # Models that have separate reasoning variants
    # Maps non-reasoning model ID -> reasoning model ID
    # NOTE: Only for models where reasoning requires a DIFFERENT model ID
    REASONING_MODEL_VARIANTS = {
        "openai/gpt-5.2-chat": "openai/gpt-5.2",  # gpt-5.2 is the reasoning variant
        # DeepSeek v3.2 uses the reasoning param, NOT a separate model
        # Grok models handle reasoning via the reasoning param
        # Anthropic models handle reasoning via extended thinking, not separate model
    }

    # Reverse mapping: reasoning model -> non-reasoning model
    # Used to downgrade when reasoning_mode is False but user selected thinking variant
    REVERSE_REASONING_VARIANTS = {
        "openai/gpt-5.2": "openai/gpt-5.2-chat",
    }

    # Models where reasoning is ALWAYS on (toggle should be grayed out in frontend)
    # These models don't need/support the reasoning param - they always reason
    ALWAYS_REASONING_MODELS = {
        "deepseek/deepseek-v3.2-speciale",  # Speciale variant always reasons
        "openai/gpt-5.2",  # The reasoning variant of gpt-5.2
        "openai/gpt-5.2-pro",
        "moonshotai/kimi-k2.5",  # Kimi K2.5 streams reasoning by default
        "google/gemini-3-pro-preview",  # Gemini 3 Pro always emits reasoning details
    }

    # Non-reasoning fallbacks to avoid hidden reasoning tokens when reasoning_mode is disabled.
    ALWAYS_REASONING_FALLBACKS = {
        "deepseek/deepseek-v3.2-speciale": "deepseek/deepseek-v3.2",
        "openai/gpt-5.2": "openai/gpt-5.2-chat",
        "openai/gpt-5.2-pro": "openai/gpt-5.2-chat",
    }

    # Model-specific context limits (in tokens)
    # Used for displaying accurate context limits in the UI
    # Default is 2M for models not listed here
    MODEL_CONTEXT_LIMITS = {
        # DeepSeek models (163k context)
        "deepseek/deepseek-chat": 163_840,
        "deepseek/deepseek-v3.2": 163_840,
        "deepseek/deepseek-v3.2-speciale": 163_840,
        "deepseek/deepseek-r1": 163_840,
        # Anthropic Claude models
        "anthropic/claude-sonnet-4": 200_000,
        "anthropic/claude-sonnet-4.5": 1_000_000,  # 1M context
        "anthropic/claude-opus-4.6": 1_000_000,  # 1M context
        "anthropic/claude-opus-4.5": 1_000_000,  # legacy alias support
        "anthropic/claude-haiku-4.5": 200_000,
        "anthropic/claude-3.5-sonnet": 200_000,
        # OpenAI models
        "openai/gpt-5.2": 400_000,        # Reasoning variant - 400k
        "openai/gpt-5.2-pro": 400_000,
        "openai/gpt-5.2-chat": 128_000,   # Chat variant - 128k
        "openai/gpt-4o": 128_000,
        "openai/gpt-4-turbo": 128_000,
        "openai/gpt-4o-mini": 128_000,
        # Kimi models (262k context)
        "moonshotai/kimi-k2.5": 262_144,
        "moonshotai/kimi-k2-0905": 262_144,
        # MiniMax models
        "minimax/minimax-m2.1": 205_000,
        "minimax/minimax-m2-her": 65_536,
        # xAI Grok models
        "x-ai/grok-4.1-fast": 2_000_000,  # 2M context
        "x-ai/grok-3": 131_072,
        "x-ai/grok-2-1212": 131_072,
        # Google Gemini (via OpenRouter)
        "google/gemini-3-pro-preview": 1_048_576,  # 1M context
        "google/gemini-3-flash-preview": 1_048_576,  # 1M context
    }

    @classmethod
    def get_model_context_limit(cls, model_id: str) -> int:
        """Get the context limit for a specific model. Returns 2M if not found."""
        return cls.MODEL_CONTEXT_LIMITS.get(model_id, 2_000_000)

    def __init__(self) -> None:
        provider = (os.getenv("AI_PROVIDER") or "openrouter").strip().lower()
        api_key = _trim(os.getenv("OPENROUTER_API_KEY"))
        if not api_key and provider == "moltbot":
            api_key = _trim(os.getenv("MOLTBOT_GATEWAY_TOKEN") or os.getenv("MOLTBOT_API_KEY"))
        self._provider = provider
        self._api_key = api_key
        enabled_raw = (
            os.getenv("MOLTBOT_ENABLED") if provider == "moltbot" else os.getenv("OPENROUTER_ENABLED")
        ) or "true"
        self._enabled = enabled_raw.strip().lower() not in {"0", "false", "no", "off"}
        self._prompt_cache_enabled = (os.getenv("OPENROUTER_PROMPT_CACHE") or "true").strip().lower() not in {
            "0",
            "false",
            "no",
            "off",
        }
        # Anthropic and Google Gemini require explicit cache_control breakpoints.
        # OpenAI, DeepSeek, Grok, Moonshot, Groq have automatic caching.
        cache_prefixes = os.getenv("OPENROUTER_PROMPT_CACHE_PREFIXES", "anthropic/,google/")
        self._prompt_cache_prefixes = [
            prefix.strip().lower() for prefix in cache_prefixes.split(",") if prefix.strip()
        ]
        self._lite_model = os.getenv("OPENROUTER_LITE_MODEL", "xiaomi/mimo-v2-flash:free")
        self._default_model = os.getenv("OPENROUTER_DEFAULT_MODEL", self.MODEL_MAPPINGS["default"])
        base_url = os.getenv("OPENROUTER_BASE_URL")
        if provider == "moltbot":
            base_url = os.getenv("MOLTBOT_BASE_URL") or base_url or "http://127.0.0.1:18789/v1"
        self._base_url = (base_url or self.BASE_URL).rstrip("/")
        # Keep a small window for the free/lite path, but widen it for Pioneer-grade models
        # so onboarding context is not dropped mid-flow.
        self._max_history_lite = _int_env("OPENROUTER_MAX_HISTORY_MESSAGES", 10)
        self._max_history_premium = _int_env("OPENROUTER_MAX_HISTORY_MESSAGES_PREMIUM", 40)
        self._temperature = _float_env("OPENROUTER_TEMPERATURE", 0.7)
        self._site_url = os.getenv("NEXT_PUBLIC_SITE_URL", "https://gray.alignment.id")
        self._site_name = os.getenv("OPENROUTER_SITE_NAME", "Gray")
        # Shared HTTP client for connection pooling
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create shared HTTP client with connection pooling."""
        if self._client is None or self._client.is_closed:
            # Allow long streams without client-side truncation; provider-side limits still apply.
            # Enable HTTP/2 for better streaming performance
            self._client = httpx.AsyncClient(timeout=600.0, http2=True)
        return self._client

    async def close(self) -> None:
        """Close the shared HTTP client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    @property
    def available(self) -> bool:
        if not self._enabled:
            return False
        if self._provider == "moltbot":
            return True
        return self._api_key is not None and len(self._api_key) > 0

    @property
    def lite_model(self) -> str:
        return self._lite_model

    def _resolve_model(self, model: Optional[str], reasoning_mode: bool = False) -> str:
        """Resolve model name to OpenRouter model ID.
        
        Args:
            model: The model name or ID to resolve
            reasoning_mode: If True, return the reasoning variant for models that have one.
                           If False, downgrade from reasoning variants to base models.
        """
        effective_reasoning_mode = self._normalize_reasoning_mode(model, reasoning_mode)
        if not model:
            base_model = self._default_model
        else:
            # Normalize model name
            model_lower = model.strip().lower()
            
            # Handle legacy Grok alias for the lite tier
            if model_lower in {"grok", "grok-lite"}:
                base_model = self._lite_model
            # Handle tier mappings
            elif model_lower in {"lite", "gray-lite"}:
                base_model = self._lite_model
            # Check if it's a shorthand key
            elif model in self.MODEL_MAPPINGS:
                base_model = self.MODEL_MAPPINGS[model]
            else:
                # Otherwise return as-is (assume it's already a full model ID)
                base_model = model

        if not effective_reasoning_mode and base_model in self.ALWAYS_REASONING_FALLBACKS:
            fallback = self.ALWAYS_REASONING_FALLBACKS[base_model]
            _logger = logging.getLogger("openrouter_client")
            _logger.info(
                "[OpenRouter] Downgraded always-reasoning model to non-reasoning fallback",
                extra={"requested_model": base_model, "resolved_model": fallback},
            )
            return fallback
        
        # If reasoning mode is enabled, check if this model has a reasoning variant
        if effective_reasoning_mode and base_model in self.REASONING_MODEL_VARIANTS:
            return self.REASONING_MODEL_VARIANTS[base_model]
        
        # If reasoning mode is disabled but user selected a thinking variant,
        # downgrade to the non-reasoning base model
        if not effective_reasoning_mode and base_model in self.REVERSE_REASONING_VARIANTS:
            return self.REVERSE_REASONING_VARIANTS[base_model]
        
        return base_model

    def _normalize_reasoning_mode(self, model: Optional[str], reasoning_mode: bool) -> bool:
        if not model:
            return reasoning_mode
        model_lower = model.strip().lower()
        if model_lower in {"moonshotai/kimi-k2-0905", "kimi-k2-0905"}:
            return False
        if model_lower in self.ALWAYS_REASONING_MODELS:
            if not reasoning_mode and model_lower in self.ALWAYS_REASONING_FALLBACKS:
                return False
            return True
        return reasoning_mode

    def _history_window_for_model(self, resolved_model: str) -> int:
        """Pick an appropriate history window based on the target model."""
        if resolved_model == self._lite_model:
            return self._max_history_lite
        return self._max_history_premium or self._max_history_lite

    def _should_cache_prompt(self, resolved_model: Optional[str]) -> bool:
        if not self._prompt_cache_enabled:
            return False
        model_lower = (resolved_model or "").strip().lower()
        if not model_lower:
            return False
        if not self._prompt_cache_prefixes:
            return True
        return any(model_lower.startswith(prefix) for prefix in self._prompt_cache_prefixes)

    def _wrap_cache_control(self, text: str, model: Optional[str] = None) -> List[Dict[str, Any]]:
        """Wrap text with cache_control for prompt caching.
        
        Args:
            text: The text content to wrap
            model: The model being used. Anthropic models get 1h TTL for longer sessions.
        
        Returns:
            List with a single content block containing the text with cache_control.
        """
        # Use 1h TTL for Anthropic models to avoid repeated cache writes in longer sessions.
        # Default 5-minute TTL is too short for typical chat sessions.
        model_lower = (model or "").strip().lower()
        if model_lower.startswith("anthropic/"):
            return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral", "ttl": "1h"}}]
        # Google Gemini and others use basic ephemeral caching (Gemini has 5-min TTL regardless)
        return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]

    def _can_cache_history(self, model: Optional[str]) -> bool:
        model_lower = (model or "").strip().lower()
        return model_lower.startswith("anthropic/")

    def _build_messages(
        self,
        conversation_history: Optional[List[Dict[str, Any]]],
        message: str,
        history_limit: int,
        attachments: Optional[List[Any]] = None,
        *,
        history_token_budget: Optional[int] = None,
        runtime_context: Optional[str] = None,
        cache_model: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Build messages array from conversation history, current message, and attachments."""
        history = conversation_history or []
        if history_token_budget is not None and history_token_budget > 0:
            recent_history = trim_history_by_token_budget(history, history_token_budget)
        else:
            recent_history = history[-history_limit:] if history_limit > 0 else history
        payload: List[Dict[str, Any]] = []
        applied_history_cache = False
        should_cache_history = self._can_cache_history(cache_model)
        
        for entry in recent_history:
            role = entry.get("role")
            
            # Handle tool results (OpenRouter format: role='tool', tool_call_id, content)
            if role == "tool":
                tool_msg: Dict[str, Any] = {
                    "role": "tool",
                    "content": str(entry.get("content") or entry.get("text") or ""),
                    "tool_call_id": entry.get("tool_call_id", ""),
                }
                if entry.get("name"):
                    tool_msg["name"] = entry["name"]
                payload.append(tool_msg)
                continue
            
            # Handle assistant messages with tool_calls
            if role == "model" and entry.get("tool_calls"):
                assistant_msg: Dict[str, Any] = {
                    "role": "assistant",
                    "content": _trim(str(entry.get("text") or "")) or None,
                    "tool_calls": entry["tool_calls"],
                }
                payload.append(assistant_msg)
                continue
                
            text = _trim(str(entry.get("text") or ""))
            if not text or role not in {"user", "model"}:
                continue
            # OpenRouter uses "assistant" for model responses
            openrouter_role = "assistant" if role == "model" else "user"
            if should_cache_history and not applied_history_cache:
                payload.append({
                    "role": openrouter_role,
                    "content": self._wrap_cache_control(text, cache_model),
                })
                applied_history_cache = True
            else:
                payload.append({"role": openrouter_role, "content": text})
        
        trimmed_message = _trim(message)
        
        # If we have attachments, we need to construct a multipart message
        if attachments:
            import base64

            content_parts: List[Dict[str, Any]] = []
            file_parts: List[Dict[str, Any]] = []
            image_parts: List[Dict[str, Any]] = []
            cached_pdf_parts: List[Dict[str, Any]] = []
            reuse_pdf_cache = should_reuse_pdf_cache()

            for attachment in attachments:
                # We expect attachment to be an attachment-like object with .data and .mime_type
                if not hasattr(attachment, "data") or not hasattr(attachment, "mime_type"):
                    continue
                mime_type = _normalize_mime_type(attachment.mime_type)
                if not mime_type:
                    continue

                if mime_type.startswith("image/"):
                    b64_data = base64.b64encode(attachment.data).decode("utf-8")
                    image_parts.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64_data}"},
                        }
                    )
                    continue

                if _is_pdf_mime(mime_type):
                    filename = getattr(attachment, "filename", None) or "document.pdf"
                    cache_key = getattr(attachment, "content_hash", None)
                    cached_text = get_cached_pdf_text(cache_key) if reuse_pdf_cache else None
                    if cached_text:
                        cached_pdf_parts.append({
                            "type": "text",
                            "text": f"[Cached PDF content: {filename}]\n{cached_text}",
                        })
                    else:
                        b64_data = base64.b64encode(attachment.data).decode("utf-8")
                        file_parts.append(
                            {
                                "type": "file",
                                "file": {
                                    "filename": filename,
                                    "file_data": f"data:{mime_type};base64,{b64_data}",
                                },
                            }
                        )

            # Text first, then files, then images (OpenRouter recommendation).
            if trimmed_message:
                content_parts.append({"type": "text", "text": trimmed_message})
            if cached_pdf_parts:
                content_parts.extend(cached_pdf_parts)
            if file_parts:
                content_parts.extend(file_parts)
            if image_parts:
                content_parts.extend(image_parts)

            if content_parts:
                payload.append({"role": "user", "content": content_parts})
            elif trimmed_message:  # Fallback if no valid attachments processed
                payload.append({"role": "user", "content": trimmed_message})

        elif trimmed_message:
            payload.append({"role": "user", "content": trimmed_message})
        
        # Insert runtime context (time) BEFORE the user message but AFTER history.
        # This is critical for caching: the cache prefix includes system prompt + history.
        # If time context came before history, it would break the cache prefix every request.
        runtime_text = _trim(runtime_context)
        if runtime_text:
            # Find the position to insert - right before the last user message
            # The user message was just appended above, so insert at -1 position
            if payload:
                payload.insert(len(payload) - 1, {"role": "system", "content": runtime_text})
            else:
                payload.append({"role": "system", "content": runtime_text})

        return payload

    def _build_system_prompt(
        self,
        system_prompt: Optional[str],
        workspace_context: Optional[str],
    ) -> Optional[str]:
        """Construct STABLE system prompt for caching.
        
        Note: time_context is intentionally NOT included here - it's handled
        separately via _build_runtime_context() and placed AFTER this cached
        content in the message array. This allows the system prompt to be
        cached while time context remains dynamic.
        """
        pieces: List[str] = []
        base = _trim(system_prompt)
        if base:
            pieces.append(base)
        
        context_lines: List[str] = []
        if workspace_context and workspace_context.strip():
            context_lines.append(workspace_context.strip())
        
        if context_lines:
            pieces.append("<context>\n" + "\n".join(context_lines) + "\n</context>")
        
        return "\n\n".join(pieces) if pieces else None

    def _build_runtime_context(self, time_context: Optional[str]) -> Optional[str]:
        trimmed = _trim(time_context)
        if not trimmed:
            return None
        return "<context>\n" + trimmed + "\n</context>"

    def _build_headers(self, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Build request headers for OpenRouter API."""
        headers = {
            "Content-Type": "application/json",
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        
        # Add optional OpenRouter-specific headers for better analytics
        if self._site_url:
            headers["HTTP-Referer"] = self._site_url
        if self._site_name:
            headers["X-Title"] = self._site_name
        if extra_headers:
            for key, value in extra_headers.items():
                if isinstance(value, str) and value.strip():
                    headers[key] = value
        
        return headers

    def _build_provider_preferences(
        self,
        resolved_model: Optional[str] = None,
        requested_model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build provider preferences, favoring cache-friendly routing by default."""
        provider_preferences: Dict[str, Any] = {
            "allow_fallbacks": True,
        }
        sort_pref = (os.getenv("OPENROUTER_PROVIDER_SORT") or "").strip().lower()
        if sort_pref in {"price", "throughput", "latency"}:
            provider_preferences["sort"] = sort_pref
        order_pref = (os.getenv("OPENROUTER_PROVIDER_ORDER") or "").strip()
        order_from_env = [item.strip() for item in order_pref.split(",") if item.strip()] if order_pref else []
        if order_from_env:
            provider_preferences["order"] = order_from_env
        requested_lower = (requested_model or "").strip().lower()
        resolved_lower = (resolved_model or "").strip().lower()
        if not order_from_env and "sort" not in provider_preferences:
            if requested_lower in {"moonshotai/kimi-k2-0905", "kimi-k2-0905"}:
                provider_preferences["order"] = ["Groq"]
            elif requested_lower in {"moonshotai/kimi-k2.5", "kimi-k2.5", "moonshotai/kimi-k2-5", "kimi-k2-5"}:
                provider_preferences["order"] = ["Chutes"]
            elif "deepseek" in resolved_lower:
                provider_preferences["order"] = ["DeepSeek"]
        return provider_preferences

    def _convert_tools_to_openai_format(self, tools: Optional[List[Any]]) -> Optional[List[Dict[str, Any]]]:
        """Convert Google GenAI tool definitions to OpenAI format."""
        if not tools:
            return None
        
        openai_tools = []
        for tool in tools:
            # Handle google.genai.types.Tool objects
            if hasattr(tool, "function_declarations") and tool.function_declarations:
                for func in tool.function_declarations:
                    parameters = {}
                    if hasattr(func, "parameters") and func.parameters:
                        # Recursively convert schema
                        parameters = self._convert_schema(func.parameters)
                    
                    openai_tools.append({
                        "type": "function",
                        "function": {
                            "name": func.name,
                            "description": func.description,
                            "parameters": parameters
                        }
                    })
        return openai_tools if openai_tools else None

    def _convert_schema(self, schema: Any) -> Dict[str, Any]:
        """Convert a Google GenAI Schema object to a JSON schema dict."""
        json_schema = {"type": schema.type.lower() if hasattr(schema.type, "lower") else str(schema.type).lower()}
        
        if hasattr(schema, "description") and schema.description:
            json_schema["description"] = schema.description
            
        if hasattr(schema, "properties") and schema.properties:
            json_schema["properties"] = {
                k: self._convert_schema(v) for k, v in schema.properties.items()
            }
            
        if hasattr(schema, "required") and schema.required:
            json_schema["required"] = schema.required
            
        if hasattr(schema, "items") and schema.items:
            json_schema["items"] = self._convert_schema(schema.items)
            
        if hasattr(schema, "enum") and schema.enum:
            json_schema["enum"] = schema.enum
            
        return json_schema

    def _merge_plugins(
        self,
        plugins: Optional[List[Dict[str, Any]]],
        attachments: Optional[List[Any]],
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        """Merge caller-provided plugins with attachment/format-driven plugins."""
        plugin_list = list(plugins) if plugins else []

        if _needs_pdf_parser(attachments):
            has_file_parser = any(p.get("id") == "file-parser" for p in plugin_list)
            if not has_file_parser:
                engine = os.getenv("OPENROUTER_PDF_ENGINE", "").strip()
                file_plugin: Dict[str, Any] = {"id": "file-parser"}
                if engine:
                    file_plugin["pdf"] = {"engine": engine}
                plugin_list.append(file_plugin)

        # Use response healing when strict JSON output is requested.
        if response_format:
            response_type = (response_format.get("type") or "").strip().lower()
            if response_type in {"json_object", "json_schema"}:
                has_healing = any(p.get("id") == "response-healing" for p in plugin_list)
                if not has_healing:
                    plugin_list.append({"id": "response-healing"})

        return plugin_list or None

    async def generate(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        workspace_context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        time_context: Optional[str] = None,
        model: Optional[str] = None,
        attachments: Optional[List[Any]] = None,
        include_usage: bool = False,
        response_format: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[str] = "auto",
        plugins: Optional[List[Dict[str, Any]]] = None,
        provider_routing: Optional[Dict[str, Any]] = None,
        web_search_options: Optional[Dict[str, Any]] = None,
        return_metadata: bool = False,
        *,
        history_token_budget: Optional[int] = None,
        user: Optional[str] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> str | Tuple[str, Optional[Dict[str, Any]]]:
        """Generate a complete response from OpenRouter."""
        if not self.available:
            raise RuntimeError("OpenRouter client is not configured (missing API key)")

        resolved_model = self._resolve_model(model)
        history_limit = self._history_window_for_model(resolved_model)
        runtime_context = self._build_runtime_context(time_context)
        messages = self._build_messages(
            conversation_history,
            message,
            history_limit,
            attachments=attachments,
            history_token_budget=history_token_budget,
            runtime_context=runtime_context,
            cache_model=resolved_model,
        )

        # Note: Runtime context (time) is NOT cached - it changes every request.
        # System prompt caching happens below after _build_system_prompt.
        
        if not messages:
            messages = [{"role": "user", "content": message}]

        # Build request payload
        provider_preferences = self._build_provider_preferences(
            resolved_model=resolved_model,
            requested_model=model,
        )
        if provider_routing:
            provider_preferences.update(provider_routing)

        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "temperature": self._temperature,
            # OpenRouter optimizations: https://openrouter.ai/docs/provider-routing
            "provider": provider_preferences,
            # Compress long contexts automatically (middle-out)
            "transforms": ["middle-out"],
        }

        if user:
            payload["user"] = user

        # Usage is included automatically in OpenRouter responses.
        if response_format:
            payload["response_format"] = response_format
        if web_search_options:
            payload["web_search_options"] = web_search_options
            
        openai_tools = self._convert_tools_to_openai_format(tools)
        if openai_tools:
            payload["tools"] = openai_tools
            if tool_choice:
                payload["tool_choice"] = tool_choice

        # Add plugins for web search, etc.
        merged_plugins = self._merge_plugins(plugins, attachments, response_format=response_format)
        if merged_plugins:
            payload["plugins"] = merged_plugins

        # Add system prompt if provided - this is the STABLE content we want to cache.
        # It includes the base instructions and workspace context, but NOT time_context (which is volatile).
        system = self._build_system_prompt(system_prompt, workspace_context)
        if system:
            # Apply cache_control to system prompt for models that require explicit breakpoints.
            # Anthropic and Google Gemini need this; others have automatic caching.
            if self._should_cache_prompt(resolved_model):
                # Wrap as multipart content with cache_control
                payload["messages"].insert(0, {
                    "role": "system",
                    "content": self._wrap_cache_control(system, resolved_model)
                })
            else:
                # Standard system message for providers with automatic caching
                payload["messages"].insert(0, {"role": "system", "content": system})

        client = await self._get_client()
        response = await client.post(
            f"{self._base_url}/chat/completions",
            headers=self._build_headers(extra_headers),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        
        annotations: List[Dict[str, Any]] = []
        usage_payload = data.get("usage") if isinstance(data, dict) else None

        # Extract content from response
        if "choices" in data and len(data["choices"]) > 0:
            choice = data["choices"][0]
            message_data = choice.get("message", {})
            annotations = _extract_annotations_from_message(message_data)
            
            # Check for tool calls
            if message_data.get("tool_calls"):
                # For simple generate, we might just return the tool calls as a special response
                # or handle them. Since this function returns str, we might need to serialize
                # the tool calls or handle this differently in the caller.
                # For now, let's return a JSON string representation of tool calls if content is empty
                import json
                result_text = json.dumps({"tool_calls": message_data["tool_calls"]})
                if return_metadata:
                    grounding_metadata = openrouter_annotations_to_grounding(annotations)
                    _store_cached_pdf_text_from_grounding(grounding_metadata, attachments)
                    return result_text, {"annotations": annotations, "usage": usage_payload}
                return result_text
            
            result_text = _extract_text_from_content(message_data.get("content"))
            if return_metadata:
                grounding_metadata = openrouter_annotations_to_grounding(annotations)
                _store_cached_pdf_text_from_grounding(grounding_metadata, attachments)
                return result_text, {"annotations": annotations, "usage": usage_payload}
            return result_text
        
        if return_metadata:
            return "", {"annotations": annotations, "usage": usage_payload}
        return ""

    async def stream(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        workspace_context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        time_context: Optional[str] = None,
        model: Optional[str] = None,
        include_usage: bool = False,
        response_format: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[str] = "auto",
        plugins: Optional[List[Dict[str, Any]]] = None,
        reasoning_mode: bool = False,
        attachments: Optional[List[Any]] = None,
        provider_routing: Optional[Dict[str, Any]] = None,
        web_search_options: Optional[Dict[str, Any]] = None,
        *,
        history_token_budget: Optional[int] = None,
        user: Optional[str] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> AsyncIterator[str | Dict[str, Any]]:
        """Stream response chunks from OpenRouter.
        
        Yields:
            str: Content chunks
            dict: Usage statistics (if include_usage=True and available)
        """
        # DEBUG: Log key parameters to diagnose short response issue
        import logging
        _logger = logging.getLogger("openrouter_client")
        _logger.info(
            f"[OpenRouter.stream] model={model}, "
            f"system_prompt_len={len(system_prompt or '')}, "
            f"history_len={len(conversation_history or [])}, "
            f"message_len={len(message or '')}, "
            f"workspace_ctx_len={len(workspace_context or '')}, "
            f"time_ctx_len={len(time_context or '')}, "
            f"attachments_len={len(attachments or [])}"
        )
        if system_prompt:
            # Log first 200 chars of system prompt to see what's being used
            _logger.info(f"[OpenRouter.stream] system_prompt_preview: {(system_prompt or '')[:200]}...")
        
        if not self.available:
            raise RuntimeError("OpenRouter client is not configured (missing API key)")

        # Resolve model with reasoning mode to get the correct variant
        # e.g., openai/gpt-5.2-chat -> openai/gpt-5.2 when reasoning_mode=True
        effective_reasoning_mode = self._normalize_reasoning_mode(model, reasoning_mode)
        resolved_model = self._resolve_model(model, reasoning_mode=effective_reasoning_mode)
        history_limit = self._history_window_for_model(resolved_model)
        runtime_context = self._build_runtime_context(time_context)
        messages = self._build_messages(
            conversation_history,
            message,
            history_limit,
            attachments=attachments,
            history_token_budget=history_token_budget,
            runtime_context=runtime_context,
            cache_model=resolved_model,
        )

        # Note: Runtime context (time) is NOT cached - it changes every request.
        # System prompt caching happens below after _build_system_prompt.
        
        if not messages:
            messages = [{"role": "user", "content": message}]

        # Build provider preferences with routing logic
        provider_preferences = self._build_provider_preferences(
            resolved_model=resolved_model,
            requested_model=model,
        )
        
        # Apply provider routing overrides
        if provider_routing:
            provider_preferences.update(provider_routing)

        # Build request payload
        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "temperature": self._temperature,
            "stream": True,  # Enable streaming
            # OpenRouter optimizations: https://openrouter.ai/docs/provider-routing
            "provider": provider_preferences,
            # Compress long contexts automatically (middle-out)
            # https://openrouter.ai/docs/transforms
            "transforms": ["middle-out"],
        }

        if user:
            payload["user"] = user

        # Usage is included automatically in OpenRouter streaming responses.
        if response_format:
            payload["response_format"] = response_format
        if web_search_options:
            payload["web_search_options"] = web_search_options

        openai_tools = self._convert_tools_to_openai_format(tools)
        if openai_tools:
            payload["tools"] = openai_tools
            if tool_choice:
                payload["tool_choice"] = tool_choice

        # Add plugins for web search, etc.
        merged_plugins = self._merge_plugins(plugins, attachments, response_format=response_format)
        if merged_plugins:
            payload["plugins"] = merged_plugins

        # Add reasoning mode if enabled
        # Note: Per xAI docs, grok-4 and grok-4-fast don't support reasoning_effort param
        # Only grok-3-mini supports it. Grok-4 has reasoning built-in.
        if effective_reasoning_mode:
            # Skip for grok-4 models which error on reasoning param
            is_grok4 = "grok-4" in resolved_model.lower() or "grok4" in resolved_model.lower()
            is_kimi_k25 = resolved_model.lower() == "moonshotai/kimi-k2.5"
            is_gemini_3_pro = resolved_model.lower() == "google/gemini-3-pro-preview"
            if not is_grok4 and not is_kimi_k25:
                effort = "high"
                if is_gemini_3_pro and not reasoning_mode:
                    effort = "low"
                payload["reasoning"] = {"effort": effort}
                _logger.info(f"[OpenRouter] Added reasoning param to payload for model {resolved_model}")
            else:
                _logger.info(f"[OpenRouter] Skipped reasoning param for model: {resolved_model}")

        # Add system prompt if provided - this is the STABLE content we want to cache.
        # It includes the base instructions and workspace context, but NOT time_context (which is volatile).
        system = self._build_system_prompt(system_prompt, workspace_context)
        if system:
            # Apply cache_control to system prompt for models that require explicit breakpoints.
            # Anthropic and Google Gemini need this; others have automatic caching.
            if self._should_cache_prompt(resolved_model):
                # Wrap as multipart content with cache_control
                payload["messages"].insert(0, {
                    "role": "system",
                    "content": self._wrap_cache_control(system, resolved_model)
                })
            else:
                # Standard system message for providers with automatic caching
                payload["messages"].insert(0, {"role": "system", "content": system})

        client = await self._get_client()
        async with client.stream(
            "POST",
            f"{self._base_url}/chat/completions",
            headers=self._build_headers(extra_headers),
            json=payload,
        ) as response:
            response.raise_for_status()
            
            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    
                    if line.startswith("data: "):
                        data_str = line[6:]
                        try:
                            if data_str == "[DONE]":
                                return

                            import json
                            data = json.loads(data_str)
                            
                            # Check for mid-stream errors (per OpenRouter docs)
                            if "error" in data:
                                yield {"error": data["error"]}
                                return
                            
                            if "choices" in data and len(data["choices"]) > 0:
                                choice = data["choices"][0]
                                finish_reason = choice.get("finish_reason")
                                
                                # Handle error finish reason
                                if finish_reason == "error":
                                    error_msg = choice.get("delta", {}).get("content") or "Stream error"
                                    yield {"error": {"message": error_msg}}
                                    return
                                
                                delta = choice.get("delta", {})
                                content = delta.get("content")
                                tool_calls = delta.get("tool_calls")
                                annotations = _extract_annotations_from_delta(delta, choice)
                                if annotations:
                                    _store_cached_pdf_text_from_grounding(
                                        openrouter_annotations_to_grounding(annotations),
                                        attachments,
                                    )
                                    yield {"annotations": annotations}
                                
                                if tool_calls:
                                    yield {"tool_calls": tool_calls}
                                
                                # Handle reasoning content - both plaintext and encrypted.
                                # Only surface reasoning when explicitly enabled to avoid leaking tags.
                                allow_reasoning = effective_reasoning_mode
                                reasoning = delta.get("reasoning") or delta.get("reasoning_content")
                                yielded_reasoning = False
                                if allow_reasoning and reasoning:
                                    yield {"type": "reasoning", "content": reasoning}
                                    yielded_reasoning = True

                                # Handle reasoning_details (may contain encrypted xAI reasoning)
                                reasoning_pieces = []
                                details = delta.get("reasoning_details") or []
                                if isinstance(details, list):
                                    for item in details:
                                        if not isinstance(item, dict):
                                            continue
                                        if allow_reasoning and item.get("type") == "reasoning.encrypted":
                                            # Emit a thinking indicator for encrypted reasoning
                                            yield {"type": "reasoning_active", "encrypted": True}
                                        txt = item.get("text")
                                        if txt:
                                            reasoning_pieces.append(txt)

                                # If reasoning is disabled and content is empty, avoid leaking thought text.
                                if not allow_reasoning and not content:
                                    if reasoning or reasoning_pieces:
                                        _logger.info(
                                            "[OpenRouter] Dropped reasoning-only chunk because reasoning_mode is disabled"
                                        )

                                # Only yield content if we didn't already yield reasoning from this delta.
                                # This prevents DeepSeek v3.2 from doubling text when it sends both
                                # reasoning_content AND content in the same chunk.
                                if content and (not yielded_reasoning or not allow_reasoning):
                                    yield content
                                elif allow_reasoning and reasoning_pieces and not yielded_reasoning:
                                    # Plaintext reasoning_details support
                                    yield {"type": "reasoning", "content": "".join(reasoning_pieces)}

                                if include_usage and "usage" in data:
                                    yield {"usage": data["usage"]}
                        except json.JSONDecodeError:
                            continue
                        except asyncio.CancelledError:
                            raise
                        except Exception as e:
                            _logger.warning(
                                "OpenRouter stream parse error",
                                extra={"event_type": "fallback_activation", "fallback": "openrouter_stream_parse_error", "error": str(e)},
                            )
                            yield {"error": {"message": str(e)}}
                            return
