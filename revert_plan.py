
import sqlite3
import os

DB_PATH = "/home/vstaln/gray/data/users.db"

def revert_user():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Revert richclinton900@gmail.com to scout
        cursor.execute("UPDATE users SET plan_tier = 'scout' WHERE email = 'richclinton900@gmail.com'")
        rows = cursor.rowcount
        conn.commit()
        
        print(f"Reverted {rows} user(s) to Scout plan.")
        
        # Verify
        cursor.execute("SELECT id, email, full_name, plan_tier FROM users WHERE email = 'richclinton900@gmail.com'")
        user = cursor.fetchone()
        if user:
            print(f"ID: {user[0]}, Email: {user[1]}, Name: {user[2]}, Plan: {user[3]}")
            
        conn.close()
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    revert_user()
