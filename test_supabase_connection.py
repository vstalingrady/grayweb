#!/usr/bin/env python3
"""Test Supabase connection and verify required tables for proactivity."""

import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from supabase_utils import create_supabase_client

def main():
    print("Testing Supabase connection...")
    
    # Create client
    try:
        supabase = create_supabase_client()
        if not supabase:
            print("❌ Failed to create Supabase client - returned None")
            return 1
    except Exception as e:
        print(f"❌ Exception creating Supabase client: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("✅ Supabase client created successfully")
    
    # Test required tables
    required_tables = [
        "general_chat_messages",
        "proactive_notifications",
        "proactivity_settings",
        "user_data",
    ]
    
    print("\nChecking required tables:")
    for table_name in required_tables:
        try:
            # Try to query the table (limit 0 to just check if it exists)
            result = supabase.table(table_name).select("*").limit(0).execute()
            print(f"  ✅ {table_name}")
        except Exception as e:
            error_msg = str(e)
            if "does not exist" in error_msg or "not found" in error_msg.lower():
                print(f"  ❌ {table_name} - TABLE MISSING")
            else:
                print(f"  ⚠️  {table_name} - Error: {error_msg}")
    
    # Test if we can query user data
    print("\nTesting user_data table:")
    try:
        result = supabase.table("user_data").select("id, user_identifier").limit(3).execute()
        rows = result.data or []
        print(f"  ✅ Found {len(rows)} user_data records")
        for row in rows:
            print(f"    - user_identifier={row.get('user_identifier')}, id={row.get('id')}")
    except Exception as e:
        print(f"  ❌ Error querying user_data: {e}")
    
    # Test proactivity_settings
    print("\nTesting proactivity_settings table:")
    try:
        result = supabase.table("proactivity_settings").select("user_id, payload").limit(3).execute()
        rows = result.data or []
        print(f"  ✅ Found {len(rows)} proactivity settings")
        for row in rows:
            user_id = row.get('user_id')
            payload = row.get('payload', {})
            cadence = payload.get('cadence', 'Unknown')
            print(f"    - user_id={user_id}, cadence={cadence}")
    except Exception as e:
        print(f"  ❌ Error querying proactivity_settings: {e}")
    
    print("\n" + "="*60)
    print("Supabase connection test complete!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
