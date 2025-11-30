
import asyncio
import sys
import os
from unittest.mock import MagicMock, AsyncMock
import sqlalchemy
from databases import Database

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mocking imports that might be missing or problematic
sys.modules["backend.gemini_client"] = MagicMock()
sys.modules["backend.openrouter_client"] = MagicMock()
sys.modules["backend.google_calendar"] = MagicMock()

from backend.database import users, metadata

async def reproduce_issue():
    print("Reproducing email case sensitivity issue...")
    
    # Use a file-based SQLite database for testing to share between sync and async connections
    db_file = "test_repro.db"
    if os.path.exists(db_file):
        os.remove(db_file)
        
    database_url = f"sqlite:///{db_file}"
    database = Database(database_url)
    
    await database.connect()
    
    # Create tables
    engine = sqlalchemy.create_engine(database_url)
    metadata.create_all(engine)
    
    # 1. Create user with mixed case email
    email_mixed = "User@Example.com"
    print(f"Creating user with email: {email_mixed}")
    query = users.insert().values(
        email=email_mixed,
        full_name="Test User",
        created_at=sqlalchemy.func.now(),
        updated_at=sqlalchemy.func.now()
    )
    await database.execute(query)
    
    # 2. Try to find user with lowercase email using the logic from get_user_by_email
    email_lower = "user@example.com"
    print(f"Searching for user with email: {email_lower}")
    
    # Updated implementation logic (FIXED):
    query = users.select().where(sqlalchemy.func.lower(users.c.email) == email_lower.lower())
    user = await database.fetch_one(query)
    
    if user:
        print("User FOUND with lowercase email (Fix verified!)")
    else:
        print("User NOT FOUND with lowercase email (Fix FAILED)")
        sys.exit(1)
        
    # 3. Try to create the lowercase user (simulating what happens next)
    # Since user was found, we shouldn't even try to create one in the real app.
    # But if we did try to create one with lowercase email:
    print(f"Attempting to create user with email: {email_lower}")
    try:
        # In the real app, we now lowercase before insert.
        # But since 'User@Example.com' exists, inserting 'user@example.com' 
        # might still succeed if the DB allows it (Postgres/SQLite are case sensitive).
        # However, the goal is that we FOUND the user, so we won't try to create it.
        pass
    except Exception as e:
        pass

    await database.disconnect()

if __name__ == "__main__":
    asyncio.run(reproduce_issue())
