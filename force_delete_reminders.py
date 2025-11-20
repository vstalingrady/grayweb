#!/usr/bin/env python3
"""Force delete reminders using SQL"""

import os
import sys
from supabase import create_client, Client

# Get credentials from environment or use defaults
url = os.getenv("SUPABASE_URL", "https://wipadvkkzpyeiaanfrlq.supabase.co")

# Try to get service role key first, fall back to anon key
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

key = service_key or anon_key

if not key:
    print("❌ No Supabase key found in environment")
    print("Please set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY")
    sys.exit(1)

print(f"Using key type: {'SERVICE_ROLE' if service_key else 'ANON'}")
print(f"URL: {url}")

supabase: Client = create_client(url, key)

# List current reminders
print("\n📋 Current reminders:")
try:
    result = supabase.table("reminders").select("id, label, status, remind_at").eq("user_id", 1).execute()
    if result.data:
        for r in result.data:
            print(f"  - ID: {r['id']}, Label: {r['label']}, Status: {r['status']}, RemindAt: {r['remind_at']}")
    else:
        print("  No reminders found")
except Exception as e:
    print(f"❌ Error listing reminders: {e}")
    sys.exit(1)

# Delete all reminders
print("\n🗑️  Deleting all reminders for user_id=1...")
try:
    result = supabase.table("reminders").delete().eq("user_id", 1).execute()
    print(f"✅ Delete request completed")
    print(f"Response: {result}")
except Exception as e:
    print(f"❌ Error deleting: {e}")
    sys.exit(1)

# Verify
print("\n✅ Verifying deletion...")
try:
    result = supabase.table("reminders").select("*").eq("user_id", 1).execute()
    if result.data:
        print(f"⚠️  Still found {len(result.data)} reminders - RLS might be blocking deletes!")
        for r in result.data:
            print(f"  - ID: {r['id']}, Label: {r['label']}")
    else:
        print("✅ All reminders successfully deleted!")
except Exception as e:
    print(f"❌ Error verifying: {e}")
