import os
import sys
import asyncio
import asyncpg
from dotenv import load_dotenv

# Load env vars
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def fix_db():
    print(f"Connecting to {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'DB'}...")
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Fix users table updated_at
        print("Checking users table for null updated_at...")
        result = await conn.execute("UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL")
        print(f"Updated users: {result}")

        # Fix chat_sessions table scope
        print("Checking chat_sessions table for null scope...")
        # Check if column exists first? It should if the error occurred.
        # But we can just try update.
        try:
            result = await conn.execute("UPDATE chat_sessions SET scope = 'thread' WHERE scope IS NULL")
            print(f"Updated chat_sessions: {result}")
        except Exception as e:
            print(f"Error updating chat_sessions: {e}")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_db())
