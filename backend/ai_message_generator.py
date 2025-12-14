"""
AI Message Generator for Proactive Notifications

This module is responsible for generating the *text* of proactive check-ins.
It uses Grok (via OpenRouter) to improvise each message directly. If generation fails, the
error is logged and no message is sent.
"""

import os
import re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional, AsyncGenerator
import json
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger("backend.ai_message_generator")
import databases

try:
    from backend.openrouter_client import OpenRouterService
    from backend.gemini_client import GeminiService
    from backend.usage_tracker import UsageTracker, UsageLimitExceeded
except ImportError:
    from openrouter_client import OpenRouterService
    from gemini_client import GeminiService
    from usage_tracker import UsageTracker, UsageLimitExceeded


class AIMessageGenerator:
    """Generates AI-based proactive messages for Gray."""

    def __init__(self) -> None:
        self.openrouter = OpenRouterService()
        self.gemini = GeminiService()
        self.prompts = {}
        # Load the shared Gray persona prompt once so proactivity matches
        # the main chat experience. Falls back to a local default if the
        # config file is missing.
        try:
            # Use centralized environment detection
            try:
                from backend.env_utils import ROOT_DIR
            except ImportError:
                from env_utils import ROOT_DIR
            prompts_path = ROOT_DIR / "public" / "system-prompts.json"
            raw = prompts_path.read_text(encoding="utf-8")
            self.prompts = json.loads(raw)
        except Exception as e:
            logger.error(f"CRITICAL: Failed to load system-prompts.json: {e}")
        
        self.persona_prompt = self.prompts["chat"]  # No fallback - must exist
        
        if self.openrouter.available:
            pass  # Using Grok for proactive messaging
        elif self.gemini.available:
            pass  # Using Gemini fallback
        # else: No AI provider available; proactive messages will be skipped

    async def generate_conversation_summary(
        self,
        messages: List[Dict[str, Any]],
        max_length: int = 500
    ) -> Optional[str]:
        """
        Compress a list of conversation messages into a dense summary.
        Returns: The summary string, or None if generation failed.
        """
        if not messages:
            return None
            
        # Format conversation for the model
        transcript_parts = []
        for msg in messages:
            role = str(msg.get("role", "unknown")).upper()
            content = str(msg.get("content") or msg.get("text") or "").strip()
            if content:
                transcript_parts.append(f"{role}: {content}")
        
        transcript = "\n".join(transcript_parts)
        
        base_prompt = self.prompts["proactivity_summary"]  # No fallback - must exist
        
        system_prompt = (
            f"{self.persona_prompt}\n\n"
            f"{base_prompt}\n"
            f"Keep the summary under {max_length} words."
        )

        try:
            if self.gemini and self.gemini.available:
                response = await self.gemini.generate(
                    message=f"Here is the conversation to summarize:\n\n{transcript}",
                    system_prompt=system_prompt,
                    model="models/gemini-flash-latest",
                    conversation_history=None,
                    workspace_context=None,
                    time_context=None
                )
                return response.text if response else None
        except Exception as e:
            logger.warning("Summary generation failed: %s", e)
            return None
            
        return None

    async def generate_daily_briefing(
        self,
        user_id: int,
        dashboard_pulse: Dict[str, Any],
        proactivity: Dict[str, Any],
        timezone_str: str = "UTC+00:00",
        reason: Optional[str] = None,
        tone: Optional[str] = None,
        decision_context: Optional[Dict[str, Any]] = None,
        profile_context: Optional[str] = None,
        custom_instructions: Optional[str] = None,
        chat_context: Optional[str] = None,
        db: Optional[databases.Database] = None,
    ) -> tuple[str, str]:
        """
        Generate a personalized daily check-in message
        Returns: (title, message)
        """
        # Extract data from dashboard pulse
        plans = dashboard_pulse.get("plans", [])
        habits = dashboard_pulse.get("habits", [])
        date_key = dashboard_pulse.get("date_key", "")

        # Build a tiny, high-level context string for the model.
        plans_count = len(plans)
        habits_count = len(habits)
        cadence = (proactivity.get("cadence") or "").strip().lower()
        label = proactivity.get("label") or "Check-in"

        context_summary_parts: List[str] = []
        if plans_count:
            context_summary_parts.append(f"{plans_count} active plans")
        if habits_count:
            context_summary_parts.append(f"{habits_count} habits tracked")
        if not context_summary_parts:
            context_summary_parts.append("no structured plans or habits yet")
        context_summary = ", ".join(context_summary_parts)

        meta_line = f"Cadence: {cadence or 'unspecified'}. Label: {label}. Date key: {date_key or 'today'}."
        context_chunks: List[str] = [f"User context: {context_summary}. {meta_line}"]
        if reason:
            context_chunks.append(f"Trigger reason: {reason}")
        if tone:
            context_chunks.append(f"Requested tone: {tone}")
        if decision_context:
            context_chunks.append(f"Decision context: {decision_context}")
        if profile_context:
            context_chunks.append(f"Profile summary: {profile_context.strip()}")
        if custom_instructions:
            context_chunks.append(f"Custom instructions from the user:\n{custom_instructions.strip()}")
        if chat_context:
            context_chunks.append(f"Recent chat snippets:\n{chat_context.strip()}")

        user_context = "\n\n".join(part for part in context_chunks if part.strip())

        base_prompt = self.prompts["proactivity_daily"]  # No fallback - must exist

        system_prompt = (
            f"{self.persona_prompt}\n\n"
            f"{base_prompt}"
        )

        if not self.gemini or not self.gemini.available:
            raise RuntimeError("Gemini is not configured for proactive messaging")

        if db:
            tracker = UsageTracker(db)
            try:
                await tracker.check_limits(user_id)
            except UsageLimitExceeded as e:
                logger.warning("Usage limit exceeded for user %d: %s", user_id, e)
                raise RuntimeError(f"Usage limit exceeded: {e}")

        try:
            # Give the model temporal context for the check-in in the user's local timezone.
            tzinfo = self._resolve_timezone(timezone_str)
            now_local = datetime.now(tzinfo)
            time_context = (
                f"User's local time is {now_local.isoformat()} "
                f"(timezone: {timezone_str}). "
                f"This proactive check-in is scheduled for their current local time "
                f"based on cadence '{cadence or 'unspecified'}' and label '{label}'. "
                "Respond as if it's that local time and avoid referencing UTC unless the user asks."
            )

            gemini_response = await self.gemini.generate(
                message=user_context,
                conversation_history=None,
                workspace_context=None,
                system_prompt=system_prompt,
                time_context=time_context,
                model="models/gemini-flash-latest"
            )
            
            # Extract text from Gemini response
            if gemini_response and gemini_response.candidates:
                response = gemini_response.text
            else:
                raise RuntimeError("Empty response from Gemini")

            if db and hasattr(gemini_response, "usage_metadata"):
                tracker = UsageTracker(db)
                await tracker.track_usage(
                    user_id,
                    gemini_response.usage_metadata.prompt_token_count or 0,
                    gemini_response.usage_metadata.candidates_token_count or 0
                )

        except Exception as error:
            raise RuntimeError(f"Gemini proactive message generation failed: {error}") from error

        if isinstance(response, str):
            text = response
        else:
            text = getattr(response, "text", "") or ""
        if not text and getattr(response, "candidates", None):
            candidate = response.candidates[0]
            content = getattr(candidate, "content", None)
            if content:
                parts_list = getattr(content, "parts", None)
                if parts_list:
                    for part in parts_list:
                        value = getattr(part, "text", None)
                        if value:
                            text += value

        cleaned = (text or "").strip()
        if not cleaned:
            raise RuntimeError("Grok proactive message generation returned empty content")

        # Post-process to avoid stale or hard-coded calendar dates like
        # "Tuesday, November 12th" that can confuse users when the actual date
        # is different. We normalize these into a simple "today" phrasing.
        def _strip_explicit_dates(value: str) -> str:
            patterns = [
                # "today, November 12th", "today, November 12th, 2025"
                r"\btoday,\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?",
                # "today, mid-November", "today, early November"
                r"\btoday,\s+(?:early|mid|late)[-\s]?(?:January|February|March|April|May|June|July|August|September|October|November|December)",
                # "on this Tuesday, November 12th", "this Tuesday, November 12th"
                r"\b(?:on\s+)?this\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?",
            ]
            result = value
            for pattern in patterns:
                result = re.sub(pattern, "today", result, flags=re.IGNORECASE)
            return result

        cleaned = _strip_explicit_dates(cleaned)

        return label, cleaned

    @staticmethod
    def _resolve_timezone(timezone_str: str):
        """
        Resolve a timezone string to tzinfo.
        Accepts IANA names (e.g., 'Asia/Jakarta') and fixed offsets like 'UTC+07:00'.
        """
        normalized = (timezone_str or "").strip()
        if not normalized:
            return timezone.utc
        try:
            return ZoneInfo(normalized)
        except Exception:
            match = re.match(r"^(?:UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$", normalized, re.IGNORECASE)
            if match:
                sign = 1 if match.group(1) == "+" else -1
                hours = int(match.group(2))
                minutes = int(match.group(3) or "0")
                return timezone(sign * timedelta(hours=hours, minutes=minutes))
        return timezone.utc

    async def generate_habit_nudge(
        self,
        user_id: int,
        habit_name: str,
        days_since: int
    ) -> tuple[str, str]:
        """
        Generate a habit nudge message
        Returns: (title, message)
        """
        # Template-based message loaded from system-prompts.json when available
        try:
            # Use centralized environment detection
            try:
                from backend.env_utils import ROOT_DIR
            except ImportError:
                from env_utils import ROOT_DIR
            prompts_path = ROOT_DIR / "public" / "system-prompts.json"
            raw = prompts_path.read_text(encoding="utf-8")
            data = json.loads(raw)
            template = str(data.get("habit_nudge_template") or "").strip()
        except Exception:
            template = ""

        if not template:
            template = (
                "I noticed **{habit_name}** hasn't been checked in {days_since} days. "
                "Want to break it into a quick micro-task or schedule a focus block for it?"
            )

        message = template.format(habit_name=habit_name, days_since=days_since)
        return "Habit Check-in", message
