import asyncio
import os
import sys
from pathlib import Path
import databases

# Set up paths to import backend modules
sys.path.append(str(Path(__file__).parent.parent))

from backend.models.user import serialize_user_row

async def test_real_serialization():
    db_url = "sqlite:////home/ubuntu/gray/data/users.db"
    if not os.path.exists("/home/ubuntu/gray/data/users.db"):
        # Not on production?
        print("Production DB not found locally")
        return

    db = databases.Database(db_url)
    await db.connect()
    
    row = await db.fetch_one("SELECT * FROM users WHERE email = 'vstalingrady@gmail.com'")
    if not row:
        print("User not found")
        await db.disconnect()
        return
        
    serialized = serialize_user_row(row)
    print(f"Serialized plan_tier: {serialized.get('plan_tier')}")
    print(f"Full serialized keys: {list(serialized.keys())}")
    print(f"Plan tier value: '{serialized['plan_tier']}'")
    
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(test_real_serialization())
