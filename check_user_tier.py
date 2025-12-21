import sqlite3
import os

DB_PATH = 'backend/users.db'

def check_user_tier(email):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT email, role, plan_tier FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if user:
            print(f"User found: Email={user[0]}, Role={user[1]}, Plan Tier={user[2]}")
        else:
            print(f"User with email {email} not found.")
            
    except Exception as e:
        print(f"Error querying database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_user_tier("vstalingrady@gmail.com")
