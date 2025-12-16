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
    from backend.database import database, general_chat_messages
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)


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
    loop.run_until_complete(test_general_chat_table())
