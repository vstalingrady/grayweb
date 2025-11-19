#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from supabase_utils import create_supabase_client

def main():
    print("Checking Supabase reminders...")
    
    try:
        supabase = create_supabase_client()
        if not supabase:
            print("❌ Failed to create Supabase client")
            return 1
            
        result = supabase.table("reminders").select("*").order("created_at", desc=True).limit(5).execute()
        reminders = result.data or []
        print(f"Found {len(reminders)} reminders:")
        for r in reminders:
            print(f"  - ID: {r.get('id')}, Label: {r.get('label')}, Status: {r.get('status')}, RemindAt: {r.get('remind_at')}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
        
    return 0

if __name__ == "__main__":
    sys.exit(main())
