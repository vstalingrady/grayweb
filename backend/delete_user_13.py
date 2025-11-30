
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import asyncpg

# Load env manually
ROOT_DIR = Path(__file__).resolve().parent.parent
env_path = ROOT_DIR / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

async def delete_user():
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return

    print(f"Connecting to database...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Check if user exists
        user = await conn.fetchrow("SELECT id, email, auth_user_id FROM users WHERE id = 13;")
        
        if user:
            print(f"Found user 13: {user['email']} (Auth ID: {user['auth_user_id']})")
            print("Deleting user 13...")
            await conn.execute("DELETE FROM users WHERE id = 13;")
            print("User 13 deleted successfully.")
        else:
            print("User 13 not found in the local database.")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(delete_user())
