import os
import json
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx


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


class GroqService:
  """Minimal Groq client for streaming OpenAI-compatible chat responses."""

  BASE_URL = "https://api.groq.com/openai/v1"

  def __init__(self) -> None:
    self._api_key = _trim(os.getenv("GROQ_API_KEY"))
    self._lite_model = os.getenv("GROQ_LITE_MODEL", "llama-3.1-8b-instant")
    self._default_model = os.getenv("GROQ_DEFAULT_MODEL", self._lite_model)
    self._max_tokens = _int_env("GROQ_MAX_TOKENS", 4096)
    self._temperature = _float_env("GROQ_TEMPERATURE", 0.6)
    self._history_window = _int_env("GROQ_MAX_HISTORY_MESSAGES", 12)
    self._connect_timeout = _float_env("GROQ_TIMEOUT_SECONDS", 3.0)
    self._read_timeout = _float_env("GROQ_READ_TIMEOUT_SECONDS", 40.0)
    self._client: Optional[httpx.AsyncClient] = None

  @property
  def available(self) -> bool:
    return bool(self._api_key and len(self._api_key) > 10)

  @property
  def lite_model(self) -> str:
    return self._lite_model

  def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
      timeout = httpx.Timeout(self._connect_timeout, read=self._read_timeout)
      self._client = httpx.AsyncClient(timeout=timeout)
    return self._client

  def _headers(self) -> Dict[str, str]:
    if not self._api_key:
      raise RuntimeError("Groq API key missing (set GROQ_API_KEY)")
    return {
      "Authorization": f"Bearer {self._api_key}",
      "Content-Type": "application/json",
    }

  def _resolve_model(self, model: Optional[str]) -> str:
    candidate = _trim(model)
    if candidate:
      normalized = candidate.lower()
      # Treat tier aliases like "lite"/"gray-lite" as pointers to the configured lite model.
      if normalized in {"lite", "gray-lite"}:
        return self._lite_model
      return candidate
    return self._default_model

  def _build_messages(
    self, conversation_history: Optional[List[Dict[str, Any]]], message: str
  ) -> List[Dict[str, Any]]:
    history = conversation_history or []
    recent_history = history[-self._history_window :] if self._history_window > 0 else history
    payload: List[Dict[str, Any]] = []

    for entry in recent_history:
      role = entry.get("role")
      text = _trim(str(entry.get("text") or ""))
      if not text or role not in {"user", "model", "assistant"}:
        continue
      openai_role = "assistant" if role in {"model", "assistant"} else "user"
      payload.append({"role": openai_role, "content": text})

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

  async def generate(
    self,
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
  ) -> str:
    if not self.available:
      raise RuntimeError("Groq client is not configured (missing GROQ_API_KEY)")

    resolved_model = self._resolve_model(model)
    messages = self._build_messages(conversation_history, message)
    if not messages:
      messages = [{"role": "user", "content": message}]

    payload: Dict[str, Any] = {
      "model": resolved_model,
      "messages": messages,
      "max_completion_tokens": max_tokens or self._max_tokens,
      "temperature": temperature if temperature is not None else self._temperature,
      "stream": False,
    }

    system = self._build_system_prompt(system_prompt, workspace_context, time_context)
    if system:
      payload["messages"].insert(0, {"role": "system", "content": system})

    client = self._get_client()
    response = await client.post(
      f"{self.BASE_URL}/chat/completions",
      headers=self._headers(),
      json=payload,
    )
    try:
      response.raise_for_status()
    except httpx.HTTPStatusError as exc:
      detail = exc.response.text
      raise httpx.HTTPStatusError(
        f"{exc} | body={detail}",
        request=exc.request,
        response=exc.response,
      ) from exc
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
      return ""
    message_data = choices[0].get("message") or {}
    return message_data.get("content") or ""

  async def stream(
    self,
    message: str,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    workspace_context: Optional[str] = None,
    system_prompt: Optional[str] = None,
    time_context: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
  ) -> AsyncIterator[str]:
    if not self.available:
      raise RuntimeError("Groq client is not configured (missing GROQ_API_KEY)")

    resolved_model = self._resolve_model(model)
    messages = self._build_messages(conversation_history, message)
    if not messages:
      messages = [{"role": "user", "content": message}]

    payload: Dict[str, Any] = {
      "model": resolved_model,
      "messages": messages,
      "max_completion_tokens": max_tokens or self._max_tokens,
      "temperature": temperature if temperature is not None else self._temperature,
      "stream": True,
      "top_p": 1,
    }

    system = self._build_system_prompt(system_prompt, workspace_context, time_context)
    if system:
      payload["messages"].insert(0, {"role": "system", "content": system})

    client = self._get_client()
    async with client.stream(
      "POST",
      f"{self.BASE_URL}/chat/completions",
      headers=self._headers(),
      json=payload,
    ) as response:
      try:
        response.raise_for_status()
      except httpx.HTTPStatusError as exc:
        raw = await exc.response.aread()
        detail = raw.decode("utf-8", "ignore")
        raise httpx.HTTPStatusError(
          f"{exc} | body={detail}",
          request=exc.request,
          response=exc.response,
        ) from exc

      async for line in response.aiter_lines():
          if not line:
            continue

          data_str = line
          if data_str.startswith("data:"):
            data_str = data_str[5:].lstrip()

          if data_str.strip() == "[DONE]":
            break

          try:
            data = json.loads(data_str)
          except json.JSONDecodeError:
            continue

          choices = data.get("choices") or []
          if not choices:
            continue

          delta = choices[0].get("delta") or {}
          content = delta.get("content")
          if content:
            yield content
