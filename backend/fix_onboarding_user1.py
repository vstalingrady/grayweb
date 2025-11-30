#!/usr/bin/env python3
"""Quick script to fix has_seen_general_chat for user ID 1"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from database import database, users
from datetime import datetime

async def fix_user_onboarding():
    await database.connect()
    try:
        # Get current status
        user = await database.fetch_one(users.select().where(users.c.id == 1))
        if not user:
            print("User ID 1 not found")
            return
        
        print(f"Current status for user {user['email']}:")
        print(f"  has_seen_general_chat: {user.get('has_seen_general_chat')}")
        
        # Update to mark as seen
        await database.execute(
            users.update()
            .where(users.c.id == 1)
            .values(
                has_seen_general_chat=True,
                updated_at=datetime.utcnow()
            )
        )
        
        # Verify
        updated_user = await database.fetch_one(users.select().where(users.c.id == 1))
        print(f"\nUpdated status:")
        print(f"  has_seen_general_chat: {updated_user.get('has_seen_general_chat')}")
        print("\n✓ Onboarding flag set to True for user ID 1")
        
    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(fix_user_onboarding())
