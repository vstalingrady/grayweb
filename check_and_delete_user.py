#!/usr/bin/env python3
"""
Script to check and delete all records for cornermaniac777@gmail.com
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import asyncio

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

sys.path.insert(0, str(ROOT_DIR / "backend"))

from supabase_utils import create_supabase_service_client

async def main():
    admin_client, key_source = create_supabase_service_client()
    
    if not admin_client:
        print("❌ No admin Supabase client available")
        return 1
    
    print(f"✓ Using admin client (key source: {key_source})")
    
    target_email = "cornermaniac777@gmail.com"
    
    # Check and delete from Auth
    try:
        response = admin_client.auth.admin.list_users()
        users = getattr(response, "users", []) or []
        
        auth_user = None
        for user in users:
            if hasattr(user, "email") and user.email == target_email:
                auth_user = user
                break
        
        if auth_user:
            print(f"Found Auth user: {auth_user.id}")
            admin_client.auth.admin.delete_user(auth_user.id)
            print(f"✅ Deleted Auth user {auth_user.id}")
        else:
            print(f"✓ No Auth user found for {target_email}")
    except Exception as e:
        print(f"Error checking Auth: {e}")
    
    # Check and delete from database users table
    try:
        db_user = admin_client.table("users").select("*").eq("email", target_email).execute()
        
        if db_user.data:
            user_id = db_user.data[0]["id"]
            print(f"\nFound database user: {user_id}")
            print(f"User data: {db_user.data[0]}")
            
            # Delete all related records
            tables_to_clean = [
                "chat_sessions",
                "calendar_events", 
                "calendars",
                "plans",
                "habits",
                "reminders",
                "dashboard_pulses",
                "user_streaks",
                "context_cache",
                "file_search_stores",
                "media_uploads",
                "proactivity_logs",
                "proactivity_settings",
                "proactive_notifications",
                "google_calendar_credentials",
                "proactivity_push_subscriptions",
                "general_chat_messages",
                "user_chat_threads",
            ]
            
            for table in tables_to_clean:
                try:
                    result = admin_client.table(table).delete().eq("user_id", user_id).execute()
                    print(f"  Cleaned {table}")
                except Exception as e:
                    print(f"  Skipped {table}: {e}")
            
            # Delete the user record itself
            admin_client.table("users").delete().eq("id", user_id).execute()
            print(f"\n✅ Deleted user record {user_id}")
        else:
            print(f"\n✓ No database user found for {target_email}")
    except Exception as e:
        print(f"Error checking database: {e}")
    
    print("\n✅ Complete! User should now be able to log in fresh.")
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
