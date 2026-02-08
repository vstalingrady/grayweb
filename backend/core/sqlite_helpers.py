"""
SQLite migration and schema helpers.

Extracted from main.py to reduce its size and improve modularity.
"""
import sqlite3
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

# Enhanced logging imports
from backend.logging_config import create_logger

# Database URL import
from backend.database import DATABASE_URL

app_logger = create_logger("backend.sqlite")

def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _quote_identifier_list(identifiers: str) -> str:
    parts = [part.strip() for part in identifiers.split(",") if part.strip()]
    return ", ".join(_quote_identifier(part) for part in parts)


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
    quoted_table = _quote_identifier(table)
    try:
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if cursor.fetchone() is None:
                return
            cursor = conn.execute(f"PRAGMA table_info({quoted_table})")
            existing = {row[1] for row in cursor.fetchall()}
            added = False
            for col_name, col_type, default in columns:
                if col_name not in existing:
                    quoted_col = _quote_identifier(col_name)
                    default_clause = f" DEFAULT {default}" if default is not None else ""
                    conn.execute(
                        f"ALTER TABLE {quoted_table} ADD COLUMN {quoted_col} {col_type}{default_clause}"
                    )
                    added = True
            if added:
                conn.commit()
            # Backfill NULLs if specified
            if backfill_nulls:
                updates = ", ".join(
                    f"{_quote_identifier(col)} = COALESCE({_quote_identifier(col)}, {val})"
                    for col, val in backfill_nulls.items()
                )
                conn.execute(f"UPDATE {quoted_table} SET {updates}")
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
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
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
    quoted_table = _quote_identifier(table)
    try:
        conn = sqlite3.connect(db_path)
        try:
            # Check if table exists first
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            )
            if not cursor.fetchone():
                app_logger.info(f"Skipping index check; {table} table does not exist")
                return
            cursor = conn.execute(f"PRAGMA index_list({quoted_table})")
            indices = {row[1] for row in cursor.fetchall()}
            if index_name not in indices:
                app_logger.info(f"Creating missing index {index_name} on {table}.{column}")
                quoted_index = _quote_identifier(index_name)
                quoted_columns = _quote_identifier_list(column)
                conn.execute(f"CREATE INDEX {quoted_index} ON {quoted_table} ({quoted_columns})")
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


def ensure_sqlite_unique_index(
    table: str,
    index_name: str,
    columns: str,
    *,
    auto_dedupe: bool = False,
) -> None:
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
            non_null_predicate = " AND ".join(f"{quote(col)} IS NOT NULL" for col in normalized_columns)
            duplicates_query = (
                f"SELECT 1 FROM {quote(table)} "
                f"WHERE {non_null_predicate} "
                f"GROUP BY {placeholder_cols} "
                f"HAVING COUNT(*) > 1 LIMIT 1"
            )
            has_duplicates = conn.execute(duplicates_query).fetchone() is not None
            if has_duplicates and auto_dedupe:
                delete_duplicates_query = f"""
                    DELETE FROM {quote(table)}
                    WHERE rowid IN (
                        SELECT dup.rowid
                        FROM {quote(table)} AS dup
                        WHERE {non_null_predicate}
                          AND dup.rowid NOT IN (
                              SELECT MIN(base.rowid)
                              FROM {quote(table)} AS base
                              WHERE {non_null_predicate}
                              GROUP BY {placeholder_cols}
                          )
                    )
                """
                try:
                    result = conn.execute(delete_duplicates_query)
                    conn.commit()
                    deleted_rows = result.rowcount if result.rowcount is not None and result.rowcount >= 0 else 0
                    app_logger.warning(
                        "Deduplicated %s rows before creating UNIQUE index %s on %s",
                        deleted_rows,
                        index_name,
                        table,
                        extra={
                            "event_type": "sqlite_unique_index_deduplicated",
                            "table": table,
                            "deleted_rows": deleted_rows,
                        },
                    )
                except sqlite3.Error as exc:
                    app_logger.error(
                        "Failed to deduplicate rows before UNIQUE index creation",
                        extra={
                            "event_type": "sqlite_unique_index_deduplicate_failed",
                            "table": table,
                            "index": index_name,
                            "error": str(exc),
                        },
                    )
                has_duplicates = conn.execute(duplicates_query).fetchone() is not None

            if has_duplicates:
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

            retained_index_sql: List[str] = []
            index_rows = list(conn.execute(f"PRAGMA index_list({quote(table)})"))
            for _, index_name, *_ in index_rows:
                if str(index_name).startswith("sqlite_autoindex"):
                    continue
                index_info = list(conn.execute(f"PRAGMA index_info({quote(str(index_name))})"))
                index_columns = {info_row[2] for info_row in index_info if len(info_row) >= 3 and info_row[2]}
                if index_columns & columns_to_drop:
                    continue
                index_sql_row = conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type='index' AND name=?",
                    (str(index_name),),
                ).fetchone()
                if index_sql_row and index_sql_row[0]:
                    retained_index_sql.append(str(index_sql_row[0]))

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
            for index_sql in retained_index_sql:
                conn.execute(index_sql)
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
