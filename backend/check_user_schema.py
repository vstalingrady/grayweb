#!/usr/bin/env python3
"""Script to check user_data table schema"""

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

def check_user_data_schema():
    supabase = create_supabase_client()
    if not supabase:
        print("Error: Could not create Supabase client. Check your environment variables.")
        return

    try:
        # Get user data for user_id 1 to see what columns exist
        result = supabase.table("user_data").select("*").eq("id", 1).execute()
        
        if result.data:
            user = result.data[0]
            print(f"User 1 data columns:")
            for key, value in user.items():
                print(f"  {key}: {value}")
        else:
            print("User 1 not found in user_data table")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_user_data_schema()
