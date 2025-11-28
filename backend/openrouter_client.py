"""Wrapper around the OpenRouter API for various LLM models."""

from __future__ import annotations

import os
import httpx
from typing import Any, AsyncIterator, Dict, List, Optional


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
    trimmed = text.strip()
    return trimmed if trimmed else None


class OpenRouterService:
    """Client for OpenRouter API supporting various LLM models."""

    # OpenRouter API endpoint
    BASE_URL = "https://openrouter.ai/api/v1"

    # Model mappings for Pioneer tier models
    MODEL_MAPPINGS = {
        "claude-4.5": "anthropic/claude-sonnet-4.5",
        "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
        "gpt-5.1": "openai/gpt-5.1",
        "deepseek-v3.2": "deepseek/deepseek-v3.2-exp",
        "kimi-k2": "moonshotai/kimi-k2-thinking",
        # Note: Gemini 3 (models/gemini-3-pro-preview) is handled directly via Gemini API, not OpenRouter
        # Default fallback
        "default": "anthropic/claude-sonnet-4.5",
    }

    def __init__(self) -> None:
        self._api_key = _trim(os.getenv("OPENROUTER_API_KEY"))
        self._lite_model = os.getenv("OPENROUTER_LITE_MODEL", "x-ai/grok-4.1-fast:free")
        self._default_model = os.getenv("OPENROUTER_DEFAULT_MODEL", self.MODEL_MAPPINGS["default"])
        self._max_tokens = _int_env("OPENROUTER_MAX_TOKENS", 4096)
        self._max_history = _int_env("OPENROUTER_MAX_HISTORY_MESSAGES", 18)
        self._temperature = _float_env("OPENROUTER_TEMPERATURE", 0.7)
        self._site_url = os.getenv("NEXT_PUBLIC_SITE_URL", "https://gray.alignment.id")
        self._site_name = os.getenv("OPENROUTER_SITE_NAME", "Gray")

    @property
    def available(self) -> bool:
        return self._api_key is not None and len(self._api_key) > 0

    @property
    def lite_model(self) -> str:
        return self._lite_model

    def _resolve_model(self, model: Optional[str]) -> str:
        """Resolve model name to OpenRouter model ID."""
        if not model:
            return self._default_model
        
        # Normalize model name
        model_lower = model.strip().lower()
        
        # Handle specific Grok free model access
        if model_lower in {"grok", "grok-lite"}:
            return self._lite_model
        
        # Handle tier mappings
        if model_lower in {"lite", "gray-lite"}:
            return self._lite_model
        
        # Check if it's a shorthand key
        if model in self.MODEL_MAPPINGS:
            return self.MODEL_MAPPINGS[model]
        
        # Otherwise return as-is (assume it's already a full model ID)
        return model

    def _build_messages(
        self,
        conversation_history: Optional[List[Dict[str, Any]]],
        message: str,
    ) -> List[Dict[str, Any]]:
        """Build messages array from conversation history and current message."""
        history = conversation_history or []
        recent_history = history[-self._max_history :] if self._max_history > 0 else history
        payload: List[Dict[str, Any]] = []
        
        for entry in recent_history:
            role = entry.get("role")
            text = _trim(str(entry.get("text") or ""))
            if not text or role not in {"user", "model"}:
                continue
            # OpenRouter uses "assistant" for model responses
            openrouter_role = "assistant" if role == "model" else "user"
            payload.append({"role": openrouter_role, "content": text})
        
        trimmed_message = _trim(message)
        if trimmed_message:
            payload.append({"role": "user", "content": trimmed_message})
        
        return payload

    def _build_system_prompt(
        self,
        system_prompt: Optional[str],
        workspace_context: Optional[str],
        time_context: Optional[str],
    ) -> Optional[str]:
        """Construct system prompt with optional context."""
        pieces: List[str] = []
        base = _trim(system_prompt)
        if base:
            pieces.append(base)
        
        context_lines: List[str] = []
        if workspace_context and workspace_context.strip():
            context_lines.append(workspace_context.strip())
        if time_context and time_context.strip():
            context_lines.append(time_context.strip())
        
        if context_lines:
            pieces.append("<context>\n" + "\n".join(context_lines) + "\n</context>")
        
        return "\n\n".join(pieces) if pieces else None

    def _build_headers(self) -> Dict[str, str]:
        """Build request headers for OpenRouter API."""
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        
        # Add optional OpenRouter-specific headers for better analytics
        if self._site_url:
            headers["HTTP-Referer"] = self._site_url
        if self._site_name:
            headers["X-Title"] = self._site_name
        
        return headers

    async def generate(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None,
        workspace_context: Optional[str] = None,
        system_prompt: Optional[str] = None,
        time_context: Optional[str] = None,
        model: Optional[str] = None,
        include_usage: bool = False,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate a complete response from OpenRouter."""
        if not self.available:
            raise RuntimeError("OpenRouter client is not configured (missing API key)")

        resolved_model = self._resolve_model(model)
        messages = self._build_messages(conversation_history, message)
        
        if not messages:
            messages = [{"role": "user", "content": message}]

        # Build request payload
        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "max_tokens": self._max_tokens,
            "temperature": self._temperature,
        }

        if include_usage:
            payload["include_usage"] = True
        if response_format:
            payload["response_format"] = response_format

        # Add system prompt if provided
        system = self._build_system_prompt(system_prompt, workspace_context, time_context)
        if system:
            # Insert system message at the beginning
            payload["messages"].insert(0, {"role": "system", "content": system})

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/chat/completions",
                headers=self._build_headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract content from response
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            
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
    ) -> AsyncIterator[str | Dict[str, Any]]:
        """Stream response chunks from OpenRouter.
        
        Yields:
            str: Content chunks
            dict: Usage statistics (if include_usage=True and available)
        """
        if not self.available:
            raise RuntimeError("OpenRouter client is not configured (missing API key)")

        resolved_model = self._resolve_model(model)
        messages = self._build_messages(conversation_history, message)
        
        if not messages:
            messages = [{"role": "user", "content": message}]

        # Build request payload
        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "max_tokens": self._max_tokens,
            "temperature": self._temperature,
            "stream": True,  # Enable streaming
        }

        if include_usage:
            payload["include_usage"] = True
        if response_format:
            payload["response_format"] = response_format

        # Add system prompt if provided
        system = self._build_system_prompt(system_prompt, workspace_context, time_context)
        if system:
            payload["messages"].insert(0, {"role": "system", "content": system})

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/chat/completions",
                headers=self._build_headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if not line or line.strip() == "":
                        continue
                    
                    # OpenRouter uses SSE format: "data: {...}"
                    if line.startswith("data: "):
                        data_str = line[6:]  # Remove "data: " prefix
                        
                        # Check for stream end marker
                        if data_str.strip() == "[DONE]":
                            break
                        
                        try:
                            import json
                            data = json.loads(data_str)
                            
                            # Extract delta content
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
                                
                                # Check for usage stats in the final chunk or separate chunk
                                if include_usage and "usage" in data:
                                    yield {"usage": data["usage"]}
                        except json.JSONDecodeError:
                            # Skip malformed lines
                            continue
