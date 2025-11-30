import sqlite3
import json

def check_duplicates():
    conn = sqlite3.connect("gray.db") # Backend usually uses gray.db or users.db? 
    # backend/database.py uses 'gray.db' (or whatever DATABASE_URL points to)
    # The logs show "sqlite" usage.
    # Let's check gray.db first.
    
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, email FROM users WHERE email LIKE '%cornermaniac%' OR email LIKE '%vstalin%'")
        users = cursor.fetchall()
        print("Users found:", users)
        
        for user_id, email in users:
            print(f"\nChecking messages for User {user_id} ({email})...")
            cursor.execute("SELECT content, count(*) FROM general_chat_messages WHERE user_id = ? GROUP BY content HAVING count(*) > 1", (user_id,))
            dupes = cursor.fetchall()
            if dupes:
                print(f"Found {len(dupes)} duplicated content groups.")
                for content, count in dupes[:5]:
                    print(f"  - '{content[:50]}' appears {count} times")
            else:
                print("No exact content duplicates found in SQLite.")
                
            cursor.execute("SELECT count(*) FROM general_chat_messages WHERE user_id = ?", (user_id,))
            total = cursor.fetchone()[0]
            print(f"Total messages: {total}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_duplicates()
