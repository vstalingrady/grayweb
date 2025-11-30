import databases
import asyncio

async def main():
    db = databases.Database("sqlite+aiosqlite:///test.db")
    print(f"Sqlite+aiosqlite scheme: {db.url.scheme}")
    print(f"Sqlite+aiosqlite dialect: {db.url.dialect}")

if __name__ == "__main__":
    asyncio.run(main())
