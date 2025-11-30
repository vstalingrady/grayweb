#!/usr/bin/env python3
"""
Script to check for and report duplicate emails in the database.
This helps diagnose sync issues with Supabase.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.main import database, users, supabase
import sqlalchemy


async def check_local_duplicates():
    """Check for duplicate emails in local database"""
    print("Checking local database for duplicate emails...")
    
    try:
        await database.connect()
        
        # Get all users ordered by email
        query = users.select().order_by(users.c.email)
        rows = await database.fetch_all(query)
        
        email_to_users = {}
        for row in rows:
            email = row['email']
            if email not in email_to_users:
                email_to_users[email] = []
            email_to_users[email].append({
                'id': row['id'],
                'auth_user_id': row['auth_user_id'],
                'full_name': row['full_name'],
            })
        
        # Find duplicates
        duplicates = {email: users for email, users in email_to_users.items() if len(users) > 1}
        
        if duplicates:
            print(f"\n❌ Found {len(duplicates)} duplicate email(s) in local database:")
            for email, user_list in duplicates.items():
                print(f"\n  Email: {email}")
                for user in user_list:
                    print(f"    - User ID: {user['id']}, Auth ID: {user['auth_user_id']}, Name: {user['full_name']}")
        else:
            print("✓ No duplicate emails in local database")
        
        await database.disconnect()
        return duplicates
        
    except Exception as e:
        print(f"Error checking local database: {e}")
        await database.disconnect()
        return {}


async def check_supabase_users():
    """Check which users exist in Supabase"""
    if not supabase:
        print("\n⚠️  Supabase is not configured - skipping Supabase check")
        return
    
    print("\n\nChecking Supabase for user sync status...")
    
    try:
        await database.connect()
        
        # Get all local users
        query = users.select().order_by(users.c.id)
        local_users = await database.fetch_all(query)
        
        print(f"\nChecking {len(local_users)} local users against Supabase...")
        
        missing_in_supabase = []
        
        for user in local_users:
            user_id = user['id']
            try:
                result = supabase.table("users").select("id").eq("id", user_id).limit(1).execute()
                if not result.data:
                    missing_in_supabase.append({
                        'id': user_id,
                        'email': user['email'],
                        'name': user['full_name']
                    })
            except Exception as e:
                print(f"  Error checking user {user_id}: {e}")
        
        if missing_in_supabase:
            print(f"\n❌ Found {len(missing_in_supabase)} user(s) missing in Supabase:")
            for user in missing_in_supabase:
                print(f"    - User ID: {user['id']}, Email: {user['email']}, Name: {user['name']}")
        else:
            print("✓ All local users exist in Supabase")
        
        await database.disconnect()
        
    except Exception as e:
        print(f"Error checking Supabase: {e}")
        await database.disconnect()


if __name__ == "__main__":
    asyncio.run(check_local_duplicates())
    asyncio.run(check_supabase_users())
