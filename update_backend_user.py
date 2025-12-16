
import sqlite3
import os

DB_PATH = "/home/vstaln/gray/backend/users.db"

def update_backend_user():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        email = "test@test.com"
        
        cursor.execute("UPDATE users SET plan_tier = 'pioneer' WHERE email = ?", (email,))
        rows = cursor.rowcount
        conn.commit()
        
        if rows > 0:
            print(f"Updated {rows} user(s) to Pioneer in backend/users.db")
        else:
            print(f"User {email} not found in backend/users.db")
            
        # Verify
        cursor.execute("SELECT id, email, plan_tier FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if row:
            print(f"VERIFICATION: ID={row[0]}, Email={row[1]}, Plan={row[2]}")

        conn.close()
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    update_backend_user()
