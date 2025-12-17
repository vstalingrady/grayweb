"""
SQLite migration and schema helpers.

Extracted from main.py to reduce its size and improve modularity.
"""
import sqlite3
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

# Enhanced logging imports
try:
    from backend.logging_config import create_logger
except ImportError:
    from logging_config import create_logger

# Database URL import
try:
    from backend.database import DATABASE_URL
except ImportError:
    from database import DATABASE_URL

app_logger = create_logger("backend.sqlite")


def _get_db_path() -> Optional[str]:
    """Extract the SQLite database path from DATABASE_URL."""
    if not DATABASE_URL.startswith("sqlite"):
        return None
    db_path = DATABASE_URL.replace("sqlite:///", "", 1)
    return db_path if db_path else None


def ensure_sqlite_columns(
    table: str,
    columns: List[Tuple[str, str, Optional[str]]],
    backfill_nulls: Optional[Dict[str, str]] = None,
) -> None:
    """
    Add missing columns to a SQLite table.

    Args:
        table: Table name
        columns: List of (column_name, column_type, default_value) tuples
        backfill_nulls: Optional dict of {column: default_value} for NULL backfill
    """
    db_path = _get_db_path()
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if cursor.fetchone() is None:
                return
            cursor = conn.execute(f"PRAGMA table_info({table})")
            existing = {row[1] for row in cursor.fetchall()}
            added = False
            for col_name, col_type, default in columns:
                if col_name not in existing:
                    default_clause = f" DEFAULT {default}" if default is not None else ""
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}{default_clause}")
                    added = True
            if added:
                conn.commit()
            # Backfill NULLs if specified
            if backfill_nulls:
                updates = ", ".join(f"{col} = COALESCE({col}, {val})" for col, val in backfill_nulls.items())
                conn.execute(f"UPDATE {table} SET {updates}")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite migration failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def ensure_sqlite_table(table: str, create_sql: str) -> None:
    """Create a SQLite table if it doesn't exist."""
    db_path = _get_db_path()
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                conn.execute(create_sql)
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite table creation failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def ensure_sqlite_index(table: str, index_name: str, column: str) -> None:
    """Create a SQLite index if it doesn't exist."""
    db_path = _get_db_path()
    if not db_path:
        return
    try:
        conn = sqlite3.connect(db_path)
        try:
            # Check if table exists first
            cursor = conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                app_logger.info(f"Skipping index check; {table} table does not exist")
                return
            cursor = conn.execute(f"PRAGMA index_list({table})")
            indices = {row[1] for row in cursor.fetchall()}
            if index_name not in indices:
                app_logger.info(f"Creating missing index {index_name} on {table}.{column}")
                conn.execute(f"CREATE INDEX {index_name} ON {table} ({column})")
                conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite index creation failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def rename_sqlite_column_if_needed(table: str, old_name: str, new_name: str) -> None:
    """Rename a SQLite column when upgrading from a bad schema (best effort)."""
    db_path = _get_db_path()
    if not db_path:
        return

    def quote(ident: str) -> str:
        return '"' + ident.replace('"', '""') + '"'

    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if cursor.fetchone() is None:
                return

            cursor = conn.execute(f"PRAGMA table_info({quote(table)})")
            existing = {row[1] for row in cursor.fetchall()}
            if old_name not in existing or new_name in existing:
                return

            conn.execute(
                f"ALTER TABLE {quote(table)} RENAME COLUMN {quote(old_name)} TO {quote(new_name)}"
            )
            conn.commit()
            app_logger.info(
                "Renamed SQLite column %s.%s -> %s",
                table,
                old_name,
                new_name,
                extra={"event_type": "sqlite_column_rename", "table": table},
            )
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite column rename failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def ensure_sqlite_unique_index(table: str, index_name: str, columns: str) -> None:
    """Create a UNIQUE index if it doesn't exist and the table has no duplicates."""
    db_path = _get_db_path()
    if not db_path:
        return

    def quote(ident: str) -> str:
        return '"' + ident.replace('"', '""') + '"'

    normalized_columns = [c.strip() for c in columns.split(",") if c.strip()]
    if not normalized_columns:
        return

    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if cursor.fetchone() is None:
                return

            cursor = conn.execute(f"PRAGMA index_list({quote(table)})")
            for row in cursor.fetchall():
                existing_name = row[1]
                is_unique = bool(row[2])
                if not is_unique:
                    continue
                info_rows = conn.execute(f"PRAGMA index_info({quote(existing_name)})").fetchall()
                existing_cols = [r[2] for r in sorted(info_rows, key=lambda v: v[0])]
                if existing_cols == normalized_columns:
                    return

            placeholder_cols = ", ".join(quote(col) for col in normalized_columns)
            duplicates_query = (
                f"SELECT 1 FROM {quote(table)} GROUP BY {placeholder_cols} HAVING COUNT(*) > 1 LIMIT 1"
            )
            if conn.execute(duplicates_query).fetchone() is not None:
                app_logger.warning(
                    "Skipping UNIQUE index %s on %s because duplicates exist",
                    index_name,
                    table,
                    extra={"event_type": "sqlite_unique_index_skipped", "table": table},
                )
                return

            conn.execute(
                f"CREATE UNIQUE INDEX {quote(index_name)} ON {quote(table)} ({placeholder_cols})"
            )
            conn.commit()
            app_logger.info(
                "Created UNIQUE index %s on %s (%s)",
                index_name,
                table,
                ", ".join(normalized_columns),
                extra={"event_type": "sqlite_index_created", "table": table},
            )
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite unique index creation failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def drop_sqlite_table(table: str) -> None:
    """Drop a SQLite table if it exists (best effort)."""
    db_path = _get_db_path()
    if not db_path:
        return
    quoted = '"' + table.replace('"', '""') + '"'
    try:
        conn = sqlite3.connect(db_path)
        try:
            conn.execute(f"DROP TABLE IF EXISTS {quoted}")
            conn.commit()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite table drop failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


