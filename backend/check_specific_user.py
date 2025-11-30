
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

async def check_user():
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return

    print(f"Connecting to database...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        email = "cornermaniac777@gmail.com"
        user = await conn.fetchrow("SELECT id, email, auth_user_id FROM users WHERE email = $1;", email)
        
        if user:
            print(f"User FOUND: {user['email']} (ID: {user['id']}, Auth ID: {user['auth_user_id']})")
        else:
            print(f"User NOT found: {email}")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_user())
