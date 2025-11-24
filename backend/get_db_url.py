
import os
from pathlib import Path

# Load env manually
ROOT_DIR = Path(__file__).resolve().parent.parent
env_path = ROOT_DIR / ".env"

if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
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

if __name__ == "__main__":
    url = get_remote_url()
    if url:
        print(url)
    else:
        print("COULD_NOT_DETERMINE_URL")
