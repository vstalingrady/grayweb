#!/usr/bin/env python3
"""
Test Google Calendar OAuth flow directly.
"""
import sys
import os
sys.path.append('/home/vstaln/hackathon/backend')
from dotenv import load_dotenv
from google_calendar import get_google_auth_url

# Load environment variables from .env file
load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

print(f"GOOGLE_CLIENT_ID: {GOOGLE_CLIENT_ID}")
print(f"GOOGLE_CLIENT_SECRET: {GOOGLE_CLIENT_SECRET}")
print(f"GOOGLE_REDIRECT_URI: {GOOGLE_REDIRECT_URI}")

if __name__ == "__main__":
    try:
        print("Testing Google Calendar OAuth URL generation...")
        result = get_google_auth_url(1)
        print(f"✅ Success! Authorization URL: {result.authorization_url}")
        print(f"✅ State: {result.state}")
        print(f"📱 Click here to authorize: {result.authorization_url}")
    except Exception as e:
        print(f"❌ Error: {e}")