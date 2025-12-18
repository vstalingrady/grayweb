#!/usr/bin/env python3
"""
Backfill existing plans/habits/reminders from the local SQLite database into Supabase.

Usage:
  export DATABASE_URL=sqlite:////absolute/path/to/data/users.db
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...
  python scripts/backfill_plans_habits_reminders.py
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, Iterable, List, Sequence

from supabase import Client, create_client


def _ensure_iso(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _maybe_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _chunked(seq: Sequence[Dict[str, Any]], size: int) -> Iterable[List[Dict[str, Any]]]:
    for index in range(0, len(seq), size):
        yield seq[index : index + size]


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _resolve_sqlite_path(database_url: str) -> str:
    if database_url.startswith("sqlite:///"):
        return database_url.replace("sqlite:///", "", 1)
    if database_url.startswith("sqlite:////"):
        return database_url.replace("sqlite:////", "/", 1)
    raise RuntimeError(
        f"Unsupported DATABASE_URL '{database_url}'. Expected sqlite:///path/to/db."
    )


def _fetch_rows(conn: sqlite3.Connection, table: str) -> List[Dict[str, Any]]:
    cursor = conn.execute(f"SELECT * FROM {table}")
    column_names = [desc[0] for desc in cursor.description]
    rows = []
    for raw in cursor.fetchall():
        record = {column_names[index]: raw[index] for index in range(len(column_names))}
        rows.append(record)
    return rows


def _normalize_plan_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for row in rows:
        normalized.append(
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "label": row["label"],
                "completed": bool(row.get("completed", False)),
                "deadline": row.get("deadline"),
                "schedule_slot": row.get("schedule_slot"),
                "description": row.get("description"),
                "created_at": _ensure_iso(row.get("created_at")),
                "updated_at": _ensure_iso(row.get("updated_at")),
            }
        )
    return normalized


def _normalize_habit_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for row in rows:
        normalized.append(
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "label": row["label"],
                "previous_label": row["previous_label"],
                "description": row.get("description"),
                "created_at": _ensure_iso(row.get("created_at")),
                "updated_at": _ensure_iso(row.get("updated_at")),
            }
        )
    return normalized


def _normalize_reminder_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for row in rows:
        normalized.append(
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "entity_type": row.get("entity_type"),
                "entity_id": row.get("entity_id"),
                "delivery_mode": row.get("delivery_mode"),
                "label": row["label"],
                "description": row.get("description"),
                "summary": row.get("summary"),
                "remind_at": _ensure_iso(row.get("remind_at")),
                "status": row.get("status") or "pending",
                "metadata": _maybe_json(row.get("metadata")),
                "created_at": _ensure_iso(row.get("created_at")),
                "updated_at": _ensure_iso(row.get("updated_at")),
                "delivered_at": _ensure_iso(row.get("delivered_at")),
            }
        )
    return normalized


def _upsert_rows(client: Client, table: str, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        print(f"[skip] No rows to backfill for {table}")
        return
    print(f"[info] Backfilling {len(rows)} {table} rows...")
    for chunk in _chunked(rows, 500):
        client.table(table).upsert(chunk, on_conflict="id").execute()
    print(f"[done] Completed {table}")


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "sqlite:///data/users.db")
    sqlite_path = _resolve_sqlite_path(database_url)
    supabase_url = _require_env("SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or _require_env("SUPABASE_SERVICE_ROLE_KEY")
    )

    client = create_client(supabase_url, supabase_key)
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row

    plan_rows = _normalize_plan_rows(_fetch_rows(conn, "plans"))
    habit_rows = _normalize_habit_rows(_fetch_rows(conn, "habits"))
    reminder_rows = _normalize_reminder_rows(_fetch_rows(conn, "reminders"))

    _upsert_rows(client, "plans", plan_rows)
    _upsert_rows(client, "habits", habit_rows)
    _upsert_rows(client, "reminders", reminder_rows)

    print("Backfill complete.")


if __name__ == "__main__":
    main()
