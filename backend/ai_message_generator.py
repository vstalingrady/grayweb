"""
AI Message Generator for Proactive Notifications

This module is responsible for generating the *text* of proactive check-ins.
It uses Grok (via OpenRouter) to improvise each message directly. If generation fails, the
error is logged and no message is sent.
"""

import os
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, AsyncGenerator
import json
import asyncio
import logging
from datetime import datetime
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
    """Generates AI-based proactive messages via Grok (OpenRouter)."""

    def __init__(self) -> None:
        self.openrouter = OpenRouterService()
        self.gemini = GeminiService()
        
        if self.openrouter.available:
            print("[AIMessageGenerator] Using Grok for proactive messaging")
        elif self.gemini.available:
            print("[AIMessageGenerator] Grok unavailable, using Gemini fallback")
        else:
            print("[AIMessageGenerator] No AI provider available; proactive messages will be skipped")

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

        system_prompt = (
            "You are Gray, a proactive AI mentor and accountability partner.\n"
            "Write a concise proactive check-in message for the user in first person as Gray.\n"
            "- Tone: warm, honest, encouraging; a mix of friend and coach.\n"
            "- Length: Keep it short and punchy (2-3 sentences or 1-2 short paragraphs).\n"
            "- Use the context string the user sends as background only; do NOT invent specific project names or fake details.\n"
            "- Help them notice how they're doing and choose one meaningful next step.\n"
            "- Avoid emojis and avoid lists unless absolutely necessary for clarity.\n"
        )

        if not self.openrouter or not self.openrouter.available:
            raise RuntimeError("Grok client is not configured for proactive messaging")

        if db:
            tracker = UsageTracker(db)
            try:
                await tracker.check_limits(user_id)
            except UsageLimitExceeded as e:
                print(f"[AIMessageGenerator] Usage limit exceeded for user {user_id}: {e}")
                raise RuntimeError(f"Usage limit exceeded: {e}")

        try:
            # Give the model temporal context for the check-in.
            now_utc = datetime.now(timezone.utc)
            time_context = f"Check-in requested at {now_utc.isoformat()} UTC for timezone {timezone_str} with cadence '{cadence or 'unspecified'}' and label '{label}'."

            response = await self.openrouter.generate(
                user_context,
                conversation_history=None,
                workspace_context=None,
                system_prompt=system_prompt,
                time_context=time_context,
                model="grok",
            )

            if db and hasattr(response, "usage_metadata"):
                tracker = UsageTracker(db)
                await tracker.track_usage(
                    user_id,
                    response.usage_metadata.prompt_token_count or 0,
                    response.usage_metadata.candidates_token_count or 0
                )

        except Exception as error:
            print(f"[AIMessageGenerator] Grok generation failed: {error}. Attempting fallback to Gemini...")
            
            if not self.gemini or not self.gemini.available:
                raise RuntimeError(f"Grok failed and Gemini fallback unavailable: {error}") from error
                
            try:
                # Fallback to Gemini
                # GeminiService.generate returns a GenerateContentResponse object
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
                    raise RuntimeError("Empty response from Gemini fallback")
                    
            except Exception as fallback_error:
                raise RuntimeError(f"Both Grok and Gemini fallback failed. Grok: {error}. Gemini: {fallback_error}") from fallback_error

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

    async def generate_weekly_review(
        self,
        user_id: int,
        recent_pulses: List[Dict[str, Any]],
        proactivity: Dict[str, Any]
    ) -> tuple[str, str]:
        """
        Generate a weekly review message
        Returns: (title, message)
        """
        # Analyze the week
        total_plans = 0
        completed_plans = 0
        total_habits = 0
        habit_checkins = 0

        plan_names = set()
        habit_names = set()

        for pulse in recent_pulses:
            plans = pulse.get("plans", [])
            habits = pulse.get("habits", [])

            for plan in plans:
                total_plans += 1
                plan_names.add(plan.get("name", ""))
                if plan.get("status") == "completed":
                    completed_plans += 1

            for habit in habits:
                total_habits += 1
                habit_names.add(habit.get("name", ""))
                if habit.get("status") == "checked":
                    habit_checkins += 1

        # Template to summarize recent activity
        message = f"""
# Weekly Review

This week you checked in {len(recent_pulses)} times, with {total_plans} plan entries and {habit_checkins} habit check-ins.

## Highlights
- {completed_plans} plans completed
- {len(plan_names)} active plans
- {len(habit_names)} active habits

## Focus for Next Week
- Carry forward what worked well
- Adjust any plans that need attention
- Build momentum on your habits

## Insight
Consistency is your strength - keep building on it!
        """.strip()

        return "Weekly Review", message

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
        # Template-based message
        message = f"I noticed **{habit_name}** hasn't been checked in {days_since} days. Want to break it into a quick micro-task or schedule a focus block for it?"
        return "Habit Check-in", message

    async def should_send_weekly_review(
        self,
        proactive_notifications: Any,
        user_id: int,
        db: Any
    ) -> bool:
        """Check if we should send a weekly review (Sunday, not sent this week)"""
        now = datetime.utcnow()

        # Only on Sundays
        if now.weekday() != 6:
            return False

        # Check if we already sent one this week
        week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if now.weekday() == 6 and now.hour < 20:
            # Before 8pm Sunday, check if sent earlier this week
            week_start = week_start - timedelta(days=7)

        try:
            existing = await db.fetch_one(
                proactive_notifications.select().where(
                    (proactive_notifications.c.user_id == user_id) &
                    (proactive_notifications.c.type == "weekly_review") &
                    (proactive_notifications.c.sent_at >= week_start)
                )
            )
            return existing is None
        except Exception as e:
            print(f"[AIMessageGenerator] Error checking weekly review: {e}")
            return False

    async def should_send_habit_nudge(
        self,
        dashboard_pulses: Any,
        proactive_notifications: Any,
        user_id: int,
        db: Any,
        days_threshold: int = 3
    ) -> Optional[Dict[str, Any]]:
        """Check if we should send a habit nudge (3+ days since last check-in)"""
        try:
            # Get recent dashboard pulses
            three_days_ago = datetime.utcnow() - timedelta(days=days_threshold)
            recent_pulse = await db.fetch_one(
                dashboard_pulses.select().where(
                    (dashboard_pulses.c.user_id == user_id) &
                    (dashboard_pulses.c.timestamp >= three_days_ago)
                ).order_by(dashboard_pulses.c.timestamp.desc())
            )

            if not recent_pulse:
                return None

            # Get habits from most recent pulse
            habits = recent_pulse["habits"] or []
            if not habits:
                return None

            # Check each habit
            for habit in habits:
                if not isinstance(habit, dict):
                    continue

                name = habit.get("name", "")
                last_status = habit.get("status", "")

                # If habit is unchecked, it's a candidate
                if name and last_status not in ["checked", "completed"]:
                    # Check if we already sent a nudge recently
                    two_days_ago = datetime.utcnow() - timedelta(days=2)
                    existing = await db.fetch_one(
                        proactive_notifications.select().where(
                            (proactive_notifications.c.user_id == user_id) &
                            (proactive_notifications.c.type == "habit_nudge") &
                            (proactive_notifications.c.metadata["habit_name"] == name) &
                            (proactive_notifications.c.sent_at >= two_days_ago)
                        )
                    )

                    if not existing:
                        return {
                            "habit_name": name,
                            "days_since": days_threshold
                        }

        except Exception as e:
            print(f"[AIMessageGenerator] Error checking habit nudge: {e}")

        return None


# Convenience function
async def generate_proactive_message(
    message_type: str,
    user_id: int,
    dashboard_pulse: Optional[Dict[str, Any]] = None,
    recent_pulses: Optional[List[Dict[str, Any]]] = None,
    proactivity: Optional[Dict[str, Any]] = None,
    days_since: int = 0
) -> tuple[str, str]:
    """Convenience function to generate proactive messages"""
    generator = AIMessageGenerator()

    if message_type == "daily_briefing":
        return await generator.generate_daily_briefing(user_id, dashboard_pulse or {}, proactivity or {})

    elif message_type == "weekly_review":
        return await generator.generate_weekly_review(user_id, recent_pulses or [], proactivity or {})

    elif message_type == "habit_nudge":
        return await generator.generate_habit_nudge(user_id, dashboard_pulse.get("name", "your habit"), days_since)

    else:
        return f"{message_type.title()}", "Hello! This is a test notification."
