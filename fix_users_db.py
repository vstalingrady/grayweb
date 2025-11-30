import sqlite3

# Target the actual database being used by the backend
DB_PATH = "backend/users.db"

print(f"Connecting to {DB_PATH}...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

try:
    # Check existing columns
    cursor.execute("PRAGMA table_info(users)")
    columns = {row[1] for row in cursor.fetchall()}
    print(f"Found {len(columns)} columns in users table")

    if "daily_gemini_pro_usage" not in columns:
        print("Adding daily_gemini_pro_usage column...")
        cursor.execute("ALTER TABLE users ADD COLUMN daily_gemini_pro_usage INTEGER DEFAULT 0")
        print("✓ Added daily_gemini_pro_usage")
    else:
        print("✓ daily_gemini_pro_usage already exists")

    if "last_daily_gemini_pro_reset" not in columns:
        print("Adding last_daily_gemini_pro_reset column...")
        cursor.execute("ALTER TABLE users ADD COLUMN last_daily_gemini_pro_reset TEXT")
        print("✓ Added last_daily_gemini_pro_reset")
    else:
        print("✓ last_daily_gemini_pro_reset already exists")

    # Initialize nulls
    cursor.execute("UPDATE users SET daily_gemini_pro_usage = 0 WHERE daily_gemini_pro_usage IS NULL")
    
    conn.commit()
    print("\n✅ Migration completed successfully!")
    
    # Verify
    cursor.execute("PRAGMA table_info(users)")
    columns_after = {row[1] for row in cursor.fetchall()}
    if "daily_gemini_pro_usage" in columns_after and "last_daily_gemini_pro_reset" in columns_after:
        print("✅ Verification: Both columns exist in the database")
    else:
        print("❌ Verification failed: Columns missing")

except Exception as e:
    print(f"❌ An error occurred: {e}")
    conn.rollback()
finally:
    conn.close()
