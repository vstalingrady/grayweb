"""Minimal wrapper around the Anthropic Messages API."""

from __future__ import annotations

import os
from typing import Any, AsyncIterator, Dict, List, Optional

from anthropic import AsyncAnthropic


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


class AnthropicService:
  """Small helper around the async Anthropic client."""

  def __init__(self) -> None:
    self._api_key = _trim(os.getenv("ANTHROPIC_API_KEY"))
    self._client = AsyncAnthropic(api_key=self._api_key) if self._api_key else None
    self._default_model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620")
    self._max_tokens = _int_env("ANTHROPIC_MAX_TOKENS", 1024)
    self._max_history = _int_env("ANTHROPIC_MAX_HISTORY_MESSAGES", 18)
    self._temperature = _float_env("ANTHROPIC_TEMPERATURE", 0.7)

  @property
  def available(self) -> bool:
    return self._client is not None

  def _build_messages(
      self,
      conversation_history: Optional[List[Dict[str, Any]]],
      message: str,
  ) -> List[Dict[str, Any]]:
    history = conversation_history or []
    recent_history = history[-self._max_history :] if self._max_history > 0 else history
    payload: List[Dict[str, Any]] = []
    for entry in recent_history:
      role = entry.get("role")
      text = _trim(str(entry.get("text") or ""))
      if not text or role not in {"user", "model"}:
        continue
      anthropic_role = "assistant" if role == "model" else "user"
      payload.append({"role": anthropic_role, "content": text})
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
      context_lines.append(f"Local time context: {time_context.strip()}")
    if context_lines:
      pieces.append("Workspace context:\n" + "\n".join(context_lines))
    return "\n\n".join(pieces) if pieces else None

  async def generate(
      self,
      message: str,
      conversation_history: Optional[List[Dict[str, Any]]] = None,
      workspace_context: Optional[str] = None,
      system_prompt: Optional[str] = None,
      time_context: Optional[str] = None,
      model: Optional[str] = None,
  ) -> str:
    if not self._client:
      raise RuntimeError("Anthropic client is not configured")
    payload = self._build_messages(conversation_history, message)
    if not payload:
      payload = [{"role": "user", "content": message}]
    response = await self._client.messages.create(
        model=model or self._default_model,
        max_tokens=self._max_tokens,
        temperature=self._temperature,
        system=self._build_system_prompt(system_prompt, workspace_context, time_context),
        messages=payload,
    )
    return "".join(block.text for block in response.content if getattr(block, "text", None))

  async def stream(
      self,
      message: str,
      conversation_history: Optional[List[Dict[str, Any]]] = None,
      workspace_context: Optional[str] = None,
      system_prompt: Optional[str] = None,
      time_context: Optional[str] = None,
      model: Optional[str] = None,
  ) -> AsyncIterator[str]:
    if not self._client:
      raise RuntimeError("Anthropic client is not configured")
    payload = self._build_messages(conversation_history, message)
    if not payload:
      payload = [{"role": "user", "content": message}]
    stream = await self._client.messages.stream(
        model=model or self._default_model,
        max_tokens=self._max_tokens,
        temperature=self._temperature,
        system=self._build_system_prompt(system_prompt, workspace_context, time_context),
        messages=payload,
    )
    async with stream as events:
      async for event in events:
        if event.type == "content_block_delta" and event.delta.type == "text_delta":
          yield event.delta.text or ""
