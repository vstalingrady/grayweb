import databases
import asyncio

async def main():
    db = databases.Database("sqlite:///test.db")
    print(f"Type of db.url: {type(db.url)}")
    print(f"Attributes of db.url: {dir(db.url)}")
    try:
        print(f"db.url.scheme: {db.url.scheme}")
    except AttributeError:
        print("No scheme")
        
    try:
        print(f"db.url.drivername: {db.url.drivername}")
    except AttributeError:
        print("No drivername")
        
    try:
        print(f"db.url.dialect: {db.url.dialect}")
    except AttributeError:
        print("No dialect")

if __name__ == "__main__":
    asyncio.run(main())
