"""
Hybrid proactivity engine that drives both real-time (SSE/WebSocket) delivery
and offline cron-style dispatching for proactive check-ins.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import requests
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

import databases
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from ai_message_generator import AIMessageGenerator
try:
    from pywebpush import webpush, WebPushException
except ImportError:  # graceful fallback if pywebpush isn't available
    webpush = None  # type: ignore[assignment]

    class WebPushException(Exception):
        pass

logger = logging.getLogger(__name__)

# Avoid duplicate sends if a user gets evaluated twice in a short window.
# Keep the guard short so scheduled touchpoints aren't skipped after manual triggers.
MIN_SEND_INTERVAL_SECONDS = 300  # 5 minutes

PROACTIVITY_PUSH_TABLE = "proactivity_push_subscriptions"

@dataclass
class ProactivityUserSettings:
    user_id: int
    payload: Dict[str, Any]
    timezone: str


class ProactivityRealtimeBroker:
    """Manages per-user queues so SSE/WebSocket clients can receive events."""

    def __init__(self) -> None:
        self._listeners: Dict[int, List[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def register(self, user_id: int) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._listeners.setdefault(user_id, []).append(queue)
        return queue

    async def unregister(self, user_id: int, queue: asyncio.Queue) -> None:
        async with self._lock:
            queues = self._listeners.get(user_id)
            if not queues:
                return
            if queue in queues:
                queues.remove(queue)
            if not queues:
                self._listeners.pop(user_id, None)

    async def broadcast(self, user_id: int, event: str, payload: Dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._listeners.get(user_id) or [])

        if not queues:
            return

        data = {"event": event, **payload}
        for queue in queues:
            try:
                queue.put_nowait(data)
            except asyncio.QueueFull:
                logger.debug("Dropping proactivity event because queue is full", extra={
                    "event_type": "proactivity_stream_drop",
                    "user_id": user_id
                })


class ProactivityEngine:
    """Encapsulates message generation, delivery and evaluation logic."""

    def __init__(
        self,
        db: databases.Database,
        supabase_client: Any = None,
        realtime_broker: Optional[ProactivityRealtimeBroker] = None,
        ai_generator: Optional[AIMessageGenerator] = None,
    ) -> None:
        self.db = db
        self.supabase = supabase_client
        self.realtime_broker = realtime_broker
        self.ai_generator = ai_generator
        self._user_data_cache: Dict[int, int] = {}

    async def _ensure_connection(self) -> None:
        """Make sure we can talk to the database even if other code disconnected it."""
        try:
            if hasattr(self.db, "is_connected") and not self.db.is_connected:
                await self.db.connect()
        except Exception as exc:  # pragma: no cover - defensive guardrail
            logger.error(f"Failed to ensure proactivity DB connection: {exc}", exc_info=True)
            raise

    async def list_active_user_settings(self) -> List[ProactivityUserSettings]:
        await self._ensure_connection()
        query = "SELECT user_id, payload FROM proactivity_settings"
        records = await self.db.fetch_all(query)
        users: List[ProactivityUserSettings] = []

        for record in records:
            user_id = record[0]
            payload = self._deserialize_payload(record[1])
            if not payload:
                continue

            cadence = (payload.get("cadence") or "").strip().lower()
            if cadence in {"manual", "paused"}:
                continue

            timezone = payload.get("timezone") or "UTC"
            users.append(ProactivityUserSettings(user_id=user_id, payload=payload, timezone=timezone))

        return users

    async def dispatch_all_due(self, *, source: str = "manual") -> Dict[str, Any]:
        results = {
            "users_evaluated": 0,
            "messages_sent": 0,
            "errors": 0,
            "details": [],
        }

        users = await self.list_active_user_settings()
        results["users_evaluated"] = len(users)

        # Process users in batches to avoid overwhelming the DB/API but still get concurrency
        batch_size = 20
        for i in range(0, len(users), batch_size):
            batch = users[i : i + batch_size]
            tasks = [
                self.dispatch_user_if_due(user.user_id, source=source, user_settings=user)
                for user in batch
            ]
            
            # Run the batch concurrently
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for user, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.error(f"Error evaluating user {user.user_id} proactivity: {result}", exc_info=True)
                    results["errors"] += 1
                elif result:
                    results["messages_sent"] += 1
                    results["details"].append({"user_id": user.user_id, "source": source, "status": "sent"})

        return results

    async def dispatch_user_if_due(
        self,
        user_id: int,
        *,
        source: str,
        force: bool = False,
        user_settings: Optional[ProactivityUserSettings] = None,
    ) -> Optional[Dict[str, Any]]:
        await self._ensure_connection()
        
        if user_settings:
            payload = user_settings.payload
            timezone = user_settings.timezone
        else:
            settings_record = await self.db.fetch_one(
                "SELECT payload FROM proactivity_settings WHERE user_id = :user_id",
                {"user_id": user_id},
            )
            if not settings_record:
                return None

            payload = self._deserialize_payload(settings_record[0])
            if not payload:
                return None

            timezone = payload.get("timezone") or "UTC"

        cadence = (payload.get("cadence") or "").strip().lower()
        if cadence in {"manual", "paused"} and not force:
            return None
        last_sent_at = await self._last_notification_timestamp(user_id)
        if last_sent_at:
            last_sent_utc = (
                last_sent_at if last_sent_at.tzinfo else last_sent_at.replace(tzinfo=dt_timezone.utc)
            ).astimezone(dt_timezone.utc)
            if datetime.now(dt_timezone.utc) - last_sent_utc < timedelta(seconds=MIN_SEND_INTERVAL_SECONDS):
                logger.debug("Skipping duplicate proactivity send", extra={
                    "event_type": "proactivity_send_skipped",
                    "user_id": user_id,
                    "source": source,
                })
                if not force:
                    return None

        current_window = self._current_window_bounds(payload, timezone)
        should_send = force or current_window is not None

        if not should_send:
            return None

        if not force and last_sent_at and current_window:
            if self._already_sent_in_window(last_sent_at, current_window):
                logger.debug("Skipping proactivity send because window already satisfied", extra={
                    "event_type": "proactivity_window_satisfied",
                    "user_id": user_id,
                    "source": source,
                })
                return None

        return await self._send_proactivity_message(user_id, payload, timezone, source=source)

    def _current_window_bounds(
        self,
        settings: Dict[str, Any],
        timezone: str,
    ) -> Optional[Tuple[datetime, datetime]]:
        local_tz = self._resolve_timezone(timezone)
        local_now = datetime.now(local_tz)
        tolerance = timedelta(minutes=30)  # 30-minute window around scheduled time
        for time_str in self._extract_times(settings):
            parts = time_str.split(":")
            if len(parts) < 2:
                continue
            try:
                target_hour = int(parts[0])
                target_minute = int(parts[1])
            except (TypeError, ValueError):
                continue
            target_time = local_now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
            window_start = target_time - tolerance
            window_end = target_time + tolerance
            if window_start <= local_now <= window_end:
                return window_start, window_end
        return None

    @staticmethod
    def _resolve_timezone(value: str) -> ZoneInfo:
        try:
            return ZoneInfo(value)
        except Exception:
            return ZoneInfo("UTC")

    @staticmethod
    def _extract_times(settings: Dict[str, Any]) -> Sequence[str]:
        times = settings.get("times") or []
        if not times:
            fallback = settings.get("time")
            if fallback:
                times = [fallback]
        return times or []

    async def _last_notification_timestamp(self, user_id: int) -> Optional[datetime]:
        """Return the timestamp of the most recent proactive notification."""
        # Prefer Supabase for duplicate detection when available.
        if self.supabase is not None:
            try:
                result = (
                    self.supabase.table("proactive_notifications")
                    .select("sent_at")
                    .eq("user_id", user_id)
                    .eq("type", "check_in")
                    .order("sent_at", desc=True)
                    .limit(1)
                    .execute()
                )
                rows = getattr(result, "data", None) or []
                if not rows:
                    return None
                return self._normalize_timestamp(rows[0].get("sent_at"))
            except Exception as exc:
                logger.error(
                    f"Failed to check recent proactive notification in Supabase: {exc}",
                    exc_info=True,
                    extra={
                        "event_type": "proactivity_recent_supabase_error",
                        "user_id": user_id,
                    },
                )

        # Fallback to local SQLite if Supabase is unavailable.
        await self._ensure_connection()
        query = """
            SELECT sent_at FROM proactive_notifications
            WHERE user_id = :user_id AND type = :type
            ORDER BY sent_at DESC
            LIMIT 1
        """
        record = await self.db.fetch_one(query, values={"user_id": user_id, "type": "check_in"})
        if not record:
            return None
        value = None
        if isinstance(record, dict):
            value = record.get("sent_at")
        elif hasattr(record, "sent_at"):
            value = record.sent_at
        elif len(record) > 0:
            value = record[0]
        return self._normalize_timestamp(value)

    @staticmethod
    def _normalize_timestamp(value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except Exception:
                return None
        return None

    def _already_sent_in_window(
        self,
        last_sent_at: datetime,
        window_bounds: Tuple[datetime, datetime],
    ) -> bool:
        if not window_bounds:
            return False
        start_local, end_local = window_bounds
        start_utc = start_local.astimezone(dt_timezone.utc)
        end_utc = end_local.astimezone(dt_timezone.utc)
        last = last_sent_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=dt_timezone.utc)
        else:
            last = last.astimezone(dt_timezone.utc)
        return start_utc <= last <= end_utc

    async def get_user_status(self, user_id: int) -> Dict[str, Any]:
        """
        Return a summary of the user's proactivity configuration and state,
        similar to the 'status' command in other interfaces.
        """
        await self._ensure_connection()
        
        settings_record = await self.db.fetch_one(
            "SELECT payload FROM proactivity_settings WHERE user_id = :user_id",
            {"user_id": user_id},
        )
        
        payload = {}
        if settings_record:
            payload = self._deserialize_payload(settings_record[0]) or {}

        timezone = payload.get("timezone") or "UTC"
        cadence = (payload.get("cadence") or "daily").lower()
        enabled = cadence not in {"manual", "paused"}
        
        last_sent_at = await self._last_notification_timestamp(user_id)
        
        # Calculate next check-in
        next_checkin: Optional[datetime] = None
        if enabled:
            try:
                tz = self._resolve_timezone(timezone)
                now_local = datetime.now(tz)
                times = self._extract_times(payload)
                
                candidates = []
                for t_str in times:
                    parts = t_str.split(":")
                    if len(parts) >= 2:
                        try:
                            h, m = int(parts[0]), int(parts[1])
                            # Candidate for today
                            cand_today = now_local.replace(hour=h, minute=m, second=0, microsecond=0)
                            if cand_today > now_local:
                                candidates.append(cand_today)
                            # Candidate for tomorrow
                            cand_tmrw = cand_today + timedelta(days=1)
                            candidates.append(cand_tmrw)
                        except ValueError:
                            continue
                
                if candidates:
                    next_checkin = min(candidates).astimezone(dt_timezone.utc)
            except Exception as e:
                logger.warning(f"Failed to calculate next checkin for user {user_id}: {e}")

        # Fetch recent activity stats
        activity = await self._get_user_recent_activity(user_id)
        
        return {
            "timezone": timezone,
            "cadence": cadence,
            "enabled": enabled,
            "last_sent_at": last_sent_at.isoformat() if last_sent_at else None,
            "next_checkin": next_checkin.isoformat() if next_checkin else None,
            "recent_activity": activity
        }

    async def _send_proactivity_message(
        self,
        user_id: int,
        settings: Dict[str, Any],
        timezone: str,
        *,
        source: str,
    ) -> Optional[Dict[str, Any]]:
        message = await self._generate_checkin_message(user_id, settings, timezone)
        if not message:
            logger.warning(f"Unable to generate proactivity message for user {user_id}")
            return None

        # Persist the message to general chat history. Use the canonical
        # "model" role so it passes the Supabase check constraint that only
        # allows 'user' | 'model'.
        saved = await self._save_general_message(user_id, "model", message)
        if not saved:
            logger.warning(f"Failed to save general chat message for user {user_id}")

        cadence = (settings.get("cadence") or "Check-in").title()
        notification_title = f"🔔 {cadence} Check-in"
        notification_sent = await self._send_browser_notification(user_id, notification_title, message)
        if not notification_sent:
            logger.warning(f"Proactivity notification creation failed for user {user_id}")

        await self._send_web_push_notification(user_id, notification_title, message)

        dispatch = {
            "user_id": user_id,
            "cadence": cadence,
            "message": message,
            "source": source,
            "timezone": timezone,
            "sent_at": datetime.now(dt_timezone.utc).isoformat(),
        }

        logger.info("Proactivity message delivered", extra={
            "event_type": "proactivity_message_sent",
            "user_id": user_id,
            "cadence": cadence,
            "source": source,
        })

        if self.realtime_broker:
            await self.realtime_broker.broadcast(user_id, "proactivity_message", dispatch)

        return dispatch

    async def _generate_checkin_message(
        self,
        user_id: int,
        settings: Dict[str, Any],
        timezone: str,
    ) -> Optional[str]:
        try:
            ai_message = await self._generate_ai_checkin_message(user_id, settings, timezone)
            if ai_message:
                return ai_message

            activity = await self._get_user_recent_activity(user_id)
            cadence = (settings.get("cadence") or "Frequent").lower()
            label = settings.get("label") or "Check-ins"

            local_tz = self._resolve_timezone(timezone)
            hour = datetime.now(local_tz).hour

            if hour < 12:
                time_period = "morning"
                emoji = "🌅"
            elif hour < 17:
                time_period = "afternoon"
                emoji = "☀️"
            else:
                time_period = "evening"
                emoji = "🌙"

            if cadence == "frequent":
                if time_period == "morning":
                    return f"{emoji} Good morning! Quick check-in time. What's your top priority today? (First touchpoint)"
                if time_period == "afternoon":
                    return f"{emoji} Midday momentum check! How's progress? Any blockers? (Second touchpoint)"
                return f"{emoji} Evening wrap-up! Reflect on today's wins and plan tomorrow. (Third touchpoint)"

            if cadence == "daily":
                if activity and activity.get("tasks_completed"):
                    completed = activity.get("tasks_completed", 0)
                    return f"{emoji} Good morning! Yesterday you completed {completed} tasks. Let's keep that momentum going today. What's on your plate?"
                return f"{emoji} Good morning! Time for your daily check-in. How are your plans and habits coming along? Any updates on your goals?"

            if cadence == "weekly":
                if activity and activity.get("score"):
                    score = activity.get("score", 0)
                    return f"📅 Weekly Review Time! Last week you scored {score:.0f}% completion. Let's look at highlights, gaps, and what's next for this week."
                return "📅 It's time for your weekly review! Let's recap what you accomplished this week and plan next week's priorities."

            if cadence == "custom":
                return f"👋 {label}! How are your plans and habits progressing? Let's check in on your goals."

            return "👋 Time for a check-in! How are things going with your plans and habits?"
        except Exception as exc:
            logger.error(f"Error generating check-in message for user {user_id}: {exc}", exc_info=True)
            return None

    async def _send_web_push_notification(self, user_id: int, title: str, message: str) -> None:
        if webpush is None:
            # Optional dependency; if it's not installed, skip silently.
            return

        # Only attempt web push in production by default, or when explicitly enabled.
        enable_flag = os.getenv("ENABLE_WEB_PUSH")
        if enable_flag is not None:
            normalized = enable_flag.strip().lower()
            web_push_enabled = normalized in ("1", "true", "yes", "on")
        else:
            node_env = os.getenv("NODE_ENV", "").strip().lower()
            environment = os.getenv("ENVIRONMENT", "").strip().lower()
            web_push_enabled = node_env == "production" or environment == "production"

        if not web_push_enabled:
            logger.debug(
                "Skipping web push delivery because it is disabled in this environment",
                extra={"event_type": "proactivity_web_push_skipped", "user_id": user_id},
            )
            return

        vapid_public = os.getenv("VAPID_PUBLIC_KEY")
        vapid_private = os.getenv("VAPID_PRIVATE_KEY")
        if not vapid_public or not vapid_private:
            return

        await self._ensure_connection()
        rows = await self.db.fetch_all(
            f"SELECT id, endpoint, p256dh, auth FROM {PROACTIVITY_PUSH_TABLE} WHERE user_id = :user_id",
            {"user_id": user_id},
        )
        if not rows:
            return

        payload = json.dumps({
            "title": title,
            "message": message,
        })
        for row in rows:
            subscription_info = {
                "endpoint": row["endpoint"],
                "keys": {
                    "p256dh": row["p256dh"],
                    "auth": row["auth"],
                },
            }
            try:
                webpush(
                    subscription_info,
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": "mailto:notifications@gray.local"},
                )
            except WebPushException as exc:
                logger.error(f"Web push failed for user {user_id}: {exc}", exc_info=True)
                response = getattr(exc, "response", None)
                status_code = getattr(response, "status_code", None)
                # Clean up clearly invalid subscriptions so we don't keep retrying them forever.
                if status_code in (404, 410):
                    try:
                        await self.db.execute(
                            f"DELETE FROM {PROACTIVITY_PUSH_TABLE} WHERE id = :id",
                            {"id": row["id"]},
                        )
                    except Exception as delete_exc:  # pragma: no cover - defensive cleanup
                        logger.error(
                            f"Failed to delete invalid push subscription for user {user_id}: {delete_exc}",
                            exc_info=True,
                        )
            except requests.exceptions.RequestException as exc:
                # Catch network-level errors, including DNS failures for invalid endpoints
                # like 'permanently-removed.invalid' which some browsers use to signal dead subs.
                logger.error(f"Web push network error for user {user_id}: {exc}", exc_info=True)
                error_str = str(exc)
                if "permanently-removed.invalid" in error_str or "Name or service not known" in error_str:
                    try:
                        await self.db.execute(
                            f"DELETE FROM {PROACTIVITY_PUSH_TABLE} WHERE id = :id",
                            {"id": row["id"]},
                        )
                        logger.info(f"Removed invalid push subscription for user {user_id} due to DNS error")
                    except Exception as delete_exc:
                        logger.error(
                            f"Failed to delete invalid push subscription for user {user_id}: {delete_exc}",
                            exc_info=True,
                        )

    async def _generate_ai_checkin_message(
        self,
        user_id: int,
        settings: Dict[str, Any],
        timezone: str,
    ) -> Optional[str]:
        if not self.ai_generator:
            return None
        await self._ensure_connection()
        try:
            record = await self.db.fetch_one(
                """
                SELECT date_key, plans, habits
                FROM dashboard_pulses
                WHERE user_id = :user_id
                ORDER BY date_key DESC
                LIMIT 1
                """,
                {"user_id": user_id},
            )
        except Exception as exc:
            logger.error(f"Failed to load dashboard pulse for user {user_id}: {exc}", exc_info=True)
            return None

        dashboard_pulse: Dict[str, Any] = {}
        if record:
            dashboard_pulse = {
                "date_key": record["date_key"],
                "plans": record["plans"] or [],
                "habits": record["habits"] or [],
            }

        profile_summary, custom_instructions = await self._load_user_profile_context(user_id)
        chat_context = await self._load_recent_chat_context(user_id)

        try:
            cadence = (settings.get("cadence") or "").strip().lower()
            reason: Optional[str] = None
            if cadence == "frequent":
                reason = "pattern_trigger"
            elif cadence == "daily":
                reason = "progress_review"
            elif cadence == "custom":
                reason = "long_absence"

            _, message = await self.ai_generator.generate_daily_briefing(
                user_id,
                dashboard_pulse,
                settings or {},
                timezone,
                reason=reason,
                profile_context=profile_summary,
                custom_instructions=custom_instructions,
                chat_context=chat_context,
                db=self.db,
            )
            return message.strip() if message else None
        except Exception as exc:
            logger.error(f"AI generator failed for user {user_id}: {exc}", exc_info=True)
            return None

    async def _load_user_profile_context(self, user_id: int) -> Tuple[Optional[str], Optional[str]]:
        """Pull saved personalization fields so proactive nudges can reference them."""
        try:
            record = await self.db.fetch_one(
                """
                SELECT
                  personalization_nickname,
                  personalization_occupation,
                  personalization_about,
                  personalization_custom_instructions
                FROM users
                WHERE id = :user_id
                """,
                {"user_id": user_id},
            )
        except Exception as exc:
            logger.error(f"Failed loading personalization for user {user_id}: {exc}", exc_info=True)
            return None, None

        if not record:
            return None, None

        row = dict(record)
        summary_parts: List[str] = []
        nickname = self._format_snippet(row.get("personalization_nickname"), limit=80)
        occupation = self._format_snippet(row.get("personalization_occupation"), limit=120)
        about = self._format_snippet(row.get("personalization_about"), limit=200)

        if nickname:
            summary_parts.append(f"Preferred name: {nickname}")
        if occupation:
            summary_parts.append(f"Occupation: {occupation}")
        if about:
            summary_parts.append(f"About: {about}")

        profile_summary = ". ".join(summary_parts) if summary_parts else None
        custom_instructions = self._truncate_block(row.get("personalization_custom_instructions"), limit=2000)
        return profile_summary, custom_instructions

    async def _load_recent_chat_context(self, user_id: int, *, limit: int = 6) -> Optional[str]:
        """Summarize the latest general chat turns for the AI prompt."""
        if self.supabase is None:
            return None
        try:
            result = (
                self.supabase.table("general_chat_messages")
                .select("role, content, created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
        except Exception as exc:
            logger.debug(
                "Failed to load chat history for proactivity",
                extra={
                    "event_type": "proactivity_history_load_failure",
                    "user_id": user_id,
                    "error": str(exc),
                },
            )
            return None

        rows = getattr(result, "data", None) or []
        if not rows:
            return None

        lines: List[str] = []
        for row in reversed(rows):
            snippet = self._format_snippet(row.get("content"), limit=220)
            if not snippet:
                continue
            role = str(row.get("role") or "").lower()
            speaker = "User" if role == "user" else "Gray"
            lines.append(f"- {speaker}: {snippet}")

        return "\n".join(lines) if lines else None

    @staticmethod
    def _format_snippet(value: Optional[Any], *, limit: int) -> Optional[str]:
        if value is None:
            return None
        text = re.sub(r"\s+", " ", str(value)).strip()
        if not text:
            return None
        if limit > 0 and len(text) > limit:
            text = text[: limit - 3].rstrip() + "..."
        return text

    @staticmethod
    def _truncate_block(value: Optional[Any], *, limit: int = 2000) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        if limit > 0 and len(text) > limit:
            text = text[: limit - 3].rstrip() + "..."
        return text

    async def _get_user_recent_activity(self, user_id: int) -> Optional[Dict[str, Any]]:
        # Prefer Supabase when available.
        if self.supabase is not None:
            try:
                result = (
                    self.supabase.table("proactivity_logs")
                    .select("tasks_completed,total_tasks,score,notes")
                    .eq("user_id", user_id)
                    .order("activity_date", desc=True)
                    .limit(1)
                    .execute()
                )
                rows = getattr(result, "data", None) or []
                if not rows:
                    return None
                row = rows[0]
                return {
                    "tasks_completed": row.get("tasks_completed"),
                    "total_tasks": row.get("total_tasks"),
                    "score": row.get("score"),
                    "notes": row.get("notes"),
                }
            except Exception as exc:
                logger.error(
                    f"Failed to load recent proactivity activity from Supabase for user {user_id}: {exc}",
                    exc_info=True,
                    extra={
                        "event_type": "proactivity_activity_supabase_error",
                        "user_id": user_id,
                    },
                )

        # Fallback to local SQLite.
        await self._ensure_connection()
        query = """
            SELECT tasks_completed, total_tasks, score, notes
            FROM proactivity_logs
            WHERE user_id = :user_id
            ORDER BY activity_date DESC
            LIMIT 1
        """
        record = await self.db.fetch_one(query, {"user_id": user_id})
        if not record:
            return None

        return {
            "tasks_completed": record[0],
            "total_tasks": record[1],
            "score": record[2],
            "notes": record[3],
        }

    def _conversation_store_available(self) -> bool:
        return self.supabase is not None

    def _ensure_user_data_record(self, user_identifier: int) -> Optional[int]:
        """
        Return the user_data.id for the provided identifier, creating it if needed.

        This mirrors the helper in backend.main but is kept local to avoid
        introducing circular imports. It is intentionally synchronous because
        the Supabase client itself is sync-only.
        """
        if not user_identifier or not self._conversation_store_available() or self.supabase is None:
            return None

        cached = self._user_data_cache.get(user_identifier)
        if cached is not None:
            return cached

        try:
            result = (
                self.supabase.table("user_data")
                .select("id")
                .eq("user_identifier", user_identifier)
                .limit(1)
                .execute()
            )
            rows = getattr(result, "data", None) or []
            if rows:
                user_data_id = rows[0].get("id")
                if isinstance(user_data_id, int):
                    self._user_data_cache[user_identifier] = user_data_id
                    return user_data_id
        except Exception as error:
            logger.error(
                "Error loading user data record for proactivity",
                exc_info=True,
                extra={
                    "event_type": "proactivity_user_data_load_error",
                    "user_id": user_identifier,
                    "error": str(error),
                },
            )
            return None

        try:
            created = (
                self.supabase.table("user_data")
                .insert({"user_identifier": user_identifier})
                .execute()
            )
            rows = getattr(created, "data", None) or []
            if not rows:
                lookup = (
                    self.supabase.table("user_data")
                    .select("id")
                    .eq("user_identifier", user_identifier)
                    .limit(1)
                    .execute()
                )
                rows = getattr(lookup, "data", None) or []
            if rows:
                user_data_id = rows[0].get("id")
                if isinstance(user_data_id, int):
                    self._user_data_cache[user_identifier] = user_data_id
                    return user_data_id
        except Exception as error:
            logger.error(
                "Error creating user data record for proactivity",
                exc_info=True,
                extra={
                    "event_type": "proactivity_user_data_create_error",
                    "user_id": user_identifier,
                    "error": str(error),
                },
            )
        return None

    async def _save_general_message(self, user_id: int, role: str, content: str) -> bool:
        now = datetime.now(dt_timezone.utc)
        supabase_success = False
        
        if self.supabase:
            try:
                user_data_id = self._ensure_user_data_record(user_id)
                if not user_data_id:
                    logger.warning(
                        "Unable to resolve user_data_id for proactivity general chat message; skipping Supabase insert",
                        extra={
                            "event_type": "proactivity_user_data_missing",
                            "user_id": user_id,
                        },
                    )
                else:
                    self.supabase.table("general_chat_messages").insert({
                        "user_id": user_id,
                        "user_data_id": user_data_id,
                        "role": role,
                        "content": content,
                        "created_at": now.isoformat(),
                        "attachments": None,
                        "grounding_metadata": None,
                    }).execute()
                    supabase_success = True
            except Exception as exc:
                logger.warning(
                    f"Supabase insert failed for general chat message, falling back to local DB: {exc}",
                    extra={
                        "event_type": "proactivity_general_chat_supabase_fallback",
                        "user_id": user_id,
                    },
                )

        if supabase_success:
            return True

        # Fallback to local database
        try:
            await self._ensure_connection()
            query = """
                INSERT INTO general_chat_messages (user_id, role, content, created_at)
                VALUES (:user_id, :role, :content, :created_at)
            """
            await self.db.execute(query, {
                "user_id": user_id,
                "role": role,
                "content": content,
                "created_at": now  # Use datetime object for PostgreSQL/SQLite
            })
            return True
        except Exception as exc:
            logger.error(f"Failed to save general chat message (local fallback): {exc}", exc_info=True)
            return False

    async def _send_browser_notification(self, user_id: int, title: str, message: str) -> bool:
        now = datetime.now(dt_timezone.utc)
        try:
            if self.supabase is not None:
                try:
                    self.supabase.table("proactive_notifications").insert(
                        {
                            "user_id": user_id,
                            "type": "check_in",
                            "title": title,
                            "message": message,
                            "due_at": now.isoformat(),
                            "sent_at": now.isoformat(),
                            "created_at": now.isoformat(),
                        }
                    ).execute()
                    return True
                except Exception as supabase_exc:
                    # If Supabase insert fails (e.g., foreign key constraint), fall back to local DB
                    logger.warning(
                        f"Supabase notification insert failed for user {user_id}, falling back to local DB: {supabase_exc}",
                        extra={
                            "event_type": "proactivity_notification_supabase_fallback",
                            "user_id": user_id,
                        },
                    )
            
            # Fallback to local database
            await self._ensure_connection()
            query = """
                INSERT INTO proactive_notifications
                (user_id, type, title, message, due_at, sent_at, created_at)
                VALUES (:user_id, :type, :title, :message, :due_at, :sent_at, :created_at)
            """
            await self.db.execute(
                query,
                {
                    "user_id": user_id,
                    "type": "check_in",
                    "title": title,
                    "message": message,
                    "due_at": now,
                    "sent_at": now,
                    "created_at": now,
                },
            )
            return True
        except Exception as exc:
            logger.error(f"Failed to persist proactive notification: {exc}", exc_info=True)
            return False

    @staticmethod
    def _deserialize_payload(payload: Any) -> Optional[Dict[str, Any]]:
        if not payload:
            return None
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, str):
            try:
                return json.loads(payload)
            except json.JSONDecodeError:
                logger.error("Failed to decode proactivity payload JSON")
        return None


class ProactivitySchedulerManager:
    """Wraps APScheduler to run cron-style jobs for offline users."""

    def __init__(self, engine: ProactivityEngine) -> None:
        self.engine = engine
        self.scheduler = AsyncIOScheduler(timezone=dt_timezone.utc)
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        self.scheduler.start()
        await self.refresh_jobs()
        self._started = True

    async def shutdown(self, *, timeout: float = 10.0) -> None:
        if not self.scheduler.running:
            self._started = False
            return

        try:
            await asyncio.wait_for(
                asyncio.to_thread(self.scheduler.shutdown, True),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Proactivity scheduler shutdown timed out; forcing stop",
                extra={"event_type": "proactivity_scheduler_shutdown_timeout"},
            )
            self.scheduler.shutdown(wait=False)
        finally:
            self._started = False

    async def refresh_jobs(self, user_id: Optional[int] = None) -> None:
        """Refresh scheduler jobs. If user_id is provided, only refresh that user's jobs."""
        if user_id is not None:
            # Optimized path: only refresh one user's jobs
            await self._refresh_user_jobs(user_id)
        else:
            # Full refresh: update all users
            users = await self.engine.list_active_user_settings()
            self.scheduler.remove_all_jobs()

            for user in users:
                await self._refresh_user_jobs(user.user_id, user_settings=user)
    
    async def _refresh_user_jobs(self, user_id: int, user_settings: Optional[ProactivityUserSettings] = None) -> None:
        """Refresh jobs for a specific user."""
        # Remove existing jobs for this user
        existing_jobs = [
            job for job in self.scheduler.get_jobs()
            if job.id.startswith(f"proactivity:{user_id}:")
        ]
        for job in existing_jobs:
            self.scheduler.remove_job(job.id)
        
        # Get user settings if not provided
        if user_settings is None:
            settings_record = await self.engine.db.fetch_one(
                "SELECT payload FROM proactivity_settings WHERE user_id = :user_id",
                {"user_id": user_id},
            )
            if not settings_record:
                return
            
            payload = self.engine._deserialize_payload(settings_record[0])
            if not payload:
                return
            
            timezone = payload.get("timezone") or "UTC"
            user_settings = ProactivityUserSettings(user_id=user_id, payload=payload, timezone=timezone)
        
        # Check if user should have jobs (not paused/manual)
        cadence = (user_settings.payload.get("cadence") or "").strip().lower()
        if cadence in {"manual", "paused"}:
            return
        
        # Add new jobs for this user
        tz = self.engine._resolve_timezone(user_settings.timezone)
        for idx, time_str in enumerate(self.engine._extract_times(user_settings.payload)):
            hour, minute = self._parse_time(time_str)
            if hour is None or minute is None:
                continue

            trigger = CronTrigger(hour=hour, minute=minute, timezone=tz)
            job_id = f"proactivity:{user_settings.user_id}:{idx}"
            self.scheduler.add_job(
                self._run_job,
                trigger=trigger,
                id=job_id,
                kwargs={"user_id": user_settings.user_id},
                replace_existing=True,
            )

    async def _run_job(self, user_id: int) -> None:
        try:
            await self.engine.dispatch_user_if_due(user_id, source="scheduler")
        except Exception as exc:
            logger.error(f"Scheduled proactivity dispatch failed for user {user_id}: {exc}", exc_info=True)

    @staticmethod
    def _parse_time(value: str) -> Tuple[Optional[int], Optional[int]]:
        parts = value.split(":")
        if len(parts) < 2:
            return None, None
        try:
            return int(parts[0]), int(parts[1])
        except (TypeError, ValueError):
            return None, None
