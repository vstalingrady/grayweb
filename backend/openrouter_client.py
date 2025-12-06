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

    @property
    def available(self) -> bool:
        return self._enabled and self._api_key is not None and len(self._api_key) > 0

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
            if hasattr(tool, "function_declarations"):
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
            "max_tokens": self._max_tokens,
            "temperature": self._temperature,
            # OpenRouter optimizations: https://openrouter.ai/docs/provider-routing
            "provider": {
                "sort": "price",  # Prioritize cheapest provider
                "allow_fallbacks": True,
            },
            # Compress long contexts automatically (middle-out)
            # https://openrouter.ai/docs/transforms
            "transforms": ["middle-out"],
        }

        # Request usage stats (includes cache_discount for prompt caching)
        if include_usage:
            payload["usage"] = {"include": True}
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
    ) -> AsyncIterator[str | Dict[str, Any]]:
        """Stream response chunks from OpenRouter.
        
        Yields:
            str: Content chunks
            dict: Usage statistics (if include_usage=True and available)
        """
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
            "max_tokens": self._max_tokens,
            "temperature": self._temperature,
            "stream": True,  # Enable streaming
            # OpenRouter optimizations: https://openrouter.ai/docs/provider-routing
            "provider": {
                "sort": "price",  # Prioritize cheapest provider
                "allow_fallbacks": True,
            },
            # Compress long contexts automatically (middle-out)
            # https://openrouter.ai/docs/transforms
            "transforms": ["middle-out"],
        }

        # Request usage stats (includes cache_discount for prompt caching)
        if include_usage:
            payload["usage"] = {"include": True}
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
            payload["messages"].insert(0, {"role": "system", "content": system})

        async with httpx.AsyncClient(timeout=120.0) as client:
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
                                
                                if "choices" in data and len(data["choices"]) > 0:
                                    delta = data["choices"][0].get("delta", {})
                                    content = delta.get("content")
                                    tool_calls = delta.get("tool_calls")
                                    
                                    if tool_calls:
                                        yield {"tool_calls": tool_calls}
                                    
                                    reasoning_pieces = []
                                    if not content:
                                        details = delta.get("reasoning_details") or []
                                        if isinstance(details, list):
                                            for item in details:
                                                if isinstance(item, dict):
                                                    txt = item.get("text")
                                                    if txt:
                                                        reasoning_pieces.append(txt)
                                    
                                    if content:
                                        yield content
                                    elif reasoning_pieces:
                                        yield "".join(reasoning_pieces)

                                    if include_usage and "usage" in data:
                                        yield {"usage": data["usage"]}
                            except Exception:
                                continue
