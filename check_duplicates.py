
import asyncio
import sys
import os
from databases import Database
from dotenv import load_dotenv

# Load env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gray.db")

async def check_duplicates():
    print(f"Checking for duplicates in {DATABASE_URL}...")
    database = Database(DATABASE_URL)
    await database.connect()
    
    query = """
    SELECT lower(email) as email_lower, count(*) as count
    FROM users
    GROUP BY lower(email)
    HAVING count(*) > 1
    """
    
    results = await database.fetch_all(query)
    
    if results:
        print(f"Found {len(results)} duplicate email groups:")
        for row in results:
            print(f"Email: {row['email_lower']}, Count: {row['count']}")
            
            # Get details
            users_query = "SELECT id, email, created_at, daily_token_usage FROM users WHERE lower(email) = :email"
            users = await database.fetch_all(users_query, values={"email": row['email_lower']})
            for u in users:
                print(f"  - ID: {u['id']}, Email: {u['email']}, Created: {u['created_at']}, Usage: {u['daily_token_usage']}")
    else:
        print("No duplicate users found.")
        
    await database.disconnect()

if __name__ == "__main__":
    asyncio.run(check_duplicates())
