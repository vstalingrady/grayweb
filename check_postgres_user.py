import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv("/home/ubuntu/gray/.env")
DATABASE_URL = os.getenv("DATABASE_URL")

async def main():
    print(f"Connecting to {DATABASE_URL.split('@')[1]}")
    conn = await asyncpg.connect(DATABASE_URL)
    rows = await conn.fetch("SELECT * FROM users WHERE email = 'cornermaniac777@gmail.com'")
    if rows:
        print("User found:")
        for row in rows:
            print(dict(row))
    else:
        print("User NOT found")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
