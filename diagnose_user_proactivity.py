
import asyncio
import os
import sys
from backend.database import database, users, proactivity_settings, proactive_notifications
from sqlalchemy import select

# Mock the environment to allow imports
sys.path.append(os.getcwd())

async def diagnose_proactivity(email):
    print(f"Diagnosing proactivity for: {email}")
    
    await database.connect()
    try:
        # 1. Get User ID
        query = users.select().where(users.c.email == email)
        user = await database.fetch_one(query)
        
        if not user:
            print(f"ERROR: User with email {email} not found.")
            return

        user_id = user.id
        print(f"User ID: {user_id}")

        # 2. Get Proactivity Settings
        query = proactivity_settings.select().where(proactivity_settings.c.user_id == user_id)
        settings = await database.fetch_one(query)
        
        if not settings:
            print(f"WARNING: No proactivity settings found for user {user_id}.")
        else:
            print("\n--- Proactivity Settings ---")
            print(f"Payload: {settings.payload}")
            # payload is stored as JSON string in DB but fetch_one might return it as string or dict depending on driver/setup. 
            # In ProactivityEngine._deserialize_payload handles string/dict.
            # Let's just print the raw value.

        # 3. Check Recent Notifications (to see if it was skipped due to recent send)
        print("\n--- Recent Notifications (Last 5) ---")
        query = proactive_notifications.select().where(
            proactive_notifications.c.user_id == user_id
        ).order_by(proactive_notifications.c.sent_at.desc()).limit(5)
        
        notifications = await database.fetch_all(query)
        for n in notifications:
            print(f"Type: {n.type}, Sent At: {n.sent_at}, Title: {n.title}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        await database.disconnect()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <email>")
    else:
        asyncio.run(diagnose_proactivity(sys.argv[1]))
