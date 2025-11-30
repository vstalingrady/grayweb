import sqlite3
import os

# Target the gray.db file which is the fallback default
DB_PATH = "backend/gray.db"

def fix_sqlite_db():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(users)")
        columns = {row[1] for row in cursor.fetchall()}
        print(f"Existing columns: {columns}")

        if "daily_gemini_pro_usage" not in columns:
            print("Adding daily_gemini_pro_usage column...")
            cursor.execute("ALTER TABLE users ADD COLUMN daily_gemini_pro_usage INTEGER DEFAULT 0")
        else:
            print("daily_gemini_pro_usage column already exists.")

        if "last_daily_gemini_pro_reset" not in columns:
            print("Adding last_daily_gemini_pro_reset column...")
            cursor.execute("ALTER TABLE users ADD COLUMN last_daily_gemini_pro_reset TEXT")
        else:
            print("last_daily_gemini_pro_reset column already exists.")

        # Initialize nulls
        cursor.execute("UPDATE users SET daily_gemini_pro_usage = 0 WHERE daily_gemini_pro_usage IS NULL")
        
        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix_sqlite_db()
