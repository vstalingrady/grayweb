
import asyncio
import os
import sys
from backend.database import database, users
from sqlalchemy import select, and_

# Mock environment
sys.path.append(os.getcwd())

async def downgrade_others():
    print("Downgrading all non-vstalingrady pioneers to scout...")
    await database.connect()
    try:
        # Find all users who are NOT vstalingrady@gmail.com but have 'pioneer' (or null, to be safe)
        query = users.select().where(
            and_(
                users.c.email != "vstalingrady@gmail.com",
                users.c.plan_tier == "pioneer"
            )
        )
        targets = await database.fetch_all(query)
        
        print(f"Found {len(targets)} users to downgrade.")
        
        if targets:
            await database.execute(
                users.update()
                .where(
                    and_(
                        users.c.email != "vstalingrady@gmail.com",
                        users.c.plan_tier == "pioneer"
                    )
                )
                .values(plan_tier="scout")
            )
            print("Downgrade complete.")
        else:
            print("No other pioneers found.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(downgrade_others())
