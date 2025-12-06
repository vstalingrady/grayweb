"""Background job scheduler using arq (async Redis queue).

This module provides scheduled job execution for reminders and proactive messages.
Falls back gracefully if Redis/arq is not available.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

# Check if arq is available
try:
    from arq import create_pool, cron
    from arq.connections import RedisSettings, ArqRedis
    ARQ_AVAILABLE = True
except ImportError:
    ARQ_AVAILABLE = False
    RedisSettings = None  # type: ignore
    ArqRedis = None  # type: ignore


class JobScheduler:
    """Async job scheduler using arq/Redis."""

    def __init__(self) -> None:
        self._redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._pool: Optional[Any] = None
        self._available = ARQ_AVAILABLE

    @property
    def available(self) -> bool:
        return self._available and self._pool is not None

    async def connect(self) -> bool:
        """Connect to Redis for job queuing."""
        if not ARQ_AVAILABLE:
            logger.warning("arq not available (arq package not installed)")
            return False

        try:
            self._pool = await create_pool(RedisSettings.from_dsn(self._redis_url))
            logger.info("Job scheduler connected to Redis")
            return True
        except Exception as e:
            logger.warning("Failed to connect job scheduler: %s", e)
            self._pool = None
            return False

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._pool:
            await self._pool.close()
            self._pool = None

    async def enqueue(
        self,
        func_name: str,
        *args: Any,
        _defer_by: Optional[timedelta] = None,
        _defer_until: Optional[datetime] = None,
        **kwargs: Any,
    ) -> Optional[str]:
        """
        Enqueue a job for execution.

        Args:
            func_name: Name of the function to execute (must be registered in worker)
            *args: Positional arguments for the function
            _defer_by: Delay execution by this timedelta
            _defer_until: Execute at this specific datetime
            **kwargs: Keyword arguments for the function

        Returns:
            Job ID if enqueued successfully, None otherwise
        """
        if not self._pool:
            logger.warning("Job scheduler not connected, cannot enqueue %s", func_name)
            return None

        try:
            job = await self._pool.enqueue_job(
                func_name,
                *args,
                _defer_by=_defer_by,
                _defer_until=_defer_until,
                **kwargs,
            )
            logger.debug("Enqueued job %s: %s", func_name, job.job_id)
            return job.job_id
        except Exception as e:
            logger.error("Failed to enqueue job %s: %s", func_name, e)
            return None

    async def enqueue_reminder(
        self,
        user_id: int,
        reminder_id: int,
        execute_at: datetime,
    ) -> Optional[str]:
        """Enqueue a reminder for execution at a specific time."""
        return await self.enqueue(
            "send_reminder",
            user_id,
            reminder_id,
            _defer_until=execute_at,
        )

    async def enqueue_proactive_checkin(
        self,
        user_id: int,
        delay_seconds: int = 0,
    ) -> Optional[str]:
        """Enqueue a proactive check-in message."""
        defer_by = timedelta(seconds=delay_seconds) if delay_seconds > 0 else None
        return await self.enqueue(
            "send_proactive_checkin",
            user_id,
            _defer_by=defer_by,
        )


# Singleton instance
_scheduler: Optional[JobScheduler] = None


def get_job_scheduler() -> JobScheduler:
    """Get or create the global job scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = JobScheduler()
    return _scheduler


# =============================================================================
# Worker Configuration (run with: arq backend.job_scheduler.WorkerSettings)
# =============================================================================

async def send_reminder(ctx: Dict[str, Any], user_id: int, reminder_id: int) -> None:
    """Execute a scheduled reminder."""
    logger.info("Executing reminder %d for user %d", reminder_id, user_id)
    # Import here to avoid circular imports
    try:
        from proactivity_engine import ProactivityEngine
        engine: ProactivityEngine = ctx.get("proactivity_engine")
        if engine:
            # Dispatch reminder using existing engine
            await engine.dispatch_user_if_due(user_id, source="scheduled_reminder", force=True)
    except Exception as e:
        logger.error("Failed to execute reminder %d: %s", reminder_id, e)


async def send_proactive_checkin(ctx: Dict[str, Any], user_id: int) -> None:
    """Execute a proactive check-in for a user."""
    logger.info("Executing proactive check-in for user %d", user_id)
    try:
        from proactivity_engine import ProactivityEngine
        engine: ProactivityEngine = ctx.get("proactivity_engine")
        if engine:
            await engine.dispatch_user_if_due(user_id, source="scheduled_checkin", force=True)
    except Exception as e:
        logger.error("Failed to execute check-in for user %d: %s", user_id, e)


async def startup(ctx: Dict[str, Any]) -> None:
    """Worker startup: initialize database and engine connections."""
    logger.info("arq worker starting up...")
    
    try:
        # Import and connect database
        from database import database
        if not database.is_connected:
            await database.connect()
            logger.info("arq worker: Database connected")
        ctx["database"] = database
        
        # Initialize proactivity engine
        from proactivity_engine import ProactivityEngine, ProactivityRealtimeBroker
        from ai_message_generator import AIMessageGenerator
        
        # Create realtime broker and AI generator
        broker = ProactivityRealtimeBroker()
        ai_generator = AIMessageGenerator()
        
        # Create engine
        engine = ProactivityEngine(
            database,
            broker,
            ai_generator,
        )
        ctx["proactivity_engine"] = engine
        logger.info("arq worker: ProactivityEngine initialized")
        
    except Exception as e:
        logger.error("arq worker startup failed: %s", e, exc_info=True)
        raise


async def shutdown(ctx: Dict[str, Any]) -> None:
    """Worker shutdown: cleanup connections."""
    logger.info("arq worker shutting down...")
    
    try:
        database = ctx.get("database")
        if database and database.is_connected:
            await database.disconnect()
            logger.info("arq worker: Database disconnected")
    except Exception as e:
        logger.error("arq worker shutdown error: %s", e)


# Cron job for periodic proactivity dispatch
async def dispatch_all_proactivity(ctx: Dict[str, Any]) -> None:
    """Cron job to dispatch all due proactive check-ins."""
    logger.info("Running scheduled proactivity dispatch...")
    print(f"[arq] Running scheduled proactivity dispatch at {datetime.utcnow().isoformat()}Z")
    try:
        engine = ctx.get("proactivity_engine")
        if engine:
            results = await engine.dispatch_all_due(source="arq_cron")
            users_evaluated = results.get("users_evaluated", 0) if results else 0
            messages_sent = results.get("messages_sent", 0) if results else 0
            logger.info("Proactivity dispatch complete: %d users evaluated, %d messages sent", users_evaluated, messages_sent)
            print(f"[arq] Proactivity dispatch complete: {users_evaluated} users evaluated, {messages_sent} messages sent")
        else:
            logger.warning("Proactivity engine not available in arq context")
            print("[arq] WARNING: Proactivity engine not available in arq context")
    except Exception as e:
        logger.error("Proactivity dispatch failed: %s", e, exc_info=True)
        print(f"[arq] ERROR: Proactivity dispatch failed: {e}")


# Worker settings for running with: arq backend.job_scheduler.WorkerSettings
if ARQ_AVAILABLE:
    class WorkerSettings:
        """arq worker configuration."""
        functions = [send_reminder, send_proactive_checkin, dispatch_all_proactivity]
        cron_jobs = [
            # Run proactivity dispatch every 5 minutes
            cron(dispatch_all_proactivity, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}),
        ]
        on_startup = startup
        on_shutdown = shutdown
        redis_settings = RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        max_jobs = 10
        job_timeout = 300  # 5 minutes max per job
        keep_result = 3600  # Keep results for 1 hour

