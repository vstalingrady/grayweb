#!/usr/bin/env python3
"""
Script to delete orphaned Supabase Auth user for cornermaniac777@gmail.com
This fixes the redirect loop issue.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

sys.path.insert(0, str(ROOT_DIR / "backend"))

from supabase_utils import create_supabase_service_client

def main():
    admin_client, key_source = create_supabase_service_client()
    
    if not admin_client:
        print("❌ No admin Supabase client available")
        print("   Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env")
        return 1
    
    print(f"✓ Using admin client (key source: {key_source})")
    
    target_email = "cornermaniac777@gmail.com"
    
    try:
        # List all users and find the target
        response = admin_client.auth.admin.list_users()
        users = getattr(response, "users", []) or []
        
        target_user = None
        for user in users:
            if hasattr(user, "email") and user.email == target_email:
                target_user = user
                break
        
        if not target_user:
            print(f"✓ No Auth user found for {target_email}")
            print("  You can now log in fresh and the system will create a new user record.")
            return 0
        
        print(f"Found Auth user: {target_user.id}")
        print(f"Deleting Auth user for {target_email}...")
        
        admin_client.auth.admin.delete_user(target_user.id)
        
        print("✅ SUCCESS! Auth user deleted.")
        print("   You can now:")
        print("   1. Clear your browser cookies/storage")
        print("   2. Log in with Google/Discord again")
        print("   3. A fresh user account will be created")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
