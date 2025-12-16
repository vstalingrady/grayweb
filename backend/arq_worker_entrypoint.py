#!/usr/bin/env python3
from __future__ import annotations

import asyncio

from arq.worker import run_worker

from job_scheduler import WorkerSettings


def _ensure_default_event_loop() -> None:
    try:
        asyncio.get_event_loop()
        return
    except RuntimeError:
        pass

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)


def main() -> None:
    # Python 3.12+ no longer creates a default event loop automatically.
    # `arq.Worker` still calls `asyncio.get_event_loop()` during init.
    _ensure_default_event_loop()
    run_worker(WorkerSettings)


if __name__ == "__main__":
    main()

