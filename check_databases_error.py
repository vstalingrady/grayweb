import asyncio
import databases
import sqlalchemy

DATABASE_URL = "sqlite:///./test_error.db"

async def main():
    database = databases.Database(DATABASE_URL)
    await database.connect()
    
    query = "CREATE TABLE users (id INTEGER)"
    try:
        await database.execute(query)
    except Exception:
        pass # Table might exist

    try:
        await database.fetch_one("SELECT daily_gemini_pro_usage FROM users")
    except Exception as e:
        print(f"Error type: {type(e)}")
        print(f"Error message: {e}")
    
    await database.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
