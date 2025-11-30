
import os
import sys
from pathlib import Path
import asyncio

# Add the project root to the Python path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env", override=True)

import databases
import sqlalchemy

async def update_user_plan_tier(user_id: int, new_tier: str):
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./users.db")
    database = databases.Database(DATABASE_URL)
    metadata = sqlalchemy.MetaData()

    # Reflect the existing 'users' table structure
    users = sqlalchemy.Table(
        "users",
        metadata,
        autoload_with=sqlalchemy.create_engine(DATABASE_URL)
    )

    await database.connect()
    try:
        query = users.update().where(users.c.id == user_id).values(plan_tier=new_tier)
        await database.execute(query)
        print(f"Successfully updated user {user_id} plan_tier to '{new_tier}'.")
    except Exception as e:
        print(f"Error updating user {user_id} plan_tier: {e}")
    finally:
        await database.disconnect()

if __name__ == "__main__":
    # Assuming user_id 1 and new_tier 'scout' as per request
    asyncio.run(update_user_plan_tier(1, 'scout'))
