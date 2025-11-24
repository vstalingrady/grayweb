
import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

def get_remote_url():
    remote_url = os.getenv("REMOTE_DATABASE_URL")
    if not remote_url:
        supabase_url = os.getenv("SUPABASE_URL", "")
        if supabase_url:
            project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
            db_password = os.getenv("SUPABASE_DB_PASSWORD", "")
            if db_password:
                remote_url = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
    return remote_url

def check_tables():
    url = get_remote_url()
    if not url:
        print("Could not determine REMOTE_DATABASE_URL")
        return

    print(f"Connecting to {url.split('@')[1] if '@' in url else '...'}")
    engine = create_engine(url)
    
    with engine.connect() as conn:
        # Check for tables
        tables = ["conversations", "chat_threads", "user_chat_threads", "user_data"]
        print("Checking tables...")
        for t in tables:
            exists = conn.execute(text(f"SELECT to_regclass('public.{t}')")).scalar()
            print(f"Table '{t}': {'EXISTS' if exists else 'MISSING'}")

if __name__ == "__main__":
    check_tables()
