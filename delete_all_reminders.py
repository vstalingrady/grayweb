#!/usr/bin/env python3
"""Delete all reminders from Supabase"""

import os
from supabase import create_client, Client

# Initialize Supabase client
url: str = os.environ.get("SUPABASE_URL", "https://wipadvkkzpyeiaanfrlq.supabase.co")
key: str = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpcGFkdmtrenB5ZWlhYW5mcmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5MDI0NjcsImV4cCI6MjA0NzQ3ODQ2N30.Aq7_LTKdvBIZxKJCpKNPEfcxzPjQpGnBWZXEjZgWiHQ")
supabase: Client = create_client(url, key)

print("Deleting all reminders for user_id=1...")

try:
    # Delete all reminders for user_id=1
    result = supabase.table("reminders").delete().eq("user_id", 1).execute()
    print(f"✅ Successfully deleted all reminders")
    print(f"Deleted: {result.data if result.data else 'No data returned'}")
except Exception as e:
    print(f"❌ Error deleting reminders: {e}")

# Verify deletion
print("\nVerifying deletion...")
try:
    result = supabase.table("reminders").select("*").eq("user_id", 1).execute()
    if result.data:
        print(f"⚠️  Still found {len(result.data)} reminders:")
        for reminder in result.data:
            print(f"  - ID: {reminder['id']}, Label: {reminder['label']}, Status: {reminder['status']}")
    else:
        print("✅ All reminders deleted successfully!")
except Exception as e:
    print(f"❌ Error checking reminders: {e}")
