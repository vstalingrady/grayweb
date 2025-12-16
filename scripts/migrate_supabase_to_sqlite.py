"""
One-time migration: Supabase (Postgres) app tables -> local SQLite.

Supabase is intended to be auth-only at runtime. If you previously stored
application data in Supabase public tables, run this before dropping them.

Typical usage (dry run first):
  python scripts/migrate_supabase_to_sqlite.py --dry-run --sqlite-path ./backend/users.db

Then apply:
  python scripts/migrate_supabase_to_sqlite.py --sqlite-path ./backend/users.db
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import sqlalchemy
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import (
    calendars,
    calendar_events,
    context_cache,
    dashboard_pulses,
    file_search_stores,
    general_chat_messages,
    habits,
    media_uploads,
    metadata,
    plans,
    proactive_notifications,
    proactivity_logs,
    proactivity_push_subscriptions,
    proactivity_settings,
    reminders,
    user_chat_messages,
    user_chat_threads,
    user_data,
    user_streaks,
    users,
)
from backend.supabase_utils import create_supabase_service_client, resolve_supabase_credentials


@dataclass(frozen=True)
class TableSpec:
    name: str
    table: sqlalchemy.Table


TABLE_SPECS: Tuple[TableSpec, ...] = (
    TableSpec("users", users),
    TableSpec("user_data", user_data),
    TableSpec("user_streaks", user_streaks),
    TableSpec("user_chat_threads", user_chat_threads),
    TableSpec("user_chat_messages", user_chat_messages),
    TableSpec("general_chat_messages", general_chat_messages),
    TableSpec("plans", plans),
    TableSpec("habits", habits),
    TableSpec("reminders", reminders),
    TableSpec("proactivity_settings", proactivity_settings),
    TableSpec("proactive_notifications", proactive_notifications),
    TableSpec("proactivity_logs", proactivity_logs),
    TableSpec("proactivity_push_subscriptions", proactivity_push_subscriptions),
    TableSpec("dashboard_pulses", dashboard_pulses),
    TableSpec("calendars", calendars),
    TableSpec("calendar_events", calendar_events),
    TableSpec("context_cache", context_cache),
    TableSpec("file_search_stores", file_search_stores),
    TableSpec("media_uploads", media_uploads),
)


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate Supabase public tables to local SQLite (Supabase becomes auth-only).",
    )
    parser.add_argument(
        "--sqlite-path",
        type=str,
        default=None,
        help="Target SQLite DB filepath (defaults to env DATABASE_URL/LOCAL_DATABASE_URL or ./backend/users.db).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and report counts without writing anything to SQLite.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Disable the automatic SQLite file backup before writing.",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="Rows per page when reading from Supabase (default: 1000).",
    )
    parser.add_argument(
        "--tables",
        type=str,
        default=None,
        help="Comma-separated list of table names to migrate (default: all supported tables).",
    )
    return parser.parse_args(argv)


def _sqlite_path_from_env() -> Path:
    sqlite_db_path = (os.getenv("SQLITE_DB_PATH") or "").strip()
    if sqlite_db_path:
        return Path(sqlite_db_path).expanduser()

    for url_var in ("LOCAL_DATABASE_URL", "DATABASE_URL"):
        candidate = (os.getenv(url_var) or "").strip()
        if candidate.startswith("sqlite:///"):
            raw_path = candidate.replace("sqlite:///", "", 1)
            return Path(raw_path).expanduser()
        if candidate.startswith("sqlite:////"):
            raw_path = candidate.replace("sqlite:////", "/", 1)
            return Path(raw_path).expanduser()

    return Path("./backend/users.db")


def _sqlite_url_from_path(sqlite_path: Path) -> str:
    path_str = str(sqlite_path)
    # For absolute paths, this yields `sqlite:////abs/path` (correct).
    return f"sqlite:///{path_str}"


def _timestamp_suffix() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _maybe_backup_sqlite(sqlite_path: Path) -> Optional[Path]:
    if not sqlite_path.exists():
        return None
    if sqlite_path.is_dir():
        raise ValueError(f"--sqlite-path must be a file, got directory: {sqlite_path}")
    backup_path = sqlite_path.with_suffix(sqlite_path.suffix + f".bak_migration_{_timestamp_suffix()}")
    shutil.copy2(sqlite_path, backup_path)
    return backup_path


def _normalize_datetime(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        normalized = trimmed.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(normalized)
        except ValueError:
            return value
    else:
        return value

    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _maybe_parse_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        if trimmed[0] not in ("{", "["):
            return value
        try:
            return json.loads(trimmed)
        except json.JSONDecodeError:
            return value
    return value


def _normalize_row_for_table(table: sqlalchemy.Table, row: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    for column in table.columns:
        value = row.get(column.name)
        if isinstance(column.type, sqlalchemy.DateTime):
            normalized[column.name] = _normalize_datetime(value)
        elif isinstance(column.type, sqlalchemy.JSON):
            normalized[column.name] = _maybe_parse_json(value)
        else:
            normalized[column.name] = value
    return normalized


def _supabase_fetch_pages(
    *,
    supabase_client: Any,
    table_name: str,
    page_size: int,
) -> Iterable[List[Dict[str, Any]]]:
    offset = 0
    while True:
        try:
            response = (
                supabase_client.table(table_name)
                .select("*")
                .range(offset, offset + page_size - 1)
                .execute()
            )
        except Exception as exc:
            raise RuntimeError(f"Supabase read failed for table '{table_name}': {exc}") from exc

        data = getattr(response, "data", None)
        error = getattr(response, "error", None)
        if error:
            raise RuntimeError(f"Supabase read failed for table '{table_name}': {error}")
        rows = data or []
        if not rows:
            return
        yield rows
        if len(rows) < page_size:
            return
        offset += page_size


def _sqlite_upsert_rows(
    *,
    conn: sqlalchemy.Connection,
    table: sqlalchemy.Table,
    rows: List[Dict[str, Any]],
) -> int:
    primary_keys = [column.name for column in table.primary_key.columns]
    if not primary_keys:
        stmt = sqlite_insert(table).prefix_with("OR IGNORE")
        result = conn.execute(stmt, rows)
        return int(getattr(result, "rowcount", 0) or 0)

    stmt = sqlite_insert(table)
    update_columns = {
        column.name: stmt.excluded[column.name]
        for column in table.columns
        if column.name not in primary_keys
    }
    stmt = stmt.on_conflict_do_update(index_elements=primary_keys, set_=update_columns)
    result = conn.execute(stmt, rows)
    return int(getattr(result, "rowcount", 0) or 0)


def _select_table_specs(selection: Optional[str]) -> List[TableSpec]:
    if not selection:
        return list(TABLE_SPECS)
    wanted = {name.strip() for name in selection.split(",") if name.strip()}
    resolved = [spec for spec in TABLE_SPECS if spec.name in wanted]
    missing = sorted(wanted.difference({spec.name for spec in TABLE_SPECS}))
    if missing:
        raise ValueError(f"Unknown table(s): {', '.join(missing)}")
    return resolved


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(list(argv or sys.argv[1:]))

    sqlite_path = Path(args.sqlite_path).expanduser() if args.sqlite_path else _sqlite_path_from_env()
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    sqlite_url = _sqlite_url_from_path(sqlite_path.resolve())

    supabase_client, key_source = create_supabase_service_client()
    if supabase_client is None:
        url, key, key_env = resolve_supabase_credentials()
        hint_key = key_env or key_source or "SUPABASE_SERVICE_ROLE_KEY"
        print("❌ Supabase service credentials not configured.", file=sys.stderr)
        print(f"   - SUPABASE_URL={url or '<missing>'}", file=sys.stderr)
        print(f"   - {hint_key}={('<missing>' if not key else '<set>')}", file=sys.stderr)
        print("   Provide a service-role key (preferred) to bypass RLS during migration.", file=sys.stderr)
        return 2

    selected_specs = _select_table_specs(args.tables)

    if not args.dry_run and not args.no_backup:
        backup = _maybe_backup_sqlite(sqlite_path)
        if backup:
            print(f"✅ Backed up SQLite DB to: {backup}")

    engine = sqlalchemy.create_engine(sqlite_url, future=True)
    metadata.create_all(engine)

    print(f"SQLite target: {sqlite_path.resolve()}")
    print(f"Supabase source tables: {', '.join(spec.name for spec in selected_specs)}")

    totals: Dict[str, int] = {}
    for spec in selected_specs:
        total_rows = 0
        written_rows = 0
        print(f"\n== {spec.name} ==")
        try:
            for page in _supabase_fetch_pages(
                supabase_client=supabase_client,
                table_name=spec.name,
                page_size=args.page_size,
            ):
                normalized_page = [_normalize_row_for_table(spec.table, row) for row in page]
                total_rows += len(normalized_page)
                if args.dry_run:
                    continue
                with engine.begin() as conn:
                    written_rows += _sqlite_upsert_rows(conn=conn, table=spec.table, rows=normalized_page)
                print(f"  migrated {total_rows} rows...", flush=True)
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            if "pgrst205" in lowered or "could not find the table" in lowered:
                print(f"  skipped (table missing in Supabase): {spec.name}")
                continue
            if "permission denied" in lowered or "not authorized" in lowered:
                print(f"  skipped (permission denied): {spec.name}")
                continue
            raise

        totals[spec.name] = written_rows if not args.dry_run else total_rows
        if args.dry_run:
            print(f"  would migrate {total_rows} rows")
        else:
            print(f"  migrated {written_rows} rows")

    print("\n== Summary ==")
    for name, count in totals.items():
        action = "would_migrate" if args.dry_run else "migrated"
        print(f"{action} {name}: {count}")

    if args.dry_run:
        print("\nDry run only; no SQLite changes were made.")
    else:
        print("\nDone. You can now remove/drop Supabase public tables if desired.")
        print("Supabase auth (auth.users) is unaffected by dropping public tables.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
