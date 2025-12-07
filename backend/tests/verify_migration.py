import sys
import os
import asyncio
import logging
import sqlalchemy

# Add root to path
sys.path.append("/home/ubuntu/gray")

# Setup basic logging
logging.basicConfig(level=logging.INFO)

# We need to load env vars effectively for main to import correctly
from dotenv import load_dotenv
load_dotenv("/home/ubuntu/gray/.env")

try:
    from backend.main import get_or_create_user_streak, update_user_streak, _compute_proactivity_streak
    from backend.database import user_streaks, proactivity_logs, database, general_chat_messages
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

async def test_streaks():
    print("=== Testing Streaks ===")
    async with database:
        user_id = 1 # Using known existing user
        
        # 1. Test get_or_create_user_streak
        print(f"Fetching streak for user {user_id}...")
        streak = await get_or_create_user_streak(user_id, database)
        print(f"Result: {streak}")
        
        if streak.id == 0 and streak.created_at == streak.updated_at:
             # This is the "default" object if DB insert failed or logic fallback?
             # My rewritten logic returns a real object from DB insert.
             # Unless exception occurred.
             pass

        # 2. Test update_user_streak
        print(f"Updating streak for user {user_id}...")
        # Force a timezone to ensure logic runs
        updated = await update_user_streak(user_id, database, user_timezone="UTC")
        print(f"Update Result: {updated}")
        
        if isinstance(updated, dict):
            # Verify DB content
            query = user_streaks.select().where(user_streaks.c.user_id == user_id)
            row = await database.fetch_one(query)
            print(f"DB Row: {dict(row) if row else 'None'}")
            assert row is not None, "Row should exist in SQLite"
            assert row['current_streak'] == updated['current_streak'], "DB should match return value"
        else:
            print("Update returned unexpected type (maybe default object?)")


async def test_general_chat_table():
    print("\n=== Testing General Chat Table ===")
    async with database:
        # Just verify we can insert/read
        user_id = 1
        print("Inserting fake chat message...")
        
        # Verify user exists or create dummy
        from backend.database import users
        u_row = await database.fetch_one(users.select().where(users.c.id == user_id))
        if not u_row:
             print(f"User {user_id} not found, creating dummy user...")
             user_id = await database.execute(users.insert().values(
                 email="test@example.com", 
                 full_name="Test User",
                 role="user"
             ))
             print(f"Created user {user_id}")

        query = general_chat_messages.insert().values(
            user_id=user_id,
            user_data_id=1,
            role="user",
            content="Test message from migration verification",
        )
        
        msg_id = await database.execute(query)
        print(f"Inserted message ID: {msg_id}")
        
        # Read back
        row = await database.fetch_one(general_chat_messages.select().where(general_chat_messages.c.id == msg_id))
        print(f"Read back: {row['content']}")
        assert row['content'] == "Test message from migration verification"

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_streaks())
    loop.run_until_complete(test_general_chat_table())
