
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

async def add_column():
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return

    print(f"Connecting to database...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        
        # Check if column exists
        row = await conn.fetchrow("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='auth_user_id';
        """)
        
        if not row:
            print("Adding auth_user_id column...")
            await conn.execute("ALTER TABLE users ADD COLUMN auth_user_id TEXT;")
            await conn.execute("CREATE INDEX ix_users_auth_user_id ON users (auth_user_id);")
            print("Column added successfully.")
        else:
            print("Column auth_user_id already exists.")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
