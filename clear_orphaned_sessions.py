#!/usr/bin/env python3
"""
Script to clear orphaned Supabase Auth sessions
This helps when users have invalid session tokens stuck in their browser
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
        return 1
    
    print(f"✓ Using admin client (key source: {key_source})")
    print("\nListing all Supabase Auth users...")
    
    try:
        response = admin_client.auth.admin.list_users()
        users = getattr(response, "users", []) or []
        
        print(f"\nFound {len(users)} Auth users:\n")
        
        for user in users:
            email = getattr(user, "email", "N/A")
            user_id = getattr(user, "id", "N/A")
            created = getattr(user, "created_at", "N/A")
            
            # Check if user exists in database
            try:
                db_user = admin_client.table("users").select("id,email").eq("auth_user_id", user_id).execute()
                
                if not db_user.data:
                    print(f"⚠️  ORPHANED: {email} (Auth ID: {user_id})")
                    print(f"   Created: {created}")
                    print(f"   No matching database record found")
                    print()
                else:
                    print(f"✓  {email} (DB ID: {db_user.data[0]['id']}, Auth ID: {user_id})")
            except Exception as e:
                print(f"❌ Error checking {email}: {e}")
        
        print("\n" + "="*60)
        print("To delete an orphaned user, use admin_client.auth.admin.delete_user(user_id)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
