import databases
import asyncio

async def main():
    db = databases.Database("postgresql://user:pass@localhost/db")
    print(f"Postgres scheme: {db.url.scheme}")
    print(f"Postgres dialect: {db.url.dialect}")

if __name__ == "__main__":
    asyncio.run(main())
