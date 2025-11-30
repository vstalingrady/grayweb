import sqlite3
import os

DB_PATHS = ["/home/ubuntu/gray/backend/users.db", "/home/ubuntu/gray/users.db"]

def check_and_delete():
    for DB_PATH in DB_PATHS:
        print(f"Checking {DB_PATH}...")
        if not os.path.exists(DB_PATH):
            print(f"DB not found at {DB_PATH}")
            continue

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Check user
            try:
                cursor.execute("SELECT id, email, auth_user_id FROM users")
                rows = cursor.fetchall()
                print(f"All users in {DB_PATH}:")
                for row in rows:
                    print(row)
                
                cursor.execute("SELECT * FROM users WHERE email = 'cornermaniac777@gmail.com'")
                rows = cursor.fetchall()
            except sqlite3.OperationalError as e:
                print(f"Error querying users table: {e}")
                conn.close()
                continue
            
            if rows:
                print(f"Found {len(rows)} user(s) in {DB_PATH}:")
                for row in rows:
                    print(row)
                    user_id = row[0] # Assuming id is first column
                    
                    # Get table names
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                    tables = [r[0] for r in cursor.fetchall()]
                    
                    # Try to delete from known tables
                    tables_to_clean = [
                        "chat_sessions", "calendar_events", "calendars", "plans", "habits", 
                        "reminders", "dashboard_pulses", "user_streaks", "context_cache", 
                        "file_search_stores", "media_uploads", "proactivity_logs", 
                        "proactivity_settings", "proactive_notifications", 
                        "google_calendar_credentials", "proactivity_push_subscriptions", 
                        "general_chat_messages", "user_chat_threads", "user_data",
                        "user_chat_messages"
                    ]
                    
                    for table in tables_to_clean:
                        if table in tables:
                            try:
                                cursor.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))
                                print(f"Deleted from {table}")
                            except Exception as e:
                                print(f"Error deleting from {table}: {e}")
                    
                    # Delete user
                    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
                    print(f"Deleted user {user_id} from users")
                    
                conn.commit()
                print("Changes committed.")
            else:
                print(f"User NOT found in {DB_PATH}.")
                
            conn.close()
        except Exception as e:
            print(f"Error processing {DB_PATH}: {e}")

if __name__ == "__main__":
    check_and_delete()
