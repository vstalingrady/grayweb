"""One-off reminder scheduling using APScheduler (AsyncIO)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.jobstores.base import JobLookupError

import databases

from backend.proactivity_engine import ProactivityEngine

logger = logging.getLogger(__name__)


class ReminderSchedulerManager:
    """
    Schedule one-off reminder deliveries for pending reminders.

    This complements the recurring proactivity scheduler (check-ins). Reminders are
    stored in the `reminders` table and delivered at `remind_at`.
    """

    def __init__(self, engine: ProactivityEngine, db: databases.Database) -> None:
        self.engine = engine
        self.db = db
        self.scheduler = AsyncIOScheduler(timezone=timezone.utc)
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
            await asyncio.wait_for(asyncio.to_thread(self.scheduler.shutdown, True), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Reminder scheduler shutdown timed out; forcing stop")
            self.scheduler.shutdown(wait=False)
        finally:
            self._started = False

    async def refresh_jobs(self) -> None:
        """Re-scan pending reminders and schedule jobs for each."""
        await self.engine._ensure_connection()
        try:
            rows = await self.db.fetch_all(
                """
                SELECT id, user_id, remind_at, status
                FROM reminders
                WHERE status = 'pending'
                """
            )
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to load reminders for scheduling: %s", exc, exc_info=True)
            return

        # Remove existing reminder jobs and re-add. We keep it simple and safe.
        for job in list(self.scheduler.get_jobs()):
            if str(job.id).startswith("reminder:"):
                try:
                    self.scheduler.remove_job(job.id)
                except JobLookupError:
                    pass  # Job already removed, expected

        for row in rows:
            try:
                reminder_id = int(row["id"])
                user_id = int(row["user_id"])
            except (ValueError, KeyError, TypeError) as e:
                logger.warning("Skipping malformed reminder row: %s", e)
                continue
            remind_at = row["remind_at"]
            await self.refresh_job(user_id=user_id, reminder_id=reminder_id, remind_at=remind_at)

    async def refresh_job(self, *, user_id: int, reminder_id: int, remind_at: Optional[datetime] = None) -> None:
        """
        Schedule (or reschedule) a specific reminder.

        If the reminder is missing, already delivered, or has no remind_at, this removes its job.
        """
        job_id = f"reminder:{user_id}:{reminder_id}"
        try:
            self.scheduler.remove_job(job_id)
        except JobLookupError:
            pass  # Job doesn't exist, expected

        await self.engine._ensure_connection()
        if remind_at is None:
            row = await self.db.fetch_one(
                "SELECT remind_at, status FROM reminders WHERE id = :id AND user_id = :user_id",
                {"id": reminder_id, "user_id": user_id},
            )
            if not row:
                return
            if (row["status"] or "").strip().lower() != "pending":
                return
            remind_at = row["remind_at"]

        if not isinstance(remind_at, datetime):
            return

        run_at = remind_at
        if run_at.tzinfo is None:
            run_at = run_at.replace(tzinfo=timezone.utc)
        else:
            run_at = run_at.astimezone(timezone.utc)

        # If a reminder is already due, run it very soon.
        now = datetime.now(timezone.utc)
        if run_at <= now:
            run_at = now

        trigger = DateTrigger(run_date=run_at, timezone=timezone.utc)
        self.scheduler.add_job(
            self._run_job,
            trigger=trigger,
            id=job_id,
            kwargs={"user_id": user_id, "reminder_id": reminder_id},
            replace_existing=True,
            misfire_grace_time=3600,
        )

    async def cancel_job(self, *, user_id: int, reminder_id: int) -> None:
        job_id = f"reminder:{user_id}:{reminder_id}"
        try:
            self.scheduler.remove_job(job_id)
        except JobLookupError:
            pass  # Job doesn't exist, expected

    async def _run_job(self, user_id: int, reminder_id: int) -> None:
        try:
            await self.engine.dispatch_reminder(user_id=user_id, reminder_id=reminder_id, source="scheduler")
        except Exception as exc:  # pragma: no cover
            logger.error("Scheduled reminder dispatch failed: %s", exc, exc_info=True)
