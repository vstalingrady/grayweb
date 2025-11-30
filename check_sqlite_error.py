import sqlite3

try:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE users (id INTEGER)")
    conn.execute("SELECT daily_gemini_pro_usage FROM users")
except Exception as e:
    print(f"SQLite Error: {e}")
