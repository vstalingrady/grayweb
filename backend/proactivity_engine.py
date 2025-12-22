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
from typing import Any, AsyncIterator, Dict, List, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import databases
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.ai_message_generator import AIMessageGenerator
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)
_INVALID_TIMEZONES_LOGGED: set[str] = set()

PROACTIVITY_PUSH_TABLE = "proactivity_push_subscriptions"
PROACTIVITY_DELIVERY_GUARD_TABLE = "proactivity_delivery_guard"

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
        realtime_broker: Optional[ProactivityRealtimeBroker] = None,
        ai_generator: Optional[AIMessageGenerator] = None,
    ) -> None:
        self.db = db
        self.realtime_broker = realtime_broker
        self.ai_generator = ai_generator
        self._user_data_cache: Dict[int, int] = {}
        # Per-user locks to prevent concurrent dispatch from multiple sources
        self._user_dispatch_locks: Dict[int, asyncio.Lock] = {}
        self._last_delivery_guard_cleanup: Optional[datetime] = None

    def _get_user_lock(self, user_id: int) -> asyncio.Lock:
        """Get or create a lock for a specific user to prevent concurrent dispatches."""
        if user_id not in self._user_dispatch_locks:
            self._user_dispatch_locks[user_id] = asyncio.Lock()
        return self._user_dispatch_locks[user_id]

    async def _ensure_connection(self) -> None:
        """Make sure we can talk to the database even if other code disconnected it."""
        try:
            if hasattr(self.db, "is_connected") and not self.db.is_connected:
                await self.db.connect()
        except Exception as exc:  # pragma: no cover - defensive guardrail
            logger.error(f"Failed to ensure proactivity DB connection: {exc}", exc_info=True)
            raise

    async def _reserve_delivery_key(self, user_id: int, delivery_key: str, source: str) -> bool:
        await self._ensure_connection()
        now = datetime.now(dt_timezone.utc)
        try:
            async with self.db.transaction():
                await self.db.execute(
                    f"""
                    INSERT OR IGNORE INTO {PROACTIVITY_DELIVERY_GUARD_TABLE}
                    (user_id, delivery_key, created_at)
                    VALUES (:user_id, :delivery_key, :created_at)
                    """,
                    {"user_id": user_id, "delivery_key": delivery_key, "created_at": now},
                )
                inserted = await self.db.fetch_val("SELECT changes()")
        except Exception as exc:
            logger.error(
                "Failed to reserve proactivity delivery key: %s",
                exc,
                exc_info=True,
                extra={"event_type": "proactivity_delivery_guard_error", "user_id": user_id},
            )
            return True

        if not inserted:
            logger.debug(
                "Skipping duplicate proactivity send (delivery_key reserved)",
                extra={
                    "event_type": "proactivity_dedup_skipped",
                    "user_id": user_id,
                    "source": source,
                    "delivery_key": delivery_key,
                },
            )
            return False

        if (
            self._last_delivery_guard_cleanup is None
            or now - self._last_delivery_guard_cleanup > timedelta(hours=6)
        ):
            cutoff = now - timedelta(days=30)
            try:
                await self.db.execute(
                    f"DELETE FROM {PROACTIVITY_DELIVERY_GUARD_TABLE} WHERE created_at < :cutoff",
                    {"cutoff": cutoff},
                )
                self._last_delivery_guard_cleanup = now
            except Exception as exc:
                logger.warning(
                    "Failed to prune proactivity delivery guard rows: %s",
                    exc,
                    exc_info=True,
                )

        return True

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
        # Use per-user lock to prevent concurrent dispatch from multiple sources
        # (e.g., realtime SSE connection + cron job firing at similar times)
        async with self._get_user_lock(user_id):
            return await self._dispatch_user_if_due_impl(
                user_id, source=source, force=force, user_settings=user_settings
            )

    async def _dispatch_user_if_due_impl(
        self,
        user_id: int,
        *,
        source: str,
        force: bool = False,
        user_settings: Optional[ProactivityUserSettings] = None,
    ) -> Optional[Dict[str, Any]]:
        """Internal implementation - must be called with user lock held."""
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

        current_window = self._current_window_bounds(payload, timezone)
        should_send = force or current_window is not None

        if not should_send:
            return None

        # Generate delivery_key FIRST - this is our deduplication key
        delivery_key = None
        if current_window:
            window_start, _ = current_window
            window_start_utc = window_start.astimezone(dt_timezone.utc)
            delivery_key = f"check_in:{user_id}:{window_start_utc.strftime('%Y%m%dT%H%M')}"
        elif force:
            now_utc = datetime.now(dt_timezone.utc)
            delivery_key = f"check_in:{user_id}:{now_utc.strftime('%Y%m%dT%H%M')}"

        return await self._send_proactivity_message(
            user_id,
            payload,
            timezone,
            source=source,
            delivery_key=delivery_key,
        )

    def _current_window_bounds(
        self,
        settings: Dict[str, Any],
        timezone: str,
        *,
        now_override: Optional[datetime] = None,
    ) -> Optional[Tuple[datetime, datetime]]:
        local_tz = self._resolve_timezone(timezone)
        if now_override is None:
            local_now = datetime.now(local_tz)
        else:
            local_now = now_override
            if local_now.tzinfo is None:
                local_now = local_now.replace(tzinfo=local_tz)
            else:
                local_now = local_now.astimezone(local_tz)

        # Allow a grace period after the scheduled time, but never send early.
        tolerance_after = timedelta(minutes=30)
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
            window_start = target_time
            window_end = target_time + tolerance_after
            if window_start <= local_now <= window_end:
                return window_start, window_end
        return None

    @staticmethod
    def _resolve_timezone(value: str) -> ZoneInfo:
        try:
            return ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            normalized = (value or "").strip()
            if normalized and normalized not in _INVALID_TIMEZONES_LOGGED and len(_INVALID_TIMEZONES_LOGGED) < 50:
                _INVALID_TIMEZONES_LOGGED.add(normalized)
                logger.warning(
                    "Invalid timezone; falling back to UTC",
                    extra={
                        "event_type": "fallback_activation",
                        "fallback": "proactivity_timezone_invalid",
                        "timezone": normalized,
                        "error": str(exc),
                    },
                )
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
            value = _row_get(record, "sent_at")
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
            except ValueError:
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
        delivery_key: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        message = await self._generate_checkin_message(user_id, settings, timezone)
        if not message:
            logger.warning(f"Unable to generate proactivity message for user {user_id}")
            return None
        if delivery_key:
            reserved = await self._reserve_delivery_key(user_id, delivery_key, source)
            if not reserved:
                return None

        # Persist the message to general chat history. Use the canonical
        # "model" role so it passes the Supabase check constraint that only
        # allows 'user' | 'model'.
        saved = await self._save_general_message(user_id, "model", message)
        if not saved:
            logger.warning(f"Failed to save general chat message for user {user_id}")

        cadence = (settings.get("cadence") or "Check-in").title()
        notification_title = f"🔔 {cadence} Check-in"
        notification_sent = await self._send_browser_notification(
            user_id,
            notification_title,
            message,
            delivery_key=delivery_key,
        )
        if not notification_sent:
            logger.warning(f"Proactivity notification creation failed for user {user_id}")

        await self._send_web_push_notification(
            user_id,
            notification_title,
            message,
            delivery_key=delivery_key,
        )

        dispatch = {
            "user_id": user_id,
            "cadence": cadence,
            "message": message,
            "source": source,
            "timezone": timezone,
            "sent_at": datetime.now(dt_timezone.utc).isoformat(),
        }
        if delivery_key:
            dispatch["delivery_key"] = delivery_key

        logger.info("Proactivity message delivered", extra={
            "event_type": "proactivity_message_sent",
            "user_id": user_id,
            "cadence": cadence,
            "source": source,
        })

        if self.realtime_broker:
            await self.realtime_broker.broadcast(user_id, "proactivity_message", dispatch)

        return dispatch

    async def dispatch_reminder(
        self,
        *,
        user_id: int,
        reminder_id: int,
        source: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Deliver a reminder as a chat message + notification, and mark it delivered.
        """
        await self._ensure_connection()
        row = await self.db.fetch_one(
            """
            SELECT id, label, description, remind_at, status
            FROM reminders
            WHERE id = :id AND user_id = :user_id
            """,
            {"id": reminder_id, "user_id": user_id},
        )
        if not row:
            return None

        reminder = dict(row)
        status = (reminder.get("status") or "").strip().lower()
        if status != "pending":
            return None

        remind_at = reminder.get("remind_at")
        if isinstance(remind_at, str):
            try:
                remind_at = datetime.fromisoformat(remind_at)
            except Exception:
                remind_at = None
        if isinstance(remind_at, datetime):
            remind_at_utc = remind_at if remind_at.tzinfo else remind_at.replace(tzinfo=dt_timezone.utc)
            remind_at_utc = remind_at_utc.astimezone(dt_timezone.utc)
        else:
            remind_at_utc = datetime.now(dt_timezone.utc)

        label = (reminder.get("label") or "Reminder").strip()
        description = (reminder.get("description") or "").strip()

        message_lines = [f"Reminder: {label}"]
        if description:
            message_lines.append(description)
        message = "\n".join(message_lines).strip()

        # Persist into General chat so the reminder isn't missed.
        await self._save_general_message(user_id, "model", message)

        title = "🔔 Reminder"
        delivery_key = f"reminder:{reminder_id}"

        await self._send_browser_notification(
            user_id,
            title,
            message,
            notification_type="reminder",
            due_at=remind_at_utc,
            delivery_key=delivery_key,
        )
        await self._send_web_push_notification(
            user_id,
            title,
            message,
            delivery_key=delivery_key,
        )

        now = datetime.now(dt_timezone.utc)
        try:
            await self.db.execute(
                """
                UPDATE reminders
                SET status = 'delivered', delivered_at = :delivered_at
                WHERE id = :id AND user_id = :user_id
                """,
                {"id": reminder_id, "user_id": user_id, "delivered_at": now},
            )
        except Exception as exc:
            logger.warning("Failed to mark reminder delivered: %s", exc, exc_info=True)

        dispatch = {
            "user_id": user_id,
            "message": message,
            "source": source,
            "due_at": remind_at_utc.isoformat(),
            "delivery_key": delivery_key,
            "sent_at": now.isoformat(),
        }

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
            return ai_message.strip() if ai_message else None
        except Exception as exc:
            logger.error(f"Error generating check-in message for user {user_id}: {exc}", exc_info=True)
            return None

    async def _send_web_push_notification(
        self,
        user_id: int,
        title: str,
        message: str,
        *,
        delivery_key: Optional[str] = None,
    ) -> None:
        vapid_public = os.getenv("VAPID_PUBLIC_KEY")
        vapid_private = os.getenv("VAPID_PRIVATE_KEY")
        enable_flag = os.getenv("ENABLE_WEB_PUSH")
        if enable_flag is not None:
            normalized = enable_flag.strip().lower()
            web_push_enabled = normalized in ("1", "true", "yes", "on")
        else:
            node_env = os.getenv("NODE_ENV", "").strip().lower()
            environment = os.getenv("ENVIRONMENT", "").strip().lower()
            web_push_enabled = node_env == "production" or environment == "production"
            if not web_push_enabled and vapid_public and vapid_private:
                web_push_enabled = True

        if not web_push_enabled:
            logger.debug(
                "Skipping web push delivery because it is disabled in this environment",
                extra={"event_type": "proactivity_web_push_skipped", "user_id": user_id},
            )
            return

        if not vapid_public or not vapid_private:
            logger.warning(
                "Web push disabled: missing VAPID keys",
                extra={"event_type": "web_push_missing_vapid", "user_id": user_id},
            )
            return

        await self._ensure_connection()
        rows = await self.db.fetch_all(
            f"SELECT id, endpoint, p256dh, auth FROM {PROACTIVITY_PUSH_TABLE} WHERE user_id = :user_id",
            {"user_id": user_id},
        )
        if not rows:
            logger.info(
                "No push subscriptions registered for user",
                extra={"event_type": "web_push_no_subscriptions", "user_id": user_id},
            )
            return

        payload_data: Dict[str, Any] = {
            "title": title,
            "message": message,
        }
        if delivery_key:
            payload_data["tag"] = f"gray-proactivity-{delivery_key}"
        payload = json.dumps(payload_data)
        for row in rows:
            subscription_info = {
                "endpoint": row["endpoint"],
                "keys": {
                    "p256dh": row["p256dh"],
                    "auth": row["auth"],
                },
            }
            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": "mailto:admin@gray.app"},
                )
                logger.info(
                    f"Web push sent successfully for user {user_id}",
                    extra={"event_type": "web_push_success", "user_id": user_id},
                )
            except WebPushException as exc:
                response = getattr(exc, "response", None)
                status_code = getattr(response, "status_code", None)
                response_text = getattr(response, "text", "") if response else ""

                if status_code in (400, 404, 410):
                    # These mean the subscription is invalid or expired.
                    logger.warning(
                        f"Web push subscription expired/invalid for user {user_id} (status {status_code}). Removing.",
                        extra={"event_type": "web_push_expired", "user_id": user_id, "status": status_code, "response_body": response_text}
                    )
                    try:
                        await self.db.execute(
                            f"DELETE FROM {PROACTIVITY_PUSH_TABLE} WHERE id = :id",
                            {"id": row["id"]},
                        )
                        # Check if user has any remaining subscriptions
                        remaining = await self.db.fetch_one(
                            f"SELECT COUNT(*) as cnt FROM {PROACTIVITY_PUSH_TABLE} WHERE user_id = :user_id",
                            {"user_id": user_id},
                        )
                        if remaining and remaining["cnt"] == 0:
                            logger.warning(
                                f"User {user_id} has NO remaining push subscriptions. "
                                "Notifications will only work if app is open (SSE). "
                                "User should re-enable notifications in settings.",
                                extra={"event_type": "web_push_all_expired", "user_id": user_id},
                            )
                    except Exception as delete_exc:
                        logger.error(
                            f"Failed to delete invalid push subscription for user {user_id}: {delete_exc}",
                            exc_info=True,
                        )
                else:
                    # Unexpected error
                    logger.error(
                        f"Web push failed for user {user_id}: {exc}",
                        exc_info=True,
                        extra={"response_body": response_text}
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
        reminder_context = await self._load_reminder_context(user_id)

        try:
            cadence = (settings.get("cadence") or "").strip().lower()
            reason: Optional[str] = None
            if cadence == "frequent":
                reason = "pattern_trigger"
            elif cadence == "daily":
                reason = "progress_review"
            elif cadence == "custom":
                reason = "custom_checkin"

            _, message = await self.ai_generator.generate_daily_briefing(
                user_id,
                dashboard_pulse,
                settings or {},
                timezone,
                reason=reason,
                decision_context=reminder_context,
                profile_context=profile_summary,
                custom_instructions=custom_instructions,
                chat_context=chat_context,
                db=self.db,
            )
            return message.strip() if message else None
        except Exception as exc:
            logger.error(f"AI generator failed for user {user_id}: {exc}", exc_info=True)
            return None

    async def _load_reminder_context(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Load a small, structured reminder snapshot for proactive check-ins."""
        await self._ensure_connection()
        now_utc = datetime.now(dt_timezone.utc)

        def _row_to_item(row: Any) -> Dict[str, Any]:
            remind_at = row.get("remind_at")
            if isinstance(remind_at, datetime):
                remind_at_value: Optional[str] = remind_at.isoformat()
            else:
                remind_at_value = str(remind_at) if remind_at else None
            return {
                "id": row.get("id"),
                "label": row.get("label"),
                "description": row.get("description"),
                "remind_at": remind_at_value,
                "status": row.get("status"),
            }

        try:
            upcoming_rows = await self.db.fetch_all(
                """
                SELECT id, label, description, remind_at, status
                FROM reminders
                WHERE user_id = :user_id
                  AND status = 'pending'
                  AND remind_at >= :now
                ORDER BY remind_at ASC
                LIMIT 5
                """,
                {"user_id": user_id, "now": now_utc},
            )
            overdue_rows = await self.db.fetch_all(
                """
                SELECT id, label, description, remind_at, status
                FROM reminders
                WHERE user_id = :user_id
                  AND status = 'pending'
                  AND remind_at < :now
                ORDER BY remind_at DESC
                LIMIT 3
                """,
                {"user_id": user_id, "now": now_utc},
            )
        except Exception as exc:
            logger.debug(
                "Failed to load reminders for proactivity context",
                extra={"event_type": "proactivity_reminder_context_failure", "user_id": user_id, "error": str(exc)},
            )
            return None

        upcoming = [_row_to_item(dict(row)) for row in upcoming_rows] if upcoming_rows else []
        overdue = [_row_to_item(dict(row)) for row in overdue_rows] if overdue_rows else []

        if not upcoming and not overdue:
            return None

        return {"upcoming_reminders": upcoming, "overdue_reminders": overdue}

    async def _load_user_profile_context(self, user_id: int) -> Tuple[Optional[str], Optional[str]]:
        """Pull saved personalization fields so proactive nudges can reference them."""
        try:
            record = await self.db.fetch_one(
                """
                SELECT
                  personalization_nickname,
                  personalization_occupation,
                  personalization_about,
                  personalization_location,
                  personalization_time_zone,
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
        await self._ensure_connection()
        rows: List[Dict[str, Any]] = []

        # Prefer the General workspace (`/g`) conversation history.
        try:
            query = """
                SELECT role, content, created_at
                FROM general_chat_messages
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit
            """
            raw_rows = await self.db.fetch_all(query, {"user_id": user_id, "limit": limit})
            rows = [dict(r) for r in raw_rows]
        except Exception as exc:
            logger.debug(
                "Failed to load general chat history for proactivity from SQLite",
                extra={
                    "event_type": "proactivity_general_history_load_failure",
                    "user_id": user_id,
                    "error": str(exc),
                },
            )

        # Fallback: if general chat is empty (or missing in older schemas),
        # pull the most recent thread messages.
        if not rows:
            try:
                query = """
                    SELECT m.role, m.text as content, m.created_at
                    FROM user_chat_messages m
                    JOIN user_chat_threads t ON m.thread_id = t.id
                    WHERE t.user_identifier = :user_id
                    ORDER BY m.created_at DESC
                    LIMIT :limit
                """
                raw_rows = await self.db.fetch_all(query, {"user_id": user_id, "limit": limit})
                rows = [dict(r) for r in raw_rows]
            except Exception as exc:
                logger.debug(
                    "Failed to load thread chat history for proactivity from SQLite",
                    extra={
                        "event_type": "proactivity_thread_history_load_failure",
                        "user_id": user_id,
                        "error": str(exc),
                    },
                )
                return None

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



    async def _ensure_user_data_record(self, user_identifier: int) -> Optional[int]:
        """
        Return the user_data.id for the provided identifier, creating it if needed.
        """
        if not user_identifier:
            return None

        cached = self._user_data_cache.get(user_identifier)
        if cached is not None:
            return cached

        await self._ensure_connection()
        try:
            query = "SELECT id FROM user_data WHERE user_identifier = :uid"
            row = await self.db.fetch_one(query, {"uid": user_identifier})
            if row:
                uid = row["id"]
                self._user_data_cache[user_identifier] = uid
                return uid

            # Create new record
            insert_query = """
                INSERT INTO user_data (user_identifier, created_at, updated_at)
                VALUES (:uid, :now, :now)
            """
            now = datetime.now(dt_timezone.utc)
            uid = await self.db.execute(insert_query, {"uid": user_identifier, "now": now})
            self._user_data_cache[user_identifier] = uid
            return uid
        except Exception as exc:
            logger.error(f"Failed checking/creating user_data for {user_identifier}: {exc}", exc_info=True)
            return None



    async def _save_general_message(self, user_id: int, role: str, content: str) -> bool:
        # Use local SQLite exclusively.
        await self._ensure_connection()

        user_data_id = await self._ensure_user_data_record(user_id)
        if not user_data_id:
            logger.error(f"Cannot save general message: failed to resolve user_data_id for user {user_id}")
            return False

        try:
            query_insert = """
                INSERT INTO general_chat_messages (user_id, user_data_id, role, content, created_at)
                VALUES (:user_id, :user_data_id, :role, :content, :created_at)
            """
            values = {
                "user_id": user_id,
                "user_data_id": user_data_id,
                "role": role,
                "content": content,
                "created_at": datetime.now(dt_timezone.utc),
            }
            await self.db.execute(query_insert, values)
            return True
        except Exception as exc:
            logger.error(f"Failed to save general chat message for user {user_id}: {exc}", exc_info=True)
            return False



    async def _send_browser_notification(
        self,
        user_id: int,
        title: str,
        message: str,
        *,
        notification_type: str = "check_in",
        due_at: Optional[datetime] = None,
        delivery_key: Optional[str] = None,
    ) -> bool:
        now = datetime.now(dt_timezone.utc)
        try:
        # Use local SQLite exclusively.

            # Fallback to local database
            await self._ensure_connection()
            query = """
                INSERT INTO proactive_notifications
                (user_id, type, title, message, metadata, due_at, sent_at, created_at)
                VALUES (:user_id, :type, :title, :message, :metadata, :due_at, :sent_at, :created_at)
            """
            metadata = {"delivery_key": delivery_key} if delivery_key else None
            if metadata is not None and isinstance(metadata, dict):
                metadata = json.dumps(metadata)

            await self.db.execute(
                query,
                {
                    "user_id": user_id,
                    "type": notification_type,
                    "title": title,
                    "message": message,
                    "metadata": metadata,
                    "due_at": due_at or now,
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
                misfire_grace_time=3600,
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