def rebuild_sqlite_table_without_columns(table: str, columns_to_drop: set) -> None:
    """Rebuild a SQLite table without selected columns (best effort)."""
    db_path = _get_db_path()
    if not db_path:
        return

    def quote(ident: str) -> str:
        return '"' + ident.replace('"', '""') + '"'

    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name={quote(table)}")
            if not cursor.fetchone():
                return

            table_info = list(conn.execute(f"PRAGMA table_info({quote(table)})"))
            if not table_info:
                return

            existing_columns = {row[1] for row in table_info}
            if not (existing_columns & columns_to_drop):
                return

            keep_columns = [row for row in table_info if row[1] not in columns_to_drop]
            if not keep_columns:
                return

            temp_table = f"{table}__tmp_{uuid4().hex[:8]}"

            column_defs: List[str] = []
            pk_columns: List[str] = []
            for _, name, col_type, notnull, default, pk in keep_columns:
                col_sql_parts = [quote(str(name)), str(col_type or "TEXT")]
                if int(notnull) == 1:
                    col_sql_parts.append("NOT NULL")
                if default is not None:
                    col_sql_parts.append(f"DEFAULT {default}")
                if int(pk) > 0:
                    pk_columns.append(str(name))
                column_defs.append(" ".join(col_sql_parts))

            pk_sql = ""
            if pk_columns:
                pk_sql = f", PRIMARY KEY ({', '.join(quote(name) for name in pk_columns)})"

            conn.execute("BEGIN")
            conn.execute(f"CREATE TABLE {quote(temp_table)} ({', '.join(column_defs)}{pk_sql})")

            keep_column_names = [row[1] for row in keep_columns]
            select_cols = ", ".join(quote(name) for name in keep_column_names)
            conn.execute(
                f"INSERT INTO {quote(temp_table)} ({select_cols}) SELECT {select_cols} FROM {quote(table)}"
            )
            conn.execute(f"DROP TABLE {quote(table)}")
            conn.execute(f"ALTER TABLE {quote(temp_table)} RENAME TO {quote(table)}")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except sqlite3.Error as exc:
        app_logger.error(
            "SQLite table rebuild failed",
            extra={"event_type": "sqlite_migration_error", "table": table, "error": str(exc)},
        )


# Backwards compatibility aliases (with underscore prefix for internal use)
_ensure_sqlite_columns = ensure_sqlite_columns
_ensure_sqlite_table = ensure_sqlite_table
_ensure_sqlite_index = ensure_sqlite_index
_rename_sqlite_column_if_needed = rename_sqlite_column_if_needed
_ensure_sqlite_unique_index = ensure_sqlite_unique_index
_drop_sqlite_table = drop_sqlite_table
_rebuild_sqlite_table_without_columns = rebuild_sqlite_table_without_columns
