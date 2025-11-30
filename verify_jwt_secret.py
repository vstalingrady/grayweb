
import os
import jwt
from pathlib import Path
from dotenv import load_dotenv

# Load env manually
ROOT_DIR = Path(__file__).resolve().parent
env_path = ROOT_DIR / ".env"
load_dotenv(env_path)

ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

print(f"ANON_KEY: {ANON_KEY[:10]}...")
print(f"JWT_SECRET: {JWT_SECRET}")

try:
    decoded = jwt.decode(ANON_KEY, JWT_SECRET, algorithms=["HS256"])
    print("SUCCESS: ANON_KEY was signed with JWT_SECRET.")
    print(f"Payload: {decoded}")
except jwt.InvalidSignatureError:
    print("FAILURE: Signature verification failed! The ANON_KEY was NOT signed with this JWT_SECRET.")
except Exception as e:
    print(f"ERROR: {e}")
