
import asyncio
import os
import sys
from backend.database import database, users
from sqlalchemy import select

# Mock environment
sys.path.append(os.getcwd())

async def fix_tier():
    print("Fixing tier for vstalingrady@gmail.com...")
    await database.connect()
    try:
        # Find user
        query = users.select().where(users.c.email == "vstalingrady@gmail.com")
        user = await database.fetch_one(query)
        
        if not user:
            print("User vstalingrady@gmail.com not found.")
            return

        print(f"Found user: {user.id}, Current Tier: {user.plan_tier}")
        
        if user.plan_tier != "pioneer":
            await database.execute(
                users.update()
                .where(users.c.id == user.id)
                .values(plan_tier="pioneer")
            )
            print("Updated to 'pioneer'.")
        else:
            print("Already 'pioneer'.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(fix_tier())
