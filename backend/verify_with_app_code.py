import asyncio
import os
import sys
from pathlib import Path

# Add backend to sys.path so we can import modules
sys.path.append(str(Path(__file__).parent))

from db_config import db_config

async def main():
    print("Connecting to databases...")
    await db_config.connect()
    
    print(f"Remote DB configured: {bool(db_config.remote_db)}")
    print(f"Local DB configured: {bool(db_config.local_db)}")
    
    if db_config.remote_db:
        print(f"Remote URL: {db_config.remote_url}")
        try:
            print("Checking remote 'users' table columns...")
            query = """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'daily_gemini_pro_usage'
            """
            result = await db_config.remote_db.fetch_all(query)
            print(f"Remote columns found: {result}")
            
            # Try a direct select
            try:
                await db_config.remote_db.execute("SELECT daily_gemini_pro_usage FROM users LIMIT 1")
                print("Direct SELECT on remote DB succeeded.")
            except Exception as e:
                print(f"Direct SELECT on remote DB failed: {e}")
                
        except Exception as e:
            print(f"Remote DB check failed: {e}")

    if db_config.local_db:
        print(f"Local URL: {db_config.local_url}")
        try:
            print("Checking local 'users' table columns...")
            # SQLite specific check
            if "sqlite" in db_config.local_url:
                try:
                    await db_config.local_db.execute("SELECT daily_gemini_pro_usage FROM users LIMIT 1")
                    print("Direct SELECT on local DB succeeded.")
                except Exception as e:
                    print(f"Direct SELECT on local DB failed: {e}")
            else:
                 # Postgres local check
                 pass
        except Exception as e:
            print(f"Local DB check failed: {e}")

    await db_config.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
