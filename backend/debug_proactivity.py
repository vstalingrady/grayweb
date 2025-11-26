
import asyncio
import os
import sys
from pprint import pprint

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import database, supabase, users, proactivity_settings

async def main():
    user_id = 1
    print(f"Checking data for user_id: {user_id}")

    # Check User
    if supabase:
        print("Checking Supabase Users...")
        res = supabase.table("users").select("*").eq("id", user_id).execute()
        pprint(res.data)
    else:
        print("Checking SQLite Users...")
        await database.connect()
        query = "SELECT * FROM users WHERE id = :id"
        row = await database.fetch_one(query, {"id": user_id})
        print(dict(row) if row else "User not found")

    # Check Proactivity Settings
    if supabase:
        print("\nChecking Supabase Proactivity Settings...")
        res = supabase.table("proactivity_settings").select("*").eq("user_id", user_id).execute()
        pprint(res.data)
    else:
        print("\nChecking SQLite Proactivity Settings...")
        query = "SELECT * FROM proactivity_settings WHERE user_id = :user_id"
        row = await database.fetch_one(query, {"user_id": user_id})
        print(dict(row) if row else "Settings not found")

    # Check General Chat Messages after 2025-11-25 08:00:00
    if supabase:
        print("\nChecking Supabase General Chat Messages after 2025-11-25 08:00:00...")
        res = supabase.table("general_chat_messages").select("*").eq("user_id", user_id).gte("created_at", "2025-11-25T08:00:00").execute()
        pprint(res.data)
        
        print("\nChecking Proactive Notifications...")
        res = supabase.table("proactive_notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
        pprint(res.data)
    else:
        # SQLite fallback (omitted for brevity as we seem to use Supabase)
        pass

if __name__ == "__main__":
    asyncio.run(main())
