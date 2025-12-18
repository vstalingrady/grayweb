#!/usr/bin/env python3
"""Dev wrapper for arq workers with auto-reload.

Runs the arq worker and restarts it when backend Python files change.
This is meant for local/dev use only.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from watchfiles import Change, DefaultFilter, run_process


ROOT_DIR = Path(__file__).resolve().parent
_DEFAULT_FILTER = DefaultFilter()
_IGNORED_SUFFIXES = (
    ".db",
    ".db-wal",
    ".db-shm",
    ".db-journal",
    ".sqlite",
    ".sqlite-wal",
    ".sqlite-shm",
    ".sqlite3",
    ".sqlite3-wal",
    ".sqlite3-shm",
    ".log",
)


def _watch_filter(change: Change, path: str) -> bool:
    if not _DEFAULT_FILTER(change, path):
        return False
    lowered = path.lower()
    if lowered.endswith(_IGNORED_SUFFIXES):
        return False
    return True


def main() -> int:
    arq_command = os.getenv("ARQ_COMMAND")
    if not arq_command:
        arq_command = f"{sys.executable} -m arq job_scheduler.WorkerSettings"

    os.environ["PYTHONPATH"] = str(ROOT_DIR.parent)

    return run_process(
        str(ROOT_DIR),
        target=arq_command,
        target_type="command",
        watch_filter=_watch_filter,
    )


if __name__ == "__main__":
    raise SystemExit(main())

