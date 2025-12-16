
import sqlite3
import os

DB_PATH = "/home/vstaln/gray/backend/users.db"

def check_all_users():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, email, full_name, plan_tier, auth_user_id, created_at FROM users")
        users = cursor.fetchall()
        
        if not users:
            print("No users found.")
        else:
            print(f"Found {len(users)} users:")
            for user in users:
                print(f"ID: {user[0]}, Email: {user[1]}, Name: {user[2]}, Plan: {user[3]}, AuthID: {user[4]}")
                
        conn.close()
    except Exception as e:
        print(f"Error reading database: {e}")

if __name__ == "__main__":
    check_all_users()
