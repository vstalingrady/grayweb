
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
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # Service role key usually, but anon key works for signup

print(f"Testing Sign-Up with URL: {SUPABASE_URL}")

async def test_signup():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL or SUPABASE_KEY not set")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    import random
    import string
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    email = f"test_user_{random_str}@example.com"
    password = "password123"
    
    print(f"Attempting to sign up user: {email}")
    
    try:
        # Sign up
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
        })
        
        if res.user:
            print(f"SUCCESS: User created! ID: {res.user.id}")
            print(f"Email Confirmed At: {res.user.email_confirmed_at}")
            print(f"Session: {'Present' if res.session else 'None'}")
            
            # Clean up (optional, but good for repeated tests if we had admin access easily here)
            # For now, just knowing it succeeded is enough.
        else:
            print("FAILURE: No user returned in response.")
            print(res)
            
    except Exception as e:
        print(f"EXCEPTION during sign-up: {e}")

if __name__ == "__main__":
    asyncio.run(test_signup())
