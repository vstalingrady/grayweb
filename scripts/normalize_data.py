import sqlite3
import json
from dateutil import parser as date_parser
from datetime import datetime, timezone

DB_PATH = "../data/users.db"

def normalize_timestamp(ts_str):
    if not ts_str:
        return None
    try:
        # Parse using dateutil (handles space-separated, ISO, etc.)
        dt = date_parser.parse(ts_str)
        # Ensure UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        # Return strict ISO 8601 format
        return dt.isoformat()
    except Exception as e:
        print(f"Failed to parse timestamp '{ts_str}': {e}")
        return ts_str # Keep original if parsing fails

def normalize_db():
    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    # Enable accessing columns by name
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    tables_to_fix = [
        {"table": "general_chat_messages", "cols": ["created_at"]},
        {"table": "user_chat_messages", "cols": ["created_at"]},
        {"table": "users", "cols": ["created_at", "updated_at"]},
        {"table": "chat_sessions", "cols": ["created_at", "updated_at"]},
    ]

    for item in tables_to_fix:
        table = item["table"]
        cols = item["cols"]
        print(f"Processing table '{table}'...")
        
        try:
            # check if table exists
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cursor.fetchone():
                print(f"  Table '{table}' not found, skipping.")
                continue

            # Get all rows
            cursor.execute(f"SELECT rowid, * FROM {table}")
            rows = cursor.fetchall()
            
            if rows:
                print(f"  Debug: Keys in first row of {table}: {rows[0].keys()}")

            updates = 0
            for row in rows:
                try:
                    row_id = row['rowid']
                except IndexError:
                     # Fallback if rowid is not explicitly accessible by name (rare)
                     row_id = row[0]
                
                updates_for_row = {}
                
                # Timestamp columns
                for col in cols:
                    if col in row.keys() and row[col]:
                        original = row[col]
                        if isinstance(original, str):
                            normalized = normalize_timestamp(original)
                            if normalized and normalized != original:
                                updates_for_row[col] = normalized
                
                # JSON columns (specifically for users table)
                if table == "users" and "visible_model_ids" in row.keys():
                    val = row["visible_model_ids"]
                    if isinstance(val, str) and val.strip():
                        try:
                            # Verify if it loads as JSON
                            parsed = json.loads(val)
                            # Re-dump to ensure standard formatting (optional, but good for consistency)
                            normalized_json = json.dumps(parsed)
                            if normalized_json != val:
                                updates_for_row["visible_model_ids"] = normalized_json
                        except json.JSONDecodeError:
                            print(f"  Warning: Invalid JSON in user {row_id}: {val}")
                
                if updates_for_row:
                    set_clause = ", ".join([f"{k} = ?" for k in updates_for_row.keys()])
                    values = list(updates_for_row.values()) + [row_id]
                    cursor.execute(f"UPDATE {table} SET {set_clause} WHERE rowid = ?", values)
                    updates += 1
            
            print(f"  Updated {updates} rows in '{table}'.")
            
        except Exception as e:
            print(f"Error processing table {table}: {e}")

    conn.commit()
    conn.close()
    print("Database normalization complete.")

if __name__ == "__main__":
    normalize_db()
