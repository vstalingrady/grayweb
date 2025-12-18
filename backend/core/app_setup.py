"""Application setup and lifespan management.

This module centralizes the application lifecycle logic, including database
connections, proactivity engine initialization, and startup validation.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from asyncio import wait_for, TimeoutError

from fastapi import FastAPI

# Lazy imports to handle global dependencies
def _get_deps():
    from backend.main import (
        database,
        db_logger,
        app_logger,
        init_audit_logger,
        proactivity_realtime_broker,
        AI_MESSAGE_GENERATOR,
        AI_PROVIDER,
        VALIDATE_GEMINI_ON_STARTUP,
        GEMINI_SERVICE,
        GEMINI_DEFAULT_MODEL,
    )
    from backend.compat_imports import (
        ProactivityEngine,
        ProactivitySchedulerManager,
        ReminderSchedulerManager,
        set_entity_reminder_scheduler,
        set_workspace_reminder_scheduler,
    )
    return locals()

# Global instances (to be set by lifespan)
proactivity_engine = None
proactivity_scheduler = None
reminder_scheduler = None


def _sync_scheduler_state_to_main(
    engine: Any,
    scheduler: Any,
    reminder: Any,
) -> None:
    """Keep legacy `backend.main` globals in sync with lifespan-managed instances."""
    import backend.main as main_module

    main_module.proactivity_engine = engine
    main_module.proactivity_scheduler = scheduler
    main_module.reminder_scheduler = reminder

async def connect_database():
    """Connect to the database on startup."""
    deps = _get_deps()
    db = deps['database']
    db_logger = deps['db_logger']
    init_audit_logger = deps['init_audit_logger']
    
    try:
        await db.connect()
        # Enable WAL mode for SQLite to improve concurrency
        db_url_str = str(db.url)
        if "sqlite" in db_url_str:
            await db.fetch_val("PRAGMA journal_mode=WAL;")
            await db.execute("PRAGMA synchronous=NORMAL;")
        # Initialize audit logger with database
        init_audit_logger(db)
    except Exception as e:
        db_logger.error(f"Database connection failed: {e}", exc_info=True)
        raise

async def disconnect_database():
    """Disconnect from the database on shutdown."""
    deps = _get_deps()
    db = deps['database']
    db_logger = deps['db_logger']
    app_logger = deps['app_logger']
    
    global proactivity_scheduler, reminder_scheduler
    
    # Shutdown schedulers
    for scheduler, name in [(proactivity_scheduler, "Proactivity"), (reminder_scheduler, "Reminder")]:
        if scheduler:
            try:
                await scheduler.shutdown(timeout=10.0)
                app_logger.info(f"{name} scheduler shut down")
            except Exception as e:
                app_logger.warning(f"{name} scheduler shutdown failed: {e}")

    try:
        await wait_for(db.disconnect(), timeout=10.0)
        db_logger.info("Database connection closed via shutdown event")
    except Exception as e:
        db_logger.error(f"Database disconnection failed on shutdown: {e}")

async def initialize_proactivity_engine():
    """Initialize the hybrid proactivity engine + scheduler."""
    deps = _get_deps()
    db = deps['database']
    app_logger = deps['app_logger']
    
    global proactivity_engine, proactivity_scheduler, reminder_scheduler
    
    try:
        proactivity_engine = deps['ProactivityEngine'](
            db,
            deps['proactivity_realtime_broker'],
            deps['AI_MESSAGE_GENERATOR'],
        )
        proactivity_scheduler = deps['ProactivitySchedulerManager'](proactivity_engine)
        await proactivity_scheduler.start()

        if deps['ReminderSchedulerManager']:
            reminder_scheduler = deps['ReminderSchedulerManager'](proactivity_engine, db)
            await reminder_scheduler.start()
            
            # Update tool handlers with the new scheduler
            deps['set_entity_reminder_scheduler'](reminder_scheduler)
            deps['set_workspace_reminder_scheduler'](reminder_scheduler)

        _sync_scheduler_state_to_main(proactivity_engine, proactivity_scheduler, reminder_scheduler)

    except Exception as e:
        app_logger.error(f"Failed to initialize proactivity engine: {e}", exc_info=True)
        _sync_scheduler_state_to_main(None, None, None)

async def validate_gemini_api_key_on_startup():
    deps = _get_deps()
    app_logger = deps['app_logger']
    gemini_service = deps['GEMINI_SERVICE']
    
    if deps['AI_PROVIDER'] != "gemini" or not deps['VALIDATE_GEMINI_ON_STARTUP']:
        return

    if not gemini_service or not gemini_service.available:
        app_logger.warning("Gemini validation skipped; no API key configured")
        return

    try:
        await gemini_service.validate_connection()
    except Exception as exc:
        app_logger.error(f"Gemini API validation failed: {exc}", exc_info=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Centralized startup/shutdown context manager."""
    # We'll need access to core migration functions
    from backend.core.migrations import (
        run_startup_migrations as _run_startup_migrations,
        run_basic_migrations as _run_basic_migrations,
    )

    _run_startup_migrations()
    await connect_database()
    await _run_basic_migrations()
    
    await asyncio.gather(
        initialize_proactivity_engine(),
        validate_gemini_api_key_on_startup(),
    )
    
    try:
        yield
    finally:
        await disconnect_database()
