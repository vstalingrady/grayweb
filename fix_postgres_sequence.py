import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

async def fix_sequence():
    print(f"Connecting to {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'database'}...")
    
    # Parse the URL to get connection details or just pass it if asyncpg supports it
    # asyncpg.connect(dsn=DATABASE_URL)
    
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected.")
        
        # Get max id
        max_id = await conn.fetchval("SELECT MAX(id) FROM users")
        print(f"Max user ID is: {max_id}")
        
        if max_id is None:
            max_id = 0
            
        # Reset sequence
        new_seq = max_id + 1
        print(f"Resetting users_id_seq to {new_seq}...")
        
        # Check if sequence exists and what its name is (usually users_id_seq)
        # We can use setval
        await conn.execute(f"SELECT setval('users_id_seq', {new_seq}, false)")
        
        print("Sequence reset successfully.")
        
        await conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(fix_sequence())
