
import sqlite3
import os

DB_PATH = "/home/vstaln/gray/data/users.db"

def upgrade_users():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Upgrade all users with "Vstalin Grady" name to pioneer
        cursor.execute("UPDATE users SET plan_tier = 'pioneer' WHERE full_name LIKE '%Vstalin Grady%'")
        rows = cursor.rowcount
        conn.commit()
        
        print(f"Updated {rows} users to Pioneer plan.")
        
        # Verify
        cursor.execute("SELECT id, email, full_name, plan_tier FROM users WHERE full_name LIKE '%Vstalin Grady%'")
        users = cursor.fetchall()
        for user in users:
            print(f"ID: {user[0]}, Email: {user[1]}, Name: {user[2]}, Plan: {user[3]}")
            
        conn.close()
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    upgrade_users()
