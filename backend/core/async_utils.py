"""Async helpers for background task safety."""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Optional, TypeVar

T = TypeVar("T")


def create_logged_task(
    coro: Awaitable[T],
    *,
    logger: logging.Logger,
    name: Optional[str] = None,
) -> "asyncio.Task[T]":
    """
    Create a background task and ensure unhandled exceptions are logged.

    Use this instead of bare `asyncio.create_task()` for fire-and-forget tasks.
    """
    task: asyncio.Task[T]
    if name:
        task = asyncio.create_task(coro, name=name)
    else:
        task = asyncio.create_task(coro)

    def _log_failure(done_task: "asyncio.Task[T]") -> None:
        try:
            exc = done_task.exception()
        except asyncio.CancelledError:
            return
        except Exception as callback_error:  # pragma: no cover
            logger.error(
                "Background task callback failed: %s",
                callback_error,
                exc_info=True,
            )
            return

        if exc is None:
            return

        logger.error(
            "Background task failed: %s",
            exc,
            exc_info=(type(exc), exc, exc.__traceback__),
        )

    task.add_done_callback(_log_failure)
    return task

