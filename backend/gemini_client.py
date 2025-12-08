"""Wrapper around the Google Gemini client for generating chat responses."""

import os
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional

from google import genai
from google.genai import types


def _parse_float_env(name: str) -> Optional[float]:
    try:
        value = os.getenv(name)
        if not value:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_int_env(name: str, default: int) -> int:
    try:
        value = os.getenv(name)
        if value is None or value.strip() == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


@dataclass
class GeminiAttachment:
    data: bytes
    mime_type: str
    filename: Optional[str] = None


class GeminiService:
    API_KEY_PROPERTY_ORDER = [
        "GEMINI_API_KEY",
        "GEMINI_API_KEY_SECONDARY",
        "GEMINI_API_KEY_TERTIARY",
        "GOOGLE_API_KEY",
    ]

    def __init__(self) -> None:
        self.max_history = _parse_int_env("GEMINI_MAX_HISTORY_MESSAGES", 18)
        self._thinking_budget = _parse_float_env("GEMINI_THINKING_BUDGET")
        self._temperature = _parse_float_env("GEMINI_TEMPERATURE")
        self._top_p = _parse_float_env("GEMINI_TOP_P")
        self._top_k = _parse_float_env("GEMINI_TOP_K")
        self._response_mime_type = os.getenv("GEMINI_RESPONSE_MIME_TYPE")

        self._api_key = self._first_valid_api_key()
        # Default to Gemini Flash Lite
        self._default_model = os.getenv("GEMINI_DEFAULT_MODEL", "models/gemini-flash-lite-latest")
        self._light_model = os.getenv("GEMINI_LIGHT_MODEL", "models/gemini-flash-lite-latest")
        # Optional dedicated model for "pro" tier; falls back to Gemini 3 Pro if unset.
        self._pro_model = os.getenv("GEMINI_PRO_MODEL", "models/gemini-3-pro-preview")

        if self._api_key:
            self._client = genai.Client(api_key=self._api_key)
            self._enabled = True
        else:
            self._client = None
            self._enabled = False

    @property
    def available(self) -> bool:
        return self._enabled and self._client is not None

    @property
    def default_model(self) -> str:
        return self._default_model

    @property
    def light_model(self) -> str:
        return self._light_model

    def _first_valid_api_key(self) -> Optional[str]:
        for name in self.API_KEY_PROPERTY_ORDER:
            value = os.getenv(name)
            if value and value.strip() and "your_gemini_api_key_here" not in value.lower():
                return value.strip()
        return None

    def _choose_model(self, override: Optional[str]) -> str:
        """
        Resolve the concrete Gemini model to use.

        The frontend currently passes tier labels like "lite" or "pro"
        instead of full model IDs. To keep that simple on the client, we translate
        those tier labels here into concrete model names.

        Per request:
          - Gray Pro   -> models/gemini-3-pro-preview
          - Gray Lite  -> current light model (env or default)
        """
        if override:
            tier = override.strip().lower()
            if tier in {"lite", "gray-lite"}:
                # Keep Lite mapped to the configured light model.
                return self._light_model
            if tier in {"pro", "gray-pro"}:
                # Hard-coded mapping for Gray Pro.
                return "models/gemini-3-pro-preview"
            # If the override already looks like a full model ID, use it verbatim.
            return override
        # Default when no override is provided: use the configured default.
        return self._default_model

    def _build_context_block(self, workspace_context: Optional[str], time_context: Optional[str]) -> Optional[str]:
        pieces: List[str] = []
        if workspace_context:
            pieces.append(workspace_context.strip())
        if time_context:
            pieces.append(time_context.strip())
        if not pieces:
            return None
        return "\n".join(pieces)

    def _build_system_instruction(
        self,
        system_prompt: Optional[str],
        workspace_context: Optional[str],
        time_context: Optional[str],
    ) -> Optional[str]:
        base_instruction = system_prompt.strip() if system_prompt and system_prompt.strip() else None
        context_block = self._build_context_block(workspace_context, time_context)
        if context_block:
            if base_instruction:
                return f"{base_instruction}\n\nWorkspace context:\n{context_block}"
            return f"Workspace context:\n{context_block}"
        return base_instruction

    def _build_config(
        self,
        system_prompt: Optional[str],
        workspace_context: Optional[str],
        time_context: Optional[str],
        response_schema: Optional[Dict[str, Any]] = None,
        response_mime_type: Optional[str] = None,
        tools: Optional[List[types.Tool]] = None,
        tool_config: Optional[types.ToolConfig] = None,
        reasoning_mode: bool = False,
        model: Optional[str] = None,
    ) -> Optional[types.GenerateContentConfig]:
        config_kwargs: Dict[str, Any] = {}

        system_instruction = self._build_system_instruction(system_prompt, workspace_context, time_context)
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction

        # Determine if this is a Gemini 3 model (uses thinkingLevel, not thinkingBudget)
        # is_gemini_3 = model and "gemini-3" in model.lower()

        # TEMPORARY FIX: Disable explicit thinking_config to resolve "missing thought_signature" error
        # when using tools. The current conversation history reconstruction does not preserve
        # thought parts, causing the API to reject function calls in subsequent turns.
        #
        # Re-enable this logic once history handling supports preserving 'thought' parts.
        
        # if is_gemini_3:
        #     # Gemini 3 Pro always has thinking enabled, include_thoughts gets summaries
        #     config_kwargs["thinking_config"] = types.ThinkingConfig(
        #         thinking_level="high" if reasoning_mode else "low",
        #         include_thoughts=True,  # Enable thought summaries in response
        #     )
        # elif reasoning_mode:
        #     # Gemini 2.5 series: use thinkingBudget
        #     budget = self._thinking_budget if self._thinking_budget is not None else 2048
        #     config_kwargs["thinking_config"] = types.ThinkingConfig(
        #         thinking_budget=budget,
        #         include_thoughts=True,  # Enable thought summaries in response
        #     )
        # elif self._thinking_budget is not None:
        #     pass


        if self._temperature is not None:
            config_kwargs["temperature"] = self._temperature
        if self._top_p is not None:
            config_kwargs["top_p"] = self._top_p
        if self._top_k is not None:
            config_kwargs["top_k"] = self._top_k
        if self._response_mime_type:
            config_kwargs["response_mime_type"] = self._response_mime_type
        if response_mime_type:
            config_kwargs["response_mime_type"] = response_mime_type
        if response_schema:
            config_kwargs["response_json_schema"] = response_schema
        if tools:
            config_kwargs["tools"] = tools
        if tool_config:
            config_kwargs["tool_config"] = tool_config

        return types.GenerateContentConfig(**config_kwargs) if config_kwargs else None

    def _build_contents(
        self,
        conversation_history: Optional[List[Dict[str, Any]]],
        message: str,
        attachments: Optional[List[GeminiAttachment]] = None,
        extra_contents: Optional[List[types.Content]] = None,
    ) -> List[types.Content]:
        contents: List[types.Content] = []

        history = conversation_history or []
        recent_history = history[-self.max_history :] if self.max_history > 0 else history
        for entry in recent_history:
            prepared = self._content_from_entry(entry)
            if prepared:
                contents.append(prepared)

        if attachments:
            for attachment in attachments:
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_bytes(
                                data=attachment.data,
                                mime_type=attachment.mime_type,
                            ),
                        ],
                    )
                )

        user_text = message.strip()
        if user_text:
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=user_text)],
                )
            )
        if extra_contents:
            contents.extend(extra_contents)
        return contents

    @staticmethod
    def _content_from_entry(entry: Dict[str, Any]) -> Optional[types.Content]:
        text_value = entry.get("text")
        if text_value is None:
            return None
        text = str(text_value).strip()
        if not text:
            return None
        raw_role = entry.get("role")
        if raw_role == "assistant":
            role = "model"
        else:
            role = raw_role
        if role not in {"user", "model"}:
            return None
        return types.Content(
            role=role,
            parts=[types.Part.from_text(text=text)],
        )

    async def validate_connection(self, prompt: str = "Gemini validation prompt for the Hackathon backend.") -> types.GenerateContentResponse:
        """Run a minimal Gemini prompt to ensure the API key is valid."""
        if not self.available or not self._client:
            raise RuntimeError("Gemini client is not configured")

        contents = self._build_contents(None, prompt)
        config = types.GenerateContentConfig(temperature=0.42)
        selected_model = self._choose_model(None)

        return await self._client.aio.models.generate_content(
            model=selected_model,
            contents=contents,
            config=config,
        )

    async def generate(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, Any]]],
        workspace_context: Optional[str],
        system_prompt: Optional[str],
        time_context: Optional[str],
        model: Optional[str],
        attachments: Optional[List[GeminiAttachment]] = None,
        extra_contents: Optional[List[types.Content]] = None,
        response_schema: Optional[Dict[str, Any]] = None,
        response_mime_type: Optional[str] = None,
        tools: Optional[List[types.Tool]] = None,
        tool_config: Optional[types.ToolConfig] = None,
        reasoning_mode: bool = False,
    ) -> types.GenerateContentResponse:
        if not self.available or not self._client:
            raise RuntimeError("Gemini client is not configured")

        selected_model = self._choose_model(model)

        effective_tools = tools
        effective_tool_config = tool_config

        contents = self._build_contents(conversation_history, message, attachments, extra_contents)
        config = self._build_config(
            system_prompt,
            workspace_context,
            time_context,
            response_schema=response_schema,
            response_mime_type=response_mime_type,
            tools=effective_tools,
            tool_config=effective_tool_config,
            reasoning_mode=reasoning_mode,
            model=selected_model,
        )

        response = await self._client.aio.models.generate_content(
            model=selected_model,
            contents=contents,
            config=config,
        )
        return response

    async def stream(
        self,
        message: str,
        conversation_history: Optional[List[Dict[str, Any]]],
        workspace_context: Optional[str],
        system_prompt: Optional[str],
        time_context: Optional[str],
        model: Optional[str],
        attachments: Optional[List[GeminiAttachment]] = None,
        extra_contents: Optional[List[types.Content]] = None,
        response_schema: Optional[Dict[str, Any]] = None,
        response_mime_type: Optional[str] = None,
        tools: Optional[List[types.Tool]] = None,
        tool_config: Optional[types.ToolConfig] = None,
        reasoning_mode: bool = False,
        ) -> AsyncIterator[types.GenerateContentResponse]:
        if not self.available or not self._client:
            raise RuntimeError("Gemini client is not configured")

        selected_model = self._choose_model(model)

        effective_tools = tools
        effective_tool_config = tool_config

        contents = self._build_contents(conversation_history, message, attachments, extra_contents)
        config = self._build_config(
            system_prompt,
            workspace_context,
            time_context,
            response_schema=response_schema,
            response_mime_type=response_mime_type,
            tools=effective_tools,
            tool_config=effective_tool_config,
            reasoning_mode=reasoning_mode,
            model=selected_model,
        )

        stream_iter = await self._client.aio.models.generate_content_stream(
            model=selected_model,
            contents=contents,
            config=config,
        )
        async for chunk in stream_iter:
            yield chunk
