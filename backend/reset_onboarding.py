#!/usr/bin/env python3
"""Reset user ID 1 onboarding state for testing."""
from supabase import create_client
import os

url = os.getenv('SUPABASE_URL', 'http://127.0.0.1:54321')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU')
supabase = create_client(url, key)

print("Resetting user ID 1 onboarding state...")
result = supabase.table('users').update({
    'has_seen_general_chat': False,
    'personalization_nickname': None,
    'personalization_occupation': None,
    'personalization_about': None
}).eq('id', 1).execute()

if result.data:
    user = result.data[0]
    print(f"✓ Reset complete:")
    print(f"  has_seen_general_chat: {user.get('has_seen_general_chat')}")
    print(f"  personalization_nickname: {user.get('personalization_nickname')}")
    print(f"  personalization_occupation: {user.get('personalization_occupation')}")
    print(f"  personalization_about: {user.get('personalization_about')}")
else:
    print("✗ Failed to reset")
