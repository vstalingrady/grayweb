import asyncio
import os
from databases import Database
from dotenv import load_dotenv

load_dotenv(override=True)

async def check_user():
    database_url = os.getenv("DATABASE_URL")
    database = Database(database_url)
    await database.connect()
    
    query = "SELECT * FROM users WHERE id = 13"
    user = await database.fetch_one(query)
    
    print(f"User 13 found: {user is not None}")
    if user:
        print(f"User details: {dict(user)}")
        
    await database.disconnect()

if __name__ == "__main__":
    asyncio.run(check_user())
