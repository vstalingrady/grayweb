#!/usr/bin/env python3
"""Script to update user plan tier to pioneer using Supabase client"""

import os
from dotenv import load_dotenv
from pathlib import Path

# Add parent directory to path to import supabase_utils
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from supabase_utils import create_supabase_client

# Load env
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

def update_user_to_pioneer(user_id: int = 1):
    supabase = create_supabase_client()
    if not supabase:
        print("Error: Could not create Supabase client. Check your environment variables.")
        return

    try:
        # Check current metadata for user
        result = supabase.table("user_data").select("id, metadata").eq("id", user_id).execute()
        
        if result.data:
            user = result.data[0]
            metadata = user.get('metadata', {})
            print(f"User {user_id} current metadata: {metadata}")
            print(f"Current plan_tier: {metadata.get('plan_tier', 'Not set')}")
        else:
            print(f"User {user_id} not found in user_data table")
            return
        
        # Update plan_tier in metadata
        updated_metadata = metadata.copy()
        updated_metadata['plan_tier'] = 'pioneer'
        
        update_result = supabase.table("user_data").update({"metadata": updated_metadata}).eq("id", user_id).execute()
        
        if update_result.data:
            print(f"✅ User {user_id} plan_tier updated to: pioneer")
            # Verify the update
            verify_result = supabase.table("user_data").select("id, metadata").eq("id", user_id).execute()
            if verify_result.data:
                new_metadata = verify_result.data[0].get('metadata', {})
                print(f"Verified: plan_tier = {new_metadata.get('plan_tier')}")
        else:
            print("❌ Update failed")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_user_to_pioneer(1)
