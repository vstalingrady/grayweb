#!/usr/bin/env python3

from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

import sqlalchemy
import uvicorn
from dotenv import load_dotenv

try:
    from backend.env_utils import ROOT_DIR, UVICORN_APP_MODULE
except ImportError:  # pragma: no cover
    from env_utils import ROOT_DIR, UVICORN_APP_MODULE  # type: ignore

# Ensure the repository root is on the Python path so `import backend` works.
sys.path.insert(0, str(ROOT_DIR))


def _configure_logging() -> logging.Logger:
    """
    Configure enhanced logging for backend startup tasks.

    This logger is intentionally more detailed than the runtime app logger so that
    `npm run backend` / `npm run dev:full` clearly show what the process is doing
    (database setup, workspace seed, server bind, etc.).
    """
    try:
        from logging_config import create_logger, get_log_level, setup_logging

        setup_logging(
            log_level=get_log_level(),
            enable_console=True,
            enable_file=False,
            structured_format=False,
        )
        return create_logger("backend.startup")
    except ImportError:  # pragma: no cover
        log_level = getattr(logging, os.getenv("LOG_LEVEL", "WARNING").upper(), logging.WARNING)
        logger = logging.getLogger("backend.startup")
        if logger.handlers:
            return logger

        logger.setLevel(log_level)
        handler = logging.StreamHandler()
        formatter = logging.Formatter("[backend.startup] %(asctime)s %(levelname)s: %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.propagate = False
        logging.getLogger("uvicorn.access").disabled = True
        return logger


LOG = _configure_logging()


def _sync_sqlalchemy_url(database_url: str) -> str:
    """
    Convert an async driver URL into a sync SQLAlchemy URL for `create_all`.
    """
    if "+aiosqlite" in database_url:
        return database_url.replace("+aiosqlite", "")
    return database_url


if __name__ == "__main__":
    startup_start_time = time.time()

    load_dotenv(ROOT_DIR / ".env", override=False)
    load_dotenv(ROOT_DIR / ".env.local", override=True)

    from backend import database as db

    database_url = str(db.DATABASE_URL)
    LOG.info("Using SQLite database: %s", database_url)

    engine = sqlalchemy.create_engine(_sync_sqlalchemy_url(database_url), echo=False)
    table_creation_start = time.time()
    db.metadata.create_all(engine)
    LOG.debug(
        "Ensured %d tables (%dms)",
        len(db.metadata.tables),
        int((time.time() - table_creation_start) * 1000),
    )

    backend_host = os.getenv("BACKEND_HOST", "0.0.0.0")
    backend_port_raw = os.getenv("BACKEND_PORT") or os.getenv("PORT") or "8000"
    try:
        backend_port = int(backend_port_raw)
    except ValueError:
        LOG.warning("Invalid BACKEND_PORT='%s', defaulting to 8000", backend_port_raw)
        backend_port = 8000

    reload_env = os.getenv("BACKEND_RELOAD")
    if reload_env is None:
        enable_reload = backend_port != 8000
    else:
        enable_reload = reload_env.strip().lower() in {"1", "true", "yes", "on"}

    total_startup_ms = int((time.time() - startup_start_time) * 1000)
    LOG.info("Server starting (startup: %dms)", total_startup_ms)

    uvicorn_log_level = logging.getLevelName(LOG.getEffectiveLevel()).lower()
    uvicorn.run(
        UVICORN_APP_MODULE,
        host=backend_host,
        port=backend_port,
        reload=enable_reload,
        reload_excludes=[
            "*.db",
            "*.db-*",
            "*.sqlite",
            "*.sqlite-*",
            "*.sqlite3",
            "*.sqlite3-*",
            "*.log",
        ],
        log_level=uvicorn_log_level,
        access_log=False,
    )

