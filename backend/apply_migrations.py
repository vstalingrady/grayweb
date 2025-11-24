
import os
from pathlib import Path
from sqlalchemy import create_engine, text

# Load env manually
ROOT_DIR = Path(__file__).resolve().parent.parent
env_path = ROOT_DIR / ".env"

if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                os.environ[key] = value

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

def apply_sql_file(engine, file_path):
    print(f"Applying {file_path.name}...")
    with open(file_path) as f:
        sql_content = f.read()
    
    # Split by special marker if needed, but for now try executing as whole
    # SQLAlchemy might struggle with multiple statements if not using specific driver features
    # But psycopg2 usually handles it if passed as one string
    
    with engine.connect() as conn:
        conn.execute(text(sql_content))
        conn.commit()
    print(f"Applied {file_path.name}")

if __name__ == "__main__":
    url = get_remote_url()
    if not url:
        print("Could not determine REMOTE_DATABASE_URL")
        exit(1)

    print(f"Connecting to {url.split('@')[1] if '@' in url else '...'}")
    engine = create_engine(url)
    
    migrations_dir = ROOT_DIR / "supabase" / "migrations"
    files_to_apply = [
        "20251116133000_refactor_chat_tables.sql",
        "20251116140000_user_first_chat_schema.sql"
    ]
    
    for filename in files_to_apply:
        file_path = migrations_dir / filename
        if file_path.exists():
            try:
                apply_sql_file(engine, file_path)
            except Exception as e:
                print(f"Error applying {filename}: {e}")
        else:
            print(f"File not found: {file_path}")
