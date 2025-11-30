
import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# Load env manually
ROOT_DIR = Path(__file__).resolve().parent
env_path = ROOT_DIR / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def check_auth_user():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    email = "cornermaniac777@gmail.com"
    print(f"Checking auth.users for: {email}")
    
    try:
        # List users (this requires service role key)
        res = supabase.auth.admin.list_users()
        
        users_list = res if isinstance(res, list) else res.users

        found = False
        for user in users_list:
            if user.email == email:
                print(f"User FOUND in auth.users: {user.email} (ID: {user.id})")
                found = True
                break
        
        if not found:
            print(f"User NOT found in auth.users: {email}")
            
    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    asyncio.run(check_auth_user())
