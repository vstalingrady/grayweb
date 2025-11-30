
import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

DEFAULT_POOLER_HOST = os.getenv("SUPABASE_POOLER_HOST", "aws-1-ap-south-1.pooler.supabase.com")
DEFAULT_POOLER_PORT = os.getenv("SUPABASE_POOLER_PORT", "6543")

def get_remote_url():
    remote_url = os.getenv("REMOTE_DATABASE_URL")
    if not remote_url:
        supabase_url = os.getenv("SUPABASE_URL", "")
        if supabase_url:
            project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
            db_password = os.getenv("SUPABASE_DB_PASSWORD", "")
            if db_password:
                username = f"postgres.{project_ref}"
                remote_url = (
                    f"postgresql://{username}:{db_password}@"
                    f"{DEFAULT_POOLER_HOST}:{DEFAULT_POOLER_PORT}/postgres"
                )
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
