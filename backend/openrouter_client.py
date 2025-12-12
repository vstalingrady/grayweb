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

    # Model mappings for Pioneer tier models (using real OpenRouter model IDs)
    # These are the default (non-reasoning) model variants
    MODEL_MAPPINGS = {
        # Anthropic models
        "claude-4": "anthropic/claude-sonnet-4",
        "claude-sonnet-4": "anthropic/claude-sonnet-4",
        "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
        "claude-opus-4.5": "anthropic/claude-opus-4.5",
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
        "kimi-k2-thinking": "moonshotai/kimi-k2-thinking",  # Always-reasoning variant
        # xAI Grok models
        "grok-4": "x-ai/grok-4.1-fast",
        "grok-4.1": "x-ai/grok-4.1-fast",
        "grok-4.1-fast": "x-ai/grok-4.1-fast",
        "grok-3": "x-ai/grok-3",
        "grok-2": "x-ai/grok-2-1212",
        # Google Gemini models (via OpenRouter)
        "gemini-3-pro": "google/gemini-3-pro-preview",
        "gemini-2.5-flash": "google/gemini-2.5-flash-preview-09-2025",
        # Default fallback
        "default": "anthropic/claude-sonnet-4.5",
    }

    # Models that have separate reasoning variants
    # Maps non-reasoning model ID -> reasoning model ID
    # NOTE: Only for models where reasoning requires a DIFFERENT model ID
    REASONING_MODEL_VARIANTS = {
        "openai/gpt-5.2-chat": "openai/gpt-5.2",  # gpt-5.2 is the reasoning variant
        "moonshotai/kimi-k2-0905": "moonshotai/kimi-k2-thinking",  # kimi-k2-thinking is the reasoning variant
        # DeepSeek v3.2 uses the reasoning param, NOT a separate model
        # Grok models handle reasoning via the reasoning param
        # Anthropic models handle reasoning via extended thinking, not separate model
    }

    # Reverse mapping: reasoning model -> non-reasoning model
    # Used to downgrade when reasoning_mode is False but user selected thinking variant
    REVERSE_REASONING_VARIANTS = {
        "openai/gpt-5.2": "openai/gpt-5.2-chat",
        "moonshotai/kimi-k2-thinking": "moonshotai/kimi-k2-0905",
    }

    # Models where reasoning is ALWAYS on (toggle should be grayed out in frontend)
    # These models don't need/support the reasoning param - they always reason
    ALWAYS_REASONING_MODELS = {
        "deepseek/deepseek-v3.2-speciale",  # Speciale variant always reasons
        "openai/gpt-5.2",  # The reasoning variant of gpt-5.2
        "openai/gpt-5.2-pro",
        "moonshotai/kimi-k2-thinking",  # Kimi thinking model always reasons
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
        "anthropic/claude-opus-4.5": 200_000,
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
        "moonshotai/kimi-k2-0905": 262_144,
        "moonshotai/kimi-k2-thinking": 262_144,
        # xAI Grok models
        "x-ai/grok-4.1-fast": 2_000_000,  # 2M context
        "x-ai/grok-3": 131_072,
        "x-ai/grok-2-1212": 131_072,
        # Google Gemini (via OpenRouter)
        "google/gemini-3-pro-preview": 1_048_576,  # 1M context
        "google/gemini-2.5-flash-preview-09-2025": 1_048_576,  # 1M context
    }

    @classmethod
    def get_model_context_limit(cls, model_id: str) -> int:
        """Get the context limit for a specific model. Returns 2M if not found."""
        return cls.MODEL_CONTEXT_LIMITS.get(model_id, 2_000_000)

    def __init__(self) -> None:
        self._api_key = _trim(os.getenv("OPENROUTER_API_KEY"))
        self._enabled = (os.getenv("OPENROUTER_ENABLED") or "true").strip().lower() not in {
            "0",
            "false",
            "no",
            "off",
        }
        self._lite_model = os.getenv("OPENROUTER_LITE_MODEL", "x-ai/grok-4.1-fast")
        self._default_model = os.getenv("OPENROUTER_DEFAULT_MODEL", self.MODEL_MAPPINGS["default"])
        self._max_tokens = _int_env("OPENROUTER_MAX_TOKENS", 4096)
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
            self._client = httpx.AsyncClient(timeout=120.0)
        return self._client

    async def close(self) -> None:
        """Close the shared HTTP client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    @property
    def available(self) -> bool:
        return self._enabled and self._api_key is not None and len(self._api_key) > 0

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
        if not model:
            base_model = self._default_model
        else:
            # Normalize model name
            model_lower = model.strip().lower()
            
            # Handle specific Grok free model access
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
        
        # If reasoning mode is enabled, check if this model has a reasoning variant
        if reasoning_mode and base_model in self.REASONING_MODEL_VARIANTS:
            return self.REASONING_MODEL_VARIANTS[base_model]
        
        # If reasoning mode is disabled but user selected a thinking variant,
        # downgrade to the non-reasoning base model
        if not reasoning_mode and base_model in self.REVERSE_REASONING_VARIANTS:
            return self.REVERSE_REASONING_VARIANTS[base_model]
        
        return base_model

    def _history_window_for_model(self, resolved_model: str) -> int:
        """Pick an appropriate history window based on the target model."""
        if resolved_model == self._lite_model:
            return self._max_history_lite
        return self._max_history_premium or self._max_history_lite

    def _build_messages(
        self,
        conversation_history: Optional[List[Dict[str, Any]]],
        message: str,
        history_limit: int,
    ) -> List[Dict[str, Any]]:
        """Build messages array from conversation history and current message."""
        history = conversation_history or []
        recent_history = history[-history_limit:] if history_limit > 0 else history
        payload: List[Dict[str, Any]] = []
        
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
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[str] = "auto",
        plugins: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Generate a complete response from OpenRouter."""
        if not self.available:
            raise RuntimeError("OpenRouter client is not configured (missing API key)")

        resolved_model = self._resolve_model(model)
        history_limit = self._history_window_for_model(resolved_model)
        messages = self._build_messages(conversation_history, message, history_limit)
        
        if not messages:
            messages = [{"role": "user", "content": message}]

        # Build request payload
        payload: Dict[str, Any] = {
            "model": resolved_model,
            "messages": messages,
            "temperature": self._temperature,
            # OpenRouter optimizations: https://openrouter.ai/docs/provider-routing
            "provider": {
                "sort": "price",  # Prioritize cheapest provider
                "allow_fallbacks": True,
            },
        }

        # Request usage stats (OpenRouter uses stream_options for this)
        if include_usage:
            payload["stream_options"] = {"include_usage": True}
        if response_format:
            payload["response_format"] = response_format
            
        openai_tools = self._convert_tools_to_openai_format(tools)
        if openai_tools:
            payload["tools"] = openai_tools
            if tool_choice:
                payload["tool_choice"] = tool_choice

        # Add plugins for web search, etc.
        if plugins:
            payload["plugins"] = plugins

        # Add system prompt if provided
        system = self._build_system_prompt(system_prompt, workspace_context, time_context)
        if system:
            # Insert system message at the beginning
            payload["messages"].insert(0, {"role": "system", "content": system})

        client = await self._get_client()
        response = await client.post(
            f"{self.BASE_URL}/chat/completions",
            headers=self._build_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        
        # Extract content from response
        if "choices" in data and len(data["choices"]) > 0:
            choice = data["choices"][0]
            message_data = choice.get("message", {})
            
            # Check for tool calls
            if message_data.get("tool_calls"):
                # For simple generate, we might just return the tool calls as a special response
                # or handle them. Since this function returns str, we might need to serialize
                # the tool calls or handle this differently in the caller.
                # For now, let's return a JSON string representation of tool calls if content is empty
                import json
                return json.dumps({"tool_calls": message_data["tool_calls"]})
            
            return message_data.get("content") or ""
        
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
            f"time_ctx_len={len(time_context or '')}"
        )
        if system_prompt:
            # Log first 200 chars of system prompt to see what's being used
            _logger.info(f"[OpenRouter.stream] system_prompt_preview: {(system_prompt or '')[:200]}...")
        
        if not self.available:
            raise RuntimeError("OpenRouter client is not configured (missing API key)")

        # Resolve model with reasoning mode to get the correct variant
        # e.g., openai/gpt-5.2-chat -> openai/gpt-5.2 when reasoning_mode=True
        resolved_model = self._resolve_model(model, reasoning_mode=reasoning_mode)
        history_limit = self._history_window_for_model(resolved_model)
        messages = self._build_messages(conversation_history, message, history_limit)
        
        if not messages:
            messages = [{"role": "user", "content": message}]

        # Build provider preferences with routing logic
        provider_preferences = {
            "sort": "price",
            "allow_fallbacks": True,
        }
        
        # Apply provider routing overrides
        resolved_lower = resolved_model.lower()
        if "deepseek" in resolved_lower:
            provider_preferences["order"] = ["DeepSeek"]
        elif "moonshot" in resolved_lower or "kimi" in resolved_lower:
            provider_preferences["order"] = ["Fireworks"]

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

        # Request usage stats (OpenRouter uses stream_options for this)
        if include_usage:
            payload["stream_options"] = {"include_usage": True}
        if response_format:
            payload["response_format"] = response_format

        openai_tools = self._convert_tools_to_openai_format(tools)
        if openai_tools:
            payload["tools"] = openai_tools
            if tool_choice:
                payload["tool_choice"] = tool_choice

        # Add plugins for web search, etc.
        if plugins:
            payload["plugins"] = plugins

        # Add reasoning mode if enabled
        # Note: Per xAI docs, grok-4 and grok-4-fast don't support reasoning_effort param
        # Only grok-3-mini supports it. Grok-4 has reasoning built-in.
        if reasoning_mode:
            # Skip for grok-4 models which error on reasoning param
            is_grok4 = "grok-4" in resolved_model.lower() or "grok4" in resolved_model.lower()
            if not is_grok4:
                payload["reasoning"] = {"effort": "high"}
                _logger.info(f"[OpenRouter] Added reasoning param to payload for model {resolved_model}")
            else:
                _logger.info(f"[OpenRouter] Skipped reasoning param for grok-4 model: {resolved_model}")

        # Add system prompt if provided
        system = self._build_system_prompt(system_prompt, workspace_context, time_context)
        if system:
            payload["messages"].insert(0, {"role": "system", "content": system})

        client = await self._get_client()
        async with client.stream(
            "POST",
            f"{self.BASE_URL}/chat/completions",
            headers=self._build_headers(),
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
                                
                                if tool_calls:
                                    yield {"tool_calls": tool_calls}
                                
                                # Handle reasoning content - both plaintext and encrypted
                                # Track if we yielded reasoning to avoid double-yielding content
                                reasoning = delta.get("reasoning") or delta.get("reasoning_content")
                                yielded_reasoning = False
                                if reasoning:
                                    yield {"type": "reasoning", "content": reasoning}
                                    yielded_reasoning = True
                                
                                # Handle reasoning_details (may contain encrypted xAI reasoning)
                                reasoning_pieces = []
                                details = delta.get("reasoning_details") or []
                                if isinstance(details, list):
                                    for item in details:
                                        if isinstance(item, dict):
                                            # Check for encrypted reasoning (xAI/Grok)
                                            if item.get("type") == "reasoning.encrypted":
                                                # Emit a thinking indicator for encrypted reasoning
                                                yield {"type": "reasoning_active", "encrypted": True}
                                            # Check for plaintext reasoning
                                            txt = item.get("text")
                                            if txt:
                                                reasoning_pieces.append(txt)
                                
                                # Only yield content if we didn't already yield reasoning from this delta
                                # This prevents DeepSeek v3.2 from doubling text when it sends both
                                # reasoning_content AND content in the same chunk
                                if content and not yielded_reasoning:
                                    yield content
                                elif reasoning_pieces and not yielded_reasoning:
                                    # Plaintext reasoning_details support
                                    yield {"type": "reasoning", "content": "".join(reasoning_pieces)}

                                if include_usage and "usage" in data:
                                    yield {"usage": data["usage"]}
                        except json.JSONDecodeError:
                            continue
                        except Exception as e:
                            yield {"error": {"message": str(e)}}
                            return
